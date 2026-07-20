import React, { useState } from 'react';
import { formatVND } from '../../utils/formatters';

/**
 * Detail Modal for dashboard drill-down views.
 * Supports: invoice, requested, unsigned, unsettled, pending
 * Desktop (md+): bảng 5 cột như cũ. Mobile: full-screen + card list + footer tổng luôn hiển thị.
 */
// Bỏ dấu tiếng Việt + thường hóa để tìm kiếm "thông minh" (gõ không dấu vẫn khớp)
const norm = (s) => (s ?? '').toString().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');

export default function DashboardDetailModal({ detailModal, setDetailModal }) {
    const [expandedProject, setExpandedProject] = useState(null);
    const [search, setSearch] = useState('');

    if (!detailModal.isOpen) return null;

    const type = detailModal.type;
    const isDebtType = type === 'invoice' || type === 'requested';

    // Giá trị từng dòng theo ĐÚNG loại modal — dùng chung cho bảng desktop, card mobile VÀ tổng cộng.
    // (tfoot cũ reduce thẳng trên totalInvoice/totalRequested/totalIncome vốn KHÔNG tồn tại với
    //  unsigned/unsettled/pending -> NaN bị formatVND che thành "0" sai. Tính qua rowValues để đúng cả 5 loại.)
    const rowValues = (p) => {
        if (type === 'pending') {
            const val1 = parseFloat(p.payment_request_amount) || 0;
            const valThu = parseFloat(p.external_income) || 0;
            return { val1, valThu, valNo: val1 - valThu };
        }
        if (isDebtType) {
            return {
                val1: (type === 'invoice' ? p.totalInvoice : p.totalRequested) || 0,
                valThu: p.totalIncome || 0,
                valNo: (type === 'invoice' ? p.debtInvoice : p.debtRequested) || 0,
            };
        }
        const val1 = p.total_value_post_vat || (parseFloat(p.original_value || 0) * 1.08);
        return { val1, valThu: p.totalIncome || 0, valNo: val1 };
    };
    const rowLabels = (p) => {
        if (type === 'pending') return { code: p.payment_code, name: p.projects?.name || 'N/A', sub: p.stage_name };
        return { code: p.internal_code || p.code, name: p.name, sub: p.partners?.short_name || p.partners?.name || 'N/A' };
    };
    // Lọc theo ô tìm kiếm: khớp mã, tên dự án, đối tác/diễn giải (không phân biệt dấu)
    const q = norm(search.trim());
    const rows = q
        ? detailModal.data.filter(p => {
            const { code, name, sub } = rowLabels(p);
            return norm(`${code} ${name} ${sub}`).includes(q);
        })
        : detailModal.data;

    // Tổng cộng tính theo danh sách ĐANG hiển thị — lọc gì thì tổng nấy
    const totals = rows.reduce((a, p) => {
        const v = rowValues(p);
        a.val1 += v.val1; a.valThu += v.valThu; a.valNo += v.valNo;
        return a;
    }, { val1: 0, valThu: 0, valNo: 0 });

    // Các đợt thanh toán gây công nợ / tạm ứng (chỉ với invoice/requested).
    const phasesOf = (p) => {
        const pendingPhases = isDebtType ? (p.projPmts || []).filter(pm => {
            const phaseReq = type === 'invoice' ? (pm.invoice_date ? (parseFloat(pm.invoice_amount) || 0) : 0) : (parseFloat(pm.payment_request_amount) || 0);
            const phaseInc = parseFloat(pm.external_income) || 0;
            return (phaseReq - phaseInc > 0) || (phaseInc > 0);
        }) : [];
        const totalPhaseDebt = pendingPhases.reduce((s, pm) => {
            const req = type === 'invoice' ? (pm.invoice_date ? (parseFloat(pm.invoice_amount) || 0) : 0) : (parseFloat(pm.payment_request_amount) || 0);
            const inc = parseFloat(pm.external_income) || 0;
            return s + Math.max(0, req - inc);
        }, 0);
        const totalAdvance = pendingPhases.reduce((s, pm) => {
            const req = type === 'invoice' ? (pm.invoice_date ? (parseFloat(pm.invoice_amount) || 0) : 0) : (parseFloat(pm.payment_request_amount) || 0);
            const inc = parseFloat(pm.external_income) || 0;
            return s + Math.max(0, inc - req);
        }, 0);
        return { pendingPhases, totalPhaseDebt, totalAdvance };
    };

    const val1Label = type === 'pending' ? 'Giá trị ĐNTT'
        : (type === 'unsigned' || type === 'unsettled') ? 'Giá trị TVH'
        : type === 'invoice' ? 'Tổng Hóa Đơn' : 'Tổng Đề Nghị';
    const valNoLabel = (type === 'unsigned' || type === 'unsettled') ? 'Giá trị HĐ' : 'Công Nợ';
    const countLabel = type === 'pending' ? 'HỒ SƠ' : 'DỰ ÁN';

    const closeModal = () => {
        setSearch('');
        setExpandedProject(null);
        setDetailModal({ isOpen: false, type: null, data: [] });
    };

    return (
        <div className="light-scope fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={closeModal}>
            <div className="bg-white shadow-2xl w-full h-[100dvh] max-h-[100dvh] rounded-none sm:h-auto sm:max-h-[90vh] sm:rounded-[24px] max-w-6xl flex flex-col overflow-hidden border border-slate-200/60 relative animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <div className={`p-4 md:p-8 border-b flex items-center justify-between gap-3 shrink-0 ${
                    type === 'invoice' || type === 'unsigned' ? 'bg-rose-50/80 border-rose-100' :
                    type === 'requested' || type === 'unsettled' ? 'bg-amber-50/80 border-amber-100' :
                    'bg-orange-50/80 border-orange-100'
                }`}>
                    <div className="flex items-center gap-3 md:gap-4 min-w-0">
                        <div className={`w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl flex items-center justify-center shadow-sm shrink-0 ${
                            type === 'invoice' || type === 'unsigned' ? 'bg-rose-100 text-rose-600 border border-rose-200/50' :
                            type === 'requested' || type === 'unsettled' ? 'bg-amber-100 text-amber-600 border border-amber-200/50' :
                            'bg-orange-100 text-orange-600 border border-orange-200/50'
                        }`}>
                            <span className="material-symbols-outlined text-[22px] md:text-[32px]">
                                {type === 'unsigned' ? 'draw' :
                                 type === 'unsettled' ? 'fact_check' :
                                 type === 'pending' ? 'pending_actions' :
                                 type === 'invoice' ? 'assignment_turned_in' : 'pending_actions'}
                            </span>
                        </div>
                        <div className="min-w-0">
                            <h3 className={`text-base md:text-2xl font-black tracking-tight break-words ${
                                type === 'invoice' || type === 'unsigned' ? 'text-rose-700' :
                                type === 'requested' || type === 'unsettled' ? 'text-amber-800' :
                                'text-orange-800'
                            }`}>
                                {type === 'unsigned' ? 'HĐ CHƯA KÝ' :
                                 type === 'unsettled' ? 'DA CHƯA QUYẾT TOÁN' :
                                 type === 'pending' ? 'HỒ SƠ CHỜ DUYỆT' :
                                 type === 'invoice' ? 'CHI TIẾT CÔNG NỢ HÓA ĐƠN' : 'CHI TIẾT CÔNG NỢ ĐỀ NGHỊ'}
                            </h3>
                            <p className="text-[10px] md:text-xs font-black text-slate-500 uppercase tracking-widest mt-0.5 md:mt-1 line-clamp-2">
                                {type === 'unsigned' ? 'DANH SÁCH CÁC HỢP ĐỒNG CHƯA HOÀN TẤT KÝ KẾT' :
                                 type === 'unsettled' ? 'DỰ ÁN ĐÃ HOÀN THÀNH NHƯNG CHƯA QUYẾT TOÁN XONG' :
                                 type === 'pending' ? 'DANH SÁCH HỒ SƠ THANH TOÁN ĐANG CHỜ XÉT DUYỆT' :
                                 'CÁC DỰ ÁN ĐANG GHI NHẬN CÔNG NỢ HOẶC THU DƯ TẠM ỨNG'}
                            </p>
                        </div>
                    </div>
                    <button onClick={closeModal} className="w-11 h-11 rounded-full bg-white flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 shadow-sm transition-all active:scale-95 border border-slate-200 shrink-0">
                        <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                </div>

                {/* ── Thanh tìm kiếm thông minh (không dấu vẫn khớp) ── */}
                {detailModal.data.length > 3 && (
                    <div className="shrink-0 px-3 md:px-8 py-2 md:py-2.5 bg-white border-b border-slate-100">
                        <div className="relative">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[20px] pointer-events-none">search</span>
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Tìm mã dự án, đối tác, tên dự án... (không cần gõ dấu)"
                                aria-label="Tìm kiếm trong danh sách"
                                className="w-full min-h-[44px] md:min-h-0 pl-10 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/40 focus:border-blue-300 focus:bg-white outline-none transition-all"
                            />
                            {search && (
                                <button
                                    onClick={() => setSearch('')}
                                    aria-label="Xóa tìm kiếm"
                                    className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                                >
                                    <span className="material-symbols-outlined text-[18px]">close</span>
                                </button>
                            )}
                        </div>
                        {q && (
                            <p className="text-[11px] font-bold text-slate-400 mt-1.5">
                                Khớp <span className="text-blue-600">{rows.length}</span>/{detailModal.data.length} {countLabel.toLowerCase()}
                            </p>
                        )}
                    </div>
                )}

                <div className="p-0 overflow-auto flex-1 bg-slate-50/30">
                    {/* ── MOBILE: card list ── */}
                    <div className="md:hidden p-3 space-y-3">
                        {rows.map(p => {
                            const { val1, valThu, valNo } = rowValues(p);
                            const { code, name, sub } = rowLabels(p);
                            const isExpanded = expandedProject === p.id && isDebtType;
                            const { pendingPhases, totalPhaseDebt, totalAdvance } = isExpanded ? phasesOf(p) : { pendingPhases: [], totalPhaseDebt: 0, totalAdvance: 0 };
                            const CardHead = isDebtType ? 'button' : 'div';
                            return (
                                <div key={p.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                                    <CardHead
                                        {...(isDebtType ? { onClick: () => setExpandedProject(isExpanded ? null : p.id), 'aria-expanded': isExpanded } : {})}
                                        className={`w-full text-left p-3 ${isDebtType ? 'active:bg-slate-50 cursor-pointer' : ''}`}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <span className="text-xs font-mono font-black text-slate-700 bg-slate-100 px-2 py-1 rounded-lg border border-slate-200 shrink-0">{code}</span>
                                            {isDebtType && (
                                                <span className={`w-8 h-8 -my-1 -mr-1 rounded-full flex items-center justify-center shrink-0 transition-transform ${isExpanded ? 'bg-blue-100 text-blue-600 rotate-180' : 'bg-slate-100 text-slate-400'}`}>
                                                    <span className="material-symbols-outlined text-[18px]">expand_more</span>
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm font-black text-slate-800 mt-1.5 break-words line-clamp-2">{sub}</p>
                                        <p className="text-xs font-bold text-slate-400 mt-0.5 break-words line-clamp-2">{name}</p>
                                        <div className="grid grid-cols-3 gap-1 mt-2 text-[11px]">
                                            <div>
                                                <p className="text-slate-400 font-bold uppercase text-[9px] tracking-wide">{val1Label}</p>
                                                <p className="font-black text-slate-700 tabular-nums break-words">{formatVND(val1)}</p>
                                            </div>
                                            <div>
                                                <p className="text-slate-400 font-bold uppercase text-[9px] tracking-wide">Thực Thu</p>
                                                <p className="font-black text-emerald-600 tabular-nums break-words">{formatVND(valThu)}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-slate-400 font-bold uppercase text-[9px] tracking-wide">{valNoLabel}</p>
                                                <p className={`font-black tabular-nums break-words ${
                                                    type === 'unsigned' || type === 'unsettled' ? 'text-slate-600' :
                                                    valNo < 0 ? 'text-emerald-600' : 'text-rose-600'
                                                }`}>
                                                    {valNo < 0 ? `+${formatVND(Math.abs(valNo))}` : formatVND(valNo)}
                                                </p>
                                            </div>
                                        </div>
                                    </CardHead>
                                    {isExpanded && (
                                        <div className="border-t border-slate-100 bg-slate-50/60 p-3">
                                            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                                <span className="material-symbols-outlined text-[14px]">format_list_bulleted</span>
                                                Chi tiết các đợt thanh toán
                                            </h4>
                                            {pendingPhases.length > 0 ? (
                                                <>
                                                    <div className="space-y-2">
                                                        {pendingPhases.map(pm => {
                                                            const phaseReq = type === 'invoice' ? (pm.invoice_date ? (parseFloat(pm.invoice_amount) || 0) : 0) : (parseFloat(pm.payment_request_amount) || 0);
                                                            const phaseInc = parseFloat(pm.external_income) || 0;
                                                            const phaseDebt = phaseReq - phaseInc;
                                                            const isAdvance = phaseDebt <= 0 && phaseInc > 0;
                                                            const invDateStr = type === 'invoice' ? pm.invoice_date : pm.payment_request_date;
                                                            return (
                                                                <div key={pm.id} className={`rounded-lg border p-2.5 ${isAdvance ? 'bg-emerald-50/40 border-emerald-100' : 'bg-white border-slate-200'}`}>
                                                                    <div className="flex items-start justify-between gap-2">
                                                                        <div className="flex items-center gap-1.5 min-w-0">
                                                                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isAdvance ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
                                                                            <span className="text-[12px] font-medium text-slate-700 break-words line-clamp-2">{pm.stage_name}</span>
                                                                        </div>
                                                                        <span className="text-[10px] font-medium text-slate-400 shrink-0">{invDateStr ? new Date(invDateStr).toLocaleDateString('vi-VN') : '—'}</span>
                                                                    </div>
                                                                    <div className="grid grid-cols-3 gap-1 mt-1.5 text-[11px] tabular-nums">
                                                                        <div>
                                                                            <p className="text-slate-400 text-[9px] uppercase font-bold">{type === 'invoice' ? 'Xuất HĐ' : 'Đề nghị'}</p>
                                                                            <p className="font-medium text-slate-600">{phaseReq > 0 ? formatVND(phaseReq) : '—'}</p>
                                                                        </div>
                                                                        <div>
                                                                            <p className="text-slate-400 text-[9px] uppercase font-bold">Thực thu</p>
                                                                            <p className="font-medium text-emerald-600">{phaseInc > 0 ? formatVND(phaseInc) : '—'}</p>
                                                                        </div>
                                                                        <div className="text-right">
                                                                            <p className="text-slate-400 text-[9px] uppercase font-bold">Công nợ</p>
                                                                            {isAdvance
                                                                                ? <p className="font-medium text-emerald-600">+{formatVND(phaseInc)}</p>
                                                                                : <p className="font-medium text-rose-600">{formatVND(phaseDebt)}</p>}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                    <div className="mt-2.5 pt-2 border-t border-slate-200 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                                                        <span>Tổng nợ các đợt: <span className="text-rose-600">{formatVND(totalPhaseDebt)}</span></span>
                                                        {totalAdvance > 0 && <span>− Tạm ứng: <span className="text-emerald-500">{formatVND(totalAdvance)}</span></span>}
                                                        <span className="px-2 py-1 bg-rose-50/70 rounded-md border border-rose-100/50 tracking-normal">
                                                            Công nợ thực tế: <span className="text-rose-600 text-[12px]">{formatVND(type === 'invoice' ? p.debtInvoice : p.debtRequested)} ₫</span>
                                                        </span>
                                                    </div>
                                                </>
                                            ) : (
                                                <p className="text-slate-500 text-[12px] font-medium italic p-3 bg-slate-100/60 rounded-lg">Không xác định được đợt thanh toán nào gây ra công nợ (có thể do sai lệch số liệu lịch sử thu tiền).</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        {rows.length === 0 && (
                            <div className="py-14 text-center">
                                <div className="w-16 h-16 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-300 mx-auto mb-3">
                                    <span className="material-symbols-outlined text-3xl">{q ? 'search_off' : 'done_all'}</span>
                                </div>
                                <p className="text-slate-600 font-bold">{q ? 'Không tìm thấy kết quả' : 'Thật tuyệt vời!'}</p>
                                <p className="text-slate-400 text-sm mt-1">{q ? `Không có ${countLabel.toLowerCase()} nào khớp "${search}".` : 'Không có dự án nào ghi nhận công nợ trên hệ thống.'}</p>
                            </div>
                        )}
                    </div>

                    {/* ── DESKTOP: bảng 5 cột như cũ ── */}
                    <div className="hidden md:block">
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
                                <th className="px-5 py-4">Mã {type === 'pending' ? 'Hồ sơ' : 'Dự án'}</th>
                                <th className="px-5 py-4">{type === 'pending' ? 'Công việc / Dự án' : 'Đối Tác'}</th>
                                <th className="px-5 py-4 text-right">{val1Label}</th>
                                <th className="px-5 py-4 text-right">Thực Thu</th>
                                <th className="px-5 py-4 text-right text-rose-600 bg-rose-50/30">{valNoLabel}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {rows.map(p => {
                                const { val1, valThu, valNo } = rowValues(p);
                                const { code, name, sub } = rowLabels(p);
                                const isExpanded = expandedProject === p.id && isDebtType;
                                const { pendingPhases, totalPhaseDebt, totalAdvance } = isExpanded ? phasesOf(p) : { pendingPhases: [], totalPhaseDebt: 0, totalAdvance: 0 };

                                return (
                                    <React.Fragment key={p.id}>
                                        <tr
                                            onClick={() => isDebtType && setExpandedProject(isExpanded ? null : p.id)}
                                            className={`transition-colors group ${isDebtType ? 'cursor-pointer' : ''} ${isExpanded ? 'bg-blue-50/40 relative z-0' : 'bg-white hover:bg-slate-50/80'}`}
                                        >
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-2">
                                                    {isDebtType && (
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
                                                type === 'unsigned' || type === 'unsettled' ? 'text-slate-600' :
                                                valNo < 0 ? 'text-emerald-600 bg-emerald-50/40' : 'text-rose-600 bg-rose-50/10'
                                            }`}>
                                                {valNo < 0 ? `+${formatVND(Math.abs(valNo))}` : formatVND(valNo)}&nbsp;{type !== 'unsigned' && type !== 'unsettled' ? '₫' : ''}
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
                                                                                <th className="px-3 py-2 font-bold text-slate-500 text-[10px] uppercase tracking-widest w-[110px] text-center">{type === 'invoice' ? 'Ngày Xuất HĐ' : 'Ngày Đề Nghị'}</th>
                                                                                <th className="px-3 py-2 font-bold text-slate-500 text-[10px] uppercase tracking-widest text-right">{type === 'invoice' ? 'Xuất Hóa Đơn' : 'Đề Nghị'}</th>
                                                                                <th className="px-3 py-2 font-bold text-slate-500 text-[10px] uppercase tracking-widest text-right">Thực Thu</th>
                                                                                <th className="px-3 py-2 font-bold text-slate-500 text-[10px] uppercase tracking-widest text-right w-[130px]">Công Nợ</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody className="divide-y divide-slate-100">
                                                                            {pendingPhases.map(pm => {
                                                                                const phaseReq = type === 'invoice' ? (pm.invoice_date ? (parseFloat(pm.invoice_amount)||0) : 0) : (parseFloat(pm.payment_request_amount)||0);
                                                                                const phaseInc = parseFloat(pm.external_income)||0;
                                                                                const phaseDebt = phaseReq - phaseInc;
                                                                                const isAdvance = phaseDebt <= 0 && phaseInc > 0;
                                                                                const invDateStr = type === 'invoice' ? pm.invoice_date : pm.payment_request_date;
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
                                                                        <span className="text-rose-600 text-[13px]">{formatVND(type === 'invoice' ? p.debtInvoice : p.debtRequested)} ₫</span>
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
                            {rows.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-16 text-center">
                                        <div className="w-20 h-20 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-300 mx-auto mb-4">
                                            <span className="material-symbols-outlined text-4xl">{q ? 'search_off' : 'done_all'}</span>
                                        </div>
                                        <p className="text-slate-600 font-bold text-lg">{q ? 'Không tìm thấy kết quả' : 'Thật tuyệt vời!'}</p>
                                        <p className="text-slate-400 text-sm mt-1">{q ? `Không có ${countLabel.toLowerCase()} nào khớp "${search}".` : 'Không có dự án nào ghi nhận công nợ trên hệ thống.'}</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        <tfoot className="bg-white sticky bottom-0 z-10 shadow-[0_-10px_40px_rgba(0,0,0,0.06)] border-t-2 border-slate-200">
                            <tr>
                                <td colSpan={2} className="px-5 py-5 text-xs font-black text-slate-400 uppercase tracking-widest">
                                    TỔNG CỘNG ({rows.length} {countLabel}){q ? ' — ĐANG LỌC' : ''}
                                </td>
                                <td className="px-5 py-5 text-right text-base font-black text-slate-800 tabular-nums whitespace-nowrap">
                                    {formatVND(totals.val1)}
                                </td>
                                <td className="px-5 py-5 text-right text-base font-black text-emerald-600 tabular-nums whitespace-nowrap">
                                    {formatVND(totals.valThu)}
                                </td>
                                <td className="px-5 py-5 text-right text-lg font-black tabular-nums whitespace-nowrap bg-slate-50 border-l border-slate-200">
                                    {totals.valNo < 0 ? <span className="text-emerald-600">+{formatVND(Math.abs(totals.valNo))} ₫</span> : <span className="text-rose-600">{formatVND(totals.valNo)} ₫</span>}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                    </div>
                </div>

                {/* ── MOBILE: tổng cộng LUÔN hiển thị (nằm ngoài vùng cuộn, đệm safe-area iOS) ── */}
                {rows.length > 0 && (
                    <div className="md:hidden shrink-0 border-t-2 border-slate-200 bg-white px-4 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(0,0,0,0.06)]">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tổng cộng ({rows.length} {countLabel}){q ? ' — đang lọc' : ''}</p>
                        <div className="grid grid-cols-3 gap-1 text-[11px] tabular-nums">
                            <div>
                                <p className="text-slate-400 text-[9px] uppercase font-bold">{val1Label}</p>
                                <p className="font-black text-slate-800 break-words">{formatVND(totals.val1)}</p>
                            </div>
                            <div>
                                <p className="text-slate-400 text-[9px] uppercase font-bold">Thực Thu</p>
                                <p className="font-black text-emerald-600 break-words">{formatVND(totals.valThu)}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-slate-400 text-[9px] uppercase font-bold">{valNoLabel}</p>
                                <p className={`font-black break-words ${totals.valNo < 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    {totals.valNo < 0 ? `+${formatVND(Math.abs(totals.valNo))}` : formatVND(totals.valNo)} ₫
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
