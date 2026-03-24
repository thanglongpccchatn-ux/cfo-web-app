import React from 'react';
import { inputBase, labelBase, formatBillion } from './contractHelpers';

export default function ContractValueTime({
    totalValueDisplay, handleValueChange, handleValueBlur, handleValueFocus, totalValue,
    postVatDisplay, handlePostVatChange, handlePostVatBlur, handlePostVatFocus, vat, setVat, setPostVatDisplay,
    signDate, setSignDate,
    startDate, setStartDate,
    endDate, setEndDate,
    formatInputNumber
}) {
    return (
        <section id="value" className="glass-panel p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-green-100 rounded-full blur-[80px] -z-10"></div>
            <h2 className="text-lg font-bold mb-6 flex items-center gap-3 pb-4 border-b border-slate-100/50">
                <span className="w-10 h-10 rounded-xl bg-green-50 border border-green-100 text-green-600 flex items-center justify-center shadow-sm">
                    <span className="material-symbols-outlined notranslate text-[22px]" translate="no">payments</span>
                </span>
                3. Giá trị Hợp đồng Thăng Long & Thời gian
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 border-r border-slate-200/60 pr-4">
                    <label className={labelBase}>Giá trị Trước VAT (VNĐ)</label>
                    <div className="relative">
                        <input
                            type="text"
                            value={totalValueDisplay}
                            onChange={handleValueChange}
                            onBlur={handleValueBlur}
                            onFocus={handleValueFocus}
                            className="w-full rounded-xl border border-slate-200 bg-white/80 p-3.5 pr-12 text-lg font-black text-green-600 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all shadow-sm"
                            placeholder="48.400.000.000"
                            inputMode="numeric"
                        />
                        <span className="absolute right-4 top-[14px] text-green-400 font-bold pointer-events-none">₫</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-2 font-medium">Bằng chữ: <span className="text-slate-600">{formatBillion(totalValue)}</span></p>
                </div>
                <div className="border-r border-slate-200/60 pr-4">
                    <label className={labelBase}>Giá trị CÓ VAT (VNĐ)</label>
                    <div className="relative">
                        <input
                            type="text"
                            value={postVatDisplay}
                            onChange={handlePostVatChange}
                            onBlur={handlePostVatBlur}
                            onFocus={handlePostVatFocus}
                            className="w-full rounded-xl border border-green-100 bg-green-50/50 p-3.5 pr-12 text-lg font-black text-slate-800 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all shadow-inner"
                            placeholder="52.272.000.000"
                            inputMode="numeric"
                        />
                        <span className="absolute right-4 top-[14px] text-green-500 font-bold pointer-events-none">₫</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-2 font-medium">Bằng chữ: <span className="text-slate-600">{formatBillion(Math.round(totalValue * (1 + vat / 100)))}</span></p>
                </div>
                <div>
                    <label className={labelBase}>Thuế VAT (%)</label>
                    <div className="relative">
                        <input type="number" value={vat} onChange={e => {
                            const newVat = Number(e.target.value);
                            setVat(newVat);
                            setPostVatDisplay(formatInputNumber(Math.round(totalValue * (1 + newVat / 100))));
                        }} className="w-full rounded-xl border border-slate-200 bg-white/80 p-3.5 pr-10 text-sm font-bold focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all shadow-sm" />
                        <span className="absolute right-4 top-[14px] text-slate-400 pointer-events-none">%</span>
                    </div>
                </div>

                <div className="col-span-full h-px bg-slate-100 my-2"></div>

                <div>
                    <label className={labelBase}>Ngày ký HĐ</label>
                    <input type="date" value={signDate} onChange={e => setSignDate(e.target.value)} className={`${inputBase} px-4`} />
                </div>
                <div>
                    <label className={labelBase}>Ngày bắt đầu</label>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={`${inputBase} px-4`} />
                </div>
                <div>
                    <label className={labelBase}>Hạn hoàn thành</label>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={`${inputBase} px-4`} />
                </div>
            </div>
        </section>
    );
}
