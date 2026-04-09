import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { fmt, fmtDate } from '../../utils/formatters';
import { smartToast } from '../../utils/globalToast';
import { autoJournal } from '../../lib/accountingService';

/**
 * SupplierPaymentModal — Ghi nhận thanh toán cho NCC theo PO
 * Props:
 *   po         - PO object (from purchase_orders) with .total_amount, .paid_amount, .code, .supplier_id
 *   supplier   - { id, name, code } 
 *   onClose    - close callback
 *   onSuccess  - callback after successful payment (for invalidation)
 *   existingPayments - optional array of po_payments for display
 */
export default function SupplierPaymentModal({ po, supplier, onClose, onSuccess, existingPayments = [] }) {
    const [form, setForm] = useState({
        amount: '',
        paymentDate: new Date().toISOString().split('T')[0],
        paymentMethod: 'Chuyển khoản',
        referenceNumber: '',
        notes: '',
        treasuryAccountId: '', // Link to treasury account for auto-posting
    });
    const [submitting, setSubmitting] = useState(false);
    const [payments, setPayments] = useState(existingPayments);
    const [loadingHistory, setLoadingHistory] = useState(existingPayments.length === 0);
    const [treasuryAccounts, setTreasuryAccounts] = useState([]);

    // Load payment history if not provided
    useEffect(() => {
        if (existingPayments.length > 0 || !po?.id) return;
        (async () => {
            setLoadingHistory(true);
            const { data, error } = await supabase
                .from('po_payments')
                .select('*')
                .eq('po_id', po.id)
                .order('payment_date', { ascending: false });
            if (!error) setPayments(data || []);
            setLoadingHistory(false);
        })();
    }, [po?.id, existingPayments]);

    // Load treasury accounts for auto-posting
    useEffect(() => {
        (async () => {
            const { data } = await supabase
                .from('treasury_accounts')
                .select('id, name, bank_name, account_number, type, current_balance')
                .eq('status', 'active')
                .order('name');
            if (data && data.length > 0) {
                setTreasuryAccounts(data);
                // Auto-select based on payment method
                const bankAcc = data.find(a => a.type === 'bank');
                const cashAcc = data.find(a => a.type === 'cash');
                if (bankAcc) setForm(f => ({ ...f, treasuryAccountId: bankAcc.id }));
                else if (cashAcc) setForm(f => ({ ...f, treasuryAccountId: cashAcc.id }));
            }
        })();
    }, []);

    if (!po) return null;

    const totalPO = Number(po.total_amount || 0);
    const totalPaidFromHistory = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
    const remainingDebt = totalPO - totalPaidFromHistory;
    const inputAmount = Number(form.amount) || 0;

    const handleSubmit = async () => {
        if (inputAmount <= 0) {
            smartToast('Vui lòng nhập số tiền thanh toán > 0');
            return;
        }
        if (inputAmount > remainingDebt * 1.01) { // 1% tolerance for rounding
            smartToast(`Số tiền vượt quá công nợ còn lại (${fmt(remainingDebt)}đ)`);
            return;
        }
        if (!form.paymentDate) {
            smartToast('Vui lòng chọn ngày thanh toán');
            return;
        }

        setSubmitting(true);
        try {
            // 1. Insert payment record
            const { error: payErr } = await supabase.from('po_payments').insert([{
                po_id: po.id,
                payment_date: form.paymentDate,
                amount: inputAmount,
                payment_method: form.paymentMethod,
                reference_number: form.referenceNumber || null,
                notes: form.notes || null,
            }]);
            if (payErr) throw payErr;

            // 2. Update PO paid_amount & payment_status
            const newTotalPaid = totalPaidFromHistory + inputAmount;
            const newStatus = newTotalPaid >= totalPO * 0.99 ? 'PAID' : 'PARTIAL';
            const { error: poErr } = await supabase
                .from('purchase_orders')
                .update({ paid_amount: newTotalPaid, payment_status: newStatus })
                .eq('id', po.id);
            if (poErr) throw poErr;

            // 3. Also update expense_materials paid_amount for matching records
            if (po.supplier_id) {
                const { data: relatedMats } = await supabase
                    .from('expense_materials')
                    .select('id, total_amount, paid_amount')
                    .eq('supplier_id', po.supplier_id)
                    .eq('project_id', po.project_id);

                if (relatedMats && relatedMats.length > 0) {
                    const totalMatValue = relatedMats.reduce((s, m) => s + Number(m.total_amount || 0), 0);
                    if (totalMatValue > 0) {
                        for (const mat of relatedMats) {
                            const proportion = Number(mat.total_amount) / totalMatValue;
                            const matPayment = Math.round(inputAmount * proportion);
                            const newPaid = Math.min(
                                Number(mat.paid_amount || 0) + matPayment,
                                Number(mat.total_amount)
                            );
                            await supabase
                                .from('expense_materials')
                                .update({ paid_amount: newPaid })
                                .eq('id', mat.id);
                        }
                    }
                }
            }

            // 4. Auto-post to Treasury (Sổ Quỹ) if account selected
            if (form.treasuryAccountId) {
                const { error: trErr } = await supabase.from('treasury_transactions').insert([{
                    account_id: form.treasuryAccountId,
                    type: 'OUT',
                    amount: inputAmount,
                    category: 'Chi trả NCC',
                    party_name: supplier?.name || '',
                    transaction_date: form.paymentDate,
                    description: `TT NCC ${supplier?.name || ''} — PO ${po.code}${form.referenceNumber ? ` (${form.referenceNumber})` : ''}`,
                    project_id: po.project_id || null,
                    ref_id: po.code,
                }]);
                if (trErr) {
                    console.warn('Treasury auto-post failed (non-critical):', trErr);
                    // Non-critical: don't block the payment flow
                }
            }

            smartToast(`Đã ghi nhận thanh toán ${fmt(inputAmount)}đ cho PO ${po.code}`);

            // Auto-create journal entry: Nợ 331 / Có 112 (or 111)
            autoJournal.supplierPayment(po, supplier, inputAmount, form).catch(err =>
                console.warn('[Accounting] Auto journal failed (non-critical):', err)
            );

            onSuccess?.();
            onClose();
        } catch (err) {
            console.error('Payment error:', err);
            smartToast('Lỗi ghi nhận thanh toán: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const PAYMENT_METHODS = ['Chuyển khoản', 'Tiền mặt', 'Công trừ', 'Khác'];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200/50 flex flex-col max-h-[90vh] animate-fade-in">
                {/* Header */}
                <div className="px-6 py-5 bg-gradient-to-r from-blue-50 to-indigo-50/30 border-b border-slate-100 shrink-0">
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="flex items-center gap-2 text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1.5">
                                <span>Thanh toán NCC</span>
                                <span className="material-symbols-outlined text-[12px]">chevron_right</span>
                                <span className="text-blue-700">{po.code}</span>
                            </div>
                            <h3 className="text-xl font-extrabold text-slate-800 tracking-tight">Ghi nhận Thanh toán</h3>
                            {supplier && (
                                <p className="text-sm text-slate-500 mt-1 flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-[16px]">storefront</span>
                                    {supplier.name}
                                    {supplier.code && <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{supplier.code}</span>}
                                </p>
                            )}
                        </div>
                        <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                            <span className="material-symbols-outlined notranslate text-[20px]" translate="no">close</span>
                        </button>
                    </div>

                    {/* Balance Summary */}
                    <div className="grid grid-cols-3 gap-3 mt-4">
                        <div className="bg-white/80 rounded-xl p-3 border border-slate-200/60">
                            <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Giá trị PO</div>
                            <div className="text-base font-black text-slate-800 tabular-nums">{fmt(totalPO)}đ</div>
                        </div>
                        <div className="bg-white/80 rounded-xl p-3 border border-emerald-200/60">
                            <div className="text-[9px] font-black uppercase tracking-widest text-emerald-600 mb-1">Đã thanh toán</div>
                            <div className="text-base font-black text-emerald-700 tabular-nums">{fmt(totalPaidFromHistory)}đ</div>
                        </div>
                        <div className="bg-white/80 rounded-xl p-3 border border-red-200/60">
                            <div className="text-[9px] font-black uppercase tracking-widest text-red-600 mb-1">Còn nợ</div>
                            <div className={`text-base font-black tabular-nums ${remainingDebt > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                                {remainingDebt > 0 ? fmt(remainingDebt) + 'đ' : 'Đã tất toán ✓'}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Form */}
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                    {/* Amount — the hero input */}
                    <div>
                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">
                            Số tiền thanh toán <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                            <input
                                type="number"
                                value={form.amount}
                                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                                placeholder="Nhập số tiền..."
                                className="w-full bg-blue-50/50 border-2 border-blue-200 rounded-xl px-5 py-4 text-2xl font-black text-blue-800 text-right focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all tabular-nums placeholder:text-blue-300 placeholder:text-lg"
                                autoFocus
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-blue-400 pointer-events-none">₫</span>
                        </div>
                        {remainingDebt > 0 && (
                            <div className="flex items-center gap-2 mt-2">
                                <button
                                    type="button"
                                    onClick={() => setForm({ ...form, amount: String(remainingDebt) })}
                                    className="text-[11px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded-lg border border-blue-200 transition-colors"
                                >
                                    Thanh toán hết ({fmt(remainingDebt)}đ)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setForm({ ...form, amount: String(Math.round(remainingDebt / 2)) })}
                                    className="text-[11px] font-bold text-slate-500 bg-slate-50 hover:bg-slate-100 px-3 py-1 rounded-lg border border-slate-200 transition-colors"
                                >
                                    50% ({fmt(Math.round(remainingDebt / 2))}đ)
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Date + Method */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-1.5">
                                Ngày thanh toán <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="date"
                                value={form.paymentDate}
                                onChange={(e) => setForm({ ...form, paymentDate: e.target.value })}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Phương thức</label>
                            <select
                                value={form.paymentMethod}
                                onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            >
                                {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Reference + Notes */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Số chứng từ / UNC</label>
                            <input
                                type="text"
                                value={form.referenceNumber}
                                onChange={(e) => setForm({ ...form, referenceNumber: e.target.value })}
                                placeholder="VD: UNC-0452"
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Ghi chú</label>
                            <input
                                type="text"
                                value={form.notes}
                                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                                placeholder="Lý do / Diễn giải..."
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            />
                        </div>
                    </div>

                    {/* Treasury Account Selector */}
                    {treasuryAccounts.length > 0 && (
                        <div className="bg-indigo-50/50 rounded-xl border border-indigo-200/60 p-4">
                            <label className="block text-[11px] font-black text-indigo-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-[14px]">account_balance</span>
                                Ghi sổ quỹ tự động
                            </label>
                            <select
                                value={form.treasuryAccountId}
                                onChange={(e) => setForm({ ...form, treasuryAccountId: e.target.value })}
                                className="w-full bg-white border border-indigo-200 rounded-xl px-4 py-3 text-sm font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                            >
                                <option value="">-- Không ghi sổ quỹ --</option>
                                {treasuryAccounts.map(acc => (
                                    <option key={acc.id} value={acc.id}>
                                        {acc.name}{acc.bank_name ? ` (${acc.bank_name})` : ''}{acc.account_number ? ` — ${acc.account_number}` : ''} [{fmt(acc.current_balance)}đ]
                                    </option>
                                ))}
                            </select>
                            <p className="text-[10px] text-indigo-400 mt-1.5 font-medium">
                                Khi chọn, hệ thống tự động tạo phiếu chi trong Sổ Quỹ
                            </p>
                        </div>
                    )}
                    {/* Payment History */}
                    {payments.length > 0 && (
                        <div className="pt-2">
                            <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <span className="material-symbols-outlined text-[16px]">history</span>
                                Lịch sử thanh toán ({payments.length})
                            </h4>
                            <div className="bg-slate-50/50 rounded-xl border border-slate-200 overflow-hidden">
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-slate-100 text-[9px] font-black uppercase text-slate-400 tracking-widest">
                                        <tr>
                                            <th className="px-3 py-2">Ngày</th>
                                            <th className="px-3 py-2 text-right">Số tiền</th>
                                            <th className="px-3 py-2">Phương thức</th>
                                            <th className="px-3 py-2">Chứng từ</th>
                                            <th className="px-3 py-2">Ghi chú</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {payments.map((p, i) => (
                                            <tr key={p.id || i} className="hover:bg-white/50">
                                                <td className="px-3 py-2 font-medium text-slate-600">{fmtDate(p.payment_date)}</td>
                                                <td className="px-3 py-2 text-right font-black text-emerald-700 tabular-nums">{fmt(p.amount)}đ</td>
                                                <td className="px-3 py-2 text-slate-500">{p.payment_method || '-'}</td>
                                                <td className="px-3 py-2 font-mono text-slate-400 text-[10px]">{p.reference_number || '-'}</td>
                                                <td className="px-3 py-2 text-slate-400 truncate max-w-[120px]">{p.notes || '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                    {loadingHistory && (
                        <div className="text-center py-3 text-slate-400 text-xs animate-pulse">Đang tải lịch sử...</div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/60 flex justify-between items-center shrink-0">
                    <div className="text-xs text-slate-500">
                        {inputAmount > 0 && (
                            <span>
                                Sau thanh toán: Còn nợ{' '}
                                <span className={`font-black ${remainingDebt - inputAmount > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                    {fmt(Math.max(0, remainingDebt - inputAmount))}đ
                                </span>
                            </span>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-6 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                            Hủy
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={submitting || inputAmount <= 0 || remainingDebt <= 0}
                            className={`px-8 py-2.5 bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-sm font-bold rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-2 ${
                                submitting || inputAmount <= 0 || remainingDebt <= 0
                                    ? 'opacity-50 cursor-not-allowed'
                                    : 'active:scale-95'
                            }`}
                        >
                            <span className="material-symbols-outlined notranslate text-[18px]" translate="no">
                                {submitting ? 'hourglass_top' : 'payments'}
                            </span>
                            {submitting
                                ? 'Đang xử lý...'
                                : `Xác nhận thanh toán ${inputAmount > 0 ? fmt(inputAmount) + 'đ' : ''}`
                            }
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
