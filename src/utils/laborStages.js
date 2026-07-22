/**
 * GIAI ĐOẠN THANH TOÁN NHÂN CÔNG — nối thẳng vào 4 mốc tỷ lệ của hợp đồng thầu phụ.
 *
 * Trước đây đề nghị có 10 lựa chọn tự do (Nghiệm thu lần 1..5, Bảo lãnh...) trong khi
 * hợp đồng chỉ định nghĩa 4 mốc tỷ lệ (pct_rough / pct_install / pct_acceptance /
 * pct_settlement) => không map được nên KHÔNG tự tính được trần thanh toán.
 * Bộ giá trị dưới đây khớp 1-1 với các mốc đó.
 *
 * `pctField` = null nghĩa là giai đoạn KHÔNG bị khống chế bởi tỷ lệ hợp đồng
 * (tạm ứng theo thỏa thuận riêng; công nhật/phát sinh tính theo khối lượng thực tế).
 */
export const LABOR_STAGES = [
    { value: 'Tạm ứng',      label: 'Tạm ứng',            pctField: null,             hint: 'Theo thỏa thuận hợp đồng' },
    { value: 'Phần thô',     label: 'Phần thô',           pctField: 'pct_rough',      hint: 'Hoàn thành phần thô' },
    { value: 'Lắp đặt xong', label: 'Hoàn thành lắp đặt', pctField: 'pct_install',    hint: 'Lắp đặt hoàn tất' },
    { value: 'Nghiệm thu',   label: 'Nghiệm thu',         pctField: 'pct_acceptance', hint: 'Đã nghiệm thu' },
    { value: 'Quyết toán',   label: 'Quyết toán',         pctField: 'pct_settlement', hint: 'Quyết toán, giữ lại bảo hành' },
    { value: 'Công nhật',    label: '🔨 Công nhật',       pctField: null,             hint: 'Tính theo số công thực tế' },
    { value: 'Phát sinh',    label: '📌 Phát sinh',       pctField: null,             hint: 'Khối lượng ngoài hợp đồng' },
];

/**
 * Map giai đoạn CŨ (dữ liệu đã nhập trước đây) sang mốc mới, để phiếu cũ vẫn tính được trần.
 * Quy ước: nghiệm thu lần 1 ~ phần thô, lần 2 ~ lắp đặt xong, lần 3 trở đi ~ nghiệm thu.
 */
const LEGACY_MAP = {
    'nghiệm thu lần 1': 'Phần thô',
    'nghiệm thu lần 2': 'Lắp đặt xong',
    'nghiệm thu lần 3': 'Nghiệm thu',
    'nghiệm thu lần 4': 'Nghiệm thu',
    'nghiệm thu lần 5': 'Nghiệm thu',
    'bảo lãnh': 'Quyết toán',
};

/** Chuẩn hóa tên giai đoạn (kể cả dữ liệu cũ) về một trong LABOR_STAGES. */
export function normalizeStage(stage) {
    if (!stage) return null;
    const s = String(stage).trim();
    if (LABOR_STAGES.some(x => x.value === s)) return s;
    return LEGACY_MAP[s.toLowerCase()] || null;
}

/** Lấy định nghĩa mốc theo tên giai đoạn. */
export function stageDef(stage) {
    const norm = normalizeStage(stage);
    return LABOR_STAGES.find(x => x.value === norm) || null;
}

/**
 * Trần LŨY KẾ được phép thanh toán đến giai đoạn này.
 * @param {string} stage tên giai đoạn
 * @param {object} ctx dòng từ view v_subcontractor_contract_debt (có gt_hop_dong + pct_*)
 * @returns {{ pct:number, tran:number }|null} null = giai đoạn không bị khống chế theo tỷ lệ
 */
export function stageCap(stage, ctx) {
    const def = stageDef(stage);
    if (!def?.pctField || !ctx) return null;
    const pct = Number(ctx[def.pctField]) || 0;
    if (pct <= 0) return null;                 // hợp đồng không khai mốc này
    const gt = Number(ctx.gt_hop_dong) || 0;
    return { pct, tran: Math.round(gt * pct / 100) };
}
