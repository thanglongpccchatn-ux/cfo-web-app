import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import ExcelImportModal from './ExcelImportModal';
import LaborRequestModal from './LaborRequestModal';
import LaborPaymentModal from './LaborPaymentModal';
import { smartToast } from '../utils/globalToast';

export default function LaborTracking({ project, onBack, embedded }) {
    const [labors, setLabors] = useState([]);
    const [showImportModal, setShowImportModal] = useState(false);
    const [showRequestModal, setShowRequestModal] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [selectedLabor, setSelectedLabor] = useState(null);
    const [filterProjectId, setFilterProjectId] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');
    const queryClient = useQueryClient();

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

    // ── React Query: Labors ──
    const { isLoading: loading } = useQuery({
        queryKey: ['labors', project?.id, filterProjectId],
        queryFn: async () => {
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
            if (error) throw error;
            setLabors(data || []);
            return data || [];
        },
        staleTime: 2 * 60 * 1000,
    });

    // ── React Query: Projects (for filter dropdown) ──
    const { data: projects = [] } = useQuery({
        queryKey: ['laborProjects'],
        queryFn: async () => {
            const { data } = await supabase.from('projects').select('id, name, code, internal_code').order('name');
            return data || [];
        },
        staleTime: 5 * 60 * 1000,
        enabled: !project,
    });

    const handleOpenPaymentModal = (labor) => {
        setSelectedLabor(labor);
        setShowPaymentModal(true);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Xóa bản ghi thanh toán thầu phụ này?')) return;
        const { error } = await supabase.from('expense_labor').delete().eq('id', id);
        if (!error) {
            smartToast('Đã xóa thành công!', 'success');
            queryClient.invalidateQueries({ queryKey: ['labors'] });
        }
    };

    const handleSuccess = () => {
        smartToast('Thao tác thành công!', 'success');
        queryClient.invalidateQueries({ queryKey: ['labors'] });
    };

    const formatCurrency = (val) => new Intl.NumberFormat('vi-VN').format(Math.round(val || 0));
    const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString('vi-VN') : '—';

    // Filter by status
    const filteredLabors = labors.filter(l => {
        if (filterStatus === 'all') return true;
        return l.status === filterStatus;
    });

    // Summary Calculations
    const totalRequestedValue = labors.filter(l => !l.isNew).reduce((sum, l) => sum + Number(l.requested_amount), 0);
    const totalPaidValue = labors.filter(l => !l.isNew).reduce((sum, l) => sum + Number(l.paid_amount), 0);
    const totalDebtValue = totalRequestedValue - totalPaidValue;
    const pendingCount = labors.filter(l => l.status === 'PENDING' || (!l.status && Number(l.paid_amount) === 0)).length;

    // Status Badge helper
    const StatusBadge = ({ status, paidAmount }) => {
        const isPaid = status === 'PAID' || (Number(paidAmount) > 0);
        return (
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all ${
                isPaid
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm'
                    : 'bg-amber-50 text-amber-700 border-amber-200 shadow-sm animate-pulse'
            }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isPaid ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                {isPaid ? 'Đã Chi' : 'Chờ Chi'}
            </span>
        );
    };

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
                                        className="bg-purple-50 border border-purple-200 text-purple-700 px-3 py-1 rounded-full text-[12px] font-black focus:ring-2 focus:ring-purple-500 outline-none transition-all cursor-pointer hover:bg-purple-100"
                                    >
                                        <option value="all">Tất cả dự án (Toàn cục)</option>
                                        {projects.map(p => <option key={p.id} value={p.id}>Dự án: {p.code}</option>)}
                                    </select>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex gap-3 items-center">
                    {/* KPI Cards */}
                    <div className="hidden xl:flex bg-slate-50 rounded-xl border border-slate-200 divide-x divide-slate-200 shadow-sm overflow-hidden">
                        <div className="px-4 py-2 hover:bg-white transition-colors bg-amber-50/30">
                            <div className="text-[9px] text-amber-600 font-bold uppercase tracking-widest mb-0.5 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                Chờ Chi
                            </div>
                            <div className="font-black text-amber-700 text-lg tabular-nums tracking-tight">{pendingCount}</div>
                        </div>
                        <div className="px-4 py-2 hover:bg-white transition-colors bg-blue-50/30">
                            <div className="text-[9px] text-blue-600 font-bold uppercase tracking-widest mb-0.5">Đề Nghị</div>
                            <div className="font-black text-blue-700 text-lg tabular-nums tracking-tight">{formatCurrency(totalRequestedValue)}</div>
                        </div>
                        <div className="px-4 py-2 hover:bg-white transition-colors bg-green-50/30">
                            <div className="text-[9px] text-green-600 font-bold uppercase tracking-widest mb-0.5">Đã Trả</div>
                            <div className="font-black text-green-700 text-lg tabular-nums tracking-tight">{formatCurrency(totalPaidValue)}</div>
                        </div>
                        <div className="px-4 py-2 hover:bg-white transition-colors bg-rose-50/30">
                            <div className="text-[9px] text-rose-500 font-bold uppercase tracking-widest mb-0.5">Còn Nợ</div>
                            <div className="font-black text-rose-600 text-lg tabular-nums tracking-tight">{formatCurrency(totalDebtValue)}</div>
                        </div>
                    </div>

                    {/* Status filter */}
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="bg-white border border-slate-200 text-slate-700 px-3 py-2 rounded-xl text-[12px] font-bold focus:ring-2 focus:ring-purple-500 outline-none transition-all cursor-pointer hover:border-purple-300 shadow-sm h-10"
                    >
                        <option value="all">Tất cả trạng thái</option>
                        <option value="PENDING">🟠 Chờ Chi</option>
                        <option value="PAID">🟢 Đã Chi</option>
                    </select>

                    <button
                        onClick={() => setShowImportModal(true)}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-emerald-300 text-emerald-700 font-bold text-sm hover:bg-emerald-50 transition-all shadow-sm h-10"
                    >
                        <span className="material-symbols-outlined notranslate text-[18px]" translate="no">upload_file</span>
                        <span className="hidden lg:inline">Import</span>
                    </button>
                    <button
                        onClick={() => setShowRequestModal(true)}
                        className="btn bg-purple-600 hover:bg-purple-700 text-white font-bold shadow-md shadow-purple-500/20 px-5 flex items-center gap-2 h-10"
                    >
                        <span className="material-symbols-outlined notranslate text-[20px]" translate="no">add_task</span>
                        TẠO YÊU CẦU
                    </button>
                </div>
            </div>

            {/* Main Area */}
            <div className="flex-1 overflow-auto bg-slate-50/50 p-6 gap-4">
                {/* Mobile Card View */}
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
                                        <div className="text-[14px] font-black text-indigo-700 tabular-nums">{formatCurrency(labor.requested_amount)}</div>
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
                                        Nợ: {formatCurrency(Number(labor.requested_amount) - Number(labor.paid_amount))}
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

                {/* Desktop Table View */}
                <div className={`hidden xl:block bg-white ${embedded ? '' : 'rounded-xl shadow-sm border border-slate-200'} pb-20 ring-1 ring-slate-200/50`}>
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
                                        <tr key={labor.id} className={`group transition-colors cursor-default ${
                                            isPaid ? 'hover:bg-emerald-50/30' : 'hover:bg-amber-50/30 bg-amber-50/5'
                                        }`}>
                                            <td className="px-3 py-2.5 text-center text-slate-400 font-medium">{index + 1}</td>
                                            <td className="px-3 py-2.5 text-center">
                                                <StatusBadge status={labor.status} paidAmount={labor.paid_amount} />
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <div className="flex flex-col gap-0.5 max-w-[220px]">
                                                    <span className="text-purple-700 text-[10px] uppercase font-black truncate">
                                                        {labor.projects?.code ? `[${labor.projects.code}]` : ''}
                                                    </span>
                                                    <span className="font-bold text-slate-800 truncate" title={labor.team_name}>{labor.team_name}</span>
                                                    {labor.priority && labor.priority !== 'Bình thường' && (
                                                        <span className={`inline-flex items-center w-fit px-1.5 py-0.5 rounded text-[9px] font-black uppercase border ${
                                                            labor.priority === 'Khẩn cấp' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-orange-50 text-orange-700 border-orange-200'
                                                        }`}>
                                                            {labor.priority === 'Khẩn cấp' && <span className="material-symbols-outlined notranslate text-[10px] mr-0.5" translate="no">emergency</span>}
                                                            {labor.priority}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-3 py-2.5 text-center">
                                                <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px] font-bold text-slate-600 uppercase">{labor.payment_stage}</span>
                                            </td>
                                            <td className="px-3 py-2.5 text-center text-slate-600 font-medium">{formatDate(labor.request_date)}</td>
                                            <td className="px-3 py-2.5 text-right text-orange-600 tabular-nums bg-orange-50/20">{formatCurrency(labor.completed_previous)}</td>
                                            <td className="px-3 py-2.5 text-right font-bold text-orange-700 tabular-nums bg-orange-50/20">{formatCurrency(labor.completed_current)}</td>
                                            <td className="px-3 py-2.5 text-right font-bold text-indigo-700 tabular-nums bg-indigo-50/20 text-[13px]">{formatCurrency(labor.requested_amount)}</td>
                                            <td className="px-3 py-2.5 text-right bg-emerald-50/20">
                                                <div className="flex flex-col items-end gap-0.5">
                                                    <span className="font-black text-emerald-700 tabular-nums text-[13px]">{Number(labor.paid_amount) > 0 ? formatCurrency(labor.paid_amount) : '—'}</span>
                                                    {isPaid && labor.payment_date && (
                                                        <span className="text-slate-400 text-[9px]">{formatDate(labor.payment_date)}</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-3 py-2.5 text-slate-500 text-[11px] truncate max-w-[150px]" title={labor.notes}>{labor.notes}</td>
                                            <td className="px-1.5 py-2.5 text-center">
                                                <div className="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {!isPaid && (
                                                        <button onClick={() => handleOpenPaymentModal(labor)}
                                                            className="w-7 h-7 flex items-center justify-center bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-600 rounded shadow-sm transition-all"
                                                            title="Xác nhận thanh toán">
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
            </div>
        </div>

        {/* Modals */}
        <LaborRequestModal
            isOpen={showRequestModal}
            onClose={() => setShowRequestModal(false)}
            onSuccess={handleSuccess}
            project={project}
            projects={projects}
        />

        <LaborPaymentModal
            isOpen={showPaymentModal}
            onClose={() => { setShowPaymentModal(false); setSelectedLabor(null); }}
            onSuccess={handleSuccess}
            labor={selectedLabor}
        />

        {/* Excel Import Modal */}
        <ExcelImportModal
            isOpen={showImportModal}
            onClose={() => setShowImportModal(false)}
            title="Import Thầu Phụ / Tổ Đội (Excel)"
            tableName="expense_labor"
            columnMapping={LABOR_COLUMN_MAPPING}
            templateFilename="mau_nhan_cong_thau_phu.xlsx"
            templateSampleRows={LABOR_SAMPLE_ROWS}
            fixedData={{ project_id: project ? project.id : (filterProjectId !== 'all' ? filterProjectId : null) }}
            onSuccess={(count) => {
                smartToast(`Đã import thành công ${count} bản ghi Thầu phụ / Nhân công!`);
                queryClient.invalidateQueries({ queryKey: ['labors'] });
            }}
        />
        </>
    );
}
