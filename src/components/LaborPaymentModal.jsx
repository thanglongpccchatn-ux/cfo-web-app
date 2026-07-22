import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { fmt, formatInputNumber } from '../utils/formatters';
import { smartToast } from '../utils/globalToast';
import { useAuth } from '../context/AuthContext';

/**
 * Chi tiền thanh toán nhân công — CHI NHIỀU ĐỢT cho 1 đề nghị đã duyệt.
 * Gọi RPC pay_labor (bút toán 622/334 sinh trong transaction). Hiển thị lịch sử
 * các đợt đã chi + số còn lại; cảnh báo khi chi vượt số duyệt.
 */
export default function LaborPaymentModal({ isOpen, onClose, onSuccess, labor }) {
    const { hasPermission, profile } = useAuth();
    const isAdmin = profile?.role_code === 'ROLE01' || profile?.role_code === 'ADMIN';
    const canPay = isAdmin || hasPermission('pay_labor');

    const [amount, setAmount] = useState('');
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
    const [method, setMethod] = useState('Chuyển khoản');
    const [deduction, setDeduction] = useState('');
    const [deductionReason, setDeductionReason] = useState('');
    const [allowOver, setAllowOver] = useState(false);
    const [note, setNote] = useState('');
    const [history, setHistory] = useState([]);
    const [advance, setAdvance] = useState(null);   // { tam_ung, da_khau_tru } của hợp đồng
    const [submitting, setSubmitting] = useState(false);

    // Số duyệt là mốc chi (chưa duyệt thì lấy số đề nghị)
    const approved = Number(labor?.approved_amount) || Number(labor?.requested_amount) || 0;
    const paidBefore = history.reduce((s, h) => s + Number(h.amount || 0), 0);
    const remaining = Math.max(0, approved - paidBefore);
    const payAmt = Number(amount) || 0;
    const willOver = paidBefore + payAmt > approved + 1;

    useEffect(() => {
        if (!isOpen || !labor?.id) return;
        setPaymentDate(new Date().toISOString().split('T')[0]);
        setMethod('Chuyển khoản');
        setDeduction(''); setDeductionReason(''); setAllowOver(false); setNote('');
        setAdvance(null);
        (async () => {
            const { data } = await supabase
                .from('labor_payments')
                .select('*')
                .eq('labor_id', labor.id)
                .order('payment_date', { ascending: true });
            const rows = data || [];
            setHistory(rows);
            const paid = rows.reduce((s, h) => s + Number(h.amount || 0), 0);
            setAmount(String(Math.max(0, approved - paid) || ''));

            // Tạm ứng của hợp đồng + tổng đã khấu trừ (để nhắc kế toán thu hồi dần).
            // Chỉ hiển thị — kế toán tự nhập ô khấu trừ, hệ thống không tự trừ.
            if (labor.contract_id) {
                const { data: c } = await supabase
                    .from('v_subcontractor_contract_debt')
                    .select('tam_ung, gt_khau_tru')
                    .eq('contract_id', labor.contract_id)
                    .maybeSingle();
                if (c) setAdvance({ tam_ung: Number(c.tam_ung) || 0, da_khau_tru: Number(c.gt_khau_tru) || 0 });
            }
        })();
    }, [isOpen, labor?.id]);

    const advanceRemaining = advance ? Math.max(0, advance.tam_ung - advance.da_khau_tru) : 0;

    const handleNum = (setter) => (v) => setter(v.replace(/[^0-9]/g, ''));

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!canPay) { smartToast('Bạn không có quyền chi tiền (cần quyền pay_labor)', 'error'); return; }
        if (payAmt <= 0) { smartToast('Nhập số tiền thực chi', 'error'); return; }
        if (willOver && !allowOver) {
            smartToast('Số chi vượt số duyệt — tích "Cho phép chi vượt" để tiếp tục', 'warning');
            return;
        }

        setSubmitting(true);
        const { data, error } = await supabase.rpc('pay_labor', {
            p_labor_id: labor.id,
            p_amount: payAmt,
            p_deduction: Number(deduction) || 0,
            p_deduction_reason: deductionReason || null,
            p_payment_date: paymentDate,
            p_payment_method: method,
            p_note: note || null,
            p_allow_over: allowOver,
        });
        setSubmitting(false);

        if (error) {
            const m = error.message || '';
            const msg = m.includes('CHUA DUOC DUYET') ? 'Đề nghị chưa được duyệt — không thể chi'
                : m.includes('CHI VUOT') ? 'Chi vượt số duyệt — tích "Cho phép chi vượt" để tiếp tục'
                : m.includes('forbidden') ? 'Bạn không có quyền chi tiền'
                : m.includes('ky ke toan') ? 'Chưa có kỳ kế toán mở cho ngày này — mở kỳ trước khi chi'
                : m.includes('PGRST202') ? 'Chưa có RPC pay_labor — cần chạy db/labor_03_rpc_pay.sql'
                : 'Lỗi: ' + m;
            smartToast(msg, 'error');
            return;
        }

        const res = data || {};
        let ok = res.status === 'PAID' ? 'Đã chi đủ đề nghị' : 'Đã ghi nhận đợt chi';
        if (res.is_over) ok += ' (chi VƯỢT số duyệt)';
        smartToast(ok, 'success');
        if (res.contract_over) smartToast('⚠️ Lũy kế chi đã VƯỢT giá trị hợp đồng!', 'warning');
        onSuccess?.();
        onClose();
    };

    if (!isOpen || !labor) return null;
    const isCongNhat = labor.request_type === 'Công nhật' || labor.payment_stage === 'Công nhật';

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white w-full h-[100dvh] sm:h-auto sm:max-h-[92vh] max-w-xl sm:rounded-2xl shadow-2xl overflow-hidden border border-slate-200/50 flex flex-col animate-slide-up">
                {/* Header */}
                <div className="px-5 sm:px-8 py-5 bg-gradient-to-r from-emerald-50 via-white to-green-50 border-b border-slate-100 shrink-0">
                    <div className="flex items-center gap-2 text-[10px] mb-1.5 uppercase tracking-widest font-bold text-slate-400">
                        <span className="material-symbols-outlined text-[14px] text-emerald-500">account_balance</span>
                        Kế toán / Thủ quỹ · Giải ngân
                    </div>
                    <h3 className="text-xl sm:text-2xl font-extrabold text-slate-800 tracking-tight flex items-center gap-3">
                        <span className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 border border-emerald-200 shrink-0">
                            <span className="material-symbols-outlined text-[22px]">payments</span>
                        </span>
                        Chi Thanh Toán Nhân Công
                    </h3>
                </div>

                <div className="overflow-y-auto flex-1">
                    {/* Thông tin phiếu + tiến độ chi */}
                    <div className="px-5 sm:px-8 py-4 bg-slate-50/80 border-b border-slate-100">
                        <div className="grid grid-cols-2 gap-3 text-sm">
                            <div><div className="text-[10px] text-slate-400 font-bold uppercase">Tổ đội / Nhà thầu</div><div className="font-bold text-slate-800 mt-0.5 truncate">{labor.team_name}</div></div>
                            <div><div className="text-[10px] text-slate-400 font-bold uppercase">Giai đoạn</div><div className="font-medium text-slate-600 mt-0.5">{labor.payment_stage}</div></div>
                        </div>
                        {/* Thanh tiến độ chi */}
                        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                            <div className="p-2 rounded-lg bg-white border border-slate-200">
                                <div className="text-[9px] text-slate-400 font-bold uppercase">Số duyệt</div>
                                <div className="text-sm font-black text-indigo-700 tabular-nums">{fmt(approved)}</div>
                            </div>
                            <div className="p-2 rounded-lg bg-white border border-slate-200">
                                <div className="text-[9px] text-slate-400 font-bold uppercase">Đã chi</div>
                                <div className="text-sm font-black text-emerald-600 tabular-nums">{fmt(paidBefore)}</div>
                            </div>
                            <div className="p-2 rounded-lg bg-rose-50 border border-rose-200">
                                <div className="text-[9px] text-rose-400 font-bold uppercase">Còn lại</div>
                                <div className="text-sm font-black text-rose-600 tabular-nums">{fmt(remaining)}</div>
                            </div>
                        </div>

                        {/* Lịch sử các đợt đã chi */}
                        {history.length > 0 && (
                            <div className="mt-3">
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Các đợt đã chi ({history.length})</div>
                                <div className="space-y-1.5">
                                    {history.map((h, i) => (
                                        <div key={h.id} className="flex items-center justify-between text-xs bg-white rounded-lg border border-slate-100 px-3 py-1.5">
                                            <span className="text-slate-500">Đợt {i + 1} · {h.payment_date ? new Date(h.payment_date).toLocaleDateString('vi-VN') : '—'}{h.is_over_request && <span className="ml-1 text-rose-500 font-bold">(vượt)</span>}</span>
                                            <span className="font-bold text-emerald-700 tabular-nums">{fmt(h.amount)} ₫</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Form chi đợt này */}
                    <form id="pay-labor-form" onSubmit={handleSubmit} className="px-5 sm:px-8 py-5 space-y-4">
                        <div className="p-4 bg-gradient-to-r from-emerald-50 to-green-50 rounded-xl border border-emerald-200">
                            <label className="block text-[11px] font-extrabold text-emerald-600 uppercase tracking-wider mb-2">
                                Số tiền chi đợt này <span className="text-rose-500">*</span>
                            </label>
                            <input
                                required autoFocus inputMode="numeric"
                                value={amount ? formatInputNumber(amount) : ''}
                                onChange={(e) => handleNum(setAmount)(e.target.value)}
                                className="w-full min-h-[48px] bg-white border-2 border-emerald-300 rounded-xl px-4 py-3 text-lg text-right font-black text-emerald-700 focus:ring-2 focus:ring-emerald-500 outline-none"
                                placeholder="Nhập số tiền..."
                            />
                            {willOver && (
                                <label className="mt-3 flex items-start gap-2 p-2.5 bg-rose-50 border border-rose-200 rounded-lg cursor-pointer">
                                    <input type="checkbox" checked={allowOver} onChange={(e) => setAllowOver(e.target.checked)} className="mt-0.5 w-4 h-4 accent-rose-500" />
                                    <span className="text-[12px] text-rose-700 font-medium">
                                        Tổng chi <b>{fmt(paidBefore + payAmt)}</b> vượt số duyệt <b>{fmt(approved)}</b>. Tôi xác nhận <b>cho phép chi vượt</b>.
                                    </span>
                                </label>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Ngày chi</label>
                                <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)}
                                    className="w-full min-h-[44px] bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Hình thức</label>
                                <select value={method} onChange={(e) => setMethod(e.target.value)}
                                    className="w-full min-h-[44px] bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none">
                                    <option>Chuyển khoản</option>
                                    <option>Tiền mặt</option>
                                </select>
                            </div>
                        </div>

                        {/* Nhắc thu hồi tạm ứng — CHỈ hiển thị, kế toán tự nhập ô khấu trừ */}
                        {advanceRemaining > 0 && (
                            <div className="flex items-center justify-between gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                                <span className="text-[11px] font-bold text-amber-700 flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-[16px]">savings</span>
                                    Còn phải thu hồi tạm ứng
                                    {advance.da_khau_tru > 0 && <span className="text-[10px] font-medium text-amber-500">(đã thu {fmt(advance.da_khau_tru)})</span>}
                                </span>
                                <button type="button"
                                    onClick={() => setDeduction(String(Math.min(advanceRemaining, payAmt || advanceRemaining)))}
                                    title="Điền nhanh vào ô khấu trừ"
                                    className="text-sm font-black text-amber-700 tabular-nums hover:underline">
                                    {fmt(advanceRemaining)} ₫
                                </button>
                            </div>
                        )}

                        <div className="p-3 bg-rose-50/50 border border-rose-100 rounded-xl grid grid-cols-5 gap-2">
                            <div className="col-span-2">
                                <label className="block text-[10px] font-bold text-rose-500 uppercase mb-1">Khấu trừ</label>
                                <input inputMode="numeric" value={deduction ? formatInputNumber(deduction) : ''} onChange={(e) => handleNum(setDeduction)(e.target.value)}
                                    className="w-full bg-white border border-rose-200 rounded-lg px-2.5 py-2 text-sm text-right font-bold text-rose-700 focus:ring-2 focus:ring-rose-400 outline-none" placeholder="0" />
                            </div>
                            <div className="col-span-3">
                                <label className="block text-[10px] font-bold text-rose-500 uppercase mb-1">Lý do khấu trừ</label>
                                <input value={deductionReason} onChange={(e) => setDeductionReason(e.target.value)}
                                    className="w-full bg-white border border-rose-200 rounded-lg px-2.5 py-2 text-sm focus:ring-2 focus:ring-rose-400 outline-none" placeholder="VD: thu hồi tạm ứng, phạt chậm..." />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Ghi chú</label>
                            <input value={note} onChange={(e) => setNote(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="Ghi chú đợt chi..." />
                        </div>
                    </form>
                </div>

                {/* Actions */}
                <div className="px-5 sm:px-8 py-4 border-t border-slate-100 flex gap-3 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
                    <button type="button" onClick={onClose} className="flex-1 min-h-[48px] px-6 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-all border border-slate-200">Hủy</button>
                    <button type="submit" form="pay-labor-form" disabled={submitting || !canPay}
                        className="flex-[2] min-h-[48px] px-6 py-2.5 bg-gradient-to-br from-emerald-600 to-green-700 text-white text-sm font-bold rounded-xl shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                        {submitting
                            ? <><span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>Đang xử lý...</>
                            : <><span className="material-symbols-outlined text-[18px]">check_circle</span>Xác nhận chi {payAmt > 0 ? fmt(payAmt) : ''}</>}
                    </button>
                </div>
            </div>
        </div>
    );
}
