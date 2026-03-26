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
                projects: projs || [], payments: pmt || [], materials: mats || [], labors: labs || [], expenses: exps || []
            });
        } catch (error) { 
            console.error(error); 
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

        rawData.materials.forEach(m => {
             const d = new Date(m.expense_date || m.created_at);
             if (d.getMonth() + 1 === month && d.getFullYear() === year) matActual += Number(m.total_amount || 0);
             if (d.getMonth() + 1 === (month === 12 ? 1 : month + 1)) nextMonthOutflowForecast += Number(m.total_amount || 0);
        });
        rawData.labors.forEach(m => {
             const d = new Date(m.request_date || m.created_at);
             if (d.getMonth() + 1 === month && d.getFullYear() === year) laborActual += Number(m.approved_amount || 0);
             if (d.getMonth() + 1 === (month === 12 ? 1 : month + 1)) nextMonthOutflowForecast += Number(m.approved_amount || 0);
        });
        rawData.expenses.forEach(m => {
             const d = new Date(m.expense_date || m.created_at);
             if (d.getMonth() + 1 === month && d.getFullYear() === year) expActual += Number(m.amount || 0);
             if (d.getMonth() + 1 === (month === 12 ? 1 : month + 1)) nextMonthOutflowForecast += Number(m.amount || 0);
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

    const safeCalc = (val, max) => max > 0 ? Math.min((val / max * 100), 100) : 0;
    const inflowPct = safeCalc(stats.inflowActual, stats.inflowPlan);
    const outflowPct = safeCalc(stats.totalOutflowActual, stats.totalOutflowPlan);
    const totalActual = stats.inflowActual + stats.totalOutflowActual;
    const totalPlan = stats.inflowPlan + stats.totalOutflowPlan;
    const performanceScore = totalPlan > 0 ? (totalActual / totalPlan * 100).toFixed(1) : '100.0';
    const netFlowActual = stats.inflowActual + stats.otherInco - stats.totalOutflowActual;
    const netFlowPlan = stats.inflowPlan - stats.totalOutflowPlan;
    
    const maxBarValue = Math.max(stats.inflowActual, stats.totalOutflowActual, stats.nextMonthInflowForecast, stats.nextMonthOutflowForecast, 1e7);
    const scaleHeight = (val) => Math.max((val / maxBarValue) * 100, 5) + '%';
    
    const DiffBadge = ({ actual, plan }) => {
        if (!plan) return <span className="text-slate-400 font-bold">—</span>;
        const diff = ((actual - plan) / plan) * 100;
        if (Math.abs(diff) < 1) return <span className="text-slate-400 flex items-center gap-1 justify-center text-[10px]"><span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span> Đúng KH</span>;
        const isPos = diff > 0;
        return (
            <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                isPos ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
            }`}>
                {isPos ? '+' : ''}{diff.toFixed(1)}%
            </span>
        );
    };

    if (loading) {
        return (
            <div className="flex h-[calc(100vh-100px)] items-center justify-center bg-slate-50">
                <div className="relative w-16 h-16">
                    <div className="absolute inset-0 bg-blue-500 rounded-full opacity-20 animate-ping"></div>
                    <div className="absolute inset-2 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-full animate-spin"></div>
                    <div className="absolute inset-3 bg-slate-50 rounded-full"></div>
                </div>
            </div>
        );
    }

    const prevMonth = () => { const d = new Date(targetDate); d.setMonth(d.getMonth() - 1); setTargetDate(d); };
    const nextMonth = () => { const d = new Date(targetDate); d.setMonth(d.getMonth() + 1); setTargetDate(d); };

    return (
        <div className="bg-slate-50 font-body text-slate-800 antialiased min-h-screen flex flex-col relative pb-8 overflow-hidden">
            {/* Premium Sparkling Light Header Background */}
            <div className="absolute top-0 left-0 w-full h-[280px] z-0 rounded-b-[40px] shadow-sm overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 opacity-95"></div>
                <div className="absolute top-[-20%] left-[10%] w-[500px] h-[500px] bg-white/20 rounded-full blur-[80px] mix-blend-overlay pointer-events-none"></div>
                <div className="absolute top-[-10%] right-[5%] w-[400px] h-[400px] bg-indigo-300/30 rounded-full blur-[80px] mix-blend-overlay pointer-events-none"></div>
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.05] pointer-events-none"></div>
            </div>

            <div className="relative z-10 flex flex-col px-6 lg:px-10 pt-8 pb-0 max-w-[1600px] mx-auto w-full h-full gap-6 shrink-0">
                
                {/* Header & Controls */}
                <div className="flex justify-between items-end shrink-0">
                    <div className="animate-fade-in-up drop-shadow-sm">
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 border border-white/20 rounded-full text-[10px] sm:text-xs font-bold tracking-widest text-blue-100 uppercase mb-3 backdrop-blur-md shadow-inner">
                            Điều Hành Dòng Tiền
                        </div>
                        <h2 className="text-[26px] lg:text-3xl font-black font-headline tracking-tight text-white mb-1.5 drop-shadow-sm">Báo Cáo Thu - Chi Tổng Hợp</h2>
                        <p className="font-medium text-blue-100 text-[13px] sm:text-sm flex items-center gap-2">
                            Dữ liệu thực tế và dự báo cho tháng {stats.month}/{stats.year}
                        </p>
                    </div>
                    
                    {/* Glassmorphism Month Picker */}
                    <div className="flex gap-1 bg-white/10 backdrop-blur-xl p-1.5 rounded-2xl border border-white/20 shadow-lg">
                        <button onClick={prevMonth} className="px-3 md:px-4 py-2 hover:bg-white/20 rounded-xl text-xs md:text-[13px] font-semibold text-blue-50 hover:text-white transition-all">Tháng {stats.month === 1 ? 12 : stats.month - 1}</button>
                        <button className="px-4 md:px-5 py-2 bg-white shadow-lg rounded-xl text-xs md:text-[13px] font-black text-blue-700 transition-all scale-105 border border-white/50">Tháng {stats.month}/{stats.year}</button>
                        <button onClick={nextMonth} className="px-3 md:px-4 py-2 hover:bg-white/20 rounded-xl text-xs md:text-[13px] font-semibold text-blue-50 hover:text-white transition-all">Tháng {stats.month === 12 ? 1 : stats.month + 1}</button>
                    </div>
                </div>

                {/* Hero Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 shrink-0 mt-2">
                    {/* Performance Score */}
                    <div className="bg-gradient-to-br from-indigo-500 to-blue-600 p-6 rounded-[24px] relative overflow-hidden group shadow-[0_15px_30px_rgba(37,99,235,0.2)] border border-white/10 transform hover:-translate-y-1 transition-transform duration-300">
                        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-[30px] group-hover:bg-white/20 transition-all"></div>
                        <div className="flex justify-between items-start mb-4 relative z-10">
                            <span className="text-xs uppercase font-extrabold text-blue-100 tracking-wider">Hiệu suất kế hoạch</span>
                            <div className="bg-white/20 text-white px-3 py-1.5 rounded-full text-[10px] font-bold border border-white/10 backdrop-blur-md">{Number(performanceScore) > 90 ? 'TỐI ƯU' : 'CẦN CHÚ Ý'}</div>
                        </div>
                        <div className="flex items-baseline gap-2 relative z-10">
                            <span className="text-5xl font-black font-headline tabular-nums tracking-tighter text-white drop-shadow-md">{performanceScore}</span>
                            <span className="text-2xl font-bold text-blue-200">%</span>
                        </div>
                        <div className="w-full bg-blue-900/30 h-1.5 rounded-full mt-5 overflow-hidden border border-blue-900/20">
                            <div className="bg-white h-full rounded-full shadow-[0_0_10px_rgba(255,255,255,0.8)]" style={{ width: `${Math.min(performanceScore, 100)}%` }}></div>
                        </div>
                    </div>

                    {/* Total Inflow */}
                    <div className="bg-white/90 backdrop-blur-xl p-6 rounded-[24px] relative overflow-hidden group shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-white/80 hover:shadow-[0_15px_40px_rgba(16,185,129,0.1)] transition-all duration-300 hover:-translate-y-1">
                        <div className="absolute bottom-0 right-0 w-32 h-32 bg-emerald-50 rounded-full blur-[40px] opacity-0 group-hover:opacity-100 transition-all duration-700 z-0"></div>
                        <div className="flex justify-between items-start mb-5 relative z-10">
                            <span className="text-xs uppercase font-extrabold text-slate-400 tracking-wider flex items-center gap-2">
                                <span className="material-symbols-outlined text-[16px] bg-emerald-50 text-emerald-500 p-1 rounded-lg">arrow_downward</span> Tổng Thu
                            </span>
                        </div>
                        <div className="space-y-4 relative z-10">
                            <div className="flex justify-between items-end">
                                <div><p className="text-[10px] font-bold text-slate-400 mb-1 uppercase">Thực tế</p><p className="text-3xl font-black font-headline tabular-nums text-emerald-600 drop-shadow-sm">{formatVND(stats.inflowActual)}</p></div>
                                <div className="text-right"><p className="text-[10px] font-bold text-slate-400 mb-1 uppercase">Kế hoạch</p><p className="text-sm font-bold tabular-nums text-slate-600">{formatVND(stats.inflowPlan)}</p></div>
                            </div>
                            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200">
                                <div className="bg-gradient-to-r from-emerald-400 to-emerald-500 h-full rounded-full shadow-inner relative" style={{ width: `${inflowPct}%` }}></div>
                            </div>
                        </div>
                    </div>

                    {/* Total Outflow */}
                    <div className="bg-white/90 backdrop-blur-xl p-6 rounded-[24px] relative overflow-hidden group shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-white/80 hover:shadow-[0_15px_40px_rgba(244,63,94,0.1)] transition-all duration-300 hover:-translate-y-1">
                        <div className="absolute bottom-0 right-0 w-32 h-32 bg-rose-50 rounded-full blur-[40px] opacity-0 group-hover:opacity-100 transition-all duration-700 z-0"></div>
                        <div className="flex justify-between items-start mb-5 relative z-10">
                            <span className="text-xs uppercase font-extrabold text-slate-400 tracking-wider flex items-center gap-2">
                                <span className="material-symbols-outlined text-[16px] bg-rose-50 text-rose-500 p-1 rounded-lg">arrow_upward</span> Tổng Chi
                            </span>
                        </div>
                        <div className="space-y-4 relative z-10">
                            <div className="flex justify-between items-end">
                                <div><p className="text-[10px] font-bold text-slate-400 mb-1 uppercase">Thực tế</p><p className="text-3xl font-black font-headline tabular-nums text-rose-600 drop-shadow-sm">{formatVND(stats.totalOutflowActual)}</p></div>
                                <div className="text-right"><p className="text-[10px] font-bold text-slate-400 mb-1 uppercase">Kế hoạch</p><p className="text-sm font-bold tabular-nums text-slate-600">{stats.totalOutflowPlan ? formatVND(stats.totalOutflowPlan) : '—'}</p></div>
                            </div>
                            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200">
                                <div className="bg-gradient-to-r from-rose-400 to-rose-500 h-full rounded-full shadow-inner relative" style={{ width: `${Math.max(outflowPct, 1)}%` }}></div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative z-10 w-full shrink-0">
                    
                    {/* Left Column: Charts and Alerts */}
                    <div className="lg:col-span-1 flex flex-col gap-6">
                        {/* Premium Chart */}
                        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col shrink-0 min-h-[350px]">
                            <div className="flex justify-between items-start mb-6 pb-4">
                                <div><h3 className="font-headline font-extrabold text-slate-800 text-base lg:text-lg">Phân Tích Dòng Tiền</h3><p className="text-[11px] text-slate-500 mt-1 uppercase tracking-wider">Hiện Tại vs Dự Báo</p></div>
                                <div className="flex flex-col gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-100">
                                    <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded bg-emerald-500 shadow-sm"></div><span className="text-[10px] font-bold text-slate-600">Thu Tiền</span></div>
                                    <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded bg-rose-500 shadow-sm"></div><span className="text-[10px] font-bold text-slate-600">Chi Tiền</span></div>
                                </div>
                            </div>

                            <div className="flex-1 flex items-end gap-6 px-2 min-h-[180px] relative mt-2">
                                <div className="absolute bottom-1/3 left-0 w-full border-b border-dashed border-slate-100 -z-10"></div>
                                <div className="absolute bottom-2/3 left-0 w-full border-b border-dashed border-slate-100 -z-10"></div>

                                {/* Current Month Bars */}
                                <div className="flex-1 flex flex-col items-center gap-4 w-32 group z-10 h-full justify-end">
                                    <div className="flex items-end gap-3 h-full w-full justify-center pb-0 border-b-2 border-slate-200 relative">
                                        <div className="relative w-10 bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t-lg shadow-md hover:shadow-lg transition-all cursor-pointer" style={{ height: scaleHeight(stats.inflowActual) }}>
                                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-[10px] font-bold opacity-0 group-hover:opacity-100 bg-slate-800 text-white px-2.5 py-1 rounded-lg backdrop-blur-md shadow-xl whitespace-nowrap transition-all">{formatBillion(stats.inflowActual)}</div>
                                            <div className="absolute top-0 left-0 w-full h-1 bg-white/40 rounded-t-lg"></div>
                                        </div>
                                        <div className="relative w-10 bg-gradient-to-t from-rose-600 to-rose-400 rounded-t-lg shadow-md hover:shadow-lg transition-all cursor-pointer" style={{ height: scaleHeight(stats.totalOutflowActual) }}>
                                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-[10px] font-bold opacity-0 group-hover:opacity-100 bg-slate-800 text-white px-2.5 py-1 rounded-lg backdrop-blur-md shadow-xl whitespace-nowrap transition-all">{formatBillion(stats.totalOutflowActual)}</div>
                                            <div className="absolute top-0 left-0 w-full h-1 bg-white/40 rounded-t-lg"></div>
                                        </div>
                                    </div>
                                    <span className="text-[11px] font-bold text-slate-800 bg-slate-100 px-4 py-1.5 rounded-full border border-slate-200">Tháng {stats.month}</span>
                                </div>
                                
                                {/* Next Month Forecast Bars */}
                                <div className="flex-1 flex flex-col items-center gap-4 w-32 group z-10 h-full justify-end hover:scale-[1.02] transition-transform">
                                    <div className="flex items-end gap-3 h-full w-full justify-center pb-0 border-b-2 border-slate-200">
                                        <div className="relative w-10 bg-emerald-50 rounded-t-lg border-2 border-dashed border-emerald-300 transition-all hover:bg-emerald-100 hover:border-emerald-400" style={{ height: scaleHeight(stats.nextMonthInflowForecast) }}>
                                             <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-[10px] font-bold opacity-0 group-hover:opacity-100 bg-white border border-slate-200 text-emerald-700 px-2.5 py-1 rounded-lg shadow-xl whitespace-nowrap transition-all">{formatBillion(stats.nextMonthInflowForecast)}</div>
                                        </div>
                                        <div className="relative w-10 bg-rose-50 rounded-t-lg border-2 border-dashed border-rose-300 transition-all hover:bg-rose-100 hover:border-rose-400" style={{ height: scaleHeight(stats.nextMonthOutflowForecast) }}>
                                             <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-[10px] font-bold opacity-0 group-hover:opacity-100 bg-white border border-slate-200 text-rose-700 px-2.5 py-1 rounded-lg shadow-xl whitespace-nowrap transition-all">{formatBillion(stats.nextMonthOutflowForecast)}</div>
                                        </div>
                                    </div>
                                    <span className="text-[11px] font-bold text-slate-500 px-2 py-1.5 whitespace-nowrap">Dự báo T{stats.month === 12 ? 1 : stats.month + 1}</span>
                                </div>
                            </div>
                        </div>

                        {/* Premium Alerts */}
                        <div className={`p-6 rounded-3xl border ${stats.overdueCount > 0 ? 'bg-gradient-to-tr from-white to-red-50/50 border-red-100 shadow-[0_8px_30px_rgba(255,0,0,0.05)]' : 'bg-gradient-to-tr from-white to-emerald-50/50 border-emerald-100 shadow-[0_8px_30px_rgba(16,185,129,0.05)]'} shrink-0`}>
                            <h4 className="font-headline font-extrabold text-slate-800 text-base md:text-lg mb-4 flex items-center gap-3">
                                <span className={`material-symbols-outlined text-[20px] bg-white p-2 rounded-xl shadow-sm border ${stats.overdueCount > 0 ? 'text-red-500 border-red-100' : 'text-emerald-500 border-emerald-100'}`}>{stats.overdueCount > 0 ? 'warning' : 'check_circle'}</span>
                                Rủi Ro Dòng Tiền
                            </h4>
                            {stats.overdueCount > 0 ? (
                                <div className="bg-red-50 p-4 rounded-2xl flex items-start gap-3 border border-red-100">
                                    <div className="mt-1 shrink-0"><span className="material-symbols-outlined text-[18px] text-red-600">assignment_late</span></div>
                                    <div>
                                        <p className="text-sm font-bold text-red-700 mb-1">Cảnh báo: {stats.overdueCount} hồ sơ quá hạn</p>
                                        <p className="text-xs text-red-600/80 leading-relaxed">Nợ Chủ đầu tư: <span className="font-black text-red-800 bg-red-200/50 px-2 py-0.5 rounded ml-1 border border-red-200">{formatVND(stats.overdueAmount)} đ</span></p>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-emerald-50 p-4 rounded-2xl flex items-start gap-3 border border-emerald-100">
                                    <div className="mt-1 shrink-0"><span className="material-symbols-outlined text-[18px] text-emerald-600">task_alt</span></div>
                                    <div><p className="text-sm font-bold text-emerald-700">Tình trạng tĩnh</p><p className="text-xs text-emerald-600/80 mt-1">Không phát hiện hồ sơ thanh toán báo quá hạn.</p></div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column: Premium Ledger Table */}
                    <div className="lg:col-span-2 flex flex-col bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 overflow-hidden shrink-0">
                        <div className="px-6 md:px-8 py-5 flex justify-between items-center bg-slate-50/50 border-b border-slate-100 shrink-0">
                            <div><h3 className="font-headline font-black text-slate-800 text-lg tracking-tight">Sổ Cái Dòng Tiền (Ledger)</h3><p className="text-[11px] text-slate-500 font-medium mt-1 uppercase tracking-wider">Phân bổ chi tiết các hạng mục thu/chi</p></div>
                        </div>
                        <div className="w-full overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-white sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        <th className="px-6 md:px-8 py-4 text-[10px] uppercase font-bold text-slate-400 tracking-widest border-b border-slate-100">Hạng Mục</th>
                                        <th className="px-4 py-4 text-[10px] uppercase font-bold text-slate-400 tracking-widest text-right border-b border-slate-100 whitespace-nowrap">Kế hoạch T{stats.month}</th>
                                        <th className="px-4 py-4 text-[10px] uppercase font-bold text-slate-400 tracking-widest text-right border-b border-slate-100 whitespace-nowrap">Thực Tế</th>
                                        <th className="px-4 py-4 text-[10px] uppercase font-bold text-slate-400 tracking-widest text-center border-b border-slate-100">Biến Động</th>
                                        <th className="px-6 md:px-8 py-4 text-[10px] uppercase font-bold text-slate-400 tracking-widest text-right border-b border-slate-100 whitespace-nowrap">Dự Báo T{stats.month === 12 ? 1 : stats.month + 1}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100/60">
                                    {/* Inflow Section */}
                                    <tr className="bg-emerald-50/30"><td className="px-6 md:px-8 py-3 text-[10px] font-black text-emerald-600 uppercase tracking-widest" colSpan="5"><div className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>DÒNG TIỀN THU</div></td></tr>
                                    <tr className="hover:bg-slate-50/80 transition-colors group">
                                        <td className="px-6 md:px-8 py-5 font-bold text-sm text-slate-700 whitespace-nowrap">Doanh thu dự án</td>
                                        <td className="px-4 py-5 text-sm tabular-nums text-right text-slate-500">{formatVND(stats.inflowPlan)}</td>
                                        <td className="px-4 py-5 text-sm font-black tabular-nums text-right text-slate-800 group-hover:text-emerald-600">{formatVND(stats.inflowActual)}</td>
                                        <td className="px-4 py-5 text-center"><DiffBadge actual={stats.inflowActual} plan={stats.inflowPlan} /></td>
                                        <td className="px-6 md:px-8 py-5 text-sm font-semibold tabular-nums text-right text-slate-400">{formatVND(stats.nextMonthInflowForecast)}</td>
                                    </tr>
                                    <tr className="hover:bg-slate-50/80 transition-colors group">
                                        <td className="px-6 md:px-8 py-5 font-bold text-sm text-slate-700 whitespace-nowrap">Thu nhập & Hoàn ứng khác</td>
                                        <td className="px-4 py-5 text-sm tabular-nums text-right text-slate-400">—</td>
                                        <td className="px-4 py-5 text-sm font-black tabular-nums text-right text-slate-800 group-hover:text-emerald-600">{formatVND(stats.otherInco)}</td>
                                        <td className="px-4 py-5 text-center"><span className="text-slate-300 font-bold">—</span></td>
                                        <td className="px-6 md:px-8 py-5 text-sm font-semibold tabular-nums text-right text-slate-400">0</td>
                                    </tr>
                                    
                                    {/* Outflow Section */}
                                    <tr className="bg-rose-50/30"><td className="px-6 md:px-8 py-3 text-[10px] font-black text-rose-600 uppercase tracking-widest" colSpan="5"><div className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-rose-500 rounded-full"></span>DÒNG TIỀN CHI</div></td></tr>
                                    <tr className="hover:bg-slate-50/80 transition-colors group">
                                        <td className="px-6 md:px-8 py-5 font-bold text-sm text-slate-700 whitespace-nowrap">Vật tư (Materials)</td>
                                        <td className="px-4 py-5 text-sm tabular-nums text-right text-slate-400">—</td>
                                        <td className="px-4 py-5 text-sm font-black tabular-nums text-right text-slate-800 group-hover:text-rose-600">{formatVND(stats.matActual)}</td>
                                        <td className="px-4 py-5 text-center"><span className="text-slate-300 font-bold">—</span></td>
                                        <td className="px-6 md:px-8 py-5 text-sm font-semibold tabular-nums text-right text-slate-400">—</td>
                                    </tr>
                                    <tr className="hover:bg-slate-50/80 transition-colors group">
                                        <td className="px-6 md:px-8 py-5 font-bold text-sm text-slate-700 whitespace-nowrap">Nhân công (Labor)</td>
                                        <td className="px-4 py-5 text-sm tabular-nums text-right text-slate-400">—</td>
                                        <td className="px-4 py-5 text-sm font-black tabular-nums text-right text-slate-800 group-hover:text-rose-600">{formatVND(stats.laborActual)}</td>
                                        <td className="px-4 py-5 text-center"><span className="text-slate-300 font-bold">—</span></td>
                                        <td className="px-6 md:px-8 py-5 text-sm font-semibold tabular-nums text-right text-slate-400">—</td>
                                    </tr>
                                    <tr className="hover:bg-slate-50/80 transition-colors group">
                                        <td className="px-6 md:px-8 py-5 font-bold text-sm text-slate-700 whitespace-nowrap">Chi phí Khác (Overheads)</td>
                                        <td className="px-4 py-5 text-sm tabular-nums text-right text-slate-400">—</td>
                                        <td className="px-4 py-5 text-sm font-black tabular-nums text-right text-slate-800 group-hover:text-rose-600">{formatVND(stats.expActual)}</td>
                                        <td className="px-4 py-5 text-center"><span className="text-slate-300 font-bold">—</span></td>
                                        <td className="px-6 md:px-8 py-5 text-sm font-semibold tabular-nums text-right text-slate-400">—</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        {/* Premium Footer Net Cash */}
                        <div className="bg-slate-800 shrink-0 mt-auto border-t border-slate-700 relative overflow-hidden text-white">
                            <table className="w-full text-left relative z-10">
                                <tbody>
                                    <tr>
                                        <td className="px-6 md:px-8 py-5 md:py-6 font-black font-headline text-sm md:text-base lg:text-lg uppercase max-w-[200px]">Khối Lượng Lưu Chuyển <span className="block text-[10px] text-slate-400 font-bold uppercase mt-1">(NET CASH)</span></td>
                                        <td className="px-4 py-5 md:py-6 font-bold text-right tabular-nums text-slate-400 whitespace-nowrap">{formatVND(netFlowPlan)}</td>
                                        <td className="px-4 py-5 md:py-6 text-right whitespace-nowrap">
                                            <div className={`inline-block px-3 md:px-4 py-1.5 md:py-2 flex-col rounded-xl font-black tabular-nums text-xl md:text-2xl shadow-inner border ${netFlowActual >= 0 ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border-rose-500/30'}`}>
                                                {formatVND(netFlowActual)}
                                            </div>
                                        </td>
                                        <td className="px-4 py-5 md:py-6 text-center"><DiffBadge actual={netFlowActual} plan={netFlowPlan} /></td>
                                        <td className="px-6 md:px-8 py-5 md:py-6 font-bold text-right tabular-nums text-slate-400 whitespace-nowrap">{formatVND(stats.nextMonthInflowForecast - stats.nextMonthOutflowForecast)}</td>
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
