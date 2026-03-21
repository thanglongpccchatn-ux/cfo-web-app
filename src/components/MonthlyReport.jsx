import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';

// Helper formatting
const formatVND = (v) => v ? Number(Math.round(v)).toLocaleString('vi-VN') : '0';
const formatBillion = (val) => {
    if (!val) return '0';
    if (val >= 1e9) return (val / 1e9).toFixed(1) + ' Tỷ';
    if (val >= 1e6) return (val / 1e6).toFixed(0) + ' Tr';
    return formatVND(val);
};

export default function MonthlyReport() {
    const [loading, setLoading] = useState(true);
    const [rawData, setRawData] = useState({
        projects: [], payments: [], materials: [], labors: [], expenses: []
    });
    
    // Manage Target Month
    const [targetDate, setTargetDate] = useState(new Date());

    useEffect(() => { fetchAllData(); }, []);

    const fetchAllData = async () => {
        setLoading(true);
        try {
            const [ { data: projs }, { data: pmt }, { data: mats }, { data: labs }, { data: exps } ] = await Promise.all([
                supabase.from('projects').select('*'),
                supabase.from('payments').select('*, projects(code, name)'),
                supabase.from('expense_materials').select('*'),
                supabase.from('expense_labor').select('*'),
                supabase.from('expenses').select('*')
            ]);
            setRawData({
                projects: projs || [], 
                payments: pmt || [], 
                materials: mats || [], 
                labors: labs || [], 
                expenses: exps || []
            });
        } catch (error) { 
            console.error("Error fetching data:", error); 
        } finally { 
            setLoading(false); 
        }
    };

    const stats = useMemo(() => {
        const month = targetDate.getMonth() + 1;
        const year = targetDate.getFullYear();
        
        let inflowPlan = 0; let inflowActual = 0;
        let matActual = 0; let laborActual = 0; let expActual = 0;
        let otherInco = 0;
        let nextMonthInflowForecast = 0; let nextMonthOutflowForecast = 0;
        let overdueCount = 0; let overdueAmount = 0;

        // Inflow
        rawData.payments.forEach(p => {
            const dateStr = p.payment_date || p.due_date;
            if (!dateStr) return;
            const d = new Date(dateStr);
            if (d.getMonth() + 1 === month && d.getFullYear() === year) {
                inflowPlan += Number(p.payment_request_amount || 0);
                inflowActual += Number(p.external_income || 0);
            }
            const nextMonth = month === 12 ? 1 : month + 1;
            const nextYear = month === 12 ? year + 1 : year;
            if (d.getMonth() + 1 === nextMonth && d.getFullYear() === nextYear) {
                nextMonthInflowForecast += Number(p.payment_request_amount || 0);
            }
            const today = new Date();
            const due = p.due_date ? new Date(p.due_date) : null;
            if (due && today > due && Number(p.external_income || 0) < Number(p.payment_request_amount || 0)) {
                overdueCount++;
                overdueAmount += Number(p.payment_request_amount || 0) - Number(p.external_income || 0);
            }
        });

        // Outflow
        rawData.materials.forEach(m => {
             const d = new Date(m.expense_date || m.created_at);
             if (d.getMonth() + 1 === month && d.getFullYear() === year) matActual += Number(m.total_amount || 0);
             const nextMonth = month === 12 ? 1 : month + 1;
             if (d.getMonth() + 1 === nextMonth) nextMonthOutflowForecast += Number(m.total_amount || 0);
        });
        rawData.labors.forEach(m => {
             const d = new Date(m.request_date || m.created_at);
             if (d.getMonth() + 1 === month && d.getFullYear() === year) laborActual += Number(m.approved_amount || 0);
             const nextMonth = month === 12 ? 1 : month + 1;
             if (d.getMonth() + 1 === nextMonth) nextMonthOutflowForecast += Number(m.approved_amount || 0);
        });
        rawData.expenses.forEach(m => {
             const d = new Date(m.expense_date || m.created_at);
             if (d.getMonth() + 1 === month && d.getFullYear() === year) expActual += Number(m.amount || 0);
             const nextMonth = month === 12 ? 1 : month + 1;
             if (d.getMonth() + 1 === nextMonth) nextMonthOutflowForecast += Number(m.amount || 0);
        });

        const totalOutflowActual = matActual + laborActual + expActual;
        const totalOutflowPlan = totalOutflowActual; 
        nextMonthOutflowForecast = nextMonthOutflowForecast || (totalOutflowActual * 1.05);

        return {
            month, year, inflowPlan, inflowActual, matActual, laborActual, expActual,
            totalOutflowActual, totalOutflowPlan, nextMonthInflowForecast, nextMonthOutflowForecast,
            otherInco, overdueCount, overdueAmount
        };
    }, [rawData, targetDate]);

    // Percentage logic
    const safeCalc = (val, max) => max > 0 ? Math.min((val / max * 100), 100) : 0;
    const inflowPct = safeCalc(stats.inflowActual, stats.inflowPlan);
    const outflowPct = safeCalc(stats.totalOutflowActual, stats.totalOutflowPlan);
    const totalActual = stats.inflowActual + stats.totalOutflowActual;
    const totalPlan = stats.inflowPlan + stats.totalOutflowPlan;
    const performanceScore = totalPlan > 0 ? (totalActual / totalPlan * 100).toFixed(1) : '100.0';

    const netFlowActual = stats.inflowActual + stats.otherInco - stats.totalOutflowActual;
    const netFlowPlan = stats.inflowPlan - stats.totalOutflowPlan;
    
    // Chart dynamic heights
    const maxBarValue = Math.max(stats.inflowActual, stats.totalOutflowActual, stats.nextMonthInflowForecast, stats.nextMonthOutflowForecast, 1e7);
    const scaleHeight = (val) => Math.max((val / maxBarValue) * 100, 5) + '%';
    
    const DiffBadge = ({ actual, plan }) => {
        if (!plan) return <span className="text-slate-400 font-bold">—</span>;
        const diff = ((actual - plan) / plan) * 100;
        if (Math.abs(diff) < 1) return <span className="text-slate-400 flex items-center gap-1 justify-center text-[10px]"><span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span> Đúng KH</span>;
        const isPos = diff > 0;
        return (
            <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                isPos ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
            }`}>
                {isPos ? '+' : ''}{diff.toFixed(1)}%
            </span>
        );
    };

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-50">
                <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full"></div>
            </div>
        );
    }

    const prevMonth = () => { const d = new Date(targetDate); d.setMonth(d.getMonth() - 1); setTargetDate(d); };
    const nextMonth = () => { const d = new Date(targetDate); d.setMonth(d.getMonth() + 1); setTargetDate(d); };

    return (
        <div className="bg-slate-50 font-body text-slate-800 antialiased min-h-screen flex flex-col relative pb-8">
            
            {/* The beautiful floating blue gradient header restored */}
            <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 h-[210px] w-full absolute top-0 left-0 z-0 opacity-90 shadow-sm"></div>

            <div className="relative z-10 flex flex-col px-6 lg:px-8 pt-6 pb-0 max-w-[1600px] mx-auto w-full h-full gap-5 shrink-0">
                
                {/* Header Title & Month Picker */}
                <div className="flex justify-between items-end shrink-0">
                    <div className="text-white drop-shadow-sm">
                        <h2 className="text-[22px] lg:text-2xl font-extrabold font-headline tracking-tight">Báo Cáo Thu - Chi Tổng Hợp</h2>
                        <p className="font-medium text-blue-100 mt-0.5 opacity-95 text-[13px] lg:text-sm">Tóm Tắt Điều Hành Tháng {stats.month}/{stats.year}</p>
                    </div>
                    <div className="flex gap-2 bg-white/10 backdrop-blur-md p-1.5 rounded-2xl shadow border border-white/20">
                        <button onClick={prevMonth} className="px-3 lg:px-4 py-1.5 lg:py-2 hover:bg-white/20 rounded-xl text-xs lg:text-[13px] font-semibold transition-all text-white">Tháng {stats.month === 1 ? 12 : stats.month - 1}</button>
                        <button className="px-3 lg:px-4 py-1.5 lg:py-2 bg-white shadow-md rounded-xl text-xs lg:text-[13px] font-extrabold text-blue-700 transition-all scale-105">Tháng {stats.month}/{stats.year}</button>
                        <button onClick={nextMonth} className="px-3 lg:px-4 py-1.5 lg:py-2 hover:bg-white/20 rounded-xl text-xs lg:text-[13px] font-semibold transition-all text-white">Tháng {stats.month === 12 ? 1 : stats.month + 1}</button>
                    </div>
                </div>

                {/* Hero Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 shrink-0">
                    {/* Performance */}
                    <div className="bg-gradient-to-br from-indigo-500 to-blue-600 p-5 lg:p-6 rounded-3xl relative overflow-hidden group shadow-xl shadow-blue-500/20 text-white transform hover:-translate-y-1 transition-all">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full -translate-y-10 translate-x-10 blur-2xl"></div>
                        <div className="flex justify-between items-start mb-3 lg:mb-4 relative z-10">
                            <span className="text-[11px] lg:text-[12px] uppercase font-extrabold text-blue-100 tracking-wider">ĐIỂM HIỆU SUẤT</span>
                            <div className="bg-white/20 text-white px-2.5 lg:px-3 py-0.5 lg:py-1 rounded-full text-[9px] lg:text-[10px] font-bold backdrop-blur-sm border border-white/20">{Number(performanceScore) > 90 ? 'TỐI ƯU' : 'CẦN CHÚ Ý'}</div>
                        </div>
                        <div className="flex items-baseline gap-2 relative z-10 mt-1 lg:mt-2">
                            <span className="text-4xl lg:text-5xl xl:text-5xl font-black font-headline tabular-nums tracking-tighter">{performanceScore}</span>
                            <span className="text-xl lg:text-2xl font-bold text-blue-200 opacity-80">%</span>
                        </div>
                        <p className="text-xs lg:text-sm font-medium text-blue-100 mt-2 lg:mt-3 relative z-10 opacity-80">Chỉ số hoàn thành kế hoạch dòng tiền</p>
                    </div>

                    {/* Total Cash Inflow */}
                    <div className="bg-white p-5 lg:p-6 rounded-3xl relative overflow-hidden group shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transform hover:-translate-y-1 transition-all border border-slate-100">
                        <div className="flex justify-between items-start mb-4 lg:mb-5">
                            <span className="text-[11px] lg:text-[12px] uppercase font-extrabold text-slate-400 tracking-wider">TỔNG THU TIỀN</span>
                            <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white transition-colors"><span className="material-symbols-outlined text-[18px] lg:text-[20px]">trending_up</span></div>
                        </div>
                        <div className="space-y-3 lg:space-y-4">
                            <div className="flex justify-between items-end">
                                <div><p className="text-[10px] lg:text-xs font-bold text-slate-400 mb-0.5 lg:mb-1 uppercase tracking-widest">Thực tế</p><p className="text-2xl lg:text-3xl font-black font-headline tabular-nums text-emerald-600">{formatVND(stats.inflowActual)}</p></div>
                                <div className="text-right"><p className="text-[10px] lg:text-xs font-bold text-slate-400 mb-0.5 lg:mb-1 uppercase tracking-widest">Kế hoạch</p><p className="text-xs lg:text-sm font-bold tabular-nums text-slate-600">{formatVND(stats.inflowPlan)}</p></div>
                            </div>
                            <div className="w-full bg-slate-100 h-2 lg:h-2.5 rounded-full overflow-hidden">
                                <div className="bg-gradient-to-r from-emerald-400 to-emerald-500 h-full rounded-full transition-all duration-1000 shadow-[inset_0_-2px_4px_rgba(0,0,0,0.1)] relative" style={{ width: `${inflowPct}%` }}>
                                    <div className="absolute top-0 right-0 bottom-0 left-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.15)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.15)_50%,rgba(255,255,255,0.15)_75%,transparent_75%,transparent)] bg-[length:1rem_1rem]"></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Total Cash Outflow */}
                    <div className="bg-white p-5 lg:p-6 rounded-3xl relative overflow-hidden group shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transform hover:-translate-y-1 transition-all border border-slate-100">
                        <div className="flex justify-between items-start mb-4 lg:mb-5">
                            <span className="text-[11px] lg:text-[12px] uppercase font-extrabold text-slate-400 tracking-wider">TỔNG CHI TIỀN</span>
                            <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 group-hover:bg-rose-500 group-hover:text-white transition-colors"><span className="material-symbols-outlined text-[18px] lg:text-[20px]">trending_down</span></div>
                        </div>
                        <div className="space-y-3 lg:space-y-4">
                            <div className="flex justify-between items-end">
                                <div><p className="text-[10px] lg:text-xs font-bold text-slate-400 mb-0.5 lg:mb-1 uppercase tracking-widest">Thực tế</p><p className="text-2xl lg:text-3xl font-black font-headline tabular-nums text-rose-600">{formatVND(stats.totalOutflowActual)}</p></div>
                                <div className="text-right"><p className="text-[10px] lg:text-xs font-bold text-slate-400 mb-0.5 lg:mb-1 uppercase tracking-widest">Kế hoạch</p><p className="text-xs lg:text-sm font-bold tabular-nums text-slate-600">{stats.totalOutflowPlan ? formatVND(stats.totalOutflowPlan) : '—'}</p></div>
                            </div>
                            <div className="w-full bg-slate-100 h-2 lg:h-2.5 rounded-full overflow-hidden">
                                <div className="bg-gradient-to-r from-rose-400 to-rose-500 h-full rounded-full transition-all duration-1000 shadow-[inset_0_-2px_4px_rgba(0,0,0,0.1)] relative" style={{ width: `${Math.max(outflowPct, 1)}%` }}>
                                    <div className="absolute top-0 right-0 bottom-0 left-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.15)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.15)_50%,rgba(255,255,255,0.15)_75%,transparent_75%,transparent)] bg-[length:1rem_1rem]"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Content Grid: Chart + Ledger Side by side */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative z-10 w-full max-w-[1600px] mx-auto px-6 lg:px-8 shrink-0">
                    
                    {/* Left Column: Fixed height Bar Chart + fixed height Alerts. NO STRETCHING DÀI NGOẰNG */}
                    <div className="lg:col-span-1 flex flex-col gap-6">
                        {/* Bar Chart (Height naturally constrained to around 300-350px) */}
                        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col shrink-0 min-h-[350px]">
                            <div className="flex justify-between items-start mb-6">
                                <div><h3 className="font-headline font-extrabold text-slate-800 text-base lg:text-lg">Phân Tích Dòng Tiền</h3><p className="text-xs text-slate-400 mt-1 font-medium">Hiện Tại vs Dự Báo</p></div>
                                <div className="bg-slate-50 px-3 py-1.5 rounded-lg flex flex-col gap-1.5 border border-slate-100">
                                    <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-sm bg-emerald-500 shadow-sm"></div><span className="text-[10px] font-bold text-slate-500">Thu Tiền</span></div>
                                    <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-sm bg-rose-500 shadow-sm"></div><span className="text-[10px] font-bold text-slate-500">Chi Tiền</span></div>
                                </div>
                            </div>

                            <div className="flex-1 flex items-end gap-6 px-2 min-h-[150px] relative">
                                <div className="absolute bottom-1/4 left-0 w-full border-b border-dashed border-slate-100 -z-10"></div>
                                <div className="absolute bottom-2/4 left-0 w-full border-b border-dashed border-slate-100 -z-10"></div>
                                <div className="absolute bottom-3/4 left-0 w-full border-b border-dashed border-slate-100 -z-10"></div>

                                {/* Current Month */}
                                <div className="flex-1 flex flex-col items-center gap-3 w-32 group hover:scale-105 transition-transform z-10 h-full justify-end">
                                    <div className="flex items-end gap-2 h-full w-full justify-center pb-2 border-b-2 border-slate-100">
                                        <div className="relative w-9 bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t-xl transition-all shadow-md" style={{ height: scaleHeight(stats.inflowActual) }}>
                                            <div className="absolute -top-7 left-1/2 -translate-x-1/2 text-[10px] font-bold tabular-nums opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-emerald-700 text-white px-2 py-1 rounded shadow-lg">{formatBillion(stats.inflowActual)}</div>
                                        </div>
                                        <div className="relative w-9 bg-gradient-to-t from-rose-600 to-rose-400 rounded-t-xl transition-all shadow-md" style={{ height: scaleHeight(stats.totalOutflowActual) }}>
                                            <div className="absolute -top-7 left-1/2 -translate-x-1/2 text-[10px] font-bold tabular-nums opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-rose-700 text-white px-2 py-1 rounded shadow-lg">{formatBillion(stats.totalOutflowActual)}</div>
                                        </div>
                                    </div>
                                    <span className="text-[11px] font-extrabold text-slate-800 bg-slate-100 px-3 py-1.5 rounded-full">Tháng {stats.month}</span>
                                </div>
                                
                                {/* Next Month */}
                                <div className="flex-1 flex flex-col items-center gap-3 w-32 group hover:scale-105 transition-transform z-10 h-full justify-end">
                                    <div className="flex items-end gap-2 h-full w-full justify-center pb-2 border-b-2 border-slate-100">
                                        <div className="relative w-9 bg-emerald-100 rounded-t-xl border-2 border-dashed border-emerald-400 transition-all" style={{ height: scaleHeight(stats.nextMonthInflowForecast) }}>
                                            <div className="absolute -top-7 left-1/2 -translate-x-1/2 text-[10px] font-bold text-emerald-700 opacity-0 group-hover:opacity-100 bg-white px-2 py-1 rounded shadow border">{formatBillion(stats.nextMonthInflowForecast)}</div>
                                        </div>
                                        <div className="relative w-9 bg-rose-100 rounded-t-xl border-2 border-dashed border-rose-400 transition-all" style={{ height: scaleHeight(stats.nextMonthOutflowForecast) }}>
                                            <div className="absolute -top-7 left-1/2 -translate-x-1/2 text-[10px] font-bold text-rose-700 opacity-0 group-hover:opacity-100 bg-white px-2 py-1 rounded shadow border">{formatBillion(stats.nextMonthOutflowForecast)}</div>
                                        </div>
                                    </div>
                                    <span className="text-[11px] font-bold text-slate-400 px-2 py-1.5 whitespace-nowrap">Tháng {stats.month === 12 ? 1 : stats.month + 1} (DB)</span>
                                </div>
                            </div>
                        </div>

                        {/* Alerts - Takes up the bottom ~150px of the left column */}
                        <div className="bg-white p-5 lg:p-6 rounded-3xl border border-red-100 shadow-[0_8px_30px_rgb(255,0,0,0.05)] bg-gradient-to-tr from-white to-red-50/30 shrink-0">
                            <h4 className="font-headline font-extrabold text-slate-800 text-base md:text-lg mb-4 flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0"><span className="material-symbols-outlined text-[18px]">warning</span></div>
                                <span className={stats.overdueCount > 0 ? 'text-red-700' : ''}>Rủi Ro Dòng Tiền</span>
                            </h4>
                            {stats.overdueCount > 0 ? (
                                <div className="bg-red-50 p-4 rounded-2xl flex items-start gap-3 border border-red-100">
                                    <div className="p-2 bg-red-100 rounded-xl text-red-600 mt-1 shrink-0"><span className="material-symbols-outlined text-[18px]">assignment_late</span></div>
                                    <div>
                                        <p className="text-sm font-extrabold text-red-700 mb-0.5">Quá hạn: {stats.overdueCount} hồ sơ thanh toán</p>
                                        <p className="text-xs text-red-600/80 leading-tight">Tổng nợ Chủ đầu tư: <span className="font-black bg-red-200/50 px-1.5 py-0.5 rounded ml-0.5">{formatVND(stats.overdueAmount)} VNĐ</span>.</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-emerald-50 p-4 rounded-2xl flex items-start gap-3 border border-emerald-100">
                                    <div className="p-2 bg-emerald-100 rounded-xl text-emerald-600 mt-1 shrink-0"><span className="material-symbols-outlined text-[18px]">check_circle</span></div>
                                    <div><p className="text-sm font-extrabold text-emerald-700">Tình trạng tĩnh</p><p className="text-xs text-emerald-600/80 mt-0.5">Không phát hiện hồ sơ thanh toán nào quá hạn.</p></div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column: Ledger Table */}
                    <div className="lg:col-span-2 flex flex-col bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 overflow-hidden shrink-0">
                        <div className="px-6 md:px-8 py-5 flex justify-between items-center bg-slate-50/50 border-b border-slate-100 shrink-0">
                            <div><h3 className="font-headline font-extrabold text-slate-800 text-lg">Sổ Cái Dòng Tiền (Ledger)</h3><p className="text-xs text-slate-500 font-medium mt-1">Phân bổ chi tiết các hạng mục thu/chi</p></div>
                        </div>
                        <div className="p-0 m-0 w-full overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-sm shadow-sm ring-1 ring-slate-100">
                                    <tr>
                                        <th className="px-6 py-4 text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">HẠNG MỤC</th>
                                        <th className="px-4 py-4 text-[10px] uppercase font-extrabold text-slate-400 tracking-wider text-right">KẾ HOẠCH T{stats.month}</th>
                                        <th className="px-4 py-4 text-[10px] uppercase font-extrabold text-slate-400 tracking-wider text-right">THỰC.T T{stats.month}</th>
                                        <th className="px-3 py-4 text-[10px] uppercase font-extrabold text-slate-400 tracking-wider text-center">BIẾN ĐỘNG</th>
                                        <th className="px-6 py-4 text-[10px] uppercase font-extrabold text-slate-400 tracking-wider text-right whitespace-nowrap">DỰ BÁO T{stats.month === 12 ? 1 : stats.month + 1}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100/50">
                                    <tr className="bg-emerald-50/30"><td className="px-6 py-2.5 text-[10px] font-black text-emerald-600 uppercase tracking-widest" colSpan="5"><div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>DÒNG TIỀN THU</div></td></tr>
                                    <tr className="hover:bg-slate-50 transition-colors group">
                                        <td className="px-6 py-4 font-bold text-[13px] md:text-sm text-slate-700 whitespace-nowrap">Doanh thu dự án</td>
                                        <td className="px-4 py-4 text-xs md:text-sm tabular-nums text-right text-slate-500 whitespace-nowrap">{formatVND(stats.inflowPlan)}</td>
                                        <td className="px-4 py-4 text-xs md:text-sm font-black tabular-nums text-right text-slate-800 group-hover:text-emerald-700 whitespace-nowrap">{formatVND(stats.inflowActual)}</td>
                                        <td className="px-3 py-4 text-center"><DiffBadge actual={stats.inflowActual} plan={stats.inflowPlan} /></td>
                                        <td className="px-6 py-4 text-xs md:text-sm font-semibold tabular-nums text-right text-slate-400 whitespace-nowrap">{formatVND(stats.nextMonthInflowForecast)}</td>
                                    </tr>
                                    <tr className="hover:bg-slate-50 transition-colors group">
                                        <td className="px-6 py-4 font-bold text-[13px] md:text-sm text-slate-700 whitespace-nowrap">Thu nhập & Hoàn ứng khác</td>
                                        <td className="px-4 py-4 text-xs md:text-sm tabular-nums text-right text-slate-500 whitespace-nowrap">—</td>
                                        <td className="px-4 py-4 text-xs md:text-sm font-black tabular-nums text-right text-slate-800 group-hover:text-emerald-700 whitespace-nowrap">{formatVND(stats.otherInco)}</td>
                                        <td className="px-3 py-4 text-center"><span className="text-slate-300 font-bold">—</span></td>
                                        <td className="px-6 py-4 text-xs md:text-sm font-semibold tabular-nums text-right text-slate-400 whitespace-nowrap">0</td>
                                    </tr>
                                    
                                    <tr className="bg-rose-50/30"><td className="px-6 py-2.5 text-[10px] font-black text-rose-600 uppercase tracking-widest" colSpan="5"><div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>DÒNG TIỀN CHI</div></td></tr>
                                    <tr className="hover:bg-slate-50 transition-colors group">
                                        <td className="px-6 py-4 font-bold text-[13px] md:text-sm text-slate-700 whitespace-nowrap">Vật tư (Materials)</td>
                                        <td className="px-4 py-4 text-xs md:text-sm tabular-nums text-right w-32 text-slate-500">—</td>
                                        <td className="px-4 py-4 text-xs md:text-sm font-black tabular-nums text-right text-slate-800 group-hover:text-rose-700 whitespace-nowrap">{formatVND(stats.matActual)}</td>
                                        <td className="px-3 py-4 text-center"><span className="text-slate-300 font-bold">—</span></td>
                                        <td className="px-6 py-4 text-xs md:text-sm font-semibold tabular-nums text-right text-slate-400 whitespace-nowrap">—</td>
                                    </tr>
                                    <tr className="hover:bg-slate-50 transition-colors group">
                                        <td className="px-6 py-4 font-bold text-[13px] md:text-sm text-slate-700 whitespace-nowrap">Nhân công (Labor)</td>
                                        <td className="px-4 py-4 text-xs md:text-sm tabular-nums text-right w-32 text-slate-500">—</td>
                                        <td className="px-4 py-4 text-xs md:text-sm font-black tabular-nums text-right text-slate-800 group-hover:text-rose-700 whitespace-nowrap">{formatVND(stats.laborActual)}</td>
                                        <td className="px-3 py-4 text-center"><span className="text-slate-300 font-bold">—</span></td>
                                        <td className="px-6 py-4 text-xs md:text-sm font-semibold tabular-nums text-right text-slate-400 whitespace-nowrap">—</td>
                                    </tr>
                                    <tr className="hover:bg-slate-50 transition-colors group">
                                        <td className="px-6 py-4 font-bold text-[13px] md:text-sm text-slate-700 whitespace-nowrap">Chi phí khác (Overheads)</td>
                                        <td className="px-4 py-4 text-xs md:text-sm tabular-nums text-right w-32 text-slate-500">—</td>
                                        <td className="px-4 py-4 text-xs md:text-sm font-black tabular-nums text-right text-slate-800 group-hover:text-rose-700 whitespace-nowrap">{formatVND(stats.expActual)}</td>
                                        <td className="px-3 py-4 text-center"><span className="text-slate-300 font-bold">—</span></td>
                                        <td className="px-6 py-4 text-xs md:text-sm font-semibold tabular-nums text-right text-slate-400 whitespace-nowrap">—</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        {/* Table Footer - Locked to bottom of container */}
                        <div className="bg-slate-800 text-white shrink-0 mt-auto">
                            <table className="w-full text-left">
                                <tbody>
                                    <tr>
                                        <td className="px-6 md:px-8 py-5 md:py-6 font-extrabold font-headline text-sm md:text-base lg:text-lg">KHỐI LƯỢNG LƯU CHUYỂN (NET CASH)</td>
                                        <td className="px-4 py-5 font-bold text-right tabular-nums text-slate-300 whitespace-nowrap">{formatVND(netFlowPlan)}</td>
                                        <td className="px-4 py-5 font-black text-right tabular-nums text-lg md:text-xl lg:text-2xl whitespace-nowrap">
                                            <div className={`inline-block px-3 py-1 rounded-lg ${netFlowActual >= 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                                                {formatVND(netFlowActual)}
                                            </div>
                                        </td>
                                        <td className="px-3 py-5 text-center"><DiffBadge actual={netFlowActual} plan={netFlowPlan} /></td>
                                        <td className="px-6 md:px-8 py-5 font-bold text-right tabular-nums text-slate-400 whitespace-nowrap">{formatVND(stats.nextMonthInflowForecast - stats.nextMonthOutflowForecast)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

