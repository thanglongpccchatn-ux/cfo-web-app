import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { fmt } from '../../utils/formatters';
import { useInventoryScope } from './useInventoryScope';
import { exportToExcel } from '../../utils/exportExcel';

const money = (v) => fmt(Math.round(Number(v) || 0));
const qtyFmt = (v) => { const n = Number(v) || 0; return Number.isInteger(n) ? n.toLocaleString('vi-VN') : n.toLocaleString('vi-VN', { maximumFractionDigits: 2 }); };
const norm = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim().replace(/\s+/g, ' ');
const yearStart = () => `${new Date().getFullYear()}-01-01`;
const today = () => new Date().toISOString().slice(0, 10);

async function fetchAll(table, select) {
  const CHUNK = 1000; const all = [];
  for (let from = 0; ; from += CHUNK) {
    const { data, error } = await supabase.from(table).select(select).range(from, from + CHUNK - 1);
    if (error) return all;
    all.push(...(data || []));
    if (!data || data.length < CHUNK) break;
  }
  return all;
}

export default function InventoryReport() {
  const { showPrice, viewAll, assignedProjects, defaultProject } = useInventoryScope();
  const [from, setFrom] = useState(yearStart());
  const [to, setTo] = useState(today());
  const [projectId, setProjectId] = useState(viewAll ? '' : defaultProject);
  const [q, setQ] = useState('');
  const effectiveProject = viewAll ? projectId : (assignedProjects.includes(projectId) ? projectId : defaultProject);

  const { data, isLoading } = useQuery({
    queryKey: ['inv-report'],
    queryFn: async () => {
      const [purch, issues, projs] = await Promise.all([
        fetchAll('supplier_purchases_v', 'project_id, product_name, quantity, unit, unit_price, total_amount, purchase_date'),
        fetchAll('material_issues_v', 'project_id, material_key, product_name, unit, quantity, unit_price, issue_date'),
        fetchAll('projects', 'id, internal_code, code, name'),
      ]);
      return { purch, issues, projs };
    },
  });

  const projMap = useMemo(() => Object.fromEntries((data?.projs || []).map(p => [p.id, p.internal_code || p.code || p.name])), [data?.projs]);
  const projectOptions = useMemo(() => {
    const ids = [...new Set((data?.purch || []).map(p => p.project_id).filter(Boolean))];
    return ids.map(id => ({ id, label: projMap[id] || id })).sort((a, b) => a.label.localeCompare(b.label, 'vi'));
  }, [data?.purch, projMap]);

  const rows = useMemo(() => {
    const m = {};
    const get = (pid, name, unit) => {
      const mk = norm(name); const key = `${pid || 'none'}::${mk}`;
      if (!m[key]) m[key] = { project_id: pid, projectLabel: projMap[pid] || '—', product_name: name, unit: unit || '',
        nhapAllQty: 0, nhapAllVal: 0, nhapBeforeQty: 0, nhapInQty: 0, nhapInVal: 0, xuatBeforeQty: 0, xuatInQty: 0, xuatInVal: 0 };
      return m[key];
    };
    for (const p of (data?.purch || [])) {
      const r = get(p.project_id, p.product_name, p.unit);
      const qv = Number(p.quantity) || 0;
      const vv = Number(p.total_amount) || qv * (Number(p.unit_price) || 0);
      r.nhapAllQty += qv; r.nhapAllVal += vv;
      const d = p.purchase_date || '';
      if (d && d < from) r.nhapBeforeQty += qv;
      else if (d && d >= from && d <= to) { r.nhapInQty += qv; r.nhapInVal += vv; }
    }
    for (const it of (data?.issues || [])) {
      const r = get(it.project_id, it.product_name, it.unit);
      const qv = Number(it.quantity) || 0;
      const vv = qv * (Number(it.unit_price) || 0);
      const d = it.issue_date || '';
      if (d && d < from) r.xuatBeforeQty += qv;
      else if (d && d >= from && d <= to) { r.xuatInQty += qv; r.xuatInVal += vv; }
    }
    return Object.values(m).map(r => {
      const avg = r.nhapAllQty > 0 ? r.nhapAllVal / r.nhapAllQty : 0;
      const tonDau = r.nhapBeforeQty - r.xuatBeforeQty;
      const tonCuoi = tonDau + r.nhapInQty - r.xuatInQty;
      return { ...r, avg, tonDau, tonCuoi, tonCuoiVal: tonCuoi * avg };
    }).filter(r => r.tonDau !== 0 || r.nhapInQty !== 0 || r.xuatInQty !== 0 || r.tonCuoi !== 0);
  }, [data?.purch, data?.issues, projMap, from, to]);

  const filtered = useMemo(() => {
    const kw = norm(q);
    return rows
      .filter(r => (viewAll || assignedProjects.includes(r.project_id)) && (!effectiveProject || r.project_id === effectiveProject))
      .filter(r => !kw || norm(r.product_name).includes(kw))
      .sort((a, b) => b.tonCuoiVal - a.tonCuoiVal);
  }, [rows, effectiveProject, q, viewAll, assignedProjects]);

  const totals = useMemo(() => filtered.reduce((t, r) => ({
    nhap: t.nhap + r.nhapInVal, xuat: t.xuat + r.xuatInVal, ton: t.ton + r.tonCuoiVal,
  }), { nhap: 0, xuat: 0, ton: 0 }), [filtered]);

  const doExport = () => {
    const columns = [
      { key: 'Công trình', label: 'Công trình' }, { key: 'Vật tư', label: 'Vật tư' }, { key: 'ĐVT', label: 'ĐVT' },
      { key: 'Tồn đầu', label: 'Tồn đầu', format: 'number' }, { key: 'Nhập', label: 'Nhập', format: 'number' },
      { key: 'Xuất', label: 'Xuất', format: 'number' }, { key: 'Tồn cuối', label: 'Tồn cuối', format: 'number' },
      ...(showPrice ? [{ key: 'Đơn giá BQ', label: 'Đơn giá BQ', format: 'number' }, { key: 'Giá trị tồn cuối', label: 'Giá trị tồn cuối', format: 'number' }] : []),
    ];
    const rowsX = filtered.map(r => ({
      'Công trình': r.projectLabel, 'Vật tư': r.product_name, 'ĐVT': r.unit,
      'Tồn đầu': r.tonDau, 'Nhập': r.nhapInQty, 'Xuất': r.xuatInQty, 'Tồn cuối': r.tonCuoi,
      ...(showPrice ? { 'Đơn giá BQ': Math.round(r.avg), 'Giá trị tồn cuối': Math.round(r.tonCuoiVal) } : {}),
    }));
    exportToExcel(rowsX, columns, `BaoCao_NXT_${from}_${to}`, 'NXT');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-[11px] font-bold text-slate-500">TỪ</span>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-700" />
          <span className="text-[11px] font-bold text-slate-500">ĐẾN</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className="text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-700" />
        </div>
        <select value={effectiveProject} onChange={e => setProjectId(e.target.value)} className="text-sm font-bold border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700">
          {viewAll && <option value="">Tất cả công trình</option>}
          {(viewAll ? projectOptions : assignedProjects.map(id => ({ id, label: projMap[id] || id }))).map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        <div className="relative flex-1 min-w-[160px] max-w-[240px]">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[16px] text-slate-400">search</span>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Tìm vật tư..." className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg pl-9 pr-3 py-2 bg-white dark:bg-slate-700" />
        </div>
        <div className="flex-1" />
        <button onClick={doExport} disabled={!filtered.length} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-lg text-sm font-bold flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[16px]">download</span>Xuất Excel
        </button>
      </div>

      {showPrice && (
        <div className="flex flex-wrap gap-3 text-[13px]">
          <span className="px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/15 font-bold text-blue-700">Nhập kỳ: {money(totals.nhap)}đ</span>
          <span className="px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-900/15 font-bold text-rose-700">Xuất kỳ: {money(totals.xuat)}đ</span>
          <span className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-200">Giá trị tồn cuối: {money(totals.ton)}đ</span>
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-auto max-h-[66vh]">
        {isLoading ? (
          <div className="p-10 text-center text-slate-400">Đang tính báo cáo...</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-slate-400"><span className="material-symbols-outlined text-4xl mb-2 block">assessment</span>Không có dữ liệu trong kỳ.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-900 text-[11px] font-black uppercase tracking-wider text-slate-500">
              <tr>
                <th className="text-left py-2.5 px-3">Công trình</th>
                <th className="text-left py-2.5 px-3">Vật tư</th>
                <th className="text-center py-2.5 px-2">ĐVT</th>
                <th className="text-right py-2.5 px-2">Tồn đầu</th>
                <th className="text-right py-2.5 px-2">Nhập</th>
                <th className="text-right py-2.5 px-2">Xuất</th>
                <th className="text-right py-2.5 px-2">Tồn cuối</th>
                {showPrice && <th className="text-right py-2.5 px-2">Đơn giá BQ</th>}
                {showPrice && <th className="text-right py-2.5 px-3">Giá trị tồn cuối</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={i} className="border-t border-slate-100 dark:border-slate-700/40 hover:bg-slate-50/60 dark:hover:bg-slate-700/20">
                  <td className="py-2 px-3 text-slate-500 text-[12px] whitespace-nowrap">{r.projectLabel}</td>
                  <td className="py-2 px-3 font-semibold text-slate-800 dark:text-white">{r.product_name}</td>
                  <td className="py-2 px-2 text-center text-slate-500 text-[12px]">{r.unit}</td>
                  <td className="py-2 px-2 text-right tabular-nums text-slate-500">{qtyFmt(r.tonDau)}</td>
                  <td className="py-2 px-2 text-right tabular-nums text-blue-600">{qtyFmt(r.nhapInQty)}</td>
                  <td className="py-2 px-2 text-right tabular-nums text-rose-500">{qtyFmt(r.xuatInQty)}</td>
                  <td className="py-2 px-2 text-right tabular-nums font-bold text-slate-800 dark:text-white">{qtyFmt(r.tonCuoi)}</td>
                  {showPrice && <td className="py-2 px-2 text-right tabular-nums text-slate-500">{money(r.avg)}</td>}
                  {showPrice && <td className="py-2 px-3 text-right tabular-nums font-black">{money(r.tonCuoiVal)}</td>}
                </tr>
              ))}
            </tbody>
            {showPrice && (
              <tfoot className="sticky bottom-0 bg-slate-50 dark:bg-slate-900/60">
                <tr className="border-t-2 border-slate-200 dark:border-slate-700 font-black">
                  <td className="py-3 px-3 uppercase text-[11px] text-slate-500" colSpan={8}>Tổng giá trị tồn cuối</td>
                  <td className="py-3 px-3 text-right font-mono text-slate-800 dark:text-white">{money(totals.ton)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        )}
      </div>
    </div>
  );
}
