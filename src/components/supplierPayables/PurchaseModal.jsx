import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, MATERIAL_GROUPS } from './payablesUtils';
import NumberInput from '../common/NumberInput';
import SearchableSelect from '../common/SearchableSelect';
import QuickAddMaterialModal from './QuickAddMaterialModal';
import { searchMaterials } from '../../lib/materialSearch';

/* ── Remove Vietnamese diacritics for fuzzy search ── */
const removeDiacritics = (str) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');

/* ── Default empty line ── */
const emptyLine = () => ({ product_name: '', material_group: '', unit: 'cái', quantity: 0, unit_price: 0, vat_rate: 8, notes: '', material_id: null });

/* ── Autocomplete Input (có điều hướng bàn phím ↑/↓/Enter/Esc) ── */
function ProductAutocomplete({ value, onChange, onSelect, materials, priceMap, inputId, onPicked, onCreateNew }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [rect, setRect] = useState(null);   // vị trí dropdown (portal, tránh bị cắt)
  const ref = useRef(null);
  const listRef = useRef(null);
  const query = value || '';   // fully controlled: parent (line.product_name) là nguồn duy nhất

  const openList = () => {
    const r = ref.current?.getBoundingClientRect();
    if (r) setRect({ left: r.left, top: r.bottom + 2, width: r.width });
    setOpen(true);
  };

  useEffect(() => {
    const handler = (e) => {
      const inBox = ref.current?.contains(e.target);
      const inList = listRef.current?.contains(e.target);
      if (!inBox && !inList) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const LIMIT = 50;
  const matches = useMemo(() => searchMaterials(materials, query), [query, materials]);
  const filtered = matches.slice(0, LIMIT);
  const hasExact = useMemo(() => {
    const q = removeDiacritics(query.trim().toLowerCase());
    return !!q && materials.some(m => removeDiacritics((m.name || '').trim().toLowerCase()) === q);
  }, [materials, query]);
  const canCreate = onCreateNew && query.trim().length > 0 && !hasExact;

  const choose = (m) => { onSelect(m); setOpen(false); onPicked?.(); };  // onSelect cập nhật product_name (=value)

  const onKeyDown = (e) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { setOpen(true); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter' && open && filtered[active]) { e.preventDefault(); choose(filtered[active]); }
    else if (e.key === 'Enter' && open && canCreate) { e.preventDefault(); setOpen(false); onCreateNew(query.trim()); }
    else if (e.key === 'Escape') { setOpen(false); }
  };

  // Cuộn dòng đang chọn vào tầm nhìn
  useEffect(() => {
    listRef.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  return (
    <div className="relative" ref={ref}>
      <input type="text" value={query} id={inputId}
        onChange={e => { onChange(e.target.value); openList(); setActive(0); }}
        onFocus={openList}
        onKeyDown={onKeyDown}
        placeholder="Gõ tên vật tư... (↑↓ chọn, Enter)"
        className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded px-2.5 py-1.5 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
      {open && rect && (filtered.length > 0 || query.trim()) && createPortal(
        <div ref={listRef}
          style={{ position: 'fixed', left: rect.left, top: rect.top, width: rect.width, zIndex: 99999 }}
          className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-2xl max-h-[280px] overflow-y-auto">
          {canCreate && (
            <button type="button" onMouseDown={e => e.preventDefault()}
              onClick={() => { setOpen(false); onCreateNew(query.trim()); }}
              className="w-full text-left px-3 py-2.5 flex items-center gap-2 text-sm font-bold text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 border-b border-slate-100 dark:border-slate-700/50 sticky top-0 bg-white dark:bg-slate-800 z-10">
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              Thêm mới: "{query.trim()}"
            </button>
          )}
          {filtered.length === 0 && !canCreate && (
            <div className="px-3 py-3 text-xs text-slate-400 text-center">Không tìm thấy</div>
          )}
          {filtered.map((m, i) => {
            const lastPrice = priceMap[m.name.toLowerCase()];
            return (
              <button key={m.id} type="button" data-i={i}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(m)}
                className={`w-full text-left px-3 py-2 flex items-center justify-between text-sm border-b border-slate-100 dark:border-slate-700/50 last:border-0 ${i === active ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
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
          {matches.length > LIMIT && (
            <div className="px-3 py-2 text-[11px] text-slate-400 bg-slate-50 dark:bg-slate-700/30 text-center sticky bottom-0">
              Hiển thị {LIMIT}/{matches.length} — gõ thêm để lọc
            </div>
          )}
        </div>,
        document.body
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
  // Map mã danh mục -> tên nhóm (để tự điền NHÓM VT khi chọn vật tư)
  const [catMap, setCatMap] = useState({});
  // Quick-add vật tư mới
  const [quickAdd, setQuickAdd] = useState({ open: false, name: '', idx: null });

  useEffect(() => {
    supabase.from('material_categories').select('code, name').then(({ data }) => {
      const m = {};
      (data || []).forEach(c => { if (c.code) m[c.code] = c.name; });
      setCatMap(m);
    });
  }, []);

  // Options nhóm cho form quick-add
  const catOptions = useMemo(
    () => Object.entries(catMap).map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label, 'vi')),
    [catMap]
  );

  // Sau khi tạo vật tư mới: thêm vào danh sách + chọn vào đúng dòng đang nhập
  const handleMaterialCreated = (mat) => {
    setMaterials(prev => [...prev, mat]);
    const idx = quickAdd.idx;
    if (idx != null) {
      const grp = catMap[mat.category_code] || '';
      setLines(prev => prev.map((l, i) => i === idx ? {
        ...l, product_name: mat.name, unit: mat.unit || l.unit,
        unit_price: Number(mat.base_price) || 0, material_id: mat.id, material_group: grp,
      } : l));
      focusEl(`pm-qty-${idx}`);
    }
  };

  // Load materials once — tải TẤT CẢ theo từng trang 1000 (vượt cap Supabase) để autocomplete tìm đủ
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const CHUNK = 1000;
      const all = [];
      for (let from = 0; ; from += CHUNK) {
        const { data, error } = await supabase
          .from('materials')
          .select('id, code, name, unit, base_price, actual_price, category_code')
          .order('name').range(from, from + CHUNK - 1);
        if (error) { console.error('Error loading materials:', error); break; }
        all.push(...(data || []));
        if (!data || data.length < CHUNK) break;
      }
      if (!cancelled) setMaterials(all);
    })();
    return () => { cancelled = true; };
  }, []);

  // Init form when editData changes
  useEffect(() => {
    if (editData) {
      setHeader({ project_id: editData.project_id || '', supplier_id: editData.supplier_id || '', purchase_date: editData.purchase_date || '', reference_no: editData.reference_no || '' });
      setLines([{
        product_name: editData.product_name || '', material_group: editData.material_group || '',
        unit: editData.unit || 'cái', quantity: editData.quantity || 0, unit_price: editData.unit_price || 0,
        vat_rate: editData.vat_rate ?? 8, notes: editData.notes || '', material_id: editData.material_id || null,
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

  const focusEl = (id) => setTimeout(() => document.getElementById(id)?.focus(), 30);
  const addLine = () => setLines(prev => {
    const next = [...prev, emptyLine()];
    focusEl(`pm-prod-${next.length - 1}`);   // con trỏ nhảy về ô vật tư dòng mới
    return next;
  });
  // Enter ở ô Số lượng → dòng cuối thì thêm dòng mới, ngược lại nhảy xuống dòng dưới
  const handleQtyKey = (e, idx) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (!editData?.id && idx >= lines.length - 1) addLine();
    else focusEl(`pm-prod-${idx + 1}`);
  };

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
          unit_price: Number(l.unit_price) || 0, vat_rate: Number.isFinite(Number(l.vat_rate)) ? Number(l.vat_rate) : 8,
          notes: l.notes, material_id: l.material_id || null, reference_no: header.reference_no || null,
        }).eq('id', editData.id);
      } else {
        const batch = validLines.map(l => ({
          project_id: header.project_id, supplier_id: header.supplier_id,
          material_group: l.material_group || 'Khác', purchase_date: header.purchase_date,
          product_name: l.product_name, unit: l.unit, quantity: Number(l.quantity) || 0,
          unit_price: Number(l.unit_price) || 0, vat_rate: Number.isFinite(Number(l.vat_rate)) ? Number(l.vat_rate) : 8,
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
      <div
        className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-[95vw] max-w-[1200px] max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-700"
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && canSave && !saving) { e.preventDefault(); handleSave(); }
        }}
      >

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
              <SearchableSelect
                value={header.project_id}
                onChange={(id) => setHeader(h => ({ ...h, project_id: id }))}
                placeholder="Gõ tìm công trình..."
                options={projects.map(p => ({ id: p.id, label: p.internal_code || p.code || p.name, subLabel: p.name }))}
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">NHÀ CUNG CẤP *</label>
              <SearchableSelect
                value={header.supplier_id}
                onChange={(id) => setHeader(h => ({ ...h, supplier_id: id }))}
                placeholder="Gõ tìm nhà cung cấp..."
                options={suppliers.map(s => ({ id: s.id, label: s.name, subLabel: s.code }))}
              />
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
                  const grp = catMap[mat.category_code] || line.material_group;   // tự điền Nhóm VT từ danh mục vật tư
                  handleLineChange(idx, { ...line, product_name: mat.name, unit: mat.unit || line.unit, unit_price: lastPrice, material_id: mat.id, material_group: grp });
                };
                return (
                  <tr key={idx} className="border-b border-slate-100 dark:border-slate-700/30 hover:bg-blue-50/30 dark:hover:bg-blue-900/5">
                    <td className="py-1.5 px-2 text-center text-slate-400 font-mono text-[12px]">{idx + 1}</td>
                    <td className="py-1.5 px-2">
                      <ProductAutocomplete value={line.product_name} onChange={v => handleLineChange(idx, { ...line, product_name: v })}
                        onSelect={handleSelect} materials={materials} priceMap={priceMap}
                        inputId={`pm-prod-${idx}`} onPicked={() => focusEl(`pm-qty-${idx}`)}
                        onCreateNew={(name) => setQuickAdd({ open: true, name, idx })} />
                    </td>
                    <td className="py-1.5 px-2">
                      <select value={line.material_group} onChange={e => handleLineChange(idx, { ...line, material_group: e.target.value })}
                        className="w-full text-[12px] border border-slate-200 dark:border-slate-600 rounded px-1.5 py-1.5 bg-white dark:bg-slate-700">
                        <option value="">—</option>
                        {line.material_group && !MATERIAL_GROUPS.includes(line.material_group) && (
                          <option value={line.material_group}>{line.material_group}</option>
                        )}
                        {MATERIAL_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </td>
                    <td className="py-1.5 px-2">
                      <input type="text" value={line.unit} onChange={e => handleLineChange(idx, { ...line, unit: e.target.value })}
                        className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded px-2 py-1.5 bg-white dark:bg-slate-700 text-center" />
                    </td>
                    <td className="py-1.5 px-2">
                      <input type="number" id={`pm-qty-${idx}`} value={line.quantity}
                        onChange={e => handleLineChange(idx, { ...line, quantity: e.target.value })}
                        onKeyDown={e => handleQtyKey(e, idx)}
                        className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded px-2 py-1.5 bg-white dark:bg-slate-700 text-right font-mono tabular-nums" />
                    </td>
                    <td className="py-1.5 px-2">
                      <NumberInput value={line.unit_price} onChange={v => handleLineChange(idx, { ...line, unit_price: v })}
                        className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded px-2 py-1.5 bg-white dark:bg-slate-700 text-right font-mono tabular-nums" />
                    </td>
                    <td className="py-1.5 px-2">
                      <input type="number" value={line.vat_rate} onChange={e => handleLineChange(idx, { ...line, vat_rate: e.target.value })}
                        className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded px-2 py-1.5 bg-white dark:bg-slate-700 text-right font-mono tabular-nums" />
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono tabular-nums font-bold text-blue-600 text-sm whitespace-nowrap">
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
            <kbd className="hidden md:inline text-[10px] font-mono text-slate-400 border border-slate-200 dark:border-slate-600 rounded px-1.5 py-0.5">Ctrl+Enter để lưu</kbd>
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

      {quickAdd.open && (
        <QuickAddMaterialModal
          initialName={quickAdd.name}
          categories={catOptions}
          onClose={() => setQuickAdd(s => ({ ...s, open: false }))}
          onCreated={handleMaterialCreated}
        />
      )}
    </div>
  );
}
