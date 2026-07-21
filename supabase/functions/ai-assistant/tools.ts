/**
 * BỘ CÔNG CỤ ĐỌC DỮ LIỆU CHO AI
 *
 * NGUYÊN TẮC BẢO MẬT (quan trọng):
 *  1. AI KHÔNG được viết SQL tự do. Chỉ gọi các tool định sẵn dưới đây với tham số
 *     đã ràng buộc kiểu — chặn injection và chặn truy vấn ngoài ý đồ.
 *  2. Mọi truy vấn chạy bằng SUPABASE CLIENT MANG JWT CỦA NGƯỜI DÙNG, nên RLS tự
 *     áp dụng: AI chỉ thấy đúng phần dữ liệu người đó được thấy. TUYỆT ĐỐI không
 *     dùng service_role key ở đây (sẽ bỏ qua RLS -> lộ dữ liệu chéo role).
 *  3. Mỗi tool khai báo `perms`: chỉ nạp cho người có ít nhất một quyền trong đó.
 */

export type ToolDef = {
    name: string;
    description: string;
    perms: string[];              // rỗng = mọi role đăng nhập đều dùng được
    input_schema: Record<string, unknown>;
    run: (args: any, db: any) => Promise<unknown>;
};

const LIMIT_MAX = 50;
const clampLimit = (n: unknown) => Math.min(Math.max(Number(n) || 10, 1), LIMIT_MAX);

export const TOOLS: ToolDef[] = [
    {
        name: 'danh_sach_du_an',
        description: 'Danh sách dự án/hợp đồng kèm giá trị, mã dự án. Dùng khi cần biết dự án nào đang có, hoặc để lấy id dự án cho câu hỏi tiếp theo.',
        perms: [],
        input_schema: {
            type: 'object',
            properties: {
                tu_khoa: { type: 'string', description: 'Lọc theo tên hoặc mã dự án (không bắt buộc)' },
                limit: { type: 'number', description: 'Số dòng tối đa, mặc định 10' },
            },
        },
        run: async (a, db) => {
            let q = db.from('projects')
                .select('id, code, internal_code, name, original_value, total_value_post_vat, status')
                .limit(clampLimit(a?.limit));
            if (a?.tu_khoa) q = q.or(`name.ilike.%${a.tu_khoa}%,code.ilike.%${a.tu_khoa}%,internal_code.ilike.%${a.tu_khoa}%`);
            const { data, error } = await q;
            if (error) throw new Error(error.message);
            return data;
        },
    },
    {
        name: 'cong_no_chu_dau_tu',
        description: 'Công nợ phải THU từ chủ đầu tư theo dự án: đã xuất hóa đơn, đã đề nghị, thực thu, còn nợ. Dùng cho câu hỏi về tiền khách hàng còn nợ mình.',
        perms: ['view_payments', 'view_contracts', 'view_dashboard'],
        input_schema: {
            type: 'object',
            properties: { limit: { type: 'number', description: 'Số dự án, mặc định 10' } },
        },
        run: async (a, db) => {
            const { data, error } = await db
                .from('payments')
                .select('project_id, invoice_amount, payment_request_amount, external_income, invoice_date, projects(code, internal_code, name)')
                .limit(500);
            if (error) throw new Error(error.message);
            const byProj: Record<string, any> = {};
            for (const p of data || []) {
                const k = p.project_id;
                if (!k) continue;
                const b = byProj[k] || (byProj[k] = {
                    du_an: p.projects?.internal_code || p.projects?.code || '?',
                    ten: p.projects?.name, da_xuat_hd: 0, da_de_nghi: 0, thuc_thu: 0,
                });
                if (p.invoice_date) b.da_xuat_hd += Number(p.invoice_amount) || 0;
                b.da_de_nghi += Number(p.payment_request_amount) || 0;
                b.thuc_thu += Number(p.external_income) || 0;
            }
            return Object.values(byProj)
                .map((b: any) => ({ ...b, con_no_hoa_don: b.da_xuat_hd - b.thuc_thu }))
                .sort((x: any, y: any) => y.con_no_hoa_don - x.con_no_hoa_don)
                .slice(0, clampLimit(a?.limit));
        },
    },
    {
        name: 'cong_no_thau_phu',
        description: 'Công nợ phải TRẢ cho nhà thầu phụ / tổ đội, 2 tầng: đến kỳ (đã duyệt − đã trả), khối lượng (nghiệm thu − đã trả), hóa đơn (xuất HĐ − đã trả). Dùng cho câu hỏi mình còn nợ thầu phụ bao nhiêu.',
        perms: ['view_labor', 'manage_labor', 'view_subcontractors', 'pay_labor', 'approve_labor'],
        input_schema: {
            type: 'object',
            properties: {
                loai: { type: 'string', enum: ['all', 'contractor', 'team'], description: 'contractor = nhà thầu xuất HĐ, team = tổ đội' },
                limit: { type: 'number' },
            },
        },
        run: async (a, db) => {
            let q = db.from('v_subcontractor_debt_by_partner')
                .select('partner_short_name, partner_name, entity_type, so_hop_dong, gt_thuc_tra, cong_no_den_ky, cong_no_khoi_luong, cong_no_hoa_don')
                .order('cong_no_den_ky', { ascending: false })
                .limit(clampLimit(a?.limit));
            if (a?.loai && a.loai !== 'all') q = q.eq('entity_type', a.loai);
            const { data, error } = await q;
            if (error) throw new Error(error.message);
            return data;
        },
    },
    {
        name: 'de_nghi_thanh_toan_nhan_cong',
        description: 'Danh sách đề nghị thanh toán nhân công theo trạng thái: PENDING (chờ duyệt), APPROVED (đã duyệt chờ chi), PARTIAL (chi một phần), PAID (đã chi). Dùng khi hỏi còn bao nhiêu phiếu chờ duyệt/chờ chi.',
        perms: ['view_labor', 'manage_labor', 'approve_labor', 'pay_labor'],
        input_schema: {
            type: 'object',
            properties: {
                trang_thai: { type: 'string', enum: ['PENDING', 'APPROVED', 'PARTIAL', 'PAID', 'all'] },
                limit: { type: 'number' },
            },
        },
        run: async (a, db) => {
            let q = db.from('expense_labor')
                .select('id, team_name, payment_stage, request_date, requested_amount, approved_amount, paid_amount, status, projects(code, internal_code)')
                .order('request_date', { ascending: false })
                .limit(clampLimit(a?.limit));
            if (a?.trang_thai && a.trang_thai !== 'all') q = q.eq('status', a.trang_thai);
            const { data, error } = await q;
            if (error) throw new Error(error.message);
            return data;
        },
    },
    {
        name: 'ton_kho_vat_tu',
        description: 'Tồn kho vật tư hiện tại. Dùng cho câu hỏi về số lượng còn trong kho, vật tư sắp hết.',
        perms: ['view_materials', 'view_all_inventory', 'import_inventory', 'export_inventory', 'manage_materials'],
        input_schema: {
            type: 'object',
            properties: {
                tu_khoa: { type: 'string', description: 'Lọc theo tên vật tư' },
                limit: { type: 'number' },
            },
        },
        run: async (a, db) => {
            let q = db.from('materials').select('id, code, name, unit, stock_quantity, min_stock').limit(clampLimit(a?.limit));
            if (a?.tu_khoa) q = q.ilike('name', `%${a.tu_khoa}%`);
            const { data, error } = await q;
            if (error) throw new Error(error.message);
            return data;
        },
    },
    {
        name: 'gia_mua_vat_tu',
        description: 'Lịch sử giá mua vật tư theo nhà cung cấp (đọc qua view che giá theo quyền). Dùng để so sánh giá, tìm vật tư tăng giá bất thường.',
        perms: ['view_materials', 'manage_materials_tracking', 'view_material_price'],
        input_schema: {
            type: 'object',
            properties: {
                ten_vat_tu: { type: 'string' },
                limit: { type: 'number' },
            },
        },
        run: async (a, db) => {
            let q = db.from('supplier_purchases_v')
                .select('product_name, unit, quantity, unit_price, purchase_date, suppliers(name, short_name)')
                .order('purchase_date', { ascending: false })
                .limit(clampLimit(a?.limit));
            if (a?.ten_vat_tu) q = q.ilike('product_name', `%${a.ten_vat_tu}%`);
            const { data, error } = await q;
            if (error) throw new Error(error.message);
            return data;
        },
    },
    {
        name: 'ke_hoach_dong_tien',
        description: 'Kế hoạch dòng tiền theo tháng (thu/chi kế hoạch vs thực tế). Dùng cho câu hỏi về dòng tiền tháng tới, dự báo thiếu hụt.',
        perms: ['view_cashflow_plan', 'manage_cashflow_plan', 'view_dashboard', 'view_planning'],
        input_schema: {
            type: 'object',
            properties: { nam: { type: 'number', description: 'Năm, mặc định năm hiện tại' } },
        },
        run: async (a, db) => {
            const year = Number(a?.nam) || new Date().getFullYear();
            const { data, error } = await db.from('cash_flow_plan').select('*').eq('year', year).limit(200);
            if (error) throw new Error(error.message);
            return data;
        },
    },
];

/** Lọc tool theo quyền của người dùng (admin thấy tất cả). */
export function toolsForUser(perms: string[], isAdmin: boolean): ToolDef[] {
    if (isAdmin) return TOOLS;
    return TOOLS.filter(t => t.perms.length === 0 || t.perms.some(p => perms.includes(p)));
}

/** Chuyển sang định dạng function declaration của Gemini API. */
export function toGeminiTools(tools: ToolDef[]) {
    return tools.map(t => ({
        name: t.name,
        description: t.description,
        parameters: t.input_schema,
    }));
}
