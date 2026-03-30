import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { fmt, fmtB } from '../utils/formatters';

const DEFAULT_DOCS = [
    { doc_type: 'bien_ban_nghiem_thu', doc_name: 'Biên bản nghiệm thu hoàn thành' },
    { doc_type: 'hoan_cong', doc_name: 'Hồ sơ hoàn công' },
    { doc_type: 'ban_giao', doc_name: 'Biên bản bàn giao công trình' },
    { doc_type: 'doi_chieu_cong_no', doc_name: 'Biên bản đối chiếu công nợ' },
    { doc_type: 'quyet_toan_hd', doc_name: 'Biên bản quyết toán hợp đồng' },
];

export default function SettlementManagement() {
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedId, setExpandedId] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({});

    // ─── Data Fetching ───
    const { data, isLoading, refetch } = useQuery({
        queryKey: ['settlement-management'],
        staleTime: 1000 * 60 * 3,
        queryFn: async () => {
            const [
                { data: projs },
                { data: pmts },
                { data: adds },
                { data: extHist },
                { data: docs }
            ] = await Promise.all([
                supabase.from('projects').select('*, partners!projects_partner_id_fkey(name, short_name, code)').eq('status', 'Đã hoàn thành'),
                supabase.from('payments').select('*'),
                supabase.from('addendas').select('*').eq('status', 'Đã duyệt'),
                supabase.from('external_payment_history').select('*'),
                supabase.from('settlement_documents').select('*'),
            ]);

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const processed = (projs || []).map(p => {
                const projPmts = (pmts || []).filter(pm => pm.project_id === p.id);
                const projAdds = (adds || []).filter(a => a.project_id === p.id);
                const projDocs = (docs || []).filter(d => d.project_id === p.id);

                // Values
                const baseTvh = parseFloat(p.total_value_post_vat) || (parseFloat(p.original_value || 0) * (1 + (p.vat_percentage ?? 8) / 100));
                const tvh = baseTvh + (parseFloat(p.total_approved_variations) || 0) * (1 + (p.vat_percentage ?? 8) / 100);
                const totalAddenda = projAdds.reduce((s, a) => s + (parseFloat(a.requested_value) || 0), 0);
                const proposedValue = parseFloat(p.settlement_proposed_value) || 0;
                const approvedValue = parseFloat(p.settlement_approved_value) || 0;

                // Invoice
                const totalInvoiced = projPmts.reduce((s, pm) => s + (parseFloat(pm.invoice_amount) || 0), 0);
                const invoiceRemaining = Math.max(0, (approvedValue || tvh) - totalInvoiced);

                // Income
                const pmtIds = projPmts.map(pm => pm.id);
                const projExtHist = (extHist || []).filter(h => pmtIds.includes(h.payment_stage_id));
                const totalIncome = projExtHist.reduce((s, h) => s + (parseFloat(h.amount) || 0), 0);
                const debtRemaining = Math.max(0, (approvedValue || tvh) - totalIncome);

                // Warranty
                const warrantyPct = parseFloat(p.warranty_percentage) || 0;
                const warrantyAmount = tvh * (warrantyPct / 100);
                let warrantyEndDate = null;
                let warrantyDaysRemaining = 9999;
                if (p.handover_date && p.warranty_duration_months) {
                    warrantyEndDate = new Date(p.handover_date);
                    warrantyEndDate.setMonth(warrantyEndDate.getMonth() + Number(p.warranty_duration_months));
                    warrantyDaysRemaining = Math.ceil((warrantyEndDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
                }

                // Docs
                const docsCompleted = projDocs.filter(d => d.is_completed).length;
                const docsTotal = projDocs.length || 0;

                // Days waiting
                const completionDate = p.handover_date || p.end_date;
                const daysWaiting = completionDate ? Math.ceil((today.getTime() - new Date(completionDate).getTime()) / (1000 * 3600 * 24)) : 0;

                return {
                    ...p,
                    tvh,
                    totalAddenda,
                    proposedValue,
                    approvedValue,
                    totalInvoiced,
                    invoiceRemaining,
                    totalIncome,
                    debtRemaining,
                    warrantyPct,
                    warrantyAmount,
                    warrantyEndDate,
                    warrantyDaysRemaining,
                    warrantyCollected: p.is_warranty_collected,
                    docsCompleted,
                    docsTotal,
                    projDocs,
                    projPmts,
                    daysWaiting,
                    isSettled: p.settlement_status === 'Đã quyết toán',
                };
            }).sort((a, b) => {
                // Unsettled first, then by days waiting desc
                if (a.isSettled !== b.isSettled) return a.isSettled ? 1 : -1;
                return b.daysWaiting - a.daysWaiting;
            });

            return processed;
        }
    });

    const projects = data || [];

    // ─── KPI ───
    const kpi = useMemo(() => {
        const unsettled = projects.filter(p => !p.isSettled);
        return {
            totalUnsettled: unsettled.length,
            totalUnsettledValue: unsettled.reduce((s, p) => s + (p.approvedValue || p.tvh), 0),
            totalDebt: unsettled.reduce((s, p) => s + p.debtRemaining, 0),
            totalInvoiceRemaining: unsettled.reduce((s, p) => s + p.invoiceRemaining, 0),
            docsProgress: projects.length > 0 ? Math.round(projects.reduce((s, p) => s + (p.docsTotal > 0 ? (p.docsCompleted / p.docsTotal) * 100 : 0), 0) / projects.length) : 0,
            totalWarrantyHeld: unsettled.reduce((s, p) => s + (p.warrantyCollected ? 0 : p.warrantyAmount), 0),
        };
    }, [projects]);

    // ─── Mutations ───
    const updateProject = useMutation({
        mutationFn: async ({ id, data }) => {
            const { error } = await supabase.from('projects').update(data).eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settlement-management'] }),
    });

    const toggleDoc = useMutation({
        mutationFn: async ({ docId, isCompleted }) => {
            const { error } = await supabase.from('settlement_documents').update({
                is_completed: !isCompleted,
                completed_date: !isCompleted ? new Date().toISOString().split('T')[0] : null,
            }).eq('id', docId);
            if (error) throw error;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settlement-management'] }),
    });

    const initDocs = useMutation({
        mutationFn: async (projectId) => {
            const rows = DEFAULT_DOCS.map(d => ({ ...d, project_id: projectId }));
            const { error } = await supabase.from('settlement_documents').insert(rows);
            if (error) throw error;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settlement-management'] }),
    });

    // ─── Inline Edit ───
    const startEdit = (p) => {
        setEditingId(p.id);
        setEditForm({
            settlement_proposed_value: p.proposedValue || '',
            settlement_approved_value: p.approvedValue || '',
            settlement_assignee: p.settlement_assignee || '',
            settlement_notes: p.settlement_notes || '',
            settlement_status: p.settlement_status || 'Chưa quyết toán',
        });
    };

    const saveEdit = async () => {
        if (!editingId) return;
        const proposed = parseFloat(editForm.settlement_proposed_value) || 0;
        const approved = parseFloat(editForm.settlement_approved_value) || proposed; // default = proposed
        await updateProject.mutateAsync({
            id: editingId,
            data: {
                settlement_proposed_value: proposed,
                settlement_approved_value: approved,
                settlement_assignee: editForm.settlement_assignee,
                settlement_notes: editForm.settlement_notes,
                settlement_status: editForm.settlement_status,
            }
        });
        setEditingId(null);
    };

    // ─── Filtering ───
    const filtered = useMemo(() => {
        if (!searchTerm) return projects;
        const q = searchTerm.toLowerCase();
        return projects.filter(p =>
            (p.code || '').toLowerCase().includes(q) ||
            (p.internal_code || '').toLowerCase().includes(q) ||
            (p.name || '').toLowerCase().includes(q) ||
            (p.partners?.short_name || '').toLowerCase().includes(q)
        );
    }, [projects, searchTerm]);

    // ─── RENDER ───
    return (
        <div className="max-w-[1800px] mx-auto animate-fade-in space-y-5">
            {/* Header */}
            <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-5 md:p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-50 rounded-full -mr-20 -mt-20 opacity-50"></div>
                <div className="relative z-10">
                    <h1 className="text-xl md:text-2xl font-black text-slate-800 flex items-center gap-3">
                        <span className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                            <span className="material-symbols-outlined text-[22px]">gavel</span>
                        </span>
                        Quản lý Quyết Toán
                    </h1>
                    <p className="text-slate-500 text-xs md:text-sm mt-1 font-medium italic">Theo dõi quyết toán, công nợ và hồ sơ pháp lý các dự án đã hoàn thành</p>
                </div>
                <div className="flex items-center gap-3 w-full lg:w-auto relative z-10">
                    <div className="relative flex-1 lg:w-72">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
                        <input
                            type="text"
                            placeholder="Tìm mã DA, tên CĐT..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none transition-all text-sm font-medium bg-slate-50/50"
                        />
                    </div>
                    <button onClick={() => refetch()} className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors text-slate-600 bg-white shadow-sm shrink-0">
                        <span className="material-symbols-outlined block">refresh</span>
                    </button>
                </div>
            </header>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
                {[
                    { label: 'DA Chờ QT', value: kpi.totalUnsettled, suffix: ' DA', color: 'indigo', icon: 'pending_actions' },
                    { label: 'Giá trị chờ QT', value: fmtB(kpi.totalUnsettledValue), suffix: ' Tỷ', color: 'blue', icon: 'account_balance' },
                    { label: 'Tổng Còn nợ', value: fmtB(kpi.totalDebt), suffix: ' Tỷ', color: 'rose', icon: 'money_off' },
                    { label: 'HĐ chưa xuất', value: fmtB(kpi.totalInvoiceRemaining), suffix: ' Tỷ', color: 'amber', icon: 'receipt_long' },
                    { label: 'BH đang giữ lại', value: fmtB(kpi.totalWarrantyHeld), suffix: ' Tỷ', color: 'purple', icon: 'security' },
                    { label: 'Hồ sơ đầy đủ', value: kpi.docsProgress, suffix: '%', color: 'emerald', icon: 'fact_check' },
                ].map((k, i) => (
                    <div key={i} className={`bg-white rounded-xl p-4 border border-slate-100 shadow-sm hover:shadow-md transition-all group`}>
                        <div className="flex justify-between items-start mb-2">
                            <div className={`w-9 h-9 rounded-lg bg-${k.color}-50 text-${k.color}-600 flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner shrink-0`}>
                                <span className="material-symbols-outlined text-[20px]">{k.icon}</span>
                            </div>
                        </div>
                        <p className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{k.label}</p>
                        <div className="flex items-baseline gap-0.5">
                            <span className={`text-lg md:text-xl font-black text-${k.color}-700 tracking-tight`}>{typeof k.value === 'number' ? k.value : k.value}</span>
                            <span className="text-[9px] font-bold text-slate-400">{k.suffix}</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Main Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-[10px] md:text-[11px] font-black text-slate-500 uppercase tracking-wider">
                                <th className="px-4 py-3.5 whitespace-nowrap">Dự án</th>
                                <th className="px-4 py-3.5 whitespace-nowrap text-right">Giá trị HĐ</th>
                                <th className="px-4 py-3.5 whitespace-nowrap text-right text-indigo-600">Đề nghị QT</th>
                                <th className="px-4 py-3.5 whitespace-nowrap text-right text-blue-600">CĐT duyệt</th>
                                <th className="px-4 py-3.5 whitespace-nowrap text-right">Đã xuất HĐ</th>
                                <th className="px-4 py-3.5 whitespace-nowrap text-right text-emerald-600">Đã thu</th>
                                <th className="px-4 py-3.5 whitespace-nowrap text-right text-rose-600">Còn nợ</th>
                                <th className="px-4 py-3.5 whitespace-nowrap text-center">Hồ sơ</th>
                                <th className="px-4 py-3.5 whitespace-nowrap text-center">Ngày chờ</th>
                                <th className="px-4 py-3.5 whitespace-nowrap text-center">Trạng thái</th>
                                <th className="px-4 py-3.5 whitespace-nowrap text-center">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoading ? (
                                [1,2,3].map(i => <tr key={i} className="animate-pulse"><td colSpan={11} className="px-4 py-5"><div className="h-10 bg-slate-100 rounded-xl"></div></td></tr>)
                            ) : filtered.length === 0 ? (
                                <tr><td colSpan={11} className="px-6 py-20 text-center">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300">
                                            <span className="material-symbols-outlined text-4xl">gavel</span>
                                        </div>
                                        <p className="text-slate-500 font-bold">Chưa có dự án hoàn thành nào cần quyết toán</p>
                                    </div>
                                </td></tr>
                            ) : filtered.map(p => {
                                const isExpanded = expandedId === p.id;
                                const isEditing = editingId === p.id;
                                const statusColor = p.isSettled ? 'emerald' : p.settlement_status === 'Đang quyết toán' ? 'amber' : 'rose';

                                return (
                                    <React.Fragment key={p.id}>
                                        <tr className={`transition-colors group ${isExpanded ? 'bg-indigo-50/30' : 'hover:bg-slate-50/80'}`}>
                                            {/* Project Info */}
                                            <td className="px-4 py-3.5">
                                                <div className="flex items-center gap-2 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : p.id)}>
                                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-transform ${isExpanded ? 'bg-indigo-100 text-indigo-600 rotate-180' : 'bg-slate-100 text-slate-400'}`}>
                                                        <span className="material-symbols-outlined text-[16px]">expand_more</span>
                                                    </div>
                                                    <div className="min-w-0">
                                                        <span className="text-xs font-mono font-black text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">{p.internal_code || p.code}</span>
                                                        <p className="text-[11px] font-bold text-slate-500 mt-0.5 truncate max-w-[180px]" title={p.name}>{p.name}</p>
                                                        <p className="text-[10px] font-medium text-slate-400 truncate">{p.partners?.short_name || p.partners?.name || ''}</p>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Giá trị HĐ */}
                                            <td className="px-4 py-3.5 text-right text-xs font-bold text-slate-600 tabular-nums whitespace-nowrap">{fmt(p.tvh)}</td>

                                            {/* Đề nghị QT */}
                                            <td className="px-4 py-3.5 text-right">
                                                {isEditing ? (
                                                    <input type="number" value={editForm.settlement_proposed_value} onChange={e => {
                                                        const val = e.target.value;
                                                        setEditForm(prev => ({
                                                            ...prev,
                                                            settlement_proposed_value: val,
                                                            settlement_approved_value: prev.settlement_approved_value || val
                                                        }));
                                                    }} className="w-28 px-2 py-1.5 text-xs font-bold text-right border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-100 outline-none" placeholder="0" />
                                                ) : (
                                                    <span className={`text-xs font-black tabular-nums whitespace-nowrap ${p.proposedValue > 0 ? 'text-indigo-700' : 'text-slate-300'}`}>
                                                        {p.proposedValue > 0 ? fmt(p.proposedValue) : '—'}
                                                    </span>
                                                )}
                                            </td>

                                            {/* CĐT duyệt */}
                                            <td className="px-4 py-3.5 text-right">
                                                {isEditing ? (
                                                    <input type="number" value={editForm.settlement_approved_value} onChange={e => setEditForm(prev => ({ ...prev, settlement_approved_value: e.target.value }))} className="w-28 px-2 py-1.5 text-xs font-bold text-right border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-100 outline-none" placeholder="= Đề nghị" />
                                                ) : (
                                                    <span className={`text-xs font-black tabular-nums whitespace-nowrap ${p.approvedValue > 0 ? 'text-blue-700' : 'text-slate-300'}`}>
                                                        {p.approvedValue > 0 ? fmt(p.approvedValue) : '—'}
                                                    </span>
                                                )}
                                            </td>

                                            {/* Đã xuất HĐ */}
                                            <td className="px-4 py-3.5 text-right text-xs font-bold text-slate-600 tabular-nums whitespace-nowrap">{fmt(p.totalInvoiced)}</td>

                                            {/* Đã thu */}
                                            <td className="px-4 py-3.5 text-right text-xs font-black text-emerald-600 tabular-nums whitespace-nowrap">{fmt(p.totalIncome)}</td>

                                            {/* Còn nợ */}
                                            <td className="px-4 py-3.5 text-right">
                                                <span className={`text-xs font-black tabular-nums whitespace-nowrap ${p.debtRemaining > 0 ? 'text-rose-600' : 'text-emerald-500'}`}>
                                                    {p.debtRemaining > 0 ? fmt(p.debtRemaining) : '✓ Đủ'}
                                                </span>
                                            </td>

                                            {/* Hồ sơ */}
                                            <td className="px-4 py-3.5 text-center">
                                                {p.docsTotal > 0 ? (
                                                    <div className="flex flex-col items-center gap-1">
                                                        <span className={`text-xs font-black ${p.docsCompleted === p.docsTotal ? 'text-emerald-600' : p.docsCompleted > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                                                            {p.docsCompleted}/{p.docsTotal}
                                                        </span>
                                                        <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                            <div className={`h-full rounded-full transition-all ${p.docsCompleted === p.docsTotal ? 'bg-emerald-500' : 'bg-amber-400'}`} style={{ width: `${(p.docsCompleted / p.docsTotal) * 100}%` }}></div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <button onClick={async (e) => { e.stopPropagation(); await initDocs.mutateAsync(p.id); }} className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2 py-1 rounded-lg hover:bg-indigo-100 transition-colors whitespace-nowrap">
                                                        + Tạo checklist
                                                    </button>
                                                )}
                                            </td>

                                            {/* Ngày chờ */}
                                            <td className="px-4 py-3.5 text-center">
                                                <span className={`text-xs font-black ${p.daysWaiting > 180 ? 'text-rose-600' : p.daysWaiting > 90 ? 'text-amber-600' : 'text-slate-500'}`}>
                                                    {p.daysWaiting > 0 ? `${p.daysWaiting}d` : '—'}
                                                </span>
                                            </td>

                                            {/* Trạng thái */}
                                            <td className="px-4 py-3.5 text-center">
                                                {isEditing ? (
                                                    <select value={editForm.settlement_status} onChange={e => setEditForm(prev => ({ ...prev, settlement_status: e.target.value }))} className={`text-[10px] font-black px-2 py-1.5 rounded-lg border outline-none`}>
                                                        <option>Chưa quyết toán</option>
                                                        <option>Đang quyết toán</option>
                                                        <option>Đã quyết toán</option>
                                                    </select>
                                                ) : (
                                                    <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border bg-${statusColor}-50 text-${statusColor}-600 border-${statusColor}-200`}>
                                                        <span className="material-symbols-outlined text-[12px]">{p.isSettled ? 'check_circle' : p.settlement_status === 'Đang quyết toán' ? 'hourglass_top' : 'pending'}</span>
                                                        {p.settlement_status || 'Chưa QT'}
                                                    </span>
                                                )}
                                            </td>

                                            {/* Thao tác */}
                                            <td className="px-4 py-3.5 text-center">
                                                {isEditing ? (
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <button onClick={saveEdit} disabled={updateProject.isPending} className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-xs font-bold flex items-center gap-1 shadow-sm transition-all active:scale-95 disabled:opacity-50">
                                                            <span className="material-symbols-outlined text-[14px]">save</span> Lưu
                                                        </button>
                                                        <button onClick={() => setEditingId(null)} className="px-2 py-1.5 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 text-xs font-bold transition-all active:scale-95">
                                                            <span className="material-symbols-outlined text-[14px]">close</span>
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button onClick={() => startEdit(p)} className="p-2 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors" title="Chỉnh sửa">
                                                        <span className="material-symbols-outlined text-[18px]">edit</span>
                                                    </button>
                                                )}
                                            </td>
                                        </tr>

                                        {/* Expanded Row */}
                                        {isExpanded && (
                                            <tr className="bg-slate-50/50">
                                                <td colSpan={11} className="p-0">
                                                    <div className="px-6 md:px-10 py-5 border-l-[3px] border-indigo-400 ml-4 md:ml-6 my-2 bg-white rounded-r-xl shadow-sm animate-in slide-in-from-top-2 duration-200">
                                                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                                            {/* Col 1: Document Checklist */}
                                                            <div>
                                                                <h4 className="text-xs font-black text-slate-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                                    <span className="material-symbols-outlined text-[16px] text-indigo-500">checklist</span>
                                                                    Hồ sơ Quyết toán
                                                                </h4>
                                                                {p.projDocs.length > 0 ? (
                                                                    <div className="space-y-2">
                                                                        {p.projDocs.map(doc => (
                                                                            <label key={doc.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${doc.is_completed ? 'bg-emerald-50/50 border-emerald-200' : 'bg-white border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/20'}`}>
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={doc.is_completed}
                                                                                    onChange={() => toggleDoc.mutate({ docId: doc.id, isCompleted: doc.is_completed })}
                                                                                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
                                                                                />
                                                                                <div className="min-w-0 flex-1">
                                                                                    <span className={`text-sm font-bold ${doc.is_completed ? 'text-emerald-700 line-through' : 'text-slate-700'}`}>{doc.doc_name}</span>
                                                                                    {doc.completed_date && (
                                                                                        <p className="text-[10px] font-medium text-emerald-500 mt-0.5">✓ {new Date(doc.completed_date).toLocaleDateString('vi-VN')}</p>
                                                                                    )}
                                                                                </div>
                                                                            </label>
                                                                        ))}
                                                                    </div>
                                                                ) : (
                                                                    <button onClick={() => initDocs.mutate(p.id)} className="w-full py-4 border-2 border-dashed border-slate-200 rounded-xl text-sm font-bold text-slate-400 hover:text-indigo-600 hover:border-indigo-300 transition-colors">
                                                                        + Tạo danh sách hồ sơ mặc định
                                                                    </button>
                                                                )}
                                                            </div>

                                                            {/* Col 2: Warranty & BH Info */}
                                                            <div>
                                                                <h4 className="text-xs font-black text-slate-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                                    <span className="material-symbols-outlined text-[16px] text-amber-500">security</span>
                                                                    Khoản giữ lại Bảo hành
                                                                </h4>
                                                                <div className="bg-amber-50/50 rounded-xl p-4 border border-amber-100 space-y-3">
                                                                    <div className="flex justify-between items-center">
                                                                        <span className="text-xs font-bold text-slate-500">Tỷ lệ giữ lại</span>
                                                                        <span className="text-sm font-black text-amber-700">{p.warrantyPct}%</span>
                                                                    </div>
                                                                    <div className="flex justify-between items-center">
                                                                        <span className="text-xs font-bold text-slate-500">Giá trị BH</span>
                                                                        <span className="text-sm font-black text-amber-700">{fmt(p.warrantyAmount)} ₫</span>
                                                                    </div>
                                                                    <div className="flex justify-between items-center">
                                                                        <span className="text-xs font-bold text-slate-500">Hết hạn BH</span>
                                                                        <span className="text-sm font-bold text-slate-700">{p.warrantyEndDate ? p.warrantyEndDate.toLocaleDateString('vi-VN') : '—'}</span>
                                                                    </div>
                                                                    <div className="flex justify-between items-center">
                                                                        <span className="text-xs font-bold text-slate-500">Tình trạng</span>
                                                                        {p.warrantyCollected ? (
                                                                            <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">✓ Đã thu hồi</span>
                                                                        ) : p.warrantyDaysRemaining <= 0 ? (
                                                                            <span className="text-[10px] font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200 animate-pulse">NỢ QUÁ HẠN</span>
                                                                        ) : (
                                                                            <span className="text-[10px] font-bold text-amber-600">Còn {p.warrantyDaysRemaining} ngày</span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Col 3: Notes & Assignee */}
                                                            <div>
                                                                <h4 className="text-xs font-black text-slate-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                                    <span className="material-symbols-outlined text-[16px] text-blue-500">info</span>
                                                                    Ghi chú & Phụ trách
                                                                </h4>
                                                                <div className="space-y-3">
                                                                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Phụ trách QT</span>
                                                                        <p className="text-sm font-bold text-slate-700 mt-1">{p.settlement_assignee || '— Chưa phân công —'}</p>
                                                                    </div>
                                                                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ghi chú / Vướng mắc</span>
                                                                        <p className="text-sm font-medium text-slate-600 mt-1 whitespace-pre-line">{p.settlement_notes || 'Không có ghi chú'}</p>
                                                                    </div>

                                                                    {/* Summary of payment phases */}
                                                                    <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-100">
                                                                        <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Tóm tắt Thanh toán</span>
                                                                        <div className="mt-2 space-y-1.5">
                                                                            <div className="flex justify-between text-xs">
                                                                                <span className="text-slate-500 font-medium">Số đợt thanh toán</span>
                                                                                <span className="font-bold text-slate-700">{p.projPmts.length} đợt</span>
                                                                            </div>
                                                                            <div className="flex justify-between text-xs">
                                                                                <span className="text-slate-500 font-medium">Tổng HĐ đã xuất</span>
                                                                                <span className="font-bold text-slate-700">{fmt(p.totalInvoiced)} ₫</span>
                                                                            </div>
                                                                            <div className="flex justify-between text-xs">
                                                                                <span className="text-emerald-600 font-medium">Tổng đã thu</span>
                                                                                <span className="font-black text-emerald-700">{fmt(p.totalIncome)} ₫</span>
                                                                            </div>
                                                                            <div className="flex justify-between text-xs border-t border-blue-100 pt-1.5 mt-1.5">
                                                                                <span className="text-rose-600 font-bold">Còn phải thu</span>
                                                                                <span className="font-black text-rose-700">{fmt(p.debtRemaining)} ₫</span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>

                        {/* Footer Totals */}
                        {!isLoading && filtered.length > 0 && (
                            <tfoot className="bg-slate-50 border-t-2 border-slate-200 sticky bottom-0">
                                <tr className="text-xs font-black">
                                    <td className="px-4 py-4 text-slate-500 uppercase tracking-widest">TỔNG ({filtered.length} DA)</td>
                                    <td className="px-4 py-4 text-right text-slate-700 tabular-nums">{fmt(filtered.reduce((s, p) => s + p.tvh, 0))}</td>
                                    <td className="px-4 py-4 text-right text-indigo-700 tabular-nums">{fmt(filtered.reduce((s, p) => s + p.proposedValue, 0))}</td>
                                    <td className="px-4 py-4 text-right text-blue-700 tabular-nums">{fmt(filtered.reduce((s, p) => s + p.approvedValue, 0))}</td>
                                    <td className="px-4 py-4 text-right text-slate-700 tabular-nums">{fmt(filtered.reduce((s, p) => s + p.totalInvoiced, 0))}</td>
                                    <td className="px-4 py-4 text-right text-emerald-700 tabular-nums">{fmt(filtered.reduce((s, p) => s + p.totalIncome, 0))}</td>
                                    <td className="px-4 py-4 text-right text-rose-700 tabular-nums">{fmt(filtered.reduce((s, p) => s + p.debtRemaining, 0))}</td>
                                    <td colSpan={4}></td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>
        </div>
    );
}
