import React, { useState, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, PAYMENT_METHODS, groupByOrder, projectOption, projectLabel, todayStr } from './payablesUtils';
import { smartToast } from '../../utils/globalToast';
import NumberInput from '../common/NumberInput';

const today = todayStr;
const removeDiacritics = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');

export default function SupplierPaymentForm({ projects = [], suppliers = [], purchases = [], payments = [], materialGroups = [], onSaved }) {
  const { user } = useAuth();
  const [drafts, setDrafts] = useState({});       // key đơn -> { amount, date, ref, notes }
  const [payingKey, setPayingKey] = useState(null);
  const [collapsed, setCollapsed] = useState({}); // supplier_id -> true nếu gập
  const [q, setQ] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [recentPayments, setRecentPayments] = useState([]);

  // ── Đơn còn nợ, gom theo NCC ──
  const orders = useMemo(() => groupByOrder(purchases, payments).filter(o => o.remaining > 0.5), [purchases, payments]);
  const groups = useMemo(() => {
    const m = {};
    for (const o of orders) {
      if (!m[o.supplier_id]) m[o.supplier_id] = { supplier_id: o.supplier_id, code: o.supplier_code, name: o.supplier_name, orders: [], remaining: 0 };
      m[o.supplier_id].orders.push(o);
      m[o.supplier_id].remaining += o.remaining;
    }
    let list = Object.values(m).sort((a, b) => b.remaining - a.remaining);
    const kw = removeDiacritics(q.trim().toLowerCase());
    if (kw) list = list.filter(g => removeDiacritics(`${g.code} ${g.name}`.toLowerCase()).includes(kw));
    return list;
  }, [orders, q]);
  const totalRemaining = orders.reduce((s, o) => s + o.remaining, 0);

  const draftOf = (o) => drafts[o.key] || { amount: Math.round(o.remaining), date: today(), ref: '', notes: '' };
  const patchDraft = (o, patch) => setDrafts(d => ({ ...d, [o.key]: { ...draftOf(o), ...patch } }));
  const toggle = (sid) => setCollapsed(c => ({ ...c, [sid]: !c[sid] }));

  const payloadFor = (o) => {
    const d = draftOf(o);
    return {
      supplier_id: o.supplier_id, project_id: o.project_id, purchase_ref: o.key,
      payment_date: d.date || today(), amount: Number(d.amount), payment_method: 'Chuyển khoản',
      reference_no: d.ref || '', notes: d.notes || `Thanh toán đơn ${o.reference_no || ''}`.trim(),
      material_group: null, created_by: user?.id,
    };
  };

  const insertPayments = async (rows) => {
    const { data, error } = await supabase.from('supplier_payments').insert(rows)
      .select('*, partners:supplier_id(name, code), projects:project_id(name, code, internal_code)');
    if (error) throw error;
    if (data?.length) setRecentPayments(prev => [...data, ...prev].slice(0, 12));
    setDrafts(dd => { const n = { ...dd }; rows.forEach(r => delete n[r.purchase_ref]); return n; });
    onSaved?.();
  };

  const payOne = async (o) => {
    if (!(Number(draftOf(o).amount) > 0)) { smartToast('Nhập số tiền trả > 0'); return; }
    setPayingKey(o.key);
    try { await insertPayments([payloadFor(o)]); smartToast('Đã ghi nhận thanh toán!'); }
    catch (err) { smartToast('Lỗi ghi nhận: ' + (err.message || 'thiếu cột purchase_ref? chạy SQL.')); }
    finally { setPayingKey(null); }
  };

  const payGroup = async (g) => {
    const list = g.orders.filter(o => Number(draftOf(o).amount) > 0);
    if (!list.length) return;
    const total = list.reduce((s, o) => s + Number(draftOf(o).amount), 0);
    if (!window.confirm(`Trả ${list.length} đơn của ${g.code || g.name}, tổng ${formatCurrency(total)}?`)) return;
    setPayingKey('g:' + g.supplier_id);
    try { await insertPayments(list.map(payloadFor)); smartToast(`Đã ghi nhận ${list.length} đơn!`); }
    catch (err) { smartToast('Lỗi ghi nhận: ' + (err.message || '')); }
    finally { setPayingKey(null); }
  };

  // ── Ghi nhận thủ công ──
  const [form, setForm] = useState({ project_id: '', supplier_id: '', material_group: '', payment_date: today(), amount: '', payment_method: 'Chuyển khoản', reference_no: '', notes: '' });
  const [savingManual, setSavingManual] = useState(false);
  const saveManual = async () => {
    if (!form.project_id || !form.supplier_id || !form.amount || Number(form.amount) <= 0) return;
    setSavingManual(true);
    try {
      await insertPayments([{ project_id: form.project_id, supplier_id: form.supplier_id, material_group: form.material_group || null, payment_date: form.payment_date, amount: Number(form.amount), payment_method: form.payment_method, reference_no: form.reference_no, notes: form.notes, created_by: user?.id }]);
      setForm(f => ({ ...f, amount: '', reference_no: '', notes: '' }));
      smartToast('Đã ghi nhận thanh toán!');
    } catch (err) { smartToast('Lỗi ghi nhận: ' + (err.message || '')); }
    finally { setSavingManual(false); }
  };

  const handleDeletePayment = async (id) => {
    if (!confirm('Xóa bản ghi thanh toán này?')) return;
    await supabase.from('supplier_payments').delete().eq('id', id);
    setRecentPayments(prev => prev.filter(p => p.id !== id));
    onSaved?.();
  };

  return (
    <div className="space-y-5">
      {/* Thanh tổng + tìm kiếm */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-900/15 border border-rose-100 dark:border-rose-900/30">
          <span className="material-symbols-outlined text-rose-500 text-[20px]">account_balance_wallet</span>
          <span className="text-[13px] font-bold text-slate-600 dark:text-slate-300">{groups.length} NCC · {orders.length} đơn · Tổng còn nợ</span>
          <span className="font-mono font-black text-rose-600 text-[15px]">{formatCurrency(totalRemaining)}</span>
        </div>
        <div className="relative flex-1 min-w-[200px] max-w-[300px]">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[16px] text-slate-400">search</span>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Tìm nhà cung cấp..."
            className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg pl-9 pr-3 py-2 bg-white dark:bg-slate-700" />
        </div>
      </div>

      {/* Các nhóm NCC */}
      {groups.length === 0 ? (
        <div className="p-10 text-center text-slate-400 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
          <span className="material-symbols-outlined text-4xl mb-2 block text-emerald-400">check_circle</span>
          {q ? 'Không tìm thấy NCC.' : 'Không còn đơn nào phải trả.'}
        </div>
      ) : groups.map(g => {
        const open = !collapsed[g.supplier_id];
        const groupBusy = payingKey === 'g:' + g.supplier_id;
        return (
          <div key={g.supplier_id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            {/* Header NCC */}
            <div className="flex flex-wrap items-center gap-3 px-4 py-3 bg-slate-50 dark:bg-slate-900/40 border-b border-slate-100 dark:border-slate-700">
              <button onClick={() => toggle(g.supplier_id)} className="flex items-center gap-2 min-w-0 flex-1 text-left">
                <span className={`material-symbols-outlined text-slate-400 transition-transform ${open ? 'rotate-90' : ''}`}>chevron_right</span>
                <span className="min-w-0">
                  <span className="block font-black uppercase text-slate-800 dark:text-white truncate">{g.code || g.name}</span>
                  {g.code && <span className="block text-[11px] text-slate-400 uppercase truncate">{g.name}</span>}
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 shrink-0">{g.orders.length} đơn</span>
              </button>
              <span className="text-right shrink-0">
                <span className="block text-[10px] font-bold uppercase text-slate-400">Tổng còn nợ</span>
                <span className="font-mono font-black text-rose-600 text-[15px]">{formatCurrency(g.remaining)}</span>
              </span>
              <button onClick={() => payGroup(g)} disabled={groupBusy}
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-[12px] font-bold flex items-center gap-1.5 shrink-0">
                <span className="material-symbols-outlined text-[15px]">done_all</span>{groupBusy ? 'Đang ghi...' : 'Trả cả NCC'}
              </button>
            </div>

            {/* Các đơn */}
            {open && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10.5px] font-bold uppercase tracking-wide text-slate-400 border-b border-slate-100 dark:border-slate-700/60">
                      <th className="text-left py-2 px-3">Số HĐ / Ngày mua</th>
                      <th className="text-right py-2 px-3">Còn nợ</th>
                      <th className="text-right py-2 px-2 w-[150px]">Số tiền trả</th>
                      <th className="text-left py-2 px-2 w-[140px]">Ngày TT</th>
                      <th className="text-left py-2 px-2 w-[120px]">Số CT (UNC)</th>
                      <th className="text-left py-2 px-2 min-w-[140px]">Ghi chú</th>
                      <th className="py-2 px-3 w-[100px]"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.orders.map(o => {
                      const d = draftOf(o);
                      const busy = payingKey === o.key || groupBusy;
                      return (
                        <tr key={o.key} className="border-b border-slate-50 dark:border-slate-700/40 hover:bg-slate-50/60 dark:hover:bg-slate-700/20">
                          <td className="py-2 px-3">
                            <div className="font-semibold text-slate-700 dark:text-slate-200 text-[13px] truncate max-w-[240px]">{o.reference_no || projectLabel(o.projects) || 'Đơn không mã'}</div>
                            <div className="text-[11px] text-slate-400">
                              {o.purchase_date ? new Date(o.purchase_date).toLocaleDateString('vi-VN') : '—'}
                              {o.lineCount > 1 ? ` · ${o.lineCount} VT` : ''} · Tổng {formatCurrency(o.total)}
                              {o.paid > 0 ? ` · đã trả ${formatCurrency(o.paid)}` : ''}
                            </div>
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-rose-600 tabular-nums text-[13px] whitespace-nowrap">{formatCurrency(o.remaining)}</td>
                          <td className="py-2 px-2">
                            <NumberInput value={Number(d.amount) || 0} onChange={v => patchDraft(o, { amount: Number(v) || 0 })}
                              className="w-full text-right tabular-nums text-[13px] border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-700" />
                          </td>
                          <td className="py-2 px-2">
                            <input type="date" value={d.date} onChange={e => patchDraft(o, { date: e.target.value })}
                              className="w-full text-[13px] border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-700" />
                          </td>
                          <td className="py-2 px-2">
                            <input type="text" value={d.ref} placeholder="UNC..." onChange={e => patchDraft(o, { ref: e.target.value })}
                              className="w-full text-[13px] border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-700" />
                          </td>
                          <td className="py-2 px-2">
                            <input type="text" value={d.notes} placeholder="Ghi chú..." onChange={e => patchDraft(o, { notes: e.target.value })}
                              className="w-full text-[13px] border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-700" />
                          </td>
                          <td className="py-2 px-3 text-center">
                            <button onClick={() => payOne(o)} disabled={busy}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-[12px] font-bold whitespace-nowrap">
                              {payingKey === o.key ? '...' : 'Ghi nhận'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}

      {/* Vừa ghi nhận */}
      {recentPayments.length > 0 && (
        <div>
          <h4 className="text-sm font-bold text-slate-600 dark:text-slate-300 mb-2 flex items-center gap-2"><span className="material-symbols-outlined text-[16px]">history</span>Vừa ghi nhận</h4>
          <div className="space-y-2">
            {recentPayments.map(p => (
              <div key={p.id} className="flex items-center gap-4 px-4 py-2.5 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-xl border border-emerald-200/50 dark:border-emerald-800/30">
                <span className="material-symbols-outlined text-emerald-500 text-[20px]">check_circle</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 dark:text-white truncate"><span className="uppercase">{p.partners?.code || p.partners?.name || 'NCC'}</span> — {p.projects?.name || 'Dự án'}</p>
                  <p className="text-[12px] text-slate-500">{new Date(p.payment_date).toLocaleDateString('vi-VN')}{p.reference_no ? ` · ${p.reference_no}` : ''}{p.notes ? ` · ${p.notes}` : ''}</p>
                </div>
                <span className="font-mono font-bold text-emerald-600 text-sm">{formatCurrency(p.amount)}</span>
                <button onClick={() => handleDeletePayment(p.id)} className="text-slate-400 hover:text-rose-500" title="Xóa"><span className="material-symbols-outlined text-[16px]">close</span></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ghi nhận thủ công (không theo đơn) */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <button onClick={() => setShowManual(s => !s)} className="w-full flex items-center justify-between px-4 py-3 text-sm font-bold text-slate-600 dark:text-slate-300">
          <span className="flex items-center gap-2"><span className="material-symbols-outlined text-[18px]">add_circle</span>Ghi nhận khoản khác (thủ công, không gắn đơn)</span>
          <span className={`material-symbols-outlined transition-transform ${showManual ? 'rotate-180' : ''}`}>expand_more</span>
        </button>
        {showManual && (
          <div className="px-4 pb-4 border-t border-slate-100 dark:border-slate-700 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <select value={form.project_id} onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))} className="text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2.5 bg-white dark:bg-slate-700">
                <option value="">Chọn công trình...</option>
                {projects.map(p => <option key={p.id} value={p.id}>{projectOption(p)}</option>)}
              </select>
              <select value={form.supplier_id} onChange={e => setForm(f => ({ ...f, supplier_id: e.target.value }))} className="text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2.5 bg-white dark:bg-slate-700">
                <option value="">Chọn NCC...</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.code ? `${s.code} — ${s.name}` : s.name}</option>)}
              </select>
              <select value={form.material_group} onChange={e => setForm(f => ({ ...f, material_group: e.target.value }))} className="text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2.5 bg-white dark:bg-slate-700">
                <option value="">Tất cả nhóm</option>
                {materialGroups.map(gm => <option key={gm} value={gm}>{gm}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
              <input type="date" value={form.payment_date} onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))} className="text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2.5 bg-white dark:bg-slate-700" />
              <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="Số tiền" min="0" className="text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2.5 bg-white dark:bg-slate-700 font-mono" />
              <select value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))} className="text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2.5 bg-white dark:bg-slate-700">
                {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <input type="text" value={form.reference_no} onChange={e => setForm(f => ({ ...f, reference_no: e.target.value }))} placeholder="Số chứng từ" className="text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2.5 bg-white dark:bg-slate-700" />
              <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Ghi chú" className="col-span-2 md:col-span-3 text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2.5 bg-white dark:bg-slate-700" />
              <button onClick={saveManual} disabled={savingManual || !form.project_id || !form.supplier_id || !form.amount} className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-sm font-bold">{savingManual ? 'Đang lưu...' : 'Ghi nhận'}</button>
            </div>
          </div>
        )}
      </div>

      {/* Lịch sử thanh toán */}
      <div>
        <h4 className="text-sm font-bold text-slate-600 dark:text-slate-300 mb-2 flex items-center gap-2"><span className="material-symbols-outlined text-[16px]">receipt_long</span>Lịch sử thanh toán ({payments.length})</h4>
        {payments.length === 0 ? (
          <p className="text-center py-8 text-slate-400">Chưa có thanh toán nào</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-slate-200 dark:border-slate-600 text-[11px] font-bold text-slate-500 uppercase">
                  <th className="text-left py-2 px-3">Ngày</th>
                  <th className="text-left py-2 px-3">NCC</th>
                  <th className="text-right py-2 px-3">Số tiền</th>
                  <th className="text-left py-2 px-3">Số CT</th>
                  <th className="text-left py-2 px-3">Ghi chú</th>
                  <th className="text-left py-2 px-3">Công trình</th>
                  <th className="w-12"></th>
                </tr>
              </thead>
              <tbody>
                {payments.slice(0, 60).map(p => (
                  <tr key={p.id} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/20">
                    <td className="py-2 px-3 text-slate-600 whitespace-nowrap">{new Date(p.payment_date).toLocaleDateString('vi-VN')}</td>
                    <td className="py-2 px-3 font-medium uppercase text-slate-800 dark:text-white">{p.partners?.code || p.partners?.name || '—'}</td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-emerald-600">{formatCurrency(p.amount)}</td>
                    <td className="py-2 px-3 text-slate-500 font-mono text-[12px]">{p.reference_no || '—'}</td>
                    <td className="py-2 px-3 text-slate-500 text-[12px] max-w-[200px] truncate">{p.notes || '—'}</td>
                    <td className="py-2 px-3 text-slate-500 text-[12px] max-w-[120px] truncate">{p.projects?.name || '—'}</td>
                    <td className="py-2 px-3"><button onClick={() => handleDeletePayment(p.id)} className="text-slate-400 hover:text-rose-500"><span className="material-symbols-outlined text-[16px]">delete</span></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
