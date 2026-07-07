import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import Icon from './common/Icon';
import NumberInput from './common/NumberInput';
import { smartToast } from '../utils/globalToast';
import { fmt } from '../utils/formatters';
import { exportToExcel } from '../utils/exportExcel';
import { planByProject, rowTotal } from '../lib/cashflow';

// Màn nhập KẾ HOẠCH VẬT LIỆU riêng cho bộ phận vật tư.
// Chỉ đọc/ghi cash_flow_plan category='material' (direction='out') — KHÔNG lộ các hạng mục
// tài chính khác (thu dự án, vay, nhân công, số dư quỹ...). Cùng bảng với Kế hoạch Dòng tiền
// nên số liệu tự khớp: kế toán/BGĐ mở bản full vẫn thấy đúng con số vật tư nhập ở đây.

const MONTH_LABELS = Array.from({ length: 12 }, (_, i) => `T${i + 1}`);
const nowYear = new Date().getFullYear();
const YEARS = [nowYear - 2, nowYear - 1, nowYear, nowYear + 1];
const toM = (v) => fmt(Math.round((v || 0) / 1e6)); // hiển thị triệu đồng

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

export default function MaterialPlan() {
    const { profile, hasPermission } = useAuth();
    const queryClient = useQueryClient();
    const isAdmin = profile?.role_code === 'ROLE01' || profile?.role_code === 'ADMIN';
    const canEdit = isAdmin || hasPermission('manage_materials_tracking');

    const [year, setYear] = useState(nowYear);
    const [edit, setEdit] = useState({}); // `${projId}:${m}` -> đồng
    const [saving, setSaving] = useState(false);

    const { data, isLoading } = useQuery({
        queryKey: ['material-plan', year],
        queryFn: async () => {
            const [projects, planRows] = await Promise.all([
                fetchAll('projects', 'id, internal_code, code, name, status', 'name'),
                fetchAll('cash_flow_plan', 'project_id, year, month, category, planned_amount'),
            ]);
            return { projects, planRows };
        },
    });

    const projects = useMemo(() => {
        const list = (data?.projects || []).filter(p => p.status !== 'archived' && p.status !== 'closed');
        return list.length ? list : (data?.projects || []);
    }, [data?.projects]);

    // KH vật liệu hiện có, tách theo dự án: { projId: number[12] }
    const planMat = useMemo(() => {
        const by = planByProject(data?.planRows, { year });
        return by.material || {};
    }, [data?.planRows, year]);

    const val = (pid, m) => { const k = `${pid}:${m}`; return k in edit ? edit[k] : (planMat[pid]?.[m] || 0); };
    const onEdit = (pid, m, valM) => setEdit(prev => ({ ...prev, [`${pid}:${m}`]: (Number(valM) || 0) * 1e6 }));

    const projRow = (pid) => MONTH_LABELS.map((_, m) => val(pid, m));
    const projTotal = (pid) => rowTotal(projRow(pid));
    const colTotal = (m) => projects.reduce((s, p) => s + val(p.id, m), 0);
    const grandTotal = projects.reduce((s, p) => s + projTotal(p.id), 0);
    const dirty = Object.keys(edit).length > 0;

    const save = async () => {
        setSaving(true);
        try {
            // Chỉ xoá KH vật liệu theo dự án (project_id != null) của năm này — GIỮ NGUYÊN
            // các hạng mục khác và material overhead (project_id null).
            const { error: delErr } = await supabase.from('cash_flow_plan')
                .delete().eq('year', year).eq('category', 'material').not('project_id', 'is', null);
            if (delErr) throw delErr;
            const rows = [];
            for (const p of projects) {
                for (let m = 0; m < 12; m++) {
                    const amt = val(p.id, m);
                    if (amt > 0) rows.push({ project_id: p.id, year, month: m + 1, direction: 'out', category: 'material', planned_amount: amt });
                }
            }
            if (rows.length) { const { error } = await supabase.from('cash_flow_plan').insert(rows); if (error) throw error; }
            setEdit({});
            queryClient.invalidateQueries({ queryKey: ['material-plan', year] });
            queryClient.invalidateQueries({ queryKey: ['cashflow-data', year] }); // đồng bộ màn dòng tiền full
            smartToast('Đã lưu kế hoạch vật liệu!');
        } catch (err) {
            smartToast('Lỗi lưu: ' + (err.message || 'chưa tạo bảng cash_flow_plan?'));
        } finally { setSaving(false); }
    };

    const doExport = () => {
        const columns = [{ key: 'Dự án', label: 'Dự án' }, ...MONTH_LABELS.map(c => ({ key: c, label: c, format: 'number' })), { key: 'Tổng', label: 'Tổng (triệu)', format: 'number' }];
        const rowsX = projects.map(p => {
            const r = { 'Dự án': p.internal_code || p.code || p.name };
            MONTH_LABELS.forEach((c, m) => { r[c] = Math.round(val(p.id, m) / 1e6); });
            r['Tổng'] = Math.round(projTotal(p.id) / 1e6);
            return r;
        });
        const totalRow = { 'Dự án': 'TỔNG' };
        MONTH_LABELS.forEach((c, m) => { totalRow[c] = Math.round(colTotal(m) / 1e6); });
        totalRow['Tổng'] = Math.round(grandTotal / 1e6);
        rowsX.push(totalRow);
        exportToExcel(rowsX, columns, `KeHoachVatLieu_${year}`, 'VatLieu');
    };

    return (
        <div className="p-4 md:p-6 space-y-4">
            <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-3 shadow-sm">
                <div className="flex items-center gap-2">
                    <Icon name="inventory_2" size={20} className="text-primary" />
                    <h2 className="text-base font-black text-slate-800 dark:text-white">Kế hoạch Vật liệu</h2>
                </div>
                <div className="w-px h-6 bg-slate-200 dark:bg-slate-600 hidden md:block" />
                <select value={year} onChange={e => { setYear(Number(e.target.value)); setEdit({}); }}
                    className="text-sm font-bold border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700">
                    {YEARS.map(y => <option key={y} value={y}>Năm {y}</option>)}
                </select>
                <div className="flex-1" />
                <span className="text-[11px] text-slate-400 font-bold">ĐVT: triệu đồng</span>
                {canEdit && (
                    <button onClick={save} disabled={saving || !dirty} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-lg text-sm font-bold flex items-center gap-1.5">
                        <Icon name={saving ? 'progress_activity' : 'save'} size={16} />{saving ? 'Đang lưu...' : 'Lưu kế hoạch'}
                    </button>
                )}
                <button onClick={doExport} className="px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                    <Icon name="download" size={16} />Excel
                </button>
            </div>

            <div className="text-[12px] text-slate-500 bg-slate-50 dark:bg-slate-800/40 rounded-lg px-3 py-2">
                Nhập <b>kế hoạch chi vật liệu</b> theo từng dự án × tháng (triệu đồng). Số liệu này ghép thẳng vào Kế hoạch Dòng tiền của công ty ở hạng mục <b>Vật liệu</b>.
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-auto max-h-[70vh]">
                {isLoading ? (
                    <div className="p-10 text-center text-slate-400">Đang tải danh sách dự án...</div>
                ) : (
                    <table className="w-full border-collapse">
                        <thead className="sticky top-0 z-20">
                            <tr className="bg-slate-100 dark:bg-slate-900 text-[11px] font-black uppercase tracking-wider text-slate-500">
                                <th className="sticky left-0 z-30 bg-slate-100 dark:bg-slate-900 px-3 py-2.5 text-left min-w-[200px]">Dự án</th>
                                {MONTH_LABELS.map(c => <th key={c} className="px-2 py-2.5 text-right min-w-[84px]">{c}</th>)}
                                <th className="px-2 py-2.5 text-right bg-slate-200/60 dark:bg-slate-900">Tổng</th>
                            </tr>
                        </thead>
                        <tbody>
                            {projects.map(p => (
                                <tr key={p.id} className="border-b border-slate-100 dark:border-slate-700/30 hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                                    <td className="sticky left-0 z-10 bg-white dark:bg-slate-800 px-3 py-1.5 text-[13px] text-slate-600 dark:text-slate-300 whitespace-nowrap truncate max-w-[240px]" title={p.name}>
                                        {p.internal_code || p.code || p.name}
                                    </td>
                                    {MONTH_LABELS.map((c, m) => (
                                        <td key={c} className="px-1 py-1">
                                            {canEdit ? (
                                                <NumberInput value={Math.round(val(p.id, m) / 1e6)}
                                                    onChange={(v) => onEdit(p.id, m, v)}
                                                    className="w-[84px] text-right font-mono text-[12px] border border-slate-200 dark:border-slate-600 rounded px-1.5 py-1 bg-white dark:bg-slate-700" />
                                            ) : (
                                                <span className="block text-right font-mono text-[13px] px-1.5">{toM(val(p.id, m))}</span>
                                            )}
                                        </td>
                                    ))}
                                    <td className="px-2 py-1.5 text-right tabular-nums font-mono text-[13px] font-bold bg-slate-50/60 dark:bg-slate-800/60">{toM(projTotal(p.id))}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="sticky bottom-0 z-20">
                            <tr className="bg-slate-100/90 dark:bg-slate-900/60 border-t-2 border-slate-300 dark:border-slate-600">
                                <td className="sticky left-0 z-10 bg-slate-100 dark:bg-slate-900 px-3 py-2 text-[13px] font-black text-slate-800 dark:text-white whitespace-nowrap">TỔNG VẬT LIỆU</td>
                                {MONTH_LABELS.map((c, m) => (
                                    <td key={c} className="px-2 py-2 text-right tabular-nums font-mono text-[13px] font-black text-rose-700 dark:text-rose-400">{toM(colTotal(m))}</td>
                                ))}
                                <td className="px-2 py-2 text-right tabular-nums font-mono text-[13px] font-black text-rose-700 dark:text-rose-400 bg-slate-100/70 dark:bg-slate-900/50">{toM(grandTotal)}</td>
                            </tr>
                        </tfoot>
                    </table>
                )}
            </div>
            <p className="text-[11px] text-slate-400">
                Chỉ hiển thị hạng mục Vật liệu. Bộ phận vật tư nhập kế hoạch tại đây; kế toán/ban giám đốc xem tổng hợp ở màn Kế hoạch Dòng tiền.
            </p>
        </div>
    );
}
