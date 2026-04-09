import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { fmt, fmtB, fmtDate } from '../utils/formatters';

export default function WeeklyExpensePlan() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [groupByProject, setGroupByProject] = useState(true);
    const [compareMode, setCompareMode] = useState('prev_week'); // 'prev_week' | 'custom'
    const [customCompareFrom, setCustomCompareFrom] = useState('');
    const [customCompareTo, setCustomCompareTo] = useState('');

    // Helper: ISO Week
    const getWeekNumber = (d) => {
        const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
        const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
        const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
        return { week: weekNo, year: date.getUTCFullYear() };
    };

    const { week: activeWeek, year: activeYear } = getWeekNumber(currentDate);

    // Date boundaries for active week
    const getWeekBounds = (d) => {
        const { week, year } = typeof d === 'object' && d.week ? d : getWeekNumber(d);
        const simple = new Date(year, 0, 1 + (week - 1) * 7);
        const dow = simple.getDay();
        const ISOweekStart = new Date(simple);
        if (dow <= 4) ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
        else ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
        const startDate = new Date(ISOweekStart);
        const endDate = new Date(ISOweekStart);
        endDate.setDate(startDate.getDate() + 6);
        const pad = (n) => String(n).padStart(2, '0');
        return {
            startStr: `${startDate.getFullYear()}-${pad(startDate.getMonth() + 1)}-${pad(startDate.getDate())}`,
            endStr: `${endDate.getFullYear()}-${pad(endDate.getMonth() + 1)}-${pad(endDate.getDate())}`
        };
    };

    const { startStr, endStr } = useMemo(() => getWeekBounds(currentDate), [activeWeek, activeYear]);

    // Compare week bounds
    const compareBounds = useMemo(() => {
        if (compareMode === 'custom' && customCompareFrom && customCompareTo) {
            return { startStr: customCompareFrom, endStr: customCompareTo };
        }
        // Default: previous week
        const prevDate = new Date(currentDate);
        prevDate.setDate(prevDate.getDate() - 7);
        return getWeekBounds(prevDate);
    }, [compareMode, customCompareFrom, customCompareTo, currentDate]);

    // Fetch current week + compare period data
    const { data: { currentPlans, comparePlans } = { currentPlans: [], comparePlans: [] }, isLoading } = useQuery({
        queryKey: ['weekly_plans_v2', startStr, endStr, compareBounds.startStr, compareBounds.endStr],
        queryFn: async () => {
            const fetchRange = async (from, to) => {
                const list = [];
                const [resExp, resLab, resMat] = await Promise.all([
                    supabase.from('expenses').select('*, projects(id, code, internal_code, name)').gte('expense_date', from).lte('expense_date', to),
                    supabase.from('expense_labor').select('*, projects(id, code, internal_code, name)').gte('request_date', from).lte('request_date', to),
                    supabase.from('expense_materials').select('*, projects(id, code, internal_code, name)').gte('expense_date', from).lte('expense_date', to),
                ]);
                if (resExp.data) resExp.data.forEach(x => list.push({
                    id: `exp-${x.id}`, category: 'Chi phí chung', request_date: x.expense_date,
                    vendor_name: x.recipient_name || 'Phòng ban nội bộ',
                    project_code: x.projects?.internal_code || x.projects?.code || 'Khác',
                    project_name: x.projects?.name || '', project_id: x.project_id,
                    description: x.expense_type + (x.description ? ` (${x.description})` : ''),
                    priority: 'Bình thường',
                    requested_amount: Number(x.amount) || 0, actual_amount: Number(x.paid_amount) || 0,
                    actual_payment_date: x.paid_date, notes: x.description
                }));
                if (resLab.data) resLab.data.forEach(x => list.push({
                    id: `lab-${x.id}`, category: 'Nhân công', request_date: x.request_date,
                    vendor_name: x.team_name,
                    project_code: x.projects?.internal_code || x.projects?.code || 'Khác',
                    project_name: x.projects?.name || '', project_id: x.project_id,
                    description: x.payment_stage + (x.notes ? ` - ${x.notes}` : ''),
                    priority: x.priority || 'Bình thường',
                    requested_amount: Number(x.requested_amount) || 0, actual_amount: Number(x.paid_amount) || 0,
                    actual_payment_date: x.payment_date, notes: x.notes
                }));
                if (resMat.data) resMat.data.forEach(x => list.push({
                    id: `mat-${x.id}`, category: 'Vật tư', request_date: x.expense_date,
                    vendor_name: x.supplier_name,
                    project_code: x.projects?.internal_code || x.projects?.code || 'Khác',
                    project_name: x.projects?.name || '', project_id: x.project_id,
                    description: `${x.item_group || ''} - ${x.product_name || ''}`.trim(),
                    priority: 'Bình thường',
                    requested_amount: Number(x.total_amount) || 0, actual_amount: Number(x.paid_amount) || 0,
                    actual_payment_date: null, notes: x.notes
                }));
                return list.sort((a, b) => new Date(b.request_date) - new Date(a.request_date));
            };
            const [cur, cmp] = await Promise.all([fetchRange(startStr, endStr), fetchRange(compareBounds.startStr, compareBounds.endStr)]);
            return { currentPlans: cur, comparePlans: cmp };
        }
    });

    const changeWeek = (offset) => { const d = new Date(currentDate); d.setDate(d.getDate() + offset * 7); setCurrentDate(d); };

    // ── Aggregations ──
    const totalRequested = currentPlans.reduce((a, c) => a + (Number(c.requested_amount) || 0), 0);
    const totalActual = currentPlans.reduce((a, c) => a + (Number(c.actual_amount) || 0), 0);
    const completionPct = totalRequested > 0 ? (totalActual / totalRequested * 100) : 0;

    // Category stats (current + compare)
    const categoryStats = useMemo(() => {
        const cats = { 'Vật tư': { r: 0, a: 0, cr: 0 }, 'Nhân công': { r: 0, a: 0, cr: 0 }, 'Chi phí chung': { r: 0, a: 0, cr: 0 } };
        currentPlans.forEach(r => { const cat = cats[r.category] || (cats[r.category] = { r: 0, a: 0, cr: 0 }); cat.r += Number(r.requested_amount) || 0; cat.a += Number(r.actual_amount) || 0; });
        comparePlans.forEach(r => { const cat = cats[r.category] || (cats[r.category] = { r: 0, a: 0, cr: 0 }); cat.cr += Number(r.requested_amount) || 0; });
        return cats;
    }, [currentPlans, comparePlans]);

    const compareTotal = comparePlans.reduce((a, c) => a + (Number(c.requested_amount) || 0), 0);

    // Group by project
    const projectGroups = useMemo(() => {
        const groups = {};
        currentPlans.forEach(r => {
            const code = r.project_code || 'Khác';
            if (!groups[code]) groups[code] = { name: r.project_name, items: [], mat: 0, lab: 0, exp: 0, total: 0, actual: 0 };
            groups[code].items.push(r);
            groups[code].total += Number(r.requested_amount) || 0;
            groups[code].actual += Number(r.actual_amount) || 0;
            if (r.category === 'Vật tư') groups[code].mat += Number(r.requested_amount) || 0;
            else if (r.category === 'Nhân công') groups[code].lab += Number(r.requested_amount) || 0;
            else groups[code].exp += Number(r.requested_amount) || 0;
        });
        return Object.entries(groups).sort((a, b) => b[1].total - a[1].total);
    }, [currentPlans]);

    // Trend badge
    const TrendBadge = ({ current, compare, label }) => {
        if (!compare) return <span className="text-slate-300 text-[10px]">—</span>;
        const diff = ((current - compare) / compare) * 100;
        if (Math.abs(diff) < 1) return <span className="text-slate-400 text-[10px] font-bold">≈ {label}</span>;
        const isUp = diff > 0;
        return (
            <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${isUp ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                <span className="material-symbols-outlined text-[12px]">{isUp ? 'trending_up' : 'trending_down'}</span>
                {isUp ? '+' : ''}{diff.toFixed(1)}%
            </span>
        );
    };

    const compareLabel = compareMode === 'custom' ? 'Kỳ so sánh' : `Tuần ${activeWeek - 1}`;

    if (isLoading) {
        return (
            <div className="flex h-[calc(100vh-100px)] items-center justify-center bg-slate-50">
                <div className="relative w-16 h-16">
                    <div className="absolute inset-0 bg-indigo-500 rounded-full opacity-20 animate-ping"></div>
                    <div className="absolute inset-2 bg-gradient-to-tr from-indigo-600 to-purple-500 rounded-full animate-spin"></div>
                    <div className="absolute inset-3 bg-slate-50 rounded-full"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-slate-50 min-h-[calc(100vh-100px)] animate-fade-in flex flex-col items-center pb-20">
            <div className="w-full max-w-[1600px] flex flex-col gap-5 pt-6 px-4">

                {/* ═══════ HEADER ═══════ */}
                <div className="flex flex-col md:flex-row justify-between items-center bg-white p-5 rounded-[20px] shadow-sm border border-slate-200 gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center border border-indigo-200">
                            <span className="material-symbols-outlined text-2xl">monitoring</span>
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-800 tracking-tight uppercase">SATECO - Kế hoạch Chi Tuần</h2>
                            <p className="text-sm font-semibold text-slate-500 mt-0.5 tracking-widest">
                                Dashboard Tổng hợp ({startStr.split('-').reverse().join('/')} → {endStr.split('-').reverse().join('/')})
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 flex-wrap">
                        {/* Compare mode selector */}
                        <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">So sánh:</span>
                            <button onClick={() => setCompareMode('prev_week')}
                                className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${compareMode === 'prev_week' ? 'bg-white shadow-sm text-indigo-700 border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>
                                Tuần trước
                            </button>
                            <button onClick={() => setCompareMode('custom')}
                                className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${compareMode === 'custom' ? 'bg-white shadow-sm text-indigo-700 border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>
                                Tùy chọn
                            </button>
                        </div>
                        {compareMode === 'custom' && (
                            <div className="flex items-center gap-2">
                                <input type="date" value={customCompareFrom} onChange={e => setCustomCompareFrom(e.target.value)}
                                    className="bg-white border border-slate-200 px-2 py-1 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500" />
                                <span className="text-slate-400 text-xs">→</span>
                                <input type="date" value={customCompareTo} onChange={e => setCustomCompareTo(e.target.value)}
                                    className="bg-white border border-slate-200 px-2 py-1 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500" />
                            </div>
                        )}
                        <div className="text-right hidden md:block">
                            <div className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Mã Quỹ Tuần</div>
                            <div className="font-black text-2xl text-slate-800 tabular-nums">{fmt(totalRequested)}</div>
                        </div>
                        <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-inner">
                            <button onClick={() => changeWeek(-1)} className="px-3 py-1.5 rounded-xl hover:bg-white text-slate-500 hover:text-indigo-600 transition-all font-bold text-xs">
                                <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                            </button>
                            <div className="px-6 py-1.5 bg-white rounded-xl shadow-sm border border-slate-200/60 text-sm font-black text-indigo-700 tracking-wider">
                                Tuần {activeWeek} - {activeYear}
                            </div>
                            <button onClick={() => changeWeek(1)} className="px-3 py-1.5 rounded-xl hover:bg-white text-slate-500 hover:text-indigo-600 transition-all font-bold text-xs">
                                <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* ═══════ DASHBOARD GRID ═══════ */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

                    {/* Panel 1: Phân loại + Trend */}
                    <div className="bg-white rounded-[20px] border border-slate-200 shadow-sm p-4 flex flex-col">
                        <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">
                            Tổng hợp theo Bộ phận — Trend vs {compareLabel}
                        </div>
                        <table className="w-full text-[11px] text-left mb-2">
                            <thead className="text-slate-500 border-b border-slate-200">
                                <tr>
                                    <th className="pb-2 font-medium">Bộ phận</th>
                                    <th className="pb-2 text-right font-medium">ĐNTT</th>
                                    <th className="pb-2 text-right font-medium text-emerald-600">Thực tế</th>
                                    <th className="pb-2 text-center font-medium">Trend</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {Object.entries(categoryStats).map(([cat, s]) => (
                                    <tr key={cat}>
                                        <td className="py-2.5 font-bold text-slate-700">{cat}</td>
                                        <td className="py-2.5 text-right font-bold text-blue-700 tabular-nums">{fmt(s.r)}</td>
                                        <td className="py-2.5 text-right font-black text-emerald-600 tabular-nums bg-emerald-50/20">{fmt(s.a)}</td>
                                        <td className="py-2.5 text-center"><TrendBadge current={s.r} compare={s.cr} label={compareLabel} /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div className="pt-2 border-t-2 border-slate-200 flex justify-between items-center mt-auto">
                            <span className="font-black text-slate-800 text-xs">Total</span>
                            <div className="flex items-center gap-4">
                                <span className="font-black text-blue-700 text-xs tabular-nums">{fmt(totalRequested)}</span>
                                <span className="font-black text-emerald-600 text-xs tabular-nums">{fmt(totalActual)}</span>
                                <TrendBadge current={totalRequested} compare={compareTotal} label={compareLabel} />
                            </div>
                        </div>
                    </div>

                    {/* Panel 2: % Hoàn thành */}
                    <div className="bg-white rounded-[20px] border border-slate-200 shadow-sm p-4 flex flex-col">
                        <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4">
                            Tỷ lệ Thực chi / Đề nghị
                        </div>
                        <div className="flex-1 flex flex-col justify-center gap-5">
                            <div className="text-center">
                                <div className={`text-5xl font-black tabular-nums ${completionPct >= 80 ? 'text-emerald-600' : completionPct >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>
                                    {completionPct.toFixed(1)}<span className="text-2xl text-slate-400">%</span>
                                </div>
                                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Hoàn thành</div>
                            </div>
                            <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                                <div className={`h-3 rounded-full transition-all ${completionPct >= 80 ? 'bg-emerald-500' : completionPct >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                    style={{ width: `${Math.min(completionPct, 100)}%` }}></div>
                            </div>
                            <div className="flex justify-between text-xs text-slate-500 font-medium">
                                <span>Đề nghị: <strong className="text-blue-700">{fmtB(totalRequested)}</strong></span>
                                <span>Thực chi: <strong className="text-emerald-700">{fmtB(totalActual)}</strong></span>
                            </div>
                            {/* Per-category progress */}
                            <div className="space-y-2.5 mt-2">
                                {Object.entries(categoryStats).map(([cat, s]) => {
                                    const pct = s.r > 0 ? (s.a / s.r * 100) : 0;
                                    const catColor = cat === 'Vật tư' ? 'amber' : cat === 'Nhân công' ? 'blue' : 'slate';
                                    return (
                                        <div key={cat}>
                                            <div className="flex justify-between text-[10px] text-slate-500 font-bold mb-0.5">
                                                <span className="flex items-center gap-1">
                                                    <span className={`w-2 h-2 rounded-full bg-${catColor}-500`}></span>{cat}
                                                </span>
                                                <span>{pct.toFixed(0)}%</span>
                                            </div>
                                            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                                <div className={`bg-${catColor}-500 h-1.5 rounded-full`} style={{ width: `${pct}%` }}></div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Panel 3: Top dự án */}
                    <div className="bg-white rounded-[20px] border border-slate-200 shadow-sm p-4 flex flex-col">
                        <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">
                            Chi tiết theo Dự án ({projectGroups.length})
                        </div>
                        <div className="overflow-y-auto flex-1 pr-2 space-y-2 custom-scrollbar">
                            {projectGroups.map(([code, g]) => {
                                const pct = g.total > 0 ? (g.actual / g.total * 100) : 0;
                                return (
                                    <div key={code} className="bg-slate-50 p-3 rounded-xl border border-slate-100 hover:border-indigo-200 transition-all">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <div className="font-black text-xs text-indigo-700">{code}</div>
                                                <div className="text-[10px] text-slate-500 truncate max-w-[160px]" title={g.name}>{g.name}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-black text-sm text-slate-800 tabular-nums">{fmt(g.total)}</div>
                                                <div className="text-[9px] text-emerald-600 font-bold tabular-nums">TT: {fmt(g.actual)}</div>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 text-[9px] font-bold text-slate-400">
                                            <span className="bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-100">VT: {fmtB(g.mat)}</span>
                                            <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100">NC: {fmtB(g.lab)}</span>
                                            <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">CP: {fmtB(g.exp)}</span>
                                        </div>
                                        <div className="w-full bg-slate-200 h-1 rounded-full mt-2 overflow-hidden">
                                            <div className={`h-1 rounded-full ${pct >= 80 ? 'bg-emerald-500' : 'bg-indigo-400'}`} style={{ width: `${pct}%` }}></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* ═══════ MAIN TABLE ═══════ */}
                <div className="bg-white rounded-[20px] shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-wrap justify-between items-center gap-3">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center">
                                <span className="material-symbols-outlined text-[18px]">table_rows</span>
                            </div>
                            <span className="font-black text-slate-700 text-sm tracking-tight uppercase">Chi Tiết Bảng Tổng Kê</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-xs font-semibold text-slate-400">Tự động tổng hợp từ VT, NC, CPSC</span>
                            <div className="flex bg-slate-100 rounded-lg p-0.5 border border-slate-200">
                                <button onClick={() => setGroupByProject(false)}
                                    className={`px-3 py-1 rounded-md text-[10px] font-black uppercase transition-all ${!groupByProject ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500'}`}>
                                    Flat
                                </button>
                                <button onClick={() => setGroupByProject(true)}
                                    className={`px-3 py-1 rounded-md text-[10px] font-black uppercase transition-all ${groupByProject ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500'}`}>
                                    Theo DA
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-xs text-left whitespace-nowrap">
                            <thead className="bg-[#f8f9fa] border-b-2 border-slate-200 text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                                <tr>
                                    <th className="w-[100px] px-3 py-2.5 border-r border-slate-200 text-center">Ngày</th>
                                    <th className="w-[100px] px-3 py-2.5 border-r border-slate-200 text-center">Phân loại</th>
                                    <th className="w-[160px] px-3 py-2.5 border-r border-slate-200">Đơn vị Thụ Hưởng</th>
                                    {!groupByProject && <th className="w-[100px] px-3 py-2.5 border-r border-slate-200">Mã DA</th>}
                                    <th className="w-[260px] px-3 py-2.5 border-r border-slate-200">Nội dung</th>
                                    <th className="w-[100px] px-3 py-2.5 border-r border-slate-200 text-center">Ưu tiên</th>
                                    <th className="w-[130px] px-3 py-2.5 border-r border-slate-200 text-right text-indigo-600">Đề nghị</th>
                                    <th className="w-[130px] px-3 py-2.5 border-r border-slate-200 text-right text-emerald-600">Thực chi</th>
                                    <th className="w-[80px] px-3 py-2.5 text-center">%</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {isLoading ? (
                                    <tr><td colSpan={9} className="py-10 text-center text-slate-400 font-medium">Đang đồng bộ dữ liệu...</td></tr>
                                ) : currentPlans.length === 0 ? (
                                    <tr><td colSpan={9} className="py-16 text-center text-slate-400 bg-slate-50/50">Không có phát sinh chi phí nào trong kỳ.</td></tr>
                                ) : groupByProject ? (
                                    projectGroups.map(([code, g]) => (
                                        <React.Fragment key={code}>
                                            {/* Project header row */}
                                            <tr className="bg-indigo-50/50 border-t-2 border-indigo-100">
                                                <td colSpan={2} className="px-3 py-2.5 font-black text-indigo-700 text-[11px]">
                                                    <span className="material-symbols-outlined text-[14px] mr-1 align-middle">apartment</span>
                                                    {code}
                                                </td>
                                                <td colSpan={2} className="px-3 py-2.5 text-[10px] text-indigo-600 font-medium truncate">{g.name}</td>
                                                <td className="px-3 py-2.5 text-center text-[9px] text-slate-400 font-bold">{g.items.length} dòng</td>
                                                <td className="px-3 py-2.5 text-right font-black text-indigo-800 tabular-nums">{fmt(g.total)}</td>
                                                <td className="px-3 py-2.5 text-right font-black text-emerald-700 tabular-nums">{fmt(g.actual)}</td>
                                                <td className="px-3 py-2.5 text-center">
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${(g.total > 0 ? g.actual / g.total * 100 : 0) >= 80 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                                        {g.total > 0 ? (g.actual / g.total * 100).toFixed(0) : 0}%
                                                    </span>
                                                </td>
                                            </tr>
                                            {/* Items */}
                                            {g.items.map(row => {
                                                const rowPct = row.requested_amount > 0 ? (row.actual_amount / row.requested_amount * 100) : 0;
                                                return (
                                                    <tr key={row.id} className="hover:bg-indigo-50/10 transition-colors">
                                                        <td className="px-3 py-2 border-r border-slate-100/50 text-center text-slate-500 font-mono text-[10px]">{row.request_date ? fmtDate(row.request_date) : '—'}</td>
                                                        <td className="px-3 py-2 border-r border-slate-100/50 text-center">
                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${row.category === 'Vật tư' ? 'bg-amber-50 text-amber-700 border-amber-200' : row.category === 'Nhân công' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>{row.category}</span>
                                                        </td>
                                                        <td className="px-3 py-2 border-r border-slate-100/50 font-bold text-slate-800 truncate" title={row.vendor_name}>{row.vendor_name || '—'}</td>
                                                        <td className="px-3 py-2 border-r border-slate-100/50 text-slate-600 truncate" title={row.description}>{row.description || '—'}</td>
                                                        <td className="px-3 py-2 border-r border-slate-100/50 text-center">
                                                            <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${
                                                                row.priority === 'Khẩn cấp' || row.priority === 'Rất gấp' ? 'bg-rose-50 border-rose-200 text-rose-700' :
                                                                row.priority === 'Gấp' || row.priority === 'Cao' ? 'bg-orange-50 border-orange-200 text-orange-700' :
                                                                'bg-slate-50 border-slate-200 text-slate-400'
                                                            }`}>{row.priority}</span>
                                                        </td>
                                                        <td className="px-3 py-2 border-r border-slate-100/50 text-right font-bold text-indigo-800 tabular-nums">{fmt(row.requested_amount)}</td>
                                                        <td className="px-3 py-2 border-r border-slate-100/50 text-right font-black text-emerald-600 tabular-nums bg-emerald-50/20">{fmt(row.actual_amount)}</td>
                                                        <td className="px-3 py-2 text-center">
                                                            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mx-auto max-w-[60px]">
                                                                <div className={`h-1.5 rounded-full ${rowPct >= 80 ? 'bg-emerald-500' : rowPct > 0 ? 'bg-amber-400' : 'bg-slate-200'}`}
                                                                    style={{ width: `${Math.min(rowPct, 100)}%` }}></div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </React.Fragment>
                                    ))
                                ) : (
                                    currentPlans.map(row => {
                                        const rowPct = row.requested_amount > 0 ? (row.actual_amount / row.requested_amount * 100) : 0;
                                        return (
                                            <tr key={row.id} className="hover:bg-indigo-50/10 transition-colors">
                                                <td className="px-3 py-2 border-r border-slate-100/50 text-center text-slate-500 font-mono text-[10px]">{row.request_date ? fmtDate(row.request_date) : '—'}</td>
                                                <td className="px-3 py-2 border-r border-slate-100/50 text-center">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${row.category === 'Vật tư' ? 'bg-amber-50 text-amber-700 border-amber-200' : row.category === 'Nhân công' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>{row.category}</span>
                                                </td>
                                                <td className="px-3 py-2 border-r border-slate-100/50 font-bold text-slate-800 truncate">{row.vendor_name || '—'}</td>
                                                <td className="px-3 py-2 border-r border-slate-100/50 font-bold text-indigo-700 bg-indigo-50/20 truncate">{row.project_code || '—'}</td>
                                                <td className="px-3 py-2 border-r border-slate-100/50 text-slate-600 truncate">{row.description || '—'}</td>
                                                <td className="px-3 py-2 border-r border-slate-100/50 text-center">
                                                    <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${
                                                        row.priority === 'Khẩn cấp' || row.priority === 'Rất gấp' ? 'bg-rose-50 border-rose-200 text-rose-700' :
                                                        row.priority === 'Gấp' || row.priority === 'Cao' ? 'bg-orange-50 border-orange-200 text-orange-700' :
                                                        'bg-slate-50 border-slate-200 text-slate-400'
                                                    }`}>{row.priority}</span>
                                                </td>
                                                <td className="px-3 py-2 border-r border-slate-100/50 text-right font-bold text-indigo-800 tabular-nums">{fmt(row.requested_amount)}</td>
                                                <td className="px-3 py-2 border-r border-slate-100/50 text-right font-black text-emerald-600 tabular-nums bg-emerald-50/30">{fmt(row.actual_amount)}</td>
                                                <td className="px-3 py-2 text-center">
                                                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mx-auto max-w-[60px]">
                                                        <div className={`h-1.5 rounded-full ${rowPct >= 80 ? 'bg-emerald-500' : rowPct > 0 ? 'bg-amber-400' : 'bg-slate-200'}`}
                                                            style={{ width: `${Math.min(rowPct, 100)}%` }}></div>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
            `}</style>
        </div>
    );
}
