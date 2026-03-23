/**
 * Financial Calculation Utilities
 * Các hàm tính toán tài chính cốt lõi được tách riêng để test và tái sử dụng.
 */

/**
 * Tính giá trị sau VAT
 * @param {number} preVatValue - Giá trị trước VAT
 * @param {number} vatPercentage - % VAT (mặc định 8%)
 * @param {number|null} customVatAmount - Giá trị VAT tùy chỉnh (ưu tiên hơn %)
 * @returns {{ vatAmount: number, postVatValue: number }}
 */
export function calculateVAT(preVatValue, vatPercentage = 8, customVatAmount = null) {
    const value = parseFloat(preVatValue) || 0;
    const vatAmt = customVatAmount != null ? parseFloat(customVatAmount) : value * (vatPercentage / 100);
    return {
        vatAmount: vatAmt,
        postVatValue: value + vatAmt,
    };
}

/**
 * Tính doanh thu nội bộ Sateco
 * @param {number} postVatValue - Giá trị HĐ sau VAT
 * @param {number} contractRatio - Tỷ lệ khoán (%, mặc định 98%)
 * @param {number|null} customRevenue - Doanh thu tùy chỉnh (ưu tiên hơn tính toán)
 * @returns {number}
 */
export function calculateSatecoRevenue(postVatValue, contractRatio = 98, customRevenue = null) {
    if (customRevenue != null && parseFloat(customRevenue) > 0) {
        return parseFloat(customRevenue);
    }
    return (parseFloat(postVatValue) || 0) * (parseFloat(contractRatio) / 100);
}

/**
 * Tính lợi nhuận gộp Sateco
 * @param {number} totalIncome - Tổng thực thu
 * @param {number} actualRatio - Tỷ lệ thực tế Sateco (%, mặc định 95.5%)
 * @param {number} totalExpenses - Tổng chi phí nội bộ
 * @returns {number}
 */
export function calculateGrossProfit(totalIncome, actualRatio = 95.5, totalExpenses = 0) {
    const income = parseFloat(totalIncome) || 0;
    const expenses = parseFloat(totalExpenses) || 0;
    return (income * (parseFloat(actualRatio) / 100)) - expenses;
}

/**
 * Tính công nợ hóa đơn
 * @param {number} totalInvoice - Tổng đã xuất HĐ
 * @param {number} totalIncome - Tổng thực thu
 * @returns {number}
 */
export function calculateInvoiceDebt(totalInvoice, totalIncome) {
    return (parseFloat(totalInvoice) || 0) - (parseFloat(totalIncome) || 0);
}

/**
 * Tính tỷ lệ thu hồi dòng tiền
 * @param {number} totalIncome - Tổng thực thu
 * @param {number} totalContractValue - Tổng giá trị HĐ
 * @returns {number} Phần trăm (0-100)
 */
export function calculateRecoveryRate(totalIncome, totalContractValue) {
    const value = parseFloat(totalContractValue) || 0;
    if (value <= 0) return 0;
    return ((parseFloat(totalIncome) || 0) / value) * 100;
}

/**
 * Tính chỉ số SPI (Schedule Performance Index)
 * @param {string} startDate - Ngày bắt đầu dự án
 * @param {string} endDate - Ngày kết thúc dự kiến
 * @param {number} totalInvoice - Tổng sản lượng thực tế
 * @param {number} plannedRevenue - Doanh thu dự kiến
 * @param {Date} today - Ngày hiện tại (cho phép inject để test)
 * @returns {number} SPI (1.0 = đúng tiến độ)
 */
export function calculateSPI(startDate, endDate, totalInvoice, plannedRevenue, today = new Date()) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const totalDays = Math.max(1, (end - start) / 86400000);
    const passedDays = Math.max(0, (today - start) / 86400000);
    const planned = (parseFloat(plannedRevenue) || 0) * Math.min(1, passedDays / totalDays);
    if (planned <= 0) return 1;
    return (parseFloat(totalInvoice) || 0) / planned;
}

/**
 * Tính cân đối thu/chi (Safety Ratio)
 * @param {number} totalIncome - Tổng thu
 * @param {number} totalExpenses - Tổng chi
 * @returns {number} Hệ số (>1 = an toàn, <1 = rủi ro)
 */
export function calculateSafetyRatio(totalIncome, totalExpenses) {
    const expenses = parseFloat(totalExpenses) || 0;
    if (expenses <= 0) return 0;
    return (parseFloat(totalIncome) || 0) / expenses;
}

/**
 * Format số thành đơn vị Tỷ VNĐ
 * @param {number} value - Giá trị (đồng)
 * @returns {string}
 */
export function formatBillion(value) {
    if (!value) return '0';
    return (value / 1000000000).toLocaleString('vi-VN', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 2,
    });
}

/**
 * Format số thành VNĐ
 * @param {number} value
 * @returns {string}
 */
export function formatVND(value) {
    return value ? Number(Math.round(value)).toLocaleString('vi-VN') : '0';
}
