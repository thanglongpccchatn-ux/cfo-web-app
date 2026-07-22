import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { fmt, formatInputNumber } from '../utils/formatters';
import { smartToast } from '../utils/globalToast';
import { stageCap, stageDef } from '../utils/laborStages';

/**
 * Duyệt đề nghị thanh toán nhân công (bước 2). Kế toán trưởng/GĐ nhập SỐ DUYỆT
 * (mặc định = số đề nghị, có thể duyệt thấp hơn). Gọi RPC approve_labor_request.
 * Cũng cho phép TỪ CHỐI (reject_labor_request).
 */
export default function LaborApproveModal({ isOpen, onClose, onSuccess, labor }) {
    const [approvedAmount, setApprovedAmount] = useState('');
    const [note, setNote] = useState('');
    const [ctx, setCtx] = useState(null);     // dòng view công nợ của hợp đồng (để tính trần)
    const [confirmOver, setConfirmOver] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen && labor) {
            setApprovedAmount(String(labor.requested_amount || ''));
            setNote(''); setConfirmOver(false); setCtx(null);
            if (labor.contract_id) {
                supabase.from('v_subcontractor_contract_debt').select('*')
                    .eq('contract_id', labor.contract_id).maybeSingle()
                    .then(({ data }) => setCtx(data || null));
            }
        }
    }, [isOpen, labor?.id]);

    if (!isOpen || !labor) return null;

    const requested = Number(labor.requested_amount) || 0;
    const approved = Number(approvedAmount) || 0;

    // Trần lũy kế của mốc này = GT hợp đồng × pct%. Đã duyệt của các phiếu KHÁC + phiếu này.
    const cap = stageCap(labor.payment_stage, ctx);
    const daDuyetKhac = Math.max(0, (Number(ctx?.gt_duyet) || 0) - (Number(labor.approved_amount) || 0));
    const conDuoc = cap ? Math.max(0, cap.tran - daDuyetKhac) : null;
    const vuotTran = cap != null && approved > conDuoc + 1;

    const doApprove = async (e) => {
        e.preventDefault();
        if (approved <= 0) { smartToast('Nhập số duyệt', 'error'); return; }
        if (vuotTran && !confirmOver) {
            smartToast('Số duyệt vượt trần giai đoạn — tích xác nhận để tiếp tục', 'warning');
            return;
        }
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

                    {/* Trần thanh toán theo mốc — chặn mềm khi duyệt vượt */}
                    {cap && (
                        <div className={`rounded-xl px-3 py-2.5 border text-[11.5px] ${vuotTran ? 'bg-rose-50 border-rose-200' : 'bg-indigo-50/60 border-indigo-100'}`}>
                            <div className="flex items-center justify-between gap-2">
                                <span className="font-bold text-slate-600">Trần mốc <b className="text-indigo-700">{stageDef(labor.payment_stage)?.label}</b> ({cap.pct}%)</span>
                                <span className="font-black text-slate-700 tabular-nums">còn duyệt được {fmt(conDuoc)} ₫</span>
                            </div>
                            {vuotTran && (
                                <label className="mt-2 flex items-start gap-2 cursor-pointer">
                                    <input type="checkbox" checked={confirmOver} onChange={(e) => setConfirmOver(e.target.checked)} className="mt-0.5 w-4 h-4 accent-rose-500" />
                                    <span className="text-rose-700 font-medium">
                                        Số duyệt <b>{fmt(approved)}</b> vượt trần <b>{fmt(cap.tran)}</b> (đã duyệt {fmt(daDuyetKhac)}). Tôi xác nhận <b>duyệt vượt trần</b>.
                                    </span>
                                </label>
                            )}
                        </div>
                    )}

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
