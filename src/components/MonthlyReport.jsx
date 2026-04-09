import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { formatVND, formatBillion, fmt, fmtB } from '../utils/formatters';

export default function MonthlyReport() {
    const [targetDate, setTargetDate] = useState(new Date());
    const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'projects' | 'aging'

    // ── React Query: All report data ──
    const { data: rawData = { projects: [], payments: [], materials: [], labors: [], expenses: [] }, isLoading: loading } = useQuery({
        queryKey: ['monthlyReportData'],
        queryFn: async () => {
            const [{ data: projs }, { data: pmt }, { data: mats }, { data: labs }, { data: exps }] = await Promise.all([
                supabase.from('projects').select('*'),
                supabase.from('payments').select('*, projects(code, name, internal_code)'),
                supabase.from('expense_materials').select('*, projects(code, name, internal_code)'),
                supabase.from('expense_labor').select('*, projects(code, name, internal_code)'),
                supabase.from('expenses').select('*, projects(code, name, internal_code)')
            ]);
            return { projects: projs || [], payments: pmt || [], materials: mats || [], labors: labs || [], expenses: exps || [] };
        },
        staleTime: 5 * 60 * 1000,
    });

    const month = targetDate.getMonth() + 1;
    const year = targetDate.getFullYear();
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;

    // ── Stats computation ──
    const stats = useMemo(() => {
        let inflowPlan = 0, inflowActual = 0;
        let matActual = 0, laborActual = 0, expActual = 0;
        let matPrev = 0, laborPrev = 0, expPrev = 0;
        let nextMonthInflowForecast = 0, nextMonthOutflowForecast = 0;
        let overdueCount = 0, overdueAmount = 0;

        const isInMonth = (dateStr, m, y) => {
            if (!dateStr) return false;
            const d = new Date(dateStr);
            return d.getMonth() + 1 === m && d.getFullYear() === y;
        };

        rawData.payments.forEach(p => {
            const dateStr = p.payment_date || p.due_date;
            if (isInMonth(dateStr, month, year)) {
                inflowPlan += Number(p.payment_request_amount || 0);
                inflowActual += Number(p.external_income || 0);
            }
            const nm = month === 12 ? 1 : month + 1;
            const ny = month === 12 ? year + 1 : year;
            if (isInMonth(dateStr, nm, ny)) nextMonthInflowForecast += Number(p.payment_request_amount || 0);

            const due = p.due_date ? new Date(p.due_date) : null;
            if (due && new Date() > due && Number(p.external_income || 0) < Number(p.payment_request_amount || 0)) {
                overdueCount++;
                overdueAmount += Number(p.payment_request_amount || 0) - Number(p.external_income || 0);
            }
        });

        rawData.materials.forEach(m => {
            const d = new Date(m.expense_date || m.created_at);
            if (isInMonth(m.expense_date || m.created_at, month, year)) matActual += Number(m.total_amount || 0);
            if (isInMonth(m.expense_date || m.created_at, prevMonth, prevYear)) matPrev += Number(m.total_amount || 0);
        });
        rawData.labors.forEach(m => {
            if (isInMonth(m.request_date || m.created_at, month, year)) laborActual += Number(m.approved_amount || 0);
            if (isInMonth(m.request_date || m.created_at, prevMonth, prevYear)) laborPrev += Number(m.approved_amount || 0);
        });
        rawData.expenses.forEach(m => {
            if (isInMonth(m.expense_date || m.created_at, month, year)) expActual += Number(m.amount || 0);
            if (isInMonth(m.expense_date || m.created_at, prevMonth, prevYear)) expPrev += Number(m.amount || 0);
        });

        const totalOutflowActual = matActual + laborActual + expActual;
        // KH = tháng trước × 1.05
        const matPlan = matPrev > 0 ? matPrev * 1.05 : 0;
        const laborPlan = laborPrev > 0 ? laborPrev * 1.05 : 0;
        const expPlan = expPrev > 0 ? expPrev * 1.05 : 0;
        const totalOutflowPlan = matPlan + laborPlan + expPlan;
        nextMonthOutflowForecast = totalOutflowActual > 0 ? totalOutflowActual * 1.05 : 0;

        return {
            month, year, inflowPlan, inflowActual,
            matActual, laborActual, expActual, matPlan, laborPlan, expPlan,
            totalOutflowActual, totalOutflowPlan,
            nextMonthInflowForecast, nextMonthOutflowForecast,
            overdueCount, overdueAmount
        };
    }, [rawData, targetDate]);

    // ── Project breakdown ──
    const projectBreakdown = useMemo(() => {
        const projects = {};
        rawData.projects.forEach(p => {
            projects[p.id] = {
                code: p.internal_code || p.code,
                name: p.name,
                ratio: Number(p.sateco_actual_ratio || 95.5) / 100,
                contractValue: Number(p.original_value || 0),
                income: 0, mat: 0, lab: 0, exp: 0
            };
        });

        const isInMonth = (dateStr) => {
            if (!dateStr) return false;
            const d = new Date(dateStr);
            return d.getMonth() + 1 === month && d.getFullYear() === year;
        };

        rawData.payments.forEach(p => {
            if (p.project_id && projects[p.project_id] && isInMonth(p.payment_date || p.due_date))
                projects[p.project_id].income += Number(p.external_income || 0);
        });
        rawData.materials.forEach(m => {
            if (m.project_id && projects[m.project_id] && isInMonth(m.expense_date || m.created_at))
                projects[m.project_id].mat += Number(m.total_amount || 0);
        });
        rawData.labors.forEach(m => {
            if (m.project_id && projects[m.project_id] && isInMonth(m.request_date || m.created_at))
                projects[m.project_id].lab += Number(m.approved_amount || 0);
        });
        rawData.expenses.forEach(m => {
            if (m.project_id && projects[m.project_id] && isInMonth(m.expense_date || m.created_at))
                projects[m.project_id].exp += Number(m.amount || 0);
        });

        return Object.entries(projects)
            .map(([id, p]) => {
                const totalExpense = p.mat + p.lab + p.exp;
                const satecoIncome = p.income * p.ratio;
                const profit = satecoIncome - totalExpense;
                const margin = satecoIncome > 0 ? (profit / satecoIncome * 100) : 0;
                return { id, ...p, totalExpense, satecoIncome, profit, margin };
            })
            .filter(p => p.income > 0 || p.totalExpense > 0)
            .sort((a, b) => b.totalExpense - a.totalExpense);
    }, [rawData, targetDate]);

    // ── Aging (nợ thầu phụ + vật tư) ──
    const agingData = useMemo(() => {
        const now = new Date();
        const laborAging = { '0_7': [], '8_14': [], '15_30': [], 'over30': [] };
        const matAging = { '0_14': [], '15_30': [], '31_60': [], 'over60': [] };

        rawData.labors.forEach(l => {
            if (l.status !== 'PENDING') return;
            const reqDate = l.request_date ? new Date(l.request_date) : null;
            if (!reqDate) return;
            const days = Math.floor((now - reqDate) / 86400000);
            const item = { ...l, days, debt: Number(l.requested_amount || 0) - Number(l.paid_amount || 0) };
            if (days <= 7) laborAging['0_7'].push(item);
            else if (days <= 14) laborAging['8_14'].push(item);
            else if (days <= 30) laborAging['15_30'].push(item);
            else laborAging['over30'].push(item);
        });

        rawData.materials.forEach(m => {
            const paid = Number(m.paid_amount || 0);
            const total = Number(m.total_amount || 0);
            if (paid >= total) return;
            const expDate = m.expense_date ? new Date(m.expense_date) : null;
            if (!expDate) return;
            const days = Math.floor((now - expDate) / 86400000);
            const item = { ...m, days, debt: total - paid };
            if (days <= 14) matAging['0_14'].push(item);
            else if (days <= 30) matAging['15_30'].push(item);
            else if (days <= 60) matAging['31_60'].push(item);
            else matAging['over60'].push(item);
        });

        return { laborAging, matAging };
    }, [rawData]);

    const laborAgingTotal = Object.values(agingData.laborAging).reduce((s, arr) => s + arr.reduce((a, l) => a + l.debt, 0), 0);
    const matAgingTotal = Object.values(agingData.matAging).reduce((s, arr) => s + arr.reduce((a, m) => a + m.debt, 0), 0);

    // ── Helpers ──
    const safeCalc = (val, max) => max > 0 ? Math.min((val / max * 100), 100) : 0;
    const inflowPct = safeCalc(stats.inflowActual, stats.inflowPlan);
    const outflowPct = safeCalc(stats.totalOutflowActual, stats.totalOutflowPlan || stats.totalOutflowActual);
    const netFlowActual = stats.inflowActual - stats.totalOutflowActual;
    const netFlowPlan = stats.inflowPlan - stats.totalOutflowPlan;

    const maxBarValue = Math.max(stats.inflowActual, stats.totalOutflowActual, stats.nextMonthInflowForecast, stats.nextMonthOutflowForecast, 1e7);
    const scaleHeight = (val) => Math.max((val / maxBarValue) * 100, 5) + '%';

    const DiffBadge = ({ actual, plan }) => {
        if (!plan) return <span className="text-slate-400 font-bold">—</span>;
        const diff = ((actual - plan) / plan) * 100;
        if (Math.abs(diff) < 1) return <span className="text-slate-400 flex items-center gap-1 justify-center text-[10px]"><span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>Đúng KH</span>;
        const isPos = diff > 0;
        return (
            <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${isPos ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                {isPos ? '+' : ''}{diff.toFixed(1)}%
            </span>
        );
    };

    const changeMonth = (offset) => { const d = new Date(targetDate); d.setMonth(d.getMonth() + offset); setTargetDate(d); };

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

    return (
        <div className="bg-slate-50 font-body text-slate-800 antialiased min-h-screen flex flex-col relative pb-8 overflow-hidden">
            {/* Premium Header BG */}
            <div className="absolute top-0 left-0 w-full h-[280px] z-0 rounded-b-[40px] shadow-sm overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 opacity-95"></div>
                <div className="absolute top-[-20%] left-[10%] w-[500px] h-[500px] bg-white/20 rounded-full blur-[80px] mix-blend-overlay pointer-events-none"></div>
                <div className="absolute top-[-10%] right-[5%] w-[400px] h-[400px] bg-indigo-300/30 rounded-full blur-[80px] mix-blend-overlay pointer-events-none"></div>
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.05] pointer-events-none"></div>
            </div>

            <div className="relative z-10 flex flex-col px-6 lg:px-10 pt-8 pb-0 max-w-[1600px] mx-auto w-full h-full gap-6 shrink-0">

                {/* ═══════ HEADER ═══════ */}
                <div className="flex flex-wrap justify-between items-end shrink-0 gap-4">
                    <div className="animate-fade-in-up drop-shadow-sm">
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 border border-white/20 rounded-full text-[10px] sm:text-xs font-bold tracking-widest text-blue-100 uppercase mb-3 backdrop-blur-md shadow-inner">
                            Điều Hành Dòng Tiền
                        </div>
                        <h2 className="text-[26px] lg:text-3xl font-black font-headline tracking-tight text-white mb-1.5 drop-shadow-sm">Báo Cáo Thu - Chi Tổng Hợp</h2>
                        <p className="font-medium text-blue-100 text-[13px] sm:text-sm">
                            Dữ liệu thực tế và dự báo cho tháng {stats.month}/{stats.year}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Tab selector */}
                        <div className="flex bg-white/10 backdrop-blur-xl p-1 rounded-xl border border-white/20">
                            {[
                                { key: 'overview', label: 'Tổng quan', icon: 'dashboard' },
                                { key: 'projects', label: 'Theo DA', icon: 'apartment' },
                                { key: 'aging', label: 'Công nợ', icon: 'schedule' },
                            ].map(t => (
                                <button key={t.key} onClick={() => setActiveTab(t.key)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${activeTab === t.key ? 'bg-white text-blue-700 shadow-sm' : 'text-blue-100 hover:text-white hover:bg-white/10'}`}>
                                    <span className="material-symbols-outlined text-[14px]">{t.icon}</span>
                                    <span className="hidden sm:inline">{t.label}</span>
                                </button>
                            ))}
                        </div>
                        {/* Month picker */}
                        <div className="flex gap-1 bg-white/10 backdrop-blur-xl p-1.5 rounded-2xl border border-white/20 shadow-lg">
                            <button onClick={() => changeMonth(-1)} className="px-3 md:px-4 py-2 hover:bg-white/20 rounded-xl text-xs md:text-[13px] font-semibold text-blue-50 hover:text-white transition-all">T{prevMonth}</button>
                            <button className="px-4 md:px-5 py-2 bg-white shadow-lg rounded-xl text-xs md:text-[13px] font-black text-blue-700 transition-all scale-105 border border-white/50">Tháng {month}/{year}</button>
                            <button onClick={() => changeMonth(1)} className="px-3 md:px-4 py-2 hover:bg-white/20 rounded-xl text-xs md:text-[13px] font-semibold text-blue-50 hover:text-white transition-all">T{month === 12 ? 1 : month + 1}</button>
                        </div>
                    </div>
                </div>

                {/* ═══════ HERO CARDS ═══════ */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 shrink-0 mt-2">
                    {/* Performance Score */}
                    <div className="bg-gradient-to-br from-indigo-500 to-blue-600 p-6 rounded-[24px] relative overflow-hidden group shadow-[0_15px_30px_rgba(37,99,235,0.2)] border border-white/10 hover:-translate-y-1 transition-transform duration-300">
                        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-[30px] group-hover:bg-white/20 transition-all"></div>
                        <div className="flex justify-between items-start mb-4 relative z-10">
                            <span className="text-xs uppercase font-extrabold text-blue-100 tracking-wider">Hiệu suất kế hoạch</span>
                            {(() => {
                                const totalPlan = stats.inflowPlan + stats.totalOutflowPlan;
                                const totalActual = stats.inflowActual + stats.totalOutflowActual;
                                const score = totalPlan > 0 ? (totalActual / totalPlan * 100).toFixed(1) : '100.0';
                                return (
                                    <>
                                        <div className={`bg-white/20 text-white px-3 py-1.5 rounded-full text-[10px] font-bold border border-white/10 backdrop-blur-md`}>{Number(score) > 90 ? 'TỐI ƯU' : 'CẦN CHÚ Ý'}</div>
                                        <div className="absolute -bottom-2 left-0 right-0">
                                            <div className="flex items-baseline gap-2 relative z-10 mt-6">
                                                <span className="text-5xl font-black font-headline tabular-nums tracking-tighter text-white drop-shadow-md">{score}</span>
                                                <span className="text-2xl font-bold text-blue-200">%</span>
                                            </div>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                        <div className="mt-12"></div>
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
                                <div className="bg-gradient-to-r from-emerald-400 to-emerald-500 h-full rounded-full" style={{ width: `${inflowPct}%` }}></div>
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
                                <div className="text-right"><p className="text-[10px] font-bold text-slate-400 mb-1 uppercase">KH (T{prevMonth}×1.05)</p><p className="text-sm font-bold tabular-nums text-slate-600">{stats.totalOutflowPlan ? formatVND(stats.totalOutflowPlan) : '—'}</p></div>
                            </div>
                            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200">
                                <div className="bg-gradient-to-r from-rose-400 to-rose-500 h-full rounded-full" style={{ width: `${Math.max(outflowPct, 1)}%` }}></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ═══════ TAB CONTENT ═══════ */}

                {/* TAB: Overview */}
                {activeTab === 'overview' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative z-10 w-full shrink-0">
                        {/* Chart */}
                        <div className="lg:col-span-1 flex flex-col gap-6">
                            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col shrink-0 min-h-[350px]">
                                <div className="flex justify-between items-start mb-6 pb-4">
                                    <div><h3 className="font-headline font-extrabold text-slate-800 text-base lg:text-lg">Phân Tích Dòng Tiền</h3><p className="text-[11px] text-slate-500 mt-1 uppercase tracking-wider">Hiện Tại vs Dự Báo</p></div>
                                    <div className="flex flex-col gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-100">
                                        <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded bg-emerald-500 shadow-sm"></div><span className="text-[10px] font-bold text-slate-600">Thu</span></div>
                                        <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded bg-rose-500 shadow-sm"></div><span className="text-[10px] font-bold text-slate-600">Chi</span></div>
                                    </div>
                                </div>
                                <div className="flex-1 flex items-end gap-6 px-2 min-h-[180px] relative mt-2">
                                    <div className="absolute bottom-1/3 left-0 w-full border-b border-dashed border-slate-100 -z-10"></div>
                                    <div className="flex-1 flex flex-col items-center gap-4 group z-10 h-full justify-end">
                                        <div className="flex items-end gap-3 h-full w-full justify-center pb-0 border-b-2 border-slate-200">
                                            <div className="relative w-10 bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t-lg shadow-md hover:shadow-lg transition-all cursor-pointer" style={{ height: scaleHeight(stats.inflowActual) }}>
                                                <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-[10px] font-bold opacity-0 group-hover:opacity-100 bg-slate-800 text-white px-2.5 py-1 rounded-lg shadow-xl whitespace-nowrap transition-all">{formatBillion(stats.inflowActual)}</div>
                                            </div>
                                            <div className="relative w-10 bg-gradient-to-t from-rose-600 to-rose-400 rounded-t-lg shadow-md hover:shadow-lg transition-all cursor-pointer" style={{ height: scaleHeight(stats.totalOutflowActual) }}>
                                                <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-[10px] font-bold opacity-0 group-hover:opacity-100 bg-slate-800 text-white px-2.5 py-1 rounded-lg shadow-xl whitespace-nowrap transition-all">{formatBillion(stats.totalOutflowActual)}</div>
                                            </div>
                                        </div>
                                        <span className="text-[11px] font-bold text-slate-800 bg-slate-100 px-4 py-1.5 rounded-full border border-slate-200">Tháng {month}</span>
                                    </div>
                                    <div className="flex-1 flex flex-col items-center gap-4 group z-10 h-full justify-end hover:scale-[1.02] transition-transform">
                                        <div className="flex items-end gap-3 h-full w-full justify-center pb-0 border-b-2 border-slate-200">
                                            <div className="relative w-10 bg-emerald-50 rounded-t-lg border-2 border-dashed border-emerald-300" style={{ height: scaleHeight(stats.nextMonthInflowForecast) }}>
                                                <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-[10px] font-bold opacity-0 group-hover:opacity-100 bg-white border border-slate-200 text-emerald-700 px-2.5 py-1 rounded-lg shadow-xl whitespace-nowrap transition-all">{formatBillion(stats.nextMonthInflowForecast)}</div>
                                            </div>
                                            <div className="relative w-10 bg-rose-50 rounded-t-lg border-2 border-dashed border-rose-300" style={{ height: scaleHeight(stats.nextMonthOutflowForecast) }}>
                                                <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-[10px] font-bold opacity-0 group-hover:opacity-100 bg-white border border-slate-200 text-rose-700 px-2.5 py-1 rounded-lg shadow-xl whitespace-nowrap transition-all">{formatBillion(stats.nextMonthOutflowForecast)}</div>
                                            </div>
                                        </div>
                                        <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap">Dự báo T{month === 12 ? 1 : month + 1}</span>
                                    </div>
                                </div>
                            </div>
                            {/* Alerts */}
                            <div className={`p-6 rounded-3xl border ${stats.overdueCount > 0 ? 'bg-gradient-to-tr from-white to-red-50/50 border-red-100' : 'bg-gradient-to-tr from-white to-emerald-50/50 border-emerald-100'} shrink-0`}>
                                <h4 className="font-headline font-extrabold text-slate-800 text-base mb-4 flex items-center gap-3">
                                    <span className={`material-symbols-outlined text-[20px] bg-white p-2 rounded-xl shadow-sm border ${stats.overdueCount > 0 ? 'text-red-500 border-red-100' : 'text-emerald-500 border-emerald-100'}`}>{stats.overdueCount > 0 ? 'warning' : 'check_circle'}</span>
                                    Rủi Ro Dòng Tiền
                                </h4>
                                {stats.overdueCount > 0 ? (
                                    <div className="bg-red-50 p-4 rounded-2xl flex items-start gap-3 border border-red-100">
                                        <span className="material-symbols-outlined text-[18px] text-red-600 mt-1 shrink-0">assignment_late</span>
                                        <div>
                                            <p className="text-sm font-bold text-red-700 mb-1">Cảnh báo: {stats.overdueCount} hồ sơ quá hạn</p>
                                            <p className="text-xs text-red-600/80">Nợ CĐT: <span className="font-black text-red-800 bg-red-200/50 px-2 py-0.5 rounded ml-1 border border-red-200">{formatVND(stats.overdueAmount)} đ</span></p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-emerald-50 p-4 rounded-2xl flex items-start gap-3 border border-emerald-100">
                                        <span className="material-symbols-outlined text-[18px] text-emerald-600 mt-1 shrink-0">task_alt</span>
                                        <div><p className="text-sm font-bold text-emerald-700">Tình trạng ổn định</p><p className="text-xs text-emerald-600/80 mt-1">Không phát hiện hồ sơ thanh toán quá hạn.</p></div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Ledger Table */}
                        <div className="lg:col-span-2 flex flex-col bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 overflow-hidden shrink-0">
                            <div className="px-6 md:px-8 py-5 flex justify-between items-center bg-slate-50/50 border-b border-slate-100">
                                <div><h3 className="font-headline font-black text-slate-800 text-lg tracking-tight">Sổ Cái Dòng Tiền</h3><p className="text-[11px] text-slate-500 font-medium mt-1 uppercase tracking-wider">KH = Tháng trước × 1.05</p></div>
                            </div>
                            <div className="w-full overflow-x-auto flex-1">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-white sticky top-0 z-10 shadow-sm">
                                        <tr>
                                            <th className="px-6 md:px-8 py-4 text-[10px] uppercase font-bold text-slate-400 tracking-widest border-b border-slate-100">Hạng Mục</th>
                                            <th className="px-4 py-4 text-[10px] uppercase font-bold text-slate-400 tracking-widest text-right border-b border-slate-100 whitespace-nowrap">KH T{month}</th>
                                            <th className="px-4 py-4 text-[10px] uppercase font-bold text-slate-400 tracking-widest text-right border-b border-slate-100">Thực Tế</th>
                                            <th className="px-4 py-4 text-[10px] uppercase font-bold text-slate-400 tracking-widest text-center border-b border-slate-100">Biến Động</th>
                                            <th className="px-6 md:px-8 py-4 text-[10px] uppercase font-bold text-slate-400 tracking-widest text-right border-b border-slate-100 whitespace-nowrap">Dự Báo T{month === 12 ? 1 : month + 1}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100/60">
                                        <tr className="bg-emerald-50/30"><td className="px-6 md:px-8 py-3 text-[10px] font-black text-emerald-600 uppercase tracking-widest" colSpan="5"><div className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>DÒNG TIỀN THU</div></td></tr>
                                        <tr className="hover:bg-slate-50/80 transition-colors group">
                                            <td className="px-6 md:px-8 py-5 font-bold text-sm text-slate-700">Doanh thu dự án</td>
                                            <td className="px-4 py-5 text-sm tabular-nums text-right text-slate-500">{formatVND(stats.inflowPlan)}</td>
                                            <td className="px-4 py-5 text-sm font-black tabular-nums text-right text-slate-800 group-hover:text-emerald-600">{formatVND(stats.inflowActual)}</td>
                                            <td className="px-4 py-5 text-center"><DiffBadge actual={stats.inflowActual} plan={stats.inflowPlan} /></td>
                                            <td className="px-6 md:px-8 py-5 text-sm font-semibold tabular-nums text-right text-slate-400">{formatVND(stats.nextMonthInflowForecast)}</td>
                                        </tr>

                                        <tr className="bg-rose-50/30"><td className="px-6 md:px-8 py-3 text-[10px] font-black text-rose-600 uppercase tracking-widest" colSpan="5"><div className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-rose-500 rounded-full"></span>DÒNG TIỀN CHI</div></td></tr>
                                        {[
                                            { label: 'Vật tư (Materials)', actual: stats.matActual, plan: stats.matPlan },
                                            { label: 'Nhân công (Labor)', actual: stats.laborActual, plan: stats.laborPlan },
                                            { label: 'Chi phí khác (Overheads)', actual: stats.expActual, plan: stats.expPlan },
                                        ].map(row => (
                                            <tr key={row.label} className="hover:bg-slate-50/80 transition-colors group">
                                                <td className="px-6 md:px-8 py-5 font-bold text-sm text-slate-700">{row.label}</td>
                                                <td className="px-4 py-5 text-sm tabular-nums text-right text-slate-500">{row.plan > 0 ? formatVND(row.plan) : '—'}</td>
                                                <td className="px-4 py-5 text-sm font-black tabular-nums text-right text-slate-800 group-hover:text-rose-600">{formatVND(row.actual)}</td>
                                                <td className="px-4 py-5 text-center"><DiffBadge actual={row.actual} plan={row.plan} /></td>
                                                <td className="px-6 md:px-8 py-5 text-sm font-semibold tabular-nums text-right text-slate-400">{row.actual > 0 ? formatVND(row.actual * 1.05) : '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {/* Net Cash Footer */}
                            <div className="bg-slate-800 shrink-0 mt-auto border-t border-slate-700 relative overflow-hidden text-white">
                                <table className="w-full text-left relative z-10">
                                    <tbody>
                                        <tr>
                                            <td className="px-6 md:px-8 py-5 font-black font-headline text-sm md:text-base uppercase max-w-[200px]">NET CASH<span className="block text-[10px] text-slate-400 font-bold mt-1">(Thu - Chi)</span></td>
                                            <td className="px-4 py-5 font-bold text-right tabular-nums text-slate-400 whitespace-nowrap">{formatVND(netFlowPlan)}</td>
                                            <td className="px-4 py-5 text-right whitespace-nowrap">
                                                <div className={`inline-block px-3 py-1.5 rounded-xl font-black tabular-nums text-xl shadow-inner border ${netFlowActual >= 0 ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border-rose-500/30'}`}>{formatVND(netFlowActual)}</div>
                                            </td>
                                            <td className="px-4 py-5 text-center"><DiffBadge actual={netFlowActual} plan={netFlowPlan} /></td>
                                            <td className="px-6 md:px-8 py-5 font-bold text-right tabular-nums text-slate-400 whitespace-nowrap">{formatVND(stats.nextMonthInflowForecast - stats.nextMonthOutflowForecast)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* ═══════ TAB: Projects Breakdown ═══════ */}
                {activeTab === 'projects' && (
                    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50">
                            <h3 className="font-headline font-black text-slate-800 text-lg">Chi Tiết Theo Dự Án — Tháng {month}/{year}</h3>
                            <p className="text-[11px] text-slate-500 mt-1 uppercase tracking-wider">Margin = (Thu Sateco - Tổng chi) / Thu Sateco × 100 | Thu Sateco = CĐT × sateco_actual_ratio</p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs text-left whitespace-nowrap">
                                <thead className="bg-slate-50 text-slate-500 font-bold text-[10px] uppercase tracking-wider">
                                    <tr>
                                        <th className="px-4 py-3 border-r border-slate-100">Mã DA</th>
                                        <th className="px-4 py-3 border-r border-slate-100 min-w-[180px]">Tên Dự án</th>
                                        <th className="px-4 py-3 border-r border-slate-100 text-right text-emerald-600">Thu CĐT</th>
                                        <th className="px-4 py-3 border-r border-slate-100 text-right text-indigo-600">Thu Sateco</th>
                                        <th className="px-4 py-3 border-r border-slate-100 text-right text-amber-600">Vật tư</th>
                                        <th className="px-4 py-3 border-r border-slate-100 text-right text-blue-600">Nhân công</th>
                                        <th className="px-4 py-3 border-r border-slate-100 text-right text-slate-600">CP Khác</th>
                                        <th className="px-4 py-3 border-r border-slate-100 text-right font-black">Tổng Chi</th>
                                        <th className="px-4 py-3 border-r border-slate-100 text-right">LN Ước tính</th>
                                        <th className="px-4 py-3 text-center">Margin</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {projectBreakdown.length === 0 ? (
                                        <tr><td colSpan={10} className="py-16 text-center text-slate-400">Không có dữ liệu thu/chi trong tháng {month}/{year}</td></tr>
                                    ) : projectBreakdown.map(p => (
                                        <tr key={p.id} className="hover:bg-slate-50/50 group transition-colors">
                                            <td className="px-4 py-3 font-black text-indigo-700">{p.code}</td>
                                            <td className="px-4 py-3 font-medium text-slate-700 truncate max-w-[200px]" title={p.name}>{p.name}</td>
                                            <td className="px-4 py-3 text-right font-bold text-emerald-700 tabular-nums bg-emerald-50/20">{fmt(p.income)}</td>
                                            <td className="px-4 py-3 text-right font-bold text-indigo-700 tabular-nums">
                                                <div>{fmt(p.satecoIncome)}</div>
                                                <div className="text-[9px] text-slate-400">×{(p.ratio * 100).toFixed(1)}%</div>
                                            </td>
                                            <td className="px-4 py-3 text-right tabular-nums text-amber-700">{p.mat > 0 ? fmt(p.mat) : '—'}</td>
                                            <td className="px-4 py-3 text-right tabular-nums text-blue-700">{p.lab > 0 ? fmt(p.lab) : '—'}</td>
                                            <td className="px-4 py-3 text-right tabular-nums text-slate-600">{p.exp > 0 ? fmt(p.exp) : '—'}</td>
                                            <td className="px-4 py-3 text-right font-black tabular-nums text-rose-700 bg-rose-50/20">{fmt(p.totalExpense)}</td>
                                            <td className={`px-4 py-3 text-right font-black tabular-nums ${p.profit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{fmt(p.profit)}</td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${
                                                    p.margin >= 20 ? 'bg-emerald-100 text-emerald-700' :
                                                    p.margin >= 10 ? 'bg-blue-100 text-blue-700' :
                                                    p.margin >= 0 ? 'bg-amber-100 text-amber-700' :
                                                    'bg-rose-100 text-rose-700'
                                                }`}>{p.margin.toFixed(1)}%</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                {projectBreakdown.length > 0 && (
                                    <tfoot className="bg-slate-800 text-white font-black text-xs">
                                        <tr>
                                            <td colSpan={2} className="px-4 py-3 uppercase tracking-wider">Tổng cộng</td>
                                            <td className="px-4 py-3 text-right tabular-nums">{fmt(projectBreakdown.reduce((s, p) => s + p.income, 0))}</td>
                                            <td className="px-4 py-3 text-right tabular-nums">{fmt(projectBreakdown.reduce((s, p) => s + p.satecoIncome, 0))}</td>
                                            <td className="px-4 py-3 text-right tabular-nums">{fmt(projectBreakdown.reduce((s, p) => s + p.mat, 0))}</td>
                                            <td className="px-4 py-3 text-right tabular-nums">{fmt(projectBreakdown.reduce((s, p) => s + p.lab, 0))}</td>
                                            <td className="px-4 py-3 text-right tabular-nums">{fmt(projectBreakdown.reduce((s, p) => s + p.exp, 0))}</td>
                                            <td className="px-4 py-3 text-right tabular-nums">{fmt(projectBreakdown.reduce((s, p) => s + p.totalExpense, 0))}</td>
                                            <td className="px-4 py-3 text-right tabular-nums">{fmt(projectBreakdown.reduce((s, p) => s + p.profit, 0))}</td>
                                            <td className="px-4 py-3 text-center">
                                                {(() => {
                                                    const totalInc = projectBreakdown.reduce((s, p) => s + p.satecoIncome, 0);
                                                    const totalProfit = projectBreakdown.reduce((s, p) => s + p.profit, 0);
                                                    const avgMargin = totalInc > 0 ? (totalProfit / totalInc * 100) : 0;
                                                    return <span className={`px-2 py-0.5 rounded-full text-[10px] ${avgMargin >= 15 ? 'bg-emerald-500/30' : 'bg-rose-500/30'}`}>{avgMargin.toFixed(1)}%</span>;
                                                })()}
                                            </td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    </div>
                )}

                {/* ═══════ TAB: Aging Alerts ═══════ */}
                {activeTab === 'aging' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Labor Aging */}
                        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                            <div className="px-6 py-5 border-b border-slate-100 bg-purple-50/30 flex justify-between items-center">
                                <div>
                                    <h3 className="font-headline font-black text-slate-800 text-lg flex items-center gap-2">
                                        <span className="material-symbols-outlined text-purple-500 text-[20px]">engineering</span>
                                        Nợ Thầu Phụ / Tổ Đội (PENDING)
                                    </h3>
                                    <p className="text-[11px] text-slate-500 mt-1">Tổng: <strong className="text-rose-700">{fmtB(laborAgingTotal)}</strong></p>
                                </div>
                            </div>
                            <div className="divide-y divide-slate-100">
                                {[
                                    { key: '0_7', label: '0-7 ngày', color: 'emerald', icon: 'schedule' },
                                    { key: '8_14', label: '8-14 ngày', color: 'amber', icon: 'schedule' },
                                    { key: '15_30', label: '15-30 ngày', color: 'orange', icon: 'warning' },
                                    { key: 'over30', label: '> 30 ngày', color: 'rose', icon: 'error' },
                                ].map(bucket => {
                                    const items = agingData.laborAging[bucket.key];
                                    const total = items.reduce((s, l) => s + l.debt, 0);
                                    return (
                                        <div key={bucket.key} className="px-6 py-4">
                                            <div className="flex justify-between items-center mb-2">
                                                <span className={`inline-flex items-center gap-1.5 text-xs font-black text-${bucket.color}-700`}>
                                                    <span className={`material-symbols-outlined text-[16px] text-${bucket.color}-500`}>{bucket.icon}</span>
                                                    {bucket.label}
                                                    <span className={`px-1.5 py-0.5 rounded-full bg-${bucket.color}-100 text-[9px]`}>{items.length}</span>
                                                </span>
                                                <span className={`font-black text-sm tabular-nums text-${bucket.color}-700`}>{total > 0 ? fmtB(total) : '—'}</span>
                                            </div>
                                            {items.length > 0 && (
                                                <div className="space-y-1 mt-2">
                                                    {items.slice(0, 5).map(l => (
                                                        <div key={l.id} className="flex justify-between items-center text-[11px] text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg">
                                                            <span className="font-medium truncate max-w-[180px]">{l.team_name}</span>
                                                            <span className="font-bold text-rose-600 tabular-nums">{fmt(l.debt)}</span>
                                                        </div>
                                                    ))}
                                                    {items.length > 5 && <p className="text-[10px] text-slate-400 text-center">+{items.length - 5} dòng khác</p>}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Material Aging */}
                        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                            <div className="px-6 py-5 border-b border-slate-100 bg-amber-50/30 flex justify-between items-center">
                                <div>
                                    <h3 className="font-headline font-black text-slate-800 text-lg flex items-center gap-2">
                                        <span className="material-symbols-outlined text-amber-500 text-[20px]">inventory_2</span>
                                        Nợ NCC Vật Tư (Chưa thanh toán đủ)
                                    </h3>
                                    <p className="text-[11px] text-slate-500 mt-1">Tổng: <strong className="text-rose-700">{fmtB(matAgingTotal)}</strong></p>
                                </div>
                            </div>
                            <div className="divide-y divide-slate-100">
                                {[
                                    { key: '0_14', label: '0-14 ngày', color: 'emerald', icon: 'schedule' },
                                    { key: '15_30', label: '15-30 ngày', color: 'amber', icon: 'schedule' },
                                    { key: '31_60', label: '31-60 ngày', color: 'orange', icon: 'warning' },
                                    { key: 'over60', label: '> 60 ngày', color: 'rose', icon: 'error' },
                                ].map(bucket => {
                                    const items = agingData.matAging[bucket.key];
                                    const total = items.reduce((s, m) => s + m.debt, 0);
                                    return (
                                        <div key={bucket.key} className="px-6 py-4">
                                            <div className="flex justify-between items-center mb-2">
                                                <span className={`inline-flex items-center gap-1.5 text-xs font-black text-${bucket.color}-700`}>
                                                    <span className={`material-symbols-outlined text-[16px] text-${bucket.color}-500`}>{bucket.icon}</span>
                                                    {bucket.label}
                                                    <span className={`px-1.5 py-0.5 rounded-full bg-${bucket.color}-100 text-[9px]`}>{items.length}</span>
                                                </span>
                                                <span className={`font-black text-sm tabular-nums text-${bucket.color}-700`}>{total > 0 ? fmtB(total) : '—'}</span>
                                            </div>
                                            {items.length > 0 && (
                                                <div className="space-y-1 mt-2">
                                                    {items.slice(0, 5).map(m => (
                                                        <div key={m.id} className="flex justify-between items-center text-[11px] text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg">
                                                            <span className="font-medium truncate max-w-[180px]">{m.supplier_name || m.product_name}</span>
                                                            <span className="font-bold text-rose-600 tabular-nums">{fmt(m.debt)}</span>
                                                        </div>
                                                    ))}
                                                    {items.length > 5 && <p className="text-[10px] text-slate-400 text-center">+{items.length - 5} dòng khác</p>}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
