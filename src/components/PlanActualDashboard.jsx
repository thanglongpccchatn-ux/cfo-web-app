import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const fmt = (v) => new Intl.NumberFormat('vi-VN').format(Math.round(v || 0));
const fmtB = (v) => {
    const n = v || 0;
    if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(2)} Tỷ`;
    if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(0)} Tr`;
    return fmt(n);
};
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('vi-VN') : '—';

// ─────────────────────────────────────────────
// LEVEL 1: Bảng tổng hợp tất cả dự án
// ─────────────────────────────────────────────
function AllProjectsSummary({ onSelect }) {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sort, setSort] = useState({ col: 'name', asc: true });

    useEffect(() => { loadAll(); }, []);

    async function loadAll() {
        setLoading(true);
        // Load projects with partner
        const { data: projects } = await supabase
            .from('projects')
            .select('*, partners!projects_partner_id_fkey(name)')
            .order('created_at', { ascending: false });

        if (!projects || projects.length === 0) { setRows([]); setLoading(false); return; }

        // Load all sub-data in parallel
        const ids = projects.map(p => p.id);
        const [stagesRes, matsRes, laborsRes, expsRes] = await Promise.all([
            supabase.from('payments').select('project_id, payment_request_amount, external_income, due_date').in('project_id', ids),
            supabase.from('expense_materials').select('project_id, total_amount').in('project_id', ids),
            supabase.from('expense_labor').select('project_id, approved_amount').in('project_id', ids),
            supabase.from('expenses').select('project_id, amount, paid_amount').in('project_id', ids),
        ]);

        const stages = stagesRes.data || [];
        const mats = matsRes.data || [];
        const labors = laborsRes.data || [];
        const exps = expsRes.data || [];

        const enriched = projects.map(p => {
            const pStages = stages.filter(s => s.project_id === p.id);
            const pMats = mats.filter(m => m.project_id === p.id);
            const pLabors = labors.filter(l => l.project_id === p.id);
            const pExps = exps.filter(e => e.project_id === p.id);

            const contractValue = Number(p.original_value || 0);
            const satecoRatio = Number(p.sateco_actual_ratio || p.sateco_contract_ratio || 100) / 100;
            const plannedExpense = contractValue * satecoRatio;

            const actualRevenue = pStages.reduce((s, st) => s + Number(st.external_income || 0), 0);
            const actualMat = pMats.reduce((s, m) => s + Number(m.total_amount || 0), 0);
            const actualLabor = pLabors.reduce((s, l) => s + Number(l.approved_amount || 0), 0);
            const actualGenExp = pExps.reduce((s, e) => s + Number(e.paid_amount || e.amount || 0), 0);
            const actualExpense = actualMat + actualLabor + actualGenExp;

            const plannedProfit = contractValue - plannedExpense;
            const actualProfit = actualRevenue - actualExpense;

            // Overdue stages
            const today = new Date(); today.setHours(0,0,0,0);
            const overdueCount = pStages.filter(st =>
                st.due_date && new Date(st.due_date) < today && Number(st.external_income || 0) < Number(st.payment_request_amount || 0)
            ).length;

            return {
                ...p,
                contractValue, plannedExpense, plannedProfit,
                actualRevenue, actualExpense, actualProfit,
                revPct: contractValue > 0 ? (actualRevenue / contractValue * 100) : 0,
                expPct: plannedExpense > 0 ? (actualExpense / plannedExpense * 100) : 0,
                stageCount: pStages.length,
                overdueCount,
                partner: p.partners?.name || '—',
            };
        });

        setRows(enriched);
        setLoading(false);
    };

    // Sort
    const sorted = [...rows].sort((a, b) => {
        const av = a[sort.col], bv = b[sort.col];
        if (typeof av === 'string') return sort.asc ? av.localeCompare(bv) : bv.localeCompare(av);
        return sort.asc ? (av || 0) - (bv || 0) : (bv || 0) - (av || 0);
    });

    const toggleSort = (col) => setSort(s => ({ col, asc: s.col === col ? !s.asc : true }));

    // Totals
    const total = rows.reduce((acc, r) => ({
        contractValue: acc.contractValue + r.contractValue,
        plannedExpense: acc.plannedExpense + r.plannedExpense,
        plannedProfit: acc.plannedProfit + r.plannedProfit,
        actualRevenue: acc.actualRevenue + r.actualRevenue,
        actualExpense: acc.actualExpense + r.actualExpense,
        actualProfit: acc.actualProfit + r.actualProfit,
    }), { contractValue: 0, plannedExpense: 0, plannedProfit: 0, actualRevenue: 0, actualExpense: 0, actualProfit: 0 });

    const SortTh = ({ col, children, right }) => (
        <th
            className={`px-3 py-3 cursor-pointer select-none text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-700 transition-colors ${right ? 'text-right' : 'text-left'}`}
            onClick={() => toggleSort(col)}
        >
            <span className="flex items-center gap-1 justify-end">
                {right && children}
                <span className="material-symbols-outlined notranslate text-[12px]" translate="no">
                    {sort.col === col ? (sort.asc ? 'arrow_upward' : 'arrow_downward') : 'unfold_more'}
                </span>
                {!right && children}
            </span>
        </th>
    );

    return (
        <div className="space-y-6">
            {/* Header meta cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Tổng giá trị HĐ', value: fmtB(total.contractValue), icon: 'description', color: 'text-blue-600 bg-blue-50' },
                    { label: 'Thực thu (Thăng Long)', value: fmtB(total.actualRevenue), icon: 'payments', color: 'text-emerald-600 bg-emerald-50' },
                    { label: 'Thực chi (Sateco)', value: fmtB(total.actualExpense), icon: 'construction', color: 'text-orange-600 bg-orange-50' },
                    { label: 'Lợi nhuận Thực tế', value: fmtB(total.actualProfit), icon: 'trending_up', color: total.actualProfit >= 0 ? 'text-emerald-600 bg-emerald-50' : 'text-red-600 bg-red-50' },
                ].map(c => (
                    <div key={c.label} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${c.color}`}>
                            <span className="material-symbols-outlined notranslate text-[20px]" translate="no">{c.icon}</span>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-tight">{c.label}</p>
                            <p className={`text-lg font-black ${c.color.split(' ')[0]}`}>{c.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Table */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <span className="material-symbols-outlined notranslate text-indigo-500 text-[20px]" translate="no">view_list</span>
                        Tất cả dự án ({rows.length})
                    </h3>
                    <p className="text-xs text-slate-400">Click vào dòng để xem chi tiết từng dự án</p>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <div className="w-7 h-7 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin"></div>
                    </div>
                ) : rows.length === 0 ? (
                    <div className="text-center py-16">
                        <span className="material-symbols-outlined notranslate text-5xl text-slate-300 mb-3 block" translate="no">folder_open</span>
                        <p className="text-slate-500 font-medium">Chưa có dự án nào</p>
                        <p className="text-xs text-slate-400">Tạo hợp đồng đầu tiên trong mục Hợp đồng</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 border-b border-slate-100">
                                <tr>
                                    <SortTh col="name">Dự án / CĐT</SortTh>
                                    <SortTh col="contractValue" right>Giá trị HĐ</SortTh>
                                    <SortTh col="actualRevenue" right>Thực thu TL</SortTh>
                                    <SortTh col="revPct" right>% Thu</SortTh>
                                    <SortTh col="plannedExpense" right>Khoán Sateco</SortTh>
                                    <SortTh col="actualExpense" right>Thực chi ST</SortTh>
                                    <SortTh col="expPct" right>% Chi</SortTh>
                                    <SortTh col="actualProfit" right>LN Thực tế</SortTh>
                                    <th className="px-3 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">Tình trạng</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {sorted.map(row => {
                                    const revOk = row.revPct >= 80;
                                    const expWarn = row.expPct > 100;
                                    return (
                                        <tr
                                            key={row.id}
                                            onClick={() => onSelect(row)}
                                            className="group hover:bg-indigo-50/50 cursor-pointer transition-colors"
                                        >
                                            <td className="px-3 py-3.5">
                                                <p className="font-bold text-slate-800 group-hover:text-indigo-700 transition-colors">{row.name}</p>
                                                <p className="text-xs text-slate-400">{row.partner} · {row.code || 'Chưa có mã'}</p>
                                                {row.overdueCount > 0 && (
                                                    <span className="inline-flex items-center gap-1 mt-0.5 text-[10px] font-bold text-red-500">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse inline-block"></span>
                                                        {row.overdueCount} đợt quá hạn
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-3 py-3.5 text-right tabular-nums font-semibold text-slate-700">{fmtB(row.contractValue)}</td>
                                            <td className="px-3 py-3.5 text-right tabular-nums font-bold text-emerald-600">{fmtB(row.actualRevenue)}</td>
                                            <td className="px-3 py-3.5 text-right">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${revOk ? 'bg-emerald-100 text-emerald-700' : row.revPct > 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-500'}`}>
                                                    {row.revPct.toFixed(0)}%
                                                </span>
                                            </td>
                                            <td className="px-3 py-3.5 text-right tabular-nums text-slate-500">{fmtB(row.plannedExpense)}</td>
                                            <td className="px-3 py-3.5 text-right tabular-nums font-bold text-orange-600">{fmtB(row.actualExpense)}</td>
                                            <td className="px-3 py-3.5 text-right">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${expWarn ? 'bg-red-100 text-red-700' : row.expPct > 80 ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-500'}`}>
                                                    {row.expPct.toFixed(0)}%
                                                    {expWarn && ' ⚠️'}
                                                </span>
                                            </td>
                                            <td className="px-3 py-3.5 text-right tabular-nums">
                                                <span className={`font-black ${row.actualProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmtB(row.actualProfit)}</span>
                                            </td>
                                            <td className="px-3 py-3.5 text-right">
                                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${row.status === 'Hoàn thành' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                                                    {row.status || 'Đang thi công'}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot>
                                <tr className="bg-slate-100 border-t-2 border-slate-200">
                                    <td className="px-3 py-3 font-black text-slate-700">Tổng cộng ({rows.length} DA)</td>
                                    <td className="px-3 py-3 text-right font-black text-blue-700">{fmtB(total.contractValue)}</td>
                                    <td className="px-3 py-3 text-right font-black text-emerald-700">{fmtB(total.actualRevenue)}</td>
                                    <td className="px-3 py-3"></td>
                                    <td className="px-3 py-3 text-right font-bold text-slate-600">{fmtB(total.plannedExpense)}</td>
                                    <td className="px-3 py-3 text-right font-black text-orange-700">{fmtB(total.actualExpense)}</td>
                                    <td className="px-3 py-3"></td>
                                    <td className="px-3 py-3 text-right font-black ${total.actualProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}">{fmtB(total.actualProfit)}</td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────
// LEVEL 2: Chi tiết từng dự án
// ─────────────────────────────────────────────
function ProjectDetail({ project, onBack }) {
    const [loading, setLoading] = useState(false);
    const [activeView, setActiveView] = useState('overview');
    const [stages, setStages] = useState([]);
    const [materials, setMaterials] = useState([]);
    const [labors, setLabors] = useState([]);
    const [expenses, setExpenses] = useState([]);

    useEffect(() => { loadDetail(); }, [project.id]);

    async function loadDetail() {
        setLoading(true);
        const [stagesRes, matsRes, laborsRes, expsRes] = await Promise.all([
            supabase.from('payments').select('*').eq('project_id', project.id).order('created_at'),
            supabase.from('expense_materials').select('*').eq('project_id', project.id),
            supabase.from('expense_labor').select('*').eq('project_id', project.id),
            supabase.from('expenses').select('*').eq('project_id', project.id),
        ]);
        setStages(stagesRes.data || []);
        setMaterials(matsRes.data || []);
        setLabors(laborsRes.data || []);
        setExpenses(expsRes.data || []);
        setLoading(false);
    };

    const contractValue = Number(project.original_value || 0);
    const satecoRatio = Number(project.sateco_actual_ratio || project.sateco_contract_ratio || 100) / 100;
    const plannedExpense = contractValue * satecoRatio;
    const actualRevenue = stages.reduce((s, st) => s + Number(st.external_income || 0), 0);
    const actualMat = materials.reduce((s, m) => s + Number(m.total_amount || 0), 0);
    const actualLabor = labors.reduce((s, l) => s + Number(l.approved_amount || 0), 0);
    const actualGenExp = expenses.reduce((s, e) => s + Number(e.paid_amount || e.amount || 0), 0);
    const actualExpense = actualMat + actualLabor + actualGenExp;
    const plannedProfit = contractValue - plannedExpense;
    const actualProfit = actualRevenue - actualExpense;
    const revPct = contractValue > 0 ? (actualRevenue / contractValue) * 100 : 0;
    const expPct = plannedExpense > 0 ? (actualExpense / plannedExpense) * 100 : 0;

    const getStageStatus = (stage) => {
        const income = Number(stage.external_income || 0);
        const request = Number(stage.payment_request_amount || 0);
        const today = new Date(); today.setHours(0,0,0,0);
        const dueDate = stage.due_date ? new Date(stage.due_date) : null;
        if (request > 0 && income >= request) return { label: 'Đã thu đủ', color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' };
        if (dueDate && today > dueDate && request > 0) return { label: 'Quá hạn', color: 'bg-red-100 text-red-700', dot: 'bg-red-500 animate-pulse' };
        if (income > 0) return { label: 'Thu một phần', color: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-500' };
        return { label: 'Chưa thu', color: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' };
    };

    const kpis = [
        { label: 'Giá trị HĐ', planned: contractValue, actual: actualRevenue, pct: revPct, icon: 'payments', c: 'blue', note: `Thu được / HĐ` },
        { label: 'Khoán Sateco', planned: plannedExpense, actual: actualExpense, pct: expPct, icon: 'construction', c: expPct > 100 ? 'red' : 'orange', note: `${project.sateco_actual_ratio || project.sateco_contract_ratio || 100}% × HĐ` },
        { label: 'LN Kế hoạch', val: plannedProfit, icon: 'calculate', c: plannedProfit >= 0 ? 'green' : 'red', single: true },
        { label: 'LN Thực tế', val: actualProfit, icon: 'trending_up', c: actualProfit >= 0 ? 'green' : 'red', single: true },
    ];
    const cMap = {
        blue: 'bg-blue-50 text-blue-600 border-blue-200',
        orange: 'bg-orange-50 text-orange-600 border-orange-200',
        red: 'bg-red-50 text-red-600 border-red-200',
        green: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    };
    const barMap = { blue: 'bg-blue-500', orange: 'bg-orange-500', red: 'bg-red-500', green: 'bg-emerald-500' };

    return (
        <div className="space-y-5">
            {/* Breadcrumb */}
            <div className="flex items-center gap-3">
                <button onClick={onBack} className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors">
                    <span className="material-symbols-outlined notranslate text-[18px]" translate="no">arrow_back</span>
                    Tất cả dự án
                </button>
                <span className="text-slate-300">/</span>
                <span className="text-sm font-bold text-slate-800">{project.name}</span>
            </div>

            {/* Project banner */}
            <div className="bg-gradient-to-r from-indigo-600 to-blue-600 rounded-2xl p-5 text-white shadow-lg shadow-indigo-500/20">
                <div className="flex flex-wrap gap-6 items-center">
                    <div className="flex-1">
                        <p className="text-indigo-200 text-xs font-bold uppercase tracking-wider">{project.code || 'Chưa có mã'}</p>
                        <h3 className="text-xl font-black mt-0.5">{project.name}</h3>
                        <p className="text-indigo-200 text-sm mt-1">{project.partner || '—'} · {project.contract_type || ''} {project.contract_form ? `/ ${project.contract_form}` : ''}</p>
                    </div>
                    <div className="flex gap-5 text-center">
                        <div><p className="text-indigo-200 text-xs uppercase font-bold">Giá trị HĐ</p><p className="font-black text-lg">{fmtB(contractValue)}</p></div>
                        <div><p className="text-indigo-200 text-xs uppercase font-bold">Thực thu</p><p className="font-black text-lg text-emerald-300">{fmtB(actualRevenue)}</p></div>
                        <div><p className="text-indigo-200 text-xs uppercase font-bold">Thực chi</p><p className="font-black text-lg text-orange-300">{fmtB(actualExpense)}</p></div>
                    </div>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {kpis.map(kpi => (
                    <div key={kpi.label} className={`bg-white border rounded-2xl p-4 shadow-sm ${cMap[kpi.c].split(' ')[2]}`}>
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-2 text-sm ${cMap[kpi.c].split(' ').slice(0,2).join(' ')}`}>
                            <span className="material-symbols-outlined notranslate text-[18px]" translate="no">{kpi.icon}</span>
                        </div>
                        <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${cMap[kpi.c].split(' ')[1]}`}>{kpi.label}</p>
                        {kpi.single ? (
                            <p className={`text-xl font-black ${cMap[kpi.c].split(' ')[1]}`}>{fmtB(kpi.val)}</p>
                        ) : (
                            <>
                                <div className="flex items-baseline gap-1.5">
                                    <p className={`text-xl font-black ${cMap[kpi.c].split(' ')[1]}`}>{fmtB(kpi.actual)}</p>
                                    <p className="text-xs text-slate-400">/ {fmtB(kpi.planned)}</p>
                                </div>
                                <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full ${kpi.pct > 100 ? 'bg-red-500' : barMap[kpi.c]}`} style={{ width: `${Math.min(kpi.pct, 100)}%` }}></div>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1">{kpi.pct.toFixed(1)}% · {kpi.note}</p>
                            </>
                        )}
                    </div>
                ))}
            </div>

            {/* Tabs */}
            <div className="flex gap-2">
                {[
                    { key: 'overview', label: 'Cashflow Chart', icon: 'waterfall_chart' },
                    { key: 'stages', label: 'Đợt thanh toán', icon: 'receipt' },
                    { key: 'expenses', label: 'Chi phí Sateco', icon: 'construction' },
                ].map(v => (
                    <button key={v.key} onClick={() => setActiveView(v.key)}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${activeView === v.key ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                        <span className="material-symbols-outlined notranslate text-[15px]" translate="no">{v.icon}</span>
                        {v.label}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="flex justify-center py-12"><div className="w-7 h-7 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin"></div></div>
            ) : (
                <>
                    {/* CASHFLOW CHART */}
                    {activeView === 'overview' && (
                        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <span className="material-symbols-outlined notranslate text-indigo-500 text-[20px]" translate="no">waterfall_chart</span>
                                So sánh Kế hoạch vs Thực tế theo đợt
                            </h3>
                            {stages.length === 0 ? (
                                <p className="text-center text-slate-400 py-8">Chưa có đợt thanh toán nào</p>
                            ) : (
                                <>
                                    <div className="overflow-x-auto">
                                        <div className="flex gap-4 min-w-max pb-3">
                                            {stages.map((stage, i) => {
                                                const planned = Number(stage.payment_request_amount || 0);
                                                const actual = Number(stage.external_income || 0);
                                                const maxVal = Math.max(...stages.map(s => Math.max(Number(s.payment_request_amount || 0), Number(s.external_income || 0))), 1);
                                                const pH = (planned / maxVal) * 140;
                                                const aH = (actual / maxVal) * 140;
                                                const status = getStageStatus(stage);
                                                return (
                                                    <div key={stage.id} className="flex flex-col items-center gap-1.5 w-24">
                                                        <div className="text-[9px] text-center text-indigo-600 font-bold">{fmtB(planned)}</div>
                                                        <div className="flex items-end gap-1.5 h-36">
                                                            <div className="flex flex-col items-center gap-0.5">
                                                                <span className="text-[8px] text-slate-400">KH</span>
                                                                <div title={`KH: ${fmt(planned)}`} className="w-9 bg-indigo-200 rounded-t-lg border border-indigo-300" style={{ height: `${pH}px` }}></div>
                                                            </div>
                                                            <div className="flex flex-col items-center gap-0.5">
                                                                <span className="text-[8px] text-slate-400">TT</span>
                                                                <div title={`TT: ${fmt(actual)}`} className={`w-9 rounded-t-lg border ${actual >= planned ? 'bg-emerald-400 border-emerald-500' : actual > 0 ? 'bg-yellow-300 border-yellow-400' : 'bg-slate-100 border-slate-200'}`} style={{ height: `${aH || 0}px`, minHeight: actual > 0 ? '4px' : '0' }}></div>
                                                            </div>
                                                        </div>
                                                        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${status.color}`}>
                                                            <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`}></span>
                                                            {status.label}
                                                        </span>
                                                        <p className="text-[10px] text-slate-500 text-center font-medium leading-tight">{stage.name || `Đợt ${i+1}`}</p>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-500 border-t border-slate-100 pt-3">
                                        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-indigo-200 inline-block border border-indigo-300"></span>KH = Kế hoạch (ĐNTT)</span>
                                        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-400 inline-block"></span>TT ≥ KH</span>
                                        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-yellow-300 inline-block"></span>TT &lt; KH</span>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* STAGES TABLE */}
                    {activeView === 'stages' && (
                        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                                <h3 className="font-bold text-slate-800">{stages.length} Đợt Thanh Toán</h3>
                            </div>
                            {stages.length === 0 ? (
                                <p className="text-center text-slate-400 py-10">Chưa có đợt thanh toán nào</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead>
                                            <tr className="bg-slate-50 border-b border-slate-100 text-[10px] uppercase font-bold text-slate-500">
                                                <th className="px-4 py-3">Đợt / Loại</th>
                                                <th className="px-4 py-3 text-right">KH (ĐNTT)</th>
                                                <th className="px-4 py-3 text-right">Thực thu CĐT</th>
                                                <th className="px-4 py-3 text-right">Còn lại</th>
                                                <th className="px-4 py-3">Hạn TT</th>
                                                <th className="px-4 py-3">Trạng thái</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {stages.map((st, i) => {
                                                const planned = Number(st.payment_request_amount || 0);
                                                const actual = Number(st.external_income || 0);
                                                const remaining = planned - actual;
                                                const status = getStageStatus(st);
                                                const today = new Date(); today.setHours(0,0,0,0);
                                                const overdueDays = st.due_date ? Math.round((today - new Date(st.due_date)) / 86400000) : null;
                                                return (
                                                    <tr key={st.id} className="hover:bg-slate-50/60">
                                                        <td className="px-4 py-3.5">
                                                            <p className="font-bold text-slate-800">{st.name || `Đợt ${i+1}`}</p>
                                                            <p className="text-xs text-slate-400">{st.type || '—'}</p>
                                                        </td>
                                                        <td className="px-4 py-3.5 text-right tabular-nums font-semibold text-slate-700">{fmt(planned)}</td>
                                                        <td className="px-4 py-3.5 text-right tabular-nums font-bold">
                                                            <span className={actual >= planned ? 'text-emerald-600' : actual > 0 ? 'text-yellow-600' : 'text-slate-400'}>{actual > 0 ? fmt(actual) : '—'}</span>
                                                        </td>
                                                        <td className="px-4 py-3.5 text-right tabular-nums font-semibold">
                                                            <span className={remaining > 0 ? 'text-red-500' : 'text-emerald-600'}>{remaining > 0 ? fmt(remaining) : '✓'}</span>
                                                        </td>
                                                        <td className="px-4 py-3.5">
                                                            <p className="text-slate-600 text-xs">{fmtDate(st.due_date)}</p>
                                                            {overdueDays !== null && overdueDays > 0 && actual < planned && (
                                                                <p className="text-red-500 text-[10px] font-bold">Quá {overdueDays} ngày</p>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3.5">
                                                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${status.color}`}>
                                                                <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`}></span>
                                                                {status.label}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                        <tfoot>
                                            <tr className="bg-slate-100 border-t-2 border-slate-200 font-black text-sm">
                                                <td className="px-4 py-3 text-slate-700">Tổng cộng</td>
                                                <td className="px-4 py-3 text-right text-slate-800">{fmt(stages.reduce((s, st) => s + Number(st.payment_request_amount || 0), 0))}</td>
                                                <td className="px-4 py-3 text-right text-emerald-700">{fmt(actualRevenue)}</td>
                                                <td className="px-4 py-3 text-right text-red-600">{fmt(stages.reduce((s, st) => s + Math.max(Number(st.payment_request_amount || 0) - Number(st.external_income || 0), 0), 0))}</td>
                                                <td colSpan={2}></td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {/* EXPENSES */}
                    {activeView === 'expenses' && (
                        <div className="space-y-4">
                            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                                <h3 className="font-bold text-slate-800 mb-4">Ngân sách Sateco vs Thực chi</h3>
                                <div className="grid grid-cols-3 gap-4 mb-4 text-center">
                                    <div><p className="text-xs text-slate-400 uppercase font-bold mb-1">Ngân sách khoán</p><p className="text-xl font-black text-indigo-600">{fmtB(plannedExpense)}</p></div>
                                    <div><p className="text-xs text-slate-400 uppercase font-bold mb-1">Đã chi thực tế</p><p className={`text-xl font-black ${expPct > 100 ? 'text-red-600' : 'text-orange-600'}`}>{fmtB(actualExpense)}</p></div>
                                    <div><p className="text-xs text-slate-400 uppercase font-bold mb-1">Còn lại / Vượt</p><p className={`text-xl font-black ${plannedExpense - actualExpense >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmtB(plannedExpense - actualExpense)}</p></div>
                                </div>
                                <div className="h-4 bg-slate-100 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full transition-all ${expPct > 100 ? 'bg-red-500' : expPct > 80 ? 'bg-orange-400' : 'bg-emerald-500'}`} style={{ width: `${Math.min(expPct, 100)}%` }}></div>
                                </div>
                                <p className="text-xs text-slate-400 mt-1 text-right">{expPct.toFixed(1)}% ngân sách đã sử dụng{expPct > 100 ? ' — ⚠️ Vượt ngân sách!' : ''}</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {[
                                    { title: `Vật tư MMTB (${materials.length})`, total: actualMat, data: materials, color: 'orange', cols: ['product_name', 'supplier_name', 'total_amount', 'paid_amount'], labels: ['Vật tư', 'NCC', 'Thành tiền', 'Đã TT'] },
                                    { title: `Nhân công / Thầu phụ (${labors.length})`, total: actualLabor, data: labors, color: 'purple', cols: ['team_name', 'payment_stage', 'approved_amount', 'paid_amount'], labels: ['Đội/Thầu phụ', 'Giai đoạn', 'Được duyệt', 'Đã TT'] },
                                    { title: `Phí khác (BCH, Vận hành...) (${expenses.length})`, total: actualGenExp, data: expenses, color: 'indigo', cols: ['expense_type', 'description', 'amount', 'paid_amount'], labels: ['Loại phí', 'Ghi chú', 'Đề nghị', 'Đã chi'] },
                                ].map(section => (
                                    <div key={section.title} className={`bg-white border border-${section.color}-200 rounded-2xl shadow-sm overflow-hidden`}>
                                        <div className={`px-4 py-3 bg-${section.color}-50 border-b border-${section.color}-100 flex justify-between Items-center`}>
                                            <span className={`font-bold text-${section.color}-700 text-sm`}>{section.title}</span>
                                            <span className={`font-black text-${section.color}-700`}>{fmtB(section.total)}</span>
                                        </div>
                                        <div className="max-h-64 overflow-y-auto">
                                            {section.data.length === 0 ? (
                                                <p className="text-center text-slate-400 py-8 text-sm">Chưa có dữ liệu</p>
                                            ) : (
                                                <table className="w-full text-xs">
                                                    <thead className="bg-slate-50 text-[10px] uppercase text-slate-400 font-bold sticky top-0">
                                                        <tr>
                                                            <th className="px-3 py-2 text-left">{section.labels[0]}</th>
                                                            <th className="px-3 py-2 text-right">{section.labels[2]}</th>
                                                            <th className="px-3 py-2 text-right">{section.labels[3]}</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-50">
                                                        {section.data.map(row => (
                                                            <tr key={row.id} className="hover:bg-slate-50/70">
                                                                <td className="px-3 py-2">
                                                                    <p className="font-medium text-slate-700 truncate max-w-[150px]">{row[section.cols[0]]}</p>
                                                                    <p className="text-slate-400 truncate">{row[section.cols[1]]}</p>
                                                                </td>
                                                                <td className={`px-3 py-2 text-right font-bold text-${section.color}-600`}>{fmt(row[section.cols[2]])}</td>
                                                                <td className="px-3 py-2 text-right text-emerald-600">{fmt(row[section.cols[3]])}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────
// ROOT: Shell điều khiển 2 level
// ─────────────────────────────────────────────
export default function PlanActualDashboard() {
    const [selected, setSelected] = useState(null);

    return (
        <div className="space-y-5 pb-10">
            {/* Header */}
            <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center shadow-sm shrink-0">
                    <span className="material-symbols-outlined notranslate text-[22px]" translate="no">analytics</span>
                </span>
                <div>
                    <h2 className="text-2xl font-black text-slate-800">Kế hoạch & Thực tế</h2>
                    <p className="text-sm text-slate-500">
                        {selected ? (
                            <>So sánh chi tiết dự án: <strong>{selected.name}</strong></>
                        ) : 'Tổng hợp tất cả dự án — Click vào dự án để xem chi tiết'}
                    </p>
                </div>
            </div>

            {selected ? (
                <ProjectDetail project={selected} onBack={() => setSelected(null)} />
            ) : (
                <AllProjectsSummary onSelect={(proj) => setSelected(proj)} />
            )}
        </div>
    );
}
