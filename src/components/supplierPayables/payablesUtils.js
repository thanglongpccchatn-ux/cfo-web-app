/**
 * Utility functions for Supplier Payables module
 */

// Nhóm VTHH đầy đủ theo form chuẩn công ty
export const MATERIAL_GROUPS = [
  // === Điện ===
  'Cáp điện chống cháy chống nhiễu',
  'Cáp điện nhẹ',
  'Dây cáp nguồn',
  'Thiết bị điện',
  'Thiết bị báo cháy',
  'Đèn exit, sự cố',
  'Chiếu sáng',
  'Công tắc, ổ cắm',
  'Tủ điện',
  'Trạm biến áp',
  'Máy phát điện',
  'Thanh dẫn điện Busduct',
  'Camera',
  'Điện thoại nội bộ',
  'Chuông cửa có hình',
  'Thiết bị điều hòa',
  // === Ống & Phụ kiện ===
  'Ống thép mạ kẽm',
  'Ống thép đen',
  'Phụ kiện ống thép mạ kẽm',
  'Phụ kiện ống thép đen',
  'Ống luồn gân xoắn',
  'Ống luồn PVC',
  'Ống luồn thép',
  'Ống HDPE nước',
  'Ống uPVC',
  'Ống cấp nước PPR',
  'Ống gió mềm',
  'Ống đồng',
  'Ống inox',
  // === PCCC ===
  'Chữa cháy khí',
  'Chữa cháy foam',
  'Đầu phun',
  'Cửa chống cháy',
  'Chống cháy lan',
  // === Cơ khí & Hệ thống ===
  'Ống gió và phụ kiện',
  'Cửa gió, miệng gió',
  'Van gió',
  'Quạt',
  'Bơm',
  'Van các loại',
  'Bồn, bể nước',
  'Bể bơi',
  'Tiêu âm',
  'Thiết bị âm thanh',
  'Thiết bị vệ sinh',
  'Bảo ôn',
  // === Kết cấu & Phụ trợ ===
  'Thang máng cáp',
  'Giá đỡ',
  'Đặt chờ',
  'Thiết bị vách tường',
  'Chống sét',
  'Sơn',
  // === Vật tư chung ===
  'Vật tư tạm',
  'Vật tư phụ',
  'Xe nâng, giàn giáo',
  'Thiết bị đo',
  // === Dịch vụ & Chi phí ===
  'Thiết kế',
  'Nghiệm thu',
  'Thử áp, thử nghiệm',
  'Công tác đất, bê tông',
  'Vận chuyển',
  'Tháo dỡ',
  'Lắp đặt (Không cấp vật tư)',
  'Chi phí tạm tính',
  'Quản lý',
  // === Khác ===
  'Khác',
];

export const PAYMENT_METHODS = [
  'Chuyển khoản',
  'Tiền mặt',
  'Bù trừ công nợ',
  'Khác',
];

export const formatCurrency = (value) => {
  if (value == null || isNaN(value)) return '0';
  return Math.round(Number(value)).toLocaleString('vi-VN'); // làm tròn đồng, không hiện số lẻ
};

/**
 * Display project label: prioritize internal_code (mã tự đặt) over code/name
 * "ISV", "SUNRISE 2", "INTCO-9HA" instead of "CÔNG TY TNHH..."
 */
export const projectLabel = (p) => {
  if (!p) return '—';
  if (p.internal_code) return p.internal_code;
  if (p.code) return p.code;
  const name = p.name || '';
  return name.length > 40 ? name.slice(0, 37) + '...' : name;
};

/**
 * Display project option in dropdown: internal_code + short name
 */
export const projectOption = (p) => {
  if (!p) return '';
  const label = p.internal_code || p.code || '';
  if (label && p.name) return `${label} — ${p.name.length > 50 ? p.name.slice(0, 47) + '...' : p.name}`;
  if (label) return label;
  return p.name || '';
};

export const parseCurrency = (str) => {
  if (!str) return 0;
  return Number(String(str).replace(/[^0-9.-]/g, '')) || 0;
};

/**
 * Đọc % VAT từ ô Excel: giữ đúng 0 / 8 / 10; ô TRỐNG mới mặc định 8
 * (không ép về 10 như trước — total_amount là generated column theo vat_rate).
 */
export const parseVatRate = (raw) => {
  if (raw === '' || raw === null || raw === undefined) return 8;
  const n = Number(String(raw).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 8;
};

/** Ngày HÔM NAY theo lịch ĐỊA PHƯƠNG (yyyy-mm-dd) — tránh lệch -1 ngày do toISOString() ở UTC+7. */
export const todayStr = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/**
 * Calculate summary stats from purchases and payments data
 */
export function calcPayablesSummary(purchases = [], payments = []) {
  const totalPurchased = purchases.reduce((s, p) => s + Number(p.total_amount || 0), 0);
  const totalPaid = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const balanceDue = totalPurchased - totalPaid;
  const paidPercent = totalPurchased > 0 ? (totalPaid / totalPurchased) * 100 : 0;

  return { totalPurchased, totalPaid, balanceDue, paidPercent };
}

/**
 * Group purchases by supplier, then by material_group
 */
export function groupBySupplier(purchases = [], payments = []) {
  const map = {};

  purchases.forEach(p => {
    const sid = p.supplier_id || '_unknown';
    if (!map[sid]) {
      map[sid] = {
        supplier_id: sid,
        supplier_name: p.partners?.name || p.supplier_name || 'Không rõ',
        supplier_code: p.partners?.code || '',
        groups: {},
        totalPurchased: 0,
        totalPaid: 0,
      };
    }
    const grp = p.material_group || 'Khác';
    if (!map[sid].groups[grp]) {
      map[sid].groups[grp] = { purchases: [], payments: [], totalPurchased: 0, totalPaid: 0 };
    }
    map[sid].groups[grp].purchases.push(p);
    map[sid].groups[grp].totalPurchased += Number(p.total_amount || 0);
    map[sid].totalPurchased += Number(p.total_amount || 0);
  });

  payments.forEach(p => {
    const sid = p.supplier_id || '_unknown';
    if (!map[sid]) {
      map[sid] = {
        supplier_id: sid,
        supplier_name: p.partners?.name || p.supplier_name || 'Không rõ',
        supplier_code: p.partners?.code || '',
        groups: {},
        totalPurchased: 0,
        totalPaid: 0,
      };
    }
    const grp = p.material_group || 'Khác';
    if (!map[sid].groups[grp]) {
      map[sid].groups[grp] = { purchases: [], payments: [], totalPurchased: 0, totalPaid: 0 };
    }
    map[sid].groups[grp].payments.push(p);
    map[sid].groups[grp].totalPaid += Number(p.amount || 0);
    map[sid].totalPaid += Number(p.amount || 0);
  });

  return Object.values(map).sort((a, b) => b.totalPurchased - a.totalPurchased);
}

/** Khoá gom "1 đơn hàng": cùng NCC + dự án + ngày + số hóa đơn. */
export function orderKeyOf(p) {
  return `${p.supplier_id || ''}|${p.project_id || ''}|${p.purchase_date || ''}|${p.reference_no || ''}`;
}

/**
 * Gom mua hàng theo TỪNG ĐƠN + tính đã trả/còn nợ theo đơn.
 * Khoản trả khớp đơn qua supplier_payments.purchase_ref = orderKeyOf(đơn).
 */
export function groupByOrder(purchases = [], payments = []) {
  const map = {};
  for (const p of purchases) {
    const k = orderKeyOf(p);
    if (!map[k]) {
      map[k] = {
        key: k, supplier_id: p.supplier_id,
        supplier_name: p.partners?.name || 'Không rõ', supplier_code: p.partners?.code || '',
        project_id: p.project_id, projects: p.projects,
        purchase_date: p.purchase_date, reference_no: p.reference_no || '',
        total: 0, paid: 0, lineCount: 0,
      };
    }
    map[k].total += Number(p.total_amount || 0);
    map[k].lineCount += 1;
  }
  for (const pay of payments) {
    if (pay.purchase_ref && map[pay.purchase_ref]) map[pay.purchase_ref].paid += Number(pay.amount || 0);
  }
  return Object.values(map)
    .map(o => ({ ...o, remaining: o.total - o.paid }))
    .sort((a, b) => new Date(b.purchase_date) - new Date(a.purchase_date));
}

// ─────────────────────────────────────────
// Excel Import Parser (v2 — 2 sheet format)
// ─────────────────────────────────────────

/**
 * Smart date parser: handles multiple formats
 * - Excel serial number (e.g., 45747)
 * - dd/mm/yyyy, dd-mm-yyyy
 * - yyyy-mm-dd (ISO)
 * - A Date object
 */
function smartParseDate(val) {
  const pad = (n) => String(n).padStart(2, '0');
  // Dùng thành phần ngày CỤC BỘ, KHÔNG dùng toISOString (lệch -1 ngày ở UTC+7).
  const fmtLocal = (dt) => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
  const fmtUTC = (dt) => `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;

  if (!val) return fmtLocal(new Date());

  // Date object (SheetJS cellDates = nửa đêm giờ địa phương) -> lấy ngày cục bộ
  if (val instanceof Date && !isNaN(val)) {
    return fmtLocal(val);
  }

  const str = String(val).trim();

  // Excel serial number (30000..60000) -> nửa đêm UTC -> lấy ngày UTC
  const num = Number(str);
  if (!isNaN(num) && num > 30000 && num < 60000) {
    return fmtUTC(new Date(Math.round((num - 25569) * 86400000)));
  }

  // dd/mm/yyyy or dd-mm-yyyy
  const dmyMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // yyyy-mm-dd (ISO)
  const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // Fallback: native parse -> lấy ngày cục bộ
  const parsed = new Date(str);
  if (!isNaN(parsed)) return fmtLocal(parsed);

  return fmtLocal(new Date());
}

/**
 * Find column value with flexible header matching
 * Tries exact key first, then falls back to alias search
 */
function getCol(row, ...aliases) {
  for (const key of aliases) {
    if (row[key] !== undefined && row[key] !== '') return row[key];
  }
  // Case-insensitive partial match
  const keys = Object.keys(row);
  for (const alias of aliases) {
    const lower = alias.toLowerCase();
    const found = keys.find(k => k.toLowerCase().includes(lower));
    if (found && row[found] !== undefined && row[found] !== '') return row[found];
  }
  return '';
}

/**
 * Parse Excel rows from NEW format (2-sheet) or LEGACY format (single sheet)
 * New format: wb with "Mua hàng" + "Thanh toán" sheets
 * Legacy format: single sheet with NGÀY/THÁNG/NĂM columns
 */
export function parseExcelWorkbook(wb) {
  const sheetNames = wb.SheetNames.map(s => s.trim().toLowerCase());
  const XLSX_UTILS = window.__XLSX_UTILS; // set by caller

  // Detect format by sheet names
  const hasPurchaseSheet = sheetNames.some(s => s.includes('mua') || s.includes('purchase'));
  const hasPaymentSheet = sheetNames.some(s => s.includes('thanh toán') || s.includes('payment'));

  if (hasPurchaseSheet || hasPaymentSheet) {
    return parseNewFormat(wb);
  }
  // Fallback: legacy single-sheet
  return parseLegacyFormat(wb);
}

/**
 * New format: 2 separate sheets
 */
function parseNewFormat(wb) {
  const purchases = [];
  const payments = [];

  // Find purchase sheet
  const purchaseSheetName = wb.SheetNames.find(s => {
    const l = s.toLowerCase();
    return l.includes('mua') || l.includes('purchase');
  });
  if (purchaseSheetName) {
    const ws = wb.Sheets[purchaseSheetName];
    const rows = window.__XLSX_UTILS.sheet_to_json(ws, { defval: '', raw: false });
    rows.forEach((row, idx) => {
      const productName = String(getCol(row, 'SẢN PHẨM', 'TÊN SẢN PHẨM', 'product_name')).trim();
      if (!productName) return;

      purchases.push({
        _row: idx + 2,
        material_group: String(getCol(row, 'NHÓM VT', 'NHÓM VTHI', 'material_group') || 'Khác').trim(),
        purchase_date: smartParseDate(getCol(row, 'NGÀY', 'NGÀY MUA', 'date')),
        supplier_name: String(getCol(row, 'NCC', 'NHÀ CUNG CẤP', 'TÊN NHÀ CUNG CẤP', 'supplier_name')).trim(),
        product_name: productName,
        unit: String(getCol(row, 'DVT', 'ĐVT', 'unit') || 'cái').trim(),
        quantity: parseCurrency(getCol(row, 'SỐ LƯỢNG', 'KHỐI LƯỢNG', 'SL', 'quantity')),
        unit_price: parseCurrency(getCol(row, 'ĐƠN GIÁ', 'GIÁ', 'unit_price')),
        vat_rate: parseVatRate(getCol(row, 'VAT(%)', 'VAT', 'THUẾ VAT', 'vat_rate')),
        notes: String(getCol(row, 'GHI CHÚ', 'notes') || '').trim(),
        project_name: String(getCol(row, 'CÔNG TRÌNH', 'DỰ ÁN', 'project_name') || '').trim(),
      });
    });
  }

  // Find payment sheet
  const paymentSheetName = wb.SheetNames.find(s => {
    const l = s.toLowerCase();
    return l.includes('thanh toán') || l.includes('payment');
  });
  if (paymentSheetName) {
    const ws = wb.Sheets[paymentSheetName];
    const rows = window.__XLSX_UTILS.sheet_to_json(ws, { defval: '', raw: false });
    rows.forEach((row, idx) => {
      const amount = parseCurrency(getCol(row, 'SỐ TIỀN', 'THANH TOÁN', 'amount'));
      if (!amount) return;

      payments.push({
        _row: idx + 2,
        material_group: String(getCol(row, 'NHÓM VT', 'NHÓM VTHI', 'material_group') || '').trim(),
        payment_date: smartParseDate(getCol(row, 'NGÀY', 'NGÀY TT', 'NGÀY THANH TOÁN', 'date')),
        supplier_name: String(getCol(row, 'NCC', 'NHÀ CUNG CẤP', 'TÊN NHÀ CUNG CẤP', 'supplier_name')).trim(),
        amount,
        payment_method: String(getCol(row, 'HÌNH THỨC', 'PT THANH TOÁN', 'method') || 'Chuyển khoản').trim(),
        reference_no: String(getCol(row, 'SỐ CT', 'SỐ CHỨNG TỪ', 'CHỨNG TỪ', 'reference') || '').trim(),
        notes: String(getCol(row, 'GHI CHÚ', 'notes') || '').trim(),
        project_name: String(getCol(row, 'CÔNG TRÌNH', 'DỰ ÁN', 'project_name') || '').trim(),
      });
    });
  }

  return { purchases, payments };
}

/**
 * Legacy format: single sheet with NGÀY/THÁNG/NĂM columns, keyword-based detection
 */
function parseLegacyFormat(wb) {
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = window.__XLSX_UTILS.sheet_to_json(ws, { defval: '', raw: false });
  const purchases = [];
  const payments = [];

  rows.forEach((row, idx) => {
    const productName = String(row['TÊN SẢN PHẨM'] || row['SẢN PHẨM'] || row['product_name'] || '').trim();

    // Legacy: detect payment by keyword or THANH TOÁN column
    const paymentAmount = parseCurrency(row['THANH TOÁN'] || row['payment_amount']);
    const isPayment = productName.toLowerCase().includes('thanh toán') || (!productName && paymentAmount > 0);

    // Legacy date: NGÀY/THÁNG/NĂM separate columns OR single NGÀY column
    let dateStr;
    if (row['THÁNG'] || row['NĂM']) {
      const d = Number(row['NGÀY'] || row['day']) || 1;
      const m = Number(row['THÁNG'] || row['month']) || new Date().getMonth() + 1;
      const y = Number(row['NĂM'] || row['year']) || new Date().getFullYear();
      dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    } else {
      dateStr = smartParseDate(row['NGÀY'] || row['date']);
    }

    if (isPayment) {
      payments.push({
        _row: idx + 2,
        material_group: String(row['NHÓM VTHI'] || row['NHÓM VT'] || 'Khác').trim(),
        payment_date: dateStr,
        supplier_name: String(row['TÊN NHÀ CUNG CẤP'] || row['NCC'] || '').trim(),
        amount: paymentAmount,
        payment_method: 'Chuyển khoản',
        reference_no: '',
        notes: String(row['GHI CHÚ'] || '').trim(),
        project_name: String(row['CÔNG TRÌNH'] || '').trim(),
      });
    } else if (productName) {
      purchases.push({
        _row: idx + 2,
        material_group: String(row['NHÓM VTHI'] || row['NHÓM VT'] || 'Khác').trim(),
        purchase_date: dateStr,
        supplier_name: String(row['TÊN NHÀ CUNG CẤP'] || row['NCC'] || '').trim(),
        product_name: productName,
        unit: String(row['DVT'] || 'cái').trim(),
        quantity: parseCurrency(row['KHỐI LƯỢNG'] || row['SỐ LƯỢNG']),
        unit_price: parseCurrency(row['ĐƠN GIÁ']),
        vat_rate: parseVatRate(row['VAT(%)'] ?? row['THUẾ VAT'] ?? row['VAT']),
        notes: String(row['GHI CHÚ'] || '').trim(),
        project_name: String(row['CÔNG TRÌNH'] || '').trim(),
      });
    }
  });

  return { purchases, payments };
}

// Keep backward compat — old parseExcelRows still works for legacy callers
export function parseExcelRows(rows) {
  // Old-style: receives raw rows from sheet_to_json
  // Re-implement inline for backward compatibility
  const purchases = [];
  const payments = [];

  rows.forEach((row, idx) => {
    const productName = String(row['TÊN SẢN PHẨM'] || row['SẢN PHẨM'] || '').trim();
    const paymentAmount = parseCurrency(row['THANH TOÁN'] || '');
    const isPayment = productName.toLowerCase().includes('thanh toán') || (!productName && paymentAmount > 0);

    let dateStr;
    if (row['THÁNG'] || row['NĂM']) {
      const d = Number(row['NGÀY']) || 1;
      const m = Number(row['THÁNG']) || new Date().getMonth() + 1;
      const y = Number(row['NĂM']) || new Date().getFullYear();
      dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    } else {
      dateStr = smartParseDate(row['NGÀY']);
    }

    if (isPayment) {
      payments.push({
        _row: idx + 2,
        material_group: String(row['NHÓM VTHI'] || row['NHÓM VT'] || 'Khác').trim(),
        payment_date: dateStr,
        supplier_name: String(row['TÊN NHÀ CUNG CẤP'] || '').trim(),
        amount: paymentAmount,
        payment_method: 'Chuyển khoản',
        reference_no: '',
        notes: String(row['GHI CHÚ'] || '').trim(),
        project_name: String(row['CÔNG TRÌNH'] || '').trim(),
      });
    } else if (productName) {
      purchases.push({
        _row: idx + 2,
        material_group: String(row['NHÓM VTHI'] || row['NHÓM VT'] || 'Khác').trim(),
        purchase_date: dateStr,
        supplier_name: String(row['TÊN NHÀ CUNG CẤP'] || '').trim(),
        product_name: productName,
        unit: String(row['DVT'] || 'cái').trim(),
        quantity: parseCurrency(row['KHỐI LƯỢNG'] || row['SỐ LƯỢNG']),
        unit_price: parseCurrency(row['ĐƠN GIÁ']),
        vat_rate: parseVatRate(row['VAT(%)'] ?? row['THUẾ VAT'] ?? row['VAT']),
        notes: String(row['GHI CHÚ'] || '').trim(),
        project_name: String(row['CÔNG TRÌNH'] || '').trim(),
      });
    }
  });

  return { purchases, payments };
}
