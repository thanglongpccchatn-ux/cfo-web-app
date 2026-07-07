import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import Icon from './common/Icon';
import NumberInput from './common/NumberInput';
import SearchableSelect from './common/SearchableSelect';
import { smartToast } from '../utils/globalToast';
import { fmt } from '../utils/formatters';
import { exportToExcel } from '../utils/exportExcel';
import { materialPlanByGroup, rowTotal, NO_GROUP } from '../lib/cashflow';

// Màn nhập KẾ HOẠCH VẬT LIỆU cho bộ phận vật tư — theo DỰ ÁN × NHÓM VẬT TƯ × THÁNG.
// Khung trái: danh sách dự án + trạng thái Đã lập/Chưa lập (chống bỏ sót). Khung phải: lưới nhập.
// Ghi cash_flow_plan (category='material', direction='out', sub_category=mã nhóm).

const MONTH_LABELS = Array.from({ length: 12 }, (_, i) => `T${i + 1}`);
const nowYear = new Date().getFullYear();
const YEARS = [nowYear - 2, nowYear - 1, nowYear, nowYear + 1];
const toM = (v) => fmt(Math.round((v || 0) / 1e6)); // triệu đồng
// Dự án CẦN lập kế hoạch vật liệu (đang chạy). "Đã hoàn thành" mặc định ẩn.
const ACTIVE_STATUSES = ['Đang thi công', 'Bảo hành'];

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
    const [projectId, setProjectId] = useState('');
    const [showAll, setShowAll] = useState(false);   // hiện cả dự án đã hoàn thành
    const [q, setQ] = useState('');                  // tìm dự án
    const [addedGroups, setAddedGroups] = useState([]);
    const [edit, setEdit] = useState({});
    const [saving, setSaving] = useState(false);

    const resetProject = (id) => { setProjectId(id); setEdit({}); setAddedGroups([]); };

    const { data, isLoading } = useQuery({
        queryKey: ['material-plan', year],
        queryFn: async () => {
            const [projects, categories, materials, planRows] = await Promise.all([
                fetchAll('projects', 'id, internal_code, code, name, status', 'name'),
                fetchAll('material_categories', 'code, name', 'name'),
                fetchAll('materials', 'category_code'),
                fetchAll('cash_flow_plan', 'project_id, year, month, category, sub_category, planned_amount'),
            ]);
            return { projects, categories, materials, planRows };
        },
    });

    // Tổng KH vật liệu năm nay theo dự án -> để đánh dấu "Đã lập"
    const plannedByProject = useMemo(() => {
        const m = {};
        for (const r of (data?.planRows || [])) {
            if (r.category !== 'material' || r.year !== year) continue;
            m[r.project_id] = (m[r.project_id] || 0) + (Number(r.planned_amount) || 0);
        }
        return m;
    }, [data?.planRows, year]);

    const catName = useMemo(() => {
        const m = {}; for (const c of (data?.categories || [])) m[c.code] = c.name;
        m[NO_GROUP] = 'Chưa phân nhóm';
        return m;
    }, [data?.categories]);

    // Danh sách dự án ở khung trái: mặc định chỉ dự án đang chạy; có thể xem tất cả.
    const listProjects = useMemo(() => {
        const kw = q.trim().toLowerCase();
        return (data?.projects || [])
            .filter(p => showAll || ACTIVE_STATUSES.includes(p.status))
            .filter(p => !kw || `${p.internal_code || ''} ${p.code || ''} ${p.name || ''}`.toLowerCase().includes(kw))
            .sort((a, b) => {
                const da = (plannedByProject[a.id] || 0) > 0 ? 1 : 0;
                const db = (plannedByProject[b.id] || 0) > 0 ? 1 : 0;
                if (da !== db) return da - db; // "Chưa lập" lên trên
                return (a.internal_code || a.name || '').localeCompare(b.internal_code || b.name || '', 'vi');
            });
    }, [data?.projects, showAll, q, plannedByProject]);

    const needList = useMemo(
        () => (data?.projects || []).filter(p => ACTIVE_STATUSES.includes(p.status)),
        [data?.projects]
    );
    const doneCount = needList.filter(p => (plannedByProject[p.id] || 0) > 0).length;

    const selProject = useMemo(
        () => (data?.projects || []).find(p => p.id === projectId),
        [data?.projects, projectId]
    );

    // Nhóm lấy từ DANH MỤC VẬT TƯ: chỉ nhóm thực sự có vật tư (distinct category_code).
    const catalogGroups = useMemo(() => {
        const codes = [...new Set((data?.materials || []).map(m => m.category_code).filter(Boolean))];
        return codes.map(code => ({ id: code, label: catName[code] || code }))
            .sort((a, b) => a.label.localeCompare(b.label, 'vi'));
    }, [data?.materials, catName]);

    const existing = useMemo(
        () => (projectId ? materialPlanByGroup(data?.planRows, { year, projectId }) : {}),
        [data?.planRows, year, projectId]
    );
    const groupRows = useMemo(() => {
        const set = new Set([...Object.keys(existing), ...addedGroups]);
        return [...set].sort((a, b) => (catName[a] || a).localeCompare(catName[b] || b, 'vi'));
    }, [existing, addedGroups, catName]);
    const addableGroups = useMemo(() => {
        const used = new Set(groupRows);
        return catalogGroups.filter(g => !used.has(g.id));
    }, [catalogGroups, groupRows]);

    const val = (g, m) => { const k = `${g}:${m}`; return k in edit ? edit[k] : (existing[g]?.[m] || 0); };
    const onEdit = (g, m, valM) => setEdit(prev => ({ ...prev, [`${g}:${m}`]: (Number(valM) || 0) * 1e6 }));
    const addGroup = (code) => { if (code && !groupRows.includes(code)) setAddedGroups(prev => [...prev, code]); };
    const clearRow = (g) => setEdit(prev => {
        const next = { ...prev };
        for (let m = 0; m < 12; m++) next[`${g}:${m}`] = 0;
        return next;
    });

    const groupRow = (g) => MONTH_LABELS.map((_, m) => val(g, m));
    const groupTotal = (g) => rowTotal(groupRow(g));
    const colTotal = (m) => groupRows.reduce((s, g) => s + val(g, m), 0);
    const grandTotal = groupRows.reduce((s, g) => s + groupTotal(g), 0);
    const dirty = Object.keys(edit).length > 0;

    const save = async () => {
        if (!projectId) return;
        setSaving(true);
        try {
            const { error: delErr } = await supabase.from('cash_flow_plan')
                .delete().eq('project_id', projectId).eq('year', year).eq('category', 'material');
            if (delErr) throw delErr;
            const rows = [];
            for (const g of groupRows) {
                for (let m = 0; m < 12; m++) {
                    const amt = val(g, m);
                    if (amt > 0) rows.push({
                        project_id: projectId, year, month: m + 1, direction: 'out',
                        category: 'material', sub_category: g === NO_GROUP ? null : g, planned_amount: amt,
                    });
                }
            }
            if (rows.length) { const { error } = await supabase.from('cash_flow_plan').insert(rows); if (error) throw error; }
            setEdit({});
            queryClient.invalidateQueries({ queryKey: ['material-plan', year] });
            queryClient.invalidateQueries({ queryKey: ['cashflow-data', year] });
            smartToast('Đã lưu kế hoạch vật liệu!');
        } catch (err) {
            smartToast('Lỗi lưu: ' + (err.message || 'thiếu cột sub_category? chạy SQL alter table.'));
        } finally { setSaving(false); }
    };

    const doExport = () => {
        const columns = [{ key: 'Nhóm vật tư', label: 'Nhóm vật tư' }, ...MONTH_LABELS.map(c => ({ key: c, label: c, format: 'number' })), { key: 'Tổng', label: 'Tổng (triệu)', format: 'number' }];
        const rowsX = groupRows.map(g => {
            const r = { 'Nhóm vật tư': catName[g] || g };
            MONTH_LABELS.forEach((c, m) => { r[c] = Math.round(val(g, m) / 1e6); });
            r['Tổng'] = Math.round(groupTotal(g) / 1e6);
            return r;
        });
        exportToExcel(rowsX, columns, `KeHoachVatLieu_${selProject?.internal_code || selProject?.code || 'DA'}_${year}`, 'VatLieu');
    };

    return (
        <div className="p-4 md:p-6 space-y-4">
            <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-3 shadow-sm">
                <div className="flex items-center gap-2">
                    <Icon name="inventory_2" size={20} className="text-primary" />
                    <h2 className="text-base font-black text-slate-800 dark:text-white">Kế hoạch Vật liệu</h2>
                </div>
                <div className="w-px h-6 bg-slate-200 dark:bg-slate-600 hidden md:block" />
                <select value={year} onChange={e => { setYear(Number(e.target.value)); resetProject(''); }}
                    className="text-sm font-bold border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700">
                    {YEARS.map(y => <option key={y} value={y}>Năm {y}</option>)}
                </select>
                <span className="text-[13px] font-bold text-slate-500">
                    Đã lập <b className="text-emerald-600">{doneCount}</b>/<b>{needList.length}</b> dự án đang chạy
                </span>
                <div className="flex-1" />
                <span className="text-[11px] text-slate-400 font-bold">ĐVT: triệu đồng</span>
                {canEdit && projectId && (
                    <button onClick={save} disabled={saving || !dirty} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-lg text-sm font-bold flex items-center gap-1.5">
                        <Icon name={saving ? 'progress_activity' : 'save'} size={16} />{saving ? 'Đang lưu...' : 'Lưu kế hoạch'}
                    </button>
                )}
                {projectId && (
                    <button onClick={doExport} className="px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                        <Icon name="download" size={16} />Excel
                    </button>
                )}
            </div>

            <div className="flex flex-col lg:flex-row gap-4">
                {/* KHUNG TRÁI: danh sách dự án + trạng thái */}
                <div className="lg:w-80 shrink-0 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col max-h-[74vh]">
                    <div className="p-3 border-b border-slate-100 dark:border-slate-700 space-y-2">
                        <div className="relative">
                            <Icon name="search" size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Tìm dự án..."
                                className="w-full text-[13px] border border-slate-200 dark:border-slate-600 rounded-lg pl-8 pr-2 py-1.5 bg-white dark:bg-slate-700" />
                        </div>
                        <label className="flex items-center gap-1.5 text-[12px] text-slate-500 font-semibold cursor-pointer select-none">
                            <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} className="accent-primary" />
                            Hiện cả dự án đã hoàn thành
                        </label>
                    </div>
                    <div className="overflow-auto flex-1 p-1.5">
                        {isLoading ? (
                            <div className="p-6 text-center text-slate-400 text-sm">Đang tải...</div>
                        ) : listProjects.length === 0 ? (
                            <div className="p-6 text-center text-slate-400 text-sm">Không có dự án.</div>
                        ) : listProjects.map(p => {
                            const total = plannedByProject[p.id] || 0;
                            const done = total > 0;
                            const active = p.id === projectId;
                            return (
                                <button key={p.id} onClick={() => resetProject(p.id)}
                                    className={`w-full text-left px-2.5 py-2 rounded-lg mb-0.5 transition-colors flex items-start gap-2 ${active ? 'bg-primary/10 dark:bg-primary/20 ring-1 ring-primary/30' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}>
                                    <Icon name={done ? 'check_circle' : 'radio_button_unchecked'} size={16}
                                        className={done ? 'text-emerald-500 mt-0.5' : 'text-amber-400 mt-0.5'} />
                                    <span className="min-w-0 flex-1">
                                        <span className="block text-[13px] font-bold text-slate-700 dark:text-slate-200 truncate">{p.internal_code || p.code || p.name}</span>
                                        <span className="block text-[11px] text-slate-400 truncate">{p.name}</span>
                                        <span className={`text-[11px] font-semibold ${done ? 'text-emerald-600' : 'text-amber-500'}`}>
                                            {done ? `Đã lập · ${toM(total)} tr` : 'Chưa lập'}
                                            {!ACTIVE_STATUSES.includes(p.status) && <span className="text-slate-400 font-normal"> · {p.status}</span>}
                                        </span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* KHUNG PHẢI: lưới nhập cho dự án đang chọn */}
                <div className="flex-1 min-w-0 space-y-3">
                    {!projectId ? (
                        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-12 text-center">
                            <Icon name="touch_app" size={40} className="text-slate-300 mx-auto mb-3" />
                            <p className="text-slate-500 font-semibold">Chọn một <b>dự án</b> ở danh sách bên trái để lập kế hoạch vật liệu.</p>
                            <p className="text-slate-400 text-[12px] mt-1">Dấu <span className="text-amber-500 font-bold">○ Chưa lập</span> là dự án chưa có kế hoạch — ưu tiên làm trước.</p>
                        </div>
                    ) : (
                        <>
                            <div className="flex flex-wrap items-center gap-3">
                                <div className="text-[13px] font-bold text-slate-700 dark:text-slate-200 flex-1 min-w-[200px] truncate">
                                    {selProject?.internal_code || selProject?.code} — <span className="font-normal text-slate-500">{selProject?.name}</span>
                                </div>
                                {canEdit && (
                                    <div className="w-[280px]">
                                        <SearchableSelect options={addableGroups} value=""
                                            onChange={addGroup} placeholder="+ Thêm nhóm vật tư..." />
                                    </div>
                                )}
                            </div>

                            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-auto max-h-[64vh]">
                                {groupRows.length === 0 ? (
                                    <div className="p-12 text-center text-slate-400">
                                        Chưa có nhóm nào. Dùng ô <b>“+ Thêm nhóm vật tư”</b> ở trên để bắt đầu nhập. Tháng nào cần thì nhập tháng đó.
                                    </div>
                                ) : (
                                    <table className="w-full border-collapse">
                                        <thead className="sticky top-0 z-20">
                                            <tr className="bg-slate-100 dark:bg-slate-900 text-[11px] font-black uppercase tracking-wider text-slate-500">
                                                <th className="sticky left-0 z-30 bg-slate-100 dark:bg-slate-900 px-3 py-2.5 text-left min-w-[200px]">Nhóm vật tư</th>
                                                {MONTH_LABELS.map(c => <th key={c} className="px-2 py-2.5 text-right min-w-[76px]">{c}</th>)}
                                                <th className="px-2 py-2.5 text-right bg-slate-200/60 dark:bg-slate-900">Tổng</th>
                                                {canEdit && <th className="px-2 py-2.5 w-8"></th>}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {groupRows.map(g => (
                                                <tr key={g} className="border-b border-slate-100 dark:border-slate-700/30 hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                                                    <td className="sticky left-0 z-10 bg-white dark:bg-slate-800 px-3 py-1.5 text-[13px] text-slate-600 dark:text-slate-300 whitespace-nowrap truncate max-w-[240px]" title={catName[g] || g}>
                                                        {catName[g] || g}
                                                    </td>
                                                    {MONTH_LABELS.map((c, m) => (
                                                        <td key={c} className="px-1 py-1">
                                                            {canEdit ? (
                                                                <NumberInput value={Math.round(val(g, m) / 1e6)}
                                                                    onChange={(v) => onEdit(g, m, v)}
                                                                    className="w-[76px] text-right font-mono text-[12px] border border-slate-200 dark:border-slate-600 rounded px-1.5 py-1 bg-white dark:bg-slate-700" />
                                                            ) : (
                                                                <span className="block text-right font-mono text-[13px] px-1.5">{toM(val(g, m))}</span>
                                                            )}
                                                        </td>
                                                    ))}
                                                    <td className="px-2 py-1.5 text-right tabular-nums font-mono text-[13px] font-bold bg-slate-50/60 dark:bg-slate-800/60">{toM(groupTotal(g))}</td>
                                                    {canEdit && (
                                                        <td className="px-1 py-1 text-center">
                                                            <button onClick={() => clearRow(g)} title="Xoá số liệu nhóm này" className="text-slate-300 hover:text-rose-500">
                                                                <Icon name="close" size={15} />
                                                            </button>
                                                        </td>
                                                    )}
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
                                                {canEdit && <td></td>}
                                            </tr>
                                        </tfoot>
                                    </table>
                                )}
                            </div>
                            <p className="text-[11px] text-slate-400">
                                Tháng nào cần thì nhập tháng đó. Số liệu ghép vào hạng mục <b>Vật liệu</b> ở màn Kế hoạch Dòng tiền (kế toán/BGĐ xem tổng hợp).
                            </p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
