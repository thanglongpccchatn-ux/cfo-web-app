import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { fmt, formatInputNumber } from '../utils/formatters';
import { autoJournal } from '../lib/accountingService';

export default function LaborPaymentModal({ isOpen, onClose, onSuccess, labor }) {
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
    const [deductionAmount, setDeductionAmount] = useState('');
    const [deductionReason, setDeductionReason] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Reset form when modal opens with new labor data
    React.useEffect(() => {
        if (isOpen && labor) {
            setPaymentAmount(String(labor.requested_amount || ''));
            setPaymentDate(new Date().toISOString().split('T')[0]);
            setDeductionAmount('');
            setDeductionReason('');
        }
    }, [isOpen, labor?.id]);

    const handleNumChange = (setter) => (value) => {
        setter(value.replace(/[^0-9]/g, ''));
    };

    // Computed values
    const requested = Number(labor?.requested_amount) || 0;
    const deduction = Number(deductionAmount) || 0;
    const netPayment = Number(paymentAmount) || 0;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!paymentAmount || Number(paymentAmount) <= 0) {
            alert('Vui lòng nhập Số tiền thực chi.');
            return;
        }

        setSubmitting(true);
        const paidAmt = Number(paymentAmount);

        const { error } = await supabase
            .from('expense_labor')
            .update({
                paid_amount: paidAmt,
                approved_amount: paidAmt + deduction,
                payment_date: paymentDate,
                deduction_amount: deduction,
                deduction_reason: deductionReason || null,
                status: 'PAID'
            })
            .eq('id', labor.id);

        setSubmitting(false);

        if (error) {
            alert('Lỗi: ' + error.message);
        } else {
            // Auto-create journal entry: Nợ 622 / Có 334
            autoJournal.laborPayment(labor, paidAmt, paymentDate).catch(err =>
                console.warn('[Accounting] Auto journal failed (non-critical):', err)
            );
            onSuccess?.();
            onClose();
        }
    };

    if (!isOpen || !labor) return null;

    const formatDate = (d) => d ? new Date(d).toLocaleDateString('vi-VN') : '—';
    const isCongNhat = labor.request_type === 'Công nhật' || labor.payment_stage === 'Công nhật';

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden border border-slate-200/50 animate-slide-up">
                {/* Header */}
                <div className="px-8 py-6 bg-gradient-to-r from-emerald-50 via-white to-green-50 border-b border-slate-100 relative overflow-hidden">
                    <div className="absolute -right-8 -top-8 w-32 h-32 bg-emerald-100 rounded-full opacity-30 blur-2xl"></div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 text-[10px] mb-2 uppercase tracking-widest font-bold text-slate-400">
                            <span className="material-symbols-outlined text-[14px] text-emerald-500">account_balance</span>
                            <span>Kế Toán / Thủ Quỹ</span>
                            <span className="material-symbols-outlined text-[12px]">chevron_right</span>
                            <span className="text-emerald-700">Bước 2: Xác nhận Giải ngân</span>
                        </div>
                        <h3 className="text-2xl font-extrabold text-slate-800 tracking-tight flex items-center gap-3">
                            <span className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 border border-emerald-200 shadow-sm">
                                <span className="material-symbols-outlined text-[22px]">payments</span>
                            </span>
                            Thanh Toán Nhân Công
                        </h3>
                    </div>
                </div>

                {/* Read-only: Thông tin phiếu gốc */}
                <div className="px-8 py-5 bg-slate-50/80 border-b border-slate-100">
                    <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[13px]">description</span>
                        Thông tin Yêu cầu Gốc (Chỉ xem)
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Tổ đội</div>
                            <div className="text-sm font-bold text-slate-800 mt-0.5">{labor.team_name}</div>
                        </div>
                        <div>
                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Dự án</div>
                            <div className="text-sm font-medium text-slate-600 mt-0.5">{labor.projects?.code || labor.projects?.name || '—'}</div>
                        </div>
                        <div>
                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Giai đoạn</div>
                            <div className="text-sm font-medium text-slate-600 mt-0.5">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                    isCongNhat ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-purple-50 text-purple-700 border-purple-100'
                                }`}>
                                    {isCongNhat && '🔨 '}{labor.payment_stage}
                                </span>
                            </div>
                        </div>
                        <div>
                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Ngày đề nghị</div>
                            <div className="text-sm font-medium text-slate-600 mt-0.5">{formatDate(labor.request_date)}</div>
                        </div>
                    </div>

                    {/* Công nhật detail */}
                    {isCongNhat && Number(labor.daily_labor_count) > 0 && (
                        <div className="mt-3 p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs">
                            <div className="flex justify-between items-center">
                                <span className="font-bold text-amber-700">
                                    <span className="material-symbols-outlined text-[12px] align-middle mr-1">construction</span>
                                    {labor.daily_labor_count} công × {fmt(labor.daily_labor_rate)} ₫/công
                                </span>
                                <span className="font-black text-amber-800">{fmt(Number(labor.daily_labor_count) * Number(labor.daily_labor_rate))} ₫</span>
                            </div>
                        </div>
                    )}

                    {/* Highlighted: Số tiền đề nghị */}
                    <div className="mt-4 p-4 bg-indigo-50 rounded-xl border border-indigo-200">
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] font-extrabold text-indigo-500 uppercase tracking-wider">Số tiền Đề nghị</span>
                            <span className="text-xl font-black text-indigo-700 tabular-nums">{fmt(labor.requested_amount)} ₫</span>
                        </div>
                    </div>

                    {labor.priority && labor.priority !== 'Bình thường' && (
                        <div className="mt-3 flex items-center gap-2">
                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border ${
                                labor.priority === 'Khẩn cấp' ? 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse' :
                                'bg-orange-50 text-orange-700 border-orange-200'
                            }`}>
                                {labor.priority === 'Khẩn cấp' ? '🚨 ' : '🔥 '}{labor.priority}
                            </span>
                        </div>
                    )}

                    {labor.notes && (
                        <div className="mt-3 text-[11px] text-slate-500 italic bg-white p-2.5 rounded-lg border border-slate-100">
                            <span className="material-symbols-outlined text-[12px] align-middle mr-1">chat</span>
                            "{labor.notes}"
                        </div>
                    )}
                </div>

                {/* Editable: Kế toán nhập */}
                <form onSubmit={handleSubmit} className="px-8 py-6 space-y-5 max-h-[45vh] overflow-y-auto">
                    <div className="text-[10px] font-extrabold text-emerald-600 uppercase tracking-widest flex items-center gap-1">
                        <span className="material-symbols-outlined text-[13px]">edit_note</span>
                        Kế Toán Điền Thông Tin Giải Ngân
                    </div>

                    {/* ⛔ KHẤU TRỪ / PHẠT */}
                    <div className="p-4 bg-rose-50/60 border border-rose-200 rounded-xl space-y-3">
                        <div className="text-[10px] font-extrabold text-rose-600 uppercase tracking-widest flex items-center gap-1">
                            <span className="material-symbols-outlined text-[13px]">block</span>
                            Khấu trừ / Phạt (nếu có)
                        </div>
                        <div className="grid grid-cols-5 gap-3">
                            <div className="col-span-2 space-y-1">
                                <label className="block text-[10px] font-bold text-rose-500 uppercase">Số tiền khấu trừ</label>
                                <input
                                    placeholder="0"
                                    value={deductionAmount ? formatInputNumber(deductionAmount) : ''}
                                    onChange={(e) => handleNumChange(setDeductionAmount)(e.target.value)}
                                    className="w-full bg-white border border-rose-300 rounded-xl px-4 py-2.5 text-sm text-right font-bold text-rose-700 focus:ring-2 focus:ring-rose-400 outline-none"
                                />
                            </div>
                            <div className="col-span-3 space-y-1">
                                <label className="block text-[10px] font-bold text-rose-500 uppercase">Lý do</label>
                                <input
                                    placeholder="VD: Phạt chậm, khấu trừ vật tư..."
                                    value={deductionReason}
                                    onChange={(e) => setDeductionReason(e.target.value)}
                                    className="w-full bg-white border border-rose-300 rounded-xl px-4 py-2.5 text-sm text-slate-700 focus:ring-2 focus:ring-rose-400 outline-none"
                                />
                            </div>
                        </div>
                        {deduction > 0 && (
                            <div className="text-right text-xs font-bold text-rose-600 bg-rose-100 rounded-lg px-3 py-1.5 border border-rose-200">
                                Giảm trừ: <span className="text-rose-700 font-black">-{fmt(deduction)} ₫</span>
                            </div>
                        )}
                    </div>

                    {/* Số tiền thực chi */}
                    <div className="p-5 bg-gradient-to-r from-emerald-50 to-green-50 rounded-xl border border-emerald-200 shadow-sm">
                        <label className="block text-[11px] font-extrabold text-emerald-600 uppercase tracking-wider mb-2">
                            <span className="material-symbols-outlined text-[14px] align-middle mr-1">currency_exchange</span>
                            Số tiền Thực chi (Sateco) <span className="text-rose-500">*</span>
                        </label>
                        <input
                            required
                            placeholder="Nhập số tiền thực trả..."
                            value={paymentAmount ? formatInputNumber(paymentAmount) : ''}
                            onChange={(e) => handleNumChange(setPaymentAmount)(e.target.value)}
                            className="w-full bg-white border-2 border-emerald-300 rounded-xl px-5 py-4 text-lg text-right font-black text-emerald-700 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all shadow-inner"
                            autoFocus
                        />

                        {/* Breakdown summary */}
                        <div className="mt-3 space-y-1.5 text-xs border-t border-emerald-200 pt-3">
                            <div className="flex justify-between text-slate-600">
                                <span>Đề nghị thanh toán</span>
                                <span className="font-bold tabular-nums">{fmt(requested)} ₫</span>
                            </div>
                            {deduction > 0 && (
                                <div className="flex justify-between text-rose-600">
                                    <span>Khấu trừ / Phạt</span>
                                    <span className="font-bold tabular-nums">-{fmt(deduction)} ₫</span>
                                </div>
                            )}
                            <div className="flex justify-between text-emerald-700 font-black text-sm border-t border-emerald-200 pt-2">
                                <span>Thực chi</span>
                                <span className="tabular-nums text-base">{fmt(netPayment)} ₫</span>
                            </div>
                            {deduction > 0 && netPayment !== (requested - deduction) && (
                                <div className="flex items-center gap-1 text-amber-600 mt-1">
                                    <span className="material-symbols-outlined text-[12px]">warning</span>
                                    <span className="font-bold">Thực chi ≠ Đề nghị - Khấu trừ ({fmt(requested - deduction)})</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Ngày thanh toán */}
                    <div className="space-y-2">
                        <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                            <span className="material-symbols-outlined text-[13px] align-middle mr-1">calendar_month</span>
                            Ngày thanh toán
                        </label>
                        <input
                            type="date"
                            value={paymentDate}
                            onChange={(e) => setPaymentDate(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        />
                    </div>

                    {/* Actions */}
                    <div className="pt-5 border-t border-slate-100 flex justify-between items-center">
                        <div className="text-[10px] text-slate-400 font-medium">
                            <span className="material-symbols-outlined text-[14px] align-middle mr-1">info</span>
                            Phiếu sẽ chuyển sang trạng thái <span className="font-black text-emerald-600">Đã Chi Tiền</span>
                        </div>
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-6 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                            >
                                Hủy bỏ
                            </button>
                            <button
                                type="submit"
                                disabled={submitting}
                                className="px-8 py-2.5 bg-gradient-to-br from-emerald-600 to-green-700 text-white text-sm font-bold rounded-xl shadow-lg shadow-emerald-500/20 hover:shadow-xl hover:shadow-emerald-500/30 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center gap-2"
                            >
                                {submitting ? (
                                    <>
                                        <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                                        Đang xử lý...
                                    </>
                                ) : (
                                    <>
                                        <span className="material-symbols-outlined text-[18px]">check_circle</span>
                                        Xác Nhận Thanh Toán
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
