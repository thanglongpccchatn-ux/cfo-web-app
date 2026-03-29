/**
 * SATECO — Shared Financial Calculations
 * Centralizes all project-level financial computations used across Dashboard,
 * ContractMasterDetail, ContractDetailedDashboard, PaymentTracking, etc.
 * 
 * Import from here instead of re-computing in each component.
 */

/**
 * Compute all financial metrics for a single project given its payments and history.
 * 
 * @param {Object} project - The project record from Supabase
 * @param {Array} payments - Payment records for this project
 * @param {Array} extHistory - External payment history records
 * @param {Array} intHistory - Internal payment history records (expenses)
 * @returns {Object} Computed financial metrics
 */
export function computeProjectFinancials(project, payments = [], extHistory = [], intHistory = []) {
    const p = project;

    // ── Contract Value ──
    const originalValue = parseFloat(p.original_value) || 0;
    const vatPercent = p.vat_percentage ?? 8;
    const vatAmount = p.vat_amount || Math.round(originalValue * vatPercent / 100);
    const postVatValue = p.total_value_post_vat || (originalValue + vatAmount);

    // Approved variations (phát sinh đã duyệt)
    const approvedVariations = parseFloat(p.total_approved_variations) || 0;
    const totalValuePostVat = postVatValue + approvedVariations * (1 + vatPercent / 100);

    // ── Income (Thực thu) ──
    // Prefer external_payment_history if available, fallback to payments.external_income
    const incomeFromHistory = extHistory.reduce((s, h) => s + (parseFloat(h.amount) || 0), 0);
    const incomeFromPayments = payments.reduce((s, pm) => s + (parseFloat(pm.external_income) || 0), 0);
    const totalIncome = incomeFromHistory > 0 ? incomeFromHistory : incomeFromPayments;

    // ── Invoice (Xuất hóa đơn) ──
    const totalInvoice = payments.reduce((s, pm) => s + (parseFloat(pm.invoice_amount) || 0), 0);

    // ── Payment Requests (Đề nghị thanh toán) ──
    const totalRequested = payments.reduce((s, pm) => s + (parseFloat(pm.payment_request_amount) || 0), 0);

    // ── Debts (Công nợ) ──
    const debtInvoice = totalInvoice - totalIncome;       // Đã xuất HĐ - Thực thu
    const debtRequested = totalRequested - totalIncome;    // Đề nghị - Thực thu

    // ── Sateco Revenue Sharing ──
    const contractRatio = parseFloat(p.sateco_contract_ratio || 98) / 100;
    const actualRatio = parseFloat(p.sateco_actual_ratio || 95.5) / 100;
    const satecoInternalRevenue = parseFloat(p.sateco_internal_revenue) || (totalValuePostVat * contractRatio);

    // ── Expenses (Chi phí Sateco) ──
    const totalExpenses = intHistory.reduce((s, h) => s + (parseFloat(h.amount_spent) || 0), 0);

    // ── Profit (Lợi nhuận) ──
    const satecoNetIncome = totalIncome * actualRatio;
    const profit = satecoNetIncome - totalExpenses;

    // ── Recovery Rate ──
    const recoveryRate = totalValuePostVat > 0 ? (totalIncome / totalValuePostVat) * 100 : 0;

    // ── Warranty ──
    const warrantyRatio = parseFloat(p.warranty_percentage || p.warranty_ratio || 5) / 100;
    const warrantyAmount = Math.round(originalValue * warrantyRatio);

    return {
        // Contract values
        originalValue,
        vatPercent,
        vatAmount,
        postVatValue,
        approvedVariations,
        totalValuePostVat,

        // Income & Invoicing
        totalIncome,
        totalInvoice,
        totalRequested,

        // Debts
        debtInvoice,
        debtRequested,

        // Sateco
        contractRatio: contractRatio * 100,
        actualRatio: actualRatio * 100,
        satecoInternalRevenue,
        satecoNetIncome,

        // Expenses & Profit
        totalExpenses,
        profit,

        // Rates
        recoveryRate,

        // Warranty
        warrantyAmount,
    };
}

/**
 * Aggregate financials from multiple processed projects.
 * 
 * @param {Array} projects - Array of projects with computed financials
 * @returns {Object} Aggregated totals
 */
export function aggregateFinancials(projects) {
    return {
        totalValueAll: projects.reduce((s, p) => s + (p.totalValuePostVat || 0), 0),
        totalIncomeAll: projects.reduce((s, p) => s + (p.totalIncome || 0), 0),
        totalInvoiceAll: projects.reduce((s, p) => s + (p.totalInvoice || 0), 0),
        totalRequestedAll: projects.reduce((s, p) => s + (p.totalRequested || 0), 0),
        totalDebtInvoiceAll: projects.reduce((s, p) => s + (p.debtInvoice || 0), 0),
        totalDebtRequestedAll: projects.reduce((s, p) => s + Math.max(0, p.debtRequested || 0), 0),
        totalExpensesAll: projects.reduce((s, p) => s + (p.totalExpenses || 0), 0),
        totalProfitAll: projects.reduce((s, p) => s + (p.profit || 0), 0),
    };
}

/**
 * Calculate performance KPIs from processed projects.
 * Used by DashboardOverview for the performance section.
 * 
 * @param {Array} projects - Array with computed financials
 * @returns {Object} Performance averages
 */
export function calculatePerformanceKPIs(projects) {
    const withData = projects.filter(p => (p.totalValuePostVat || 0) > 0);
    const count = withData.length || 1;

    const avg_lng_dt = withData.reduce((acc, p) => {
        const netProfit = p.satecoNetIncome - (p.totalExpenses || 0);
        return acc + (p.satecoInternalRevenue > 0 ? (netProfit / p.satecoInternalRevenue) * 100 : 0);
    }, 0) / count;

    const avg_sl_cp = withData.reduce((acc, p) => {
        return acc + (p.totalInvoice > 0 ? ((p.totalInvoice - (p.totalExpenses || 0)) / p.totalInvoice) * 100 : 0);
    }, 0) / count;

    const avg_spi = withData.reduce((acc, p) => {
        const today = new Date();
        const start = new Date(p.start_date);
        const end = new Date(p.end_date);
        const total = Math.max(1, (end - start) / 86400000);
        const passed = Math.max(0, (today - start) / 86400000);
        const planned = (p.satecoInternalRevenue || 0) * Math.min(1, passed / total);
        return acc + (planned > 0 ? (p.totalInvoice / planned) : 1);
    }, 0) / count;

    const avg_dt_sl = withData.reduce((acc, p) => 
        acc + (p.totalInvoice > 0 ? (p.totalIncome / p.totalInvoice) * 100 : 0), 0) / count;

    const avg_thu_dt = withData.reduce((acc, p) => 
        acc + (p.satecoInternalRevenue > 0 ? (p.totalIncome / p.satecoInternalRevenue) * 100 : 0), 0) / count;

    const avg_thu_chi = withData.reduce((acc, p) => 
        acc + (p.totalExpenses > 0 ? (p.totalIncome / p.totalExpenses) : 0), 0) / count;

    return { avg_lng_dt, avg_sl_cp, avg_spi, avg_dt_sl, avg_thu_dt, avg_thu_chi };
}
