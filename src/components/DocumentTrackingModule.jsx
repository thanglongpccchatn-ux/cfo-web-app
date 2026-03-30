import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useToast } from '../context/ToastContext';
import { logAudit } from '../lib/auditLog';

// Refactored Sub-components
import { getDocStatus, STANDARD_STAGES, parseNum, fmt } from './documentTracking/dtkHelpers';
import SummaryCards from './documentTracking/SummaryCards';
import PaymentHistoryRow from './documentTracking/PaymentHistoryRow';
import DeleteConfirmModal from './documentTracking/DeleteConfirmModal';
import PaymentFormModal from './documentTracking/PaymentFormModal';
import { DocTrackingMobileCard, DocTrackingDesktopRow } from './documentTracking/DocTrackingRows';

import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';

export default function DocumentTrackingModule() {
    const { hasPermission } = useAuth();
    const { sendNotification } = useNotification();
    const queryClient = useQueryClient();

    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [itemToDelete, setItemToDelete] = useState(null);
    const [projectStages, setProjectStages] = useState([]);
    const [duplicateWarning, setDuplicateWarning] = useState('');
    const [filterYear, setFilterYear] = useState('all');
    const [filterMonth, setFilterMonth] = useState('all');
    const [activeTab, setActiveTab] = useState('cdt');
    const [activeEntity, setActiveEntity] = useState('all');
    
    const entityShort = activeEntity === 'thanhphat' ? 'TP' : activeEntity === 'sateco' ? 'ST' : 'TL';
    const entityLabel = activeEntity === 'thanhphat' ? 'Thành Phát' : activeEntity === 'sateco' ? 'Sateco' : 'Thăng Long';

    const [expandedId, setExpandedId] = useState(null);
    const [paymentHistory, setPaymentHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    
    const toast = useToast();

    const [form, setForm] = useState({
        projectId: '',
        paymentCode: '',
        stageName: '',
        requestAmount: '',
        invoiceAmount: '',
        invoiceStatus: 'Chưa xuất',
        requestDate: '',
        dueDate: '',
        notes: '',
        internalPaid: '',
        internalVat: '8'
    });

    const invalidateDocTracking = () => queryClient.invalidateQueries({ queryKey: ['docTrackingPayments'] });

    const { data: data = [], isLoading: loading } = useQuery({
        queryKey: ['docTrackingPayments'],
        queryFn: async () => {
            const { data: payments, error } = await supabase
                .from('payments')
                .select(`
                    *,
                    projects (
                        id, 
                        code, 
                        internal_code,
                        name,
                        acting_entity_key,
                        partners!projects_partner_id_fkey (id, name, code, short_name)
                    )
                `)
                .order('due_date', { ascending: true });
            if (error) {
                console.error('Error fetching document tracking data:', error);
                return [];
            }
            return payments || [];
        },
        staleTime: 5 * 60 * 1000,
    });

    // ── React Query: Projects list ──
    const { data: projects = [] } = useQuery({
        queryKey: ['docTrackingProjects'],
        queryFn: async () => {
            const { data: projs } = await supabase
                .from('projects')
                .select('id, code, internal_code, name, sateco_contract_ratio, sateco_actual_ratio, acting_entity_key, partners!projects_partner_id_fkey(name, code, short_name)')
                .order('code', { ascending: true });
            return projs || [];
        },
        staleTime: 10 * 60 * 1000,
    });

    const handleProjectChange = async (projId) => {
        const selectedProj = projects.find(p => p.id === projId);
        if (!selectedProj) return;

        const { data: existing } = await supabase.from('payments').select('stage_name').eq('project_id', projId);
        const existingStages = existing || [];
        setProjectStages(existingStages);

        let nextStage = STANDARD_STAGES[0];
        if (existingStages.length > 0) {
            const existingNames = existingStages.map(s => s.stage_name);
            let maxIdx = -1;
            existingNames.forEach(name => {
                const idx = STANDARD_STAGES.indexOf(name);
                if (idx > maxIdx) maxIdx = idx;
            });
            if (maxIdx !== -1) {
                const nextIdx = Math.min(maxIdx + 1, STANDARD_STAGES.length - 1);
                nextStage = STANDARD_STAGES[nextIdx];
            }
        }

        setForm(prev => ({
            ...prev,
            projectId: projId,
            stageName: nextStage,
            paymentCode: `${selectedProj.internal_code || selectedProj.code}-${nextStage}`
        }));
        setDuplicateWarning('');
    };

    const handleStageChange = (newStage) => {
        const selectedProj = projects.find(p => p.id === form.projectId);
        const projectCode = selectedProj ? (selectedProj.internal_code || selectedProj.code) : '';
        
        setForm(prev => ({
            ...prev,
            stageName: newStage,
            paymentCode: projectCode ? `${projectCode}-${newStage}` : newStage
        }));

        if (projectStages.some(s => s.stage_name === newStage)) {
            setDuplicateWarning(`⚠️ Đợt "${newStage}" đã tồn tại dữ liệu cho dự án này!`);
        } else {
            setDuplicateWarning('');
        }
    };

    const handleEdit = (item) => {
        setIsEditing(true);
        setEditingId(item.id);
        setForm({
            projectId: item.project_id,
            paymentCode: item.payment_code || '',
            stageName: item.stage_name || '',
            requestAmount: String(item.payment_request_amount || ''),
            invoiceAmount: String(item.invoice_amount || ''),
            invoiceStatus: item.invoice_status || 'Chưa xuất',
            requestDate: item.invoice_date || '',
            dueDate: item.due_date || '',
            notes: item.notes || '',
            internalPaid: String(item.internal_paid || ''),
            internalVat: String(item.internal_vat_percentage ?? 8)
        });
        setShowModal(true);
    };

    const handleDelete = async () => {
        if (!itemToDelete) return;
        
        const { error } = await supabase.from('payments').delete().eq('id', itemToDelete.id);
        if (error) {
            console.error('Delete error details:', error);
            toast.error('Lỗi khi xóa: ' + (error.details || error.message));
        } else {
            logAudit({
                action: 'DELETE',
                tableName: 'payments',
                recordId: itemToDelete.id,
                recordName: `${itemToDelete.payment_code} - ${itemToDelete.stage_name}`
            });
            toast.success('Đã xóa hồ sơ thanh toán');
            setShowDeleteConfirm(false);
            setItemToDelete(null);
            invalidateDocTracking();
        }
    };

    const handleRequestDateChange = (date) => {
        if (!date) return;
        const d = new Date(date);
        d.setDate(d.getDate() + 30);
        const due = d.toISOString().split('T')[0];
        setForm(prev => ({ ...prev, requestDate: date, dueDate: due }));
    };

    async function toggleExpansion(item) {
        if (expandedId === item.id) {
            setExpandedId(null);
            return;
        }

        setExpandedId(item.id);
        setHistoryLoading(true);
        setPaymentHistory([]);

        try {
            const { data: hist, error } = await supabase
                .from('external_payment_history')
                .select('*')
                .eq('payment_stage_id', item.id)
                .order('payment_date', { ascending: false });

            if (error) throw error;
            setPaymentHistory(hist || []);
        } catch (err) {
            console.error('Error fetching history:', err);
            toast.show('Không thể tải lịch sử thanh toán', 'error');
        } finally {
            setHistoryLoading(false);
        }
    }

    async function generateHistory(item) {
        setHistoryLoading(true);
        try {
            const payload = {
                payment_stage_id: item.id,
                amount: Number(item.external_income || 0),
                payment_date: item.invoice_date || new Date().toISOString().split('T')[0],
                description: 'Dữ liệu nhập tổng hợp từ trước'
            };

            const { error } = await supabase.from('external_payment_history').insert([payload]);
            if (error) throw error;

            toast.success('Đã tạo bản ghi lịch sử thành công');
            const { data: hist } = await supabase
                .from('external_payment_history')
                .select('*')
                .eq('payment_stage_id', item.id)
                .order('payment_date', { ascending: false });
            setPaymentHistory(hist || []);
        } catch (err) {
            console.error('Error generating history:', err);
            toast.error('Lỗi khi tạo lịch sử: ' + err.message);
        } finally {
            setHistoryLoading(false);
        }
    }

    const handleNumChange = (field, value) => {
        const cleanValue = value.replace(/[^0-9]/g, '');
        setForm(prev => ({ ...prev, [field]: cleanValue }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const selectedProj = projects.find(p => p.id === form.projectId);
        const contractRatio = selectedProj?.sateco_contract_ratio ? parseFloat(selectedProj.sateco_contract_ratio) / 100 : 0.98;
        const actualRatio = selectedProj?.sateco_actual_ratio ? parseFloat(selectedProj.sateco_actual_ratio) / 100 : 0.955;

        const invoiceAmt = parseNum(form.invoiceAmount) || 0;
        const requestAmt = parseNum(form.requestAmount) || 0;

        const payload = {
            project_id: form.projectId,
            stage_name: form.stageName,
            payment_code: form.paymentCode,
            payment_request_amount: requestAmt,
            invoice_amount: invoiceAmt,
            invoice_status: form.invoiceStatus,
            invoice_date: form.requestDate || null,
            due_date: form.dueDate || null,
            notes: form.notes,
            internal_debt_invoice: Math.round(invoiceAmt * contractRatio),
            internal_debt_actual: Math.round(requestAmt * actualRatio),
            internal_paid: parseNum(form.internalPaid) || 0,
            internal_vat_percentage: Number(form.internalVat) || 8,
            status: isEditing ? undefined : 'Chưa thanh toán'
        };

        let result;
        if (isEditing) {
            result = await supabase.from('payments').update(payload).eq('id', editingId).select();
        } else {
            result = await supabase.from('payments').insert([payload]).select();
        }

        const { error } = result;

        if (error) {
            console.error('Save error:', error);
            if (error.message?.includes('due_date')) {
                toast.error('LỖI DATABASE: Thiếu cột "due_date". Vui lòng chạy file SQL Migration tôi đã gửi.');
            } else {
                toast.error('Lỗi khi lưu: ' + error.message);
            }
        } else {
            let recordId = isEditing ? editingId : null;
            if (result.data && result.data[0]) recordId = result.data[0].id;
            
            // Send Notification for new payments
            if (!isEditing && form.requestAmount) {
                sendNotification(
                    'edit_payments',
                    'Đề nghị thanh toán mới',
                    `Có một hồ sơ thanh toán mới (${form.paymentCode}) trị giá ${form.requestAmount} đang chờ xử lý.`,
                    'APPROVAL',
                    '#payments'
                );
            }

            logAudit({
                action: isEditing ? 'UPDATE' : 'CREATE',
                tableName: 'payments',
                recordId: recordId,
                recordName: `${payload.payment_code} - ${payload.stage_name}`,
                changes: isEditing ? { invoice_amount: { new: payload.invoice_amount }, payment_request_amount: { new: payload.payment_request_amount } } : null
            });

            toast.success(isEditing ? 'Đã cập nhật hồ sơ thanh toán' : 'Đã tạo hồ sơ thanh toán mới');
            setShowModal(false);
            setIsEditing(false);
            setEditingId(null);
            invalidateDocTracking();
            setForm({
                projectId: '', paymentCode: '', stageName: '',
                requestAmount: '', invoiceAmount: '', invoiceStatus: 'Chưa xuất',
                requestDate: '', dueDate: '', notes: '',
                internalPaid: '', internalVat: '8'
            });
            setProjectStages([]);
            setDuplicateWarning('');
        }
    };

    const filtered = data.filter(item => {
        const matchesSearch = 
            item.projects?.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.projects?.internal_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.projects?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.payment_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.stage_name?.toLowerCase().includes(searchTerm.toLowerCase());

        const projEntity = (item.projects?.acting_entity_key || 'thanglong').toLowerCase();
        const matchesEntity = activeEntity === 'all' || activeEntity === 'sateco' || projEntity === activeEntity;
        
        // Date Filter (CEO Logic: Filter by Due Date for Cash Flow Projection)
        let matchesDate = true;
        if (item.due_date) {
            const d = new Date(item.due_date);
            const y = d.getFullYear().toString();
            const m = (d.getMonth() + 1).toString();
            
            if (filterYear !== 'all' && y !== filterYear) matchesDate = false;
            if (filterMonth !== 'all' && m !== filterMonth) matchesDate = false;
        } else if (filterYear !== 'all' || filterMonth !== 'all') {
            matchesDate = false;
        }

        return matchesSearch && matchesEntity && matchesDate;
    });

    return (
        <div className="p-6 max-w-[1600px] mx-auto animate-fade-in space-y-6">
            {/* Entity Navigation Bar */}
            <div className="flex items-center gap-4 md:gap-6 mb-2 overflow-x-auto pb-1">
                {[
                    { id: 'all', label: 'TẤT CẢ GROUP', icon: 'hub' },
                    { id: 'thanglong', label: 'THĂNG LONG', icon: 'corporate_fare' },
                    { id: 'thanhphat', label: 'THÀNH PHÁT', icon: 'business' },
                    { id: 'sateco', label: 'SATECO (CORE)', icon: 'verified_user' },
                ].map(entity => (
                    <button
                        key={entity.id}
                        onClick={() => setActiveEntity(entity.id)}
                        className={`flex items-center gap-1.5 md:gap-2 px-1 py-3 transition-all relative whitespace-nowrap ${
                            activeEntity === entity.id 
                            ? 'text-blue-600 font-black' 
                            : 'text-slate-400 hover:text-slate-600 font-bold'
                        }`}
                    >
                        <span className={`material-symbols-outlined notranslate text-[18px] md:text-[20px] ${activeEntity === entity.id ? 'text-blue-600' : 'text-slate-300'}`} translate="no">
                            {entity.icon}
                        </span>
                        <span className="text-[10px] md:text-xs uppercase tracking-widest">{entity.label}</span>
                        {activeEntity === entity.id && (
                            <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-600 rounded-t-full shadow-[0_-2px_8px_rgba(37,99,235,0.4)]"></div>
                        )}
                    </button>
                ))}
            </div>

            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full -mr-16 -mt-16 opacity-50"></div>
                
                <div className="relative z-10">
                    <h1 className="text-xl md:text-2xl font-black text-slate-800 flex items-center gap-2 md:gap-3">
                        <span className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-200 flex-shrink-0">
                            <span className="material-symbols-outlined notranslate text-[20px] md:text-[24px]" translate="no">description</span>
                        </span>
                        Theo dõi Hồ sơ & Thanh toán
                    </h1>
                    <p className="text-slate-500 text-[10px] md:text-sm mt-1 font-medium italic ml-10 md:ml-[52px]">Quản lý tập trung công nợ và hóa đơn</p>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto relative z-10">
                    <div className="relative flex-1 min-w-full sm:min-w-[200px]">
                         <span className="material-symbols-outlined notranslate absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]" translate="no">search</span>
                         <input 
                            type="text" 
                            placeholder="Mã HĐ, dự án..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 focus:border-blue-500 outline-none transition-all text-xs md:text-sm font-medium bg-slate-50/30"
                         />
                    </div>

                    <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1 -mx-1 px-1 scrollbar-none">
                        <select 
                            value={filterMonth}
                            onChange={(e) => setFilterMonth(e.target.value)}
                            className="pl-3 pr-8 py-2 md:py-2.5 rounded-xl border border-slate-200 text-[10px] md:text-xs font-bold text-slate-600 outline-none bg-white hover:border-blue-400 transition-colors cursor-pointer shadow-sm appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M5%208l5%205%205-5%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%222%22%20fill%3D%22none%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2Fc%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:right_8px_center] bg-[size:14px]"
                        >
                            <option value="all">Tháng</option>
                            {Array.from({length: 12}, (_, i) => (
                                <option key={i+1} value={(i+1).toString()}>{i+1}</option>
                            ))}
                        </select>

                        <select 
                            value={filterYear}
                            onChange={(e) => setFilterYear(e.target.value)}
                            className="pl-3 pr-8 py-2 md:py-2.5 rounded-xl border border-slate-200 text-[10px] md:text-xs font-bold text-slate-600 outline-none bg-white hover:border-blue-400 transition-colors cursor-pointer shadow-sm appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M5%208l5%205%205-5%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%222%22%20fill%3D%22none%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2Fc%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:right_8px_center] bg-[size:14px]"
                        >
                            <option value="all">Năm</option>
                            {Array.from({length: 5}, (_, i) => (new Date().getFullYear() - 2 + i).toString()).map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>
                    
                    {hasPermission('create_payments') && (
                        <button 
                            onClick={() => {
                                setIsEditing(false);
                                setEditingId(null);
                                setForm({
                                    projectId: '', paymentCode: '', stageName: '',
                                    requestAmount: '', invoiceAmount: '', invoiceStatus: 'Chưa xuất',
                                    requestDate: '', dueDate: '', notes: '',
                                    internalPaid: '', internalVat: '8'
                                });
                                setProjectStages([]);
                                setDuplicateWarning('');
                                setShowModal(true);
                            }}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-black text-sm flex items-center gap-2 shadow-lg shadow-emerald-100 transition-all active:scale-95"
                        >
                            <span className="material-symbols-outlined notranslate text-[20px]" translate="no">add_circle</span>
                            TẠO HỒ SƠ MỚI
                        </button>
                    )}

                    <button onClick={invalidateDocTracking} className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors text-slate-600">
                         <span className="material-symbols-outlined notranslate block" translate="no">refresh</span>
                    </button>
                </div>
            </header>

            {/* Tabs Navigation */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl w-full md:w-fit border border-slate-200 shadow-inner overflow-x-auto">
                <button 
                    onClick={() => setActiveTab('cdt')}
                    className={`flex items-center gap-1.5 md:gap-2 px-4 md:px-6 py-2.5 rounded-xl text-xs md:text-sm font-black transition-all whitespace-nowrap ${activeTab === 'cdt' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    <span className="material-symbols-outlined notranslate text-[18px] md:text-[20px]" translate="no">business_center</span>
                    Hồ sơ & Thanh toán CĐT
                </button>
                <button 
                    onClick={() => setActiveTab('internal')}
                    className={`flex items-center gap-1.5 md:gap-2 px-4 md:px-6 py-2.5 rounded-xl text-xs md:text-sm font-black transition-all whitespace-nowrap ${activeTab === 'internal' ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    <span className="material-symbols-outlined notranslate text-[18px] md:text-[20px]" translate="no">sync_alt</span>
                    TT Nội bộ ({activeEntity === 'all' ? 'Group' : entityShort} - Sateco)
                </button>
            </div>

            {/* Overall Statistics Component */}
            <SummaryCards filtered={filtered} activeEntity={activeEntity} />

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[400px]">
                {/* Mobile Card View */}
                <div className="block lg:hidden space-y-3 p-3 bg-slate-50/50">
                    {loading ? (
                        [1,2,3].map(i => <div key={i} className="h-40 bg-white rounded-2xl animate-pulse" />)
                    ) : filtered.length === 0 ? (
                        <div className="py-20 text-center text-slate-400 italic text-sm px-4">Không tìm thấy dữ liệu phù hợp</div>
                    ) : filtered.map(item => (
                        <DocTrackingMobileCard
                            key={item.id}
                            item={item}
                            activeEntity={activeEntity}
                            expandedId={expandedId}
                            toggleExpansion={toggleExpansion}
                            historyLoading={historyLoading}
                            paymentHistory={paymentHistory}
                            hasPermission={hasPermission}
                            onEdit={handleEdit}
                            onDelete={(itm) => { setItemToDelete(itm); setShowDeleteConfirm(true); }}
                        />
                    ))}
                </div>

                {/* Desktop Table View */}
                <div className="hidden lg:block overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100 text-[12px] font-bold text-slate-500 uppercase tracking-tight">
                                <th className="px-3 py-3 whitespace-nowrap">Mã hợp đồng {entityShort}</th>
                                {activeTab === 'cdt' && <th className="px-3 py-3 whitespace-nowrap">Mã đối tác</th>}
                                <th className="px-3 py-3 whitespace-nowrap">Đợt thanh toán</th>
                                
                                {activeTab === 'cdt' ? (
                                    <>
                                        <th className="px-3 py-3 whitespace-nowrap text-right">Giá trị xuất HĐ</th>
                                        <th className="px-3 py-3 whitespace-nowrap">Ngày xuất HĐ</th>
                                        <th className="px-3 py-3 whitespace-nowrap">Trạng thái HĐ</th>
                                        <th className="px-3 py-3 whitespace-nowrap text-right">Giá trị ĐNTT</th>
                                        <th className="px-3 py-3 whitespace-nowrap text-right">Thực thu</th>
                                        <th className="px-3 py-3 whitespace-nowrap text-right">Chênh lệch HĐ</th>
                                        <th className="px-3 py-3 whitespace-nowrap">Trạng thái trả</th>
                                        <th className="px-3 py-3 whitespace-nowrap">Ngày đến hạn</th>
                                        <th className="px-3 py-3 whitespace-nowrap text-right">Còn lại</th>
                                    </>
                                ) : (
                                    <>
                                        <th className="px-3 py-3 whitespace-nowrap text-right bg-blue-50/50 text-blue-700">{entityShort} Nợ (Thuế)</th>
                                        <th className="px-3 py-3 whitespace-nowrap text-right bg-indigo-50/50 text-indigo-700">Sateco Nợ (Nội bộ)</th>
                                        <th className="px-3 py-3 whitespace-nowrap text-right font-black">Tổng Công nợ</th>
                                        <th className="px-3 py-3 whitespace-nowrap text-right text-emerald-600">{entityShort} Đã chuyển</th>
                                        <th className="px-3 py-3 whitespace-nowrap text-right text-rose-600">Còn nợ Tổng</th>
                                    </>
                                )}
                                <th className="px-3 py-3 whitespace-nowrap text-center">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                [1,2,3,4,5].map(i => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan="13" className="px-6 py-4"><div className="h-10 bg-slate-100 rounded-lg"></div></td>
                                    </tr>
                                ))
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan="13" className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center gap-2">
                                            <span className="material-symbols-outlined notranslate text-4xl text-slate-200" translate="no">data_alert</span>
                                            <p className="text-slate-400 font-medium italic">Không tìm thấy dữ liệu phù hợp</p>
                                        </div>
                                    </td>
                                </tr>
                             ) : filtered.map((item) => (
                                <DocTrackingDesktopRow
                                    key={item.id}
                                    item={item}
                                    activeEntity={activeEntity}
                                    activeTab={activeTab}
                                    entityShort={entityShort}
                                    expandedId={expandedId}
                                    toggleExpansion={toggleExpansion}
                                    historyLoading={historyLoading}
                                    paymentHistory={paymentHistory}
                                    generateHistory={generateHistory}
                                    hasPermission={hasPermission}
                                    onEdit={handleEdit}
                                    onDelete={(itm) => { setItemToDelete(itm); setShowDeleteConfirm(true); }}
                                />
                             ))}
                         </tbody>
                     </table>
                 </div>
             </div>

             <PaymentFormModal
                 showModal={showModal} setShowModal={setShowModal} isEditing={isEditing}
                 form={form} setForm={setForm} projects={projects}
                 activeEntity={activeEntity} entityLabel={entityLabel}
                 STANDARD_STAGES={STANDARD_STAGES}
                 handleProjectChange={handleProjectChange} handleStageChange={handleStageChange}
                 handleNumChange={handleNumChange} handleRequestDateChange={handleRequestDateChange}
                 handleSubmit={handleSubmit} duplicateWarning={duplicateWarning}
             />

             <DeleteConfirmModal
                 showDeleteConfirm={showDeleteConfirm} setShowDeleteConfirm={setShowDeleteConfirm}
                 itemToDelete={itemToDelete} handleDelete={handleDelete}
             />
        </div>
    );
}
