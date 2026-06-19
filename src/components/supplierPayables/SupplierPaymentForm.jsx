import React, { useState, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, PAYMENT_METHODS, groupBySupplier, projectOption } from './payablesUtils';

export default function SupplierPaymentForm({ projects = [], suppliers = [], purchases = [], payments = [], materialGroups = [], onSaved }) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [recentPayments, setRecentPayments] = useState([]);
  const [form, setForm] = useState({
    project_id: '', supplier_id: '', material_group: '',
    payment_date: new Date().toISOString().slice(0, 10),
    amount: '', payment_method: 'Chuyển khoản', reference_no: '', notes: '',
  });

  // Quick supplier summary for selected supplier
  const supplierInfo = useMemo(() => {
    if (!form.supplier_id) return null;
    const grouped = groupBySupplier(purchases, payments);
    return grouped.find(g => g.supplier_id === form.supplier_id);
  }, [form.supplier_id, purchases, payments]);

  const balance = supplierInfo ? (supplierInfo.totalPurchased - supplierInfo.totalPaid) : 0;

  const handleSave = async () => {
    if (!form.project_id || !form.supplier_id || !form.amount || Number(form.amount) <= 0) return;
    setSaving(true);
    try {
      const payload = {
        project_id: form.project_id,
        supplier_id: form.supplier_id,
        material_group: form.material_group || null,
        payment_date: form.payment_date,
        amount: Number(form.amount),
        payment_method: form.payment_method,
        reference_no: form.reference_no,
        notes: form.notes,
        created_by: user?.id,
      };
      const { data } = await supabase.from('supplier_payments').insert(payload).select('*, partners:supplier_id(name), projects:project_id(name, code, internal_code)').single();
      if (data) setRecentPayments(prev => [data, ...prev].slice(0, 10));
      setForm(f => ({ ...f, amount: '', reference_no: '', notes: '' }));
      onSaved?.();
    } catch (err) {
      console.error('Error saving payment:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePayment = async (id) => {
    if (!confirm('Xóa bản ghi thanh toán này?')) return;
    await supabase.from('supplier_payments').delete().eq('id', id);
    setRecentPayments(prev => prev.filter(p => p.id !== id));
    onSaved?.();
  };

  return (
    <div className="space-y-6">
      {/* Payment Form */}
      <div className="bg-gradient-to-br from-emerald-50/50 to-white dark:from-emerald-900/10 dark:to-slate-800/50 rounded-2xl border border-emerald-200 dark:border-emerald-800/30 p-5">
        <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-4">
          <span className="material-symbols-outlined text-emerald-600">payments</span>
          Ghi nhận thanh toán cho NCC
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Công trình *</label>
            <select value={form.project_id} onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))}
              className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2.5 bg-white dark:bg-slate-700 text-slate-800 dark:text-white">
              <option value="">Chọn công trình...</option>
              {projects.map(p => <option key={p.id} value={p.id}>{projectOption(p)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Nhà cung cấp *</label>
            <select value={form.supplier_id} onChange={e => setForm(f => ({ ...f, supplier_id: e.target.value }))}
              className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2.5 bg-white dark:bg-slate-700 text-slate-800 dark:text-white">
              <option value="">Chọn NCC...</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Nhóm VT (tùy chọn)</label>
            <select value={form.material_group} onChange={e => setForm(f => ({ ...f, material_group: e.target.value }))}
              className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2.5 bg-white dark:bg-slate-700 text-slate-800 dark:text-white">
              <option value="">Tất cả nhóm</option>
              {materialGroups.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
        </div>

        {/* Supplier quick info */}
        {supplierInfo && (
          <div className="mt-3 flex flex-wrap items-center gap-4 px-4 py-3 bg-white/60 dark:bg-slate-800/40 rounded-xl border border-slate-200/50 dark:border-slate-700/50">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500 font-bold">Tổng mua:</span>
              <span className="font-mono font-bold text-slate-800 dark:text-white">{formatCurrency(supplierInfo.totalPurchased)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500 font-bold">Đã trả:</span>
              <span className="font-mono font-bold text-emerald-600">{formatCurrency(supplierInfo.totalPaid)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500 font-bold">Còn nợ:</span>
              <span className={`font-mono font-bold ${balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{formatCurrency(balance)}</span>
            </div>
            <div className="ml-auto">
              <button
                onClick={() => setForm(f => ({ ...f, amount: String(balance) }))}
                disabled={balance <= 0}
                className="text-[11px] px-3 py-1 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg font-bold transition-colors disabled:opacity-40"
              >
                Thanh toán hết
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Ngày thanh toán *</label>
            <input type="date" value={form.payment_date} onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))}
              className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2.5 bg-white dark:bg-slate-700 text-slate-800 dark:text-white" />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Số tiền *</label>
            <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              placeholder="0" min="0"
              className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2.5 bg-white dark:bg-slate-700 text-slate-800 dark:text-white font-mono" />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Hình thức</label>
            <select value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}
              className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2.5 bg-white dark:bg-slate-700 text-slate-800 dark:text-white">
              {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Số chứng từ</label>
            <input type="text" value={form.reference_no} onChange={e => setForm(f => ({ ...f, reference_no: e.target.value }))}
              placeholder="VD: UNC-0012345"
              className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2.5 bg-white dark:bg-slate-700 text-slate-800 dark:text-white" />
          </div>
          <div className="col-span-2 md:col-span-3">
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Ghi chú</label>
            <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="VD: Thanh toán đợt 1 đơn hàng"
              className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2.5 bg-white dark:bg-slate-700 text-slate-800 dark:text-white" />
          </div>
          <div className="flex items-end">
            <button onClick={handleSave} disabled={saving || !form.project_id || !form.supplier_id || !form.amount}
              className="w-full px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-sm font-bold shadow-sm transition-colors flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-[18px]">save</span>
              {saving ? 'Đang lưu...' : 'Ghi nhận'}
            </button>
          </div>
        </div>
      </div>

      {/* Recent Payments */}
      {recentPayments.length > 0 && (
        <div>
          <h4 className="text-sm font-bold text-slate-600 dark:text-slate-300 mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">history</span>
            Vừa ghi nhận
          </h4>
          <div className="space-y-2">
            {recentPayments.map(p => (
              <div key={p.id} className="flex items-center gap-4 px-4 py-3 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-xl border border-emerald-200/50 dark:border-emerald-800/30">
                <span className="material-symbols-outlined text-emerald-500 text-[20px]">check_circle</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 dark:text-white truncate">
                    {p.partners?.name || 'NCC'} — {p.projects?.name || 'Dự án'}
                  </p>
                  <p className="text-[12px] text-slate-500">
                    {new Date(p.payment_date).toLocaleDateString('vi-VN')} · {p.payment_method} {p.reference_no ? `· ${p.reference_no}` : ''}
                  </p>
                </div>
                <span className="font-mono font-bold text-emerald-600 text-sm">{formatCurrency(p.amount)}</span>
                <button onClick={() => handleDeletePayment(p.id)} className="text-slate-400 hover:text-rose-500 transition-colors" title="Xóa">
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payment History Table */}
      <div>
        <h4 className="text-sm font-bold text-slate-600 dark:text-slate-300 mb-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">receipt_long</span>
          Lịch sử thanh toán ({payments.length})
        </h4>
        {payments.length === 0 ? (
          <p className="text-center py-8 text-slate-400">Chưa có thanh toán nào</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-slate-200 dark:border-slate-600">
                  <th className="text-left py-2 px-3 text-[11px] font-bold text-slate-500 uppercase">Ngày</th>
                  <th className="text-left py-2 px-3 text-[11px] font-bold text-slate-500 uppercase">NCC</th>
                  <th className="text-left py-2 px-3 text-[11px] font-bold text-slate-500 uppercase">Nhóm VT</th>
                  <th className="text-right py-2 px-3 text-[11px] font-bold text-slate-500 uppercase">Số tiền</th>
                  <th className="text-left py-2 px-3 text-[11px] font-bold text-slate-500 uppercase">Hình thức</th>
                  <th className="text-left py-2 px-3 text-[11px] font-bold text-slate-500 uppercase">Chứng từ</th>
                  <th className="text-left py-2 px-3 text-[11px] font-bold text-slate-500 uppercase">Công trình</th>
                  <th className="w-12"></th>
                </tr>
              </thead>
              <tbody>
                {payments.slice(0, 50).map(p => (
                  <tr key={p.id} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/20">
                    <td className="py-2 px-3 text-slate-600 whitespace-nowrap">{new Date(p.payment_date).toLocaleDateString('vi-VN')}</td>
                    <td className="py-2 px-3 font-medium text-slate-800 dark:text-white">{p.partners?.name || '—'}</td>
                    <td className="py-2 px-3 text-slate-500">{p.material_group || '—'}</td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-emerald-600">{formatCurrency(p.amount)}</td>
                    <td className="py-2 px-3 text-slate-500">{p.payment_method}</td>
                    <td className="py-2 px-3 text-slate-500 font-mono text-[12px]">{p.reference_no || '—'}</td>
                    <td className="py-2 px-3 text-slate-500 text-[12px] max-w-[120px] truncate">{p.projects?.name || '—'}</td>
                    <td className="py-2 px-3">
                      <button onClick={() => handleDeletePayment(p.id)} className="text-slate-400 hover:text-rose-500 transition-colors">
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
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
