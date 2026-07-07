import { useMemo, useState, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import Icon from './common/Icon';
import NumberInput from './common/NumberInput';
import SearchableSelect from './common/SearchableSelect';
import { smartToast } from '../utils/globalToast';
import { fmt } from '../utils/formatters';
import { exportToExcel } from '../utils/exportExcel';
import { materialPlanByGroup, NO_GROUP } from '../lib/cashflow';

// Màn nhập KẾ HOẠCH VẬT LIỆU cho bộ phận vật tư — theo DỰ ÁN × NHÓM × THÁNG.
// Khung trái: danh sách dự án + trạng thái Đã lập/Chưa lập (chống bỏ sót).
// Khung phải: DÒNG nhập (Nhóm + Tháng + Số tiền) — tháng nào cần thì thêm dòng cho tháng đó.
// Ghi cash_flow_plan (category='material', direction='out', sub_category=mã nhóm).

const MONTHS = Array.from({ length: 12 }, (_, i) => ({ v: i, label: `Tháng ${i + 1}` }));
const nowYear = new Date().getFullYear();
const YEARS = [nowYear - 2, nowYear - 1, nowYear, nowYear + 1];
const toM = (v) => fmt(Math.round((v || 0) / 1e6)); // triệu đồng
const ACTIVE_STATUSES = ['Đang thi công', 'Bảo hành']; // dự án cần lập KH; "Đã hoàn thành" ẩn mặc định

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
    const [showAll, setShowAll] = useState(false);
    const [q, setQ] = useState('');
    const [lines, setLines] = useState([]);   // [{ id, group, month, amount(đồng) }]
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const lineSeq = useRef(1);
    const mkLine = (patch = {}) => ({ id: lineSeq.current++, group: '', month: '', amount: 0, ...patch });

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

    const catName = useMemo(() => {
        const m = {}; for (const c of (data?.categories || [])) m[c.code] = c.name;
        m[NO_GROUP] = 'Chưa phân nhóm';
        return m;
    }, [data?.categories]);

    const plannedByProject = useMemo(() => {
        const m = {};
        for (const r of (data?.planRows || [])) {
            if (r.category !== 'material' || r.year !== year) continue;
            m[r.project_id] = (m[r.project_id] || 0) + (Number(r.planned_amount) || 0);
        }
        return m;
    }, [data?.planRows, year]);

    // Nạp dòng từ KH đã lưu mỗi khi đổi dự án/năm (hoặc sau khi lưu -> refetch).
    useEffect(() => {
        if (!projectId) { setLines([]); setDirty(false); return; }
        const ex = materialPlanByGroup(data?.planRows, { year, projectId });
        const arr = [];
        for (const g of Object.keys(ex)) ex[g].forEach((amt, m) => { if (amt) arr.push(mkLine({ group: g, month: m, amount: amt })); });
        arr.sort((a, b) => (catName[a.group] || a.group).localeCompare(catName[b.group] || b.group, 'vi') || a.month - b.month);
        if (!arr.length) arr.push(mkLine());
        setLines(arr);
        setDirty(false);
    }, [projectId, year, data?.planRows]); // eslint-disable-line react-hooks/exhaustive-deps

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
    const selProject = useMemo(() => (data?.projects || []).find(p => p.id === projectId), [data?.projects, projectId]);

    // Nhóm để chọn: từ DANH MỤC VẬT TƯ (distinct materials.category_code) + nhóm đã có trong dòng.
    const groupOptions = useMemo(() => {
        const m = new Map();
        for (const code of new Set((data?.materials || []).map(x => x.category_code).filter(Boolean))) m.set(code, catName[code] || code);
        for (const l of lines) if (l.group && !m.has(l.group)) m.set(l.group, catName[l.group] || l.group);
        return [...m].map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label, 'vi'));
    }, [data?.materials, lines, catName]);

    const setLine = (id, patch) => { setLines(ls => ls.map(l => l.id === id ? { ...l, ...patch } : l)); setDirty(true); };
    const removeLine = (id) => { setLines(ls => ls.filter(l => l.id !== id)); setDirty(true); };
    const addLine = () => { setLines(ls => [...ls, mkLine()]); setDirty(true); };

    const validLines = lines.filter(l => l.group && l.month !== '' && (Number(l.amount) || 0) > 0);
    const grand = validLines.reduce((s, l) => s + (Number(l.amount) || 0), 0);

    const save = async () => {
        if (!projectId) return;
        setSaving(true);
        try {
            // Gộp trùng (nhóm, tháng) rồi ghi. Chỉ đụng dòng material của đúng dự án + năm.
            const map = {};
            for (const l of validLines) { const k = `${l.group}:${l.month}`; map[k] = (map[k] || 0) + (Number(l.amount) || 0); }
            const { error: delErr } = await supabase.from('cash_flow_plan')
                .delete().eq('project_id', projectId).eq('year', year).eq('category', 'material');
            if (delErr) throw delErr;
            const rows = Object.entries(map).map(([k, amt]) => {
                const [g, m] = k.split(':');
                return { project_id: projectId, year, month: Number(m) + 1, direction: 'out', category: 'material', sub_category: g === NO_GROUP ? null : g, planned_amount: amt };
            });
            if (rows.length) { const { error } = await supabase.from('cash_flow_plan').insert(rows); if (error) throw error; }
            queryClient.invalidateQueries({ queryKey: ['material-plan', year] });
            queryClient.invalidateQueries({ queryKey: ['cashflow-data', year] });
            smartToast('Đã lưu kế hoạch vật liệu!');
            setDirty(false);
        } catch (err) {
            smartToast('Lỗi lưu: ' + (err.message || 'thiếu cột sub_category? chạy SQL alter table.'));
        } finally { setSaving(false); }
    };

    const doExport = () => {
        const columns = [
            { key: 'Nhóm vật tư', label: 'Nhóm vật tư' },
            { key: 'Tháng', label: 'Tháng' },
            { key: 'Số tiền', label: 'Số tiền (triệu)', format: 'number' },
        ];
        const rowsX = validLines
            .slice().sort((a, b) => (catName[a.group] || '').localeCompare(catName[b.group] || '', 'vi') || a.month - b.month)
            .map(l => ({ 'Nhóm vật tư': catName[l.group] || l.group, 'Tháng': `Tháng ${l.month + 1}`, 'Số tiền': Math.round(l.amount / 1e6) }));
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
                <select value={year} onChange={e => { setYear(Number(e.target.value)); setProjectId(''); }}
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
                                <button key={p.id} onClick={() => setProjectId(p.id)}
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

                {/* KHUNG PHẢI: dòng nhập cho dự án đang chọn */}
                <div className="flex-1 min-w-0 space-y-3">
                    {!projectId ? (
                        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-12 text-center">
                            <Icon name="touch_app" size={40} className="text-slate-300 mx-auto mb-3" />
                            <p className="text-slate-500 font-semibold">Chọn một <b>dự án</b> ở danh sách bên trái để lập kế hoạch vật liệu.</p>
                            <p className="text-slate-400 text-[12px] mt-1">Dấu <span className="text-amber-500 font-bold">○ Chưa lập</span> là dự án chưa có kế hoạch — ưu tiên làm trước.</p>
                        </div>
                    ) : (
                        <>
                            <div className="text-[13px] font-bold text-slate-700 dark:text-slate-200 truncate">
                                {selProject?.internal_code || selProject?.code} — <span className="font-normal text-slate-500">{selProject?.name}</span>
                            </div>

                            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr className="bg-slate-100 dark:bg-slate-900 text-[11px] font-black uppercase tracking-wider text-slate-500">
                                            <th className="px-3 py-2.5 text-left">Nhóm vật tư</th>
                                            <th className="px-3 py-2.5 text-left w-[140px]">Tháng</th>
                                            <th className="px-3 py-2.5 text-right w-[160px]">Số tiền (triệu)</th>
                                            {canEdit && <th className="px-2 py-2.5 w-10"></th>}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {lines.length === 0 ? (
                                            <tr><td colSpan={canEdit ? 4 : 3} className="p-8 text-center text-slate-400">Chưa có dòng nào. Bấm <b>“+ Thêm dòng”</b> bên dưới.</td></tr>
                                        ) : lines.map(l => (
                                            <tr key={l.id} className="border-b border-slate-100 dark:border-slate-700/30">
                                                <td className="px-3 py-2 align-top">
                                                    {canEdit ? (
                                                        <SearchableSelect options={groupOptions} value={l.group}
                                                            onChange={(id) => setLine(l.id, { group: id })} placeholder="Chọn nhóm vật tư..." />
                                                    ) : <span className="text-[13px]">{catName[l.group] || l.group}</span>}
                                                </td>
                                                <td className="px-3 py-2 align-top">
                                                    {canEdit ? (
                                                        <select value={l.month} onChange={e => setLine(l.id, { month: e.target.value === '' ? '' : Number(e.target.value) })}
                                                            className="w-full text-[13px] border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-2 bg-white dark:bg-slate-700">
                                                            <option value="">— Tháng —</option>
                                                            {MONTHS.map(m => <option key={m.v} value={m.v}>{m.label}</option>)}
                                                        </select>
                                                    ) : <span className="text-[13px]">{l.month !== '' ? `Tháng ${l.month + 1}` : ''}</span>}
                                                </td>
                                                <td className="px-3 py-2 align-top text-right">
                                                    {canEdit ? (
                                                        <NumberInput value={Math.round((Number(l.amount) || 0) / 1e6)}
                                                            onChange={(v) => setLine(l.id, { amount: (Number(v) || 0) * 1e6 })}
                                                            className="w-full text-right font-mono text-[13px] border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-2 bg-white dark:bg-slate-700" />
                                                    ) : <span className="font-mono text-[13px]">{toM(l.amount)}</span>}
                                                </td>
                                                {canEdit && (
                                                    <td className="px-2 py-2 text-center align-top">
                                                        <button onClick={() => removeLine(l.id)} title="Xoá dòng" className="text-slate-300 hover:text-rose-500 mt-1.5">
                                                            <Icon name="close" size={16} />
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-slate-50/70 dark:bg-slate-900/40 border-t-2 border-slate-200 dark:border-slate-700">
                                            <td className="px-3 py-2.5 text-[13px] font-black text-slate-800 dark:text-white" colSpan={2}>TỔNG VẬT LIỆU</td>
                                            <td className="px-3 py-2.5 text-right font-mono font-black text-rose-700 dark:text-rose-400">{toM(grand)}</td>
                                            {canEdit && <td></td>}
                                        </tr>
                                    </tfoot>
                                </table>
                                {canEdit && (
                                    <div className="p-3 border-t border-slate-100 dark:border-slate-700">
                                        <button onClick={addLine} className="px-3 py-2 text-sm font-bold text-primary bg-primary/5 hover:bg-primary/10 rounded-lg flex items-center gap-1.5">
                                            <Icon name="add" size={16} />Thêm dòng
                                        </button>
                                    </div>
                                )}
                            </div>
                            <p className="text-[11px] text-slate-400">
                                Mỗi dòng = 1 nhóm × 1 tháng. Tháng nào cần thì thêm dòng cho tháng đó. Số liệu ghép vào hạng mục <b>Vật liệu</b> ở màn Kế hoạch Dòng tiền.
                            </p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
