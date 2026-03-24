export const STANDARD_STAGES = ['Tạm ứng', 'IPC01', 'IPC02', 'IPC03', 'IPC04', 'IPC05', 'Quyết toán', 'Bảo hành', 'Phát sinh'];

export function getDocStatus(stage) {
    const income = Number(stage.external_income || 0);
    const request = Number(stage.payment_request_amount || 0);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const dueDate = stage.due_date ? new Date(stage.due_date) : null;
    const isFullyPaid = request > 0 && income >= (request - 100); // Tolerance for rounding

    if (isFullyPaid) {
        return { label: 'Đã trả đủ', color: 'text-emerald-600 bg-emerald-50', icon: 'check_circle', isFullyPaid: true };
    }
    if (dueDate && today > dueDate) {
        const diff = Math.round((today - dueDate) / 86400000);
        return { label: `Quá hạn (${diff} ngày)`, color: 'text-rose-600 bg-rose-50', icon: 'error_outline', overdue: true, subLabel: `Hạn: ${dueDate.toLocaleDateString('vi-VN')}` };
    }
    if (income > 0) return { label: 'Chưa trả đủ', color: 'text-amber-600 bg-amber-50', icon: 'pending' };
    return { label: 'Chưa trả', color: 'text-slate-400 bg-slate-50', icon: 'schedule' };
}

// Numeric helper: parse "1.000.000" -> 1000000
export const parseNum = (str) => {
    if (!str) return 0;
    return Number(String(str).replace(/\./g, '').replace(/,/g, ''));
};

// Numeric helper: format 1000000 -> "1.000.000"
export const formatInput = (val) => {
    if (val === '' || val === null || val === undefined) return '';
    // If it's already a string with dots, just return it or parse then format
    const num = parseNum(val);
    return num.toLocaleString('vi-VN');
};

export const fmt = (v) => v ? Number(v).toLocaleString('vi-VN') : '0';
export const fmtDate = (d) => d ? new Date(d).toLocaleDateString('vi-VN') : '—';
