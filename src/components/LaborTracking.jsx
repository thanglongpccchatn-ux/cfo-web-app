import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import ExcelImportModal from './ExcelImportModal';
import LaborRequestModal from './LaborRequestModal';
import LaborPaymentModal from './LaborPaymentModal';
import { smartToast } from '../utils/globalToast';
import { exportToExcel } from '../utils/exportExcel';
import { fmt, fmtDate, fmtB } from '../utils/formatters';

export default function LaborTracking({ project, onBack, embedded }) {
    const [labors, setLabors] = useState([]);
    const [showImportModal, setShowImportModal] = useState(false);
    const [showRequestModal, setShowRequestModal] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [selectedLabor, setSelectedLabor] = useState(null);
    const [filterProjectId, setFilterProjectId] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterTeam, setFilterTeam] = useState('all');
    const [filterStage, setFilterStage] = useState('all');
    const [filterDateFrom, setFilterDateFrom] = useState('');
    const [filterDateTo, setFilterDateTo] = useState('');
    const [viewMode, setViewMode] = useState('list'); // 'list' | 'grouped'
    const [expandedTeams, setExpandedTeams] = useState(new Set());
    const [showFilters, setShowFilters] = useState(false);
    const queryClient = useQueryClient();

    const LABOR_COLUMN_MAPPING = {
        team_name: 'Tên đội/Thầu phụ', payment_stage: 'Giai Đoạn TT',
        contract_value: 'GT Hợp Đồng Thầu Phụ', request_date: 'Ngày Đề Nghị',
        completed_previous: 'KL Hoàn Thành Kỳ Trước', completed_current: 'KL Hoàn Thành Kỳ Này',
        requested_amount: 'Số Tiền Đề Nghị', approved_amount: 'Số Tiền Được Duyệt',
        payment_date: 'Ngày Thanh Toán', paid_amount: 'Số Tiền Đã TT',
        priority: 'Ưu Tiên', notes: 'Ghi Chú'
    };
    const LABOR_SAMPLE_ROWS = [
        ['Tổ Thầu XD Tuấn Anh', 'Tạm ứng', 500000000, '2025-01-10', 0, 30, 150000000, 145000000, '2025-01-20', 145000000, 'Bình thường', 'Tạm ứng đợt 1'],
        ['Đội Cơ Điện Minh Khoa', 'Nghiệm thu', 200000000, '2025-02-05', 50, 80, 60000000, 58000000, '', 0, 'Cao', 'Đang chờ nghiệm thu']
    ];

    // ── React Query: Labors ──
    const { isLoading: loading } = useQuery({
        queryKey: ['labors', project?.id, filterProjectId],
        queryFn: async () => {
            let query = supabase
                .from('expense_labor')
                .select('*, projects(name, code, internal_code)')
                .order('created_at', { ascending: false });
            if (project) query = query.eq('project_id', project.id);
            else if (filterProjectId !== 'all') query = query.eq('project_id', filterProjectId);
            const { data, error } = await query;
            if (error) throw error;
            setLabors(data || []);
            return data || [];
        },
        staleTime: 2 * 60 * 1000,
    });

    // ── React Query: Projects (for filter) ──
    const { data: projects = [] } = useQuery({
        queryKey: ['laborProjects'],
        queryFn: async () => {
            const { data } = await supabase.from('projects').select('id, name, code, internal_code').order('name');
            return data || [];
        },
        staleTime: 5 * 60 * 1000,
        enabled: !project,
    });

    // ── Derived: Unique teams & stages ──
    const uniqueTeams = useMemo(() => [...new Set(labors.map(l => l.team_name).filter(Boolean))].sort(), [labors]);
    const uniqueStages = useMemo(() => [...new Set(labors.map(l => l.payment_stage).filter(Boolean))].sort(), [labors]);

    // ── Filtered labors ──
    const filteredLabors = useMemo(() => {
        return labors.filter(l => {
            if (filterStatus !== 'all' && l.status !== filterStatus) return false;
            if (filterTeam !== 'all' && l.team_name !== filterTeam) return false;
            if (filterStage !== 'all' && l.payment_stage !== filterStage) return false;
            if (filterDateFrom && l.request_date < filterDateFrom) return false;
            if (filterDateTo && l.request_date > filterDateTo) return false;
            return true;
        });
    }, [labors, filterStatus, filterTeam, filterStage, filterDateFrom, filterDateTo]);

    // ── KPI Calculations (6 chỉ số) ──
    const kpis = useMemo(() => {
        const all = filteredLabors.filter(l => !l.isNew);
        const totalRequested = all.reduce((s, l) => s + Number(l.requested_amount || 0), 0);
        const totalPaid = all.reduce((s, l) => s + Number(l.paid_amount || 0), 0);
        const totalDebt = totalRequested - totalPaid;
        const pendingCount = all.filter(l => l.status === 'PENDING' || (!l.status && !Number(l.paid_amount))).length;
        // Unique contract values (by team_name to avoid duplication)
        const contractMap = {};
        all.forEach(l => {
            if (l.team_name && Number(l.contract_value) > 0) {
                contractMap[l.team_name] = Math.max(contractMap[l.team_name] || 0, Number(l.contract_value));
            }
        });
        const totalContractValue = Object.values(contractMap).reduce((s, v) => s + v, 0);
        const budgetUsedPct = totalContractValue > 0 ? (totalPaid / totalContractValue * 100) : 0;
        return { totalRequested, totalPaid, totalDebt, pendingCount, totalContractValue, budgetUsedPct };
    }, [filteredLabors]);

    // ── Grouped data (by team_name) ──
    const groupedData = useMemo(() => {
        const groups = {};
        filteredLabors.forEach(l => {
            const team = l.team_name || 'Chưa xác định';
            if (!groups[team]) groups[team] = { items: [], totalRequested: 0, totalPaid: 0, contractValue: 0 };
            groups[team].items.push(l);
            groups[team].totalRequested += Number(l.requested_amount || 0);
            groups[team].totalPaid += Number(l.paid_amount || 0);
            groups[team].contractValue = Math.max(groups[team].contractValue, Number(l.contract_value || 0));
        });
        return Object.entries(groups)
            .map(([team, data]) => ({ team, ...data, debt: data.totalRequested - data.totalPaid }))
            .sort((a, b) => b.debt - a.debt);
    }, [filteredLabors]);

    // ── Top 5 debtors ──
    const topDebtors = useMemo(() => groupedData.filter(g => g.debt > 0).slice(0, 5), [groupedData]);

    // ── Toggle team expand ──
    const toggleTeam = (team) => {
        setExpandedTeams(prev => {
            const next = new Set(prev);
            next.has(team) ? next.delete(team) : next.add(team);
            return next;
        });
    };

    // ── Handlers ──
    const handleOpenPaymentModal = (labor) => { setSelectedLabor(labor); setShowPaymentModal(true); };
    const handleDelete = async (id) => {
        if (!window.confirm('Xóa bản ghi thanh toán thầu phụ này?')) return;
        const { error } = await supabase.from('expense_labor').delete().eq('id', id);
        if (!error) { smartToast('Đã xóa thành công!', 'success'); queryClient.invalidateQueries({ queryKey: ['labors'] }); }
    };
    const handleSuccess = () => { smartToast('Thao tác thành công!', 'success'); queryClient.invalidateQueries({ queryKey: ['labors'] }); };

    // ── Export Excel ──
    const handleExportExcel = async () => {
        const dataToExport = viewMode === 'grouped'
            ? groupedData.flatMap(g => g.items.map(l => ({ ...l, _groupTeam: g.team, _groupDebt: g.debt })))
            : filteredLabors;

        const columns = [
            { key: l => l.projects?.internal_code || l.projects?.code || '', label: 'Mã DA' },
            { key: 'team_name', label: 'Nhà thầu / Tổ đội' },
            { key: 'payment_stage', label: 'Giai đoạn' },
            { key: 'request_date', label: 'Ngày ĐN', format: 'date' },
            { key: 'contract_value', label: 'GT Hợp đồng', format: 'currency' },
            { key: 'completed_previous', label: 'Lũy kế KT trước', format: 'number' },
            { key: 'completed_current', label: 'KL kỳ này', format: 'number' },
            { key: 'requested_amount', label: 'Đề nghị TT', format: 'currency' },
            { key: 'approved_amount', label: 'Được duyệt', format: 'currency' },
            { key: 'paid_amount', label: 'Thực trả', format: 'currency' },
            { key: 'deduction_amount', label: 'Khấu trừ', format: 'currency' },
            { key: 'payment_date', label: 'Ngày TT', format: 'date' },
            { key: 'priority', label: 'Ưu tiên' },
            { key: 'status', label: 'Trạng thái' },
            { key: 'notes', label: 'Ghi chú' },
        ];
        const dateStr = new Date().toISOString().split('T')[0];
        await exportToExcel(dataToExport, columns, `Thau_Phu_To_Doi_${dateStr}`, 'Nhân công');
        smartToast(`Đã xuất ${dataToExport.length} dòng ra Excel`, 'success');
    };

    const resetFilters = () => {
        setFilterStatus('all'); setFilterTeam('all'); setFilterStage('all');
        setFilterDateFrom(''); setFilterDateTo('');
    };
    const activeFilterCount = [filterStatus, filterTeam, filterStage].filter(f => f !== 'all').length
        + (filterDateFrom ? 1 : 0) + (filterDateTo ? 1 : 0);

    // ── Status Badge ──
    const StatusBadge = ({ status, paidAmount }) => {
        const isPaid = status === 'PAID' || Number(paidAmount) > 0;
        return (
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all ${
                isPaid ? 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm'
                    : 'bg-amber-50 text-amber-700 border-amber-200 shadow-sm animate-pulse'
            }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isPaid ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                {isPaid ? 'Đã Chi' : 'Chờ Chi'}
            </span>
        );
    };

    // ── Loading skeleton ──
    if (loading && labors.length === 0) {
        return (
            <div className="bg-white border border-slate-200/60 rounded-xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-slate-100 flex items-center gap-3">
                    <div className="h-6 w-32 bg-purple-100 rounded-full animate-pulse" />
                    <div className="h-6 w-24 bg-slate-100 rounded-full animate-pulse" />
                </div>
                <div className="space-y-3 p-4">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl animate-pulse">
                            <div className="w-10 h-10 bg-slate-200 rounded-xl flex-shrink-0" />
                            <div className="flex-1 space-y-2">
                                <div className="h-3.5 bg-slate-200 rounded-full w-3/4" />
                                <div className="h-2.5 bg-slate-100 rounded-full w-1/2" />
                            </div>
                            <div className="h-5 w-20 bg-purple-100 rounded-full" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <>
        <div className={`flex flex-col h-full bg-white border border-slate-200/60 rounded-xl overflow-hidden animate-fade-in shadow-sm ${embedded ? 'border-none relative z-10 rounded-lg shadow-none' : 'absolute inset-0 z-50'}`}>
            {/* ═══════ HEADER ═══════ */}
            <div className="flex flex-col border-b border-slate-200/60 bg-white shadow-sm z-10 shrink-0 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-full bg-gradient-to-l from-purple-50 to-transparent -z-10"></div>
                <div className="flex justify-between items-center p-4">
                    <div className="flex items-center gap-4">
                        {!embedded && (
                            <button onClick={onBack} className="w-10 h-10 flex items-center justify-center bg-white hover:bg-slate-50 rounded-xl transition-all shadow-sm border border-slate-200 text-slate-500 hover:text-purple-600">
                                <span className="material-symbols-outlined notranslate text-[22px]" translate="no">arrow_back</span>
                            </button>
                        )}
                        <div>
                            <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                                <span className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center text-purple-600 shadow-sm border border-purple-200/50">
                                    <span className="material-symbols-outlined notranslate text-[18px]" translate="no">engineering</span>
                                </span>
                                Sateco: Kế hoạch Thầu phụ & Tổ đội
                            </h2>
                            <div className="text-[11px] font-bold text-slate-500 tracking-widest uppercase mt-0.5 ml-10">
                                {project ? `Chi phí thi công vận hành thuộc ${project?.code}` : (
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[14px] text-purple-500">handyman</span>
                                        <select value={filterProjectId} onChange={(e) => setFilterProjectId(e.target.value)}
                                            className="bg-purple-50 border border-purple-200 text-purple-700 px-3 py-1 rounded-full text-[12px] font-black focus:ring-2 focus:ring-purple-500 outline-none transition-all cursor-pointer hover:bg-purple-100">
                                            <option value="all">Tất cả dự án (Toàn cục)</option>
                                            {projects.map(p => <option key={p.id} value={p.id}>Dự án: {p.internal_code || p.code}</option>)}
                                        </select>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-2 items-center">
                        {/* View mode toggle */}
                        <div className="hidden lg:flex bg-slate-100 rounded-lg p-0.5 border border-slate-200">
                            <button onClick={() => setViewMode('list')}
                                className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all ${viewMode === 'list' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                                <span className="material-symbols-outlined text-[14px] mr-1 align-middle">list</span>Danh sách
                            </button>
                            <button onClick={() => setViewMode('grouped')}
                                className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all ${viewMode === 'grouped' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                                <span className="material-symbols-outlined text-[14px] mr-1 align-middle">account_tree</span>Theo thầu
                            </button>
                        </div>

                        {/* Filter toggle */}
                        <button onClick={() => setShowFilters(!showFilters)}
                            className={`relative flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-bold transition-all shadow-sm border h-10 ${showFilters ? 'bg-purple-50 border-purple-300 text-purple-700' : 'bg-white border-slate-200 text-slate-600 hover:border-purple-300'}`}>
                            <span className="material-symbols-outlined text-[18px]">filter_list</span>
                            <span className="hidden sm:inline">Lọc</span>
                            {activeFilterCount > 0 && (
                                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-purple-600 text-white rounded-full text-[9px] font-black flex items-center justify-center">{activeFilterCount}</span>
                            )}
                        </button>

                        {/* Export */}
                        <button onClick={handleExportExcel}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-emerald-300 text-emerald-700 font-bold text-sm hover:bg-emerald-50 transition-all shadow-sm h-10">
                            <span className="material-symbols-outlined notranslate text-[18px]" translate="no">download</span>
                            <span className="hidden lg:inline">Excel</span>
                        </button>

                        {/* Import */}
                        <button onClick={() => setShowImportModal(true)}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-emerald-300 text-emerald-700 font-bold text-sm hover:bg-emerald-50 transition-all shadow-sm h-10">
                            <span className="material-symbols-outlined notranslate text-[18px]" translate="no">upload_file</span>
                            <span className="hidden lg:inline">Import</span>
                        </button>

                        <button onClick={() => setShowRequestModal(true)}
                            className="btn bg-purple-600 hover:bg-purple-700 text-white font-bold shadow-md shadow-purple-500/20 px-5 flex items-center gap-2 h-10">
                            <span className="material-symbols-outlined notranslate text-[20px]" translate="no">add_task</span>
                            <span className="hidden sm:inline">TẠO YÊU CẦU</span>
                        </button>
                    </div>
                </div>

                {/* ═══════ SMART FILTERS (collapsible) ═══════ */}
                {showFilters && (
                    <div className="px-4 pb-4 pt-2 border-t border-slate-100 bg-slate-50/50 animate-slide-in">
                        <div className="flex flex-wrap items-end gap-3">
                            <div className="flex flex-col gap-1">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Trạng thái</label>
                                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
                                    className="bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-[12px] font-bold focus:ring-2 focus:ring-purple-500 outline-none cursor-pointer">
                                    <option value="all">Tất cả</option>
                                    <option value="PENDING">🟠 Chờ Chi</option>
                                    <option value="PAID">🟢 Đã Chi</option>
                                </select>
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Nhà thầu</label>
                                <select value={filterTeam} onChange={(e) => setFilterTeam(e.target.value)}
                                    className="bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-[12px] font-bold focus:ring-2 focus:ring-purple-500 outline-none cursor-pointer max-w-[200px]">
                                    <option value="all">Tất cả</option>
                                    {uniqueTeams.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Giai đoạn</label>
                                <select value={filterStage} onChange={(e) => setFilterStage(e.target.value)}
                                    className="bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-[12px] font-bold focus:ring-2 focus:ring-purple-500 outline-none cursor-pointer">
                                    <option value="all">Tất cả</option>
                                    {uniqueStages.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Từ ngày</label>
                                <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)}
                                    className="bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-[12px] font-bold focus:ring-2 focus:ring-purple-500 outline-none" />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Đến ngày</label>
                                <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)}
                                    className="bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-[12px] font-bold focus:ring-2 focus:ring-purple-500 outline-none" />
                            </div>
                            {activeFilterCount > 0 && (
                                <button onClick={resetFilters} className="text-rose-600 hover:text-rose-700 text-[11px] font-bold flex items-center gap-1 px-2 py-1.5 hover:bg-rose-50 rounded-lg transition-colors">
                                    <span className="material-symbols-outlined text-[14px]">close</span>Xóa bộ lọc
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* ═══════ 6 KPI CARDS ═══════ */}
            <div className="grid grid-cols-3 xl:grid-cols-6 gap-3 p-4 bg-slate-50/80 border-b border-slate-100 shrink-0">
                {[
                    { label: 'Chờ Chi', value: kpis.pendingCount, icon: 'pending_actions', color: 'amber', pulse: kpis.pendingCount > 0 },
                    { label: 'Tổng GT HĐ', value: fmtB(kpis.totalContractValue), icon: 'description', color: 'slate' },
                    { label: 'Tổng Đề Nghị', value: fmtB(kpis.totalRequested), icon: 'request_quote', color: 'blue' },
                    { label: 'Đã Trả', value: fmtB(kpis.totalPaid), icon: 'payments', color: 'emerald' },
                    { label: 'Còn Nợ', value: fmtB(kpis.totalDebt), icon: 'account_balance', color: 'rose' },
                    { label: '% Ngân Sách', value: `${kpis.budgetUsedPct.toFixed(1)}%`, icon: 'pie_chart', color: kpis.budgetUsedPct > 90 ? 'rose' : kpis.budgetUsedPct > 70 ? 'amber' : 'blue' },
                ].map((kpi) => (
                    <div key={kpi.label} className={`bg-white rounded-xl border border-${kpi.color}-100 shadow-sm p-3 relative overflow-hidden group hover:-translate-y-0.5 transition-all`}>
                        <div className={`absolute -right-4 -top-4 w-16 h-16 bg-${kpi.color}-50 rounded-full blur-2xl group-hover:bg-${kpi.color}-100 transition-colors`}></div>
                        <div className="flex items-center gap-1.5 mb-1.5 relative z-10">
                            <span className={`material-symbols-outlined text-${kpi.color}-500 text-[16px]`}>{kpi.icon}</span>
                            <p className={`text-[9px] font-black text-slate-400 uppercase tracking-widest`}>{kpi.label}</p>
                            {kpi.pulse && <span className={`w-1.5 h-1.5 rounded-full bg-${kpi.color}-500 animate-pulse`}></span>}
                        </div>
                        <p className={`text-lg font-black text-${kpi.color}-700 tabular-nums tracking-tight relative z-10`}>{kpi.value}</p>
                    </div>
                ))}
            </div>

            {/* ═══════ MAIN AREA ═══════ */}
            <div className="flex-1 overflow-auto bg-slate-50/50 p-4 xl:p-6 gap-4">

                {/* ── Mobile Card View ── */}
                <div className="block xl:hidden space-y-3 pb-20">
                    {filteredLabors.length === 0 ? (
                        <div className="py-10 text-center text-slate-400 bg-white rounded-xl border border-slate-200 shadow-sm font-medium">
                            <span className="material-symbols-outlined text-4xl block mb-2 opacity-50">inbox</span>
                            Chưa có dữ liệu thanh toán thầu phụ
                        </div>
                    ) : filteredLabors.map((labor, index) => {
                        const isPaid = labor.status === 'PAID' || Number(labor.paid_amount) > 0;
                        return (
                            <div key={labor.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative group animate-slide-up">
                                <div className="absolute -top-2 left-4 flex items-center gap-2">
                                    <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded-md text-[9px] font-black text-slate-500">#{index + 1}</span>
                                    <StatusBadge status={labor.status} paidAmount={labor.paid_amount} />
                                </div>
                                <div className="flex justify-between items-start mb-3 mt-2">
                                    <div className="flex-1 pr-2">
                                        <div className="font-bold text-sm text-slate-800 leading-tight">{labor.team_name}</div>
                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                            <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 text-[10px] font-bold border border-purple-100 uppercase">{labor.payment_stage}</span>
                                            {labor.priority && labor.priority !== 'Bình thường' && (
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${
                                                    labor.priority === 'Khẩn cấp' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-orange-50 text-orange-700 border-orange-200'
                                                }`}>{labor.priority}</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex gap-1 shrink-0">
                                        {!isPaid && (
                                            <button onClick={() => handleOpenPaymentModal(labor)} className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200 shadow-sm active:scale-95 transition-transform">
                                                <span className="material-symbols-outlined text-[18px]">payments</span>
                                            </button>
                                        )}
                                        <button onClick={() => handleDelete(labor.id)} className="w-8 h-8 rounded-lg bg-slate-50 text-rose-500 flex items-center justify-center border border-slate-200 shadow-sm active:scale-95 transition-transform">
                                            <span className="material-symbols-outlined text-[18px]">delete</span>
                                        </button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3 mb-3 border-t border-slate-50 pt-3">
                                    <div>
                                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Đề nghị</div>
                                        <div className="text-[14px] font-black text-indigo-700 tabular-nums">{fmt(labor.requested_amount)}</div>
                                    </div>
                                    <div>
                                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 text-right">Đã Thanh Toán</div>
                                        <div className="text-[14px] font-black text-emerald-700 text-right tabular-nums">{fmt(labor.paid_amount)}</div>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center text-[10px] bg-slate-50 p-2 rounded-lg border border-slate-100">
                                    <div className="flex items-center gap-1.5 text-slate-500">
                                        <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                                        {fmtDate(labor.request_date)}
                                    </div>
                                    <div className="font-bold text-rose-600">Nợ: {fmt(Number(labor.requested_amount) - Number(labor.paid_amount))}</div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* ── Desktop: LIST VIEW ── */}
                {viewMode === 'list' && (
                    <div className={`hidden xl:block bg-white ${embedded ? '' : 'rounded-xl shadow-sm border border-slate-200'} pb-4 ring-1 ring-slate-200/50`}>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs text-left whitespace-nowrap border-collapse">
                                <thead className="bg-slate-700 text-white font-bold sticky top-0 z-10 uppercase tracking-wider text-[10px]">
                                    <tr>
                                        <th className="px-3 py-2.5 w-10 text-center">STT</th>
                                        <th className="px-3 py-2.5 w-20 text-center">TT</th>
                                        <th className="px-3 py-2.5 min-w-[180px]">DA & Nhà thầu</th>
                                        <th className="px-3 py-2.5 w-24 text-center">Giai đoạn</th>
                                        <th className="px-3 py-2.5 w-28 text-center">Ngày ĐN</th>
                                        <th className="px-3 py-2.5 w-32 text-right bg-orange-800/40">Lũy kế KT</th>
                                        <th className="px-3 py-2.5 w-32 text-right bg-orange-800/40">KL Kỳ này</th>
                                        <th className="px-3 py-2.5 w-36 text-right bg-blue-800/40">Đề Nghị TT</th>
                                        <th className="px-3 py-2.5 w-36 text-right bg-emerald-800/40">Thực Trả</th>
                                        <th className="px-3 py-2.5 min-w-[120px]">Ghi chú</th>
                                        <th className="px-2 py-2.5 w-20 text-center"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredLabors.map((labor, index) => {
                                        const isPaid = labor.status === 'PAID' || Number(labor.paid_amount) > 0;
                                        return (
                                            <tr key={labor.id} className={`group transition-colors cursor-default ${isPaid ? 'hover:bg-emerald-50/30' : 'hover:bg-amber-50/30 bg-amber-50/5'}`}>
                                                <td className="px-3 py-2.5 text-center text-slate-400 font-medium">{index + 1}</td>
                                                <td className="px-3 py-2.5 text-center"><StatusBadge status={labor.status} paidAmount={labor.paid_amount} /></td>
                                                <td className="px-3 py-2.5">
                                                    <div className="flex flex-col gap-0.5 max-w-[220px]">
                                                        <span className="text-purple-700 text-[10px] uppercase font-black truncate">{labor.projects?.internal_code || labor.projects?.code ? `[${labor.projects?.internal_code || labor.projects?.code}]` : ''}</span>
                                                        <span className="font-bold text-slate-800 truncate" title={labor.team_name}>{labor.team_name}</span>
                                                        {labor.priority && labor.priority !== 'Bình thường' && (
                                                            <span className={`inline-flex items-center w-fit px-1.5 py-0.5 rounded text-[9px] font-black uppercase border ${
                                                                labor.priority === 'Khẩn cấp' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-orange-50 text-orange-700 border-orange-200'
                                                            }`}>{labor.priority === 'Khẩn cấp' && <span className="material-symbols-outlined notranslate text-[10px] mr-0.5" translate="no">emergency</span>}{labor.priority}</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2.5 text-center">
                                                    <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px] font-bold text-slate-600 uppercase">{labor.payment_stage}</span>
                                                </td>
                                                <td className="px-3 py-2.5 text-center text-slate-600 font-medium">{fmtDate(labor.request_date)}</td>
                                                <td className="px-3 py-2.5 text-right text-orange-600 tabular-nums bg-orange-50/20">{fmt(labor.completed_previous)}</td>
                                                <td className="px-3 py-2.5 text-right font-bold text-orange-700 tabular-nums bg-orange-50/20">{fmt(labor.completed_current)}</td>
                                                <td className="px-3 py-2.5 text-right font-bold text-indigo-700 tabular-nums bg-indigo-50/20 text-[13px]">{fmt(labor.requested_amount)}</td>
                                                <td className="px-3 py-2.5 text-right bg-emerald-50/20">
                                                    <div className="flex flex-col items-end gap-0.5">
                                                        <span className="font-black text-emerald-700 tabular-nums text-[13px]">{Number(labor.paid_amount) > 0 ? fmt(labor.paid_amount) : '—'}</span>
                                                        {isPaid && labor.payment_date && <span className="text-slate-400 text-[9px]">{fmtDate(labor.payment_date)}</span>}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2.5 text-slate-500 text-[11px] truncate max-w-[150px]" title={labor.notes}>{labor.notes}</td>
                                                <td className="px-1.5 py-2.5 text-center">
                                                    <div className="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        {!isPaid && (
                                                            <button onClick={() => handleOpenPaymentModal(labor)} className="w-7 h-7 flex items-center justify-center bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-600 rounded shadow-sm transition-all" title="Xác nhận thanh toán">
                                                                <span className="material-symbols-outlined notranslate text-[16px]" translate="no">payments</span>
                                                            </button>
                                                        )}
                                                        {isPaid && (
                                                            <button className="w-7 h-7 flex items-center justify-center bg-slate-50 border border-slate-200 text-slate-400 rounded shadow-sm cursor-default" title="Đã thanh toán">
                                                                <span className="material-symbols-outlined notranslate text-[16px]" translate="no">check_circle</span>
                                                            </button>
                                                        )}
                                                        <button onClick={() => handleDelete(labor.id)} className="w-7 h-7 flex items-center justify-center bg-white border border-slate-200 hover:border-rose-400 text-rose-600 hover:bg-rose-50 rounded shadow-sm transition-all" title="Xóa">
                                                            <span className="material-symbols-outlined notranslate text-[16px]" translate="no">delete</span>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* ── Desktop: GROUPED VIEW ── */}
                {viewMode === 'grouped' && (
                    <div className="hidden xl:block space-y-3 pb-4">
                        {groupedData.length === 0 ? (
                            <div className="py-10 text-center text-slate-400 bg-white rounded-xl border border-slate-200 shadow-sm font-medium">
                                <span className="material-symbols-outlined text-4xl block mb-2 opacity-50">inbox</span>
                                Chưa có dữ liệu
                            </div>
                        ) : groupedData.map(group => {
                            const isExpanded = expandedTeams.has(group.team);
                            const debtPct = group.contractValue > 0 ? (group.totalPaid / group.contractValue * 100) : 0;
                            return (
                                <div key={group.team} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                    {/* Group Header */}
                                    <button onClick={() => toggleTeam(group.team)}
                                        className="w-full flex items-center gap-4 px-5 py-4 hover:bg-purple-50/30 transition-colors text-left">
                                        <span className={`material-symbols-outlined text-[20px] text-purple-500 transition-transform duration-300 ${isExpanded ? 'rotate-90' : ''}`}>chevron_right</span>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-black text-slate-800 text-sm truncate">{group.team}</h4>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{group.items.length} đợt thanh toán</p>
                                        </div>
                                        <div className="flex items-center gap-6 shrink-0">
                                            <div className="text-right">
                                                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">GT HĐ</div>
                                                <div className="font-black text-slate-700 tabular-nums text-sm">{fmtB(group.contractValue)}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-[9px] font-black text-blue-500 uppercase tracking-widest">Đề Nghị</div>
                                                <div className="font-black text-blue-700 tabular-nums text-sm">{fmtB(group.totalRequested)}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Đã Trả</div>
                                                <div className="font-black text-emerald-700 tabular-nums text-sm">{fmtB(group.totalPaid)}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-[9px] font-black text-rose-500 uppercase tracking-widest">Còn Nợ</div>
                                                <div className="font-black text-rose-700 tabular-nums text-sm">{fmtB(group.debt)}</div>
                                            </div>
                                            <div className="w-32">
                                                <div className="flex justify-between text-[9px] font-bold text-slate-400 mb-1">
                                                    <span>Tiến độ</span><span>{debtPct.toFixed(0)}%</span>
                                                </div>
                                                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                                    <div className={`h-2 rounded-full transition-all ${debtPct > 90 ? 'bg-rose-500' : debtPct > 70 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                                        style={{ width: `${Math.min(debtPct, 100)}%` }}></div>
                                                </div>
                                            </div>
                                        </div>
                                    </button>

                                    {/* Group Detail */}
                                    {isExpanded && (
                                        <div className="border-t border-slate-100 overflow-x-auto">
                                            <table className="w-full text-xs text-left whitespace-nowrap">
                                                <thead className="bg-purple-50/50 text-purple-800 font-bold uppercase tracking-wider text-[9px]">
                                                    <tr>
                                                        <th className="px-3 py-2 w-8">#</th>
                                                        <th className="px-3 py-2 w-20 text-center">TT</th>
                                                        <th className="px-3 py-2">Giai đoạn</th>
                                                        <th className="px-3 py-2 text-center">Ngày ĐN</th>
                                                        <th className="px-3 py-2 text-right">Đề nghị</th>
                                                        <th className="px-3 py-2 text-right">Thực trả</th>
                                                        <th className="px-3 py-2 text-right">Khấu trừ</th>
                                                        <th className="px-3 py-2">Ghi chú</th>
                                                        <th className="px-3 py-2 w-16"></th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-50">
                                                    {group.items.map((labor, i) => {
                                                        const isPaid = labor.status === 'PAID' || Number(labor.paid_amount) > 0;
                                                        return (
                                                            <tr key={labor.id} className={`group/row transition-colors ${isPaid ? 'hover:bg-emerald-50/20' : 'hover:bg-amber-50/20'}`}>
                                                                <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                                                                <td className="px-3 py-2 text-center"><StatusBadge status={labor.status} paidAmount={labor.paid_amount} /></td>
                                                                <td className="px-3 py-2">
                                                                    <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px] font-bold text-slate-600">{labor.payment_stage}</span>
                                                                </td>
                                                                <td className="px-3 py-2 text-center text-slate-500">{fmtDate(labor.request_date)}</td>
                                                                <td className="px-3 py-2 text-right font-bold text-indigo-700 tabular-nums">{fmt(labor.requested_amount)}</td>
                                                                <td className="px-3 py-2 text-right font-black text-emerald-700 tabular-nums">{Number(labor.paid_amount) > 0 ? fmt(labor.paid_amount) : '—'}</td>
                                                                <td className="px-3 py-2 text-right text-rose-600 tabular-nums">{Number(labor.deduction_amount) > 0 ? fmt(labor.deduction_amount) : '—'}</td>
                                                                <td className="px-3 py-2 text-slate-500 truncate max-w-[150px]">{labor.notes}</td>
                                                                <td className="px-2 py-2">
                                                                    <div className="flex gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
                                                                        {!isPaid && (
                                                                            <button onClick={() => handleOpenPaymentModal(labor)} className="w-6 h-6 flex items-center justify-center bg-emerald-50 border border-emerald-200 text-emerald-600 rounded transition-all" title="Thanh toán">
                                                                                <span className="material-symbols-outlined text-[14px]">payments</span>
                                                                            </button>
                                                                        )}
                                                                        <button onClick={() => handleDelete(labor.id)} className="w-6 h-6 flex items-center justify-center bg-white border border-slate-200 hover:border-rose-300 text-rose-500 rounded transition-all" title="Xóa">
                                                                            <span className="material-symbols-outlined text-[14px]">delete</span>
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {/* ── Top Debtors Summary ── */}
                        {topDebtors.length > 0 && (
                            <div className="bg-white rounded-xl border border-rose-100 shadow-sm p-5 mt-4">
                                <h4 className="text-[11px] font-black text-rose-600 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-[16px]">trending_up</span>
                                    Top Nhà Thầu Công Nợ Cao Nhất
                                </h4>
                                <div className="space-y-2">
                                    {topDebtors.map((g, i) => (
                                        <div key={g.team} className="flex items-center gap-3">
                                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${i === 0 ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-500'}`}>{i + 1}</span>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-bold text-sm text-slate-800 truncate">{g.team}</div>
                                            </div>
                                            <div className="font-black text-rose-700 tabular-nums text-sm">{fmtB(g.debt)}</div>
                                            <div className="w-24 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                                <div className="h-1.5 rounded-full bg-rose-500" style={{ width: `${topDebtors[0].debt > 0 ? (g.debt / topDebtors[0].debt * 100) : 0}%` }}></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>

        {/* Modals */}
        <LaborRequestModal isOpen={showRequestModal} onClose={() => setShowRequestModal(false)} onSuccess={handleSuccess} project={project} projects={projects} />
        <LaborPaymentModal isOpen={showPaymentModal} onClose={() => { setShowPaymentModal(false); setSelectedLabor(null); }} onSuccess={handleSuccess} labor={selectedLabor} />
        <ExcelImportModal
            isOpen={showImportModal} onClose={() => setShowImportModal(false)}
            title="Import Thầu Phụ / Tổ Đội (Excel)" tableName="expense_labor"
            columnMapping={LABOR_COLUMN_MAPPING} templateFilename="mau_nhan_cong_thau_phu.xlsx"
            templateSampleRows={LABOR_SAMPLE_ROWS}
            fixedData={{ project_id: project ? project.id : (filterProjectId !== 'all' ? filterProjectId : null) }}
            onSuccess={(count) => { smartToast(`Đã import thành công ${count} bản ghi Thầu phụ / Nhân công!`); queryClient.invalidateQueries({ queryKey: ['labors'] }); }}
        />
        </>
    );
}
