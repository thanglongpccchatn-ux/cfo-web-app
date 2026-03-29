import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import ExcelImportModal from './ExcelImportModal';
import { smartToast } from '../utils/globalToast';

export default function LaborTracking({ project, onBack, embedded }) {
    const [labors, setLabors] = useState([]);
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showImportModal, setShowImportModal] = useState(false);
    const [filterProjectId, setFilterProjectId] = useState('all');

    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({});

    const LABOR_COLUMN_MAPPING = {
        team_name: 'Tên đội/Thầu phụ',
        payment_stage: 'Giai Đoạn TT',
        contract_value: 'GT Hợp Đồng Thầu Phụ',
        request_date: 'Ngày Đề Nghị',
        completed_previous: 'KL Hoàn Thành Kỳ Trước',
        completed_current: 'KL Hoàn Thành Kỳ Này',
        requested_amount: 'Số Tiền Đề Nghị',
        approved_amount: 'Số Tiền Được Duyệt',
        payment_date: 'Ngày Thanh Toán',
        paid_amount: 'Số Tiền Đã TT',
        priority: 'Ưu Tiên',
        notes: 'Ghi Chú'
    };

    const LABOR_SAMPLE_ROWS = [
        ['Tổ Thầu XD Tuấn Anh', 'Tạm ứng', 500000000, '2025-01-10', 0, 30, 150000000, 145000000, '2025-01-20', 145000000, 'Bình thường', 'Tạm ứng đợt 1'],
        ['Đội Cơ Điện Minh Khoa', 'Nghiệm thu', 200000000, '2025-02-05', 50, 80, 60000000, 58000000, '', 0, 'Cao', 'Đang chờ nghiệm thu']
    ];

    const fetchLabors = React.useCallback(async () => {
        let query = supabase
            .from('expense_labor')
            .select('*, projects(name, code)')
            .order('created_at', { ascending: false });

        if (project) {
            query = query.eq('project_id', project.id);
        } else if (filterProjectId !== 'all') {
            query = query.eq('project_id', filterProjectId);
        }

        const { data, error } = await query;
        if (!error && data) {
            setLabors(data);
        }
    }, [project, filterProjectId]);

    const fetchProjects = React.useCallback(async () => {
        if (project) return;
        const { data } = await supabase.from('projects').select('id, name, code').order('name');
        if (data) setProjects(data);
    }, [project]);

    useEffect(() => {
        const init = async () => {
            setLoading(true);
            await Promise.all([fetchLabors(), fetchProjects()]);
            setLoading(false);
        };
        init();
    }, [fetchLabors, fetchProjects]);

    function handleAddRow() {
        const newRow = {
            id: 'temp-' + Date.now(),
            isNew: true,
            team_name: '',
            payment_stage: 'Tạm ứng',
            contract_value: 0,
            request_date: new Date().toISOString().split('T')[0],
            completed_previous: 0,
            completed_current: 0,
            requested_amount: 0,
            approved_amount: 0,
            payment_date: '',
            paid_amount: 0,
            priority: 'Bình thường',
            notes: '',
            project_id: project ? project.id : (filterProjectId !== 'all' ? filterProjectId : null)
        };
        if (!newRow.project_id) {
            smartToast('Vui lòng chọn một dự án cụ thể để thêm thầu phụ.');
            return;
        }
        setLabors([newRow, ...labors]);
        setEditingId(newRow.id);
        setEditForm(newRow);
    };

    const handleEditClick = (labor) => {
        setEditingId(labor.id);
        setEditForm({ ...labor });
    };

    const handleCancelEdit = (id) => {
        setEditingId(null);
        if (id.toString().startsWith('temp-')) {
            setLabors(labors.filter(l => l.id !== id));
        }
    };

    const handleEditChange = (field, value) => {
        setEditForm(prev => ({ ...prev, [field]: value }));
    };

    async function handleSaveEdit() {
        if (!editForm.team_name || !editForm.payment_stage) {
            smartToast('Vui lòng nhập Tên Thầu phụ/Tổ đội và Đợt thanh toán.');
            return;
        }

        const payload = {
            project_id: project.id,
            team_name: editForm.team_name,
            payment_stage: editForm.payment_stage,
            contract_value: Number(editForm.contract_value),
            request_date: editForm.request_date || null,
            completed_previous: Number(editForm.completed_previous),
            completed_current: Number(editForm.completed_current),
            requested_amount: Number(editForm.requested_amount),
            approved_amount: Number(editForm.approved_amount),
            payment_date: editForm.payment_date || null,
            paid_amount: Number(editForm.paid_amount),
            priority: editForm.priority,
            notes: editForm.notes
        };

        if (editForm.isNew) {
            const { error } = await supabase.from('expense_labor').insert([payload]);
            if (error) console.error(error);
        } else {
            const { error } = await supabase.from('expense_labor').update(payload).eq('id', editingId);
            if (error) console.error(error);
        }

        setEditingId(null);
        fetchLabors();
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Xóa bản ghi thanh toán thầu phụ này?')) return;
        const { error } = await supabase.from('expense_labor').delete().eq('id', id);
        if (!error) fetchLabors();
    };

    const formatCurrency = (val) => new Intl.NumberFormat('vi-VN').format(Math.round(val || 0));
    const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString('vi-VN') : '-';

    // Summary Calculations
    const totalApprovedValue = labors.filter(l => !l.isNew).reduce((sum, l) => sum + Number(l.approved_amount), 0);
    const totalPaidValue = labors.filter(l => !l.isNew).reduce((sum, l) => sum + Number(l.paid_amount), 0);
    const totalDebtValue = totalApprovedValue - totalPaidValue;

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
        <div className={`flex flex-col h-full bg-white border border-slate-200/60 rounded-xl overflow-hidden animate-fade-in shadow-sm ${embedded ? 'min-h-[600px] mb-8' : 'absolute inset-0 z-50'}`}>
            {/* Control Header */}
            <div className="flex justify-between items-center p-4 border-b border-slate-200/60 bg-white shadow-sm z-10 shrink-0 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-full bg-gradient-to-l from-purple-50 to-transparent -z-10"></div>
                
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
                                    <select 
                                        value={filterProjectId} 
                                        onChange={(e) => setFilterProjectId(e.target.value)}
                                        className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 px-3 py-1 rounded-full text-[12px] font-black focus:ring-2 focus:ring-purple-500 outline-none transition-all cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-900/30"
                                    >
                                        <option value="all">Tất cả dự án (Toàn cục)</option>
                                        {projects.map(p => <option key={p.id} value={p.id}>Dự án: {p.code}</option>)}
                                    </select>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex gap-4 items-center">
                    <div className="flex bg-slate-50 rounded-xl border border-slate-200 divide-x divide-slate-200 shadow-sm overflow-hidden">
                        <div className="px-5 py-2 hover:bg-white transition-colors bg-blue-50/30">
                            <div className="text-[10px] text-blue-600 font-bold uppercase tracking-widest mb-0.5">Giá trị Được Duyệt (Tối ưu)</div>
                            <div className="font-black text-blue-700 text-lg tabular-nums tracking-tight">{formatCurrency(totalApprovedValue)}</div>
                        </div>
                        <div className="px-5 py-2 hover:bg-white transition-colors bg-green-50/30">
                            <div className="text-[10px] text-green-600 font-bold uppercase tracking-widest mb-0.5">Sateco Đã Nhả Tiền</div>
                            <div className="font-black text-green-700 text-lg tabular-nums tracking-tight">{formatCurrency(totalPaidValue)}</div>
                        </div>
                        <div className="px-5 py-2 hover:bg-white transition-colors bg-rose-50/30">
                            <div className="text-[10px] text-rose-500 font-bold uppercase tracking-widest mb-0.5">Sateco Nợ Thầu Phụ</div>
                            <div className="font-black text-rose-600 text-lg tabular-nums tracking-tight">{formatCurrency(totalDebtValue)}</div>
                        </div>
                    </div>

                    <button
                        onClick={() => setShowImportModal(true)}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-emerald-300 text-emerald-700 font-bold text-sm hover:bg-emerald-50 transition-all shadow-sm h-12"
                    >
                        <span className="material-symbols-outlined notranslate text-[18px]" translate="no">upload_file</span>
                        Import Excel
                    </button>
                    <button onClick={handleAddRow} className="btn bg-purple-600 hover:bg-purple-700 text-white font-bold shadow-md shadow-purple-500/20 px-5 flex items-center gap-2 h-12">
                        <span className="material-symbols-outlined notranslate text-[20px]" translate="no">add_task</span> THÊM ĐỢT T.TOÁN
                    </button>
                </div>
            </div>

            {/* Main Area: Excel-like Grid Layout */}
            <div className={`flex-1 overflow-auto bg-slate-50/50 ${embedded ? 'p-0 relative' : 'p-6 gap-4'}`}>
                {/* Mobile Card View */}
                <div className="block xl:hidden space-y-3 pb-20">
                    {labors.length === 0 ? (
                        <div className="py-10 text-center text-slate-400 bg-white rounded-xl border border-slate-200 shadow-sm font-medium">
                            Chưa có dữ liệu thanh toán thầu phụ
                        </div>
                    ) : labors.map((labor, index) => {
                        const isEditing = editingId === labor.id;
                        if (isEditing) return null; // We'll focus edit on desktop or a simpler mobile edit later if needed

                        return (
                            <div key={labor.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative group animate-slide-up">
                                <div className="absolute -top-2 left-4 px-2 py-0.5 bg-slate-100 border border-slate-200 rounded-md text-[9px] font-black text-slate-500">
                                    #{index + 1}
                                </div>
                                
                                <div className="flex justify-between items-start mb-3 mt-1">
                                    <div className="flex-1 pr-2">
                                        <div className="font-bold text-sm text-slate-800 leading-tight">{labor.team_name}</div>
                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                            <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 text-[10px] font-bold border border-purple-100 uppercase">{labor.payment_stage}</span>
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${
                                                labor.priority === 'Khẩn cấp' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                                                labor.priority === 'Cao' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                                                'bg-slate-50 text-slate-600 border-slate-200'
                                            }`}>
                                                {labor.priority}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex gap-1 shrink-0">
                                        <button onClick={() => handleEditClick(labor)} className="w-8 h-8 rounded-lg bg-slate-50 text-slate-500 flex items-center justify-center border border-slate-200 shadow-sm active:scale-95 transition-transform">
                                            <span className="material-symbols-outlined text-[18px]">edit</span>
                                        </button>
                                        <button onClick={() => handleDelete(labor.id)} className="w-8 h-8 rounded-lg bg-slate-50 text-rose-500 flex items-center justify-center border border-slate-200 shadow-sm active:scale-95 transition-transform">
                                            <span className="material-symbols-outlined text-[18px]">delete</span>
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3 mb-3 border-t border-slate-50 pt-3">
                                    <div>
                                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Duyệt Chốt</div>
                                        <div className="text-[14px] font-black text-blue-700 tabular-nums">{formatCurrency(labor.approved_amount)}</div>
                                    </div>
                                    <div>
                                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 text-right">Đã Thanh Toán</div>
                                        <div className="text-[14px] font-black text-emerald-700 text-right tabular-nums">{formatCurrency(labor.paid_amount)}</div>
                                    </div>
                                </div>

                                <div className="flex justify-between items-center text-[10px] bg-slate-50 p-2 rounded-lg border border-slate-100">
                                    <div className="flex items-center gap-1.5 text-slate-500">
                                        <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                                        {formatDate(labor.request_date)}
                                    </div>
                                    <div className="font-bold text-rose-600">
                                        Nợ: {formatCurrency(labor.approved_amount - labor.paid_amount)}
                                    </div>
                                </div>

                                {labor.notes && (
                                    <p className="mt-3 text-[11px] text-slate-500 italic line-clamp-1 border-t border-slate-50 pt-2 pl-1">
                                        "{labor.notes}"
                                    </p>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className={`hidden xl:block bg-white ${embedded ? '' : 'rounded-xl shadow-sm border border-slate-200'} min-w-[max-content] pb-20 ring-1 ring-slate-200/50`}>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left whitespace-nowrap border-collapse">
                            <thead className="bg-[#f8f9fa] text-slate-600 font-bold sticky top-0 z-10 shadow-sm border-b-2 border-slate-300 uppercase tracking-wider text-[10px]">
                                <tr>
                                    <th rowSpan="2" className="px-3 py-2 text-center border-r border-slate-200 border-b-0 align-middle">STT</th>
                                    <th rowSpan="2" className="px-3 py-2 w-48 border-r border-slate-200 border-b-0 align-middle">Tổ đội / Nhà thầu phụ</th>
                                    <th rowSpan="2" className="px-3 py-2 w-28 border-r border-slate-200 border-b-0 text-center align-middle">Giai đoạn</th>
                                    <th rowSpan="2" className="px-3 py-2 w-32 text-right border-r border-slate-200 border-b-0 align-middle">Giá trị Hợp đồng Gốc</th>
                                    <th rowSpan="2" className="px-3 py-2 w-28 border-r border-slate-200 border-b-0 text-center align-middle">Ngày Đề nghị</th>
                                    <th colSpan="2" className="px-3 py-1.5 text-center border-b border-r border-slate-300 bg-slate-100">Giá Trị Hoàn Thành</th>
                                    <th rowSpan="2" className="px-3 py-2 w-32 text-right border-r border-slate-200 border-b-0 align-middle text-indigo-700 bg-indigo-50/50">Nghiệm Thu Yêu Cầu</th>
                                    <th rowSpan="2" className="px-3 py-2 w-32 text-right border-r border-slate-200 border-b-0 align-middle text-blue-700 bg-blue-50 leading-tight">CHỐT CHI TỐI ƯU<br/><span className="text-[9px] font-medium opacity-70">(Sateco Duyệt)</span></th>
                                    <th rowSpan="2" className="px-3 py-2 w-28 border-r border-slate-200 border-b-0 text-center align-middle">Ngày Thanh Toán</th>
                                    <th rowSpan="2" className="px-3 py-2 w-32 text-right border-r border-slate-200 border-b-0 align-middle text-green-700 bg-green-50">Sateco Đã Trả (Thực tế)</th>
                                    <th rowSpan="2" className="px-3 py-2 w-28 text-center border-r border-slate-200 border-b-0 align-middle">Mức Độ Cháy</th>
                                    <th rowSpan="2" className="px-3 py-2 w-48 border-r border-slate-200 border-b-0 align-middle">Ghi chú Nội bộ</th>
                                    <th rowSpan="2" className="px-3 py-2 w-20 text-center border-b-0 align-middle bg-slate-50">Action</th>
                                </tr>
                                <tr>
                                    <th className="px-3 py-1.5 w-32 text-right border-r border-slate-200 bg-slate-50 uppercase tracking-widest text-[9px] font-bold text-slate-500">Lũy kế Kỳ Trước</th>
                                    <th className="px-3 py-1.5 w-32 text-right border-r border-slate-200 bg-slate-50 uppercase tracking-widest text-[9px] font-bold text-slate-500">Phát sinh Kỳ Này</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {labors.map((labor, index) => {
                                    const isEditing = editingId === labor.id;

                                    if (isEditing) {
                                        return (
                                            <tr key={labor.id} className="bg-purple-50/40 relative z-20 shadow-[0_0_10px_rgba(168,85,247,0.1)] outline outline-1 outline-purple-300">
                                                <td className="px-2 py-1 text-center border-r border-slate-200 font-bold text-purple-500">{labor.isNew ? '*' : index + 1}</td>
                                                <td className="px-2 py-1 border-r border-slate-200">
                                                    <input type="text" value={editForm.team_name || ''} onChange={(e) => handleEditChange('team_name', e.target.value)} className="w-full bg-white border border-purple-300 rounded px-2 py-1.5 font-bold text-purple-700 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all shadow-inner text-xs" placeholder="Thầu phụ..." autoFocus />
                                                </td>
                                                <td className="px-2 py-1 border-r border-slate-200">
                                                    <input type="text" value={editForm.payment_stage || ''} onChange={(e) => handleEditChange('payment_stage', e.target.value)} className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 text-center focus:border-purple-500 outline-none text-xs" placeholder="Đợt..." />
                                                </td>
                                                <td className="px-2 py-1 border-r border-slate-200">
                                                    <input type="number" value={editForm.contract_value === 0 ? '' : editForm.contract_value} onChange={(e) => handleEditChange('contract_value', e.target.value)} className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 text-right font-bold text-slate-700 focus:border-purple-500 outline-none text-xs" placeholder="0" />
                                                </td>
                                                <td className="px-2 py-1 border-r border-slate-200">
                                                    <input type="date" value={editForm.request_date || ''} onChange={(e) => handleEditChange('request_date', e.target.value)} className="w-full bg-white border border-slate-300 rounded px-1.5 py-1.5 focus:border-purple-500 outline-none text-xs" />
                                                </td>
                                                <td className="px-2 py-1 border-r border-slate-200 bg-slate-50/50">
                                                    <input type="number" value={editForm.completed_previous === 0 ? '' : editForm.completed_previous} onChange={(e) => handleEditChange('completed_previous', e.target.value)} className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 text-right focus:border-purple-500 outline-none text-xs" placeholder="0" />
                                                </td>
                                                <td className="px-2 py-1 border-r border-slate-200 bg-orange-50/50">
                                                    <input type="number" value={editForm.completed_current === 0 ? '' : editForm.completed_current} onChange={(e) => handleEditChange('completed_current', e.target.value)} className="w-full bg-white border border-orange-300 rounded px-2 py-1.5 text-right font-medium text-orange-700 focus:border-orange-500 outline-none text-xs" placeholder="0" />
                                                </td>
                                                <td className="px-2 py-1 border-r border-slate-200 bg-indigo-50/50">
                                                    <input type="number" value={editForm.requested_amount === 0 ? '' : editForm.requested_amount} onChange={(e) => handleEditChange('requested_amount', e.target.value)} className="w-full bg-white border border-indigo-300 rounded px-2 py-1.5 text-right font-bold text-indigo-700 focus:border-indigo-500 outline-none text-xs" placeholder="0" />
                                                </td>
                                                <td className="px-2 py-1 border-r border-slate-200 bg-blue-50">
                                                    <input type="number" value={editForm.approved_amount === 0 ? '' : editForm.approved_amount} onChange={(e) => handleEditChange('approved_amount', e.target.value)} className="w-full bg-white border border-blue-500 rounded px-2 py-1.5 text-right font-black text-blue-700 shadow-inner outline-none text-xs" placeholder="0" />
                                                </td>
                                                <td className="px-2 py-1 border-r border-slate-200">
                                                    <input type="date" value={editForm.payment_date || ''} onChange={(e) => handleEditChange('payment_date', e.target.value)} className="w-full bg-white border border-green-300 rounded px-1.5 py-1.5 focus:border-green-500 outline-none text-xs" />
                                                </td>
                                                <td className="px-2 py-1 border-r border-slate-200 bg-green-50/80">
                                                    <input type="number" value={editForm.paid_amount === 0 ? '' : editForm.paid_amount} onChange={(e) => handleEditChange('paid_amount', e.target.value)} className="w-full bg-white border border-green-500 rounded px-2 py-1.5 text-right font-black text-green-700 outline-none focus:border-green-500 shadow-inner text-xs" placeholder="0" />
                                                </td>
                                                <td className="px-2 py-1 border-r border-slate-200">
                                                    <select value={editForm.priority || 'Bình thường'} onChange={(e) => handleEditChange('priority', e.target.value)} className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 text-center focus:border-purple-500 outline-none text-xs">
                                                        <option value="Cao">🔥 Cao</option>
                                                        <option value="Thấp">Thấp</option>
                                                        <option value="Bình thường">Bình thường</option>
                                                        <option value="Khẩn cấp">🚨 Khẩn cấp</option>
                                                    </select>
                                                </td>
                                                <td className="px-2 py-1 border-r border-slate-200">
                                                    <input type="text" value={editForm.notes || ''} onChange={(e) => handleEditChange('notes', e.target.value)} className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 focus:border-purple-500 outline-none text-xs" placeholder="Ghi chú trình ký..." />
                                                </td>
                                                <td className="px-2 py-1 text-center bg-slate-50">
                                                    <div className="flex justify-center gap-1.5">
                                                        <button onClick={handleSaveEdit} className="w-7 h-7 flex items-center justify-center bg-purple-600 hover:bg-purple-700 text-white rounded shadow-sm transition-colors" title="Lưu">
                                                            <span className="material-symbols-outlined notranslate text-[16px]" translate="no">check</span>
                                                        </button>
                                                        <button onClick={() => handleCancelEdit(labor.id)} className="w-7 h-7 flex items-center justify-center bg-white border border-slate-300 hover:bg-slate-100 text-slate-600 rounded shadow-sm transition-colors" title="Hủy">
                                                            <span className="material-symbols-outlined notranslate text-[16px]" translate="no">close</span>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    }

                                    return (
                                        <tr key={labor.id} className="hover:bg-purple-50/20 group transition-colors cursor-default">
                                            <td className="px-3 py-2.5 text-center border-r border-slate-200 text-slate-400 font-medium">{index + 1}</td>
                                            <td className="px-3 py-2.5 border-r border-slate-200 font-bold text-slate-800 max-w-[200px] truncate" title={labor.team_name}>{labor.team_name}</td>
                                            <td className="px-3 py-2.5 border-r border-slate-200 text-center text-slate-700">{labor.payment_stage}</td>
                                            <td className="px-3 py-2.5 border-r border-slate-200 text-right font-bold text-slate-700 tabular-nums">{formatCurrency(labor.contract_value)}</td>
                                            <td className="px-3 py-2.5 border-r border-slate-200 text-center text-slate-500">{formatDate(labor.request_date)}</td>
                                            <td className="px-3 py-2.5 border-r border-slate-200 text-right text-slate-500 tabular-nums bg-slate-50/30">{formatCurrency(labor.completed_previous)}</td>
                                            <td className="px-3 py-2.5 border-r border-slate-200 text-right font-medium text-orange-600 tabular-nums bg-orange-50/10">{formatCurrency(labor.completed_current)}</td>
                                            <td className="px-3 py-2.5 border-r border-slate-200 text-right font-bold text-indigo-700 tabular-nums bg-indigo-50/20">{formatCurrency(labor.requested_amount)}</td>
                                            <td className="px-3 py-2.5 border-r border-slate-200 text-right font-black text-blue-700 tabular-nums bg-blue-50/40">{formatCurrency(labor.approved_amount)}</td>
                                            <td className="px-3 py-2.5 border-r border-slate-200 text-center text-slate-500">{formatDate(labor.payment_date)}</td>
                                            <td className="px-3 py-2.5 border-r border-slate-200 text-right font-black text-green-600 tabular-nums bg-green-50/30">{formatCurrency(labor.paid_amount)}</td>
                                            <td className="px-3 py-2.5 border-r border-slate-200 text-center">
                                                 <span className={`inline-flex items-center justify-center px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border ${
                                                    labor.priority === 'Khẩn cấp' ? 'bg-rose-50 text-rose-700 border-rose-200 shadow-sm' :
                                                    labor.priority === 'Cao' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                                                    labor.priority === 'Bình thường' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                    'bg-slate-50 text-slate-600 border-slate-200'
                                                }`}>
                                                    {labor.priority === 'Khẩn cấp' && <span className="material-symbols-outlined notranslate text-[12px] mr-1" translate="no">emergency</span>}
                                                    {labor.priority === 'Cao' && <span className="material-symbols-outlined notranslate text-[12px] mr-1" translate="no">priority_high</span>}
                                                    {labor.priority}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2.5 border-r border-slate-200 text-slate-500 truncate max-w-[200px] text-[11px]" title={labor.notes}>{labor.notes}</td>
                                            <td className="px-1.5 py-2.5 text-center border-l bg-slate-50/50">
                                                <div className="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => handleEditClick(labor)} className="w-7 h-7 flex items-center justify-center bg-white border border-slate-200 hover:border-purple-400 text-purple-600 hover:bg-purple-50 rounded shadow-sm transition-all" title="Chỉnh sửa"><span className="material-symbols-outlined notranslate text-[16px]" translate="no">edit</span></button>
                                                    <button onClick={() => handleDelete(labor.id)} className="w-7 h-7 flex items-center justify-center bg-white border border-slate-200 hover:border-rose-400 text-rose-600 hover:bg-rose-50 rounded shadow-sm transition-all" title="Xóa"><span className="material-symbols-outlined notranslate text-[16px]" translate="no">delete</span></button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>

        {/* Excel Import Modal */}
        <ExcelImportModal
            isOpen={showImportModal}
            onClose={() => setShowImportModal(false)}
            title="Import Thầu Phụ / Tổ Đội (Excel)"
            tableName="expense_labor"
            columnMapping={LABOR_COLUMN_MAPPING}
            templateFilename="mau_nhan_cong_thau_phu.xlsx"
            templateSampleRows={LABOR_SAMPLE_ROWS}
            fixedData={{ project_id: project.id }}
            onSuccess={(count) => {
                smartToast(`Đã import thành công ${count} bản ghi Thầu phụ / Nhân công!`);
                fetchLabors();
            }}
        />
        </>
    );
}
