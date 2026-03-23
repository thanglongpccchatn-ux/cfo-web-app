import { describe, it, expect } from 'vitest';
import {
    calculateVAT,
    calculateSatecoRevenue,
    calculateGrossProfit,
    calculateInvoiceDebt,
    calculateRecoveryRate,
    calculateSPI,
    calculateSafetyRatio,
    formatBillion,
    formatVND,
} from '../lib/financials';

// ============================================================================
// Unit Tests cho Logic Tài chính Cốt lõi
// Bao phủ tất cả các hàm tính toán trong hệ thống CFO Dashboard
// ============================================================================

describe('calculateVAT', () => {
    it('tính VAT 8% mặc định', () => {
        const result = calculateVAT(1000000000); // 1 tỷ
        expect(result.vatAmount).toBe(80000000); // 80 triệu
        expect(result.postVatValue).toBe(1080000000); // 1.08 tỷ
    });

    it('tính VAT với tỷ lệ tùy chỉnh 10%', () => {
        const result = calculateVAT(1000000000, 10);
        expect(result.vatAmount).toBe(100000000);
        expect(result.postVatValue).toBe(1100000000);
    });

    it('ưu tiên customVatAmount khi được cung cấp', () => {
        const result = calculateVAT(1000000000, 8, 50000000);
        expect(result.vatAmount).toBe(50000000);
        expect(result.postVatValue).toBe(1050000000);
    });

    it('trả 0 khi giá trị đầu vào rỗng', () => {
        const result = calculateVAT(null);
        expect(result.vatAmount).toBe(0);
        expect(result.postVatValue).toBe(0);
    });

    it('xử lý string input (từ database)', () => {
        const result = calculateVAT('500000000', 8);
        expect(result.postVatValue).toBe(540000000);
    });

    it('VAT 0% (miễn thuế)', () => {
        const result = calculateVAT(1000000000, 0);
        expect(result.vatAmount).toBe(0);
        expect(result.postVatValue).toBe(1000000000);
    });
});

describe('calculateSatecoRevenue', () => {
    it('tính doanh thu với tỷ lệ mặc định 98%', () => {
        const result = calculateSatecoRevenue(1080000000);
        expect(result).toBe(1058400000); // 1.08 tỷ * 98%
    });

    it('tỷ lệ tùy chỉnh', () => {
        const result = calculateSatecoRevenue(1000000000, 95);
        expect(result).toBe(950000000);
    });

    it('ưu tiên customRevenue khi > 0', () => {
        const result = calculateSatecoRevenue(1000000000, 98, 800000000);
        expect(result).toBe(800000000);
    });

    it('bỏ qua customRevenue khi = 0', () => {
        const result = calculateSatecoRevenue(1000000000, 98, 0);
        expect(result).toBe(980000000);
    });

    it('trả 0 khi giá trị rỗng', () => {
        expect(calculateSatecoRevenue(null)).toBe(0);
    });
});

describe('calculateGrossProfit', () => {
    it('lợi nhuận gộp dương (có lãi)', () => {
        // Thu 1 tỷ, tỷ lệ 95.5%, chi 500 triệu
        const result = calculateGrossProfit(1000000000, 95.5, 500000000);
        expect(result).toBe(455000000); // 955tr - 500tr = 455tr
    });

    it('lợi nhuận gộp âm (lỗ)', () => {
        const result = calculateGrossProfit(100000000, 95.5, 200000000);
        expect(result).toBe(-104500000); // 95.5tr - 200tr = -104.5tr
    });

    it('không có chi phí', () => {
        const result = calculateGrossProfit(1000000000, 95.5, 0);
        expect(result).toBe(955000000);
    });

    it('trả 0 khi không có thu nhập', () => {
        expect(calculateGrossProfit(0, 95.5, 100000000)).toBe(-100000000);
    });
});

describe('calculateInvoiceDebt', () => {
    it('công nợ dương (chưa thu hết)', () => {
        expect(calculateInvoiceDebt(500000000, 300000000)).toBe(200000000);
    });

    it('công nợ bằng 0 (thu đủ)', () => {
        expect(calculateInvoiceDebt(500000000, 500000000)).toBe(0);
    });

    it('công nợ âm (thu vượt)', () => {
        expect(calculateInvoiceDebt(300000000, 500000000)).toBe(-200000000);
    });

    it('xử lý giá trị null', () => {
        expect(calculateInvoiceDebt(null, null)).toBe(0);
    });
});

describe('calculateRecoveryRate', () => {
    it('tỷ lệ thu hồi 50%', () => {
        expect(calculateRecoveryRate(500000000, 1000000000)).toBe(50);
    });

    it('tỷ lệ 100% (thu đủ)', () => {
        expect(calculateRecoveryRate(1000000000, 1000000000)).toBe(100);
    });

    it('trả 0 khi tổng giá trị HĐ = 0', () => {
        expect(calculateRecoveryRate(500000000, 0)).toBe(0);
    });

    it('trả 0 khi chưa thu được gì', () => {
        expect(calculateRecoveryRate(0, 1000000000)).toBe(0);
    });
});

describe('calculateSPI', () => {
    it('SPI = 1.0 khi đúng tiến độ', () => {
        const start = '2026-01-01';
        const end = '2026-12-31';
        const midYear = new Date('2026-07-01');
        // Giả sử 50% thời gian đã qua, sản lượng = 50% doanh thu
        const planned = 1000000000;
        const actual = planned * (181/365); // ~50%
        const spi = calculateSPI(start, end, actual, planned, midYear);
        expect(spi).toBeCloseTo(1.0, 1);
    });

    it('SPI > 1 khi vượt tiến độ', () => {
        const start = '2026-01-01';
        const end = '2026-12-31';
        const midYear = new Date('2026-07-01');
        const spi = calculateSPI(start, end, 800000000, 1000000000, midYear);
        expect(spi).toBeGreaterThan(1);
    });

    it('SPI < 1 khi chậm tiến độ', () => {
        const start = '2026-01-01';
        const end = '2026-12-31';
        const midYear = new Date('2026-07-01');
        const spi = calculateSPI(start, end, 100000000, 1000000000, midYear);
        expect(spi).toBeLessThan(1);
    });

    it('trả 1 khi dự án chưa bắt đầu', () => {
        const future = new Date('2025-01-01');
        expect(calculateSPI('2026-01-01', '2026-12-31', 0, 1000000000, future)).toBe(1);
    });
});

describe('calculateSafetyRatio', () => {
    it('hệ số > 1 (an toàn)', () => {
        expect(calculateSafetyRatio(2000000000, 1000000000)).toBe(2);
    });

    it('hệ số < 1 (rủi ro)', () => {
        expect(calculateSafetyRatio(500000000, 1000000000)).toBe(0.5);
    });

    it('hệ số = 0 khi không có chi phí', () => {
        expect(calculateSafetyRatio(1000000000, 0)).toBe(0);
    });
});

describe('formatBillion', () => {
    it('format 1 tỷ', () => {
        expect(formatBillion(1000000000)).toBe('1,0');
    });

    it('format < 1 tỷ', () => {
        const result = formatBillion(500000000);
        expect(result).toBe('0,5');
    });

    it('format giá trị null/0', () => {
        expect(formatBillion(0)).toBe('0');
        expect(formatBillion(null)).toBe('0');
    });
});

describe('formatVND', () => {
    it('format số bình thường', () => {
        expect(formatVND(1500000)).toBe('1.500.000');
    });

    it('format số 0', () => {
        expect(formatVND(0)).toBe('0');
    });

    it('format null', () => {
        expect(formatVND(null)).toBe('0');
    });
});
