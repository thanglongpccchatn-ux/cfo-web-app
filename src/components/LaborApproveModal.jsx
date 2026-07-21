import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { fmt, formatInputNumber } from '../utils/formatters';
import { smartToast } from '../utils/globalToast';

/**
 * Duyệt đề nghị thanh toán nhân công (bước 2). Kế toán trưởng/GĐ nhập SỐ DUYỆT
 * (mặc định = số đề nghị, có thể duyệt thấp hơn). Gọi RPC approve_labor_request.
 * Cũng cho phép TỪ CHỐI (reject_labor_request).
 */
export default function LaborApproveModal({ isOpen, onClose, onSuccess, labor }) {
    const [approvedAmount, setApprovedAmount] = useState('');
    const [note, setNote] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen && labor) {
            setApprovedAmount(String(labor.requested_amount || ''));
            setNote('');
        }
    }, [isOpen, labor?.id]);

    if (!isOpen || !labor) return null;

    const requested = Number(labor.requested_amount) || 0;
    const approved = Number(approvedAmount) || 0;

    const doApprove = async (e) => {
        e.preventDefault();
        if (approved <= 0) { smartToast('Nhập số duyệt', 'error'); return; }
        setSubmitting(true);
        const { error } = await supabase.rpc('approve_labor_request', {
            p_id: labor.id, p_approved_amount: approved, p_note: note || null,
        });
        setSubmitting(false);
        if (error) {
            const m = error.message || '';
            smartToast(m.includes('forbidden') ? 'Bạn không có quyền duyệt (cần approve_labor)'
                : m.includes('cho duyet') ? 'Đề nghị không ở trạng thái chờ duyệt'
                : m.includes('PGRST202') ? 'Chưa có RPC — chạy db/labor_02_rpc_request.sql'
                : 'Lỗi: ' + m, 'error');
            return;
        }
        smartToast('Đã duyệt đề nghị', 'success');
        onSuccess?.(); onClose();
    };

    const doReject = async () => {
        if (!window.confirm('Từ chối đề nghị này?')) return;
        setSubmitting(true);
        const { error } = await supabase.rpc('reject_labor_request', { p_id: labor.id, p_note: note || null });
        setSubmitting(false);
        if (error) { smartToast('Lỗi: ' + error.message, 'error'); return; }
        smartToast('Đã từ chối đề nghị', 'success');
        onSuccess?.(); onClose();
    };

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200/50 animate-slide-up">
                <div className="px-6 py-5 bg-gradient-to-r from-indigo-50 to-blue-50 border-b border-slate-100">
                    <div className="flex items-center gap-2 text-[10px] mb-1 uppercase tracking-widest font-bold text-slate-400">
                        <span className="material-symbols-outlined text-[14px] text-indigo-500">verified</span>
                        Kế toán trưởng / Giám đốc · Duyệt
                    </div>
                    <h3 className="text-xl font-extrabold text-slate-800 tracking-tight">Duyệt Đề Nghị Thanh Toán</h3>
                </div>

                <form onSubmit={doApprove} className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <div><div className="text-[10px] text-slate-400 font-bold uppercase">Tổ đội / Nhà thầu</div><div className="font-bold text-slate-800 mt-0.5 truncate">{labor.team_name}</div></div>
                        <div><div className="text-[10px] text-slate-400 font-bold uppercase">Giai đoạn</div><div className="font-medium text-slate-600 mt-0.5">{labor.payment_stage}</div></div>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center">
                        <span className="text-[11px] font-bold text-slate-500 uppercase">Số đề nghị</span>
                        <span className="text-lg font-black text-indigo-700 tabular-nums">{fmt(requested)} ₫</span>
                    </div>

                    <div>
                        <label className="block text-[11px] font-extrabold text-indigo-600 uppercase tracking-wider mb-2">Số duyệt <span className="text-rose-500">*</span></label>
                        <input required autoFocus inputMode="numeric"
                            value={approvedAmount ? formatInputNumber(approvedAmount) : ''}
                            onChange={(e) => setApprovedAmount(e.target.value.replace(/[^0-9]/g, ''))}
                            className="w-full bg-white border-2 border-indigo-300 rounded-xl px-4 py-3 text-lg text-right font-black text-indigo-700 focus:ring-2 focus:ring-indigo-500 outline-none" />
                        {approved !== requested && approved > 0 && (
                            <div className="mt-1.5 text-right text-[11px] font-bold text-amber-600">
                                Duyệt {approved < requested ? 'thấp hơn' : 'cao hơn'} đề nghị {fmt(Math.abs(requested - approved))} ₫
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Ghi chú duyệt</label>
                        <input value={note} onChange={(e) => setNote(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="VD: đồng ý khối lượng..." />
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex gap-2">
                        <button type="button" onClick={doReject} disabled={submitting}
                            className="px-4 py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-50 rounded-xl border border-rose-200 transition-all disabled:opacity-50">Từ chối</button>
                        <button type="button" onClick={onClose}
                            className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl border border-slate-200 transition-all">Hủy</button>
                        <button type="submit" disabled={submitting}
                            className="flex-1 px-4 py-2.5 bg-gradient-to-br from-indigo-600 to-blue-700 text-white text-sm font-bold rounded-xl shadow-lg active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                            {submitting ? <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span> : <span className="material-symbols-outlined text-[18px]">check</span>}
                            Duyệt
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
