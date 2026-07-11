import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { smartToast } from '../../utils/globalToast';
import { fmt } from '../../utils/formatters';
import { useAuth } from '../../context/AuthContext';
import NumberInput from '../common/NumberInput';
import { printIssueSlip } from './inventoryPrint';

const norm = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim().replace(/\s+/g, ' ');
const today = () => new Date().toISOString().slice(0, 10);
const money = (v) => fmt(Math.round(Number(v) || 0));
const qtyFmt = (v) => { const n = Number(v) || 0; return Number.isInteger(n) ? n.toLocaleString('vi-VN') : n.toLocaleString('vi-VN', { maximumFractionDigits: 2 }); };

async function fetchAll(table, select, filterCol, filterVal) {
  const CHUNK = 1000; const all = [];
  for (let from = 0; ; from += CHUNK) {
    let qy = supabase.from(table).select(select).range(from, from + CHUNK - 1);
    if (filterCol) qy = qy.eq(filterCol, filterVal);
    const { data, error } = await qy;
    if (error) return { rows: all, error };
    all.push(...(data || []));
    if (!data || data.length < CHUNK) break;
  }
  return { rows: all, error: null };
}

export default function MaterialIssue({ request, onBack }) {
  const queryClient = useQueryClient();
  const { profile, hasPermission } = useAuth();
  const showPrice = profile?.role_code === 'ROLE01' || profile?.role_code === 'ADMIN' || hasPermission('view_material_price');
  const [issueDate, setIssueDate] = useState(today());
  const [notes, setNotes] = useState('');
  const [drafts, setDrafts] = useState({});   // request_item_id -> qty
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['issue-request', request?.id],
    enabled: !!request?.id,
    queryFn: async () => {
      const [items, purch, issues] = await Promise.all([
        fetchAll('material_request_items', '*', 'request_id', request.id),
        fetchAll('supplier_purchases', 'product_name, quantity, unit_price, total_amount', 'project_id', request.project_id),
        fetchAll('material_issues', 'material_key, quantity', 'project_id', request.project_id),
      ]);
      return { items: items.rows, purchases: purch.rows, issues: issues.rows };
    },
  });

  // Tồn (nhập − xuất) + đơn giá BQ (giá trị nhập / SL nhập) theo material_key
  const stock = useMemo(() => {
    const m = {};
    for (const p of (data?.purchases || [])) {
      const k = norm(p.product_name); if (!k) continue;
      const r = m[k] || (m[k] = { nhapQty: 0, nhapVal: 0, xuatQty: 0 });
      r.nhapQty += Number(p.quantity) || 0;
      r.nhapVal += Number(p.total_amount) || (Number(p.quantity) || 0) * (Number(p.unit_price) || 0);
    }
    for (const iss of (data?.issues || [])) { const r = m[iss.material_key]; if (r) r.xuatQty += Number(iss.quantity) || 0; }
    const out = {};
    for (const [k, r] of Object.entries(m)) out[k] = { ton: r.nhapQty - r.xuatQty, avg: r.nhapQty > 0 ? r.nhapVal / r.nhapQty : 0 };
    return out;
  }, [data?.purchases, data?.issues]);

  const rows = useMemo(() => (data?.items || []).map(it => {
    const remain = Number(it.qty_requested) - Number(it.qty_issued);
    const st = stock[it.material_key] || { ton: 0, avg: 0 };
    const qty = it.id in drafts ? drafts[it.id] : Math.max(0, Math.min(remain, st.ton));
    return { ...it, remain, ton: st.ton, avg: st.avg, qty };
  }), [data?.items, stock, drafts]);

  const setQty = (id, v) => setDrafts(d => ({ ...d, [id]: Number(v) || 0 }));
  const validRows = rows.filter(r => Number(r.qty) > 0);
  const totalVal = validRows.reduce((s, r) => s + r.qty * r.avg, 0);

  const save = async () => {
    if (!validRows.length) { smartToast('Nhập SL xuất > 0 cho ít nhất 1 dòng'); return; }
    const over = validRows.find(r => r.qty > r.ton + 0.0001);
    if (over && !window.confirm(`"${over.product_name}" xuất ${qtyFmt(over.qty)} > tồn ${qtyFmt(over.ton)}. Vẫn xuất?`)) return;
    setSaving(true);
    try {
      const code = `PX-${request.projectLabel || 'DA'}-${today().replace(/-/g, '').slice(2)}-${Math.floor(Math.random() * 900 + 100)}`;
      const lines = validRows.map(r => ({ request_item_id: r.id, material_id: r.material_id || '', material_key: r.material_key, product_name: r.product_name, unit: r.unit, quantity: r.qty, unit_price: Math.round(r.avg) }));
      const { error } = await supabase.rpc('issue_from_request', {
        p_request_id: request.id, p_slip_code: code, p_subcontractor_id: request.subcontractor_id || null,
        p_subcontractor_name: request.subcontractor_name || '', p_issue_date: issueDate, p_notes: notes || null, p_lines: lines,
      });
      if (error) throw error;
      smartToast('Đã xuất kho & tạo phiếu!');
      queryClient.invalidateQueries({ queryKey: ['material-requests'] });
      queryClient.invalidateQueries({ queryKey: ['project-stock'] });
      // In phiếu ngay
      printIssueSlip({ code, issue_date: issueDate, projectLabel: request.projectLabel, subcontractor_name: request.subcontractor_name, notes, lines }, !showPrice);
      onBack?.();
    } catch (err) {
      smartToast('Lỗi xuất kho: ' + (err.message || 'thiếu RPC issue_from_request? chạy db/issue_from_request.sql.'));
    } finally { setSaving(false); }
  };

  if (!request) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-slate-400 hover:text-slate-600 flex items-center gap-1 text-sm font-bold"><span className="material-symbols-outlined text-[18px]">arrow_back</span>Đề nghị</button>
        <h3 className="font-black text-slate-800 dark:text-white">Xuất kho theo đề nghị {request.code}</h3>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4">
        <div className="flex flex-wrap items-center gap-4 mb-3">
          <div className="text-sm"><span className="text-slate-400">Dự án:</span> <b>{request.projectLabel}</b></div>
          <div className="text-sm"><span className="text-slate-400">Nhà thầu:</span> <b className="uppercase">{request.subcontractor_name}</b></div>
          <div className="flex items-center gap-2 text-sm"><span className="text-slate-400">Ngày xuất:</span>
            <input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} className="text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-700" /></div>
        </div>

        {isLoading ? <div className="p-6 text-center text-slate-400">Đang tải...</div> : (
          <div className="overflow-x-auto border border-slate-100 dark:border-slate-700 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/40 text-[11px] font-black uppercase text-slate-500">
                <tr><th className="text-left px-3 py-2">Vật tư</th><th className="text-center px-2 py-2">ĐVT</th><th className="text-right px-2 py-2">Đề nghị</th><th className="text-right px-2 py-2">Còn lại</th><th className="text-right px-2 py-2">Tồn kho</th><th className="text-right px-2 py-2 w-[130px]">SL xuất</th>{showPrice && <th className="text-right px-2 py-2">Đơn giá</th>}{showPrice && <th className="text-right px-3 py-2">Thành tiền</th>}</tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className="border-t border-slate-100 dark:border-slate-700/40">
                    <td className="px-3 py-1.5 font-semibold text-slate-700 dark:text-slate-200">{r.product_name}</td>
                    <td className="px-2 py-1.5 text-center text-slate-500 text-[12px]">{r.unit}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{qtyFmt(r.qty_requested)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-amber-600">{qtyFmt(r.remain)}</td>
                    <td className={`px-2 py-1.5 text-right tabular-nums font-bold ${r.ton <= 0 ? 'text-rose-500' : 'text-blue-600'}`}>{qtyFmt(r.ton)}</td>
                    <td className="px-2 py-1.5"><NumberInput value={Number(r.qty) || 0} onChange={v => setQty(r.id, v)} className="w-full text-right tabular-nums text-[13px] border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-700" /></td>
                    {showPrice && <td className="px-2 py-1.5 text-right tabular-nums text-slate-500">{money(r.avg)}</td>}
                    {showPrice && <td className="px-3 py-1.5 text-right tabular-nums font-semibold">{money(r.qty * r.avg)}</td>}
                  </tr>
                ))}
              </tbody>
              {showPrice && <tfoot><tr className="bg-slate-50 dark:bg-slate-900/40 border-t-2 border-slate-200 dark:border-slate-700"><td className="px-3 py-2 font-black uppercase text-[11px] text-slate-500" colSpan={7}>Tổng giá trị xuất</td><td className="px-3 py-2 text-right font-mono font-black text-slate-800 dark:text-white">{money(totalVal)}</td></tr></tfoot>}
            </table>
          </div>
        )}

        <div className="flex items-center gap-3 mt-3">
          <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Lý do / ghi chú xuất..." className="flex-1 text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700" />
          <button onClick={save} disabled={saving || !validRows.length} className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white rounded-lg text-sm font-bold flex items-center gap-1.5 whitespace-nowrap"><span className="material-symbols-outlined text-[18px]">print</span>{saving ? 'Đang xuất...' : 'Xuất & In phiếu'}</button>
        </div>
      </div>
    </div>
  );
}
