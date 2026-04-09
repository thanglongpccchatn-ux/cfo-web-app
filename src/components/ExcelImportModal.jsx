import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';

// Generic Excel template downloader - generates file client-side with correct filename
export const downloadExcelTemplate = async (templateHeaders, filename, sampleRows = []) => {
    const wb = XLSX.utils.book_new();
    const wsData = [templateHeaders, ...sampleRows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Column widths based on header length
    ws['!cols'] = templateHeaders.map(h => ({ wch: Math.max(h.length + 4, 16) }));

    // Freeze the header row
    ws['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activeCell: 'A2', sqref: 'A2' };

    XLSX.utils.book_append_sheet(wb, ws, 'Dữ liệu');
    
    const finalFilename = filename || 'file_mau.xlsx';
    
    // Generate an ArrayBuffer from the workbook
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    // Approach 1: Try the modern File System Access API first.
    // This bypasses any download managers (like Cốc Cốc Savior or IDM) that intercept
    // Blob URLs and strip the filename, resulting in UUID filenames.
    if (window.showSaveFilePicker) {
        try {
            const fileHandle = await window.showSaveFilePicker({
                suggestedName: finalFilename,
                types: [{
                    description: 'Excel Spreadsheet',
                    accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
                }],
            });
            const writable = await fileHandle.createWritable();
            await writable.write(blob);
            await writable.close();
            return; // Success!
        } catch (err) {
            // User might have cancelled the prompt (AbortError), or there's a permission issue.
            // If they cancelled, we don't want to show the fallback download.
            if (err.name === 'AbortError') return;
            console.warn("File System Access API failed, falling back to anchor tag:", err);
        }
    }

    // Approach 2: Fallback to the traditional Blob URL + Anchor tag method
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = finalFilename; // The 'download' attribute sets the filename
    document.body.appendChild(a);
    a.click();
    
    setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }, 100);
};
export default function ExcelImportModal({ 
  isOpen, 
  onClose, 
  title = "Import Dữ Liệu", 
  tableName, 
  columnMapping,
  templateFilename,   // e.g. "mau_vat_tu.xlsx"
  templateSampleRows, // Array of arrays - sample data rows
  fixedData = {},
  onSuccess,
  customImportHandler,  // Optional: async (rows, headers, columnMapping) => count — overrides default insert
}) {
  const [file, setFile] = useState(null);
  const [previewData, setPreviewData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const templateHeaders = Object.values(columnMapping);

  const handleDownloadTemplate = () => {
    downloadExcelTemplate(
      templateHeaders,
      templateFilename || `mau_${tableName}.xlsx`,
      templateSampleRows || []
    );
  };

  const handleFileUpload = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    
    setFile(selectedFile);
    setError(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        
        if (data.length < 2) {
          setError("File không có dữ liệu hoặc sai định dạng.");
          return;
        }

        const cols = data[0];
        setHeaders(cols);
        const expectedHeaders = Object.keys(columnMapping);
        const rows = data.slice(1).filter(row => row.some(cell => cell !== ''));

        const formattedData = rows.map(row => {
          let rowObj = {};
          expectedHeaders.forEach(dbCol => {
            const expectedHeaderName = columnMapping[dbCol];
            const normalize = (str) => typeof str === 'string' ? str.toLowerCase().trim() : '';
            const expectedNorm = normalize(expectedHeaderName);
            
            let colIndex = cols.findIndex(h => normalize(h) === expectedNorm);
            
            // Fuzzy match fallback - CRM/Partners
            if (colIndex === -1 && dbCol === 'name') colIndex = cols.findIndex(h => normalize(h).includes('tên nhà cung cấp') || normalize(h).includes('tên khách hàng') || normalize(h).includes('tên đối tác') || normalize(h).includes('tên ncc'));
            if (colIndex === -1 && dbCol === 'short_name') colIndex = cols.findIndex(h => normalize(h).includes('tên viết tắt'));
            if (colIndex === -1 && dbCol === 'tax_code') colIndex = cols.findIndex(h => normalize(h).includes('mã số thuế') || normalize(h) === 'mst');
            if (colIndex === -1 && dbCol === 'representative') colIndex = cols.findIndex(h => normalize(h).includes('người liên hệ') || normalize(h).includes('liên hệ'));
            if (colIndex === -1 && dbCol === 'bank_account') colIndex = cols.findIndex(h => normalize(h) === 'số tài khoản' || normalize(h) === 'stk' || normalize(h).includes('số tk'));
            if (colIndex === -1 && dbCol === 'bank_name') colIndex = cols.findIndex(h => normalize(h) === 'ngân hàng' || normalize(h).includes('tên ngân hàng'));

            // Fuzzy match fallback - Materials
            if (colIndex === -1 && dbCol === 'base_price') colIndex = cols.findIndex(h => normalize(h).includes('đơn giá') || normalize(h).includes('giá niêm yết') || normalize(h).includes('giá gốc'));
            if (colIndex === -1 && dbCol === 'discount_percentage') colIndex = cols.findIndex(h => normalize(h).includes('chiết khấu'));
            if (colIndex === -1 && dbCol === 'weight_per_unit') colIndex = cols.findIndex(h => normalize(h).includes('trọng lượng') || normalize(h).includes('khối lượng'));
            if (colIndex === -1 && dbCol === 'min_inventory') colIndex = cols.findIndex(h => normalize(h).includes('tồn tối thiểu') || normalize(h).includes('tồn kho'));
            if (colIndex === -1 && dbCol === 'import_unit') colIndex = cols.findIndex(h => normalize(h).includes('đvt nhập') || normalize(h).includes('đơn vị nhập'));
            if (colIndex === -1 && dbCol === 'export_unit') colIndex = cols.findIndex(h => normalize(h).includes('đvt xuất') || normalize(h).includes('đơn vị xuất'));

            // Map the found data to the EXPECTED header name so the UI table renders it correctly under "Tên Đối tác" 
            let finalValue = colIndex !== -1 && row[colIndex] !== undefined ? row[colIndex] : '';
            if (finalValue === '' || (typeof finalValue === 'string' && finalValue.trim() === '')) finalValue = '';
            rowObj[expectedHeaderName] = finalValue;
          });
          
          // Smart Fallback for Base Price in Preview
          const basePriceKey = columnMapping['base_price'];
          if (rowObj[basePriceKey] === '') {
              let fallbackIndex = cols.findIndex(h => {
                  const n = typeof h === 'string' ? h.toLowerCase().trim() : '';
                  return n === 'đơn giá' || n === 'giá thực tế';
              });
              if (fallbackIndex !== -1 && row[fallbackIndex] !== undefined && row[fallbackIndex] !== '') {
                  rowObj[basePriceKey] = row[fallbackIndex];
              }
          }

          return rowObj;
        });

        setPreviewData(formattedData.slice(0, 5)); // Preview top 5 rows
      } catch (err) {
        console.error("Lỗi đọc file:", err);
        setError("Không thể đọc file. Vui lòng kiểm tra lại định dạng Excel.");
      }
    };
    reader.readAsBinaryString(selectedFile);
  };

  const handleImport = async () => {
    if (!file) return;
    setIsUploading(true);
    setError(null);

    try {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const bstr = evt.target.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
          
          const rawHeaders = data[0];
          const rows = data.slice(1).filter(row => row.some(cell => cell !== ''));

          // ─── CUSTOM HANDLER PATH ─────────────────────────────────
          if (customImportHandler) {
            const count = await customImportHandler(rows, rawHeaders, columnMapping);
            onSuccess(count);
            onClose();
            return;
          }
          // ─── DEFAULT PATH (below) ────────────────────────────────

          // Smart Foreign Key Resolution: Auto-create and Map missing Categories
          let finalCategoriesMap = new Map();
          if (tableName === 'materials') {
              const { data: existingCats } = await supabase.from('material_categories').select('code, name');
              if (existingCats) {
                  existingCats.forEach(c => {
                      finalCategoriesMap.set(c.name.toLowerCase().trim(), c.code);
                      finalCategoriesMap.set(c.code.toLowerCase().trim(), c.code);
                  });
              }

              const catExpectedNorm = columnMapping['category_code'].toLowerCase().trim();
              let catColIndex = rawHeaders.findIndex(h => {
                  const n = typeof h === 'string' ? h.toLowerCase().trim() : '';
                  return n === catExpectedNorm || n.includes('danh mục');
              });

              if (catColIndex !== -1) {
                  const newCategories = new Set();
                  rows.forEach(row => {
                      let cellVal = row[catColIndex];
                      if (cellVal && typeof cellVal === 'string' && cellVal.trim() !== '') {
                          const catName = cellVal.trim();
                          if (!finalCategoriesMap.has(catName.toLowerCase())) {
                              newCategories.add(catName);
                          }
                      }
                  });

                  if (newCategories.size > 0) {
                      const generateCode = (name) => {
                          const cleaned = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D");
                          return cleaned.replace(/[^a-zA-Z0-9]/g, "_").replace(/_+/g, "_").toUpperCase().substring(0, 20);
                      };
                      const catsToInsert = Array.from(newCategories).map(name => ({
                          code: generateCode(name),
                          name: name
                      }));
                      await supabase.from('material_categories').upsert(catsToInsert, { onConflict: 'code', ignoreDuplicates: true });
                      catsToInsert.forEach(c => finalCategoriesMap.set(c.name.toLowerCase().trim(), c.code));
                  }
              }
          }

          const payload = rows.map(row => {
            let dbRow = {};
            Object.keys(columnMapping).forEach(dbCol => {
              const expectedHeader = columnMapping[dbCol];
              
              const normalize = (str) => typeof str === 'string' ? str.toLowerCase().trim() : '';
              const expectedNorm = normalize(expectedHeader);
              
              let colIndex = rawHeaders.findIndex(h => normalize(h) === expectedNorm);
              
              // More robust synonyms matching targeting exact column variants - CRM/Partners
              if (colIndex === -1 && dbCol === 'name') colIndex = rawHeaders.findIndex(h => normalize(h).includes('tên nhà cung cấp') || normalize(h).includes('tên khách hàng') || normalize(h).includes('tên đối tác') || normalize(h).includes('tên ncc'));
              if (colIndex === -1 && dbCol === 'short_name') colIndex = rawHeaders.findIndex(h => normalize(h).includes('tên viết tắt') || normalize(h).includes('viết tắt'));
              if (colIndex === -1 && dbCol === 'tax_code') colIndex = rawHeaders.findIndex(h => normalize(h).includes('mã số thuế') || normalize(h) === 'mst');
              if (colIndex === -1 && dbCol === 'representative') colIndex = rawHeaders.findIndex(h => normalize(h).includes('người liên hệ') || normalize(h).includes('liên hệ'));
              if (colIndex === -1 && dbCol === 'bank_account') colIndex = rawHeaders.findIndex(h => normalize(h) === 'số tài khoản' || normalize(h) === 'stk' || normalize(h).includes('số tk') || normalize(h).includes('số tài khảo')); // Handling common typos
              if (colIndex === -1 && dbCol === 'bank_name') colIndex = rawHeaders.findIndex(h => normalize(h) === 'ngân hàng' || normalize(h).includes('tên ngân hàng'));
              if (colIndex === -1 && dbCol === 'phone') colIndex = rawHeaders.findIndex(h => normalize(h).includes('điện thoại') || normalize(h) === 'sđt' || normalize(h) === 'số đt');

              // Fuzzy match fallback - Materials
              if (colIndex === -1 && dbCol === 'base_price') colIndex = rawHeaders.findIndex(h => normalize(h).includes('đơn giá') || normalize(h).includes('giá niêm yết') || normalize(h).includes('giá gốc'));
              if (colIndex === -1 && dbCol === 'discount_percentage') colIndex = rawHeaders.findIndex(h => normalize(h).includes('chiết khấu'));
              if (colIndex === -1 && dbCol === 'weight_per_unit') colIndex = rawHeaders.findIndex(h => normalize(h).includes('trọng lượng') || normalize(h).includes('khối lượng'));
              if (colIndex === -1 && dbCol === 'min_inventory') colIndex = rawHeaders.findIndex(h => normalize(h).includes('tồn tối thiểu') || normalize(h).includes('tồn kho'));
              if (colIndex === -1 && dbCol === 'import_unit') colIndex = rawHeaders.findIndex(h => normalize(h).includes('đvt nhập') || normalize(h).includes('đơn vị nhập'));
              if (colIndex === -1 && dbCol === 'export_unit') colIndex = rawHeaders.findIndex(h => normalize(h).includes('đvt xuất') || normalize(h).includes('đơn vị xuất'));

              if (colIndex !== -1) {
                let cellValue = row[colIndex];
                if (cellValue === '' || (typeof cellValue === 'string' && cellValue.trim() === '')) {
                    cellValue = null;
                } else if (tableName === 'materials' && dbCol === 'category_code') {
                    const mappedCode = finalCategoriesMap.get(cellValue.toString().toLowerCase().trim());
                    if (mappedCode) cellValue = mappedCode;
                }
                dbRow[dbCol] = cellValue;
              }
            });
            
            // Smart Fallback for Base Price during Import
            if (dbRow.base_price === undefined || dbRow.base_price === null) {
                let fallbackIndex = rawHeaders.findIndex(h => {
                    const n = typeof h === 'string' ? h.toLowerCase().trim() : '';
                    return n === 'đơn giá' || n === 'giá thực tế';
                });
                if (fallbackIndex !== -1 && row[fallbackIndex] !== undefined && row[fallbackIndex] !== '' && row[fallbackIndex] !== null) {
                    dbRow.base_price = row[fallbackIndex];
                }
            }

            return { ...dbRow, ...fixedData };
          });

          const safePayload = payload.map(item => {
              const safeItem = { ...item };
              
              if (tableName === 'partners') {
                  if (!safeItem.code && safeItem.short_name) {
                      safeItem.code = safeItem.short_name;
                  }
                  
                  let extraNotes = [];
                  if (safeItem.code) extraNotes.push(`Mã ĐT: ${safeItem.code}`);
                  if (safeItem.account_holder) extraNotes.push(`Chủ TK: ${safeItem.account_holder}`);
                  if (safeItem.bank_branch) extraNotes.push(`Chi nhánh: ${safeItem.bank_branch}`);
                  
                  if (extraNotes.length > 0) {
                      const combinedExtra = extraNotes.join(' | ');
                      safeItem.notes = safeItem.notes ? `${safeItem.notes}\n${combinedExtra}` : combinedExtra;
                  }

                  // Strip the columns from payload so Supabase doesn't crash
                  delete safeItem.code;
                  delete safeItem.bank_branch;
                  delete safeItem.account_holder;
              }

              // Supabase JS client will automatically pad missing keys with 'null' in batch inserts
              // if SOME rows have the key and others don't. This breaks NOT NULL constraints.
              // Therefore, we must explicitly provide the default values instead of deleting the keys.
              Object.keys(safeItem).forEach(key => {
                  if (safeItem[key] === null) {
                      if (['base_price', 'min_inventory', 'discount_percentage'].includes(key)) {
                          safeItem[key] = 0;
                      } else if (['import_conversion_rate', 'export_conversion_rate'].includes(key)) {
                          safeItem[key] = 1;
                      } else {
                          delete safeItem[key]; // Delete string/text columns that allow nulls, or don't exist
                      }
                  }
              });

              return safeItem;
          });

          const cleanPayload = safePayload.filter(r => Object.values(r).some(val => val !== null));

          // Lọc bỏ rác: Dòng bắt buộc phải có "Tên Đối tác" / "Tên nhà cung cấp"
          const validPayload = cleanPayload.filter(item => item.name && item.name.toString().trim() !== '');

          if (validPayload.length === 0) {
              throw new Error("Không có dữ liệu hợp lệ (hoặc thiếu Tên) để import.");
          }

          // If importing materials, we have a unique 'code' constraint, so we can elegantly UPSERT 
          // to update existing items (like fixing prices) without raising Duplicate Key errors!
          // However, Postgres batch UPSERT will crash if the same 'code' appears multiple times IN THE SAME BATCH.
          // Therefore we MUST deduplicate the array by 'code' first.
          let sbError = null;
          if (tableName === 'materials') {
              // Deduplicate by taking the LAST occurrence of any duplicate code in the file
              const uniqueMap = new Map();
              validPayload.forEach(item => {
                  if (item.code) uniqueMap.set(item.code, item);
              });
              const deduplicatedPayload = Array.from(uniqueMap.values());

              // Chunk the payload into batches of 500 to prevent DB timeout over mass imports
              const CHUNK_SIZE = 500;
              for (let i = 0; i < deduplicatedPayload.length; i += CHUNK_SIZE) {
                  const chunk = deduplicatedPayload.slice(i, i + CHUNK_SIZE);
                  const { error } = await supabase
                    .from(tableName)
                    .upsert(chunk, { onConflict: 'code', ignoreDuplicates: false });
                  if (error) {
                      sbError = error;
                      break;
                  }
              }
          } else {
              const CHUNK_SIZE = 500;
              for (let i = 0; i < validPayload.length; i += CHUNK_SIZE) {
                  const chunk = validPayload.slice(i, i + CHUNK_SIZE);
                  const { error } = await supabase
                    .from(tableName)
                    .insert(chunk);
                  if (error) {
                      sbError = error;
                      break;
                  }
              }
          }

          if (sbError) throw sbError;

          onSuccess(validPayload.length);
          onClose();
        } catch (err) {
          console.error("Lỗi import Database:", err);
          setError(err.message || "Có lỗi xảy ra khi lưu vào cơ sở dữ liệu.");
        } finally {
          setIsUploading(false);
        }
      };
      reader.readAsBinaryString(file);
    } catch (err) {
      setError("Lỗi xử lý file upload.");
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-emerald-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <span className="material-symbols-outlined notranslate text-xl" translate="no">upload_file</span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">{title}</h3>
              <p className="text-sm text-slate-500">Hỗ trợ file .xlsx, .xls, .csv</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* 📥 DOWNLOAD TEMPLATE BUTTON */}
            <button 
              onClick={handleDownloadTemplate}
              title="Tải file mẫu Excel để điền dữ liệu"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-emerald-300 text-emerald-700 font-bold text-sm hover:bg-emerald-100 transition-colors shadow-sm"
            >
              <span className="material-symbols-outlined notranslate text-[18px]" translate="no">download</span>
              Tải File Mẫu (.xlsx)
            </button>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-200 text-slate-500 transition-colors">
              <span className="material-symbols-outlined notranslate text-[20px]" translate="no">close</span>
            </button>
          </div>
        </div>

        {/* Template info banner */}
        <div className="px-6 py-3 bg-blue-50 border-b border-blue-100 flex items-start gap-3">
          <span className="material-symbols-outlined notranslate text-blue-500 text-[18px] mt-0.5 shrink-0" translate="no">info</span>
          <div className="text-xs text-blue-700 font-medium">
            <strong>Hướng dẫn:</strong> Nhấn <em>"Tải File Mẫu"</em> để lấy file Excel với tiêu đề đúng định dạng → Điền dữ liệu vào các cột → Kéo thả file lên đây để Import. Chỉ các cột <span className="text-emerald-700 font-bold">được đánh dấu ✓</span> mới được lưu vào hệ thống.
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Upload Box */}
          {!file ? (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 rounded-2xl p-10 text-center cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/50 transition-all group"
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept=".xlsx, .xls, .csv" 
                onChange={handleFileUpload}
              />
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:text-emerald-500 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined notranslate text-3xl" translate="no">cloud_upload</span>
              </div>
              <p className="text-base font-semibold text-slate-700 mb-1">Kéo thả file hoặc nhấn để chọn</p>
              <p className="text-sm text-slate-500">Bảng dữ liệu phải có dòng tiêu đề (Header row) khớp với File Mẫu</p>
            </div>
          ) : (
            <div className="flex items-center justify-between p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined notranslate text-emerald-600 text-3xl" translate="no">description</span>
                <div>
                  <p className="font-semibold text-emerald-900">{file.name}</p>
                  <p className="text-xs text-emerald-600">{(file.size / 1024).toFixed(1)} KB • {headers.length} cột</p>
                </div>
              </div>
              <button 
                onClick={() => { setFile(null); setPreviewData([]); setHeaders([]); }}
                className="text-sm font-medium text-emerald-600 hover:text-emerald-800"
              >
                Chọn file khác
              </button>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
              <span className="material-symbols-outlined notranslate text-red-500 shrink-0" translate="no">error</span>
              <p className="text-sm text-red-700 font-medium">{error}</p>
            </div>
          )}

          {/* Preview Section */}
          {previewData.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-slate-700">Xem trước dữ liệu (5 dòng đầu)</h4>
                <p className="text-xs text-slate-500">Cột <span className="text-emerald-600 font-bold">màu xanh ✓</span> sẽ được lưu</p>
              </div>
              
              <div className="border border-slate-200 rounded-xl overflow-hidden overflow-x-auto bg-white">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      {headers.map((h, i) => {
                        const isMapped = Object.values(columnMapping).includes(h);
                        return (
                          <th key={i} className={`p-3 whitespace-nowrap font-semibold ${isMapped ? 'text-emerald-600 bg-emerald-50' : 'text-slate-400'}`}>
                            {h}
                            {isMapped && <span className="material-symbols-outlined notranslate text-[10px] ml-1" translate="no">check_circle</span>}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewData.map((row, rowIndex) => (
                      <tr key={rowIndex} className="hover:bg-slate-50">
                        {headers.map((h, colIndex) => (
                          <td key={colIndex} className="p-3 whitespace-nowrap text-slate-600 max-w-[200px] truncate">
                            {row[h]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center gap-3">
          <button 
            onClick={handleDownloadTemplate}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-300 text-slate-600 font-medium text-sm hover:bg-slate-100 transition-colors"
          >
            <span className="material-symbols-outlined notranslate text-[16px]" translate="no">download</span>
            File Mẫu Excel
          </button>
          <div className="flex gap-3">
            <button 
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl font-medium text-slate-600 hover:bg-slate-200 transition-colors"
            >
              Hủy bỏ
            </button>
            <button 
              onClick={handleImport}
              disabled={!file || isUploading}
              className="px-6 py-2.5 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
            >
              {isUploading ? (
                <><span className="material-symbols-outlined notranslate animate-spin text-[20px]" translate="no">progress_activity</span> Đang lưu...</>
              ) : (
                <><span className="material-symbols-outlined notranslate text-[20px]" translate="no">save</span> Bắt đầu Import</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
