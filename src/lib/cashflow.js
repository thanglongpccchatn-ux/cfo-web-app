// Kế hoạch Dòng tiền — logic gom SỐ THỰC TẾ + KẾ HOẠCH theo tháng/hạng mục/dự án.
// Hàm thuần (không gọi Supabase) để dễ test; UI nạp dữ liệu rồi truyền vào.

export const OVERHEAD = '__overhead'; // "dự án" đại diện cho chi phí chung không theo dự án

/** Danh mục thu (in)/chi (out) — kèm quyền được phép NHẬP kế hoạch (perm). */
export const CF_CATEGORIES = {
    in: [
        { key: 'project', label: 'Thu từ dự án', perm: 'edit_payments' },
        { key: 'loan', label: 'Vay vốn', perm: 'manage_loans' },
        { key: 'other_in', label: 'Thu khác', perm: 'manage_loans' },
    ],
    out: [
        { key: 'material', label: 'Vật liệu', perm: 'manage_materials_tracking' },
        { key: 'labor', label: 'Nhân công', perm: 'manage_labor' },
        { key: 'office', label: 'Chi phí chung / Văn phòng', perm: 'manage_expenses' },
        { key: 'operation', label: 'Chi phí vận hành', perm: 'manage_expenses' },
        { key: 'command', label: 'Ban chỉ huy', perm: 'manage_expenses' },
        { key: 'acceptance', label: 'Nghiệm thu / Thẩm duyệt', perm: 'manage_expenses' },
        { key: 'design', label: 'Thiết kế', perm: 'manage_expenses' },
        { key: 'machinery', label: 'Máy thi công', perm: 'manage_expenses' },
        { key: 'debt', label: 'Trả nợ vay', perm: 'manage_loans' },
        { key: 'other_out', label: 'Chi khác', perm: 'manage_expenses' },
    ],
};

export const IN_KEYS = CF_CATEGORIES.in.map(c => c.key);
export const OUT_KEYS = CF_CATEGORIES.out.map(c => c.key);
export const ALL_KEYS = [...IN_KEYS, ...OUT_KEYS];
export const CF_LABEL = Object.fromEntries([...CF_CATEGORIES.in, ...CF_CATEGORIES.out].map(c => [c.key, c.label]));
export const CF_PERM = Object.fromEntries([...CF_CATEGORIES.in, ...CF_CATEGORIES.out].map(c => [c.key, c.perm]));

// expenses.expense_type -> mã hạng mục chi
const EXPENSE_TYPE_TO_CAT = {
    'Vận hành': 'operation',
    'BCH công trường': 'command',
    'Nghiệm thu/Thẩm duyệt': 'acceptance',
    'Máy thi công': 'machinery',
    'Chi phí chung': 'office',
    'Thiết kế': 'design',
    'Khác': 'other_out',
};
const OTHER_IN_CATS = new Set(['Bán phế liệu, thanh lý', 'Lãi tiền gửi', 'Thu nhập khác', 'Khác']);

const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
const monthOf = (d, year) => {
    if (!d) return -1;
    const dt = new Date(d);
    if (dt.getFullYear() !== year) return -1;
    return dt.getMonth();
};
const zeros = () => Array(12).fill(0);

export function emptyBuckets() {
    const out = {};
    for (const k of ALL_KEYS) out[k] = zeros();
    return out;
}

/**
 * Gom THỰC TẾ theo { cat: { projKey: number[12] } } — projKey = project_id hoặc OVERHEAD.
 */
export function aggregateActualsByProject(src, { year }) {
    const {
        extHist = [], payments = [], loans = [], loanPayments = [],
        expenses = [], expLabor = [], expMaterials = [], treasury = [],
    } = src || {};
    const res = {};
    for (const k of ALL_KEYS) res[k] = {};
    const add = (cat, pid, m, val) => {
        if (m < 0 || !val) return;
        const pk = pid || OVERHEAD;
        (res[cat][pk] || (res[cat][pk] = zeros()))[m] += val;
    };
    const stageToProj = {}; for (const p of payments) stageToProj[p.id] = p.project_id;
    const loanToProj = {}; for (const l of loans) loanToProj[l.id] = l.project_id;

    for (const h of extHist) add('project', stageToProj[h.payment_stage_id], monthOf(h.payment_date, year), num(h.amount));
    for (const l of loans) add('loan', l.project_id, monthOf(l.loan_date, year), num(l.loan_amount));
    for (const t of treasury) if (t.type === 'IN' && OTHER_IN_CATS.has(t.category)) add('other_in', t.project_id, monthOf(t.transaction_date, year), num(t.amount));
    for (const e of expMaterials) add('material', e.project_id, monthOf(e.expense_date, year), num(e.paid_amount));
    for (const e of expLabor) add('labor', e.project_id, monthOf(e.payment_date || e.request_date, year), num(e.paid_amount));
    for (const e of expenses) add(EXPENSE_TYPE_TO_CAT[e.expense_type] || 'other_out', e.project_id, monthOf(e.paid_date || e.expense_date, year), num(e.paid_amount));
    for (const p of loanPayments) add('debt', loanToProj[p.loan_id], monthOf(p.payment_date, year), num(p.principal_amount) + num(p.interest_amount));

    return res;
}

/** Gộp by-project -> { cat: number[12] }, lọc theo projectId (null=tất cả, OVERHEAD, hoặc id). */
function collapse(byProj, projectId) {
    const out = emptyBuckets();
    for (const cat of ALL_KEYS) {
        for (const [pk, arr] of Object.entries(byProj[cat] || {})) {
            if (projectId != null && pk !== projectId) continue;
            for (let i = 0; i < 12; i++) out[cat][i] += arr[i] || 0;
        }
    }
    return out;
}

export function aggregateActuals(src, { year, projectId = null }) {
    return collapse(aggregateActualsByProject(src, { year }), projectId);
}

/** KẾ HOẠCH theo { cat: { projKey: number[12] } }. */
export function planByProject(planRows, { year }) {
    const res = {};
    for (const k of ALL_KEYS) res[k] = {};
    for (const r of planRows || []) {
        if (r.year !== year || !res[r.category]) continue;
        const m = (r.month | 0) - 1;
        if (m < 0 || m > 11) continue;
        const pk = r.project_id || OVERHEAD;
        (res[r.category][pk] || (res[r.category][pk] = zeros()))[m] += num(r.planned_amount);
    }
    return res;
}

export function planToBuckets(planRows, { year, projectId = null }) {
    return collapse(planByProject(planRows, { year }), projectId);
}

export const rowTotal = (arr) => (arr || []).reduce((s, v) => s + v, 0);

export function sumRows(bucketObj, keys) {
    const out = zeros();
    for (const k of keys) { const a = bucketObj[k] || []; for (let i = 0; i < 12; i++) out[i] += a[i] || 0; }
    return out;
}

export function toPeriods(monthArr, period) {
    if (period === 'year') return [rowTotal(monthArr)];
    if (period === 'quarter') return [0, 1, 2, 3].map(q => monthArr.slice(q * 3, q * 3 + 3).reduce((s, v) => s + v, 0));
    return monthArr.slice();
}

export function rollingBalance(totalIn, totalOut, opening = 0) {
    const net = zeros(), closing = zeros();
    let run = opening;
    for (let i = 0; i < 12; i++) { net[i] = (totalIn[i] || 0) - (totalOut[i] || 0); run += net[i]; closing[i] = run; }
    return { net, closing };
}
