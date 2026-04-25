/**
 * exportExcel.js — Reusable Excel export utility
 * Uses dynamic import to get the real CJS module (avoids Vite ESM proxy issues)
 * Uses File System Access API to bypass download managers that strip filenames
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
    // Dynamic import to get the real CJS module object (not Vite's ESM proxy)
    const xlsxModule = await import('xlsx');
    const XLSX = xlsxModule.default || xlsxModule;
    
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
    
    const fullName = `${fileName}.xlsx`;
    const wbOut = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

    const blob = new Blob([wbOut], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    
    // Use File System Access API to bypass download managers (Cốc Cốc Savior, IDM)
    // that intercept Blob URLs and strip the filename to UUIDs
    if (window.showSaveFilePicker) {
        try {
            const fileHandle = await window.showSaveFilePicker({
                suggestedName: fullName,
                types: [{
                    description: 'Excel Spreadsheet',
                    accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
                }],
            });
            const writable = await fileHandle.createWritable();
            await writable.write(blob);
            await writable.close();
            return;
        } catch (err) {
            if (err.name === 'AbortError') return;
            console.warn('File System Access API failed, falling back:', err);
        }
    }
    
    // Fallback: traditional blob download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fullName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 200);
}

/**
 * Pre-defined column configs for common exports
 */
export const EXPORT_CONFIGS = {
    contracts: [
        { key: 'internal_code', label: 'Mã DA' },
        { key: 'code', label: 'Mã HĐ' },
        { key: 'name', label: 'Tên dự án' },
        { key: item => item.partners?.name || item.partners?.short_name || '', label: 'CĐT/ Tổng thầu' },
        { key: 'totalValuePreVat', label: 'Giá trị trước VAT', format: 'currency' },
        { key: 'vat_percentage', label: 'VAT (%)', format: 'number' },
        { key: 'totalValuePostVat', label: 'Giá trị sau VAT', format: 'currency' },
        { key: 'satecoContractRatio', label: 'TL Sateco (%)', format: 'number' },
        { key: 'totalInvoice', label: 'Tổng xuất HĐ', format: 'currency' },
        { key: 'totalRequested', label: 'Tổng đề nghị', format: 'currency' },
        { key: 'totalIncome', label: 'Tổng thực thu', format: 'currency' },
        { key: 'debtInvoice', label: 'Công nợ HĐ', format: 'currency' },
        { key: item => (item.totalRequested || 0) - (item.totalIncome || 0), label: 'Công nợ ĐN', format: 'currency' },
        { key: item => item.signature_status || 'Chưa ký', label: 'Tình trạng ký' },
        { key: item => item.settlement_status || 'Chưa quyết toán', label: 'Quyết toán' },
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
