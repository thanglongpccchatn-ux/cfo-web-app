/**
 * Contract Form Helpers
 * Các hàm tiện ích và hằng số dùng chung cho ContractCreate.jsx
 */

// ── Format Functions ─────────────────────────────────────

/** Format a number to "1.500.000.000 ₫" */
export const formatPrice = (val) => {
    if (!val && val !== 0) return '0 ₫';
    return val.toLocaleString('vi-VN') + ' ₫';
};

/** Parse a formatted string like "48.400.000.000" into a number */
export const parseFormattedNumber = (str) => {
    if (!str) return 0;
    const cleaned = str.replace(/[.\s]/g, '').replace(/,/g, '.');
    const num = Number(cleaned);
    return isNaN(num) ? 0 : num;
};

/** Format a number to "48.400.000.000" */
export const formatInputNumber = (num) => {
    if (!num && num !== 0) return '';
    return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(Math.round(num));
};

/** Short format for table display */
export const fmt = (val) => {
    if (!val && val !== 0) return '0';
    return new Intl.NumberFormat('vi-VN').format(Math.round(val));
};

/** Format to Tỷ/Triệu display */
export const formatBillion = (val) => {
    if (!val) return '0 ₫';
    if (val >= 1000000000) return (val / 1000000000).toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) + ' Tỷ';
    if (val >= 1000000) return (val / 1000000).toLocaleString('vi-VN', { minimumFractionDigits: 1 }) + ' Triệu';
    return val.toLocaleString('vi-VN') + ' ₫';
};

// ── Shared Input Classes ─────────────────────────────────

export const inputBase = "w-full rounded-xl border border-slate-200 bg-white/80 p-3.5 text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm";
export const labelBase = "block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2";

// ── Navigation Items ─────────────────────────────────────

export const navItems = [
    { id: 'general', label: 'Thông tin pháp lý', icon: 'gavel', color: 'text-blue-600', bg: 'bg-blue-50' },
    { id: 'partner', label: 'Đối tác & Pháp nhân', icon: 'corporate_fare', color: 'text-orange-600', bg: 'bg-orange-50' },
    { id: 'value', label: 'Giá trị & Thời gian', icon: 'payments', color: 'text-green-600', bg: 'bg-green-50' },
    { id: 'milestone', label: 'Lộ trình thanh toán', icon: 'route', color: 'text-teal-600', bg: 'bg-teal-50' },
    { id: 'sateco', label: 'Phân bổ nội bộ', icon: 'account_balance', color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { id: 'warranty', label: 'Bảo hành', icon: 'verified_user', color: 'text-amber-600', bg: 'bg-amber-50' },
    { id: 'banking', label: 'Ngân hàng thụ hưởng', icon: 'account_balance_wallet', color: 'text-rose-600', bg: 'bg-rose-50' },
];

// ── Company Entities ─────────────────────────────────────

export const companyEntities = [
    { key: 'thanglong', name: 'THĂNG LONG', color: 'blue', desc: 'Công ty mẹ / PCCC' },
    { key: 'thanhphat', name: 'THÀNH PHÁT', color: 'amber', desc: 'Vật tư / Thi công' },
    { key: 'sateco', name: 'SATECO', color: 'emerald', desc: 'Thi công / Khoán nội bộ' }
];

// ── Default Partner Form ─────────────────────────────────

export const defaultPartnerForm = {
    name: '', tax_code: '', address: '', phone: '', email: '',
    representative: '', representative_title: '', bank_name: '', bank_account: '',
    partner_type: 'Chủ đầu tư'
};

// ── Default Milestone ────────────────────────────────────

export const createDefaultMilestone = () => ({
    id: 'ms-' + Date.now(),
    name: 'Tạm ứng',
    percentage: 20,
    amount: 0,
    condition: 'Sau khi ký hợp đồng',
    has_guarantee: true,
    due_days: 7
});

// ── Calculation Helpers ──────────────────────────────────

/**
 * Calculate all Sateco allocation values
 * @param {number} totalValue - Pre-VAT contract value
 * @param {number} vat - VAT percentage (Client)
 * @param {number} internalVat - Internal VAT percentage (Sateco)
 * @param {number} contractRatio - Sateco contract ratio %
 * @param {number} internalDeduction - Internal deduction %
 * @returns {Object} All calculated values
 */
export const calculateAllocations = (totalValue, vat, internalVat, contractRatio, internalDeduction) => {
    const actualRatio = contractRatio - internalDeduction;
    
    // Thăng Long (100%)
    const tl_preVat = Math.round(totalValue);
    const tl_vatAmount = Math.round(totalValue * (vat / 100));
    const tl_postVat = tl_preVat + tl_vatAmount;
    
    // Sateco HĐ (contractRatio%)
    const st_invoice_preVat = Math.round(totalValue * (contractRatio / 100));
    const st_invoice_vat = Math.round(st_invoice_preVat * (internalVat / 100));
    const st_invoice_postVat = st_invoice_preVat + st_invoice_vat;
    
    // Sateco Thực nhận (actualRatio%)
    const st_actual_preVat = Math.round(totalValue * (actualRatio / 100));
    const st_actual_vat = Math.round(st_actual_preVat * (internalVat / 100));
    const st_actual_postVat = st_actual_preVat + st_actual_vat;
    
    // TL giữ lại
    const tl_cutPercent = 100 - contractRatio;
    const tl_cutAmount = tl_preVat - st_invoice_preVat;
    
    // Chiết khấu nội bộ
    const internalCutAmount = st_invoice_preVat - st_actual_preVat;
    
    // Bảo hành (calculated separately)
    
    return {
        actualRatio,
        tl_preVat, tl_vatAmount, tl_postVat,
        st_invoice_preVat, st_invoice_vat, st_invoice_postVat,
        st_actual_preVat, st_actual_vat, st_actual_postVat,
        tl_cutPercent, tl_cutAmount,
        internalCutAmount,
    };
};
