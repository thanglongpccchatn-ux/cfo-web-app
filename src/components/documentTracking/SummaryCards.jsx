import React from 'react';
import { fmt, getDocStatus } from './dtkHelpers';

export default function SummaryCards({ filtered, activeEntity }) {
    return (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
             <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-12 h-12 bg-indigo-50 rounded-bl-3xl -tr-8 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                    {activeEntity === 'sateco' ? 'TỔNG GIÁ TRỊ C/TỪ' : 'TỔNG XUẤT HÓA ĐƠN'}
                </p>
                <p className="text-xl md:text-2xl font-black text-indigo-700 tabular-nums">
                    {fmt(filtered.reduce((s,i) => {
                        const isInternal = activeEntity === 'sateco' && (i.projects?.acting_entity_key || 'thanglong').toLowerCase() !== 'sateco';
                        return s + (Number(isInternal ? i.internal_debt_invoice : i.invoice_amount)||0);
                    }, 0))} 
                    <span className="text-xs text-indigo-400">₫</span>
                </p>
             </div>

             <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-12 h-12 bg-slate-50 rounded-bl-3xl -tr-8 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                    {activeEntity === 'sateco' ? 'TỔNG KHOÁN NỘI BỘ' : 'TỔNG ĐỀ NGHỊ TT'}
                </p>
                <p className="text-xl md:text-2xl font-black text-slate-800 tabular-nums">
                    {fmt(filtered.reduce((s,i) => {
                        const isInternal = activeEntity === 'sateco' && (i.projects?.acting_entity_key || 'thanglong').toLowerCase() !== 'sateco';
                        return s + (Number(isInternal ? i.internal_debt_actual : i.payment_request_amount)||0);
                    }, 0))} 
                    <span className="text-xs text-slate-400">₫</span>
                </p>
             </div>
             
             <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-12 h-12 bg-emerald-50 rounded-bl-3xl -tr-8 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-2 flex items-center gap-2 whitespace-nowrap">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    {activeEntity === 'sateco' ? 'THỰC THU SATECO' : 'ĐÃ THỰC THU'}
                </p>
                <p className="text-xl md:text-2xl font-black text-emerald-700 tabular-nums">
                    {fmt(filtered.reduce((s,i) => {
                        const isInternal = activeEntity === 'sateco' && (i.projects?.acting_entity_key || 'thanglong').toLowerCase() !== 'sateco';
                        return s + (Number(isInternal ? i.internal_paid : i.external_income)||0);
                    }, 0))}
                    <span className="text-xs text-emerald-400">₫</span>
                </p>
             </div>
             
             <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-12 h-12 bg-rose-50 rounded-bl-3xl -tr-8 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                    CÔNG NỢ CÒN LẠI
                </p>
                <p className="text-xl md:text-2xl font-black text-rose-700 tabular-nums">
                    {fmt(filtered.reduce((s,i) => {
                         const isInternal = activeEntity === 'sateco' && (i.projects?.acting_entity_key || 'thanglong').toLowerCase() !== 'sateco';
                         const req = Number(isInternal ? i.internal_debt_actual : i.payment_request_amount) || 0;
                         const paid = Number(isInternal ? i.internal_paid : i.external_income) || 0;
                         return s + Math.max(0, req - paid);
                    }, 0))}
                    <span className="text-xs text-rose-400 ml-1">₫</span>
                </p>
             </div>
             
             <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-12 h-12 bg-blue-50 rounded-bl-3xl -tr-8 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                    Hồ sơ trễ hạn
                </p>
                <p className="text-xl md:text-2xl font-black text-blue-700 tabular-nums">
                    {filtered.filter(i => getDocStatus(i).overdue).length} 
                    <span className="text-[10px] md:text-xs text-blue-400 ml-1 italic font-medium">Hồ sơ</span>
                </p>
             </div>
        </div>
    );
}
