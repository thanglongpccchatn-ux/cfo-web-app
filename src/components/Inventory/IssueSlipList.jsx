import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { fmt } from '../../utils/formatters';
import { useInventoryScope } from './useInventoryScope';
import { printIssueSlip } from './inventoryPrint';

const money = (v) => fmt(Math.round(Number(v) || 0));
const norm = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

async function fetchAll(table, select, order) {
  const CHUNK = 1000; const all = [];
  for (let from = 0; ; from += CHUNK) {
    let qy = supabase.from(table).select(select).range(from, from + CHUNK - 1);
    if (order) qy = qy.order(order, { ascending: false });
    const { data, error } = await qy;
    if (error) return all;
    all.push(...(data || []));
    if (!data || data.length < CHUNK) break;
  }
  return all;
}

export default function IssueSlipList() {
  const { showPrice, viewAll, assignedProjects, defaultProject } = useInventoryScope();
  const [q, setQ] = useState('');
  const [projectId, setProjectId] = useState(viewAll ? '' : defaultProject);
  const effectiveProject = viewAll ? projectId : (assignedProjects.includes(projectId) ? projectId : defaultProject);

  const { data, isLoading } = useQuery({
    queryKey: ['issue-slips'],
    queryFn: async () => {
      const [issues, projs] = await Promise.all([
        fetchAll('material_issues', 'id, slip_code, project_id, subcontractor_name, issue_date, product_name, unit, quantity, unit_price, notes, created_at', 'issue_date'),
        fetchAll('projects', 'id, internal_code, code, name'),
      ]);
      return { issues, projects: projs };
    },
  });

  const projMap = useMemo(() => Object.fromEntries((data?.projects || []).map(p => [p.id, p.internal_code || p.code || p.name])), [data?.projects]);

  const slips = useMemo(() => {
    const m = {};
    for (const it of (data?.issues || [])) {
      const key = it.slip_code || `le:${it.id}`;
      if (!m[key]) m[key] = {
        code: it.slip_code || '(xuất lẻ)', key, project_id: it.project_id, projectLabel: projMap[it.project_id] || '—',
        subcontractor_name: it.subcontractor_name || '', issue_date: it.issue_date, notes: it.notes, lines: [], total: 0,
      };
      const s = m[key];
      s.lines.push({ product_name: it.product_name, unit: it.unit, quantity: Number(it.quantity) || 0, unit_price: Number(it.unit_price) || 0 });
      s.total += (Number(it.quantity) || 0) * (Number(it.unit_price) || 0);
    }
    return Object.values(m).sort((a, b) => new Date(b.issue_date) - new Date(a.issue_date));
  }, [data?.issues, projMap]);

  const projectOptions = useMemo(() => {
    const ids = [...new Set(slips.map(s => s.project_id).filter(Boolean))];
    return ids.map(id => ({ id, label: projMap[id] || id })).sort((a, b) => a.label.localeCompare(b.label, 'vi'));
  }, [slips, projMap]);

  const filtered = useMemo(() => {
    const kw = norm(q.trim());
    return slips
      .filter(s => (viewAll || assignedProjects.includes(s.project_id)) && (!effectiveProject || s.project_id === effectiveProject))
      .filter(s => !kw || norm(`${s.code} ${s.subcontractor_name}`).includes(kw));
  }, [slips, effectiveProject, q, viewAll, assignedProjects]);

  const grandTotal = filtered.reduce((s, x) => s + x.total, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-900/15 border border-rose-100 dark:border-rose-900/30">
          <span className="material-symbols-outlined text-rose-500 text-[20px]">receipt_long</span>
          <span className="text-[13px] font-bold text-slate-600 dark:text-slate-300">{filtered.length} phiếu{showPrice ? ' · Tổng xuất' : ''}</span>
          {showPrice && <span className="font-mono font-black text-rose-600 text-[15px]">{money(grandTotal)}đ</span>}
        </div>
        <select value={effectiveProject} onChange={e => setProjectId(e.target.value)} className="text-sm font-bold border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700">
          {viewAll && <option value="">Tất cả công trình</option>}
          {(viewAll ? projectOptions : assignedProjects.map(id => ({ id, label: projMap[id] || id }))).map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        <div className="relative flex-1 min-w-[200px] max-w-[300px]">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[16px] text-slate-400">search</span>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Tìm số phiếu / nhà thầu..." className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg pl-9 pr-3 py-2 bg-white dark:bg-slate-700" />
        </div>
      </div>

      {isLoading ? (
        <div className="p-10 text-center text-slate-400 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">Đang tải phiếu xuất...</div>
      ) : filtered.length === 0 ? (
        <div className="p-10 text-center text-slate-400 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
          <span className="material-symbols-outlined text-4xl mb-2 block">receipt_long</span>Chưa có phiếu xuất nào.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(s => (
            <div key={s.key} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-black text-slate-800 dark:text-white">{s.code}</div>
                  <div className="text-[12px] text-slate-500 mt-0.5">{s.projectLabel} · <span className="uppercase">{s.subcontractor_name || '—'}</span> · {s.issue_date ? new Date(s.issue_date).toLocaleDateString('vi-VN') : ''} · {s.lines.length} vật tư</div>
                </div>
                {showPrice && (
                  <div className="text-right shrink-0">
                    <div className="text-[10px] font-bold uppercase text-slate-400">Giá trị</div>
                    <div className="font-mono font-black text-rose-600">{money(s.total)}</div>
                  </div>
                )}
                <button onClick={() => printIssueSlip(s, !showPrice)} className="px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-[12px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-1.5 shrink-0">
                  <span className="material-symbols-outlined text-[15px]">print</span>In lại
                </button>
              </div>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead><tr className="text-[10.5px] font-bold uppercase text-slate-400 border-b border-slate-100 dark:border-slate-700"><th className="text-left py-1.5">Vật tư</th><th className="text-center py-1.5">ĐVT</th><th className="text-right py-1.5">SL</th>{showPrice && <th className="text-right py-1.5">Đơn giá</th>}{showPrice && <th className="text-right py-1.5">Thành tiền</th>}</tr></thead>
                  <tbody>
                    {s.lines.map((l, i) => (
                      <tr key={i} className="border-b border-slate-50 dark:border-slate-700/30">
                        <td className="py-1.5 text-slate-700 dark:text-slate-200">{l.product_name}</td>
                        <td className="py-1.5 text-center text-slate-500 text-[12px]">{l.unit}</td>
                        <td className="py-1.5 text-right tabular-nums">{l.quantity.toLocaleString('vi-VN')}</td>
                        {showPrice && <td className="py-1.5 text-right tabular-nums text-slate-500">{money(l.unit_price)}</td>}
                        {showPrice && <td className="py-1.5 text-right tabular-nums font-semibold">{money(l.quantity * l.unit_price)}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
