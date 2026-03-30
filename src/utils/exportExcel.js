/**
 * exportExcel.js — Reusable Excel export utility
 * Uses dynamic import to keep xlsx out of main bundle
 */

/**
 * Export data to an Excel file (.xlsx)
 * 
 * @param {Object[]} data - Array of objects to export
 * @param {Object[]} columns - Column definitions [{key, label, format?}]
 * @param {string} fileName - File name without extension
 * @param {string} sheetName - Sheet name (default: 'Sheet1')
 */
export async function exportToExcel(data, columns, fileName = 'export', sheetName = 'Sheet1') {
    const XLSX = await import('xlsx');
    
    // Transform data using column definitions
    const rows = data.map(item => {
        const row = {};
        columns.forEach(col => {
            const value = typeof col.key === 'function' ? col.key(item) : item[col.key];
            if (col.format === 'number') {
                row[col.label] = Number(value) || 0;
            } else if (col.format === 'date') {
                row[col.label] = value ? new Date(value).toLocaleDateString('vi-VN') : '';
            } else if (col.format === 'billion') {
                row[col.label] = value ? Number((value / 1e9).toFixed(2)) : 0;
            } else if (col.format === 'currency') {
                row[col.label] = Number(value) || 0;
            } else {
                row[col.label] = value ?? '';
            }
        });
        return row;
    });
    
    const ws = XLSX.utils.json_to_sheet(rows);
    
    // Auto-width columns
    const colWidths = columns.map(col => {
        const maxLen = Math.max(
            col.label.length,
            ...rows.map(r => String(r[col.label] ?? '').length)
        );
        return { wch: Math.min(Math.max(maxLen + 2, 10), 40) };
    });
    ws['!cols'] = colWidths;
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `${fileName}.xlsx`);
}

/**
 * Pre-defined column configs for common exports
 */
export const EXPORT_CONFIGS = {
    contracts: [
        { key: 'internal_code', label: 'Mã DA' },
        { key: 'code', label: 'Mã HĐ' },
        { key: 'name', label: 'Tên dự án' },
        { key: item => item.partners?.short_name || item.partners?.name || '', label: 'Chủ đầu tư' },
        { key: 'totalValuePreVat', label: 'Giá trị trước VAT', format: 'currency' },
        { key: 'vat_percentage', label: 'VAT (%)', format: 'number' },
        { key: 'totalValuePostVat', label: 'Giá trị sau VAT', format: 'currency' },
        { key: 'totalInvoice', label: 'Tổng xuất HĐ', format: 'currency' },
        { key: 'totalRequested', label: 'Tổng đề nghị', format: 'currency' },
        { key: 'totalIncome', label: 'Tổng thực thu', format: 'currency' },
        { key: 'debtInvoice', label: 'Công nợ HĐ', format: 'currency' },
        { key: 'debtPayment', label: 'Công nợ ĐN', format: 'currency' },
        { key: 'contract_signing_status', label: 'Tình trạng ký' },
        { key: 'settlement_status', label: 'Quyết toán' },
        { key: 'status', label: 'TT thi công' },
    ],
    
    payments: [
        { key: item => item.project?.internal_code || item.project?.code || '', label: 'Mã DA' },
        { key: item => item.project?.name || '', label: 'Tên dự án' },
        { key: 'stage_name', label: 'Giai đoạn' },
        { key: 'invoice_amount', label: 'Số HĐ đã xuất', format: 'currency' },
        { key: 'request_amount', label: 'Đề nghị thanh toán', format: 'currency' },
        { key: 'approved_amount', label: 'Đã duyệt', format: 'currency' },
        { key: 'paid_amount', label: 'Đã thanh toán', format: 'currency' },
        { key: 'due_date', label: 'Hạn thanh toán', format: 'date' },
        { key: 'status', label: 'Trạng thái' },
    ],
};
