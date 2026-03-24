import React from 'react';
import { inputBase, labelBase, fmt } from './contractHelpers';

export default function ContractWarranty({
    handoverDate, setHandoverDate,
    warrantyRatio, setWarrantyRatio,
    warrantyPeriod, setWarrantyPeriod,
    hasWarrantyBond, setHasWarrantyBond,
    warrantySchedule, setWarrantySchedule,
    warrantyAmount, totalValue
}) {
    return (
        <section id="warranty" className="glass-panel p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-amber-50 rounded-full blur-[80px] -z-10"></div>
            <h2 className="text-lg font-black mb-10 flex items-center gap-4 pb-4 border-b border-slate-100/50">
                <span className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-50 to-white border border-amber-100 text-amber-600 flex items-center justify-center shadow-sm relative group overflow-hidden">
                     <div className="absolute inset-0 bg-amber-100/20 translate-y-full group-hover:translate-y-0 transition-transform"></div>
                     <span className="material-symbols-outlined notranslate text-[26px] relative z-10" translate="no">verified_user</span>
                </span>
                <div>
                    <span className="block text-[10px] font-black text-amber-600/60 uppercase tracking-[0.2em] mb-0.5">Vận hành & Hậu mãi</span>
                    6. Bảo hành Dự án
                </div>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
                <div>
                    <label className={labelBase}>Ngày bàn giao thực tế</label>
                    <input type="date" value={handoverDate} onChange={e => setHandoverDate(e.target.value)} className={`${inputBase} border-blue-200 bg-blue-50/20`} />
                    <p className="text-[10px] text-slate-400 mt-1 italic">Mốc để tính ngày thu bảo hành</p>
                </div>
                <div>
                    <label className={labelBase}>Tỷ lệ bảo hành (%)</label>
                    <div className="relative">
                        <input type="number" step="0.5" value={warrantyRatio} onChange={e => setWarrantyRatio(Number(e.target.value))} className={`${inputBase} pr-10`} />
                        <span className="absolute right-4 top-[14px] text-slate-400 pointer-events-none">%</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">Giá trị: <span className="font-bold text-amber-600">{fmt(warrantyAmount)} ₫</span></p>
                </div>
                <div>
                    <label className={labelBase}>Thời gian bảo hành</label>
                    <div className="relative">
                        <input type="number" value={warrantyPeriod} onChange={e => setWarrantyPeriod(Number(e.target.value))} className={`${inputBase} pr-16`} />
                        <span className="absolute right-4 top-[14px] text-slate-400 pointer-events-none text-xs">tháng</span>
                    </div>
                </div>
                <div>
                    <label className={labelBase}>Bảo lãnh bảo hành</label>
                    <div
                        onClick={() => setHasWarrantyBond(!hasWarrantyBond)}
                        className={`w-full rounded-xl border p-3.5 text-sm font-bold cursor-pointer transition-all shadow-sm flex items-center gap-3 h-[48px] ${hasWarrantyBond ? 'bg-green-50 border-green-300 text-green-700' : 'bg-white/80 border-slate-200 text-slate-500'}`}
                    >
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${hasWarrantyBond ? 'bg-green-500 border-green-500' : 'border-slate-300'}`}>
                            {hasWarrantyBond && <span className="material-symbols-outlined notranslate text-white text-[14px]" translate="no">check</span>}
                        </div>
                        {hasWarrantyBond ? 'Có bảo lãnh' : 'Không có bảo lãnh'}
                    </div>
                </div>
            </div>

            {/* Special Schedule Splits: Premium UI */}
            <div className="bg-slate-50/80 rounded-3xl border border-slate-200/60 p-8 shadow-inner relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50/50 rounded-full blur-3xl -z-10"></div>
                
                <div className="flex justify-between items-start mb-8">
                    <div>
                        <h3 className="text-sm font-black text-slate-700 flex items-center gap-2 uppercase tracking-tight">
                            <span className="material-symbols-outlined notranslate text-[20px] text-amber-500" translate="no">splitscreen</span>
                            Chia đợt thu hồi bảo hành
                        </h3>
                        <p className="text-[10px] text-slate-400 mt-1 font-medium italic">Dùng cho các hợp đồng có kỳ hạn thu tiền phức tạp (VD: Chia theo năm)</p>
                    </div>
                    <button 
                        onClick={() => setWarrantySchedule([...warrantySchedule, { label: `Đợt ${warrantySchedule.length + 1}`, ratio: 0, months: 12 }])}
                        className="btn bg-white hover:bg-slate-50 text-blue-600 border-blue-200 shadow-sm px-4 py-2 rounded-xl group"
                    >
                        <span className="material-symbols-outlined notranslate text-[18px] group-hover:rotate-90 transition-transform" translate="no">add_circle</span>
                        Thêm đợt thu tiền
                    </button>
                </div>

                {warrantySchedule.length === 0 ? (
                    <div className="text-center py-4 bg-white/40 rounded-xl border border-slate-100">
                        <p className="text-xs text-slate-400 italic">Mặc định thu toàn bộ ({warrantyRatio}%) sau {warrantyPeriod} tháng.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {warrantySchedule.map((stage, idx) => (
                            <div key={idx} className="flex flex-wrap items-center gap-6 bg-white p-6 rounded-2xl shadow-sm border border-slate-100 animate-slide-in relative group/row">
                                <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-500 rounded-full opacity-0 group-hover/row:opacity-100 transition-opacity"></div>
                                
                                <div className="flex-1 min-w-[180px]">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Tên đợt thu tiền</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined notranslate text-slate-300 text-[18px]" translate="no">label</span>
                                        <input type="text" value={stage.label} onChange={e => {
                                            const newS = [...warrantySchedule];
                                            newS[idx].label = e.target.value;
                                            setWarrantySchedule(newS);
                                        }} className="w-full text-xs font-bold bg-slate-50 border-none pl-10 pr-4 py-2.5 rounded-xl focus:ring-2 focus:ring-blue-100 transition-all" />
                                    </div>
                                </div>
                                
                                <div className="w-32">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Tỷ lệ (%)</label>
                                    <div className="relative">
                                        <input type="number" step="0.5" value={stage.ratio} onChange={e => {
                                            const newS = [...warrantySchedule];
                                            newS[idx].ratio = Number(e.target.value);
                                            setWarrantySchedule(newS);
                                        }} className="w-full text-xs font-black bg-blue-50/30 border border-blue-100/50 px-4 py-2.5 rounded-xl text-blue-700 focus:ring-2 focus:ring-blue-100 transition-all" />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-blue-400">%</span>
                                    </div>
                                </div>
                                
                                <div className="w-32">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Kỳ hạn (Tháng)</label>
                                    <div className="relative">
                                        <input type="number" value={stage.months} onChange={e => {
                                            const newS = [...warrantySchedule];
                                            newS[idx].months = Number(e.target.value);
                                            setWarrantySchedule(newS);
                                        }} className="w-full text-xs font-black bg-slate-50 border-none px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-blue-100 transition-all" />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">tháng</span>
                                    </div>
                                </div>

                                <div className="hidden lg:block h-10 w-px bg-slate-100"></div>

                                <div className="min-w-[120px]">
                                    <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1.5">Số tiền dự kiến</p>
                                    <p className="text-xs font-black text-slate-600">{fmt(totalValue * (stage.ratio / 100))} ₫</p>
                                </div>
                                <button 
                                    onClick={() => setWarrantySchedule(warrantySchedule.filter((_, i) => i !== idx))}
                                    className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:bg-rose-50 hover:text-rose-600 mt-4 transition-colors"
                                >
                                    <span className="material-symbols-outlined notranslate text-[18px]" translate="no">delete</span>
                                </button>
                            </div>
                        ))}
                        <div className="flex justify-end pr-4">
                            <p className={`text-[10px] font-bold ${Math.abs(warrantySchedule.reduce((s, a) => s + Number(a.ratio), 0) - warrantyRatio) < 0.01 ? 'text-emerald-600' : 'text-rose-500'}`}>
                                Tổng cộng: {warrantySchedule.reduce((s, a) => s + Number(a.ratio), 0)}% / {warrantyRatio}%
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
}
