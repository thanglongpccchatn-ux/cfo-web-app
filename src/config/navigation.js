/**
 * Cấu hình điều hướng DÙNG CHUNG cho Sidebar và Command Palette.
 * Tách ra đây để 1 nguồn chân lý — thêm/sửa route chỉ ở 1 nơi.
 * `icon` dùng tên Material Symbol (Icon component tự map sang lucide).
 */

export const NAV_GROUPS = [
    {
        key: 'overview', label: 'Tổng quan', icon: 'space_dashboard',
        items: [
            { id: 'dashboard', icon: 'grid_view', label: 'Tổng quan', perms: ['view_dashboard'] },
            { id: 'financial-analytics', icon: 'monitoring', label: 'Phân tích TC', perms: ['view_dashboard'] },
            { id: 'chat', icon: 'chat', label: 'Tin nhắn', perms: ['*'] },
            { id: 'planning_hub', icon: 'analytics', label: 'Kế hoạch & Báo cáo', perms: ['view_planning', 'manage_planning'] },
        ],
    },
    {
        key: 'bidding_group', label: 'Báo giá & Đấu thầu', icon: 'assignment_turned_in',
        items: [
            { id: 'bidding', icon: 'receipt_long', label: 'Quản lý Đấu thầu', perms: ['view_bids'] },
        ],
    },
    {
        key: 'contracts', label: 'Hợp đồng & Dự án', icon: 'work',
        items: [
            { id: 'contracts', icon: 'description', label: 'Hợp đồng', perms: ['view_contracts', 'create_contracts', 'edit_contracts', 'delete_contracts'] },
            { id: 'variations', icon: 'playlist_add', label: 'Phát sinh', perms: ['view_variations', 'manage_variations'] },
            { id: 'warranty_tracking', icon: 'security', label: 'Bảo hành', perms: ['view_warranty', 'manage_warranty'] },
            { id: 'settlement', icon: 'gavel', label: 'Quyết Toán', perms: ['view_settlement', 'manage_settlement'] },
            { id: 'doc_tracking', icon: 'folder_managed', label: 'Hồ sơ & Thanh toán', perms: ['view_payments', 'create_payments', 'edit_payments', 'delete_payments'] },
            { id: 'payment_receipts', icon: 'receipt_long', label: 'Lịch sử thu tiền', perms: ['view_payments'] },
        ],
    },
    {
        key: 'finance', label: 'Tài chính', icon: 'account_balance',
        items: [
            { id: 'cashflow_plan', icon: 'savings', label: 'Kế hoạch Dòng tiền', perms: ['view_cashflow_plan', 'manage_cashflow_plan'] },
            { id: 'weekly_expense_plan', icon: 'view_week', label: 'Kế hoạch Chi Tuần', perms: ['view_expenses', 'view_planning'] },
            { id: 'expense_tracking', icon: 'receipt_long', label: 'Chi phí Chung', perms: ['view_expenses', 'manage_expenses'] },
            { id: 'loans', icon: 'account_balance_wallet', label: 'Vay vốn', perms: ['view_loans', 'manage_loans'] },
            { id: 'treasury', icon: 'monetization_on', label: 'Sổ Quỹ Tổng', perms: ['manage_treasury'] },
        ],
    },
    {
        key: 'accounting', label: 'Kế Toán', icon: 'calculate',
        items: [
            { id: 'accounting/coa', icon: 'account_tree', label: 'Hệ thống TK', perms: ['view_accounting', 'manage_accounting'] },
            { id: 'accounting/journals', icon: 'receipt_long', label: 'Bút toán', perms: ['view_accounting', 'create_journal'] },
            { id: 'accounting/ledger', icon: 'menu_book', label: 'Sổ Cái', perms: ['view_accounting'] },
            { id: 'accounting/reports', icon: 'assessment', label: 'Báo cáo TC', perms: ['view_accounting'] },
            { id: 'accounting/einvoices', icon: 'receipt', label: 'HĐĐT & Thuế', perms: ['view_accounting'] },
            { id: 'accounting/budgets', icon: 'account_balance_wallet', label: 'Ngân sách', perms: ['view_accounting'] },
            { id: 'accounting/recurring', icon: 'repeat', label: 'Định kỳ', perms: ['view_accounting'] },
            { id: 'accounting/periods', icon: 'calendar_month', label: 'Kỳ kế toán', perms: ['view_accounting', 'manage_fiscal_periods'] },
        ],
    },
    {
        // Khu NHÂN CÔNG riêng (bố cục giống khu Vật tư): danh mục tổ đội/thầu phụ +
        // hợp đồng thầu phụ + sổ thanh toán nhân công + công nợ 2 tầng.
        key: 'labor_group', label: 'Nhân công & Thầu phụ', icon: 'engineering',
        items: [
            { id: 'labor_partners', icon: 'groups', label: 'Tổ đội & Thầu phụ', perms: ['view_labor', 'manage_labor', 'view_subcontractors', 'manage_partners'] },
            { id: 'subcontractor_contracts', icon: 'description', label: 'Hợp đồng Thầu phụ', perms: ['view_subcontractors', 'manage_subcontractors', 'manage_labor'] },
            { id: 'labor_tracking', icon: 'list_alt', label: 'Sổ Thanh toán NC', perms: ['view_labor', 'manage_labor', 'approve_labor', 'pay_labor'] },
            { id: 'subcontractor_debt', icon: 'account_balance', label: 'Công nợ Thầu phụ', perms: ['view_labor', 'view_subcontractors', 'manage_labor'] },
        ],
    },
    {
        key: 'operations', label: 'Vận hành', icon: 'construction',
        items: [
            { id: 'task_management', icon: 'task_alt', label: 'Quản lý Công việc', perms: ['*'] },
            { id: 'site_diary', icon: 'edit_calendar', label: 'Nhật ký thi công', perms: ['view_construction', 'manage_construction'] },
            { id: 'construction', icon: 'build', label: 'Thi công', perms: ['view_construction', 'manage_construction'] },
        ],
    },
    {
        // Khu VẬT TƯ riêng cho bộ phận vật tư: danh mục NCC + danh mục vật tư + mua hàng + kho.
        // Gate chung bằng view_materials (chỉ người được phân quyền vật tư mới vào); admin luôn thấy.
        key: 'materials_group', label: 'Vật tư', icon: 'inventory_2',
        items: [
            { id: 'material_plan', icon: 'savings', label: 'Kế hoạch Vật liệu', perms: ['manage_materials_tracking'] },
            { id: 'suppliers', icon: 'local_shipping', label: 'Nhà cung cấp', perms: ['view_materials', 'view_suppliers', 'manage_partners'] },
            { id: 'materials', icon: 'category', label: 'Danh mục Vật tư', perms: ['view_materials', 'manage_materials', 'edit_materials_master'] },
            { id: 'supplier_payables', icon: 'request_quote', label: 'Mua hàng & Công nợ NCC', perms: ['view_materials', 'manage_materials_tracking', 'view_suppliers'] },
            { id: 'inventory', icon: 'warehouse', label: 'Kho vật tư', perms: ['view_materials', 'import_inventory', 'export_inventory', 'manage_materials'] },
        ],
    },
];

export const SYSTEM_TABS = [
    { id: 'partners', icon: 'handshake', label: 'Danh mục Dự án / Khác', perms: ['manage_users'] },
    { id: 'settings', icon: 'settings', label: 'Cài đặt', perms: ['manage_users', 'manage_settings'] },
    { id: 'permissions', icon: 'admin_panel_settings', label: 'Phân quyền', perms: ['manage_users'] },
    { id: 'users', icon: 'person', label: 'Người dùng', perms: ['manage_users'] },
    { id: 'audit_trail', icon: 'history', label: 'Nhật ký hệ thống', perms: ['manage_users'] },
    { id: 'guide', icon: 'help_center', label: 'Hướng dẫn', perms: ['*'] },
];

/** Gộp phẳng toàn bộ điểm đến điều hướng (cho Command Palette). */
export function flattenNav() {
    const out = [];
    for (const g of NAV_GROUPS) {
        for (const it of g.items) out.push({ ...it, group: g.label });
    }
    for (const it of SYSTEM_TABS) out.push({ ...it, group: 'Hệ Thống' });
    return out;
}
