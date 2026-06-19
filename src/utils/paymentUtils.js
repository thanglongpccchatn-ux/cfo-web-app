/**
 * Shared payment utility functions
 * Used by: PaymentTracking, PaymentsMaster, PaymentReceiptsModule
 */

export function getPaymentStatus(stage, lastExternalPaymentDate) {
    const income = Number(stage.external_income || 0);
    const request = Number(stage.payment_request_amount || 0);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const dueDate = stage.due_date ? new Date(stage.due_date) : null;
    const isFullyPaid = request > 0 && income >= request;

    if (isFullyPaid) {
        if (dueDate && lastExternalPaymentDate) {
            const lastPaid = new Date(lastExternalPaymentDate);
            if (lastPaid > dueDate) return { key: 'late', label: 'Trả đủ (muộn)', color: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500', ring: 'border-orange-200' };
        }
        return { key: 'done', label: 'CĐT trả đủ', color: 'bg-green-100 text-green-700', dot: 'bg-green-500', ring: 'border-green-200' };
    }
    if (dueDate && today > dueDate) return { key: 'overdue', label: 'Quá hạn thu', color: 'bg-rose-100 text-rose-700', dot: 'bg-rose-500 animate-pulse', ring: 'border-rose-200' };
    if (income > 0) return { key: 'partial', label: 'Đang thu CĐT', color: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-500', ring: 'border-yellow-200' };
    return { key: 'pending', label: 'Chưa thu', color: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400', ring: 'border-slate-200' };
}

export function daysDiff(dateStr) {
    if (!dateStr) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return Math.round((today - new Date(dateStr)) / 86400000);
}

export function parseNum(str) {
    if (!str) return 0;
    return Number(String(str).replace(/\./g, '').replace(/,/g, ''));
}

export const STAGE_TYPES = ['Tạm ứng', 'Nghiệm thu', 'Quyết toán', 'Bảo hành', 'Phát sinh'];
