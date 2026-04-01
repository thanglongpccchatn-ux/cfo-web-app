import React, { useState } from 'react';
import { formatVND } from '../../utils/formatters';

/**
 * Detail Modal for dashboard drill-down views.
 * Supports: invoice, requested, unsigned, unsettled, pending
 */
export default function DashboardDetailModal({ detailModal, setDetailModal }) {
    const [expandedProject, setExpandedProject] = useState(null);

    if (!detailModal.isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setDetailModal({ isOpen: false, type: null, data: [] })}>
            <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200/60 relative animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <div className={`p-6 md:p-8 border-b flex items-center justify-between ${
                    detailModal.type === 'invoice' || detailModal.type === 'unsigned' ? 'bg-rose-50/80 border-rose-100' : 
                    detailModal.type === 'requested' || detailModal.type === 'unsettled' ? 'bg-amber-50/80 border-amber-100' :
                    'bg-orange-50/80 border-orange-100'
                }`}>
                    <div className="flex items-center gap-4">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm ${
                            detailModal.type === 'invoice' || detailModal.type === 'unsigned' ? 'bg-rose-100 text-rose-600 border border-rose-200/50' : 
                            detailModal.type === 'requested' || detailModal.type === 'unsettled' ? 'bg-amber-100 text-amber-600 border border-amber-200/50' :
                            'bg-orange-100 text-orange-600 border border-orange-200/50'
                        }`}>
                            <span className="material-symbols-outlined text-[32px]">
                                {detailModal.type === 'unsigned' ? 'draw' : 
                                 detailModal.type === 'unsettled' ? 'fact_check' :
                                 detailModal.type === 'pending' ? 'pending_actions' :
                                 detailModal.type === 'invoice' ? 'assignment_turned_in' : 'pending_actions'}
                            </span>
                        </div>
                        <div>
                            <h3 className={`text-xl md:text-2xl font-black tracking-tight ${
                                detailModal.type === 'invoice' || detailModal.type === 'unsigned' ? 'text-rose-700' : 
                                detailModal.type === 'requested' || detailModal.type === 'unsettled' ? 'text-amber-800' :
                                'text-orange-800'
                            }`}>
                                {detailModal.type === 'unsigned' ? 'HĐ CHƯA KÝ' : 
                                 detailModal.type === 'unsettled' ? 'DA CHƯA QUYẾT TOÁN' :
                                 detailModal.type === 'pending' ? 'HỒ SƠ CHỜ DUYỆT' :
                                 detailModal.type === 'invoice' ? 'CHI TIẾT CÔNG NỢ HÓA ĐƠN' : 'CHI TIẾT CÔNG NỢ ĐỀ NGHỊ'}
                            </h3>
                            <p className="text-xs font-black text-slate-500 uppercase tracking-widest mt-1">
                                {detailModal.type === 'unsigned' ? 'DANH SÁCH CÁC HỢP ĐỒNG CHƯA HOÀN TẤT KÝ KẾT' :
                                 detailModal.type === 'unsettled' ? 'DỰ ÁN ĐÃ HOÀN THÀNH NHƯNG CHƯA QUYẾT TOÁN XONG' :
                                 detailModal.type === 'pending' ? 'DANH SÁCH HỒ SƠ THANH TOÁN ĐANG CHỜ XÉT DUYỆT' :
                                 'CÁC DỰ ÁN ĐANG GHI NHẬN CÔNG NỢ HOẶC THU DƯ TẠM ỨNG'}
                            </p>
                        </div>
                    </div>
                    <button onClick={() => setDetailModal({ isOpen: false, type: null, data: [] })} className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 shadow-sm transition-all active:scale-95 border border-slate-200">
                        <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                </div>
                
                <div className="p-0 overflow-auto flex-1 bg-slate-50/30">
                    <table className="w-full text-left border-collapse table-fixed">
                        <colgroup>
                            <col style={{width:'22%'}} />
                            <col style={{width:'18%'}} />
                            <col style={{width:'20%'}} />
                            <col style={{width:'20%'}} />
                            <col style={{width:'20%'}} />
                        </colgroup>
                        <thead className="bg-white sticky top-0 z-10 shadow-sm border-b border-slate-200">
                            <tr className="text-[11px] font-black text-slate-500 uppercase tracking-widest">
                                <th className="px-5 py-4">Mã {detailModal.type === 'pending' ? 'Hồ sơ' : 'Dự án'}</th>
                                <th className="px-5 py-4">{detailModal.type === 'pending' ? 'Công việc / Dự án' : 'Đối Tác'}</th>
                                <th className="px-5 py-4 text-right">
                                    {detailModal.type === 'pending' ? 'Giá trị ĐNTT' : 
                                     detailModal.type === 'unsigned' || detailModal.type === 'unsettled' ? 'Giá trị TVH' :
                                     detailModal.type === 'invoice' ? 'Tổng Hóa Đơn' : 'Tổng Đề Nghị'}
                                </th>
                                <th className="px-5 py-4 text-right">Thực Thu</th>
                                <th className="px-5 py-4 text-right text-rose-600 bg-rose-50/30">
                                    {detailModal.type === 'pending' || detailModal.type === 'invoice' || detailModal.type === 'requested' ? 'Công Nợ' : 'Giá trị HĐ'}
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {detailModal.data.map(p => {
                                let val1 = 0, valThu = 0, valNo = 0;
                                let code = '', name = '', sub = '';
                                
                                if (detailModal.type === 'pending') {
                                    code = p.payment_code;
                                    name = p.projects?.name || 'N/A';
                                    sub = p.stage_name;
                                    val1 = parseFloat(p.payment_request_amount) || 0;
                                    valThu = parseFloat(p.external_income) || 0;
                                    valNo = val1 - valThu;
                                } else {
                                    code = p.internal_code || p.code;
                                    name = p.name;
                                    sub = p.partners?.short_name || p.partners?.name || 'N/A';
                                    
                                    if (detailModal.type === 'invoice' || detailModal.type === 'requested') {
                                        val1 = detailModal.type === 'invoice' ? p.totalInvoice : p.totalRequested;
                                        valThu = p.totalIncome;
                                        valNo = detailModal.type === 'invoice' ? p.debtInvoice : p.debtRequested;
                                    } else {
                                        val1 = p.total_value_post_vat || (parseFloat(p.original_value || 0) * 1.08);
                                        valThu = p.totalIncome || 0;
                                        valNo = val1;
                                    }
                                }

                                const isExpanded = expandedProject === p.id && (detailModal.type === 'invoice' || detailModal.type === 'requested');
                                
                                const pendingPhases = (detailModal.type === 'invoice' || detailModal.type === 'requested') ? 
                                    (p.projPmts || []).filter(pm => {
                                        const phaseReq = detailModal.type === 'invoice' ? (parseFloat(pm.invoice_amount)||0) : (parseFloat(pm.payment_request_amount)||0);
                                        const phaseInc = parseFloat(pm.external_income)||0;
                                        // Show phases that have debt OR have income (advance payments)
                                        return (phaseReq - phaseInc > 0) || (phaseInc > 0);
                                    }) : [];

                                const totalPhaseDebt = pendingPhases.reduce((s, pm) => {
                                    const req = detailModal.type === 'invoice' ? (parseFloat(pm.invoice_amount)||0) : (parseFloat(pm.payment_request_amount)||0);
                                    const inc = parseFloat(pm.external_income)||0;
                                    return s + Math.max(0, req - inc);
                                }, 0);

                                const totalAdvance = pendingPhases.reduce((s, pm) => {
                                    const req = detailModal.type === 'invoice' ? (parseFloat(pm.invoice_amount)||0) : (parseFloat(pm.payment_request_amount)||0);
                                    const inc = parseFloat(pm.external_income)||0;
                                    return s + Math.max(0, inc - req);
                                }, 0);

                                return (
                                    <React.Fragment key={p.id}>
                                        <tr 
                                            onClick={() => (detailModal.type === 'invoice' || detailModal.type === 'requested') && setExpandedProject(isExpanded ? null : p.id)}
                                            className={`transition-colors group ${detailModal.type === 'invoice' || detailModal.type === 'requested' ? 'cursor-pointer' : ''} ${isExpanded ? 'bg-blue-50/40 relative z-0' : 'bg-white hover:bg-slate-50/80'}`}
                                        >
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-2">
                                                    {(detailModal.type === 'invoice' || detailModal.type === 'requested') && (
                                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-transform ${isExpanded ? 'bg-blue-100 text-blue-600 rotate-180' : 'bg-slate-100 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500'}`}>
                                                            <span className="material-symbols-outlined text-[16px]">expand_more</span>
                                                        </div>
                                                    )}
                                                    <span className="text-sm font-mono font-black text-slate-700 bg-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-200">{code}</span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4">
                                                <p className="text-sm font-black text-slate-800 truncate" title={sub}>{sub}</p>
                                                <p className="text-xs font-bold text-slate-400 mt-0.5 truncate" title={name}>{name}</p>
                                            </td>
                                            <td className="px-5 py-4 text-right text-sm font-black text-slate-700 tabular-nums whitespace-nowrap">
                                                {formatVND(val1)}
                                            </td>
                                            <td className="px-5 py-4 text-right text-sm font-black text-emerald-600 tabular-nums whitespace-nowrap">
                                                {formatVND(valThu)}
                                            </td>
                                            <td className={`px-5 py-4 text-right text-sm font-black tabular-nums whitespace-nowrap ${
                                                detailModal.type === 'unsigned' || detailModal.type === 'unsettled' ? 'text-slate-600' :
                                                valNo < 0 ? 'text-emerald-600 bg-emerald-50/40' : 'text-rose-600 bg-rose-50/10'
                                            }`}>
                                                {valNo < 0 ? `+${formatVND(Math.abs(valNo))}` : formatVND(valNo)}&nbsp;{detailModal.type !== 'unsigned' && detailModal.type !== 'unsettled' ? '₫' : ''}
                                            </td>
                                        </tr>
                                        {isExpanded && (
                                            <tr className="bg-slate-50/50 shadow-inner">
                                                <td colSpan={5} className="p-0">
                                                    <div className="px-14 py-4 animate-in slide-in-from-top-2 duration-200 border-l-[3px] border-blue-400 ml-6 my-2 bg-white rounded-r-xl shadow-sm">
                                                        <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                            <span className="material-symbols-outlined text-[16px]">format_list_bulleted</span>
                                                            Chi tiết các đợt thanh toán
                                                        </h4>
                                                        {pendingPhases.length > 0 ? (
                                                            <div className="space-y-3">
                                                                <div className="overflow-hidden border border-slate-200 rounded-lg">
                                                                    <table className="w-full text-left bg-white text-[13px]">
                                                                        <thead className="bg-slate-50 border-b border-slate-200">
                                                                            <tr>
                                                                                <th className="px-3 py-2 font-bold text-slate-500 text-[10px] uppercase tracking-widest w-[250px]">Tên Đợt / Hạng mục</th>
                                                                                <th className="px-3 py-2 font-bold text-slate-500 text-[10px] uppercase tracking-widest w-[110px] text-center">{detailModal.type === 'invoice' ? 'Ngày Xuất HĐ' : 'Ngày Đề Nghị'}</th>
                                                                                <th className="px-3 py-2 font-bold text-slate-500 text-[10px] uppercase tracking-widest text-right">{detailModal.type === 'invoice' ? 'Xuất Hóa Đơn' : 'Đề Nghị'}</th>
                                                                                <th className="px-3 py-2 font-bold text-slate-500 text-[10px] uppercase tracking-widest text-right">Thực Thu</th>
                                                                                <th className="px-3 py-2 font-bold text-slate-500 text-[10px] uppercase tracking-widest text-right w-[130px]">Công Nợ</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody className="divide-y divide-slate-100">
                                                                            {pendingPhases.map(pm => {
                                                                                const phaseReq = detailModal.type === 'invoice' ? (parseFloat(pm.invoice_amount)||0) : (parseFloat(pm.payment_request_amount)||0);
                                                                                const phaseInc = parseFloat(pm.external_income)||0;
                                                                                const phaseDebt = phaseReq - phaseInc;
                                                                                const isAdvance = phaseDebt <= 0 && phaseInc > 0;
                                                                                const invDateStr = detailModal.type === 'invoice' ? pm.invoice_date : pm.payment_request_date;
                                                                                return (
                                                                                    <tr key={pm.id} className={`transition-colors ${isAdvance ? 'bg-emerald-50/20 hover:bg-emerald-50/40' : 'hover:bg-slate-50/50'}`}>
                                                                                        <td className="px-3 py-2">
                                                                                            <div className="flex items-center gap-2">
                                                                                                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isAdvance ? 'bg-emerald-400' : 'bg-rose-400'}`}></div>
                                                                                                <span className="font-medium text-slate-700 truncate" title={pm.stage_name}>{pm.stage_name}</span>
                                                                                            </div>
                                                                                        </td>
                                                                                        <td className="px-3 py-2 text-center text-[12px] font-medium text-slate-500">
                                                                                            {invDateStr ? new Date(invDateStr).toLocaleDateString('vi-VN') : '-'}
                                                                                        </td>
                                                                                        <td className="px-3 py-2 text-right font-medium text-slate-600 tabular-nums">
                                                                                            {phaseReq > 0 ? formatVND(phaseReq) : '-'}
                                                                                        </td>
                                                                                        <td className="px-3 py-2 text-right font-medium text-emerald-600 tabular-nums">
                                                                                            {phaseInc > 0 ? formatVND(phaseInc) : '-'}
                                                                                        </td>
                                                                                        <td className="px-3 py-2 text-right font-medium tabular-nums">
                                                                                            {isAdvance ? (
                                                                                                <span className="text-emerald-600">+{formatVND(phaseInc)}</span>
                                                                                            ) : (
                                                                                                <span className="text-rose-600">{formatVND(phaseDebt)}</span>
                                                                                            )}
                                                                                        </td>
                                                                                    </tr>
                                                                                );
                                                                            })}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                                
                                                                {/* Summary Box */}
                                                                <div className="mt-4 pt-3 flex justify-end items-center gap-3 text-[11px] font-bold uppercase tracking-wide">
                                                                    <div className="text-slate-500">
                                                                        Tổng nợ các đợt: <span className="text-rose-600">{formatVND(totalPhaseDebt)}</span>
                                                                    </div>
                                                                    {totalAdvance > 0 && (
                                                                        <>
                                                                            <span className="text-slate-300">-</span>
                                                                            <div className="text-slate-500">
                                                                                Tạm ứng: <span className="text-emerald-500">{formatVND(totalAdvance)}</span>
                                                                            </div>
                                                                        </>
                                                                    )}
                                                                    <span className="text-slate-300">=</span>
                                                                    <div className="text-slate-600 tracking-normal px-2 py-1 bg-rose-50/50 rounded-md border border-rose-100/50">
                                                                        <span className="uppercase tracking-widest text-[9px] mr-1">Công nợ thực tế:</span>
                                                                        <span className="text-rose-600 text-[13px]">{formatVND(detailModal.type === 'invoice' ? p.debtInvoice : p.debtRequested)} ₫</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="text-slate-500 text-sm font-medium italic p-4 bg-slate-50 rounded-lg">Không xác định được đợt thanh toán nào gây ra công nợ (có thể do sai lệch số liệu lịch sử thu tiền).</div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                            {detailModal.data.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-16 text-center">
                                        <div className="w-20 h-20 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-300 mx-auto mb-4">
                                            <span className="material-symbols-outlined text-4xl">done_all</span>
                                        </div>
                                        <p className="text-slate-600 font-bold text-lg">Thật tuyệt vời!</p>
                                        <p className="text-slate-400 text-sm mt-1">Không có dự án nào ghi nhận công nợ trên hệ thống.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        <tfoot className="bg-white sticky bottom-0 z-10 shadow-[0_-10px_40px_rgba(0,0,0,0.06)] border-t-2 border-slate-200">
                            <tr>
                                <td colSpan={2} className="px-5 py-5 text-xs font-black text-slate-400 uppercase tracking-widest">
                                    TỔNG CỘNG ({detailModal.data.length} DỰ ÁN)
                                </td>
                                <td className="px-5 py-5 text-right text-base font-black text-slate-800 tabular-nums whitespace-nowrap">
                                    {formatVND(detailModal.data.reduce((s, p) => s + (detailModal.type === 'invoice' ? p.totalInvoice : p.totalRequested), 0))}
                                </td>
                                <td className="px-5 py-5 text-right text-base font-black text-emerald-600 tabular-nums whitespace-nowrap">
                                    {formatVND(detailModal.data.reduce((s, p) => s + p.totalIncome, 0))}
                                </td>
                                <td className="px-5 py-5 text-right text-lg font-black tabular-nums whitespace-nowrap bg-slate-50 border-l border-slate-200">
                                    {(() => {
                                        const totNet = detailModal.data.reduce((s, p) => s + (detailModal.type === 'invoice' ? p.debtInvoice : p.debtRequested), 0);
                                        return totNet < 0 ? <span className="text-emerald-600">+{formatVND(Math.abs(totNet))} ₫</span> : <span className="text-rose-600">{formatVND(totNet)} ₫</span>;
                                    })()}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    );
}
