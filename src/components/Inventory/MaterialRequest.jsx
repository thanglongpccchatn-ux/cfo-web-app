import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { smartToast } from '../../utils/globalToast';
import SearchableSelect from '../common/SearchableSelect';
import NumberInput from '../common/NumberInput';
import { useInventoryScope } from './useInventoryScope';

const norm = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim().replace(/\s+/g, ' ');
const today = () => new Date().toISOString().slice(0, 10);
const qtyFmt = (v) => { const n = Number(v) || 0; return Number.isInteger(n) ? n.toLocaleString('vi-VN') : n.toLocaleString('vi-VN', { maximumFractionDigits: 2 }); };
const emptyLine = () => ({ id: Math.random().toString(36).slice(2), key: '', product_name: '', unit: '', material_id: null, material_group: '', contract_qty: 0, qty: 0, note: '' });

async function fetchAll(table, select, order) {
  const CHUNK = 1000; const all = [];
  for (let from = 0; ; from += CHUNK) {
    let qy = supabase.from(table).select(select).range(from, from + CHUNK - 1);
    if (order) qy = qy.order(order);
    const { data, error } = await qy;
    if (error) return { rows: all, error };
    all.push(...(data || []));
    if (!data || data.length < CHUNK) break;
  }
  return { rows: all, error: null };
}

export default function MaterialRequest({ onIssue }) {
  const { user } = useAuth();
  const { viewAll, assignedProjects, defaultProject } = useInventoryScope();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [header, setHeader] = useState({ project_id: viewAll ? '' : defaultProject, subcontractor: null, request_date: today(), notes: '' });
  const [lines, setLines] = useState([emptyLine()]);

  const { data } = useQuery({
    queryKey: ['material-requests'],
    queryFn: async () => {
      const [projs, purch, mats, subs, subP, reqs, reqItems] = await Promise.all([
        fetchAll('projects', 'id, internal_code, code, name', 'name'),
        fetchAll('supplier_purchases', 'project_id, product_name, material_id, unit'),
        fetchAll('materials', 'id, name, category_code'),
        fetchAll('subcontractors', 'id, code, name'),
        fetchAll('partners', 'id, code, name'),
        fetchAll('material_requests', '*', 'created_at'),
        fetchAll('material_request_items', '*'),
      ]);
      return { projects: projs.rows, purchases: purch.rows, materials: mats.rows, subs: subs.rows, partners: subP.rows, requests: reqs.rows, reqItems: reqItems.rows, reqErr: reqs.error };
    },
  });

  const projMap = useMemo(() => Object.fromEntries((data?.projects || []).map(p => [p.id, p.internal_code || p.code || p.name])), [data?.projects]);
  const projectOptions = useMemo(() => {
    const ids = [...new Set((data?.purchases || []).map(p => p.project_id).filter(Boolean))];
    return ids.map(id => ({ id, label: projMap[id] || id })).sort((a, b) => a.label.localeCompare(b.label, 'vi'));
  }, [data?.purchases, projMap]);

  const subOptions = useMemo(() => {
    const src = (data?.subs && data.subs.length) ? data.subs : (data?.partners || []);
    return src.map(s => ({ id: s.id, label: s.code ? `${s.code} — ${s.name}` : s.name, name: s.name })).sort((a, b) => a.label.localeCompare(b.label, 'vi'));
  }, [data?.subs, data?.partners]);

  // Tra mã nhóm vật tư từ danh mục (theo material_id, fallback theo tên)
  const matGroup = useMemo(() => {
    const byId = {}, byName = {};
    for (const m of (data?.materials || [])) {
      if (m.id) byId[m.id] = m.category_code || '';
      if (m.name) byName[norm(m.name)] = m.category_code || '';
    }
    return { byId, byName };
  }, [data?.materials]);

  // Vật tư có thể đề nghị = vật tư đã mua cho dự án đang chọn
  const materialOptions = useMemo(() => {
    if (!header.project_id) return [];
    const m = {};
    for (const p of (data?.purchases || [])) {
      if (p.project_id !== header.project_id) continue;
      const k = norm(p.product_name);
      if (k && !m[k]) m[k] = { id: k, label: p.product_name, unit: p.unit || '', material_id: p.material_id || null, product_name: p.product_name, group: (p.material_id && matGroup.byId[p.material_id]) || matGroup.byName[k] || '' };
    }
    return Object.values(m).sort((a, b) => a.label.localeCompare(b.label, 'vi'));
  }, [data?.purchases, header.project_id, matGroup]);

  const itemsByReq = useMemo(() => {
    const m = {}; for (const it of (data?.reqItems || [])) (m[it.request_id] || (m[it.request_id] = [])).push(it);
    return m;
  }, [data?.reqItems]);

  const setLine = (id, patch) => setLines(ls => ls.map(l => l.id === id ? { ...l, ...patch } : l));
  const addLine = () => setLines(ls => [...ls, emptyLine()]);
  const removeLine = (id) => setLines(ls => ls.length <= 1 ? ls : ls.filter(l => l.id !== id));
  const pickMaterial = (id, mkId) => {
    const mo = materialOptions.find(o => o.id === mkId);
    if (mo) setLine(id, { key: mo.id, product_name: mo.product_name, unit: mo.unit, material_id: mo.material_id, material_group: mo.group || '' });
  };

  const resetForm = () => { setHeader({ project_id: '', subcontractor: null, request_date: today(), notes: '' }); setLines([emptyLine()]); };
  const validLines = lines.filter(l => l.key && Number(l.qty) > 0);
  const canSave = header.project_id && header.subcontractor && validLines.length > 0;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const projLabel = projMap[header.project_id] || 'DA';
      const code = `ĐN-${projLabel}-${today().replace(/-/g, '').slice(2)}-${Math.floor(Math.random() * 900 + 100)}`;
      const { data: req, error } = await supabase.from('material_requests').insert({
        code, project_id: header.project_id, subcontractor_id: header.subcontractor.id,
        subcontractor_name: header.subcontractor.name, request_date: header.request_date, status: 'OPEN',
        notes: header.notes || null, created_by: user?.id,
      }).select('id').single();
      if (error) throw error;
      const items = validLines.map(l => ({ request_id: req.id, material_key: l.key, material_id: l.material_id || null, product_name: l.product_name, unit: l.unit, material_group: l.material_group || null, contract_qty: Number(l.contract_qty) || 0, note: l.note || null, qty_requested: Number(l.qty), qty_issued: 0 }));
      const { error: iErr } = await supabase.from('material_request_items').insert(items);
      if (iErr) throw iErr;
      smartToast('Đã tạo đề nghị vật tư!');
      resetForm(); setCreating(false);
      queryClient.invalidateQueries({ queryKey: ['material-requests'] });
    } catch (err) {
      smartToast('Lỗi tạo đề nghị: ' + (err.message || 'thiếu bảng material_requests? chạy SQL.'));
    } finally { setSaving(false); }
  };

  const requests = (data?.requests || []).filter(r => viewAll || assignedProjects.includes(r.project_id));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{requests.length} đề nghị</p>
        <button onClick={() => setCreating(v => !v)} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow-sm">
          <span className="material-symbols-outlined text-[16px]">{creating ? 'close' : 'add'}</span>{creating ? 'Đóng' : 'Tạo đề nghị'}
        </button>
      </div>

      {data?.reqErr && (
        <div className="text-[12px] text-amber-600 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2">Chưa có bảng <b>material_requests</b> — chạy <b>db/material_requests_issues.sql</b> trên Supabase.</div>
      )}

      {/* Form tạo đề nghị */}
      {creating && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">CÔNG TRÌNH *</label>
              <SearchableSelect options={viewAll ? projectOptions : assignedProjects.map(id => ({ id, label: projMap[id] || id }))} value={header.project_id} onChange={id => { setHeader(h => ({ ...h, project_id: id })); setLines([emptyLine()]); }} placeholder="Chọn công trình..." />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">NHÀ THẦU / TỔ ĐỘI *</label>
              <SearchableSelect options={subOptions} value={header.subcontractor?.id || ''} onChange={id => setHeader(h => ({ ...h, subcontractor: subOptions.find(s => s.id === id) || null }))} placeholder="Chọn nhà thầu..." />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">NGÀY ĐỀ NGHỊ</label>
              <input type="date" value={header.request_date} onChange={e => setHeader(h => ({ ...h, request_date: e.target.value }))} className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700" />
            </div>
          </div>

          <div className="border border-slate-100 dark:border-slate-700 rounded-xl overflow-hidden">
            <table className="w-full text-[12px]">
              <thead className="bg-slate-50 dark:bg-slate-900/40 text-[10px] font-black uppercase text-slate-500">
                <tr>
                  <th className="text-center px-2 py-1.5 w-8">STT</th>
                  <th className="text-left px-2 py-1.5 w-[90px]">Nhóm VT</th>
                  <th className="text-left px-2 py-1.5">Vật tư</th>
                  <th className="text-center px-2 py-1.5 w-[64px]">ĐVT</th>
                  <th className="text-right px-2 py-1.5 w-[104px]">KL hợp đồng</th>
                  <th className="text-right px-2 py-1.5 w-[104px]">SL đề nghị</th>
                  <th className="text-left px-2 py-1.5 w-[150px]">Ghi chú</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={l.id} className="border-t border-slate-100 dark:border-slate-700/40">
                    <td className="px-2 py-1 text-center text-slate-400 tabular-nums">{i + 1}</td>
                    <td className="px-2 py-1 text-slate-500 font-mono text-[11px]">{l.material_group || '—'}</td>
                    <td className="px-2 py-1">
                      <SearchableSelect options={materialOptions} value={l.key} onChange={mk => pickMaterial(l.id, mk)} placeholder={header.project_id ? 'Chọn vật tư (đã mua cho dự án)...' : 'Chọn công trình trước'} />
                    </td>
                    <td className="px-2 py-1 text-center text-slate-500">{l.unit || '—'}</td>
                    <td className="px-2 py-1"><NumberInput value={Number(l.contract_qty) || 0} onChange={v => setLine(l.id, { contract_qty: Number(v) || 0 })} className="w-full text-right tabular-nums text-[12px] border border-slate-200 dark:border-slate-600 rounded-md px-2 py-1 bg-white dark:bg-slate-700" /></td>
                    <td className="px-2 py-1"><NumberInput value={Number(l.qty) || 0} onChange={v => setLine(l.id, { qty: Number(v) || 0 })} className="w-full text-right tabular-nums text-[12px] font-semibold border border-slate-200 dark:border-slate-600 rounded-md px-2 py-1 bg-white dark:bg-slate-700" /></td>
                    <td className="px-2 py-1"><input type="text" value={l.note || ''} onChange={e => setLine(l.id, { note: e.target.value })} placeholder="—" className="w-full text-[12px] border border-slate-200 dark:border-slate-600 rounded-md px-2 py-1 bg-white dark:bg-slate-700" /></td>
                    <td className="px-1 py-1 text-center"><button onClick={() => removeLine(l.id)} className="text-slate-300 hover:text-rose-500"><span className="material-symbols-outlined text-[15px]">close</span></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button onClick={addLine} className="w-full py-2 text-[13px] font-bold text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700/40 border-t border-slate-100 dark:border-slate-700 flex items-center justify-center gap-1"><span className="material-symbols-outlined text-[16px]">add</span>Thêm vật tư</button>
          </div>

          <div className="flex items-center gap-3">
            <input type="text" value={header.notes} onChange={e => setHeader(h => ({ ...h, notes: e.target.value }))} placeholder="Ghi chú..." className="flex-1 text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700" />
            <button onClick={save} disabled={saving || !canSave} className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-lg text-sm font-bold whitespace-nowrap">{saving ? 'Đang lưu...' : 'Lưu đề nghị'}</button>
          </div>
        </div>
      )}

      {/* Danh sách đề nghị */}
      <div className="space-y-2">
        {requests.length === 0 ? (
          <div className="p-10 text-center text-slate-400 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">Chưa có đề nghị nào.</div>
        ) : requests.map(r => {
          const items = itemsByReq[r.id] || [];
          const totalReq = items.reduce((s, it) => s + Number(it.qty_requested || 0), 0);
          const totalIss = items.reduce((s, it) => s + Number(it.qty_issued || 0), 0);
          const done = totalReq > 0 && totalIss >= totalReq;
          return (
            <div key={r.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-black text-slate-800 dark:text-white">{r.code || 'Đề nghị'}</span>
                    <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full ${done ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30' : 'bg-amber-50 text-amber-600 dark:bg-amber-900/30'}`}>{done ? 'Đã xuất đủ' : 'Còn phải xuất'}</span>
                  </div>
                  <div className="text-[12px] text-slate-500 mt-0.5">{projMap[r.project_id] || '—'} · <span className="uppercase">{r.subcontractor_name || '—'}</span> · {r.request_date ? new Date(r.request_date).toLocaleDateString('vi-VN') : ''} · {items.length} vật tư</div>
                </div>
                {onIssue && !done && (
                  <button onClick={() => onIssue({ ...r, projectLabel: projMap[r.project_id] || 'DA' })} className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[12px] font-bold flex items-center gap-1.5"><span className="material-symbols-outlined text-[15px]">logout</span>Xuất kho</button>
                )}
              </div>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead><tr className="text-[10px] font-bold uppercase text-slate-400 border-b border-slate-100 dark:border-slate-700">
                    <th className="text-center py-1.5 w-8">STT</th>
                    <th className="text-left py-1.5 w-[80px]">Nhóm VT</th>
                    <th className="text-left py-1.5">Vật tư</th>
                    <th className="text-center py-1.5">ĐVT</th>
                    <th className="text-right py-1.5">KL HĐ</th>
                    <th className="text-right py-1.5">SL đề nghị</th>
                    <th className="text-right py-1.5">Đã xuất</th>
                    <th className="text-right py-1.5">Còn lại</th>
                    <th className="text-left py-1.5 pl-3">Ghi chú</th>
                  </tr></thead>
                  <tbody>
                    {items.map((it, i) => (
                      <tr key={it.id} className="border-b border-slate-50 dark:border-slate-700/30">
                        <td className="py-1.5 text-center text-slate-400 tabular-nums">{i + 1}</td>
                        <td className="py-1.5 text-slate-500 font-mono text-[11px]">{it.material_group || '—'}</td>
                        <td className="py-1.5 text-slate-700 dark:text-slate-200">{it.product_name}</td>
                        <td className="py-1.5 text-center text-slate-500">{it.unit}</td>
                        <td className="py-1.5 text-right tabular-nums text-slate-400">{it.contract_qty ? qtyFmt(it.contract_qty) : '—'}</td>
                        <td className="py-1.5 text-right tabular-nums">{qtyFmt(it.qty_requested)}</td>
                        <td className="py-1.5 text-right tabular-nums text-emerald-600">{qtyFmt(it.qty_issued)}</td>
                        <td className="py-1.5 text-right tabular-nums font-bold text-rose-600">{qtyFmt(Number(it.qty_requested) - Number(it.qty_issued))}</td>
                        <td className="py-1.5 pl-3 text-slate-400 text-[11px]">{it.note || ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
