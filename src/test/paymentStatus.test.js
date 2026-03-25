import { describe, it, expect } from 'vitest';

// Sao chép hàm getPaymentStatus từ PaymentTracking.jsx để test độc lập
function getPaymentStatus(stage, lastExternalPaymentDate) {
    const income = Number(stage.external_income || 0);
    const request = Number(stage.payment_request_amount || 0);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const dueDate = stage.due_date ? new Date(stage.due_date) : null;
    const isFullyPaid = request > 0 && income >= request;

    if (isFullyPaid) {
        if (dueDate && lastExternalPaymentDate) {
            const lastPaid = new Date(lastExternalPaymentDate);
            if (lastPaid > dueDate) return { key: 'late', label: 'CĐT trả muộn', color: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500', ring: 'border-orange-200' };
        }
        return { key: 'done', label: 'CĐT trả đủ', color: 'bg-green-100 text-green-700', dot: 'bg-green-500', ring: 'border-green-200' };
    }
    if (dueDate && today > dueDate) return { key: 'overdue', label: 'Quá hạn thu', color: 'bg-rose-100 text-rose-700', dot: 'bg-rose-500 animate-pulse', ring: 'border-rose-200' };
    if (income > 0) return { key: 'partial', label: 'Đang thu CĐT', color: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-500', ring: 'border-yellow-200' };
    return { key: 'pending', label: 'Chưa thu', color: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400', ring: 'border-slate-200' };
}

describe('getPaymentStatus', () => {
    it('trả về "done" khi đã thanh toán đủ', () => {
        const stage = { external_income: 100_000_000, payment_request_amount: 100_000_000 };
        const result = getPaymentStatus(stage, null);
        expect(result.key).toBe('done');
        expect(result.label).toBe('CĐT trả đủ');
    });

    it('trả về "late" khi thanh toán đủ nhưng trễ hạn', () => {
        const stage = { 
            external_income: 100_000_000, 
            payment_request_amount: 100_000_000, 
            due_date: '2025-01-15' 
        };
        const result = getPaymentStatus(stage, '2025-02-01');
        expect(result.key).toBe('late');
        expect(result.label).toBe('CĐT trả muộn');
    });

    it('trả về "done" khi thanh toán đủ trước hạn', () => {
        const stage = { 
            external_income: 100_000_000, 
            payment_request_amount: 100_000_000, 
            due_date: '2025-03-15' 
        };
        const result = getPaymentStatus(stage, '2025-03-01');
        expect(result.key).toBe('done');
    });

    it('trả về "overdue" khi quá hạn chưa thu đủ', () => {
        const stage = { 
            external_income: 50_000_000, 
            payment_request_amount: 100_000_000, 
            due_date: '2024-01-01'  // ngày quá khứ
        };
        const result = getPaymentStatus(stage, null);
        expect(result.key).toBe('overdue');
        expect(result.label).toBe('Quá hạn thu');
    });

    it('trả về "partial" khi đang thu (có income > 0, chưa đủ, chưa quá hạn)', () => {
        const stage = { 
            external_income: 50_000_000, 
            payment_request_amount: 100_000_000,
            due_date: '2030-12-31'  // ngày tương lai
        };
        const result = getPaymentStatus(stage, null);
        expect(result.key).toBe('partial');
        expect(result.label).toBe('Đang thu CĐT');
    });

    it('trả về "pending" khi chưa thu gì', () => {
        const stage = { 
            external_income: 0, 
            payment_request_amount: 100_000_000 
        };
        const result = getPaymentStatus(stage, null);
        expect(result.key).toBe('pending');
        expect(result.label).toBe('Chưa thu');
    });

    it('trả về "pending" khi cả income và request đều bằng 0', () => {
        const stage = { external_income: 0, payment_request_amount: 0 };
        const result = getPaymentStatus(stage, null);
        expect(result.key).toBe('pending');
    });

    it('trả về "done" khi income vượt request', () => {
        const stage = { external_income: 150_000_000, payment_request_amount: 100_000_000 };
        const result = getPaymentStatus(stage, null);
        expect(result.key).toBe('done');
    });
});
