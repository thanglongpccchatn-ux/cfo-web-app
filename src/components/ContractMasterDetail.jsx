import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import ContractDetailedDashboard from './ContractDetailedDashboard';
import ExcelImportModal from './ExcelImportModal';
import { useToast } from '../context/ToastContext';
import { logAudit } from '../lib/auditLog';

import { useAuth } from '../context/AuthContext';

export default function ContractMasterDetail({ onOpenFullscreen }) {
    const { hasPermission } = useAuth();

    const [view, setView] = useState('list');
    const [selectedProject, setSelectedProject] = useState(null);
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());
    const [filterMonth, setFilterMonth] = useState('all');
    const [activeEntity, setActiveEntity] = useState('all'); // all, thanglong, sateco, thanhphat
    // const [isAdmin, setIsAdmin] = useState(true); // Replaced by RBAC hasPermission
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState(null); // { id, name }
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
    const [partnerModal, setPartnerModal] = useState(null); // { code, name, projects }
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
        
        setDeleteConfirm(null); // Close modal
        
        try {
            toast.info('Đang thực hiện xóa...');
            
            // Manual cleanup for tables missing ON DELETE CASCADE
            const { data: receipts } = await supabase.from('inventory_receipts').select('id').eq('project_id', projId);
            const receiptIds = receipts?.map(r => r.id) || [];
            
            if (receiptIds.length > 0) {
                
                await supabase.from('inventory_receipt_items').delete().in('receipt_id', receiptIds);
                await supabase.from('inventory_receipts').delete().in('id', receiptIds);
            }
            
            const { data: requests } = await supabase.from('inventory_requests').select('id').eq('project_id', projId);
            const requestIds = requests?.map(r => r.id) || [];
            
            if (requestIds.length > 0) {
                
                await supabase.from('inventory_request_items').delete().in('request_id', requestIds);
                await supabase.from('inventory_requests').delete().in('id', requestIds);
            }

            
            // Finally delete the project (other tables like addendas, payments, expenses have CASCADE)
            const { error } = await supabase
                .from('projects')
                .delete()
                .eq('id', projId);

            if (error) throw error;

            
            setProjects(projects.filter(p => p.id !== projId));
            toast.success('Đã xóa hợp đồng thành công.');
            // Audit log (non-blocking)
            logAudit({ action: 'DELETE', tableName: 'projects', recordId: projId, recordName: projName });
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
                
                // Calculations for Financial Columns (including variations)
                const baseTotalValuePreVat = Number(p.original_value) || 0;
                const baseVatAmount = p.vat_amount || (baseTotalValuePreVat * (p.vat_percentage ?? 8) / 100);
                const baseTotalValuePostVat = p.total_value_post_vat || (baseTotalValuePreVat + baseVatAmount);
                
                const approvedVariationsPreVat = Number(p.total_approved_variations) || 0;
                const totalValuePreVat = baseTotalValuePreVat + approvedVariationsPreVat;
                const totalValuePostVat = baseTotalValuePostVat + approvedVariationsPreVat * (1 + (p.vat_percentage ?? 8) / 100);
                const vatAmount = totalValuePostVat - totalValuePreVat;
                
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

    const handleOpenPartnerDetail = (proj) => {
        const partnerCode = proj.partners?.code || proj.partners?.short_name || proj.client || '';
        const partnerName = proj.partners?.name || proj.client || '';
        const partnerId = proj.partner_id;

        // Find all projects with same partner
        const partnerProjects = projects.filter(p => {
            if (partnerId) return p.partner_id === partnerId;
            return (p.partners?.code || p.client) === partnerCode;
        }).map(p => ({
            ...p,
            computedTotalInvoice: p.totalInvoice || 0,
            computedTotalIncome: p.totalIncome || 0,
        }));

        setPartnerModal({ code: partnerCode, name: partnerName, projects: partnerProjects });
    };



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

    const handleSignatureStatusChange = async (projectId, newStatus, e) => {
        if (e) e.stopPropagation();
        try {
            const { error } = await supabase
                .from('projects')
                .update({ signature_status: newStatus })
                .eq('id', projectId);
            
            if (error) throw error;
            
            setProjects(projects.map(p => p.id === projectId ? { ...p, signature_status: newStatus } : p));
            toast.success(`Đã cập nhật tình trạng ký sang "${newStatus}"`);
        } catch (error) {
            console.error('Error updating signature status:', error);
            toast.error('Lỗi khi cập nhật tình trạng ký: ' + error.message);
        }
    };

    const handleSettlementStatusChange = async (projectId, newStatus, e) => {
        if (e) e.stopPropagation();
        try {
            const { error } = await supabase
                .from('projects')
                .update({ settlement_status: newStatus })
                .eq('id', projectId);
            
            if (error) throw error;
            
            setProjects(projects.map(p => p.id === projectId ? { ...p, settlement_status: newStatus } : p));
            toast.success(`Đã cập nhật quyết toán sang "${newStatus}"`);
        } catch (error) {
            console.error('Error updating settlement status:', error);
            toast.error('Lỗi khi cập nhật quyết toán: ' + error.message);
        }
    };

    const handleImportSuccess = (count) => {
        toast.success(`Đã import thành công ${count} dự án!`);
        fetchProjects();
    };

    const [signatureFilter, setSignatureFilter] = useState('All');
    const [settlementFilter, setSettlementFilter] = useState('All');
    
    const filteredProjects = projects.filter(p => {
        const q = searchTerm.toLowerCase();
        const matchSearch = !q || 
            p.name?.toLowerCase().includes(q) || 
            p.code?.toLowerCase().includes(q) || 
            p.internal_code?.toLowerCase().includes(q) ||
            p.client?.toLowerCase().includes(q);
        const matchStatus = statusFilter === 'All' || p.status === statusFilter;
        const matchSignature = signatureFilter === 'All' || (p.signature_status || 'Chưa ký') === signatureFilter;
        const matchSettlement = settlementFilter === 'All' || (p.settlement_status || 'Chưa quyết toán') === settlementFilter;
        
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
        
        return matchSearch && matchStatus && matchSignature && matchSettlement && matchEntity && matchDate;
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



    const totalValueAll = filteredProjects.reduce((s, p) => s + p.totalValuePostVat, 0);
    const totalIncomeAll = filteredProjects.reduce((s, p) => s + (p.totalIncome || 0), 0);
    const totalInvoiceAll = filteredProjects.reduce((s, p) => s + (p.totalInvoice || 0), 0);
    const totalRequestedAll = filteredProjects.reduce((s, p) => s + (p.totalRequested || 0), 0);
    const totalDebtInvoiceAll = filteredProjects.reduce((s, p) => s + (p.debtInvoice || 0), 0);
    const statusOptions = [...new Set(projects.map(p => p.status).filter(Boolean))];
    const signatureOptions = ['Đã ký', 'Chưa ký'];
    const settlementOptions = ['Đã quyết toán', 'Đang quyết toán', 'Chưa quyết toán'];

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
        return Math.round(Number(val)).toLocaleString('vi-VN');
    };

    const Th = ({ label, sortKey, align = 'left', extraClass = '' }) => (
        <th 
            className={`px-1.5 py-2.5 cursor-pointer hover:bg-slate-200/50 transition-colors select-none group relative ${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'} ${extraClass}`}
            onClick={() => handleSort(sortKey)}
            style={{ resize: 'horizontal', overflow: 'hidden', minWidth: '60px', maxWidth: '300px' }}
            title="Kéo góc phụ bên phải để co giãn cột"
        >
            <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : ''}`}>
                <span className="truncate">{label}</span>
                <span className={`material-symbols-outlined shrink-0 text-[14px] transition-opacity ${sortConfig.key === sortKey ? 'opacity-100 text-blue-600' : 'opacity-0 group-hover:opacity-40'}`}>
                    {sortConfig.key === sortKey ? (sortConfig.direction === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'swap_vert'}
                </span>
            </div>
        </th>
    );

    return (
        <div className="pb-10 animate-fade-in font-sans">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                    <h2 className="text-xl md:text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2 md:gap-3">
                        <span className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shadow-sm flex-shrink-0">
                            <span className="material-symbols-outlined notranslate text-[20px] md:text-[24px]" translate="no">folder_open</span>
                        </span>
                        Quản lý Hợp đồng & Dự án
                    </h2>
                    <p className="text-slate-500 text-[10px] md:text-sm mt-1 ml-10 md:ml-[52px]">{projects.length} hợp đồng đang theo dõi</p>
                </div>
                <div className="flex gap-2 md:gap-3 w-full md:w-auto">
                    {hasPermission('create_contracts') && (
                        <button 
                            onClick={() => setIsImportModalOpen(true)}
                            className="btn btn-glass bg-emerald-50 text-emerald-700 font-bold border-emerald-200 hover:bg-emerald-100 flex items-center gap-2 transition-all shadow-sm text-xs md:text-sm"
                        >
                            <span className="material-symbols-outlined notranslate text-[18px] md:text-[20px]" translate="no">upload_file</span> Import
                        </button>
                    )}
                    {hasPermission('create_contracts') && (
                        <button
                            onClick={() => onOpenFullscreen('contract_form', null)}
                            className="btn bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md shadow-blue-500/20 flex items-center gap-2 transition-all group text-xs md:text-sm"
                        >
                            <span className="material-symbols-outlined notranslate text-[18px] md:text-[20px] group-hover:rotate-90 transition-transform" translate="no">add</span> <span className="hidden sm:inline">Tạo Hợp đồng mới</span><span className="sm:hidden">Tạo HĐ</span>
                        </button>
                    )}
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


            <div className="glass-panel p-0 shadow-sm border border-slate-200/60 bg-white/70 overflow-visible">
                {/* Toolbar */}
                <div className="p-4 border-b border-slate-200/60 flex flex-wrap gap-4 items-center bg-slate-50/50">
                    <div className="relative w-full md:w-[280px] lg:w-[360px] flex-shrink-0">
                        <span className="material-symbols-outlined notranslate absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-[18px] md:text-[20px]" translate="no">search</span>
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Tìm dự án, hợp đồng..."
                            className="w-full pl-10 md:pl-11 pr-10 py-2 md:py-2.5 rounded-xl border border-slate-200 bg-white text-xs md:text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium text-slate-700 shadow-sm outline-none transition-all"
                        />
                        {searchTerm && (
                            <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                <span className="material-symbols-outlined notranslate text-[18px]" translate="no">close</span>
                            </button>
                        )}
                    </div>
                    
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 w-full md:w-auto -mx-1 px-1 scrollbar-none">
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
                            {['2024', '2025', '2026'].map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>

                        <select 
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="pl-3 pr-8 py-2 md:py-2.5 rounded-xl border border-slate-200 text-[10px] md:text-xs font-bold text-slate-600 outline-none bg-white hover:border-blue-400 transition-colors cursor-pointer shadow-sm appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M5%208l5%205%205-5%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%222%22%20fill%3D%22none%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2Fc%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:right_8px_center] bg-[size:14px]"
                        >
                            <option value="All">Trạng thái (TT)</option>
                            {statusOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>

                        <select 
                            value={signatureFilter}
                            onChange={(e) => setSignatureFilter(e.target.value)}
                            className="pl-3 pr-8 py-2 md:py-2.5 rounded-xl border border-slate-200 text-[10px] md:text-xs font-bold text-slate-600 outline-none bg-white hover:border-blue-400 transition-colors cursor-pointer shadow-sm appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M5%208l5%205%205-5%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%222%22%20fill%3D%22none%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2Fc%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:right_8px_center] bg-[size:14px]"
                        >
                            <option value="All">Tình trạng Ký</option>
                            {signatureOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>

                        <select 
                            value={settlementFilter}
                            onChange={(e) => setSettlementFilter(e.target.value)}
                            className="pl-3 pr-8 py-2 md:py-2.5 rounded-xl border border-slate-200 text-[10px] md:text-xs font-bold text-slate-600 outline-none bg-white hover:border-blue-400 transition-colors cursor-pointer shadow-sm appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M5%208l5%205%205-5%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%222%22%20fill%3D%22none%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2Fc%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:right_8px_center] bg-[size:14px]"
                        >
                            <option value="All">Quyết toán</option>
                            {settlementOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>

                        <button 
                            onClick={fetchProjects}
                            className="p-2 md:p-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-500 transition-all shadow-sm active:scale-95 flex-shrink-0"
                        >
                            <span className="material-symbols-outlined notranslate block text-[18px] md:text-[24px]" translate="no">refresh</span>
                        </button>
                    </div>
                </div>
            </div>

            <div className="glass-panel p-0 shadow-sm border border-slate-200/60 bg-white/70 overflow-visible">
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
                    <div className="overflow-auto max-h-[calc(100vh-250px)] scrollbar-thin">
                        {filteredProjects.length === 0 ? (
                            <div className="p-16 text-center flex flex-col items-center justify-center bg-white">
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
                            <>
                                {/* Mobile Card View */}
                                <div className="block lg:hidden space-y-4 p-4 bg-slate-50/50">
                                    {sortedProjects.map(proj => (
                                        <div 
                                            key={proj.id} 
                                            onClick={() => handleViewDetail(proj)} 
                                            className={`bg-white rounded-2xl shadow-sm border p-5 relative cursor-pointer active:scale-[0.98] transition-all overflow-hidden ${proj.vat_percentage === 0 ? 'border-yellow-200' : 'border-slate-200'}`}
                                        >
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="flex items-center gap-2">
                                                    <div className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter ${
                                                        activeEntity === 'sateco' ? 'bg-emerald-100 text-emerald-700' :
                                                        (proj.acting_entity_key || '').toLowerCase() === 'thanhphat' ? 'bg-amber-100 text-amber-700' : 
                                                        (proj.acting_entity_key || '').toLowerCase() === 'sateco' ? 'bg-emerald-100 text-emerald-700' : 
                                                        'bg-blue-100 text-blue-700'
                                                    }`}>
                                                        {activeEntity === 'sateco' ? 'ST' : 
                                                         (proj.acting_entity_key || '').toLowerCase() === 'thanhphat' ? 'TP' : 
                                                         (proj.acting_entity_key || '').toLowerCase() === 'sateco' ? 'ST' : 'TL'}
                                                    </div>
                                                    <span className="font-mono text-sm font-bold text-blue-600">{proj.internal_code || proj.code}</span>
                                                </div>
                                                <div className="flex flex-col items-end gap-1">
                                                    <select
                                                        value={proj.signature_status || 'Chưa ký'}
                                                        onChange={(e) => handleSignatureStatusChange(proj.id, e.target.value, e)}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className={`appearance-none cursor-pointer px-2 py-0.5 rounded-full text-[9px] uppercase font-black border outline-none ${(proj.signature_status || 'Chưa ký') === 'Đã ký' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}
                                                    >
                                                        {signatureOptions.map(opt => <option key={opt} value={opt} className="bg-white text-slate-700">{opt}</option>)}
                                                    </select>
                                                    <select
                                                        value={proj.settlement_status || 'Chưa quyết toán'}
                                                        onChange={(e) => handleSettlementStatusChange(proj.id, e.target.value, e)}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className={`appearance-none cursor-pointer px-2 py-0.5 rounded text-[10px] font-bold border outline-none ${(proj.settlement_status || 'Chưa quyết toán') === 'Đã quyết toán' ? 'bg-emerald-50 text-emerald-700' : (proj.settlement_status || 'Chưa quyết toán') === 'Đang quyết toán' ? 'bg-amber-50 text-amber-700' : 'bg-slate-50 text-slate-700'}`}
                                                    >
                                                        {settlementOptions.map(opt => <option key={opt} value={opt} className="bg-white text-slate-700">{opt}</option>)}
                                                    </select>
                                                    <select
                                                        value={proj.status || 'Chưa thi công'}
                                                        onChange={(e) => handleStatusChange(proj.id, e.target.value, e)}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className={`appearance-none cursor-pointer px-2 py-0.5 rounded text-[10px] font-bold border outline-none ${getStatusColor(proj.status)}`}
                                                    >
                                                        {statusOptionsList.map(opt => (
                                                            <option key={opt} value={opt} className="bg-white text-slate-700 font-medium">{opt}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>

                                            <div className="mb-4">
                                                <p className="font-bold text-slate-800 text-sm line-clamp-1">
                                                    {activeEntity === 'sateco' && proj.acting_entity_key !== 'sateco' 
                                                        ? (proj.acting_entity_key === 'thanhphat' ? 'THÀNH PHÁT (Nội bộ)' : 'THĂNG LONG (Nội bộ)') 
                                                        : (proj.partners?.name || proj.client)}
                                                </p>
                                                <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{proj.name}</p>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl mb-3 border border-slate-100">
                                                <div>
                                                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Giá trị HĐ (Sau VAT)</p>
                                                    <p className="text-sm font-black text-blue-700">{formatBillion(activeEntity === 'sateco' && proj.acting_entity_key !== 'sateco' ? proj.satecoInternalRevenue : proj.totalValuePostVat)}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Đã Thu</p>
                                                    <p className="text-sm font-black text-emerald-600">{formatBillion(proj.totalIncome)}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Công nợ Hóa Đơn</p>
                                                    <p className={`text-sm font-black ${proj.debtInvoice > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{formatBillion(proj.debtInvoice)}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Công nợ Đề Nghị</p>
                                                    <p className={`text-sm font-black ${(proj.totalRequested - proj.totalIncome) > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>{formatBillion(proj.totalRequested - proj.totalIncome)}</p>
                                                </div>
                                            </div>

                                            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                                                {hasPermission('edit_contracts') && (
                                                    <button onClick={(e) => { e.stopPropagation(); onOpenFullscreen('contract_form', proj); }} className="px-3 py-1.5 rounded-lg text-blue-600 bg-blue-50 font-bold text-xs flex items-center gap-1">
                                                        <span className="material-symbols-outlined text-[14px]">edit_note</span> Sửa
                                                    </button>
                                                )}
                                                {hasPermission('delete_contracts') && (
                                                    <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ id: proj.id, name: proj.name }); }} className="px-3 py-1.5 rounded-lg text-rose-600 bg-rose-50 font-bold text-xs flex items-center gap-1">
                                                        <span className="material-symbols-outlined text-[14px]">delete</span>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Desktop Table View */}
                                <div className="hidden xl:block">
                                    <table className="w-full text-[12px] text-left border-separate border-spacing-0 whitespace-nowrap">
                                        <thead className="bg-slate-50 text-slate-500 uppercase tracking-widest text-[9px] font-black sticky top-0 z-20 shadow-sm border-b border-slate-200">
                                            <tr>
                                                <Th label="Mã DA/HĐ" sortKey="code" extraClass="px-2" />
                                                <Th label="HĐ Trước VAT" sortKey="preVat" align="right" extraClass="border-l border-slate-100 bg-blue-50/30" />
                                                <Th label="VAT (%)" sortKey="vatPercent" align="center" extraClass="bg-blue-50/30 text-blue-400" />
                                                <Th label="Giá trị Sau VAT" sortKey="postVat" align="right" extraClass="font-black text-blue-700 bg-blue-50/30" />
                                                <Th label="Tổng Xuất HĐ" sortKey="totalInvoice" align="right" extraClass="border-l border-slate-100" />
                                                <Th label="Tổng Đề nghị" sortKey="totalRequested" align="right" />
                                                <Th label="Tổng Thanh toán" sortKey="totalIncome" align="right" />
                                                <Th label="Công nợ HĐ" sortKey="debtInvoice" align="right" extraClass="border-l border-rose-50 font-black text-rose-600" />
                                                <Th label="Công nợ ĐN" sortKey="debtPayment" align="right" extraClass="font-black text-amber-700" />
                                                <Th label="Tình trạng Ký" sortKey="signature_status" align="center" extraClass="px-1.5" />
                                                <Th label="Quyết toán" sortKey="settlement_status" align="center" extraClass="px-1.5" />
                                                <Th label="TT Thi công" sortKey="status" align="center" extraClass="px-1.5" />
                                                <th className="px-1.5 py-2.5 text-center">Tác vụ</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 bg-white">
                                            {sortedProjects.map(proj => (
                                                <tr
                                                    key={proj.id}
                                                    onClick={() => handleViewDetail(proj)}
                                                    className={`hover:bg-blue-50/50 transition-colors cursor-pointer group ${proj.vat_percentage === 0 ? 'bg-yellow-50/50' : ''}`}
                                                >
                                                    <td className="px-2 py-2">
                                                        <div className="flex items-center gap-1.5">
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
                                                            <div>
                                                                <div className="font-mono text-[12px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded inline-block border border-blue-100">
                                                                    {proj.internal_code || proj.code}
                                                                </div>
                                                                {proj.internal_code && proj.code && (
                                                                    <div className="text-[10px] text-slate-400 mt-0.5 font-medium">#{proj.code}</div>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="mt-1">
                                                            {activeEntity === 'sateco' && proj.acting_entity_key !== 'sateco' ? (
                                                                <span className="flex items-center gap-1 text-[11px] font-bold text-slate-600">
                                                                    <span className="material-symbols-outlined text-[13px] text-emerald-600">sync_alt</span>
                                                                    {proj.acting_entity_key === 'thanhphat' ? 'THÀNH PHÁT (NB)' : 'THĂNG LONG (NB)'}
                                                                </span>
                                                            ) : (
                                                                <span
                                                                    onClick={(e) => { e.stopPropagation(); handleOpenPartnerDetail(proj); }}
                                                                    className="font-mono text-[12px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded inline-block border border-emerald-100 cursor-pointer hover:bg-emerald-100 hover:text-emerald-700 transition-colors"
                                                                    title={`Click xem chi tiết: ${proj.partners?.name || proj.client}`}
                                                                >
                                                                    {proj.partners?.code || proj.partners?.short_name || proj.client || '—'}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-1.5 py-1.5 text-right text-slate-500 border-l border-slate-50">
                                                        {formatBillion(activeEntity === 'sateco' && proj.acting_entity_key !== 'sateco' ? proj.satecoInternalRevenue / (1 + (proj.internal_vat_percentage ?? 8) / 100) : proj.totalValuePreVat)}
                                                    </td>
                                                    <td className="px-1.5 py-1.5 text-right">
                                                        {activeEntity === 'sateco' && proj.acting_entity_key !== 'sateco' ? (
                                                            <span className="text-slate-400 italic">
                                                                {proj.internal_vat_percentage ?? 8}%
                                                            </span>
                                                        ) : (
                                                            proj.vat_percentage === 0 ? (
                                                                <span className="px-1 py-0.5 rounded bg-yellow-400 text-slate-900 text-[9px] font-black border border-yellow-500 shadow-sm uppercase tracking-tighter">
                                                                    0% VAT
                                                                </span>
                                                            ) : (
                                                                <span className="text-slate-400 italic">
                                                                    {proj.vat_percentage ?? 8}%
                                                                </span>
                                                            )
                                                        )}
                                                    </td>
                                                    <td className="px-1.5 py-1.5 text-right font-medium text-blue-700 bg-blue-50/10" title={proj.total_approved_variations ? `Gốc: ${formatBillion(activeEntity === 'sateco' && proj.acting_entity_key !== 'sateco' ? proj.totalValuePostVat * (proj.sateco_contract_ratio||98)/100 - ((proj.total_approved_variations*(1 + (proj.vat_percentage ?? 8) / 100))*(proj.sateco_contract_ratio||98)/100) : proj.totalValuePostVat - (proj.total_approved_variations*(1 + (proj.vat_percentage ?? 8) / 100)))} + PS: ${formatBillion(activeEntity === 'sateco' && proj.acting_entity_key !== 'sateco' ? (proj.total_approved_variations*(1 + (proj.vat_percentage ?? 8) / 100)) * (proj.sateco_contract_ratio||98)/100 : (proj.total_approved_variations*(1 + (proj.vat_percentage ?? 8) / 100)))}` : ''}>
                                                        {formatBillion(activeEntity === 'sateco' && proj.acting_entity_key !== 'sateco' ? proj.satecoInternalRevenue : proj.totalValuePostVat)}
                                                    </td>
                                                    <td className="px-1.5 py-1.5 text-right text-slate-600 border-l border-slate-50">
                                                        {formatBillion(proj.totalInvoice)}
                                                    </td>
                                                    <td className="px-1.5 py-1.5 text-right text-slate-600">
                                                        {formatBillion(proj.totalRequested)}
                                                    </td>
                                                    <td className="px-1.5 py-1.5 text-right font-medium text-emerald-600">
                                                        {formatBillion(proj.totalIncome)}
                                                    </td>
                                                    <td className={`px-1.5 py-1.5 text-right font-medium border-l border-rose-50/50 ${proj.debtInvoice > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                        {formatBillion(proj.debtInvoice)}
                                                    </td>
                                                    <td className={`px-1.5 py-1.5 text-right font-medium ${(proj.totalRequested - proj.totalIncome) > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                                                        {formatBillion(proj.totalRequested - proj.totalIncome)}
                                                    </td>
                                                    <td className="px-1.5 py-1.5 text-center" onClick={(e) => e.stopPropagation()}>
                                                        <select
                                                            value={proj.signature_status || 'Chưa ký'}
                                                            onChange={(e) => handleSignatureStatusChange(proj.id, e.target.value, e)}
                                                            onClick={(e) => e.stopPropagation()}
                                                            className={`appearance-none cursor-pointer inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] uppercase tracking-widest font-black border outline-none transition-all hover:shadow-sm focus:ring-2 focus:ring-blue-500/20 ${(proj.signature_status || 'Chưa ký') === 'Đã ký' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-rose-100 text-rose-700 border-rose-200'}`}
                                                        >
                                                            {signatureOptions.map(opt => (
                                                                <option key={opt} value={opt} className="bg-white text-slate-700 font-medium">{opt}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td className="px-1.5 py-1.5 text-center" onClick={(e) => e.stopPropagation()}>
                                                        <select
                                                            value={proj.settlement_status || 'Chưa quyết toán'}
                                                            onChange={(e) => handleSettlementStatusChange(proj.id, e.target.value, e)}
                                                            onClick={(e) => e.stopPropagation()}
                                                            className={`appearance-none cursor-pointer inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-black border outline-none transition-all hover:shadow-sm focus:ring-2 focus:ring-blue-500/20 ${(proj.settlement_status || 'Chưa quyết toán') === 'Đã quyết toán' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : (proj.settlement_status || 'Chưa quyết toán') === 'Đang quyết toán' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-50 text-slate-700 border-slate-200'}`}
                                                        >
                                                            {settlementOptions.map(opt => (
                                                                <option key={opt} value={opt} className="bg-white text-slate-700 font-medium">{opt}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td className="px-1.5 py-1.5 text-center" onClick={(e) => e.stopPropagation()}>
                                                        <select
                                                            value={proj.status || 'Chưa thi công'}
                                                            onChange={(e) => handleStatusChange(proj.id, e.target.value, e)}
                                                            onClick={(e) => e.stopPropagation()}
                                                            className={`appearance-none cursor-pointer inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-black border outline-none transition-all hover:shadow-sm focus:ring-2 focus:ring-blue-500/20 ${getStatusColor(proj.status)}`}
                                                        >
                                                            {statusOptionsList.map(opt => (
                                                                <option key={opt} value={opt} className="bg-white text-slate-700 font-medium">
                                                                    {opt}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td className="px-1.5 py-1.5 text-center">
                                                        <div className="flex items-center justify-center gap-1">
                                                            {hasPermission('edit_contracts') && (<button onClick={(e) => { e.stopPropagation(); onOpenFullscreen('contract_form', proj); }} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Sửa"><span className="material-symbols-outlined notranslate text-[18px]" translate="no">edit_note</span></button>)}
                                                            {hasPermission('delete_contracts') && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        
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
                                                <td colSpan={3} className="px-2 py-3 text-right pr-4 text-slate-500 uppercase tracking-widest text-[9px] font-black italic bg-slate-100/50">
                                                    TỔNG HỢP TOÀN BỘ ({filteredProjects.length} DA)
                                                </td>
                                                <td className="px-1.5 py-3 text-right text-blue-700 text-[14px] font-black bg-blue-50/30">
                                                    {formatBillion(totalValueAll)}
                                                </td>
                                                <td className="px-1.5 py-3 text-right text-slate-600 text-[14px] font-black border-l border-slate-100">
                                                    {formatBillion(totalInvoiceAll)}
                                                </td>
                                                <td className="px-1.5 py-3 text-right text-slate-600 text-[14px] font-black">
                                                    {formatBillion(totalRequestedAll)}
                                                </td>
                                                <td className="px-1.5 py-3 text-right text-emerald-600 text-[14px] font-black">
                                                    {formatBillion(totalIncomeAll)}
                                                </td>
                                                <td className={`px-1.5 py-3 text-right text-[14px] font-black border-l border-rose-50 ${totalDebtInvoiceAll > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                    {formatBillion(totalDebtInvoiceAll)}
                                                </td>
                                                <td className={`px-1.5 py-3 text-right text-[14px] font-black bg-amber-50/20 ${(totalRequestedAll - totalIncomeAll) > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                                                    {formatBillion(totalRequestedAll - totalIncomeAll)}
                                                </td>
                                                <td colSpan={4} className="bg-slate-50"></td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </>
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

            {/* Partner Detail Modal */}
            {partnerModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200" onClick={() => setPartnerModal(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-emerald-50 to-white border-b border-slate-200">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-200">
                                    <span className="material-symbols-outlined text-[22px]">business</span>
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-slate-800">{partnerModal.code}</h3>
                                    <p className="text-xs font-medium text-slate-500">{partnerModal.name}</p>
                                </div>
                            </div>
                            <button onClick={() => setPartnerModal(null)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        {/* KPI Summary */}
                        <div className="grid grid-cols-4 gap-3 px-6 py-4 bg-slate-50 border-b border-slate-100">
                            {[
                                { label: 'Số HĐ', value: partnerModal.projects.length, color: 'blue', icon: 'description' },
                                { label: 'Tổng giá trị HĐ', value: formatBillion(partnerModal.projects.reduce((s, p) => s + (p.total_value_post_vat || 0), 0)), color: 'indigo', icon: 'payments' },
                                { label: 'Tổng đã thu', value: formatBillion(partnerModal.projects.reduce((s, p) => s + (p.computedTotalIncome || 0), 0)), color: 'emerald', icon: 'account_balance' },
                                { label: 'Tổng công nợ', value: formatBillion(partnerModal.projects.reduce((s, p) => s + Math.max(0, (p.total_value_post_vat || 0) - (p.computedTotalIncome || 0)), 0)), color: 'rose', icon: 'money_off' },
                            ].map((k, i) => (
                                <div key={i} className="bg-white rounded-xl p-3 border border-slate-100 shadow-sm">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={`material-symbols-outlined text-[16px] text-${k.color}-500`}>{k.icon}</span>
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{k.label}</span>
                                    </div>
                                    <span className={`text-lg font-black text-${k.color}-700`}>{k.value}</span>
                                </div>
                            ))}
                        </div>

                        {/* Projects Table */}
                        <div className="flex-1 overflow-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50 sticky top-0 z-10">
                                    <tr className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                                        <th className="px-4 py-3">Mã DA/HĐ</th>
                                        <th className="px-4 py-3">Tên dự án</th>
                                        <th className="px-4 py-3 text-right">Giá trị HĐ</th>
                                        <th className="px-4 py-3 text-right">Đã xuất HĐ</th>
                                        <th className="px-4 py-3 text-right text-emerald-600">Đã thu</th>
                                        <th className="px-4 py-3 text-right text-rose-600">Công nợ</th>
                                        <th className="px-4 py-3 text-center">TT Thi công</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {partnerModal.projects.map(p => {
                                        const debt = Math.max(0, (p.total_value_post_vat || 0) - (p.computedTotalIncome || 0));
                                        return (
                                            <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-4 py-3">
                                                    <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">{p.internal_code || p.code}</span>
                                                </td>
                                                <td className="px-4 py-3 text-xs font-medium text-slate-700 max-w-[200px] truncate">{p.name}</td>
                                                <td className="px-4 py-3 text-right text-xs font-bold text-slate-600 tabular-nums">{formatBillion(p.total_value_post_vat || 0)}</td>
                                                <td className="px-4 py-3 text-right text-xs font-bold text-slate-500 tabular-nums">{formatBillion(p.computedTotalInvoice || 0)}</td>
                                                <td className="px-4 py-3 text-right text-xs font-black text-emerald-600 tabular-nums">{formatBillion(p.computedTotalIncome || 0)}</td>
                                                <td className="px-4 py-3 text-right">
                                                    <span className={`text-xs font-black tabular-nums ${debt > 0 ? 'text-rose-600' : 'text-emerald-500'}`}>
                                                        {debt > 0 ? formatBillion(debt) : '✓'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={`text-[10px] font-black px-2 py-1 rounded-full ${
                                                        p.status === 'Đã hoàn thành' ? 'bg-emerald-50 text-emerald-600' :
                                                        p.status === 'Đang thi công' ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500'
                                                    }`}>{p.status}</span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                                    <tr className="text-xs font-black">
                                        <td className="px-4 py-3 text-slate-500 uppercase" colSpan={2}>TỔNG</td>
                                        <td className="px-4 py-3 text-right text-slate-700 tabular-nums">{formatBillion(partnerModal.projects.reduce((s, p) => s + (p.total_value_post_vat || 0), 0))}</td>
                                        <td className="px-4 py-3 text-right text-slate-700 tabular-nums">{formatBillion(partnerModal.projects.reduce((s, p) => s + (p.computedTotalInvoice || 0), 0))}</td>
                                        <td className="px-4 py-3 text-right text-emerald-700 tabular-nums">{formatBillion(partnerModal.projects.reduce((s, p) => s + (p.computedTotalIncome || 0), 0))}</td>
                                        <td className="px-4 py-3 text-right text-rose-700 tabular-nums">{formatBillion(partnerModal.projects.reduce((s, p) => s + Math.max(0, (p.total_value_post_vat || 0) - (p.computedTotalIncome || 0)), 0))}</td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
