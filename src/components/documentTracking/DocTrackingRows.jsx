import React from 'react';
import { getDocStatus, fmt } from './dtkHelpers';
import PaymentHistoryRow from './PaymentHistoryRow';

/**
 * DocTrackingMobileCard — renders a single payment item as a mobile card
 */
function DocTrackingMobileCard({ item, activeEntity, activeTab, expandedId, toggleExpansion, historyLoading, paymentHistory, hasPermission, onEdit, onDelete, onQuickReceipt }) {
    const status = getDocStatus(item);
    const isInternalSatecoView = activeEntity === 'sateco' && (item.projects?.acting_entity_key || 'thanglong').toLowerCase() !== 'sateco';
    const invoiceAmt = isInternalSatecoView ? Number(item.internal_debt_invoice || 0) : Number(item.invoice_amount || 0);
    const requestAmt = isInternalSatecoView ? Number(item.internal_debt_actual || 0) : Number(item.payment_request_amount || 0);
    const actualAmt = isInternalSatecoView ? Number(item.internal_paid || 0) : Number(item.external_income || 0);
    const remaining = Math.max(0, requestAmt - actualAmt);

    return (
        <div key={item.id} onClick={() => toggleExpansion(item)} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col gap-3 relative overflow-hidden">
            {status.overdue && <div className="absolute top-0 right-0 px-2 py-0.5 bg-rose-500 text-white text-[8px] font-black uppercase">Quá hạn</div>}
            <div className="flex justify-between items-start">
                <div className="flex flex-col">
                    <span className="text-[10px] font-black font-mono text-blue-600 uppercase">#{item.projects?.internal_code || item.projects?.code}</span>
                    <span className="text-[11px] font-bold text-slate-800 line-clamp-1">{item.stage_name}</span>
                </div>
                <div className={`px-2 py-1 rounded-full text-[8px] font-black border ${status.overdue ? 'bg-rose-50 border-rose-100 text-rose-600' : (status.isFullyPaid ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-blue-50 border-blue-100 text-blue-600')}`}>
                    {status.label}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100/50">
                <div>
                    <span className="text-[8px] font-black text-slate-400 uppercase block mb-0.5">Xuất HĐ</span>
                    <span className="text-[11px] font-black text-slate-700 tabular-nums">{fmt(invoiceAmt)}</span>
                </div>
                <div>
                    <span className="text-[8px] font-black text-slate-400 uppercase block mb-0.5">Thực thu</span>
                    <span className="text-[11px] font-black text-emerald-600 tabular-nums">{fmt(actualAmt)}</span>
                </div>
                <div>
                    <span className="text-[8px] font-black text-slate-400 uppercase block mb-0.5">Còn nợ</span>
                    <span className={`text-[11px] font-black tabular-nums ${remaining > 0 ? 'text-rose-600' : 'text-slate-400'}`}>{fmt(remaining)}</span>
                </div>
                <div>
                    <span className="text-[8px] font-black text-slate-400 uppercase block mb-0.5">Hạn TT</span>
                    <span className={`text-[11px] font-bold tabular-nums ${status.overdue ? 'text-rose-600' : 'text-slate-500'}`}>{item.due_date ? new Date(item.due_date).toLocaleDateString('vi-VN') : '—'}</span>
                </div>
            </div>

            {expandedId === item.id && (
                <div className="border-t border-slate-100 pt-3 mt-1 animate-slide-down">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-black text-slate-500">LỊCH SỬ THANH TOÁN</span>
                        <div className="flex gap-1">
                            {hasPermission('edit_payments') && activeTab !== 'cdt' && Number(item.internal_paid || 0) < Number(item.internal_debt_actual || 0) && (
                                <button onClick={(e) => { e.stopPropagation(); onQuickReceipt(item); }} className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600" title="Chuyển tiền">
                                    <span className="material-symbols-outlined text-[16px]">payments</span>
                                </button>
                            )}
                            {hasPermission('edit_payments') && (
                                <button onClick={(e) => { e.stopPropagation(); onEdit(item); }} className="p-1.5 rounded-lg bg-blue-50 text-blue-600"><span className="material-symbols-outlined text-[16px]">edit</span></button>
                            )}
                            {hasPermission('delete_payments') && (
                                <button onClick={(e) => { e.stopPropagation(); onDelete(item); }} className="p-1.5 rounded-lg bg-rose-50 text-rose-600"><span className="material-symbols-outlined text-[16px]">delete</span></button>
                            )}
                        </div>
                    </div>
                    {historyLoading ? (
                        <div className="text-[10px] text-slate-400 italic">Đang tải lịch sử...</div>
                    ) : paymentHistory.length === 0 ? (
                        <div className="text-[10px] text-slate-400 italic">Chưa có lịch sử thanh toán</div>
                    ) : (
                        <div className="space-y-2">
                            {paymentHistory.map(h => (
                                <div key={h.id} className="flex justify-between items-center text-[10px] font-medium p-2 bg-slate-50/50 rounded-lg">
                                    <span className="text-slate-500">{new Date(h.payment_date).toLocaleDateString('vi-VN')}</span>
                                    <span className="text-emerald-600 font-bold">{fmt(h.amount)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

/**
 * DocTrackingDesktopRow — renders a single payment item as a desktop table row
 */
function DocTrackingDesktopRow({ item, activeEntity, activeTab, entityShort, expandedId, toggleExpansion, historyLoading, paymentHistory, generateHistory, hasPermission, onEdit, onDelete, onQuickReceipt }) {
    const isInternalSatecoView = activeEntity === 'sateco' && (item.projects?.acting_entity_key || 'thanglong').toLowerCase() !== 'sateco';
    const status = getDocStatus(item);
    const rawInvoiceAmt = Number(item.invoice_amount || 0);
    const rawRequestAmt = Number(item.payment_request_amount || 0);
    const rawActualAmt = Number(item.external_income || 0);

    const invoiceAmt = isInternalSatecoView ? Number(item.internal_debt_invoice || 0) : rawInvoiceAmt;
    const requestAmt = isInternalSatecoView ? Number(item.internal_debt_actual || 0) : rawRequestAmt;
    const actualAmt = isInternalSatecoView ? Number(item.internal_paid || 0) : rawActualAmt;
    
    const diffInvoice = invoiceAmt - actualAmt;
    const remaining = Math.max(0, requestAmt - actualAmt);
   
    const isHighlight = status.overdue || !status.isFullyPaid || item.invoice_status === 'Chưa xuất';
    const textWeight = isHighlight ? 'font-black' : 'font-medium';
   
    return (
        <React.Fragment>
            <tr 
                onClick={() => toggleExpansion(item)}
                className={`hover:bg-blue-50/60 hover:shadow-[0_4px_20px_rgba(59,130,246,0.08)] cursor-pointer transition-all group text-[11px] text-slate-600 border-l-4 ${expandedId === item.id ? 'border-blue-500 bg-blue-50/30' : 'border-transparent'} ${isHighlight ? 'bg-rose-50/5' : ''}`}
            >
                <td className="px-3 py-4">
                    <div className="flex items-center gap-1.5">
                        {activeTab === 'cdt' && (
                            status.isFullyPaid ? (
                                <span className="material-symbols-outlined notranslate text-emerald-500 text-[16px]" translate="no">check_circle</span>
                            ) : (
                                <span className="material-symbols-outlined notranslate text-slate-300 text-[16px]" translate="no">history</span>
                            )
                        )}
                        <span className={`text-emerald-700 uppercase tracking-tighter ${textWeight}`}>
                            {item.projects?.internal_code || item.projects?.code}
                        </span>
                    </div>
                </td>
                {activeTab === 'cdt' && (
                    <td className="px-3 py-4">
                        {isInternalSatecoView ? (
                            <div className="flex flex-col">
                                <span className="flex items-center gap-1 text-slate-700 font-bold uppercase tracking-tighter">
                                    <span className="material-symbols-outlined text-[14px] text-emerald-600">sync_alt</span>
                                    {(item.projects?.acting_entity_key || 'thanglong').toLowerCase() === 'thanhphat' ? 'THÀNH PHÁT (Nội bộ)' : 'THĂNG LONG (Nội bộ)'}
                                </span>
                                <span className="text-[9px] text-slate-400 font-medium truncate max-w-[120px] italic">
                                    Giao khoán {item.projects?.sateco_contract_ratio || 98}%
                                </span>
                            </div>
                        ) : (
                            <span className={`text-slate-500 uppercase ${textWeight}`}>{item.projects?.partners?.short_name || item.projects?.partners?.code || 'ZYF'}</span>
                        )}
                    </td>
                )}
                <td className="px-3 py-4">
                    <span className={`uppercase ${textWeight}`}>{item.stage_name}</span>
                </td>

                {activeTab === 'cdt' ? (
                    <>
                        <td className="px-3 py-4 text-right">
                            <span className={`tabular-nums ${textWeight}`}>{fmt(invoiceAmt)}</span>
                        </td>
                        <td className="px-3 py-4">
                            <span className={`text-slate-400 tabular-nums ${textWeight}`}>{item.invoice_date ? new Date(item.invoice_date).toLocaleDateString('vi-VN') : ''}</span>
                        </td>
                        <td className="px-3 py-4">
                            <div className="flex items-center gap-1">
                                <span className={`material-symbols-outlined notranslate text-[14px] ${item.invoice_status === 'Đã xuất' ? 'text-blue-500' : 'text-rose-500'}`} translate="no">
                                    {item.invoice_status === 'Đã xuất' ? 'description' : 'error'}
                                </span>
                                <span className={`text-[10px] uppercase tracking-tighter whitespace-nowrap ${item.invoice_status === 'Đã xuất' ? 'text-emerald-600' : 'text-rose-600 font-black'}`}>
                                    {item.invoice_status || 'Chưa xuất'}
                                </span>
                            </div>
                        </td>
                        <td className="px-3 py-4 text-right">
                            <span className={`tabular-nums text-slate-700 ${textWeight}`}>{fmt(requestAmt)}</span>
                        </td>
                        <td className="px-3 py-4 text-right">
                            <div className="flex flex-col items-end">
                               <span className={`tabular-nums text-emerald-600 font-black flex items-center gap-1`}>
                                   {fmt(actualAmt)}
                               </span>
                            </div>
                        </td>
                        <td className="px-3 py-4 text-right">
                            <span className={`tabular-nums text-slate-400 font-medium`}>{fmt(diffInvoice)}</span>
                        </td>
                        <td className="px-3 py-4">
                           <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-full w-fit shadow-sm border ${status.overdue ? 'bg-rose-100 border-rose-200 text-rose-700' : (status.isFullyPaid ? 'bg-emerald-100 border-emerald-200 text-emerald-700' : 'bg-slate-100 border-slate-200 text-slate-600')}`}>
                                <span className="material-symbols-outlined notranslate text-[16px] leading-none" translate="no">
                                    {status.icon}
                                </span>
                                <span className="text-[9px] uppercase font-black tracking-wider whitespace-nowrap">
                                    {status.label}
                                </span>
                           </div>
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap">
                            <span className={`tabular-nums ${status.overdue ? 'text-rose-600 font-black' : 'text-slate-500'}`}>
                                {item.due_date ? new Date(item.due_date).toLocaleDateString('vi-VN') : '—'}
                            </span>
                        </td>
                        <td className="px-3 py-4 text-right">
                            <span className={`tabular-nums ${remaining > 0 ? 'text-rose-600 font-black' : 'text-slate-400 font-medium'}`}>
                                {fmt(remaining)}
                            </span>
                        </td>
                    </>
                ) : (
                    (() => {
                        const targetTax = Number(item.internal_debt_invoice || 0);
                        const targetActual = Number(item.internal_debt_actual || 0);
                        const paid = Number(item.internal_paid || 0);
                        
                        const tlDebtTax = Math.max(0, targetTax - paid);
                        const totalDebt = Math.max(0, targetActual - paid);

                        return (
                            <>
                                <td className="px-3 py-4 text-right bg-blue-50/20">
                                    <span className={`tabular-nums font-black ${targetTax > 0 ? 'text-blue-600' : 'text-slate-400'}`}>
                                        {fmt(targetTax)}
                                    </span>
                                </td>
                                <td className="px-3 py-4 text-right bg-indigo-50/20">
                                    <span className={`tabular-nums font-black ${targetActual > 0 ? 'text-indigo-600' : 'text-slate-400'}`}>
                                        {fmt(targetActual)}
                                    </span>
                                </td>
                                <td className="px-3 py-4 text-right">
                                    <span className={`tabular-nums font-black ${paid > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                                        {fmt(paid)}
                                    </span>
                                </td>
                                <td className="px-3 py-4 text-right">
                                    <span className={`tabular-nums font-black ${tlDebtTax > 0 ? 'text-rose-600' : 'text-slate-400 font-medium'}`}>
                                        {fmt(tlDebtTax)}
                                    </span>
                                </td>
                                <td className="px-3 py-4 text-right">
                                    <span className={`tabular-nums font-black ${totalDebt > 0 ? 'text-rose-600' : 'text-slate-400 font-medium'}`}>
                                        {fmt(totalDebt)}
                                    </span>
                                </td>
                            </>
                        );
                    })()
                )}
                <td className="px-3 py-4 text-center">
                    {hasPermission('edit_payments') && (<div className="flex items-center justify-center space-x-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {activeTab !== 'cdt' && Number(item.internal_paid || 0) < Number(item.internal_debt_actual || 0) && (
                            <button 
                                onClick={(e) => { e.stopPropagation(); onQuickReceipt(item); }}
                                className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100 hover:bg-white flex items-center justify-center transition-all"
                                title="Chuyển tiền"
                            >
                                <span className="material-symbols-outlined notranslate text-[14px]" translate="no">payments</span>
                            </button>
                        )}
                        <button 
                            onClick={(e) => { e.stopPropagation(); onEdit(item); }}
                            className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 hover:bg-white flex items-center justify-center transition-all border border-blue-100"
                            title="Chỉnh sửa hồ sơ"
                        >
                            <span className="material-symbols-outlined notranslate text-[14px]" translate="no">edit</span>
                        </button>
                        <button 
                            onClick={(e) => { e.stopPropagation(); onDelete(item); }}
                            className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 hover:bg-white flex items-center justify-center transition-all border border-rose-100"
                            title="Xóa hồ sơ"
                        >
                            <span className="material-symbols-outlined notranslate text-[14px]" translate="no">delete</span>
                        </button>
                     </div>)}
                </td>
            </tr>

            <PaymentHistoryRow 
                expandedId={expandedId} 
                item={item} 
                historyLoading={historyLoading} 
                paymentHistory={paymentHistory} 
                generateHistory={generateHistory} 
            />
        </React.Fragment>
    );
}

export { DocTrackingMobileCard, DocTrackingDesktopRow };
