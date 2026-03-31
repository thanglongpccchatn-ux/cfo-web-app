/**
 * 🇻🇳 SATECO — Vietnamese Business Compliance Package
 * 
 * Inspired by VietERP's @vierp/vietnam package, adapted for SATECO CFO App.
 * Centralizes all Vietnam-specific business logic:
 * - VAT calculations (Nghị định 123)
 * - Currency formatting (VND)
 * - Invoice number generation
 * - Tax period utilities
 * - Vietnamese date formatting
 * - Contract value helpers
 * 
 * Usage:
 *   import { VN } from '../lib/vietnam';
 *   VN.tax.calculateVAT(1000000000);        // → { beforeVAT, vatAmount, afterVAT }
 *   VN.currency.toWords(1500000000);         // → "Một tỷ năm trăm triệu đồng"
 *   VN.invoice.generateNumber('TL', 47);     // → "TL0000047"
 *   VN.date.toVietnamese(new Date());        // → "31/03/2026"
 *   VN.period.getCurrentQuarter();           // → { quarter: 1, year: 2026 }
 */

// ═══════════════════════════════════════════════════════
// TAX & VAT — Theo Nghị định 123/2020/NĐ-CP
// ═══════════════════════════════════════════════════════

const VAT_RATES = {
  STANDARD: 10,     // Thuế suất thông thường (2026+)
  REDUCED: 8,       // Thuế suất giảm (Nghị quyết giảm VAT)
  EXEMPT: 0,        // Miễn thuế
  NOT_SUBJECT: -1,  // Không chịu thuế
};

/**
 * Tính VAT cho một giá trị trước thuế
 * @param {number} beforeVAT - Giá trị trước thuế
 * @param {number} [rate=10] - Thuế suất VAT (%)
 * @returns {{ beforeVAT: number, vatRate: number, vatAmount: number, afterVAT: number }}
 */
function calculateVAT(beforeVAT, rate = VAT_RATES.STANDARD) {
  const value = Number(beforeVAT) || 0;
  if (rate < 0) return { beforeVAT: value, vatRate: 0, vatAmount: 0, afterVAT: value }; // NOT_SUBJECT
  const vatAmount = Math.round(value * rate / 100);
  return {
    beforeVAT: value,
    vatRate: rate,
    vatAmount,
    afterVAT: value + vatAmount,
  };
}

/**
 * Trích xuất giá trước thuế từ giá sau thuế 
 * @param {number} afterVAT - Giá trị sau thuế
 * @param {number} [rate=10] - Thuế suất (%)
 * @returns {{ beforeVAT: number, vatAmount: number, afterVAT: number }}
 */
function extractVAT(afterVAT, rate = VAT_RATES.STANDARD) {
  const value = Number(afterVAT) || 0;
  const beforeVAT = Math.round(value / (1 + rate / 100));
  return {
    beforeVAT,
    vatRate: rate,
    vatAmount: value - beforeVAT,
    afterVAT: value,
  };
}

/**
 * Tính thuế thu nhập doanh nghiệp (CIT)
 * @param {number} taxableIncome - Thu nhập chịu thuế
 * @param {number} [rate=20] - Thuế suất CIT (%)
 * @returns {number}
 */
function calculateCIT(taxableIncome, rate = 20) {
  return Math.round((Number(taxableIncome) || 0) * rate / 100);
}

// ═══════════════════════════════════════════════════════
// CURRENCY — Định dạng tiền tệ Việt Nam
// ═══════════════════════════════════════════════════════

const VN_DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];

/**
 * Đọc số thành chữ tiếng Việt (cho hóa đơn, hợp đồng)
 * @param {number} amount - Số tiền (VND)
 * @returns {string} Số tiền bằng chữ, viết hoa chữ đầu
 */
function toWords(amount) {
  if (!amount || amount === 0) return 'Không đồng';
  
  const abs = Math.abs(Math.round(amount));
  const sign = amount < 0 ? 'Âm ' : '';
  
  if (abs >= 1e15) return `${sign}${(abs / 1e12).toFixed(0)} nghìn tỷ đồng`;

  const parts = [];
  const units = [
    { value: 1e12, label: 'nghìn tỷ' },
    { value: 1e9,  label: 'tỷ' },
    { value: 1e6,  label: 'triệu' },
    { value: 1e3,  label: 'nghìn' },
    { value: 1,    label: '' },
  ];

  let remaining = abs;
  for (const { value, label } of units) {
    if (remaining >= value) {
      const count = Math.floor(remaining / value);
      remaining = remaining % value;
      if (count > 0) {
        parts.push(`${readThreeDigits(count)} ${label}`.trim());
      }
    }
  }

  const result = sign + parts.join(' ').replace(/\s+/g, ' ').trim() + ' đồng';
  return result.charAt(0).toUpperCase() + result.slice(1);
}

function readThreeDigits(n) {
  if (n === 0) return '';
  if (n < 10) return VN_DIGITS[n];
  if (n < 100) {
    const tens = Math.floor(n / 10);
    const ones = n % 10;
    let result = VN_DIGITS[tens] + ' mươi';
    if (ones === 1 && tens > 1) result += ' mốt';
    else if (ones === 5 && tens > 0) result += ' lăm';
    else if (ones > 0) result += ' ' + VN_DIGITS[ones];
    return result;
  }
  const hundreds = Math.floor(n / 100);
  const remainder = n % 100;
  let result = VN_DIGITS[hundreds] + ' trăm';
  if (remainder === 0) return result;
  if (remainder < 10) result += ' lẻ';
  result += ' ' + readThreeDigits(remainder);
  return result;
}

/**
 * Smart format: tự chọn đơn vị phù hợp (Tỷ/Triệu/Nghìn/₫)
 * @param {number} value - Giá trị VND
 * @param {{ precision?: number, showUnit?: boolean }} options
 * @returns {string}
 */
function smartFormat(value, { precision = 1, showUnit = true } = {}) {
  const n = Number(value) || 0;
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';

  if (abs >= 1e9) {
    const formatted = (abs / 1e9).toLocaleString('vi-VN', { minimumFractionDigits: precision, maximumFractionDigits: precision });
    return sign + formatted + (showUnit ? ' Tỷ' : '');
  }
  if (abs >= 1e6) {
    const formatted = (abs / 1e6).toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    return sign + formatted + (showUnit ? ' Tr' : '');
  }
  if (abs >= 1e3) {
    return sign + Math.round(abs).toLocaleString('vi-VN') + (showUnit ? ' ₫' : '');
  }
  return sign + Math.round(abs).toString() + (showUnit ? ' ₫' : '');
}

// ═══════════════════════════════════════════════════════
// INVOICE — Hoá đơn điện tử (Nghị định 123)
// ═══════════════════════════════════════════════════════

/**
 * Tạo số hóa đơn theo format chuẩn
 * @param {string} prefix - Ký hiệu (VD: 'TL', 'ST')
 * @param {number} sequence - Số thứ tự
 * @param {number} [padLength=7] - Độ dài số (mặc định 7 chữ số)
 * @returns {string} VD: "TL0000047"
 */
function generateInvoiceNumber(prefix, sequence, padLength = 7) {
  return `${prefix}${String(sequence).padStart(padLength, '0')}`;
}

/**
 * Tạo số phiếu đề nghị thanh toán
 * @param {string} projectCode - Mã dự án
 * @param {number} stage - Đợt thanh toán
 * @returns {string} VD: "ĐNTT-DA001-Đ03"
 */
function generatePaymentRequestCode(projectCode, stage) {
  return `ĐNTT-${projectCode}-Đ${String(stage).padStart(2, '0')}`;
}

/**
 * Validate mã số thuế Việt Nam (MST: 10 hoặc 13 chữ số)
 * @param {string} taxCode - Mã số thuế
 * @returns {{ valid: boolean, type: 'company'|'branch'|'invalid' }}
 */
function validateTaxCode(taxCode) {
  if (!taxCode) return { valid: false, type: 'invalid' };
  const cleaned = taxCode.replace(/[\s-]/g, '');
  if (/^\d{10}$/.test(cleaned)) return { valid: true, type: 'company' };
  if (/^\d{10}-\d{3}$/.test(taxCode) || /^\d{13}$/.test(cleaned)) return { valid: true, type: 'branch' };
  return { valid: false, type: 'invalid' };
}

// ═══════════════════════════════════════════════════════
// DATE — Ngày tháng Việt Nam
// ═══════════════════════════════════════════════════════

/**
 * Format ngày theo chuẩn Việt Nam (dd/mm/yyyy)
 * @param {string|Date} date 
 * @returns {string}
 */
function toVietnamese(date) {
  if (!date) return '—';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '—';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

/**
 * Format ngày giờ đầy đủ
 */
function toVietnameseFull(date) {
  if (!date) return '—';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '—';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} ${toVietnamese(d)}`;
}

/**
 * Tính số ngày làm việc giữa 2 ngày (loại trừ T7, CN)
 */
function workingDaysBetween(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  let count = 0;
  const current = new Date(start);
  while (current <= end) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) count++;
    current.setDate(current.getDate() + 1);
  }
  return count;
}

/**
 * Tính số ngày quá hạn (âm nếu chưa tới hạn)
 */
function daysOverdue(dueDate) {
  if (!dueDate) return 0;
  const due = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return Math.floor((today - due) / 86400000);
}

// ═══════════════════════════════════════════════════════
// PERIOD — Kỳ kế toán / Thuế
// ═══════════════════════════════════════════════════════

function getCurrentQuarter(date = new Date()) {
  const d = new Date(date);
  return {
    quarter: Math.ceil((d.getMonth() + 1) / 3),
    year: d.getFullYear(),
  };
}

function getQuarterRange(quarter, year) {
  const startMonth = (quarter - 1) * 3;
  return {
    start: new Date(year, startMonth, 1),
    end: new Date(year, startMonth + 3, 0), // Last day of last month in quarter
  };
}

/**
 * Chi kỳ thuế GTGT (tháng/quý)
 */
function getTaxPeriodLabel(date = new Date()) {
  const d = new Date(date);
  const q = getCurrentQuarter(d);
  return `Quý ${q.quarter}/${q.year}`;
}

// ═══════════════════════════════════════════════════════
// CONTRACT — Helpers cho hợp đồng xây dựng
// ═══════════════════════════════════════════════════════

/**
 * Tính giá trị bảo lãnh thực hiện hợp đồng (thường 3-10% giá trước VAT)
 */
function calculateGuarantee(contractValue, percentage = 5) {
  return Math.round((Number(contractValue) || 0) * percentage / 100);
}

/**
 * Tính giá trị bảo hành (thường 5% giá trị hợp đồng)
 */
function calculateWarrantyRetention(contractValue, percentage = 5) {
  return Math.round((Number(contractValue) || 0) * percentage / 100);
}

/**
 * Tính tỷ lệ giải ngân / tiến độ thanh toán
 * @returns {{ disbursementRate: number, status: 'good'|'warning'|'critical' }}
 */
function calculateDisbursementStatus(totalPaid, contractValue) {
  const paid = Number(totalPaid) || 0;
  const total = Number(contractValue) || 0;
  if (total <= 0) return { disbursementRate: 0, status: 'good' };
  const rate = (paid / total) * 100;
  return {
    disbursementRate: Math.round(rate * 100) / 100,
    status: rate >= 90 ? 'good' : rate >= 70 ? 'warning' : 'critical',
  };
}

// ═══════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════

export const VN = {
  tax: {
    VAT_RATES,
    calculateVAT,
    extractVAT,
    calculateCIT,
  },
  currency: {
    toWords,
    smartFormat,
  },
  invoice: {
    generateNumber: generateInvoiceNumber,
    generatePaymentRequestCode,
    validateTaxCode,
  },
  date: {
    toVietnamese,
    toVietnameseFull,
    workingDaysBetween,
    daysOverdue,
  },
  period: {
    getCurrentQuarter,
    getQuarterRange,
    getTaxPeriodLabel,
  },
  contract: {
    calculateGuarantee,
    calculateWarrantyRetention,
    calculateDisbursementStatus,
  },
};

export default VN;
