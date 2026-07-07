import { useMemo, useState, Fragment } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import Icon from './common/Icon';
import NumberInput from './common/NumberInput';
import SearchableSelect from './common/SearchableSelect';
import { smartToast } from '../utils/globalToast';
import { fmt } from '../utils/formatters';
import { exportToExcel } from '../utils/exportExcel';
import {
    CF_CATEGORIES, CF_LABEL, CF_PERM, IN_KEYS, OUT_KEYS, ALL_KEYS, OVERHEAD,
    aggregateActuals, aggregateActualsByProject, planToBuckets, planByProject,
    sumRows, rowTotal, toPeriods, rollingBalance,
} from '../lib/cashflow';

const MONTH_LABELS = Array.from({ length: 12 }, (_, i) => `T${i + 1}`);
const QUARTER_LABELS = ['Quý 1', 'Quý 2', 'Quý 3', 'Quý 4'];
const nowYear = new Date().getFullYear();
const YEARS = [nowYear - 2, nowYear - 1, nowYear, nowYear + 1];
const toM = (v) => fmt(Math.round((v || 0) / 1e6)); // triệu đồng
const EMPTY_DATA = {};
const ALL_PERMS = [...new Set(Object.values(CF_PERM))];

const Cell = ({ children, cls = '' }) => (
    <td className={`px-2 py-1.5 text-right tabular-nums font-mono text-[13px] whitespace-nowrap ${cls}`}>{children}</td>
);

function CatRow({ cat, tone, cols, period, mode, editable, expandable, isExpanded, onToggle, actual, planBuckets, primary, planVal, onEdit }) {
    const P = (arr) => toPeriods(arr, period);
    return (
        <tr className="border-b border-slate-100 dark:border-slate-700/30 hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
            <td className="sticky left-0 z-10 bg-white dark:bg-slate-800 px-3 py-1.5 text-[13px] text-slate-600 dark:text-slate-300 whitespace-nowrap">
                {expandable ? (
                    <button onClick={onToggle} className="flex items-center gap-1 hover:text-primary">
                        <Icon name={isExpanded ? 'expand_more' : 'chevron_right'} size={14} className="text-slate-400" />{CF_LABEL[cat]}
                    </button>
                ) : CF_LABEL[cat]}
            </td>
            {cols.map((c, i) => {
                if (editable) {
                    return (
                        <td key={c} className="px-1 py-1">
                            <NumberInput value={Math.round(planVal(cat, i) / 1e6)}
                                onChange={(v) => onEdit(cat, i, Number(v) || 0)}
                                className="w-[84px] text-right font-mono text-[12px] border border-slate-200 dark:border-slate-600 rounded px-1.5 py-1 bg-white dark:bg-slate-700" />
                        </td>
                    );
                }
                const av = P(actual[cat])[i] || 0;
                const pv = P(planBuckets[cat])[i] || 0;
                return (
                    <Cell key={c} cls={tone}>
                        {mode === 'compare'
                            ? <span>{toM(av)}<span className="block text-[10px] text-slate-400 font-normal">KH {toM(pv)}</span></span>
                            : toM(mode === 'plan' ? pv : av)}
                    </Cell>
                );
            })}
            <Cell cls={`${tone} font-bold bg-slate-50/60 dark:bg-slate-800/60`}>{toM(rowTotal(primary[cat]))}</Cell>
        </tr>
    );
}

function SubRow({ label, actualArr, planArr, cols, period, mode }) {
    const P = (a) => toPeriods(a, period);
    const primaryArr = mode === 'plan' ? planArr : actualArr;
    return (
        <tr className="bg-slate-50/40 dark:bg-slate-800/20 border-b border-slate-100 dark:border-slate-700/20">
            <td className="sticky left-0 z-10 bg-slate-50 dark:bg-slate-800/60 pl-8 pr-3 py-1 text-[12px] text-slate-500 dark:text-slate-400 whitespace-nowrap truncate max-w-[220px]" title={label}>↳ {label}</td>
            {cols.map((c, i) => {
                const av = P(actualArr)[i] || 0; const pv = P(planArr)[i] || 0;
                return (
                    <Cell key={c} cls="text-slate-500 dark:text-slate-400 text-[12px]">
                        {mode === 'compare'
                            ? <span>{toM(av)}<span className="block text-[9px] text-slate-400">KH {toM(pv)}</span></span>
                            : toM(mode === 'plan' ? pv : av)}
                    </Cell>
                );
            })}
            <Cell cls="text-slate-500 dark:text-slate-400 text-[12px] font-semibold bg-slate-50/60 dark:bg-slate-800/40">{toM(rowTotal(primaryArr))}</Cell>
        </tr>
    );
}

function TotalRow({ label, arr, tone, strong, cols, period }) {
    const P = (a) => toPeriods(a, period);
    return (
        <tr className={`border-b border-slate-200 dark:border-slate-700 ${strong ? 'bg-slate-100/80 dark:bg-slate-900/40' : 'bg-slate-50/50 dark:bg-slate-800/30'}`}>
            <td className={`sticky left-0 z-10 px-3 py-2 text-[13px] font-black whitespace-nowrap ${tone} ${strong ? 'bg-slate-100 dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-800'}`}>{label}</td>
            {cols.map((c, i) => <Cell key={c} cls={`font-black ${tone}`}>{toM(P(arr)[i])}</Cell>)}
            <Cell cls={`font-black ${tone} bg-slate-100/70 dark:bg-slate-900/50`}>{toM(rowTotal(arr))}</Cell>
        </tr>
    );
}

async function fetchAll(table, select, order) {
    const CHUNK = 1000; const all = [];
    for (let from = 0; ; from += CHUNK) {
        let q = supabase.from(table).select(select).range(from, from + CHUNK - 1);
        if (order) q = q.order(order);
        const { data, error } = await q;
        if (error) return all;
        all.push(...(data || []));
        if (!data || data.length < CHUNK) break;
    }
    return all;
}

export default function CashFlowPlan() {
    const { profile, hasPermission } = useAuth();
    const queryClient = useQueryClient();
    const isAdmin = profile?.role_code === 'ROLE01' || profile?.role_code === 'ADMIN';
    const canManageAll = isAdmin || hasPermission('manage_cashflow_plan');
    const canEditAny = canManageAll || ALL_PERMS.some(p => hasPermission(p));

    const [year, setYear] = useState(nowYear);
    const [projectId, setProjectId] = useState(null); // null=toàn cty | OVERHEAD | id
    const [period, setPeriod] = useState('month');
    const [mode, setMode] = useState('compare');
    const [edit, setEdit] = useState({});
    const [expanded, setExpanded] = useState({});
    const [saving, setSaving] = useState(false);

    const resetScope = (fn) => { fn(); setEdit({}); };
    const toggleCat = (c) => setExpanded(p => ({ ...p, [c]: !p[c] }));

    const { data, isLoading } = useQuery({
        queryKey: ['cashflow-data', year],
        queryFn: async () => {
            const [projects, payments, extHist, loans, loanPayments, expenses, expLabor, expMaterials, treasury, treasuryAcc, planRows, openingRows] = await Promise.all([
                fetchAll('projects', 'id, internal_code, code, name, acting_entity_key', 'name'),
                fetchAll('payments', 'id, project_id'),
                fetchAll('external_payment_history', 'payment_stage_id, payment_date, amount'),
                fetchAll('loans', 'id, project_id, loan_date, loan_amount'),
                fetchAll('loan_payments', 'loan_id, payment_date, principal_amount, interest_amount'),
                fetchAll('expenses', 'project_id, expense_type, paid_amount, paid_date, expense_date'),
                fetchAll('expense_labor', 'project_id, payment_date, request_date, paid_amount'),
                fetchAll('expense_materials', 'project_id, expense_date, paid_amount'),
                fetchAll('treasury_transactions', 'type, category, transaction_date, amount, project_id'),
                fetchAll('treasury_accounts', 'current_balance, status'),
                fetchAll('cash_flow_plan', '*'),
                fetchAll('cash_flow_opening', '*'),
            ]);
            return { projects, payments, extHist, loans, loanPayments, expenses, expLabor, expMaterials, treasury, treasuryAcc, planRows, openingRows };
        },
    });

    const d = data || EMPTY_DATA;
    const projName = useMemo(() => {
        const m = {}; for (const p of (d.projects || [])) m[p.id] = p.internal_code || p.code || p.name;
        m[OVERHEAD] = 'Chi phí chung (không theo dự án)';
        return m;
    }, [d.projects]);
    const projectOptions = useMemo(() => ([
        { id: '', label: 'Toàn công ty', subLabel: 'Tổng mọi dự án + chi phí chung' },
        { id: OVERHEAD, label: 'Chi phí chung (không theo dự án)', subLabel: 'Văn phòng, vận hành, thiết kế... không gắn dự án' },
        ...(d.projects || []).map(p => ({ id: p.id, label: p.internal_code || p.code || p.name, subLabel: p.name })),
    ]), [d.projects]);

    const actual = useMemo(() => aggregateActuals(d, { year, projectId }), [d, year, projectId]);
    const planBase = useMemo(() => planToBuckets(d.planRows, { year, projectId }), [d.planRows, year, projectId]);
    const actualByProj = useMemo(() => aggregateActualsByProject(d, { year }), [d, year]);
    const planByProj = useMemo(() => planByProject(d.planRows, { year }), [d.planRows, year]);

    const planVal = (cat, m) => { const k = `${cat}:${m}`; return k in edit ? edit[k] : (planBase[cat]?.[m] || 0); };
    const planBuckets = useMemo(() => {
        const b = {};
        for (const c of ALL_KEYS) b[c] = MONTH_LABELS.map((_, m) => (`${c}:${m}` in edit ? edit[`${c}:${m}`] : (planBase[c]?.[m] || 0)));
        return b;
    }, [planBase, edit]);

    const opening = useMemo(() => {
        const row = (d.openingRows || []).find(o => o.year === year && (projectId && projectId !== OVERHEAD ? o.project_id === projectId : !o.project_id));
        if (row) return Number(row.opening_balance) || 0;
        if (projectId == null) return (d.treasuryAcc || []).filter(a => a.status !== 'closed').reduce((s, a) => s + (Number(a.current_balance) || 0), 0);
        return 0;
    }, [d.openingRows, d.treasuryAcc, year, projectId]);

    const primary = mode === 'plan' ? planBuckets : actual;
    const totalIn = sumRows(primary, IN_KEYS);
    const totalOut = sumRows(primary, OUT_KEYS);
    const { net, closing } = rollingBalance(totalIn, totalOut, opening);

    const cols = period === 'month' ? MONTH_LABELS : period === 'quarter' ? QUARTER_LABELS : ['Cả năm'];
    const closingByPeriod = useMemo(() => {
        if (period === 'year') return [closing[11]];
        if (period === 'quarter') return [2, 5, 8, 11].map(i => closing[i]);
        return closing;
    }, [closing, period]);

    // Sửa được khi: chế độ Kế hoạch + Tháng + đã chọn 1 dự án hoặc Chi phí chung (không phải Toàn công ty)
    const baseEditable = mode === 'plan' && period === 'month' && projectId != null;
    const catEditable = (cat) => baseEditable && (canManageAll || hasPermission(CF_PERM[cat]));
    const expandable = projectId == null; // chỉ bung theo dự án ở chế độ Toàn công ty
    const onEdit = (cat, m, valM) => setEdit(prev => ({ ...prev, [`${cat}:${m}`]: valM * 1e6 }));

    // Danh sách dự án đóng góp vào 1 hạng mục (để bung dòng con)
    const projKeysFor = (cat) => {
        const s = new Set([...Object.keys(actualByProj[cat] || {}), ...Object.keys(planByProj[cat] || {})]);
        return [...s].sort((a, b) => (a === OVERHEAD ? 1 : b === OVERHEAD ? -1 : (projName[a] || '').localeCompare(projName[b] || '')));
    };
    const z12 = Array(12).fill(0);

    const save = async () => {
        setSaving(true);
        try {
            const saveProj = projectId === OVERHEAD ? null : projectId;
            let del = supabase.from('cash_flow_plan').delete().eq('year', year);
            del = saveProj ? del.eq('project_id', saveProj) : del.is('project_id', null);
            const { error: delErr } = await del;
            if (delErr) throw delErr;
            const rows = [];
            for (const [dir, keys] of [['in', IN_KEYS], ['out', OUT_KEYS]]) {
                for (const cat of keys) {
                    for (let m = 0; m < 12; m++) {
                        const amt = planVal(cat, m);
                        if (amt > 0) rows.push({ project_id: saveProj, year, month: m + 1, direction: dir, category: cat, planned_amount: amt });
                    }
                }
            }
            if (rows.length) { const { error } = await supabase.from('cash_flow_plan').insert(rows); if (error) throw error; }
            setEdit({});
            queryClient.invalidateQueries({ queryKey: ['cashflow-data', year] });
            smartToast('Đã lưu kế hoạch dòng tiền!');
        } catch (err) {
            smartToast('Lỗi lưu: ' + (err.message || 'chưa tạo bảng cash_flow_plan?'));
        } finally { setSaving(false); }
    };

    const doExport = () => {
        const P = (arr) => toPeriods(arr, period);
        const columns = [{ key: 'Hạng mục', label: 'Hạng mục' }, ...cols.map(c => ({ key: c, label: c, format: 'number' })), { key: 'Tổng', label: 'Tổng (triệu)', format: 'number' }];
        const rowsX = [];
        const push = (label, arr) => { const r = { 'Hạng mục': label }; cols.forEach((c, i) => { r[c] = Math.round((P(arr)[i] || 0) / 1e6); }); r['Tổng'] = Math.round(rowTotal(arr) / 1e6); rowsX.push(r); };
        CF_CATEGORIES.in.forEach(c => push('[THU] ' + c.label, primary[c.key]));
        push('TỔNG THU', totalIn);
        CF_CATEGORIES.out.forEach(c => push('[CHI] ' + c.label, primary[c.key]));
        push('TỔNG CHI', totalOut);
        push('DÒNG TIỀN RÒNG', net);
        exportToExcel(rowsX, columns, `KeHoachDongTien_${year}`, 'DongTien');
    };

    const renderSection = (list, tone) => list.map(c => (
        <Fragment key={c.key}>
            <CatRow cat={c.key} tone={tone} cols={cols} period={period} mode={mode}
                editable={catEditable(c.key)} expandable={expandable} isExpanded={!!expanded[c.key]} onToggle={() => toggleCat(c.key)}
                actual={actual} planBuckets={planBuckets} primary={primary} planVal={planVal} onEdit={onEdit} />
            {expandable && expanded[c.key] && projKeysFor(c.key).map(pk => (
                <SubRow key={pk} label={projName[pk] || pk} cols={cols} period={period} mode={mode}
                    actualArr={actualByProj[c.key]?.[pk] || z12} planArr={planByProj[c.key]?.[pk] || z12} />
            ))}
        </Fragment>
    ));

    return (
        <div className="p-4 md:p-6 space-y-4">
            <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-3 shadow-sm">
                <div className="flex items-center gap-2">
                    <Icon name="savings" size={20} className="text-primary" />
                    <h2 className="text-base font-black text-slate-800 dark:text-white">Kế hoạch Dòng tiền</h2>
                </div>
                <div className="w-px h-6 bg-slate-200 dark:bg-slate-600 hidden md:block" />
                <select value={year} onChange={e => resetScope(() => setYear(Number(e.target.value)))}
                    className="text-sm font-bold border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700">
                    {YEARS.map(y => <option key={y} value={y}>Năm {y}</option>)}
                </select>
                <div className="w-[260px]">
                    <SearchableSelect options={projectOptions} value={projectId || ''}
                        onChange={(id) => resetScope(() => setProjectId(id || null))} placeholder="Toàn công ty" />
                </div>
                <div className="flex rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden text-sm font-bold">
                    {[['month', 'Tháng'], ['quarter', 'Quý'], ['year', 'Năm']].map(([v, l]) => (
                        <button key={v} onClick={() => setPeriod(v)} className={`px-3 py-2 ${period === v ? 'bg-primary text-white' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>{l}</button>
                    ))}
                </div>
                <div className="flex rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden text-sm font-bold">
                    {[['compare', 'So sánh'], ['actual', 'Thực tế'], ['plan', 'Kế hoạch']].map(([v, l]) => (
                        <button key={v} onClick={() => setMode(v)} className={`px-3 py-2 ${mode === v ? 'bg-primary text-white' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>{l}</button>
                    ))}
                </div>
                <div className="flex-1" />
                <span className="text-[11px] text-slate-400 font-bold">ĐVT: triệu đồng</span>
                {baseEditable && canEditAny && (
                    <button onClick={save} disabled={saving} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-lg text-sm font-bold flex items-center gap-1.5">
                        <Icon name={saving ? 'progress_activity' : 'save'} size={16} />{saving ? 'Đang lưu...' : 'Lưu kế hoạch'}
                    </button>
                )}
                <button onClick={doExport} className="px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                    <Icon name="download" size={16} />Excel
                </button>
            </div>

            {mode === 'plan' && canEditAny && projectId == null && (
                <div className="text-[12px] text-amber-600 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2">Để <b>nhập kế hoạch</b>: chọn <b>1 dự án</b> hoặc <b>Chi phí chung</b> ở ô lọc (Toàn công ty chỉ để xem tổng). Mỗi bộ phận chỉ sửa được hạng mục thuộc quyền của mình.</div>
            )}
            {mode === 'plan' && canEditAny && projectId != null && period !== 'month' && (
                <div className="text-[12px] text-amber-600 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2">Chỉ nhập kế hoạch ở chế độ <b>Tháng</b>. Quý/Năm là số cộng dồn.</div>
            )}

            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-auto max-h-[70vh]">
                {isLoading ? (
                    <div className="p-10 text-center text-slate-400">Đang tải dữ liệu dòng tiền...</div>
                ) : (
                    <table className="w-full border-collapse">
                        <thead className="sticky top-0 z-20">
                            <tr className="bg-slate-100 dark:bg-slate-900 text-[11px] font-black uppercase tracking-wider text-slate-500">
                                <th className="sticky left-0 z-30 bg-slate-100 dark:bg-slate-900 px-3 py-2.5 text-left">Hạng mục{expandable ? ' (bấm ▸ xem theo dự án)' : ''}</th>
                                {cols.map(c => <th key={c} className="px-2 py-2.5 text-right min-w-[84px]">{c}</th>)}
                                <th className="px-2 py-2.5 text-right bg-slate-200/60 dark:bg-slate-900">Tổng</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr className="bg-emerald-50/60 dark:bg-emerald-900/10"><td className="sticky left-0 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 text-[11px] font-black text-emerald-700 uppercase tracking-widest" colSpan={cols.length + 2}>▸ Dòng tiền THU</td></tr>
                            {renderSection(CF_CATEGORIES.in, 'text-emerald-700 dark:text-emerald-400')}
                            <TotalRow label="TỔNG THU" arr={totalIn} tone="text-emerald-700 dark:text-emerald-400" cols={cols} period={period} />

                            <tr className="bg-rose-50/60 dark:bg-rose-900/10"><td className="sticky left-0 bg-rose-50 dark:bg-rose-900/20 px-3 py-1.5 text-[11px] font-black text-rose-700 uppercase tracking-widest" colSpan={cols.length + 2}>▸ Dòng tiền CHI</td></tr>
                            {renderSection(CF_CATEGORIES.out, 'text-rose-700 dark:text-rose-400')}
                            <TotalRow label="TỔNG CHI" arr={totalOut} tone="text-rose-700 dark:text-rose-400" cols={cols} period={period} />

                            <TotalRow label="DÒNG TIỀN RÒNG" arr={net} tone="text-slate-800 dark:text-white" strong cols={cols} period={period} />
                            <tr className="bg-slate-100/80 dark:bg-slate-900/40 border-t-2 border-slate-300 dark:border-slate-600">
                                <td className="sticky left-0 z-10 bg-slate-100 dark:bg-slate-900 px-3 py-2 text-[13px] font-black text-slate-800 dark:text-white whitespace-nowrap">SỐ DƯ CUỐI KỲ</td>
                                {closingByPeriod.map((v, i) => (
                                    <Cell key={i} cls={`font-black ${v < 0 ? 'text-rose-600' : 'text-blue-700 dark:text-blue-400'}`}>
                                        {v < 0 && <Icon name="warning" size={12} className="inline mr-0.5 -mt-0.5" />}{toM(v)}
                                    </Cell>
                                ))}
                                <Cell cls="font-black text-blue-700 dark:text-blue-400 bg-slate-100/70 dark:bg-slate-900/50">{toM(closing[11])}</Cell>
                            </tr>
                        </tbody>
                    </table>
                )}
            </div>
            <p className="text-[11px] text-slate-400">
                Số dư đầu kỳ: <b className="font-mono">{toM(opening)}</b> triệu đ {projectId == null ? '(tổng Sổ quỹ)' : projectId === OVERHEAD ? '(chi phí chung)' : '(dự án)'} · Thực tế theo ngày tiền ra/vào (cash basis).
            </p>
        </div>
    );
}
