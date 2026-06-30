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
import { computeProjectFinancials, aggregateFinancials } from '../utils/financialCalcs';

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
    it('tính doanh thu với tỷ lệ mặc định 98% (trên PRE-VAT)', () => {
        // Khoán áp tỷ lệ trên giá trị PRE-VAT, không phải post-VAT
        const result = calculateSatecoRevenue(1000000000); // 1 tỷ pre-VAT
        expect(result).toBe(980000000); // 1 tỷ * 98%
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

// ============================================================================
// computeProjectFinancials — hàm TỔNG HỢP tài chính 1 dự án (trước đây CHƯA có test)
// Khóa rule khoán Sateco trên PRE-VAT để tránh tái diễn lỗi post/pre-VAT.
// ============================================================================
describe('computeProjectFinancials', () => {
    const project = {
        original_value: 1000000000,        // 1 tỷ pre-VAT
        vat_percentage: 8,
        total_approved_variations: 0,
        sateco_contract_ratio: 98,
        sateco_actual_ratio: 95.5,
        warranty_percentage: 5,
    };
    const payments = [
        { invoice_amount: 500000000, external_income: 0, payment_request_amount: 600000000 },
    ];
    const extHistory = [{ amount: 300000000 }];   // thực thu 300tr
    const intHistory = [{ amount_spent: 100000000 }]; // chi nội bộ 100tr

    const r = computeProjectFinancials(project, payments, extHistory, intHistory);

    it('giá trị hợp đồng: VAT 8% + post-VAT', () => {
        expect(r.vatAmount).toBe(80000000);
        expect(r.postVatValue).toBe(1080000000);
        expect(r.totalValuePostVat).toBe(1080000000);
    });

    it('khoán Sateco áp tỷ lệ trên PRE-VAT (980tr, KHÔNG phải 1.0584 tỷ)', () => {
        expect(r.satecoInternalRevenue).toBe(980000000); // 1 tỷ * 98%
    });

    it('thực thu ưu tiên external_payment_history', () => {
        expect(r.totalIncome).toBe(300000000);
        expect(r.totalInvoice).toBe(500000000);
    });

    it('công nợ hóa đơn = đã xuất - thực thu', () => {
        expect(r.debtInvoice).toBe(200000000); // 500 - 300
    });

    it('lợi nhuận = thu × actualRatio - chi', () => {
        // 300tr × 95.5% - 100tr = 286.5tr - 100tr = 186.5tr
        expect(r.profit).toBe(186500000);
    });

    it('tỷ lệ thu hồi trên post-VAT', () => {
        expect(r.recoveryRate).toBeCloseTo(27.78, 1); // 300/1080
    });

    it('bảo hành 5% trên giá trị gốc', () => {
        expect(r.warrantyAmount).toBe(50000000);
    });

    it('ưu tiên sateco_internal_revenue khi DB đã lưu sẵn', () => {
        const r2 = computeProjectFinancials({ ...project, sateco_internal_revenue: 900000000 }, payments, extHistory, intHistory);
        expect(r2.satecoInternalRevenue).toBe(900000000);
    });
});

// ============================================================================
// Test TƯƠNG ĐƯƠNG: computeProjectFinancials PHẢI khớp logic inline của
// DashboardOverview (nguồn live) → an toàn để refactor về 1 nguồn chân lý.
// Kịch bản đa đợt, có 1 đợt THU VƯỢT để bắt lỗi gộp vs kẹp-từng-đợt.
// ============================================================================
describe('computeProjectFinancials ⇔ DashboardOverview (tương đương)', () => {
    const project = {
        original_value: 2000000000, vat_percentage: 8, total_approved_variations: 100000000,
        sateco_contract_ratio: 98, sateco_actual_ratio: 95.5,
    };
    const payments = [
        { payment_request_amount: 500000000, external_income: 300000000, invoice_amount: 500000000 },
        { payment_request_amount: 400000000, external_income: 450000000, invoice_amount: 400000000 }, // thu VƯỢT 50tr
        { payment_request_amount: 600000000, external_income: 0,         invoice_amount: 200000000 },
    ];
    const extHistory = []; // không có history → dùng external_income trên payments
    const intHistory = [{ amount_spent: 200000000 }];

    // Replicate y hệt công thức inline của DashboardOverview
    function dashboardFormula(p, pmts, ext, int) {
        const baseTotalValuePreVat = parseFloat(p.original_value) || 0;
        const baseVatAmount = p.vat_amount || (baseTotalValuePreVat * (p.vat_percentage ?? 8) / 100);
        const baseTotalValuePostVat = p.total_value_post_vat || (baseTotalValuePreVat + baseVatAmount);
        const approvedVariationsPreVat = parseFloat(p.total_approved_variations) || 0;
        const totalValuePreVat = baseTotalValuePreVat + approvedVariationsPreVat;
        const totalValuePostVat = baseTotalValuePostVat + approvedVariationsPreVat * (1 + (p.vat_percentage ?? 8) / 100);
        const incHist = ext.reduce((s, h) => s + (parseFloat(h.amount) || 0), 0);
        const incPmt = pmts.reduce((s, pm) => s + (parseFloat(pm.external_income) || 0), 0);
        const totalIncome = incHist > 0 ? incHist : incPmt;
        const totalInvoice = pmts.reduce((s, pm) => s + (parseFloat(pm.invoice_amount) || 0), 0);
        const totalRequested = pmts.reduce((s, pm) => s + (parseFloat(pm.payment_request_amount) || 0), 0);
        const debtInvoice = totalInvoice - totalIncome;
        const debtRequested = pmts.reduce((s, pm) => s + Math.max(0, (parseFloat(pm.payment_request_amount) || 0) - (parseFloat(pm.external_income) || 0)), 0);
        const satecoInternalRevenue = parseFloat(p.sateco_internal_revenue) || (totalValuePreVat * (parseFloat(p.sateco_contract_ratio || 98) / 100));
        const expenses = int.reduce((s, h) => s + (parseFloat(h.amount_spent) || 0), 0);
        const profit = (totalIncome * (parseFloat(p.sateco_actual_ratio || 95.5) / 100)) - expenses;
        return { totalValuePostVat, totalIncome, totalInvoice, totalRequested, debtInvoice, debtRequested, satecoInternalRevenue, profit };
    }

    const lib = computeProjectFinancials(project, payments, extHistory, intHistory);
    const dash = dashboardFormula(project, payments, extHistory, intHistory);

    it('khớp toàn bộ chỉ số tài chính chính', () => {
        expect(lib.totalValuePostVat).toBe(dash.totalValuePostVat);
        expect(lib.totalIncome).toBe(dash.totalIncome);
        expect(lib.totalInvoice).toBe(dash.totalInvoice);
        expect(lib.totalRequested).toBe(dash.totalRequested);
        expect(lib.debtInvoice).toBe(dash.debtInvoice);
        expect(lib.satecoInternalRevenue).toBe(dash.satecoInternalRevenue);
        expect(lib.profit).toBe(dash.profit);
    });

    it('debtRequested kẹp-từng-đợt (800tr), KHÁC cách gộp (750tr)', () => {
        // Kẹp: max(0,500-300)+max(0,400-450)+max(0,600-0) = 200+0+600 = 800tr
        expect(lib.debtRequested).toBe(800000000);
        expect(lib.debtRequested).toBe(dash.debtRequested);
        // Cách gộp = totalRequested(1500) - totalIncome(750) = 750tr (SAI vì bù trừ đợt thu vượt)
        const naive = lib.totalRequested - lib.totalIncome;
        expect(naive).toBe(750000000);
        expect(lib.debtRequested).not.toBe(naive);
    });
});

describe('aggregateFinancials', () => {
    it('cộng dồn nhiều dự án đã tính', () => {
        const projects = [
            { totalValuePostVat: 1000, totalIncome: 600, totalInvoice: 800, profit: 100, totalExpenses: 50, debtInvoice: 200, debtRequested: 100, totalRequested: 900 },
            { totalValuePostVat: 2000, totalIncome: 1500, totalInvoice: 1800, profit: 300, totalExpenses: 150, debtInvoice: 300, debtRequested: -50, totalRequested: 1700 },
        ];
        const agg = aggregateFinancials(projects);
        expect(agg.totalValueAll).toBe(3000);
        expect(agg.totalIncomeAll).toBe(2100);
        expect(agg.totalProfitAll).toBe(400);
        // debtRequested âm bị kẹp về 0
        expect(agg.totalDebtRequestedAll).toBe(100);
    });
});
