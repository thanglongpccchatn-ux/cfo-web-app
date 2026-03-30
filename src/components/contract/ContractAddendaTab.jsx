import React from 'react';
import { fmt, fmtDate } from '../../utils/formatters';

export default function ContractAddendaTab({ project, addendas, approvedAddendas, totalAddendasValue, satecoContractRatio, onOpenFullscreen }) {
    return (
        <div className="glass-panel shadow-sm border border-slate-200/60 overflow-hidden bg-white/70">
            <div className="flex justify-between items-center p-6 border-b border-slate-200/60 bg-rose-50/50">
                <div>
                     <h3 className="font-bold text-lg mb-1 flex items-center gap-3">
                        <span className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600 shadow-sm border border-rose-200/50">
                            <span className="material-symbols-outlined notranslate text-[22px]" translate="no">post_add</span>
                        </span>
                        Lịch sử Phụ lục phát sinh ({addendas.length})
                    </h3>
                    <p className="text-sm font-medium text-slate-500 ml-14">Quản lý nâng/giảm giá trị Hợp đồng pháp lý gốc.</p>
                </div>
                <button onClick={() => onOpenFullscreen('addenda_new', project)} className="btn bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold shadow-md shadow-rose-500/20 flex items-center gap-2">
                    <span className="material-symbols-outlined notranslate text-[18px]" translate="no">add</span> Thêm phụ lục mới
                </button>
            </div>
            
            <div className="p-8">
                {addendas.length === 0 ? (
                    <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200 flex flex-col items-center">
                        <div className="w-20 h-20 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center mb-5">
                            <span className="material-symbols-outlined notranslate text-5xl text-slate-300" translate="no">post_add</span>
                        </div>
                        <p className="font-bold text-slate-600 text-lg mb-1">Dự án chưa có phát sinh</p>
                        <p className="text-sm text-slate-400 font-medium">Bấm "Thêm phụ lục mới" để ghi nhận biến động giá trị.</p>
                    </div>
                ) : (
                    <div className="relative">
                        {/* Timeline line */}
                        <div className="absolute left-[39px] top-6 bottom-6 w-0.5 bg-slate-200" />
                        <div className="space-y-8 ml-[14px]">
                            {addendas.map((a, i) => (
                                <div key={a.id} className="relative flex items-start gap-6 group pl-[26px]">
                                    {/* Timeline dot */}
                                    <div className={`absolute -left-1.5 top-5 w-[22px] h-[22px] rounded-full border-[4px] border-white shadow-sm z-10 transition-transform group-hover:scale-125 ${a.status === 'Đã duyệt' ? 'bg-emerald-500' : a.status === 'Chờ duyệt' ? 'bg-orange-400' : 'bg-slate-400'}`} />
                                    
                                    <div className="glass-panel w-full bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                                        <div className="flex justify-between items-start mb-4 border-b border-slate-100 pb-4">
                                            <div>
                                                <div className="font-black text-lg text-slate-800 mb-0.5 flex items-center gap-2">
                                                    <span className="text-rose-600">#{addendas.length - i}</span> Phụ lục Hợp đồng
                                                </div>
                                                <div className="text-sm font-medium text-slate-500 flex items-center gap-1.5">
                                                    <span className="material-symbols-outlined notranslate text-[16px]" translate="no">event</span> {fmtDate(a.created_at)}
                                                </div>
                                            </div>
                                            <span className={`px-4 py-1.5 rounded-md text-[11px] font-black uppercase tracking-widest border ${a.status === 'Đã duyệt' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : a.status === 'Chờ duyệt' ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                                                {a.status}
                                            </span>
                                        </div>

                                        {a.description && (
                                            <p className="text-sm font-medium text-slate-600 mb-5 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">{a.description}</p>
                                        )}

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm mt-2">
                                            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex flex-col justify-center">
                                                <div className="text-[10px] font-black text-slate-400 mb-1 uppercase tracking-widest">Giá trị tăng thêm (Yêu cầu)</div>
                                                <div className="font-black text-slate-800 text-xl">{fmt(a.requested_value)} ₫</div>
                                            </div>
                                            <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-100/50 flex flex-col justify-center relative overflow-hidden">
                                                <div className="absolute top-0 right-0 w-16 h-16 bg-blue-100 rounded-full blur-[20px]"></div>
                                                <div className="text-[10px] font-black text-blue-500 mb-1 uppercase tracking-widest relative z-10">Tự động phân quỹ Sateco ({project.sateco_contract_ratio || 98}%)</div>
                                                <div className="font-black text-blue-700 text-xl relative z-10">{fmt(Number(a.requested_value) * satecoContractRatio)} ₫</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Summary */}
                        <div className="mt-8 ml-[56px] bg-slate-50 rounded-2xl border border-slate-200 p-6 flex justify-between items-center shadow-sm relative overflow-hidden">
                             <div className="absolute top-0 right-0 w-32 h-32 bg-orange-100 rounded-full blur-[40px] -z-0"></div>
                            <div className="text-sm font-medium text-slate-600 relative z-10">
                                Đã phê duyệt <span className="font-black text-rose-600 text-lg mx-1">{approvedAddendas.length}</span> / {addendas.length} phụ lục
                            </div>
                            <div className="text-right relative z-10">
                                <div className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1">Tổng tiền phát sinh đã duyệt</div>
                                <div className="font-black text-rose-600 text-3xl tabular-nums tracking-tight">+{fmt(totalAddendasValue)} ₫</div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
