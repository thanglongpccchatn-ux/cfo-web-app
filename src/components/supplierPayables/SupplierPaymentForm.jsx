import React, { useState, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, PAYMENT_METHODS, groupByOrder, projectOption, projectLabel } from './payablesUtils';
import { smartToast } from '../../utils/globalToast';

const today = () => new Date().toISOString().slice(0, 10);

export default function SupplierPaymentForm({ projects = [], suppliers = [], purchases = [], payments = [], materialGroups = [], onSaved }) {
  const { user } = useAuth();
  const [drafts, setDrafts] = useState({});      // key đơn -> { amount, date, notes }
  const [payingKey, setPayingKey] = useState(null);
  const [showManual, setShowManual] = useState(false);
  const [recentPayments, setRecentPayments] = useState([]);

  // ── Danh sách ĐƠN đang còn nợ ──
  const orders = useMemo(() => groupByOrder(purchases, payments).filter(o => o.remaining > 0.5), [purchases, payments]);
  const totalRemaining = orders.reduce((s, o) => s + o.remaining, 0);

  const draftOf = (o) => drafts[o.key] || { amount: String(Math.round(o.remaining)), date: today(), notes: '' };
  const patchDraft = (o, patch) => setDrafts(d => ({ ...d, [o.key]: { ...draftOf(o), ...patch } }));

  const buildPayload = (o, d) => ({
    supplier_id: o.supplier_id, project_id: o.project_id, purchase_ref: o.key,
    payment_date: d.date || today(), amount: Number(d.amount), payment_method: 'Chuyển khoản',
    reference_no: '', notes: d.notes || `Thanh toán đơn ${o.reference_no || ''}`.trim(),
    material_group: null, created_by: user?.id,
  });

  const payOrder = async (o) => {
    const d = draftOf(o);
    const amt = Number(d.amount);
    if (!amt || amt <= 0) { smartToast('Nhập số tiền trả > 0'); return; }
    setPayingKey(o.key);
    try {
      const { data, error } = await supabase.from('supplier_payments').insert(buildPayload(o, d))
        .select('*, partners:supplier_id(name), projects:project_id(name, code, internal_code)').single();
      if (error) throw error;
      if (data) setRecentPayments(prev => [data, ...prev].slice(0, 10));
      setDrafts(dd => { const n = { ...dd }; delete n[o.key]; return n; });
      smartToast('Đã ghi nhận thanh toán!');
      onSaved?.();
    } catch (err) {
      smartToast('Lỗi ghi nhận: ' + (err.message || 'thiếu cột purchase_ref? chạy SQL.'));
    } finally { setPayingKey(null); }
  };

  const payAll = async () => {
    const list = orders.filter(o => Number(draftOf(o).amount) > 0);
    if (!list.length) return;
    const total = list.reduce((s, o) => s + Number(draftOf(o).amount), 0);
    if (!window.confirm(`Ghi nhận thanh toán cho ${list.length} đơn, tổng ${formatCurrency(total)}?`)) return;
    setPayingKey('__all__');
    try {
      const rows = list.map(o => buildPayload(o, draftOf(o)));
      const { error } = await supabase.from('supplier_payments').insert(rows);
      if (error) throw error;
      setDrafts({});
      smartToast(`Đã ghi nhận ${list.length} đơn!`);
      onSaved?.();
    } catch (err) {
      smartToast('Lỗi ghi nhận: ' + (err.message || 'thiếu cột purchase_ref? chạy SQL.'));
    } finally { setPayingKey(null); }
  };

  // ── Form thủ công (khoản không theo đơn) ──
  const [form, setForm] = useState({
    project_id: '', supplier_id: '', material_group: '',
    payment_date: today(), amount: '', payment_method: 'Chuyển khoản', reference_no: '', notes: '',
  });
  const [savingManual, setSavingManual] = useState(false);
  const saveManual = async () => {
    if (!form.project_id || !form.supplier_id || !form.amount || Number(form.amount) <= 0) return;
    setSavingManual(true);
    try {
      const { data, error } = await supabase.from('supplier_payments').insert({
        project_id: form.project_id, supplier_id: form.supplier_id, material_group: form.material_group || null,
        payment_date: form.payment_date, amount: Number(form.amount), payment_method: form.payment_method,
        reference_no: form.reference_no, notes: form.notes, created_by: user?.id,
      }).select('*, partners:supplier_id(name), projects:project_id(name, code, internal_code)').single();
      if (error) throw error;
      if (data) setRecentPayments(prev => [data, ...prev].slice(0, 10));
      setForm(f => ({ ...f, amount: '', reference_no: '', notes: '' }));
      smartToast('Đã ghi nhận thanh toán!');
      onSaved?.();
    } catch (err) {
      smartToast('Lỗi ghi nhận: ' + (err.message || 'không rõ nguyên nhân'));
    } finally { setSavingManual(false); }
  };

  const handleDeletePayment = async (id) => {
    if (!confirm('Xóa bản ghi thanh toán này?')) return;
    await supabase.from('supplier_payments').delete().eq('id', id);
    setRecentPayments(prev => prev.filter(p => p.id !== id));
    onSaved?.();
  };

  return (
    <div className="space-y-6">
      {/* ── BẢNG THANH TOÁN THEO ĐƠN ── */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-700">
          <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 text-sm">
            <span className="material-symbols-outlined text-rose-500 text-[20px]">account_balance_wallet</span>
            Đơn còn phải trả ({orders.length}) · Tổng còn nợ <span className="font-mono text-rose-600">{formatCurrency(totalRemaining)}</span>
          </h3>
          {orders.length > 0 && (
            <button onClick={payAll} disabled={payingKey === '__all__'}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-[12px] font-bold flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[15px]">done_all</span>
              {payingKey === '__all__' ? 'Đang ghi...' : 'Ghi nhận tất cả'}
            </button>
          )}
        </div>

        {orders.length === 0 ? (
          <div className="p-10 text-center text-slate-400">
            <span className="material-symbols-outlined text-4xl mb-2 block text-emerald-400">check_circle</span>
            Không còn đơn nào phải trả.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/40 text-[11px] font-black uppercase tracking-wider text-slate-500">
                  <th className="text-left py-2.5 px-3">NCC / Số HĐ</th>
                  <th className="text-left py-2.5 px-3 whitespace-nowrap">Ngày mua</th>
                  <th className="text-right py-2.5 px-3">Tổng đơn</th>
                  <th className="text-right py-2.5 px-3">Đã trả</th>
                  <th className="text-right py-2.5 px-3">Còn nợ</th>
                  <th className="text-right py-2.5 px-3 w-[140px]">Số tiền trả</th>
                  <th className="text-left py-2.5 px-3 w-[140px]">Ngày TT</th>
                  <th className="text-left py-2.5 px-3 min-w-[160px]">Ghi chú</th>
                  <th className="py-2.5 px-3 w-[110px]"></th>
                </tr>
              </thead>
              <tbody>
                {orders.map(o => {
                  const d = draftOf(o);
                  const busy = payingKey === o.key || payingKey === '__all__';
                  return (
                    <tr key={o.key} className="border-t border-slate-100 dark:border-slate-700/40 hover:bg-slate-50/60 dark:hover:bg-slate-700/20">
                      <td className="py-2 px-3">
                        <div className="font-bold text-slate-800 dark:text-white text-[13px] truncate max-w-[200px]" title={o.supplier_name}>{o.supplier_code || o.supplier_name}</div>
                        <div className="text-[11px] text-slate-400 truncate max-w-[200px]">{o.reference_no || projectLabel(o.projects) || '—'}{o.lineCount > 1 ? ` · ${o.lineCount} VT` : ''}</div>
                      </td>
                      <td className="py-2 px-3 text-slate-500 whitespace-nowrap text-[12px]">{o.purchase_date ? new Date(o.purchase_date).toLocaleDateString('vi-VN') : '—'}</td>
                      <td className="py-2 px-3 text-right font-mono text-slate-600 dark:text-slate-300">{formatCurrency(o.total)}</td>
                      <td className="py-2 px-3 text-right font-mono text-emerald-600">{formatCurrency(o.paid)}</td>
                      <td className="py-2 px-3 text-right font-mono font-black text-rose-600">{formatCurrency(o.remaining)}</td>
                      <td className="py-2 px-2">
                        <input type="number" value={d.amount} min="0"
                          onChange={e => patchDraft(o, { amount: e.target.value })}
                          className="w-full text-right font-mono text-[13px] border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-700" />
                      </td>
                      <td className="py-2 px-2">
                        <input type="date" value={d.date}
                          onChange={e => patchDraft(o, { date: e.target.value })}
                          className="w-full text-[12px] border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-700" />
                      </td>
                      <td className="py-2 px-2">
                        <input type="text" value={d.notes} placeholder="Ghi chú..."
                          onChange={e => patchDraft(o, { notes: e.target.value })}
                          className="w-full text-[12px] border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-700" />
                      </td>
                      <td className="py-2 px-3 text-center">
                        <button onClick={() => payOrder(o)} disabled={busy}
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

      {/* ── Vừa ghi nhận ── */}
      {recentPayments.length > 0 && (
        <div>
          <h4 className="text-sm font-bold text-slate-600 dark:text-slate-300 mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">history</span>Vừa ghi nhận
          </h4>
          <div className="space-y-2">
            {recentPayments.map(p => (
              <div key={p.id} className="flex items-center gap-4 px-4 py-3 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-xl border border-emerald-200/50 dark:border-emerald-800/30">
                <span className="material-symbols-outlined text-emerald-500 text-[20px]">check_circle</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 dark:text-white truncate">{p.partners?.name || 'NCC'} — {p.projects?.name || 'Dự án'}</p>
                  <p className="text-[12px] text-slate-500">{new Date(p.payment_date).toLocaleDateString('vi-VN')} · {p.payment_method}{p.notes ? ` · ${p.notes}` : ''}</p>
                </div>
                <span className="font-mono font-bold text-emerald-600 text-sm">{formatCurrency(p.amount)}</span>
                <button onClick={() => handleDeletePayment(p.id)} className="text-slate-400 hover:text-rose-500" title="Xóa"><span className="material-symbols-outlined text-[16px]">close</span></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Ghi nhận thủ công (không theo đơn) — thu gọn ── */}
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
                {materialGroups.map(g => <option key={g} value={g}>{g}</option>)}
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

      {/* ── Lịch sử thanh toán ── */}
      <div>
        <h4 className="text-sm font-bold text-slate-600 dark:text-slate-300 mb-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">receipt_long</span>Lịch sử thanh toán ({payments.length})
        </h4>
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
                  <th className="text-left py-2 px-3">Hình thức</th>
                  <th className="text-left py-2 px-3">Ghi chú</th>
                  <th className="text-left py-2 px-3">Công trình</th>
                  <th className="w-12"></th>
                </tr>
              </thead>
              <tbody>
                {payments.slice(0, 50).map(p => (
                  <tr key={p.id} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/20">
                    <td className="py-2 px-3 text-slate-600 whitespace-nowrap">{new Date(p.payment_date).toLocaleDateString('vi-VN')}</td>
                    <td className="py-2 px-3 font-medium text-slate-800 dark:text-white">{p.partners?.code || p.partners?.name || '—'}</td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-emerald-600">{formatCurrency(p.amount)}</td>
                    <td className="py-2 px-3 text-slate-500">{p.payment_method}</td>
                    <td className="py-2 px-3 text-slate-500 text-[12px] max-w-[200px] truncate">{p.notes || '—'}</td>
                    <td className="py-2 px-3 text-slate-500 text-[12px] max-w-[120px] truncate">{p.projects?.name || '—'}</td>
                    <td className="py-2 px-3">
                      <button onClick={() => handleDeletePayment(p.id)} className="text-slate-400 hover:text-rose-500"><span className="material-symbols-outlined text-[16px]">delete</span></button>
                    </td>
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
