/**
 * SATECO — Shared Formatting Utilities
 * Consolidates all number/date/currency formatting used across the app.
 * Import from here instead of re-defining in each component.
 */

/**
 * Format a number to Vietnamese locale string (e.g. 1.234.567)
 * @param {number} v - Value to format
 * @returns {string} Formatted string
 */
export const fmt = (v) => v ? Number(Math.round(v)).toLocaleString('vi-VN') : '0';

/**
 * Format a number to Vietnamese locale string, returns '—' for falsy values
 * @param {number} v - Value to format
 * @returns {string} Formatted string or '—'
 */
export const fmtDash = (v) => v ? Number(v).toLocaleString('vi-VN') : '—';

/**
 * Format a number as VND currency (same as fmt but explicit name)
 * @param {number} v - Value in VND
 * @returns {string} Formatted VND string
 */
export const formatVND = (v) => v ? Number(Math.round(v)).toLocaleString('vi-VN') : '0';

/**
 * Format a large number into "Tỷ" or "Triệu" for readability
 * @param {number} val - Value in VND
 * @returns {string} Formatted string like "48,4 Tỷ" or "500 Triệu"
 */
export const formatBillion = (val) => {
    if (!val) return '0';
    const n = Math.abs(val);
    const sign = val < 0 ? '-' : '';
    if (n >= 1e9) return sign + (n / 1e9).toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
    if (n >= 1e6) return sign + (n / 1e6).toLocaleString('vi-VN', { minimumFractionDigits: 0 }) + ' Tr';
    return fmt(val);
};

/**
 * Format a large number into { number, unit } parts for KPI display.
 * Returns: { number: "48,4", unit: "Tỷ" } or { number: "500", unit: "Tr" }
 */
export const formatBillionParts = (val) => {
    if (!val && val !== 0) return { number: '0', unit: 'Tỷ' };
    const n = Math.abs(val);
    const sign = val < 0 ? '-' : '';
    if (n >= 1e9) return { number: sign + (n / 1e9).toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 2 }), unit: 'Tỷ' };
    if (n >= 1e6) return { number: sign + (n / 1e6).toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }), unit: 'Tr' };
    if (n > 0) return { number: sign + fmt(n), unit: '₫' };
    return { number: '0', unit: 'Tỷ' };
};

/**
 * Short format: "48,4 Tỷ" or "500 Tr" — compact version of formatBillion
 * @param {number} v - Value in VND
 * @returns {string} Short formatted string
 */
export const fmtB = (v) => {
    const n = v || 0;
    if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(2)} Tỷ`;
    if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(0)} Tr`;
    return fmt(n);
};

/**
 * Format a date to Vietnamese locale (dd/mm/yyyy)
 * @param {string|Date} d - Date string or Date object
 * @returns {string} Formatted date or '—'
 */
export const fmtDate = (d) => d ? new Date(d).toLocaleDateString('vi-VN') : '—';

/**
 * Format a date to dd/MM/yyyy with zero-padded day/month
 * @param {string|Date} d - Date string or Date object
 * @returns {string} Formatted date or '—'
 */
export const fmtDatePadded = (d) => {
    if (!d) return '—';
    const dt = new Date(d);
    return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;
};

/**
 * Parse a formatted input string like "48.400.000.000" into a number
 * @param {string} str - Formatted string
 * @returns {number} Parsed number
 */
export const parseFormattedNumber = (str) => {
    if (!str) return 0;
    const cleaned = str.replace(/[.\s]/g, '').replace(/,/g, '.');
    const num = Number(cleaned);
    return isNaN(num) ? 0 : num;
};

/**
 * Format a number for input display: "48.400.000.000"
 * @param {number} num - Number to format
 * @returns {string} Formatted string
 */
export const formatInputNumber = (num) => {
    if (!num && num !== 0) return '';
    return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(Math.round(num));
};

/**
 * Round currency to avoid floating-point issues
 * @param {number} value - Value to round
 * @returns {number} Rounded to nearest integer (VND has no decimals)
 */
export const roundCurrency = (value) => Math.round(value || 0);
