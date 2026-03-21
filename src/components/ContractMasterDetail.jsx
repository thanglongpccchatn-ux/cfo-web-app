import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import ContractDetailedDashboard from './ContractDetailedDashboard';
import ExcelImportModal from './ExcelImportModal';
import { useToast } from '../context/ToastContext';

export default function ContractMasterDetail({ onOpenFullscreen }) {
    const [view, setView] = useState('list');
    const [selectedProject, setSelectedProject] = useState(null);
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());
    const [filterMonth, setFilterMonth] = useState('all');
    const [activeEntity, setActiveEntity] = useState('all'); // all, thanglong, sateco, thanhphat
    const [isAdmin, setIsAdmin] = useState(true); // Default to true for now as per Sidebar, but we will add a check if possible
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState(null); // { id, name }
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
    const toast = useToast();

    const projectMapping = {
        code: "Mã DA",
        name: "Tên dự án",
        client: "Chủ đầu tư / Tổng thầu",
        project_type: "Loại hình",
        location: "Địa điểm",
        manager: "Người quản lý",
        original_value: "Giá trị hợp đồng",
        sateco_contract_ratio: "Tỷ lệ Khoán Sateco (%)",
        sateco_actual_ratio: "Tỷ lệ Thực tế Sateco (%)",
        status: "Trạng thái"
    };

    const handleDeleteProject = async (projId, projName) => {
        console.log('Finalizing deletion for project:', projId, projName);
        setDeleteConfirm(null); // Close modal
        
        try {
            toast.info('Đang thực hiện xóa...');
            console.log('Cleaning up inventory records...');
            // Manual cleanup for tables missing ON DELETE CASCADE
            const { data: receipts } = await supabase.from('inventory_receipts').select('id').eq('project_id', projId);
            const receiptIds = receipts?.map(r => r.id) || [];
            
            if (receiptIds.length > 0) {
                console.log('Deleting receipt items for receipts:', receiptIds);
                await supabase.from('inventory_receipt_items').delete().in('receipt_id', receiptIds);
                await supabase.from('inventory_receipts').delete().in('id', receiptIds);
            }
            
            const { data: requests } = await supabase.from('inventory_requests').select('id').eq('project_id', projId);
            const requestIds = requests?.map(r => r.id) || [];
            
            if (requestIds.length > 0) {
                console.log('Deleting request items for requests:', requestIds);
                await supabase.from('inventory_request_items').delete().in('request_id', requestIds);
                await supabase.from('inventory_requests').delete().in('id', requestIds);
            }

            console.log('Deleting main project record...');
            // Finally delete the project (other tables like addendas, payments, expenses have CASCADE)
            const { error } = await supabase
                .from('projects')
                .delete()
                .eq('id', projId);

            if (error) throw error;

            console.log('Project deleted successfully');
            setProjects(projects.filter(p => p.id !== projId));
            toast.success('Đã xóa hợp đồng thành công.');
        } catch (error) {
            console.error('Error in handleDeleteProject:', error);
            toast.error('Lỗi khi xóa hợp đồng: ' + (error.message || 'Lỗi không xác định'));
        }
    };

    useEffect(() => { fetchProjects(); }, []);

    const fetchProjects = async () => {
        setLoading(true);
        const { data: projs } = await supabase
            .from('projects')
            .select('*, partners!projects_partner_id_fkey(name, code, short_name)')
            .order('created_at', { ascending: false });

        const { data: adds } = await supabase.from('addendas')
            .select('project_id, requested_value').eq('status', 'Đã duyệt');

        const { data: pmts } = await supabase.from('payments')
            .select('project_id, expected_amount, external_income, invoice_amount, payment_request_amount');

        if (projs) {
            const enhanced = projs.map(p => {
                const projAdds = (adds || []).filter(a => a.project_id === p.id);
                const addendaValue = projAdds.reduce((s, a) => s + Number(a.requested_value), 0);
                const projPmts = (pmts || []).filter(pm => pm.project_id === p.id);
                
                // Calculations for Financial Columns
                const totalValuePreVat = Number(p.original_value) || 0;
                const vatAmount = p.vat_amount || (totalValuePreVat * (p.vat_percentage ?? 8) / 100);
                const totalValuePostVat = p.total_value_post_vat || (totalValuePreVat + vatAmount);
                
                const totalInvoice = projPmts.reduce((s, pm) => s + Number(pm.invoice_amount || 0), 0);
                const totalRequested = projPmts.reduce((s, pm) => s + Number(pm.payment_request_amount || 0), 0);
                const totalIncome = projPmts.reduce((s, pm) => s + Number(pm.external_income || 0), 0);
                
                const debtInvoice = totalInvoice - totalIncome;
                const debtPayment = totalValuePostVat - totalIncome;
                
                const incomeProgress = totalValuePostVat > 0 ? Math.min(100, (totalIncome / totalValuePostVat) * 100) : 0;

                return { 
                    ...p, 
                    addendaValue, 
                    totalIncome, 
                    totalInvoice, 
                    totalRequested,
                    totalValuePreVat,
                    vatAmount,
                    totalValuePostVat,
                    debtInvoice,
                    debtPayment,
                    incomeProgress,
                    totalThangLong: totalValuePreVat + addendaValue,
                    satecoContractRatio: p.sateco_contract_ratio || 98,
                    satecoActualRatio: p.sateco_actual_ratio || 95.5,
                    acting_entity_key: p.acting_entity_key || 'thanglong', // Default to TL for old data
                    satecoInternalRevenue: (totalValuePostVat * (p.sateco_contract_ratio || 98) / 100),
                    satecoDueFromGroup: (totalIncome * (p.sateco_contract_ratio || 98) / 100)
                };
            });
            setProjects(enhanced);
        } else {
            setProjects([]);
        }
        setLoading(false);
    };

    const handleViewDetail = (proj) => {
        setSelectedProject(proj);
        setView('detail');
    };

    const formatDate = (d) => d ? new Date(d).toLocaleDateString('vi-VN') : '-';

    const statusOptionsList = ['Đang thi công', 'Đã hoàn thành', 'Bảo hành', 'Tạm dừng', 'Chưa thi công'];

    const getStatusColor = (status) => {
        switch (status) {
            case 'Đang thi công': return 'bg-blue-50 text-blue-700 border-blue-200';
            case 'Đã hoàn thành': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
            case 'Bảo hành': return 'bg-amber-50 text-amber-700 border-amber-200';
            case 'Tạm dừng': return 'bg-rose-50 text-rose-700 border-rose-200';
            case 'Chưa thi công': return 'bg-slate-50 text-slate-700 border-slate-200';
            default: return 'bg-slate-50 text-slate-700 border-slate-200';
        }
    };

    const handleStatusChange = async (projectId, newStatus, e) => {
        if (e) e.stopPropagation();
        try {
            const { error } = await supabase
                .from('projects')
                .update({ status: newStatus })
                .eq('id', projectId);
            
            if (error) throw error;
            
            setProjects(projects.map(p => p.id === projectId ? { ...p, status: newStatus } : p));
            toast.success(`Đã cập nhật trạng thái sang "${newStatus}"`);
        } catch (error) {
            console.error('Error updating status:', error);
            toast.error('Lỗi khi cập nhật trạng thái: ' + error.message);
        }
    };

    const handleImportSuccess = (count) => {
        toast.success(`Đã import thành công ${count} dự án!`);
        fetchProjects();
    };

    const filteredProjects = projects.filter(p => {
        const q = searchTerm.toLowerCase();
        const matchSearch = !q || 
            p.name?.toLowerCase().includes(q) || 
            p.code?.toLowerCase().includes(q) || 
            p.internal_code?.toLowerCase().includes(q) ||
            p.client?.toLowerCase().includes(q);
        const matchStatus = statusFilter === 'All' || p.status === statusFilter;
        
        // Date Filter (CEO Logic: Filter by Contract Month/Year based on created_at)
        let matchDate = true;
        if (p.created_at) {
            const d = new Date(p.created_at);
            const y = d.getFullYear().toString();
            const m = (d.getMonth() + 1).toString();
            
            if (filterYear !== 'all' && y !== filterYear) matchDate = false;
            if (filterMonth !== 'all' && m !== filterMonth) matchDate = false;
        }

        // Sateco Core tab sees everything (as internal contracts)
        const matchEntity = activeEntity === 'all' || activeEntity === 'sateco' || p.acting_entity_key === activeEntity;
        
        return matchSearch && matchStatus && matchEntity && matchDate;
    });

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
        setSortConfig({ key, direction });
    };

    const sortedProjects = [...filteredProjects].sort((a, b) => {
        if (!sortConfig.key) return 0;
        let aVal = a[sortConfig.key];
        let bVal = b[sortConfig.key];

        if (sortConfig.key === 'partnerCode') {
            aVal = activeEntity === 'sateco' && a.acting_entity_key !== 'sateco' ? 'Z_SATECO_NB' : (a.partners?.code || a.partners?.short_name || a.client || '');
            bVal = activeEntity === 'sateco' && b.acting_entity_key !== 'sateco' ? 'Z_SATECO_NB' : (b.partners?.code || b.partners?.short_name || b.client || '');
        } else if (sortConfig.key === 'preVat') {
            aVal = activeEntity === 'sateco' && a.acting_entity_key !== 'sateco' ? a.satecoInternalRevenue / (1 + (a.internal_vat_percentage ?? 8) / 100) : a.totalValuePreVat;
            bVal = activeEntity === 'sateco' && b.acting_entity_key !== 'sateco' ? b.satecoInternalRevenue / (1 + (b.internal_vat_percentage ?? 8) / 100) : b.totalValuePreVat;
        } else if (sortConfig.key === 'vatPercent') {
            aVal = activeEntity === 'sateco' && a.acting_entity_key !== 'sateco' ? (a.internal_vat_percentage ?? 8) : (a.vat_percentage ?? 8);
            bVal = activeEntity === 'sateco' && b.acting_entity_key !== 'sateco' ? (b.internal_vat_percentage ?? 8) : (b.vat_percentage ?? 8);
        } else if (sortConfig.key === 'postVat') {
            aVal = activeEntity === 'sateco' && a.acting_entity_key !== 'sateco' ? a.satecoInternalRevenue : a.totalValuePostVat;
            bVal = activeEntity === 'sateco' && b.acting_entity_key !== 'sateco' ? b.satecoInternalRevenue : b.totalValuePostVat;
        } else if (sortConfig.key === 'code') {
            aVal = a.internal_code || a.code || '';
            bVal = b.internal_code || b.code || '';
        } else if (sortConfig.key === 'debtPayment') {
            aVal = a.totalRequested - a.totalIncome;
            bVal = b.totalRequested - b.totalIncome;
        }

        if (aVal === undefined || aVal === null) aVal = '';
        if (bVal === undefined || bVal === null) bVal = '';

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });

    // Sateco Specific Totals for Sateco Tab
    const totalSatecoRevenueAll = filteredProjects.reduce((s, p) => s + (p.satecoInternalRevenue || 0), 0);
    const totalSatecoCashInAll = filteredProjects.reduce((s, p) => s + (p.acting_entity_key === 'sateco' ? p.totalIncome : (p.internal_paid || 0)), 0);
    const totalSatecoDueFromTL = filteredProjects.filter(p => (p.acting_entity_key || '').toLowerCase() === 'thanglong').reduce((s, p) => s + (p.satecoInternalRevenue - (p.internal_paid || 0)), 0);
    const totalSatecoDueFromTP = filteredProjects.filter(p => (p.acting_entity_key || '').toLowerCase() === 'thanhphat').reduce((s, p) => s + (p.satecoInternalRevenue - (p.internal_paid || 0)), 0);

    // === AGGREGATE PERFORMANCE KPIs ===
    const projectsWithData = filteredProjects.filter(p => (parseFloat(p.totalValuePostVat) || 0) > 0);
    const count = projectsWithData.length || 1;

    const avg_lng_dt = projectsWithData.reduce((acc, p) => {
        const satecoNetProfit = (p.totalIncome * (parseFloat(p.sateco_actual_ratio || 95.5) / 100)) - (p.totalExpensesSateco || 0);
        return acc + (p.satecoInternalRevenue > 0 ? (satecoNetProfit / p.satecoInternalRevenue) * 100 : 0);
    }, 0) / count;

    const avg_sl_cp = projectsWithData.reduce((acc, p) => {
        return acc + (p.totalInvoice > 0 ? (((p.totalInvoice || 0) - (p.totalExpensesSateco || 0)) / p.totalInvoice) * 100 : 0);
    }, 0) / count;

    const avg_spi = projectsWithData.reduce((acc, p) => {
        const today = new Date();
        const start = new Date(p.start_date);
        const end = new Date(p.end_date);
        const total = Math.max(1, (end - start) / 86400000);
        const passed = Math.max(0, (today - start) / 86400000);
        const planned = (p.satecoInternalRevenue || 0) * Math.min(1, passed / total);
        return acc + (planned > 0 ? (p.totalInvoice / planned) : 1);
    }, 0) / count;

    const avg_dt_sl = projectsWithData.reduce((acc, p) => acc + (p.totalInvoice > 0 ? (p.totalIncome / p.totalInvoice) * 100 : 0), 0) / count;
    const avg_thu_dt = projectsWithData.reduce((acc, p) => acc + (p.satecoInternalRevenue > 0 ? (p.totalIncome / p.satecoInternalRevenue) * 100 : 0), 0) / count;
    const avg_thu_chi = projectsWithData.reduce((acc, p) => acc + (p.totalExpensesSateco > 0 ? (p.totalIncome / p.totalExpensesSateco) : 0), 0) / count;

    const totalValueAll = filteredProjects.reduce((s, p) => s + p.totalValuePostVat, 0);
    const totalIncomeAll = filteredProjects.reduce((s, p) => s + (p.totalIncome || 0), 0);
    const totalInvoiceAll = filteredProjects.reduce((s, p) => s + (p.totalInvoice || 0), 0);
    const totalRequestedAll = filteredProjects.reduce((s, p) => s + (p.totalRequested || 0), 0);
    const totalDebtInvoiceAll = filteredProjects.reduce((s, p) => s + (p.debtInvoice || 0), 0);
    const totalDebtPaymentAll = filteredProjects.reduce((s, p) => s + (p.debtPayment || 0), 0);
    const statusOptions = [...new Set(projects.map(p => p.status).filter(Boolean))];

    if (view === 'detail' && selectedProject) {
        const isInternalView = activeEntity === 'sateco' && selectedProject.acting_entity_key !== 'sateco';
        return (
            <ContractDetailedDashboard
                project={selectedProject}
                isInternalView={isInternalView}
                onBack={() => { setView('list'); fetchProjects(); }}
                onOpenFullscreen={onOpenFullscreen}
            />
        );
    }

    // Helper functions
    const formatBillion = (val) => {
        if (!val) return '0';
        return (val / 1000000000).toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
    };

    const Th = ({ label, sortKey, align = 'left', extraClass = '' }) => (
        <th 
            className={`px-2 py-3 cursor-pointer hover:bg-slate-200/50 transition-colors select-none group ${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'} ${extraClass}`}
            onClick={() => handleSort(sortKey)}
        >
            <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : ''}`}>
                {label}
                <span className={`material-symbols-outlined text-[14px] transition-opacity ${sortConfig.key === sortKey ? 'opacity-100 text-blue-600' : 'opacity-0 group-hover:opacity-40'}`}>
                    {sortConfig.key === sortKey ? (sortConfig.direction === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'swap_vert'}
                </span>
            </div>
        </th>
    );

    return (
        <div className="pb-10 animate-fade-in font-sans">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                    <h2 className="text-2xl md:text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-3">
                        <span className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shadow-sm">
                            <span className="material-symbols-outlined notranslate text-[24px]" translate="no">folder_open</span>
                        </span>
                        Quản lý Hợp đồng & Dự án
                    </h2>
                    <p className="text-slate-500 text-xs md:text-sm mt-2 ml-[52px]">{projects.length} hợp đồng đang theo dõi · Dữ liệu thời gian thực</p>
                </div>
                <div className="flex gap-2 md:gap-3 w-full md:w-auto">
                    <button 
                        onClick={() => setIsImportModalOpen(true)}
                        className="btn btn-glass bg-emerald-50 text-emerald-700 font-bold border-emerald-200 hover:bg-emerald-100 flex items-center gap-2 transition-all shadow-sm text-xs md:text-sm"
                    >
                        <span className="material-symbols-outlined notranslate text-[18px] md:text-[20px]" translate="no">upload_file</span> Import
                    </button>
                    <button
                        onClick={() => onOpenFullscreen('contract_form', null)}
                        className="btn bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md shadow-blue-500/20 flex items-center gap-2 transition-all group text-xs md:text-sm"
                    >
                        <span className="material-symbols-outlined notranslate text-[18px] md:text-[20px] group-hover:rotate-90 transition-transform" translate="no">add</span> <span className="hidden sm:inline">Tạo Hợp đồng mới</span><span className="sm:hidden">Tạo HĐ</span>
                    </button>
                </div>
            </div>

            {/* Entity Tabs */}
            <div className="flex gap-1 mb-6 bg-slate-100/50 p-1 rounded-2xl w-full md:w-fit border border-slate-200/50 overflow-x-auto">
                {[
                    { id: 'all', label: 'TẤT CẢ GROUP', icon: 'hub', color: 'indigo' },
                    { id: 'thanglong', label: 'THĂNG LONG', icon: 'corporate_fare', color: 'blue' },
                    { id: 'thanhphat', label: 'THÀNH PHÁT', icon: 'business', color: 'amber' },
                    { id: 'sateco', label: 'SATECO (CORE)', icon: 'token', color: 'emerald' },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveEntity(tab.id)}
                        className={`flex items-center gap-1.5 md:gap-2 px-3 md:px-6 py-2.5 rounded-xl text-[9px] md:text-[10px] font-black tracking-widest transition-all whitespace-nowrap ${
                            activeEntity === tab.id 
                                ? `bg-white text-${tab.color}-600 shadow-sm border border-${tab.color}-100` 
                                : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
                        }`}
                    >
                        <span className="material-symbols-outlined notranslate text-[16px] md:text-[18px]" translate="no">{tab.icon}</span>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* CEO Quick KPI Dashboard */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
                {activeEntity === 'sateco' ? [
                    { 
                        label: 'TỔNG DOANH THU ST', 
                        subLabel: '(TRỰC TIẾP + NHẬN KHOÁN)',
                        value: totalSatecoRevenueAll, 
                        icon: 'account_balance', 
                        color: 'emerald' 
                    },
                    { 
                        label: 'THỰC THU DÒNG TIỀN', 
                        subLabel: '(ĐÃ VỀ VÍ SATECO)',
                        value: totalSatecoCashInAll, 
                        icon: 'savings', 
                        color: 'green' 
                    },
                    { 
                        label: 'NỢ TỪ THĂNG LONG', 
                        subLabel: '(TL CHƯA CHUYỂN)',
                        value: totalSatecoDueFromTL, 
                        icon: 'sync_alt', 
                        color: 'blue' 
                    },
                    { 
                        label: 'NỢ TỪ THÀNH PHÁT', 
                        subLabel: '(TP CHƯA CHUYỂN)',
                        value: totalSatecoDueFromTP, 
                        icon: 'sync_alt', 
                        color: 'amber' 
                    },
                    { 
                        label: 'CÔNG NỢ NGOÀI', 
                        subLabel: '(CĐT NỢ HĐ TRỰC TIẾP)',
                        value: filteredProjects.filter(p => p.acting_entity_key === 'sateco').reduce((s, p) => s + p.debtInvoice, 0), 
                        icon: 'assignment_late', 
                        color: 'orange' 
                    },
                    { 
                        label: 'TỶ LỆ THU HỒI ST', 
                        value: totalSatecoRevenueAll > 0 ? (totalSatecoCashInAll / totalSatecoRevenueAll) * 100 : 0, 
                        icon: 'analytics', 
                        color: 'indigo',
                        isPercent: true 
                    }
                ].map((kpi, idx) => (
                    <div key={idx} className="bg-white rounded-[20px] p-4 shadow-sm border border-slate-200/60 relative overflow-hidden group hover:shadow-md transition-all">
                        <div className={`absolute -right-4 -top-4 w-20 h-20 bg-${kpi.color}-50 rounded-full opacity-60 group-hover:scale-110 transition-transform`} />
                        <div className="relative flex flex-col h-full justify-between">
                            <div className="mb-2">
                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-tight">{kpi.label}</p>
                                {kpi.subLabel && (
                                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">{kpi.subLabel}</p>
                                )}
                            </div>
                            <div className="flex justify-between items-end">
                                <div className="flex items-baseline gap-1">
                                    <h3 className={`text-xl font-black text-${kpi.color}-600 tracking-tighter`}>
                                        {kpi.isPercent ? kpi.value.toFixed(1) : formatBillion(kpi.value)}
                                    </h3>
                                    <span className="text-[10px] font-black text-slate-400 capitalize">
                                        {kpi.isPercent ? '%' : 'Tỷ'}
                                    </span>
                                </div>
                                <div className={`w-8 h-8 rounded-lg bg-${kpi.color}-50 text-${kpi.color}-500 flex items-center justify-center shadow-inner shrink-0`}>
                                    <span className="material-symbols-outlined notranslate text-[18px]" translate="no">{kpi.icon}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )) : [
                    { 
                        label: 'TỔNG GIÁ TRỊ HĐ', 
                        subLabel: '(SAU VAT, GỒM PHÁT SINH)',
                        value: totalValueAll, 
                        icon: 'payments', 
                        color: 'blue' 
                    },
                    { 
                        label: 'THỰC THU (CASH-IN)', 
                        value: totalIncomeAll, 
                        icon: 'account_balance_wallet', 
                        color: 'emerald' 
                    },
                    { 
                        label: 'CÔNG NỢ HÓA ĐƠN', 
                        subLabel: '(ĐÃ XUẤT HĐ - THỰC THU)',
                        value: totalDebtInvoiceAll, 
                        icon: 'assignment_turned_in', 
                        color: 'rose' 
                    },
                    { 
                        label: 'CÔNG NỢ ĐỀ NGHỊ', 
                        subLabel: '(ĐỀ NGHỊ - THỰC THU)',
                        value: totalRequestedAll - totalIncomeAll, 
                        icon: 'pending_actions', 
                        color: 'amber' 
                    },
                    { 
                        label: 'TỔNG XUẤT HÓA ĐƠN', 
                        value: totalInvoiceAll, 
                        icon: 'description', 
                        color: 'slate' 
                    },
                    { 
                        label: 'TỶ LỆ THU HỒI DÒNG TIỀN', 
                        value: totalValueAll > 0 ? (totalIncomeAll / totalValueAll) * 100 : 0, 
                        icon: 'analytics', 
                        color: 'indigo',
                        isPercent: true 
                    }
                ].map((kpi, idx) => (
                    <div key={idx} className="bg-white rounded-[20px] p-4 shadow-sm border border-slate-200/60 relative overflow-hidden group hover:shadow-md transition-all">
                        <div className={`absolute -right-4 -top-4 w-20 h-20 bg-${kpi.color}-50 rounded-full opacity-60 group-hover:scale-110 transition-transform`} />
                        <div className="relative flex flex-col h-full justify-between">
                            <div className="mb-2">
                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-tight">{kpi.label}</p>
                                {kpi.subLabel && (
                                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">{kpi.subLabel}</p>
                                )}
                            </div>
                            <div className="flex justify-between items-end">
                                <div className="flex items-baseline gap-1">
                                    <h3 className={`text-xl font-black text-${kpi.color === 'slate' ? 'slate-700' : (kpi.color === 'rose' ? 'rose-600' : (kpi.color === 'emerald' ? 'emerald-600' : (kpi.color === 'amber' ? 'amber-600' : (kpi.color === 'blue' ? 'blue-600' : 'indigo-600'))))} tracking-tighter`}>
                                        {kpi.isPercent ? kpi.value.toFixed(1) : formatBillion(kpi.value)}
                                    </h3>
                                    <span className="text-[10px] font-black text-slate-400 capitalize">
                                        {kpi.isPercent ? '%' : 'Tỷ'}
                                    </span>
                                </div>
                                <div className={`w-8 h-8 rounded-lg bg-${kpi.color}-50 text-${kpi.color}-500 flex items-center justify-center shadow-inner shrink-0`}>
                                    <span className="material-symbols-outlined notranslate text-[18px]" translate="no">{kpi.icon}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* NEW: Global Performance Overview */}
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-4 px-2">
                    <div className="h-px flex-1 bg-slate-200/60"></div>
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] whitespace-nowrap">Hiệu suất Vận hành Trung bình</h3>
                    <div className="h-px flex-1 bg-slate-200/60"></div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    {[
                        { label: 'LNG / Doanh thu', value: avg_lng_dt, suffix: '%', icon: 'trending_up', color: 'emerald' },
                        { label: 'Sản lượng / Chi phí', value: avg_sl_cp, suffix: '%', icon: 'balance', color: 'blue' },
                        { label: 'Hệ số SPI (TB)', value: avg_spi, suffix: '', icon: 'speed', color: 'amber' },
                        { label: 'Thu tiền / Sản lượng', value: avg_dt_sl, suffix: '%', icon: 'account_balance_wallet', color: 'indigo' },
                        { label: 'Thu tiền / Doanh thu', value: avg_thu_dt, suffix: '%', icon: 'violet', color: 'violet' },
                        { label: 'Cân đối Thu / Chi', value: avg_thu_chi, suffix: 'x', icon: 'compare_arrows', color: 'rose' },
                    ].map((k, i) => (
                        <div key={i} className="bg-white/40 backdrop-blur-sm rounded-2xl p-4 border border-slate-200/60 flex flex-col items-center text-center shadow-sm hover:shadow-md transition-all group">
                            <div className={`w-8 h-8 rounded-lg bg-${k.color === 'violet' ? 'purple' : k.color}-50 text-${k.color === 'violet' ? 'purple' : k.color}-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform shadow-inner`}>
                                <span className="material-symbols-outlined notranslate text-[18px]" translate="no">{k.icon}</span>
                            </div>
                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-tighter mb-1 h-6 flex items-center">{k.label}</p>
                            <div className="flex items-baseline gap-0.5">
                                <span className={`text-base font-black text-${k.color === 'violet' ? 'purple' : k.color}-700 tracking-tighter`}>
                                    {k.value.toFixed(k.suffix === 'x' || k.suffix === '' ? 2 : 1)}
                                </span>
                                <span className="text-[9px] font-bold text-slate-400">{k.suffix}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="glass-panel p-0 overflow-hidden shadow-sm border border-slate-200/60 bg-white/70">
                {/* Toolbar */}
                <div className="p-4 border-b border-slate-200/60 flex flex-wrap gap-4 items-center bg-slate-50/50">
                    <div className="relative flex-1 min-w-[280px]">
                        <span className="material-symbols-outlined notranslate absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]" translate="no">search</span>
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Tìm tên Dự án, mã Hợp đồng, Chủ đầu tư..."
                            className="w-full pl-11 pr-10 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium text-slate-700 shadow-sm outline-none transition-all"
                        />
                        {searchTerm && (
                            <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                <span className="material-symbols-outlined notranslate text-[18px]" translate="no">close</span>
                            </button>
                        )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <select 
                            value={filterMonth}
                            onChange={(e) => setFilterMonth(e.target.value)}
                            className="pl-4 pr-10 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 outline-none bg-white hover:border-blue-400 transition-colors cursor-pointer shadow-sm appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M5%208l5%205%205-5%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%222%22%20fill%3D%22none%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2Fc%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:right_10px_center] bg-[size:16px]"
                        >
                            <option value="all">Tất cả tháng</option>
                            {Array.from({length: 12}, (_, i) => (
                                <option key={i+1} value={(i+1).toString()}>Tháng {i+1}</option>
                            ))}
                        </select>

                        <select 
                            value={filterYear}
                            onChange={(e) => setFilterYear(e.target.value)}
                            className="pl-4 pr-10 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 outline-none bg-white hover:border-blue-400 transition-colors cursor-pointer shadow-sm appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M5%208l5%205%205-5%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%222%22%20fill%3D%22none%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2Fc%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:right_10px_center] bg-[size:16px]"
                        >
                            <option value="all">Tất cả năm</option>
                            {['2024', '2025', '2026'].map(y => (
                                <option key={y} value={y}>Năm {y}</option>
                            ))}
                        </select>

                        <select 
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="pl-4 pr-10 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 outline-none bg-white hover:border-blue-400 transition-colors cursor-pointer shadow-sm max-w-[160px] truncate appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M5%208l5%205%205-5%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%222%22%20fill%3D%22none%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2Fc%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:right_10px_center] bg-[size:16px]"
                        >
                            <option value="All">Tất cả trạng thái</option>
                            {statusOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                    </div>

                    <button 
                        onClick={fetchProjects}
                        className="p-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-500 transition-all shadow-sm active:scale-95"
                    >
                        <span className="material-symbols-outlined notranslate block" translate="no">refresh</span>
                    </button>
                </div>
            </div>

            <div className="glass-panel p-0 overflow-hidden shadow-sm border border-slate-200/60 bg-white/70">
                {/* Toolbar */}
                {loading ? (
                    <div className="p-8 space-y-4">
                        {[1, 2, 3, 4, 5].map(i => (
                            <div key={i} className="animate-pulse flex gap-6 items-center py-4 border-b border-slate-100/50">
                                <div className="h-5 bg-slate-100 rounded-md w-24" />
                                <div className="h-5 bg-slate-100 rounded-md flex-1" />
                                <div className="h-5 bg-slate-100 rounded-md w-32" />
                                <div className="h-5 bg-slate-100 rounded-md w-24" />
                                <div className="h-5 bg-slate-100 rounded-md w-20" />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        {filteredProjects.length === 0 ? (
                            <div className="p-16 text-center flex flex-col items-center justify-center">
                                <div className="w-20 h-20 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center mb-4">
                                     <span className="material-symbols-outlined notranslate text-4xl text-slate-300" translate="no">
                                         {projects.length === 0 ? 'folder_open' : 'search_off'}
                                     </span>
                                </div>
                                <h3 className="text-lg font-bold text-slate-700 mb-1">
                                    {projects.length === 0 ? 'Chưa có hợp đồng nào' : 'Không tìm thấy kết quả phù hợp'}
                                </h3>
                                <p className="text-slate-500 text-sm">
                                    {projects.length === 0
                                        ? 'Nhấn nút "Tạo Hợp đồng mới" để bắt đầu thiết lập dữ liệu'
                                        : 'Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc trạng thái'}
                                </p>
                            </div>
                        ) : (
                            <table className="w-full text-[13px] text-left whitespace-nowrap">
                                <thead className="bg-slate-50/80 text-slate-500 uppercase tracking-widest text-[10px] font-black sticky top-0 z-10 border-b border-slate-200">
                                    <tr>
                                        <Th label="Mã DA/HĐ" sortKey="code" extraClass="px-3" />
                                        <Th label="Mã Đối tác" sortKey="partnerCode" extraClass="px-3" />
                                        <Th label="HĐ Trước VAT" sortKey="preVat" align="right" extraClass="border-l border-slate-100 bg-blue-50/30" />
                                        <Th label="VAT (%)" sortKey="vatPercent" align="right" extraClass="bg-blue-50/30 text-blue-400" />
                                        <Th label="Giá trị Sau VAT" sortKey="postVat" align="right" extraClass="font-black text-blue-700 bg-blue-50/30" />
                                        <Th label="Tổng Xuất HĐ" sortKey="totalInvoice" align="right" extraClass="border-l border-slate-100" />
                                        <Th label="Tổng Đề nghị" sortKey="totalRequested" align="right" />
                                        <Th label="Tổng Thanh toán" sortKey="totalIncome" align="right" />
                                        <Th label="Công nợ HĐ" sortKey="debtInvoice" align="right" extraClass="border-l border-rose-50 font-black text-rose-600" />
                                        <Th label="Công nợ ĐN" sortKey="debtPayment" align="right" extraClass="font-black text-amber-700" />
                                        <Th label="Trạng thái" sortKey="status" align="center" extraClass="px-3" />
                                        <th className="px-3 py-3 text-center">Tác vụ</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                    {sortedProjects.map(proj => (
                                        <tr
                                            key={proj.id}
                                            onClick={() => handleViewDetail(proj)}
                                            className={`hover:bg-blue-50/50 transition-colors cursor-pointer group ${proj.vat_percentage === 0 ? 'bg-yellow-50/50' : ''}`}
                                        >
                                            <td className="px-3 py-2.5">
                                                <div className="flex items-center gap-2">
                                                    <div className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter ${
                                                        activeEntity === 'sateco' ? 'bg-emerald-100 text-emerald-700' :
                                                        (proj.acting_entity_key || '').toLowerCase() === 'thanhphat' ? 'bg-amber-100 text-amber-700' : 
                                                        (proj.acting_entity_key || '').toLowerCase() === 'sateco' ? 'bg-emerald-100 text-emerald-700' : 
                                                        'bg-blue-100 text-blue-700'
                                                    }`}>
                                                        {activeEntity === 'sateco' ? 'ST' : 
                                                         (proj.acting_entity_key || '').toLowerCase() === 'thanhphat' ? 'TP' : 
                                                         (proj.acting_entity_key || '').toLowerCase() === 'sateco' ? 'ST' : 'TL'}
                                                    </div>
                                                    <div className="font-mono text-[12px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded inline-block border border-blue-100">
                                                        {proj.internal_code || proj.code}
                                                    </div>
                                                </div>
                                                {proj.internal_code && proj.code && (
                                                    <div className="text-[11px] text-slate-400 mt-0.5 font-medium">#{proj.code}</div>
                                                )}
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <div className="font-bold text-slate-700 truncate uppercase" title={proj.partners?.name || proj.client}>
                                                    {activeEntity === 'sateco' && proj.acting_entity_key !== 'sateco' ? (
                                                        <span className="flex items-center gap-1.5 text-slate-700">
                                                            <span className="material-symbols-outlined text-[16px] text-emerald-600">sync_alt</span>
                                                            {proj.acting_entity_key === 'thanhphat' ? 'THÀNH PHÁT (Nội bộ)' : 'THĂNG LONG (Nội bộ)'}
                                                        </span>
                                                    ) : (
                                                        proj.partners?.code || proj.partners?.short_name || proj.client || '—'
                                                    )}
                                                </div>
                                                <div className="text-[11px] font-medium text-slate-400 mt-0.5 truncate max-w-[120px]">
                                                    {activeEntity === 'sateco' && proj.acting_entity_key !== 'sateco' ? proj.name : (proj.partners?.name || proj.client)}
                                                </div>
                                            </td>
                                            <td className="px-2 py-2.5 text-right text-slate-500 border-l border-slate-50">
                                                {formatBillion(activeEntity === 'sateco' && proj.acting_entity_key !== 'sateco' ? proj.satecoInternalRevenue / (1 + (proj.internal_vat_percentage ?? 8) / 100) : proj.totalValuePreVat)}
                                            </td>
                                            <td className="px-2 py-2.5 text-right">
                                                {activeEntity === 'sateco' && proj.acting_entity_key !== 'sateco' ? (
                                                    <span className="text-slate-400 italic">
                                                        {proj.internal_vat_percentage ?? 8}%
                                                    </span>
                                                ) : (
                                                    proj.vat_percentage === 0 ? (
                                                        <span className="px-1.5 py-0.5 rounded bg-yellow-400 text-slate-900 text-[10px] font-black border border-yellow-500 shadow-sm uppercase tracking-tighter">
                                                            0% VAT
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-400 italic">
                                                            {proj.vat_percentage ?? 8}%
                                                        </span>
                                                    )
                                                )}
                                            </td>
                                            <td className="px-2 py-2.5 text-right font-medium text-blue-700 bg-blue-50/10">
                                                {formatBillion(activeEntity === 'sateco' && proj.acting_entity_key !== 'sateco' ? proj.satecoInternalRevenue : proj.totalValuePostVat)}
                                            </td>
                                            <td className="px-2 py-2.5 text-right text-slate-600 border-l border-slate-50">
                                                {formatBillion(proj.totalInvoice)}
                                            </td>
                                            <td className="px-2 py-2.5 text-right text-slate-600">
                                                {formatBillion(proj.totalRequested)}
                                            </td>
                                            <td className="px-2 py-2.5 text-right font-medium text-emerald-600">
                                                {formatBillion(proj.totalIncome)}
                                            </td>
                                            <td className={`px-2 py-2.5 text-right font-medium border-l border-rose-50/50 ${proj.debtInvoice > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                {formatBillion(proj.debtInvoice)}
                                            </td>
                                            <td className={`px-2 py-2.5 text-right font-medium ${(proj.totalRequested - proj.totalIncome) > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                                                {formatBillion(proj.totalRequested - proj.totalIncome)}
                                            </td>
                                            <td className="px-3 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                                                <select
                                                    value={proj.status || 'Chưa thi công'}
                                                    onChange={(e) => handleStatusChange(proj.id, e.target.value, e)}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className={`appearance-none cursor-pointer inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border outline-none transition-all hover:shadow-sm focus:ring-2 focus:ring-blue-500/20 ${getStatusColor(proj.status)}`}
                                                >
                                                    {statusOptionsList.map(opt => (
                                                        <option key={opt} value={opt} className="bg-white text-slate-700 font-medium">
                                                            {opt}
                                                        </option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="px-3 py-2.5 text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onOpenFullscreen('contract_form', proj);
                                                        }}
                                                        className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                                        title="Sửa"
                                                    >
                                                        <span className="material-symbols-outlined notranslate text-[18px]" translate="no">edit_note</span>
                                                    </button>
                                                    {isAdmin && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                console.log('Delete button clicked for:', proj.name);
                                                                setDeleteConfirm({ id: proj.id, name: proj.name });
                                                            }}
                                                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                                            title="Xóa hợp đồng"
                                                        >
                                                            <span className="material-symbols-outlined notranslate text-[18px]" translate="no">delete</span>
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-slate-50 border-t-2 border-slate-300 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] relative z-10">
                                    <tr className="divide-x divide-slate-200">
                                        <td colSpan={2} className="px-3 py-4 text-slate-500 uppercase tracking-widest text-[9px] font-black italic bg-slate-100/50">
                                            TỔNG HỢP TOÀN BỘ ({filteredProjects.length} DA)
                                        </td>
                                        <td colSpan={3} className="px-2 py-4 text-right text-blue-700 text-[14px] font-black bg-blue-50/30">
                                            {formatBillion(totalValueAll)}
                                        </td>
                                        <td className="px-2 py-4 text-right text-slate-700 text-[14px] font-black">
                                            {formatBillion(totalInvoiceAll)}
                                        </td>
                                        <td className="px-2 py-4 text-right text-slate-600 text-[14px] font-black bg-slate-50">
                                            {formatBillion(totalRequestedAll)}
                                        </td>
                                        <td className="px-2 py-4 text-right text-emerald-700 text-[14px] font-black bg-emerald-50/30">
                                            {formatBillion(totalIncomeAll)}
                                        </td>
                                        <td className={`px-2 py-4 text-right text-[14px] font-black ${totalDebtInvoiceAll > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                            {formatBillion(totalDebtInvoiceAll)}
                                        </td>
                                        <td className={`px-2 py-4 text-right text-[14px] font-black bg-amber-50/20 ${(totalRequestedAll - totalIncomeAll) > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                                            {formatBillion(totalRequestedAll - totalIncomeAll)}
                                        </td>
                                        <td colSpan={2} className="bg-slate-100/30"></td>
                                    </tr>
                                </tfoot>
                            </table>
                        )}
                    </div>
                )}
            </div>

            <ExcelImportModal 
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                title="Nhập Dữ Liệu Dự Án"
                tableName="projects"
                columnMapping={projectMapping}
                templateFilename="mau_du_an.xlsx"
                onSuccess={handleImportSuccess}
            />

            {/* Custom Delete Confirmation Modal */}
            {deleteConfirm && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
                        <div className="p-6 text-center">
                            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                <span className="material-symbols-outlined text-3xl">warning</span>
                            </div>
                            <h3 className="text-xl font-bold text-slate-800 mb-2">Xác nhận xóa hợp đồng?</h3>
                            <p className="text-slate-500 text-sm mb-6">
                                Bạn có chắc chắn muốn xóa hợp đồng <span className="font-bold text-slate-700 italic">"{deleteConfirm.name}"</span>? 
                                <br/><br/>
                                <span className="text-red-600 font-bold underline">CẢNH BÁO:</span> Hành động này sẽ xóa toàn bộ dữ liệu liên quan (Thanh toán, Phụ lục, Chi phí, Kho bãi) và <strong>không thể hoàn tác</strong>.
                            </p>
                            <div className="flex gap-3">
                                <button 
                                    onClick={() => setDeleteConfirm(null)}
                                    className="flex-1 py-3 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all"
                                >
                                    Hủy bỏ
                                </button>
                                <button 
                                    onClick={() => handleDeleteProject(deleteConfirm.id, deleteConfirm.name)}
                                    className="flex-1 py-3 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 shadow-lg shadow-red-500/20 transition-all active:scale-95"
                                >
                                    Xác nhận Xóa
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
