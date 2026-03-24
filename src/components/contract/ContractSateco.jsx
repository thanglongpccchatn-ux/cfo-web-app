import React from 'react';
import { fmt } from './contractHelpers';

export default function ContractSateco({
    internalVat, setInternalVat,
    contractRatio, setContractRatio,
    internalDeduction, setInternalDeduction,
    vat,
    tl_cutPercent, tl_cutAmount, internalCutAmount,
    tl_preVat, tl_vatAmount, tl_postVat,
    st_invoice_preVat, st_invoice_vat, st_invoice_postVat,
    st_actual_preVat, st_actual_vat, st_actual_postVat,
    actualRatio
}) {
    return (
        <section id="sateco" className="glass-panel p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-100 rounded-full blur-[80px] -z-10"></div>
            <h2 className="text-lg font-bold mb-6 flex items-center gap-3 pb-4 border-b border-slate-100/50">
                <span className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shadow-sm">
                    <span className="material-symbols-outlined notranslate text-[22px]" translate="no">hub</span>
                </span>
                5. Phân bổ Chỉ ngân Sateco (Nội bộ)
            </h2>

            {/* Ratio Controls */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {/* Internal VAT */}
                <div className="glass-card bg-emerald-50/30 border-emerald-100 p-5">
                    <label className="flex justify-between text-xs font-bold text-slate-600 mb-1.5">
                        <span>Thuế VAT Nội bộ (%)</span>
                        <span className="text-emerald-600 text-base font-black">{internalVat}%</span>
                    </label>
                    <div className="flex items-center gap-3">
                        <input type="number" step="1" min="0" max="100" value={internalVat} onChange={e => setInternalVat(Number(e.target.value))} className="w-full rounded-md border border-slate-200 bg-white p-2 text-sm text-center font-bold text-emerald-700 outline-none focus:ring-2 focus:ring-emerald-500/20" />
                    </div>
                    <p className="text-[10px] text-slate-500 mt-2">VAT xuất hóa đơn Sateco (mặc định 8%)</p>
                </div>

                {/* Contract Ratio */}
                <div className="glass-card bg-indigo-50/30 border-indigo-100 p-5">
                    <label className="flex justify-between text-xs font-bold text-slate-600 mb-1.5">
                        <span>Tỷ lệ khoán trên HĐ (Xuất hóa đơn)</span>
                        <span className="text-indigo-600 text-base font-black">{contractRatio}%</span>
                    </label>
                    <div className="flex items-center gap-3">
                        <input type="range" min="0" max="100" step="0.5" value={contractRatio} onChange={e => { setContractRatio(Number(e.target.value)); if (internalDeduction > Number(e.target.value)) setInternalDeduction(0); }} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                        <input type="number" step="0.5" value={contractRatio} onChange={e => setContractRatio(Number(e.target.value))} className="w-16 rounded-md border border-slate-200 bg-white p-1 text-xs text-center font-bold text-indigo-700 outline-none" />
                    </div>
                    <p className="text-[10px] text-slate-500 mt-2">TL cắt <span className="font-bold text-red-500">{tl_cutPercent}%</span> = <span className="font-bold">{fmt(tl_cutAmount)} ₫</span></p>
                </div>

                {/* Internal Deduction */}
                <div className="glass-card bg-purple-50/30 border-purple-100 p-5">
                    <label className="flex justify-between text-xs font-bold text-slate-600 mb-1.5">
                        <span>Chiết khấu dòng nội bộ thêm</span>
                        <span className="text-purple-600 text-base font-black">{internalDeduction}%</span>
                    </label>
                    <div className="flex items-center gap-3">
                        <input type="range" min="0" max={contractRatio} step="0.5" value={internalDeduction} onChange={e => setInternalDeduction(Number(e.target.value))} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-purple-600" />
                        <input type="number" step="0.5" min="0" max={contractRatio} value={internalDeduction} onChange={e => setInternalDeduction(Math.min(Number(e.target.value), contractRatio))} className="w-16 rounded-md border border-slate-200 bg-white p-1 text-xs text-center font-bold text-purple-700 outline-none" />
                    </div>
                    <p className="text-[10px] text-slate-500 mt-2">
                        {internalDeduction > 0
                            ? <>TL cắt thêm nội bộ <span className="font-bold text-purple-600">{internalDeduction}%</span> = <span className="font-bold">{fmt(internalCutAmount)} ₫</span></>
                            : 'Không chiết khấu thêm — Sateco hưởng đủ tỷ lệ khoán'
                        }
                    </p>
                </div>
            </div>

            {/* Summary Table */}
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-slate-50 text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                            <th className="text-left p-4"></th>
                            <th className="text-right p-4">Trước VAT</th>
                            <th className="text-right p-4">VAT ({vat}%)</th>
                            <th className="text-right p-4">Sau VAT</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {/* TL Row */}
                        <tr className="bg-blue-50/30">
                            <td className="p-4 font-bold text-blue-700 flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                Thăng Long (100%)
                            </td>
                            <td className="p-4 text-right font-bold text-slate-800">{fmt(tl_preVat)}</td>
                            <td className="p-4 text-right text-slate-600">{fmt(tl_vatAmount)}</td>
                            <td className="p-4 text-right font-black text-blue-700">{fmt(tl_postVat)}</td>
                        </tr>
                        {/* Sateco Invoice Row */}
                        <tr className="bg-indigo-50/30">
                            <td className="p-4 font-bold text-indigo-700 flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                                Sateco - Hóa đơn ({contractRatio}%)
                            </td>
                            <td className="p-4 text-right font-bold text-slate-800">{fmt(st_invoice_preVat)}</td>
                            <td className="p-4 text-right text-slate-600">{fmt(st_invoice_vat)}</td>
                            <td className="p-4 text-right font-black text-indigo-700">{fmt(st_invoice_postVat)}</td>
                        </tr>
                        {/* Sateco Actual Row */}
                        {internalDeduction > 0 && (
                            <tr className="bg-purple-50/30">
                                <td className="p-4 font-bold text-purple-700 flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                                    Sateco - Thực nhận ({actualRatio}%)
                                </td>
                                <td className="p-4 text-right font-black text-purple-700">{fmt(st_actual_preVat)}</td>
                                <td className="p-4 text-right text-slate-600">{fmt(st_actual_vat)}</td>
                                <td className="p-4 text-right font-black text-purple-700">{fmt(st_actual_postVat)}</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Warning */}
            {internalDeduction > 0 && (
                <div className="mt-4 bg-purple-100/50 rounded-xl p-4 border border-purple-200 flex gap-3">
                    <span className="material-symbols-outlined notranslate text-[20px] text-purple-500 mt-0.5" translate="no">account_balance_wallet</span>
                    <div className="text-[11px] text-purple-800 leading-relaxed">
                        <p>Sateco xuất hóa đơn <span className="font-bold">{contractRatio}%</span> ({fmt(st_invoice_preVat)} ₫ trước VAT) nhưng thực nhận chỉ <span className="font-bold">{actualRatio}%</span> ({fmt(st_actual_preVat)} ₫).</p>
                        <p className="mt-1">→ Chênh lệch nội bộ: <span className="font-bold underline text-purple-900">{fmt(internalCutAmount)} ₫</span> ({internalDeduction}%)</p>
                    </div>
                </div>
            )}
        </section>
    );
}
