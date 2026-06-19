import React, { useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { parseExcelWorkbook, formatCurrency, projectOption, projectLabel } from './payablesUtils';
import * as XLSX from 'xlsx';

export default function PayablesExcelImport({ projects = [], suppliers = [], onClose, onImported }) {
  const { user } = useAuth();
  const [step, setStep] = useState(1); // 1: upload, 2: preview, 3: importing, 4: done
  const [fileName, setFileName] = useState('');
  const [parsedData, setParsedData] = useState({ purchases: [], payments: [] });
  const [selectedProject, setSelectedProject] = useState('');
  const [usePerRowProject, setUsePerRowProject] = useState(false); // Use CÔNG TRÌNH col from Excel
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleFile = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError('');

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'array', cellDates: true });
        // Expose XLSX.utils for parser
        window.__XLSX_UTILS = XLSX.utils;
        const parsed = parseExcelWorkbook(wb);

        if (parsed.purchases.length === 0 && parsed.payments.length === 0) {
          setError('File không có dữ liệu hợp lệ. Kiểm tra lại format.');
          return;
        }

        // Check if data has per-row project info
        const hasProjectCol = parsed.purchases.some(p => p.project_name) || parsed.payments.some(p => p.project_name);
        setUsePerRowProject(hasProjectCol);

        setParsedData(parsed);
        setStep(2);
      } catch (err) {
        setError(`Lỗi đọc file: ${err.message}`);
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const handleImport = async () => {
    if (!usePerRowProject && !selectedProject) { setError('Vui lòng chọn công trình'); return; }
    setImporting(true);
    setStep(3);
    setError('');

    try {
      // Build lookup maps
      const supplierMap = {};
      suppliers.forEach(s => { supplierMap[s.name.toLowerCase().trim()] = s.id; });

      const projectMap = {};
      projects.forEach(p => {
        if (p.internal_code) projectMap[p.internal_code.toLowerCase().trim()] = p.id;
        if (p.code) projectMap[p.code.toLowerCase().trim()] = p.id;
        if (p.name) projectMap[p.name.toLowerCase().trim()] = p.id;
      });

      let purchaseCount = 0;
      let paymentCount = 0;
      let skippedCount = 0;
      const skippedReasons = [];

      // Resolve project ID for a row
      const resolveProject = (row) => {
        if (usePerRowProject && row.project_name) {
          const pid = projectMap[row.project_name.toLowerCase().trim()];
          if (!pid) {
            skippedReasons.push(`Dòng ${row._row}: Không tìm thấy CT "${row.project_name}"`);
          }
          return pid;
        }
        return selectedProject;
      };

      // Import purchases
      const purchaseBatch = parsedData.purchases.map(p => {
        const supplierId = supplierMap[p.supplier_name.toLowerCase().trim()];
        const projectId = resolveProject(p);
        if (!supplierId) { skippedCount++; skippedReasons.push(`Dòng ${p._row}: NCC "${p.supplier_name}" chưa có`); return null; }
        if (!projectId) { skippedCount++; return null; }
        return {
          project_id: projectId,
          supplier_id: supplierId,
          material_group: p.material_group || 'Khác',
          purchase_date: p.purchase_date,
          product_name: p.product_name,
          unit: p.unit,
          quantity: p.quantity,
          unit_price: p.unit_price,
          vat_rate: p.vat_rate,
          notes: p.notes,
          created_by: user?.id,
        };
      }).filter(Boolean);

      if (purchaseBatch.length > 0) {
        const { error: pErr } = await supabase.from('supplier_purchases').insert(purchaseBatch);
        if (pErr) throw pErr;
        purchaseCount = purchaseBatch.length;
      }

      // Import payments
      const paymentBatch = parsedData.payments.map(p => {
        const supplierId = supplierMap[p.supplier_name.toLowerCase().trim()];
        const projectId = resolveProject(p);
        if (!supplierId) { skippedCount++; skippedReasons.push(`Dòng ${p._row}: NCC "${p.supplier_name}" chưa có`); return null; }
        if (!projectId) { skippedCount++; return null; }
        return {
          project_id: projectId,
          supplier_id: supplierId,
          material_group: p.material_group || null,
          payment_date: p.payment_date,
          amount: p.amount,
          payment_method: p.payment_method || 'Chuyển khoản',
          reference_no: p.reference_no || null,
          notes: p.notes,
          created_by: user?.id,
        };
      }).filter(Boolean);

      if (paymentBatch.length > 0) {
        const { error: payErr } = await supabase.from('supplier_payments').insert(paymentBatch);
        if (payErr) throw payErr;
        paymentCount = paymentBatch.length;
      }

      setResult({ purchaseCount, paymentCount, skippedCount, skippedReasons });
      setStep(4);
      onImported?.();
    } catch (err) {
      setError(`Lỗi import: ${err.message}`);
      setStep(2);
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    // Sheet 1: Mua hàng
    const purchaseHeaders = ['NGÀY', 'NCC', 'SẢN PHẨM', 'DVT', 'SỐ LƯỢNG', 'ĐƠN GIÁ', 'VAT(%)', 'NHÓM VT', 'CÔNG TRÌNH', 'GHI CHÚ'];
    const purchaseSample = [
      ['26/03/2025', 'CD HƯNG PHÁT', 'Kẹp ống tròn 2 lỗ đồng đế 1-1/2"', 'cái', 30, 2400, 10, 'Ống luồn dây thép', 'ISV', ''],
      ['26/03/2025', 'CD HƯNG PHÁT', 'Ống thép luồn dây điện IMC 1"', 'cây', 100, 85000, 10, 'Ống luồn dây thép', 'ISV', ''],
      ['28/03/2025', 'CADIVI', 'Dây đơn CV 2.5mm²', 'cuộn', 50, 450000, 10, 'Dây điện & Cáp', 'SUNRISE', ''],
    ];
    const wsPurchase = XLSX.utils.aoa_to_sheet([purchaseHeaders, ...purchaseSample]);
    // Column widths
    wsPurchase['!cols'] = [
      { wch: 12 }, { wch: 20 }, { wch: 35 }, { wch: 8 },
      { wch: 10 }, { wch: 12 }, { wch: 8 }, { wch: 20 },
      { wch: 14 }, { wch: 20 },
    ];

    // Sheet 2: Thanh toán
    const paymentHeaders = ['NGÀY', 'NCC', 'SỐ TIỀN', 'HÌNH THỨC', 'SỐ CHỨNG TỪ', 'NHÓM VT', 'CÔNG TRÌNH', 'GHI CHÚ'];
    const paymentSample = [
      ['01/04/2025', 'CD HƯNG PHÁT', 5720400, 'Chuyển khoản', 'UNC-0031245', 'Ống luồn dây thép', 'ISV', 'Thanh toán đợt 1'],
      ['05/04/2025', 'CADIVI', 22500000, 'Chuyển khoản', 'UNC-0031300', 'Dây điện & Cáp', 'SUNRISE', ''],
    ];
    const wsPayment = XLSX.utils.aoa_to_sheet([paymentHeaders, ...paymentSample]);
    wsPayment['!cols'] = [
      { wch: 12 }, { wch: 20 }, { wch: 15 }, { wch: 15 },
      { wch: 18 }, { wch: 20 }, { wch: 14 }, { wch: 25 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsPurchase, 'Mua hàng');
    XLSX.utils.book_append_sheet(wb, wsPayment, 'Thanh toán');
    XLSX.writeFile(wb, 'Template_CongNo_NCC.xlsx');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-600">upload_file</span>
            Import Excel — Công nợ NCC
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 px-4 py-3 bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 rounded-xl text-sm">
              <span className="material-symbols-outlined text-[18px]">error</span>{error}
            </div>
          )}

          {/* Step 1: Upload */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-2xl p-8 text-center hover:border-blue-400 transition-colors">
                <span className="material-symbols-outlined text-5xl text-slate-300 dark:text-slate-600 mb-3 block">cloud_upload</span>
                <p className="text-slate-600 dark:text-slate-300 font-medium mb-2">Kéo thả file Excel hoặc click để chọn</p>
                <p className="text-slate-400 text-sm mb-4">Hỗ trợ .xlsx, .xls — Template 2 sheet (Mua hàng + Thanh toán)</p>
                <input type="file" accept=".xlsx,.xls" onChange={handleFile} className="hidden" id="excel-upload" />
                <label htmlFor="excel-upload" className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold cursor-pointer transition-colors inline-block">
                  Chọn file
                </label>
              </div>

              {/* Template info */}
              <div className="bg-slate-50 dark:bg-slate-700/30 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-blue-600">info</span>
                    Hướng dẫn template
                  </p>
                  <button onClick={downloadTemplate} className="text-sm text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 rounded-lg transition-colors">
                    <span className="material-symbols-outlined text-[16px]">download</span>Tải file mẫu
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3 text-[12px] text-slate-500">
                  <div className="bg-white dark:bg-slate-700 rounded-lg p-3 border border-slate-200 dark:border-slate-600">
                    <p className="font-bold text-blue-600 mb-1">Sheet "Mua hàng"</p>
                    <p>NGÀY · NCC · SẢN PHẨM · DVT · SỐ LƯỢNG · ĐƠN GIÁ · VAT(%) · NHÓM VT · CÔNG TRÌNH</p>
                  </div>
                  <div className="bg-white dark:bg-slate-700 rounded-lg p-3 border border-slate-200 dark:border-slate-600">
                    <p className="font-bold text-emerald-600 mb-1">Sheet "Thanh toán"</p>
                    <p>NGÀY · NCC · SỐ TIỀN · HÌNH THỨC · SỐ CT · NHÓM VT · CÔNG TRÌNH</p>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400">Cột CÔNG TRÌNH ghi mã tự đặt (ISV, SUNRISE...). Ngày ghi dd/mm/yyyy. Hỗ trợ file cũ 1 sheet.</p>
              </div>
            </div>
          )}

          {/* Step 2: Preview */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 dark:bg-blue-900/10 rounded-xl">
                <span className="material-symbols-outlined text-blue-600">description</span>
                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-white">{fileName}</p>
                  <p className="text-[12px] text-slate-500">{parsedData.purchases.length} mua hàng · {parsedData.payments.length} thanh toán</p>
                </div>
              </div>

              {/* Project selector — only if data doesn't have per-row project */}
              {!usePerRowProject ? (
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Công trình áp dụng cho tất cả *</label>
                  <select value={selectedProject} onChange={e => setSelectedProject(e.target.value)}
                    className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2.5 bg-white dark:bg-slate-700 text-slate-800 dark:text-white">
                    <option value="">Chọn công trình...</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{projectOption(p)}</option>)}
                  </select>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl text-sm text-emerald-700 dark:text-emerald-400">
                  <span className="material-symbols-outlined text-[16px]">check_circle</span>
                  Công trình được nhận từ cột CÔNG TRÌNH trong file Excel (khớp theo mã tự đặt)
                </div>
              )}

              {/* Preview Tables */}
              {parsedData.purchases.length > 0 && (
                <div>
                  <h4 className="text-sm font-bold text-slate-600 mb-2 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px] text-blue-600">shopping_cart</span>
                    Mua hàng ({parsedData.purchases.length} dòng)
                  </h4>
                  <div className="overflow-x-auto max-h-[200px] overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl">
                    <table className="w-full text-[12px]">
                      <thead className="bg-slate-50 dark:bg-slate-700 sticky top-0">
                        <tr>
                          <th className="text-left py-2 px-2 font-bold text-slate-500">#</th>
                          <th className="text-left py-2 px-2 font-bold text-slate-500">Ngày</th>
                          <th className="text-left py-2 px-2 font-bold text-slate-500">NCC</th>
                          <th className="text-left py-2 px-2 font-bold text-slate-500">Sản phẩm</th>
                          <th className="text-right py-2 px-2 font-bold text-slate-500">SL</th>
                          <th className="text-right py-2 px-2 font-bold text-slate-500">Đ.Giá</th>
                          {usePerRowProject && <th className="text-left py-2 px-2 font-bold text-slate-500">CT</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {parsedData.purchases.slice(0, 20).map((p, i) => (
                          <tr key={i} className="border-t border-slate-100 dark:border-slate-700/50">
                            <td className="py-1.5 px-2 text-slate-400">{p._row}</td>
                            <td className="py-1.5 px-2 whitespace-nowrap">{p.purchase_date}</td>
                            <td className="py-1.5 px-2 font-medium">{p.supplier_name}</td>
                            <td className="py-1.5 px-2 max-w-[200px] truncate">{p.product_name}</td>
                            <td className="py-1.5 px-2 text-right font-mono">{p.quantity}</td>
                            <td className="py-1.5 px-2 text-right font-mono">{formatCurrency(p.unit_price)}</td>
                            {usePerRowProject && <td className="py-1.5 px-2 text-blue-600 font-bold">{p.project_name}</td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {parsedData.purchases.length > 20 && (
                      <div className="text-center py-2 text-[11px] text-slate-400 bg-slate-50 dark:bg-slate-700">
                        ...và {parsedData.purchases.length - 20} dòng nữa
                      </div>
                    )}
                  </div>
                </div>
              )}

              {parsedData.payments.length > 0 && (
                <div>
                  <h4 className="text-sm font-bold text-slate-600 mb-2 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px] text-emerald-600">paid</span>
                    Thanh toán ({parsedData.payments.length} dòng)
                  </h4>
                  <div className="overflow-x-auto max-h-[150px] overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl">
                    <table className="w-full text-[12px]">
                      <thead className="bg-slate-50 dark:bg-slate-700 sticky top-0">
                        <tr>
                          <th className="text-left py-2 px-2 font-bold text-slate-500">#</th>
                          <th className="text-left py-2 px-2 font-bold text-slate-500">Ngày</th>
                          <th className="text-left py-2 px-2 font-bold text-slate-500">NCC</th>
                          <th className="text-right py-2 px-2 font-bold text-slate-500">Số tiền</th>
                          <th className="text-left py-2 px-2 font-bold text-slate-500">Hình thức</th>
                          {usePerRowProject && <th className="text-left py-2 px-2 font-bold text-slate-500">CT</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {parsedData.payments.slice(0, 10).map((p, i) => (
                          <tr key={i} className="border-t border-slate-100 dark:border-slate-700/50">
                            <td className="py-1.5 px-2 text-slate-400">{p._row}</td>
                            <td className="py-1.5 px-2 whitespace-nowrap">{p.payment_date}</td>
                            <td className="py-1.5 px-2 font-medium">{p.supplier_name}</td>
                            <td className="py-1.5 px-2 text-right font-mono font-bold text-emerald-600">{formatCurrency(p.amount)}</td>
                            <td className="py-1.5 px-2 text-slate-500">{p.payment_method}</td>
                            {usePerRowProject && <td className="py-1.5 px-2 text-blue-600 font-bold">{p.project_name}</td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Importing */}
          {step === 3 && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mb-4"></div>
              <p className="text-slate-600 dark:text-slate-300 font-medium">Đang import dữ liệu...</p>
            </div>
          )}

          {/* Step 4: Done */}
          {step === 4 && result && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center">
                <span className="material-symbols-outlined text-3xl text-emerald-600">check_circle</span>
              </div>
              <h4 className="text-lg font-bold text-slate-800 dark:text-white">Import thành công!</h4>
              <div className="flex gap-6 text-sm">
                <div className="text-center">
                  <p className="text-2xl font-black text-blue-600">{result.purchaseCount}</p>
                  <p className="text-slate-500">Mua hàng</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-black text-emerald-600">{result.paymentCount}</p>
                  <p className="text-slate-500">Thanh toán</p>
                </div>
                {result.skippedCount > 0 && (
                  <div className="text-center">
                    <p className="text-2xl font-black text-amber-600">{result.skippedCount}</p>
                    <p className="text-slate-500">Bỏ qua</p>
                  </div>
                )}
              </div>
              {/* Skipped reasons */}
              {result.skippedReasons?.length > 0 && (
                <div className="w-full max-h-[120px] overflow-y-auto bg-amber-50 dark:bg-amber-900/10 rounded-xl p-3 text-[11px] text-amber-700 dark:text-amber-400 space-y-0.5">
                  {result.skippedReasons.slice(0, 20).map((r, i) => (
                    <p key={i}>• {r}</p>
                  ))}
                  {result.skippedReasons.length > 20 && <p className="font-bold">...và {result.skippedReasons.length - 20} lỗi nữa</p>}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <button onClick={onClose} className="px-5 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors">
            {step === 4 ? 'Đóng' : 'Hủy'}
          </button>
          {step === 2 && (
            <button onClick={handleImport} disabled={importing || (!usePerRowProject && !selectedProject)}
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-sm font-bold shadow-sm transition-colors">
              Import {parsedData.purchases.length + parsedData.payments.length} dòng
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
