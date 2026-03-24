import React from 'react';
import { fmt } from './dtkHelpers';

export default function PaymentHistoryRow({ expandedId, item, historyLoading, paymentHistory, generateHistory }) {
    if (expandedId !== item.id) return null;

    return (
        <tr className="bg-slate-50 border-b border-slate-100 animate-in slide-in-from-top-1 duration-300">
            <td colSpan="13" className="p-0">
                <div className="px-8 py-6 bg-white shadow-inner border-x-4 border-blue-500">
                    <div className="flex items-center justify-between mb-4">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                            <span className="w-6 h-[1px] bg-slate-200"></span>
                            LỊCH SỬ THANH TOÁN CHI TIẾT
                        </h4>
                        <div className="text-[10px] font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
                            Dự án: <span className="text-blue-600">{item.projects?.internal_code || item.projects?.code}</span>
                        </div>
                    </div>

                    {historyLoading ? (
                        <div className="py-8 flex flex-col items-center justify-center gap-2">
                            <div className="w-6 h-6 border-2 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
                            <p className="text-[10px] text-slate-400 font-bold italic">Đang tải dữ liệu...</p>
                        </div>
                    ) : paymentHistory.length === 0 ? (
                         <div className="py-10 text-center bg-slate-50/50 rounded-[24px] border border-dashed border-slate-200 flex flex-col items-center justify-center gap-4">
                             <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-300">
                                 <span className="material-symbols-outlined notranslate text-3xl" translate="no">history</span>
                             </div>
                             <div className="max-w-xs">
                                 <p className="text-[11px] text-slate-500 font-black uppercase tracking-wider mb-1">Chưa có bản ghi lịch sử</p>
                                 <p className="text-[10px] text-slate-400 font-medium leading-relaxed italic">Hồ sơ này có thể đã được nhập số tổng từ trước mà chưa có chi tiết các lần thu.</p>
                             </div>
                             
                             {Number(item.external_income || 0) > 0 && (
                                 <button 
                                     onClick={(e) => { e.stopPropagation(); generateHistory(item); }}
                                     className="mt-2 px-6 py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-xl text-[10px] font-black transition-all border border-emerald-100 flex items-center gap-2 group"
                                 >
                                     <span className="material-symbols-outlined notranslate text-[16px]" translate="no">auto_fix</span>
                                     TẠO NHANH BẢN GHI LỊCH SỬ ({fmt(item.external_income)} ₫)
                                 </button>
                             )}
                         </div>
                     ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {paymentHistory.map((hist, idx) => (
                                <div key={hist.id} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-start gap-4">
                                    <div className="w-8 h-8 rounded-full bg-slate-50 text-slate-400 text-[10px] font-black flex items-center justify-center">
                                        {paymentHistory.length - idx}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="text-[11px] font-black text-slate-700">{new Date(hist.payment_date).toLocaleDateString('vi-VN')}</span>
                                            <span className="text-sm font-black text-emerald-600 tabular-nums">{fmt(hist.amount)} <span className="text-[9px]">₫</span></span>
                                        </div>
                                        <p className="text-[10px] text-slate-400 font-medium italic line-clamp-2 leading-relaxed">{hist.description || '(Không có ghi chú)'}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    
                    <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end items-center gap-3">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">TỔNG CỘNG ĐÃ THU:</span>
                        <span className="text-base font-black text-emerald-600 tabular-nums">
                            {fmt(paymentHistory.reduce((sum, h) => sum + Number(h.amount), 0))} <span className="text-[11px]">₫</span>
                        </span>
                    </div>
                </div>
            </td>
        </tr>
    );
}
