import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { smartToast } from '../../utils/globalToast';
import { fmt } from '../../utils/formatters';

// KHO VẬT TƯ = Nhập (tự động từ supplier_purchases) − Xuất (material_issues) − Tồn, theo dự án.
// Khớp vật tư theo TÊN chuẩn hoá (hàng import thường thiếu material_id).

const norm = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim().replace(/\s+/g, ' ');
const today = () => new Date().toISOString().slice(0, 10);
const money = (v) => fmt(Math.round(Number(v) || 0));
const qtyFmt = (v) => { const n = Number(v) || 0; return Number.isInteger(n) ? n.toLocaleString('vi-VN') : n.toLocaleString('vi-VN', { maximumFractionDigits: 2 }); };

async function fetchAll(table, select) {
  const CHUNK = 1000; const all = [];
  for (let from = 0; ; from += CHUNK) {
    const { data, error } = await supabase.from(table).select(select).range(from, from + CHUNK - 1);
    if (error) return { rows: all, error };
    all.push(...(data || []));
    if (!data || data.length < CHUNK) break;
  }
  return { rows: all, error: null };
}

/* ── Modal xuất kho (module-level: tránh mất focus) ── */
function IssueModal({ row, onClose, onSaved, userId }) {
  const [qty, setQty] = useState('');
  const [date, setDate] = useState(today());
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  if (!row) return null;
  const amt = Number(qty) || 0;

  const save = async () => {
    if (!(amt > 0)) { smartToast('Nhập số lượng xuất > 0'); return; }
    if (amt > row.ton + 0.0001) { if (!window.confirm(`Xuất ${qtyFmt(amt)} > tồn ${qtyFmt(row.ton)}. Vẫn xuất?`)) return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('material_issues').insert({
        project_id: row.project_id, material_id: row.material_id || null, material_key: row.material_key,
        product_name: row.product_name, unit: row.unit, quantity: amt, unit_price: Math.round(row.avgPrice),
        issue_date: date, notes: notes || null, created_by: userId,
      });
      if (error) throw error;
      smartToast('Đã xuất kho!');
      onSaved();
    } catch (err) {
      smartToast('Lỗi xuất kho: ' + (err.message || 'thiếu bảng material_issues? chạy db/material_issues.sql.'));
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
          <h3 className="font-black text-slate-800 dark:text-white flex items-center gap-2"><span className="material-symbols-outlined text-rose-500">logout</span>Xuất kho</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><span className="material-symbols-outlined">close</span></button>
        </div>
        <div className="p-5 space-y-3">
          <div className="text-sm">
            <div className="font-bold text-slate-800 dark:text-white">{row.product_name}</div>
            <div className="text-[12px] text-slate-500">{row.projectLabel} · Tồn hiện tại: <b className="text-blue-600">{qtyFmt(row.ton)} {row.unit}</b> · Đơn giá BQ {money(row.avgPrice)}đ</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">SỐ LƯỢNG XUẤT *</label>
              <input type="number" value={qty} onChange={e => setQty(e.target.value)} min="0" placeholder="0" autoFocus
                className="w-full text-right font-mono text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">NGÀY XUẤT</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700" />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">GHI CHÚ</label>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="VD: xuất cho tổ thi công..."
              className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700" />
          </div>
          {amt > 0 && <div className="text-[12px] text-slate-500">Giá trị xuất ước tính: <b className="font-mono">{money(amt * row.avgPrice)}đ</b></div>}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100 dark:border-slate-700">
          <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">Hủy</button>
          <button onClick={save} disabled={saving || !(amt > 0)} className="px-5 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white rounded-lg text-sm font-bold">{saving ? 'Đang xuất...' : 'Xuất kho'}</button>
        </div>
      </div>
    </div>
  );
}

export default function ProjectStock() {
  const { user, hasPermission, profile } = useAuth();
  const queryClient = useQueryClient();
  const canIssue = profile?.role_code === 'ROLE01' || hasPermission('export_inventory') || hasPermission('manage_materials') || hasPermission('manage_materials_tracking');

  const [projectId, setProjectId] = useState('');
  const [q, setQ] = useState('');
  const [issueRow, setIssueRow] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['project-stock'],
    queryFn: async () => {
      const [purch, projs, issues] = await Promise.all([
        fetchAll('supplier_purchases', 'project_id, product_name, material_id, quantity, unit, unit_price, total_amount'),
        fetchAll('projects', 'id, internal_code, code, name'),
        fetchAll('material_issues', 'project_id, material_key, quantity, unit_price'),
      ]);
      return { purchases: purch.rows, projects: projs.rows, issues: issues.rows, issuesErr: issues.error };
    },
  });

  const projMap = useMemo(() => {
    const m = {}; for (const p of (data?.projects || [])) m[p.id] = p.internal_code || p.code || p.name;
    return m;
  }, [data?.projects]);

  const projectOptions = useMemo(() => {
    const ids = [...new Set((data?.purchases || []).map(p => p.project_id).filter(Boolean))];
    return ids.map(id => ({ id, label: projMap[id] || id })).sort((a, b) => a.label.localeCompare(b.label, 'vi'));
  }, [data?.purchases, projMap]);

  // Gom Nhập theo (dự án, vật tư) + trừ Xuất -> Tồn
  const rows = useMemo(() => {
    const map = {};
    for (const p of (data?.purchases || [])) {
      const mk = norm(p.product_name);
      if (!mk) continue;
      const key = `${p.project_id || 'none'}::${mk}`;
      if (!map[key]) map[key] = {
        key, project_id: p.project_id, projectLabel: projMap[p.project_id] || '—',
        material_key: mk, product_name: p.product_name, unit: p.unit || '', material_id: p.material_id || null,
        nhapQty: 0, nhapValue: 0, xuatQty: 0,
      };
      const r = map[key];
      r.nhapQty += Number(p.quantity) || 0;
      r.nhapValue += Number(p.total_amount) || (Number(p.quantity) || 0) * (Number(p.unit_price) || 0);
      if (!r.material_id && p.material_id) r.material_id = p.material_id;
    }
    for (const iss of (data?.issues || [])) {
      const key = `${iss.project_id || 'none'}::${iss.material_key}`;
      if (map[key]) map[key].xuatQty += Number(iss.quantity) || 0;
    }
    return Object.values(map).map(r => {
      const avgPrice = r.nhapQty > 0 ? r.nhapValue / r.nhapQty : 0;
      const ton = r.nhapQty - r.xuatQty;
      return { ...r, avgPrice, ton, tonValue: ton * avgPrice };
    });
  }, [data?.purchases, data?.issues, projMap]);

  const filtered = useMemo(() => {
    const kw = norm(q);
    return rows
      .filter(r => (!projectId || r.project_id === projectId))
      .filter(r => !kw || norm(r.product_name).includes(kw))
      .sort((a, b) => b.tonValue - a.tonValue);
  }, [rows, projectId, q]);

  const totalTonValue = filtered.reduce((s, r) => s + r.tonValue, 0);
  const totalNhap = filtered.reduce((s, r) => s + r.nhapValue, 0);

  const onSaved = () => { setIssueRow(null); queryClient.invalidateQueries({ queryKey: ['project-stock'] }); };

  return (
    <div className="space-y-4">
      {/* Thanh tổng + lọc */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-900/15 border border-blue-100 dark:border-blue-900/30">
          <span className="material-symbols-outlined text-blue-500 text-[20px]">inventory_2</span>
          <span className="text-[13px] font-bold text-slate-600 dark:text-slate-300">Giá trị tồn kho</span>
          <span className="font-mono font-black text-blue-700 dark:text-blue-400 text-[16px]">{money(totalTonValue)}đ</span>
          <span className="text-[11px] text-slate-400 ml-1">· {filtered.length} vật tư · đã nhập {money(totalNhap)}đ</span>
        </div>
        <select value={projectId} onChange={e => setProjectId(e.target.value)}
          className="text-sm font-bold border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700">
          <option value="">Tất cả công trình</option>
          {projectOptions.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        <div className="relative flex-1 min-w-[200px] max-w-[300px]">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[16px] text-slate-400">search</span>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Tìm vật tư..."
            className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg pl-9 pr-3 py-2 bg-white dark:bg-slate-700" />
        </div>
      </div>

      {data?.issuesErr && (
        <div className="text-[12px] text-amber-600 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2">
          Chưa có bảng <b>material_issues</b> — Xuất kho chưa hoạt động. Chạy <b>db/material_issues.sql</b> trên Supabase (Tồn hiện tính = Đã nhập).
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-auto max-h-[70vh]">
        {isLoading ? (
          <div className="p-10 text-center text-slate-400">Đang tải tồn kho...</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-slate-400">
            <span className="material-symbols-outlined text-4xl mb-2 block">inventory_2</span>
            {q || projectId ? 'Không có vật tư khớp lọc.' : 'Chưa có dữ liệu nhập kho (từ mua hàng).'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-900 text-[11px] font-black uppercase tracking-wider text-slate-500">
              <tr>
                <th className="text-left py-2.5 px-3">Công trình</th>
                <th className="text-left py-2.5 px-3">Vật tư</th>
                <th className="text-center py-2.5 px-3">ĐVT</th>
                <th className="text-right py-2.5 px-3">Đã nhập</th>
                <th className="text-right py-2.5 px-3">Đã xuất</th>
                <th className="text-right py-2.5 px-3">Tồn</th>
                <th className="text-right py-2.5 px-3">Đơn giá BQ</th>
                <th className="text-right py-2.5 px-3">Giá trị tồn</th>
                {canIssue && <th className="py-2.5 px-3 w-[90px]"></th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.key} className="border-t border-slate-100 dark:border-slate-700/40 hover:bg-slate-50/60 dark:hover:bg-slate-700/20">
                  <td className="py-2 px-3 text-slate-500 text-[12px] whitespace-nowrap">{r.projectLabel}</td>
                  <td className="py-2 px-3 font-semibold text-slate-800 dark:text-white">{r.product_name}</td>
                  <td className="py-2 px-3 text-center text-slate-500 text-[12px]">{r.unit}</td>
                  <td className="py-2 px-3 text-right tabular-nums text-slate-600 dark:text-slate-300">{qtyFmt(r.nhapQty)}</td>
                  <td className="py-2 px-3 text-right tabular-nums text-rose-500">{qtyFmt(r.xuatQty)}</td>
                  <td className="py-2 px-3 text-right tabular-nums font-bold text-blue-700 dark:text-blue-400">{qtyFmt(r.ton)}</td>
                  <td className="py-2 px-3 text-right tabular-nums text-slate-500">{money(r.avgPrice)}</td>
                  <td className="py-2 px-3 text-right tabular-nums font-black text-slate-800 dark:text-white">{money(r.tonValue)}</td>
                  {canIssue && (
                    <td className="py-2 px-3 text-center">
                      <button onClick={() => setIssueRow(r)} disabled={r.ton <= 0}
                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white rounded-lg text-[12px] font-bold">Xuất</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot className="sticky bottom-0 bg-slate-50 dark:bg-slate-900/60">
              <tr className="border-t-2 border-slate-200 dark:border-slate-700">
                <td className="py-3 px-3 font-black text-slate-700 dark:text-white uppercase text-[11px]" colSpan={7}>Tổng giá trị tồn</td>
                <td className="py-3 px-3 text-right font-mono font-black text-blue-700 dark:text-blue-400">{money(totalTonValue)}</td>
                {canIssue && <td></td>}
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      <p className="text-[11px] text-slate-400">
        Nhập kho tự động từ <b>Mua hàng & Công nợ NCC</b> (mỗi lần mua = nhập kho dự án). Xuất kho ghi tại đây. Tồn = Nhập − Xuất; khớp vật tư theo tên.
      </p>

      <IssueModal row={issueRow} onClose={() => setIssueRow(null)} onSaved={onSaved} userId={user?.id} />
    </div>
  );
}
