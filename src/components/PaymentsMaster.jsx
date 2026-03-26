import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

// Helper functions (reused from PaymentTracking)
function getPaymentStatus(stage, lastExternalPaymentDate) {
    const income = Number(stage.external_income || 0);
    const request = Number(stage.payment_request_amount || 0);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const dueDate = stage.due_date ? new Date(stage.due_date) : null;
    const isFullyPaid = request > 0 && income >= request;
    if (isFullyPaid) {
        if (dueDate && lastExternalPaymentDate) {
            const lastPaid = new Date(lastExternalPaymentDate);
            if (lastPaid > dueDate) return { key: 'late', label: 'Trả đủ (muộn)', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300', dot: 'bg-orange-500', ring: 'border-orange-200 dark:border-orange-800' };
        }
        return { key: 'done', label: 'Đúng hạn', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300', dot: 'bg-green-500', ring: 'border-green-200 dark:border-green-800' };
    }
    if (dueDate && today > dueDate) return { key: 'overdue', label: 'Quá hạn', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300', dot: 'bg-red-500 animate-pulse', ring: 'border-red-200 dark:border-red-800' };
    if (income > 0) return { key: 'partial', label: 'Đang thu', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300', dot: 'bg-yellow-500', ring: 'border-yellow-200 dark:border-yellow-800' };
    return { key: 'pending', label: 'Chưa thu', color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400', dot: 'bg-slate-400', ring: 'border-slate-200 dark:border-slate-700' };
}

function daysDiff(dateStr) {
    if (!dateStr) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return Math.round((today - new Date(dateStr)) / 86400000);
}

export default function PaymentsMaster() {
    const [stages, setStages] = useState([]);
    const [projectsMap, setProjectsMap] = useState({});
    const [loading, setLoading] = useState(true);
    const [lastPayDates, setLastPayDates] = useState({});
    const [expandedCard, setExpandedCard] = useState(null);

    const fmt = (v) => v ? Number(v).toLocaleString('vi-VN') : '—';
    const fmtDate = (d) => d ? new Date(d).toLocaleDateString('vi-VN') : '—';
    const formatBillion = (val) => (val / 1000000000).toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' Tỷ';

    useEffect(() => {
        fetchAll();
    }, []);

    async function fetchAll() {
        setLoading(true);
        // Fetch all projects to map IDs to project codes/names
        const { data: projs } = await supabase.from('projects').select('id, code, name');
        const pMap = {};
        if (projs) {
            projs.forEach(p => { pMap[p.id] = p; });
            setProjectsMap(pMap);
        }

        // Fetch all payment stages
        const { data } = await supabase.from('payments').select('*').order('created_at', { ascending: false });
        setStages(data || []);

        if (data && data.length > 0) {
            const ids = data.map(s => s.id);
            const { data: extHist } = await supabase.from('external_payment_history')
                .select('payment_stage_id, payment_date')
                .in('payment_stage_id', ids)
                .order('payment_date', { ascending: false });

            const map = {};
            if (extHist) {
                extHist.forEach(h => {
                    if (!map[h.payment_stage_id]) map[h.payment_stage_id] = h.payment_date;
                });
            }
            setLastPayDates(map);
        }
        setLoading(false);
    };

    // Calculate aggregated stats
    const totalExpected = stages.reduce((s, p) => s + Number(p.expected_amount || 0), 0);
    const totalRequest = stages.reduce((s, p) => s + Number(p.payment_request_amount || 0), 0);
    const totalIncome = stages.reduce((s, p) => s + Number(p.external_income || 0), 0);
    const totalDebtCdt = totalRequest - totalIncome; // Only debt based on requested amount
    const totalDebtActualSateco = stages.reduce((s, p) => s + Number(p.internal_debt_actual || 0), 0);
    const totalPaidSateco = stages.reduce((s, p) => s + Number(p.internal_paid || 0), 0);
    const totalRemainingDebtSateco = totalDebtActualSateco - totalPaidSateco;

    if (loading && stages.length === 0) {
        return <div className="p-12 text-center text-slate-500 animate-pulse">Đang tải dữ liệu thanh toán tổng hợp...</div>;
    }

    return (
        <div className="pb-10 animate-fade-in text-slate-900 dark:text-slate-100">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2 tracking-tight">
                        <span className="material-symbols-outlined notranslate text-blue-600 text-[28px]" translate="no">account_balance</span>
                        Sổ cái Thanh toán Tổng hợp
                    </h2>
                    <p className="text-slate-500 text-sm mt-1 uppercase font-semibold tracking-wider">Tất cả dự án · Quản lý Dòng tiền Thăng Long & Sateco</p>
                </div>
                <button onClick={fetchAll} className="p-2.5 bg-white dark:bg-[#1e293b] text-slate-600 dark:text-slate-300 rounded-full hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm border border-slate-200 dark:border-slate-700 flex items-center hover:rotate-180 duration-500">
                    <span className="material-symbols-outlined notranslate" translate="no">refresh</span>
                </button>
            </div>

            {/* Global KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
                <div className="bg-white dark:bg-[#1e293b] rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Tổng ĐNTT (Chờ thu)</p>
                    </div>
                    <p className="text-2xl font-black text-blue-600 dark:text-blue-400">{formatBillion(totalRequest)}</p>
                    <p className="text-[10px] text-slate-400 mt-1">Lũy kế Đề nghị thanh toán</p>
                </div>

                <div className="bg-green-50 dark:bg-green-900/10 rounded-2xl shadow-sm border border-green-100 dark:border-green-800/30 p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="w-2.5 h-2.5 rounded-full bg-green-500"></span>
                        <p className="text-xs font-bold text-green-700 uppercase tracking-wide">Tổng Thực thu CĐT</p>
                    </div>
                    <p className="text-2xl font-black text-green-600 dark:text-green-500">{formatBillion(totalIncome)}</p>
                    <p className="text-[10px] text-green-600/70 mt-1">Đã vào tài khoản Thăng Long</p>
                </div>

                <div className="bg-red-50 dark:bg-red-900/10 rounded-2xl shadow-sm border border-red-100 dark:border-red-800/30 p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                        <p className="text-xs font-bold text-red-700 uppercase tracking-wide">Tổng Công nợ CĐT</p>
                    </div>
                    <p className="text-2xl font-black text-red-600 dark:text-red-500">{formatBillion(Math.max(0, totalDebtCdt))}</p>
                    <p className="text-[10px] text-red-600/70 mt-1">Tổng ĐNTT - Thực thu</p>
                </div>

                <div className="bg-orange-50 dark:bg-orange-900/10 rounded-2xl shadow-sm border border-orange-100 dark:border-orange-800/30 p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
                        <p className="text-xs font-bold text-orange-700 uppercase tracking-wide">Dư Nợ Sateco</p>
                    </div>
                    <p className="text-2xl font-black text-orange-600 dark:text-orange-500">{formatBillion(totalRemainingDebtSateco)}</p>
                    <p className="text-[10px] text-orange-600/70 mt-1">Cần giải ngân về Sateco</p>
                </div>
            </div>

            {/* List of All Stages */}
            <div className="bg-white dark:bg-[#1e293b] rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                <h3 className="font-bold text-base mb-6 flex items-center gap-2">
                    <span className="material-symbols-outlined notranslate text-slate-400" translate="no">table_rows</span>
                    Chi tiết các đợt thanh toán toàn dự án
                </h3>

                {stages.length === 0 ? (
                    <div className="text-center py-16 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                        <span className="material-symbols-outlined notranslate text-4xl text-slate-300 block mb-2" translate="no">payments</span>
                        <p className="text-slate-500">Chưa có đợt thanh toán nào được tạo.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {stages.map((stage) => {
                            const status = getPaymentStatus(stage, lastPayDates[stage.id]);
                            const income = Number(stage.external_income || 0);
                            const request = Number(stage.payment_request_amount || 0);
                            const pct = request > 0 ? Math.min(100, (income / request) * 100) : 0;
                            const diff = daysDiff(stage.due_date);
                            const isOverdue = status.key === 'overdue';
                            const isExpanded = expandedCard === stage.id;
                            const proj = projectsMap[stage.project_id] || { code: 'N/A', name: 'Đang tải...' };

                            return (
                                <div key={stage.id} className={`rounded-xl border-2 transition-all ${status.ring} ${isOverdue ? 'shadow-red-100 shadow-md bg-red-50/20 dark:bg-red-900/10' : 'bg-slate-50/50 dark:bg-slate-800/30'}`}>
                                    <div className="p-4 cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-colors rounded-xl" onClick={() => setExpandedCard(isExpanded ? null : stage.id)}>
                                        <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4">

                                            {/* Project Info & Stage */}
                                            <div className="flex items-start gap-4">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${status.key === 'done' ? 'bg-green-100 text-green-700' : status.key === 'overdue' ? 'bg-red-100 text-red-700' : status.key === 'partial' ? 'bg-yellow-100 text-yellow-700' : status.key === 'late' ? 'bg-orange-100 text-orange-700' : 'bg-slate-200 text-slate-500'}`}>
                                                    <span className="material-symbols-outlined notranslate" translate="no">{status.key === 'done' ? 'done_all' : status.key === 'overdue' ? 'warning' : status.key === 'partial' ? 'hourglass_bottom' : status.key === 'late' ? 'alarm_on' : 'pending_actions'}</span>
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                                        <span className="text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded">{proj.code}</span>
                                                        <span className="font-bold text-sm text-slate-800 dark:text-white truncate max-w-[200px]" title={proj.name}>{proj.name}</span>
                                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${status.color}`}>
                                                            <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`}></span>
                                                            {status.label}
                                                        </span>
                                                    </div>
                                                    <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">{stage.stage_name} <span className="text-slate-400 font-normal">({stage.stage_type})</span></div>

                                                    {stage.due_date && (
                                                        <div className={`flex items-center gap-1 text-[11px] ${isOverdue ? 'text-red-500 font-semibold' : 'text-slate-500'}`}>
                                                            <span className="material-symbols-outlined notranslate text-[14px]" translate="no">event</span>
                                                            Hạn thanh toán: {fmtDate(stage.due_date)}
                                                            {diff !== null && diff > 0 && <span className="text-red-500 font-bold ml-1">(quá hạn {diff} ngày)</span>}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Financials & Progress */}
                                            <div className="flex items-center gap-6 lg:ml-auto">
                                                <div className="text-right">
                                                    <div className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">Thực thu CĐT / ĐNTT</div>
                                                    <div className="flex items-baseline gap-1 justify-end">
                                                        <span className="text-lg font-black text-green-600">{(income / 1000000000).toLocaleString('vi-VN', { minimumFractionDigits: 3 })}</span>
                                                        <span className="text-xs text-slate-400 font-bold">/ {(request / 1000000000).toLocaleString('vi-VN', { minimumFractionDigits: 3 })} Tỷ</span>
                                                    </div>
                                                </div>

                                                <div className="w-32 hidden md:block">
                                                    <div className="flex justify-between text-[10px] mb-1 font-bold text-slate-500">
                                                        <span>Tiến độ</span>
                                                        <span>{pct.toFixed(0)}%</span>
                                                    </div>
                                                    <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                                        <div className={`h-full rounded-full transition-all duration-700 ${status.key === 'done' ? 'bg-green-500' : status.key === 'late' ? 'bg-orange-500' : status.key === 'overdue' ? 'bg-red-500' : status.key === 'partial' ? 'bg-yellow-400' : 'bg-slate-400'}`} style={{ width: `${pct}%` }} />
                                                    </div>
                                                </div>

                                                <span className="material-symbols-outlined notranslate text-slate-400 transition-transform duration-200" translate="no" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>expand_more</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Expanded Details */}
                                    {isExpanded && (
                                        <div className="border-t border-slate-200 dark:border-slate-700 p-5 bg-white dark:bg-[#1a2333] rounded-b-xl grid grid-cols-1 md:grid-cols-3 gap-6">

                                            {/* Block 1: Thăng Long -> CĐT */}
                                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-100 dark:border-slate-800">
                                                <h4 className="text-xs font-bold text-blue-600 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                                                    <span className="material-symbols-outlined notranslate text-[16px]" translate="no">domain</span> Thăng Long vs CĐT
                                                </h4>
                                                <div className="space-y-2 text-sm">
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-500">Dự kiến thu</span>
                                                        <span className="font-semibold">{fmt(stage.expected_amount)} ₫</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-500">Đã xuất HĐ</span>
                                                        <span className="font-semibold">{fmt(stage.invoice_amount)} ₫</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-500">Đề nghị TT</span>
                                                        <span className="font-bold text-blue-600">{fmt(stage.payment_request_amount)} ₫</span>
                                                    </div>
                                                    <div className="flex justify-between pt-2 border-t border-slate-200 dark:border-slate-700">
                                                        <span className="text-slate-500 font-semibold">Công nợ CĐT</span>
                                                        <span className={`font-black ${request > income ? 'text-red-500' : 'text-green-500'}`}>
                                                            {fmt(Math.max(0, request - income))} ₫
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Block 2: Sateco Internal */}
                                            <div className="bg-orange-50/50 dark:bg-orange-900/10 rounded-xl p-4 border border-orange-100 dark:border-orange-900/30">
                                                <h4 className="text-xs font-bold text-orange-600 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                                                    <span className="material-symbols-outlined notranslate text-[16px]" translate="no">account_tree</span> Sateco Nội bộ
                                                </h4>
                                                <div className="space-y-2 text-sm">
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-500">Nợ thực tế</span>
                                                        <span className="font-semibold text-orange-700 dark:text-orange-400">{fmt(stage.internal_debt_actual)} ₫</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-500">Đã giải ngân</span>
                                                        <span className="font-bold text-green-600">{fmt(stage.internal_paid)} ₫</span>
                                                    </div>
                                                    <div className="flex justify-between pt-2 border-t border-orange-200 dark:border-orange-800">
                                                        <span className="text-slate-500 font-semibold">Còn nợ Sateco</span>
                                                        <span className="font-black text-red-500">
                                                            {fmt(Math.max(0, Number(stage.internal_debt_actual) - Number(stage.internal_paid)))} ₫
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Block 3: Action Context */}
                                            <div className="flex flex-col justify-center text-center p-4 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50/50 dark:bg-slate-800/30">
                                                <span className="material-symbols-outlined notranslate text-3xl text-slate-300 mb-2" translate="no">touch_app</span>
                                                <p className="text-xs text-slate-500 mb-2 leading-relaxed">Để thao tác ghi nhận Thu tiền CĐT hoặc Trả nợ Sateco cho đợt này, vui lòng truy cập vào chi tiết dự án.</p>
                                                <div className="text-[10px] font-bold text-slate-400 bg-slate-200 dark:bg-slate-700 py-1 px-3 rounded-full inline-block mx-auto">Chỉ xem tổng hợp</div>
                                            </div>

                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
