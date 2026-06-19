import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, MATERIAL_GROUPS, projectLabel } from './payablesUtils';

/* ── Remove Vietnamese diacritics for fuzzy search ── */
const removeDiacritics = (str) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');

/* ── Default empty line ── */
const emptyLine = () => ({ product_name: '', material_group: '', unit: 'cái', quantity: 0, unit_price: 0, vat_rate: 10, notes: '', material_id: null });

/* ── Autocomplete Input ── */
function ProductAutocomplete({ value, onChange, onSelect, materials, priceMap }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value || '');
  const ref = useRef(null);

  useEffect(() => { setQuery(value || ''); }, [value]);
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = useMemo(() => {
    if (!query || query.length < 1) return materials.slice(0, 20);
    const q = removeDiacritics(query.toLowerCase());
    return materials.filter(m => {
      const name = removeDiacritics(m.name.toLowerCase());
      const code = removeDiacritics((m.code || '').toLowerCase());
      return name.includes(q) || code.includes(q);
    }).slice(0, 20);
  }, [query, materials]);

  return (
    <div className="relative" ref={ref}>
      <input type="text" value={query}
        onChange={e => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Gõ tên vật tư..."
        className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded px-2.5 py-1.5 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
      {open && filtered.length > 0 && (
        <div className="absolute z-[100] top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-2xl max-h-[240px] overflow-y-auto">
          {filtered.map(m => {
            const lastPrice = priceMap[m.name.toLowerCase()];
            return (
              <button key={m.id} type="button" onClick={() => { onSelect(m); setOpen(false); setQuery(m.name); }}
                className="w-full text-left px-3 py-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center justify-between text-sm border-b border-slate-100 dark:border-slate-700/50 last:border-0">
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-slate-800 dark:text-white truncate block">{m.name}</span>
                  {m.code && <span className="text-[10px] text-slate-400">{m.code}</span>}
                </div>
                <div className="flex items-center gap-2 ml-2 shrink-0">
                  {m.unit && <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">{m.unit}</span>}
                  {lastPrice > 0 && <span className="text-[11px] font-mono text-emerald-600">{formatCurrency(lastPrice)}</span>}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   PURCHASE MODAL — Full-screen modal for purchase entry
   ══════════════════════════════════════════════════════════ */
export default function PurchaseModal({ open, onClose, editData, projects, suppliers, onSaved }) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);

  // Header
  const [header, setHeader] = useState({ project_id: '', supplier_id: '', purchase_date: new Date().toISOString().slice(0, 10), reference_no: '' });
  // Lines
  const [lines, setLines] = useState([emptyLine()]);
  // Materials
  const [materials, setMaterials] = useState([]);
  // Price map
  const [priceMap, setPriceMap] = useState({});

  // Load materials once
  useEffect(() => {
    supabase.from('materials').select('id, code, name, unit, base_price, actual_price, category_code').order('name').limit(2000)
      .then(({ data, error }) => {
        if (error) console.error('Error loading materials:', error);
        if (data) setMaterials(data);
      });
  }, []);

  // Init form when editData changes
  useEffect(() => {
    if (editData) {
      setHeader({ project_id: editData.project_id || '', supplier_id: editData.supplier_id || '', purchase_date: editData.purchase_date || '', reference_no: editData.reference_no || '' });
      setLines([{
        product_name: editData.product_name || '', material_group: editData.material_group || '',
        unit: editData.unit || 'cái', quantity: editData.quantity || 0, unit_price: editData.unit_price || 0,
        vat_rate: editData.vat_rate || 10, notes: editData.notes || '', material_id: editData.material_id || null,
      }]);
    } else {
      setHeader({ project_id: '', supplier_id: '', purchase_date: new Date().toISOString().slice(0, 10), reference_no: '' });
      setLines([emptyLine()]);
    }
  }, [editData, open]);

  // Build price map when supplier changes
  useEffect(() => {
    if (!header.supplier_id) { setPriceMap({}); return; }
    supabase.from('supplier_purchases').select('product_name, unit_price').eq('supplier_id', header.supplier_id)
      .order('purchase_date', { ascending: false }).limit(500)
      .then(({ data }) => {
        const map = {};
        (data || []).forEach(r => { const key = r.product_name.toLowerCase(); if (!map[key]) map[key] = r.unit_price; });
        setPriceMap(map);
      });
  }, [header.supplier_id]);

  const handleLineChange = useCallback((idx, updated) => {
    setLines(prev => prev.map((l, i) => i === idx ? updated : l));
  }, []);

  const handleRemoveLine = useCallback((idx) => {
    setLines(prev => prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx));
  }, []);

  const addLine = () => setLines(prev => [...prev, emptyLine()]);

  const validLines = lines.filter(l => l.product_name.trim());
  const orderTotal = useMemo(() => {
    return lines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unit_price) || 0) * (1 + (Number(l.vat_rate) || 0) / 100), 0);
  }, [lines]);

  const canSave = header.project_id && header.supplier_id && validLines.length > 0;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      if (editData?.id) {
        const l = validLines[0];
        await supabase.from('supplier_purchases').update({
          project_id: header.project_id, supplier_id: header.supplier_id,
          material_group: l.material_group || 'Khác', purchase_date: header.purchase_date,
          product_name: l.product_name, unit: l.unit, quantity: Number(l.quantity) || 0,
          unit_price: Number(l.unit_price) || 0, vat_rate: Number(l.vat_rate) || 10,
          notes: l.notes, material_id: l.material_id || null, reference_no: header.reference_no || null,
        }).eq('id', editData.id);
      } else {
        const batch = validLines.map(l => ({
          project_id: header.project_id, supplier_id: header.supplier_id,
          material_group: l.material_group || 'Khác', purchase_date: header.purchase_date,
          product_name: l.product_name, unit: l.unit, quantity: Number(l.quantity) || 0,
          unit_price: Number(l.unit_price) || 0, vat_rate: Number(l.vat_rate) || 10,
          notes: l.notes, material_id: l.material_id || null, created_by: user?.id, reference_no: header.reference_no || null,
        }));
        const { data: inserted } = await supabase.from('supplier_purchases').insert(batch).select('id, product_name, unit_price, supplier_id');
        if (inserted) {
          const priceChanges = [];
          for (const row of inserted) {
            const lastPrice = priceMap[row.product_name.toLowerCase()];
            if (lastPrice !== undefined && lastPrice !== row.unit_price) {
              priceChanges.push({ product_name: row.product_name, supplier_id: row.supplier_id, old_price: lastPrice, new_price: row.unit_price, change_date: header.purchase_date, purchase_id: row.id });
            }
          }
          if (priceChanges.length > 0) await supabase.from('supplier_price_history').insert(priceChanges).catch(() => {});
        }
      }
      onSaved?.();
      onClose();
    } catch (err) { console.error('Error saving purchase:', err); } finally { setSaving(false); }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-[95vw] max-w-[1200px] max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-700">

        {/* ── HEADER ── */}
        <div className="shrink-0 border-b border-slate-200 dark:border-slate-700 px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-600 text-[22px]">receipt_long</span>
              {editData?.id ? 'Sửa đơn mua hàng' : 'Tạo đơn mua hàng'}
            </h2>
            <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
              <span className="material-symbols-outlined text-[20px] text-slate-500">close</span>
            </button>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">CÔNG TRÌNH *</label>
              <select value={header.project_id} onChange={e => setHeader(h => ({ ...h, project_id: e.target.value }))}
                className="w-full text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-blue-500 outline-none font-bold">
                <option value="">Chọn...</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.internal_code || p.code || p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">NHÀ CUNG CẤP *</label>
              <select value={header.supplier_id} onChange={e => setHeader(h => ({ ...h, supplier_id: e.target.value }))}
                className="w-full text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="">Chọn NCC...</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.code ? `${s.code} — ${s.name}` : s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">NGÀY MUA</label>
              <input type="date" value={header.purchase_date} onChange={e => setHeader(h => ({ ...h, purchase_date: e.target.value }))}
                className="w-full text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">SỐ HÓA ĐƠN / REF</label>
              <input type="text" value={header.reference_no} onChange={e => setHeader(h => ({ ...h, reference_no: e.target.value }))}
                placeholder="VD: HD-001..."
                className="w-full text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
          </div>
        </div>

        {/* ── LINE ITEMS TABLE ── */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-100 dark:bg-slate-700/50">
                <th className="w-10 py-2 px-2 text-center text-[10px] font-bold text-slate-500 rounded-tl-lg">STT</th>
                <th className="py-2 px-2 text-left text-[10px] font-bold text-slate-500 min-w-[250px]">TÊN VẬT TƯ *</th>
                <th className="py-2 px-2 text-left text-[10px] font-bold text-slate-500 w-[100px]">NHÓM VT</th>
                <th className="py-2 px-2 text-left text-[10px] font-bold text-slate-500 w-[70px]">ĐVT</th>
                <th className="py-2 px-2 text-right text-[10px] font-bold text-slate-500 w-[80px]">SỐ LƯỢNG</th>
                <th className="py-2 px-2 text-right text-[10px] font-bold text-slate-500 w-[120px]">ĐƠN GIÁ</th>
                <th className="py-2 px-2 text-right text-[10px] font-bold text-slate-500 w-[60px]">VAT%</th>
                <th className="py-2 px-2 text-right text-[10px] font-bold text-slate-500 w-[120px]">THÀNH TIỀN</th>
                <th className="py-2 px-2 text-left text-[10px] font-bold text-slate-500 w-[120px]">GHI CHÚ</th>
                <th className="w-10 py-2 px-2 rounded-tr-lg"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => {
                const total = (Number(line.quantity) || 0) * (Number(line.unit_price) || 0) * (1 + (Number(line.vat_rate) || 0) / 100);
                const handleSelect = (mat) => {
                  const lastPrice = priceMap[mat.name.toLowerCase()] || mat.actual_price || mat.base_price || 0;
                  handleLineChange(idx, { ...line, product_name: mat.name, unit: mat.unit || line.unit, unit_price: lastPrice, material_id: mat.id });
                };
                return (
                  <tr key={idx} className="border-b border-slate-100 dark:border-slate-700/30 hover:bg-blue-50/30 dark:hover:bg-blue-900/5">
                    <td className="py-1.5 px-2 text-center text-slate-400 font-mono text-[12px]">{idx + 1}</td>
                    <td className="py-1.5 px-2">
                      <ProductAutocomplete value={line.product_name} onChange={v => handleLineChange(idx, { ...line, product_name: v })}
                        onSelect={handleSelect} materials={materials} priceMap={priceMap} />
                    </td>
                    <td className="py-1.5 px-2">
                      <select value={line.material_group} onChange={e => handleLineChange(idx, { ...line, material_group: e.target.value })}
                        className="w-full text-[12px] border border-slate-200 dark:border-slate-600 rounded px-1.5 py-1.5 bg-white dark:bg-slate-700">
                        <option value="">—</option>
                        {MATERIAL_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </td>
                    <td className="py-1.5 px-2">
                      <input type="text" value={line.unit} onChange={e => handleLineChange(idx, { ...line, unit: e.target.value })}
                        className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded px-2 py-1.5 bg-white dark:bg-slate-700 text-center" />
                    </td>
                    <td className="py-1.5 px-2">
                      <input type="number" value={line.quantity} onChange={e => handleLineChange(idx, { ...line, quantity: e.target.value })}
                        className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded px-2 py-1.5 bg-white dark:bg-slate-700 text-right font-mono" />
                    </td>
                    <td className="py-1.5 px-2">
                      <input type="number" value={line.unit_price} onChange={e => handleLineChange(idx, { ...line, unit_price: e.target.value })}
                        className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded px-2 py-1.5 bg-white dark:bg-slate-700 text-right font-mono" />
                    </td>
                    <td className="py-1.5 px-2">
                      <input type="number" value={line.vat_rate} onChange={e => handleLineChange(idx, { ...line, vat_rate: e.target.value })}
                        className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded px-2 py-1.5 bg-white dark:bg-slate-700 text-right font-mono" />
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono font-bold text-blue-600 text-sm whitespace-nowrap">
                      {formatCurrency(total)}
                    </td>
                    <td className="py-1.5 px-2">
                      <input type="text" value={line.notes || ''} onChange={e => handleLineChange(idx, { ...line, notes: e.target.value })}
                        placeholder="..."
                        className="w-full text-[12px] border border-slate-200 dark:border-slate-600 rounded px-2 py-1.5 bg-white dark:bg-slate-700" />
                    </td>
                    <td className="py-1.5 px-2 text-center">
                      {lines.length > 1 && (
                        <button onClick={() => handleRemoveLine(idx)} className="text-slate-300 hover:text-rose-500 transition-colors" title="Xóa dòng">
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Add line button */}
          {!editData?.id && (
            <button onClick={addLine}
              className="flex items-center gap-1.5 text-blue-600 hover:text-blue-700 text-sm font-bold mt-3 px-3 py-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors border border-dashed border-blue-300 dark:border-blue-700 w-full justify-center">
              <span className="material-symbols-outlined text-[16px]">add</span>
              Thêm dòng vật tư
            </button>
          )}
        </div>

        {/* ── FOOTER ── */}
        <div className="shrink-0 border-t border-slate-200 dark:border-slate-700 px-6 py-4 bg-slate-50 dark:bg-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="text-sm text-slate-500">
              <span className="font-bold text-slate-700 dark:text-white">{validLines.length}</span> sản phẩm
            </div>
            <div className="text-sm">
              Tổng cộng: <span className="text-xl font-black text-blue-600 ml-1">{formatCurrency(orderTotal)} đ</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors">
              Hủy
            </button>
            <button onClick={handleSave} disabled={saving || !canSave}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm font-bold shadow-lg shadow-blue-600/20 transition-all flex items-center gap-2">
              {saving ? (
                <><span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span> Đang lưu...</>
              ) : (
                <><span className="material-symbols-outlined text-[16px]">save</span> {editData?.id ? 'Cập nhật' : `Lưu ${validLines.length} dòng`}</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
