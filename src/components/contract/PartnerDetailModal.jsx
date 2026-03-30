import React from 'react';
import { formatBillion } from '../../utils/formatters';

export default function PartnerDetailModal({ partner, onClose }) {
    if (!partner) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-emerald-50 to-white border-b border-slate-200">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-200">
                            <span className="material-symbols-outlined text-[22px]">business</span>
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-slate-800">{partner.code}</h3>
                            <p className="text-xs font-medium text-slate-500">{partner.name}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* KPI Summary */}
                <div className="grid grid-cols-4 gap-3 px-6 py-4 bg-slate-50 border-b border-slate-100">
                    {[
                        { label: 'Số HĐ', value: partner.projects.length, color: 'blue', icon: 'description' },
                        { label: 'Tổng giá trị HĐ', value: formatBillion(partner.projects.reduce((s, p) => s + (p.total_value_post_vat || 0), 0)), color: 'indigo', icon: 'payments' },
                        { label: 'Tổng đã thu', value: formatBillion(partner.projects.reduce((s, p) => s + (p.computedTotalIncome || 0), 0)), color: 'emerald', icon: 'account_balance' },
                        { label: 'Tổng công nợ', value: formatBillion(partner.projects.reduce((s, p) => s + Math.max(0, (p.total_value_post_vat || 0) - (p.computedTotalIncome || 0)), 0)), color: 'rose', icon: 'money_off' },
                    ].map((k, i) => (
                        <div key={i} className="bg-white rounded-xl p-3 border border-slate-100 shadow-sm">
                            <div className="flex items-center gap-2 mb-1">
                                <span className={`material-symbols-outlined text-[16px] text-${k.color}-500`}>{k.icon}</span>
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{k.label}</span>
                            </div>
                            <span className={`text-lg font-black text-${k.color}-700`}>{k.value}</span>
                        </div>
                    ))}
                </div>

                {/* Projects Table */}
                <div className="flex-1 overflow-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 sticky top-0 z-10">
                            <tr className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                                <th className="px-4 py-3">Mã DA/HĐ</th>
                                <th className="px-4 py-3">Tên dự án</th>
                                <th className="px-4 py-3 text-right">Giá trị HĐ</th>
                                <th className="px-4 py-3 text-right">Đã xuất HĐ</th>
                                <th className="px-4 py-3 text-right text-emerald-600">Đã thu</th>
                                <th className="px-4 py-3 text-right text-rose-600">Công nợ</th>
                                <th className="px-4 py-3 text-center">TT Thi công</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {partner.projects.map(p => {
                                const debt = Math.max(0, (p.total_value_post_vat || 0) - (p.computedTotalIncome || 0));
                                return (
                                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-4 py-3">
                                            <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">{p.internal_code || p.code}</span>
                                        </td>
                                        <td className="px-4 py-3 text-xs font-medium text-slate-700 max-w-[200px] truncate">{p.name}</td>
                                        <td className="px-4 py-3 text-right text-xs font-bold text-slate-600 tabular-nums">{formatBillion(p.total_value_post_vat || 0)}</td>
                                        <td className="px-4 py-3 text-right text-xs font-bold text-slate-500 tabular-nums">{formatBillion(p.computedTotalInvoice || 0)}</td>
                                        <td className="px-4 py-3 text-right text-xs font-black text-emerald-600 tabular-nums">{formatBillion(p.computedTotalIncome || 0)}</td>
                                        <td className="px-4 py-3 text-right">
                                            <span className={`text-xs font-black tabular-nums ${debt > 0 ? 'text-rose-600' : 'text-emerald-500'}`}>
                                                {debt > 0 ? formatBillion(debt) : '✓'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`text-[10px] font-black px-2 py-1 rounded-full ${
                                                p.status === 'Đã hoàn thành' ? 'bg-emerald-50 text-emerald-600' :
                                                p.status === 'Đang thi công' ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500'
                                            }`}>{p.status}</span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                            <tr className="text-xs font-black">
                                <td className="px-4 py-3 text-slate-500 uppercase" colSpan={2}>TỔNG</td>
                                <td className="px-4 py-3 text-right text-slate-700 tabular-nums">{formatBillion(partner.projects.reduce((s, p) => s + (p.total_value_post_vat || 0), 0))}</td>
                                <td className="px-4 py-3 text-right text-slate-700 tabular-nums">{formatBillion(partner.projects.reduce((s, p) => s + (p.computedTotalInvoice || 0), 0))}</td>
                                <td className="px-4 py-3 text-right text-emerald-700 tabular-nums">{formatBillion(partner.projects.reduce((s, p) => s + (p.computedTotalIncome || 0), 0))}</td>
                                <td className="px-4 py-3 text-right text-rose-700 tabular-nums">{formatBillion(partner.projects.reduce((s, p) => s + Math.max(0, (p.total_value_post_vat || 0) - (p.computedTotalIncome || 0)), 0))}</td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    );
}
