import React from 'react';
import { inputBase, labelBase, formatBillion, formatInputNumber, parseFormattedNumber } from './contractHelpers';

export default function ContractMilestones({
    paymentSchedule,
    milestoneBase, setMilestoneBase,
    addMilestone, removeMilestone, updateMilestone,
    paymentTerms, setPaymentTerms
}) {
    return (
        <section id="milestone" className="glass-panel p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-teal-100 rounded-full blur-[80px] -z-10"></div>
            <h2 className="text-lg font-bold mb-6 flex items-center justify-between pb-4 border-b border-slate-100/50">
                <div className="flex items-center gap-3">
                    <span className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-100 text-teal-600 flex items-center justify-center shadow-sm">
                        <span className="material-symbols-outlined notranslate text-[22px]" translate="no">route</span>
                    </span>
                    4. Lộ trình Thanh toán & Điều khoản (Milestones)
                </div>
            </h2>
                <div className="space-y-4">
                    <div className="flex items-center justify-between mb-2">
                        <div>
                            <div className="mt-2 flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 inline-flex">
                                <button 
                                    type="button"
                                    onClick={() => setMilestoneBase('pre_vat')}
                                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${milestoneBase === 'pre_vat' ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    Tính theo Trước VAT
                                </button>
                                <button 
                                    type="button"
                                    onClick={() => setMilestoneBase('post_vat')}
                                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${milestoneBase === 'post_vat' ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    Tính theo Sau VAT
                                </button>
                            </div>
                        </div>
                        <button 
                            type="button"
                            onClick={addMilestone}
                            className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-black flex items-center gap-1.5 hover:bg-blue-100 transition-all border border-blue-100 self-start mt-1"
                        >
                            <span className="material-symbols-outlined text-[16px]">add_circle</span>
                            THÊM ĐỢT
                        </button>
                    </div>

                    <div className="space-y-2">
                        {paymentSchedule.map((ms, index) => (
                            <div key={ms.id} className="bg-white rounded-xl border border-slate-200 px-3 py-2.5 group hover:border-blue-300 transition-all relative">
                                <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl bg-blue-500 opacity-20 group-hover:opacity-100 transition-opacity"></div>

                                {/* Single compact row: # Name | % | Amount | Days | Guarantee | Delete */}
                                <div className="flex items-center gap-2">
                                    <span className="w-6 h-6 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center text-[10px] font-black border border-blue-100 shrink-0">{index + 1}</span>
                                    <input 
                                        type="text" value={ms.name} 
                                        onChange={e => updateMilestone(ms.id, 'name', e.target.value)}
                                        className="w-[130px] bg-transparent border-none p-0 text-sm font-black text-slate-800 focus:ring-0 outline-none placeholder:text-slate-300 shrink-0"
                                        placeholder="Tên đợt..."
                                    />
                                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                        {/* % */}
                                        <div className="relative w-[82px] shrink-0">
                                            <input type="number" step="0.1" value={ms.percentage} 
                                                onChange={e => updateMilestone(ms.id, 'percentage', e.target.value)}
                                                className="w-full pl-2 pr-7 py-1.5 bg-blue-50/60 border border-blue-200 rounded-lg text-sm font-black text-blue-700 outline-none focus:border-blue-500"
                                                placeholder="0"
                                            />
                                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-black text-blue-400">%</span>
                                        </div>
                                        <span className="text-slate-300 text-xs">=</span>
                                        {/* Amount */}
                                        <div className="relative flex-1 min-w-[100px]">
                                            <input type="text" value={formatInputNumber(ms.amount)} 
                                                onChange={e => updateMilestone(ms.id, 'amount', parseFormattedNumber(e.target.value))}
                                                className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 outline-none focus:border-blue-500"
                                                placeholder="Số tiền..."
                                            />
                                            <span className="absolute -bottom-3.5 right-0 text-[9px] font-bold text-blue-500">≈ {formatBillion(ms.amount)}</span>
                                        </div>
                                        {/* Due Days */}
                                        <div className="relative w-[100px] shrink-0">
                                            <input type="number" value={ms.due_days || ''} 
                                                onChange={e => updateMilestone(ms.id, 'due_days', Number(e.target.value) || 0)}
                                                className="w-full pl-3 pr-11 py-1.5 bg-amber-50/60 border border-amber-200 rounded-lg text-sm font-bold text-amber-700 outline-none focus:border-amber-500"
                                                placeholder="30"
                                            />
                                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-black text-amber-400">ngày</span>
                                        </div>
                                        {/* Guarantee */}
                                        <button type="button"
                                            onClick={() => updateMilestone(ms.id, 'has_guarantee', !ms.has_guarantee)}
                                            className={`px-2 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-tight transition-all flex items-center gap-1 shrink-0 ${ms.has_guarantee ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-slate-50 text-slate-400 border border-slate-200 opacity-50 hover:opacity-100'}`}
                                        >
                                            <span className="material-symbols-outlined text-[12px]">{ms.has_guarantee ? 'verified' : 'shield'}</span>
                                            Bảo lãnh
                                        </button>
                                        {/* Delete */}
                                        <button type="button" onClick={() => removeMilestone(ms.id)}
                                            className="w-6 h-6 rounded-md flex items-center justify-center text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-all shrink-0"
                                        >
                                            <span className="material-symbols-outlined text-[16px]">close</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Row 2: Condition (compact) */}
                                <div className="flex items-center gap-2 mt-1.5 pl-8">
                                    <input type="text" value={ms.condition}
                                        onChange={e => updateMilestone(ms.id, 'condition', e.target.value)}
                                        className="flex-1 px-2 py-1 bg-slate-50/50 border border-slate-100 rounded-lg text-[11px] text-slate-500 outline-none focus:border-blue-400 placeholder:text-slate-300"
                                        placeholder="Điều kiện: Sau khi ký HĐ, Nghiệm thu 80%..."
                                    />
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Traditional Terms Note */}
                    <div className="mt-6 pt-4 border-t border-slate-100">
                        <label className={labelBase}>Ghi chú Điều khoản đặc thù khác (Văn bản)</label>
                        <textarea 
                            value={paymentTerms} 
                            onChange={e => setPaymentTerms(e.target.value)} 
                            className={`${inputBase} h-20 resize-none bg-slate-50/50 border-dashed`} 
                            placeholder="Ghi thêm các cam kết, điều kiện ràng buộc pháp lý khác nếu có..." 
                        />
                    </div>
                </div>
        </section>
    );
}
