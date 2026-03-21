import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import PaymentTracking from './PaymentTracking';
import MaterialTracking from './MaterialTracking';
import LaborTracking from './LaborTracking';
import * as drive from '../lib/googleDrive';
import DriveFileUploader from './common/DriveFileUploader';

const TABS = [
    { id: 'overview', label: 'Tổng quan Dự án', icon: 'dashboard', color: 'text-blue-600', bg: 'bg-blue-50' },
    { id: 'payment', label: 'Thanh toán & Thu hồi', icon: 'payments', color: 'text-green-600', bg: 'bg-green-50' },
    { id: 'material', label: 'Chi phí Vật tư', icon: 'inventory_2', color: 'text-orange-600', bg: 'bg-orange-50' },
    { id: 'labor', label: 'Chi phí Thầu phụ', icon: 'engineering', color: 'text-purple-600', bg: 'bg-purple-50' },
    { id: 'expense', label: 'Chi Phí Khác (Sateco)', icon: 'receipt_long', color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { id: 'addenda', label: 'Phụ lục Hợp đồng', icon: 'post_add', color: 'text-rose-600', bg: 'bg-rose-50' },
    { id: 'doc', label: 'Tài liệu & Drive', icon: 'folder_open', color: 'text-emerald-600', bg: 'bg-emerald-50' },
];

export default function ContractDetailedDashboard({ project, onBack, onOpenFullscreen, isInternalView = false }) {
    const [activeTab, setActiveTab] = useState('overview');
    const [addendas, setAddendas] = useState([]);
    const [payments, setPayments] = useState([]);
    const [expenses, setExpenses] = useState([]);
    const [expenseMaterials, setExpenseMaterials] = useState([]);
    const [expenseLabor, setExpenseLabor] = useState([]);
    const [subfolders, setSubfolders] = useState([]);
    const [selectedSubfolder, setSelectedSubfolder] = useState(null);
    const [loading, setLoading] = useState(true);

    const [newExpenseType, setNewExpenseType] = useState('Chi phí chung');
    const [newExpenseDate, setNewExpenseDate] = useState('');
    const [newExpenseAmount, setNewExpenseAmount] = useState('');
    const [newExpenseNotes, setNewExpenseNotes] = useState('');

    // === Dual Ratios Logic ===
    const SATECO_CONTRACT_RATIO = project && project.sateco_contract_ratio ? parseFloat(project.sateco_contract_ratio) / 100 : 0.98;
    const SATECO_ACTUAL_RATIO = project && project.sateco_actual_ratio ? parseFloat(project.sateco_actual_ratio) / 100 : 0.955;

    useEffect(() => {
        if (project) {
            fetchDashboardData();
            if (activeTab === 'doc' && project.google_drive_folder_id) {
                fetchSubfolders();
            }
        }
    }, [project, activeTab]);

    const fetchSubfolders = async () => {
        try {
            const folders = await drive.getSubfolders(project.google_drive_folder_id);
            setSubfolders(folders);
            if (folders.length > 0 && !selectedSubfolder) {
                setSelectedSubfolder(folders[0]);
            }
        } catch (err) {
            console.error('Error fetching subfolders:', err);
        }
    };

    const fetchDashboardData = async () => {
        setLoading(true);
        const [{ data: adds }, { data: pays }, { data: exps }, { data: expMats }, { data: expLabor }] = await Promise.all([
            supabase.from('addendas').select('*').eq('project_id', project.id).order('created_at', { ascending: false }),
            supabase.from('payments').select('*').eq('project_id', project.id).order('created_at', { ascending: true }),
            supabase.from('expenses').select('*').eq('project_id', project.id).order('expense_date', { ascending: false }),
            supabase.from('expense_materials').select('*').eq('project_id', project.id).order('expense_date', { ascending: false }),
            supabase.from('expense_labor').select('*').eq('project_id', project.id).order('created_at', { ascending: false }),
        ]);
        if (adds) setAddendas(adds);
        if (pays) setPayments(pays);
        if (exps) setExpenses(exps);
        if (expMats) setExpenseMaterials(expMats);
        if (expLabor) setExpenseLabor(expLabor);
        setLoading(false);
    };

    const handleAddExpense = async () => {
        if (!newExpenseDate || !newExpenseAmount) return;
        const { error } = await supabase.from('expenses').insert([{
            project_id: project.id,
            expense_type: newExpenseType,
            expense_date: newExpenseDate,
            amount: Number(newExpenseAmount),
            description: newExpenseNotes
        }]);
        if (error) { alert('Lỗi khi thêm chi phí'); return; }
        setNewExpenseDate(''); setNewExpenseAmount(''); setNewExpenseNotes('');
        fetchDashboardData();
    };

    const handleDeleteExpense = async (id) => {
        if (!window.confirm('Xóa chi phí này?')) return;
        await supabase.from('expenses').delete().eq('id', id);
        fetchDashboardData();
    };

    const fmt = (val) => new Intl.NumberFormat('vi-VN').format(Math.round(val || 0));
    const fmtB = (val) => {
        if (!val) return '0 ₫';
        if (Math.abs(val) >= 1000000000) return (val / 1000000000).toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) + ' Tỷ';
        if (Math.abs(val) >= 1000000) return (val / 1000000).toLocaleString('vi-VN', { minimumFractionDigits: 1 }) + ' Tr';
        return val.toLocaleString('vi-VN') + ' ₫';
    };
    const fmtDate = (d) => d ? new Date(d).toLocaleDateString('vi-VN') : '-';

    const getWarrantyStageDates = (startDate, months) => {
        if (!startDate) return { target: null, windowStart: null, windowEnd: null };
        const d = new Date(startDate);
        d.setMonth(d.getMonth() + months);
        const target = new Date(d);
        
        // Window is 15th-20th of the NEXT month
        const nextMonth = new Date(d);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        const windowStart = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 15);
        const windowEnd = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 20);
        
        return { target, windowStart, windowEnd };
    };

    // === Calculations (Defensive) ===
    if (!project) return null;

    const approvedAddendas = addendas?.filter(a => a.status === 'Đã duyệt') || [];
    const originalValue = Number(project?.original_value || 0);
    const totalAddendasValue = approvedAddendas.reduce((s, a) => s + Number(a.requested_value || 0), 0);
    const totalContractValueThangLong = originalValue + totalAddendasValue; // Tổng giá trị CĐT/Thăng Long
    
    // Sateco Allocations based on dual ratios
    const contractValueSateco = totalContractValueThangLong * SATECO_CONTRACT_RATIO; // Doanh thu nội bộ Sateco xuất HĐ
    const actualValueSateco = totalContractValueThangLong * SATECO_ACTUAL_RATIO; // Chi phí tiền mặt thực tế Sateco được giữ
    const internalRefundToThangLong = contractValueSateco - actualValueSateco; // Tiền mặt Sateco phải trả lại Thăng Long

    const satecoInternalActualDebt = payments?.reduce((s, p) => s + Number(p.internal_debt_actual || 0), 0) || 0;
    const satecoInternalPaid = payments?.reduce((s, p) => s + Number(p.internal_paid || 0), 0) || 0;
    const satecoRemainingDebt = satecoInternalActualDebt - satecoInternalPaid; // Thăng Long còn nợ Sateco bao nhiêu (Tiền mặt thực)
    const satecoPaidPercentage = actualValueSateco > 0 ? (satecoInternalPaid / actualValueSateco) * 100 : 0;

    const raw_cdtTotalInvoiced = payments?.reduce((s, p) => s + Number(p.invoice_amount || 0), 0) || 0;
    const cdtTotalInvoiced = isInternalView ? (payments?.reduce((s, p) => s + Number(p.internal_invoiced_amount || 0), 0) || (raw_cdtTotalInvoiced * SATECO_CONTRACT_RATIO)) : raw_cdtTotalInvoiced;
    const cdtTotalRequested = payments?.reduce((s, p) => s + Number(p.payment_request_amount || 0), 0) || 0;
    const raw_cdtTotalIncome = payments?.reduce((s, p) => s + Number(p.external_income || 0), 0) || 0;
    const cdtTotalIncome = isInternalView ? satecoInternalPaid : raw_cdtTotalIncome; 
    const cdtRemainingDebt = isInternalView ? (contractValueSateco - satecoInternalPaid) : (totalContractValueThangLong - raw_cdtTotalIncome);
    
    const payInvoiceRatio = cdtTotalInvoiced > 0 ? (cdtTotalIncome / cdtTotalInvoiced) * 100 : 0;
    const cdtPaymentPercentage = (isInternalView ? contractValueSateco : totalContractValueThangLong) > 0 
        ? (cdtTotalIncome / (isInternalView ? contractValueSateco : totalContractValueThangLong)) * 100 : 0;
    
    const hasInternalFlow = project?.sateco_actual_ratio || project?.sateco_contract_ratio || project?.satecoActualRatio || project?.satecoContractRatio;

    const totalMaterialExpenses = expenseMaterials?.reduce((s, e) => s + Number(e.total_amount || 0), 0) || 0;
    const totalLaborExpenses = expenseLabor?.reduce((s, e) => s + Number(e.paid_amount || 0), 0) || 0;
    const totalGenericExpenses = expenses?.reduce((s, e) => s + Number(e.amount || 0), 0) || 0;
    const totalExpensesSateco = totalMaterialExpenses + totalLaborExpenses + totalGenericExpenses; // Toàn bộ chi phí đổ vào Sateco
    
    // Profitability estimates
    const thangLongNetProfit = cdtTotalIncome - (cdtTotalIncome * SATECO_ACTUAL_RATIO); // TL giữ lại = Tổng thu - Tiền trả Sateco thực
    const satecoNetProfit = (cdtTotalIncome * SATECO_ACTUAL_RATIO) - totalExpensesSateco; // STC giữ lại = Tiền nhận từ TL - Tổng chi phí

    if (loading) {
        return (
            <div className="space-y-6 animate-pulse p-6">
                <div className="h-20 bg-slate-100 rounded-2xl w-full" />
                <div className="h-32 bg-slate-100 rounded-2xl w-full" />
                <div className="grid grid-cols-3 gap-6">
                    <div className="h-64 bg-slate-100 rounded-2xl col-span-1" />
                    <div className="h-64 bg-slate-100 rounded-2xl col-span-2" />
                </div>
            </div>
        );
    }

    return (
        <div className="pb-10 animate-fade-in text-slate-800 font-sans min-h-screen bg-slate-50/50">

            {/* ── Header ── */}
            <div className="flex flex-col md:flex-row justify-between items-start gap-3 md:gap-4 mb-6 md:sticky md:top-0 z-30 bg-white/80 backdrop-blur-md pb-3 md:pb-4 pt-2 -mt-2 px-2 border-b border-slate-200/60 shadow-sm">
                <div className="flex items-center gap-3 md:gap-4 min-w-0">
                    <button onClick={onBack} className="w-10 h-10 flex-shrink-0 flex items-center justify-center bg-white hover:bg-slate-50 rounded-xl transition-all shadow-sm border border-slate-200 text-slate-500 hover:text-blue-600">
                        <span className="material-symbols-outlined notranslate text-[22px]" translate="no">arrow_back</span>
                    </button>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                            {project.internal_code && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-blue-50 text-blue-700 uppercase tracking-widest border border-blue-200">{project.internal_code}</span>
                            )}
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500 uppercase tracking-widest border border-slate-200">{project.code}</span>
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border ${project.status === 'Đang thi công' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${project.status === 'Đang thi công' ? 'bg-blue-500 animate-pulse' : 'bg-emerald-500'}`}></span>
                                {project.status}
                            </span>
                        </div>
                        <h2 className="hidden md:block text-2xl font-black text-slate-800 leading-tight">
                            {project.name}
                        </h2>
                        <div className="hidden md:flex text-sm text-slate-500 font-medium mt-1 items-center gap-2">
                             <span className="material-symbols-outlined notranslate text-[16px]" translate="no">corporate_fare</span>
                             {isInternalView ? 'Đơn vị giao khoán:' : 'Chủ đầu tư:'} <strong className="text-slate-700">{isInternalView ? (project.acting_entity_key === 'thanhphat' ? 'CÔNG TY TNHH THÀNH PHÁT' : 'CÔNG TY TNHH THĂNG LONG') : project.client}</strong>
                        </div>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2 md:gap-3 w-full md:w-auto">
                    {project.document_link && (
                        <a 
                            href={project.document_link} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="btn bg-white hover:bg-emerald-50 text-emerald-600 font-bold shadow-sm border border-emerald-200 flex items-center gap-2 group transition-all text-xs md:text-sm"
                        >
                             <img src="https://www.gstatic.com/images/branding/product/1x/drive_2020q4_48dp.png" className="w-4 h-4 md:w-5 md:h-5" alt="Drive" />
                             <span className="hidden sm:inline">Mở Google Drive</span><span className="sm:hidden">Drive</span>
                        </a>
                    )}
                    <button onClick={() => onOpenFullscreen('contract_form', project)} className="btn bg-white hover:bg-slate-50 text-slate-600 font-bold shadow-sm border border-slate-200 flex items-center gap-2 group text-xs md:text-sm">
                        <span className="material-symbols-outlined notranslate text-[18px] md:text-[20px]" translate="no">edit_note</span> <span className="hidden sm:inline">Chỉnh sửa</span><span className="sm:hidden">Sửa</span>
                    </button>
                    <button onClick={() => onOpenFullscreen('addenda_new', project)} className="btn bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-md shadow-rose-500/20 flex items-center gap-2 group text-xs md:text-sm">
                        <span className="material-symbols-outlined notranslate text-[18px] md:text-[20px] group-hover:rotate-180 transition-transform duration-500" translate="no">post_add</span> <span className="hidden sm:inline">Phụ lục mới</span><span className="sm:hidden">Phụ lục</span>
                    </button>
                </div>
            </div>

            {/* ── KPI Quick Bar ── */}
            <div className="glass-panel overflow-hidden mb-8 shadow-sm">
                {/* Nhóm A: Luồng Thuế & CĐT */}
                <div className={`${isInternalView ? 'bg-emerald-50/50' : 'bg-white'} border-b border-slate-100 flex items-center px-4 py-2 gap-2`}>
                    <span className={`material-symbols-outlined notranslate ${isInternalView ? 'text-emerald-500' : 'text-blue-500'} text-[18px]`} translate="no">{isInternalView ? 'sync_alt' : 'account_balance'}</span>
                    <span className={`text-[10px] font-black ${isInternalView ? 'text-emerald-600' : 'text-slate-400'} uppercase tracking-widest`}>{isInternalView ? 'Luồng Doanh thu Nội bộ (Sateco nhận)' : 'Luồng Thuế & Chủ đầu tư'}</span>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-5 divide-y lg:divide-y-0 lg:divide-x divide-slate-100 border-b border-slate-100">
                    {[
                        { label: isInternalView ? 'Giá trị Khoán Nội bộ' : 'Tổng Giá trị Hợp đồng', value: fmtB(isInternalView ? contractValueSateco : totalContractValueThangLong), sub: isInternalView ? `Tỷ lệ khoán ${project.sateco_contract_ratio || 98}%` : `Gốc + ${approvedAddendas.length} phụ lục`, color: isInternalView ? 'text-emerald-700' : 'text-slate-800', dot: isInternalView ? 'bg-emerald-500' : 'bg-slate-400', icon: 'gavel' },
                        { label: isInternalView ? 'Đã thu từ Group' : 'CĐT Đã thu', value: fmtB(cdtTotalIncome), sub: `${(isInternalView ? contractValueSateco : totalContractValueThangLong) > 0 ? ((cdtTotalIncome / (isInternalView ? contractValueSateco : totalContractValueThangLong)) * 100).toFixed(1) : 0}% của Hợp đồng`, color: 'text-green-600', dot: 'bg-green-500', icon: 'payments' },
                        { label: isInternalView ? 'Công nợ Nội bộ' : 'CĐT Nợ hóa đơn', value: fmtB(Math.max(0, cdtRemainingDebt)), sub: cdtRemainingDebt > 0 ? (isInternalView ? 'Thăng Long chưa chuyển đủ' : 'Chưa thanh toán đủ Hóa đơn') : 'Đã thu đủ', color: cdtRemainingDebt > 0 ? 'text-rose-600' : 'text-emerald-500', dot: cdtRemainingDebt > 0 ? 'bg-rose-500' : 'bg-emerald-500', icon: 'warning' },
                        { label: 'Tổng Chi phí Sateco', value: fmtB(totalExpensesSateco), sub: 'Vật tư + Nhân công + CPSXC', color: 'text-orange-600', dot: 'bg-orange-500', icon: 'shopping_cart' },
                        { label: 'Lợi nhuận Thi công', value: fmtB(satecoNetProfit), sub: 'Sau khi trừ toàn bộ chi phí', color: satecoNetProfit >= 0 ? 'text-blue-700' : 'text-rose-700', dot: satecoNetProfit >= 0 ? 'bg-blue-500' : 'bg-rose-500', icon: 'insights' },
                    ].map((kpi, i) => (
                        <div key={i} className="p-5 relative group hover:bg-slate-50/50 transition-colors">
                            <div className="flex items-center gap-2 mb-2">
                                <span className={`w-2 h-2 rounded-full ${kpi.dot} shadow-sm`}></span>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{kpi.label}</p>
                            </div>
                            <p className={`text-2xl font-black tabular-nums tracking-tight ${kpi.color}`}>{kpi.value}</p>
                            <p className="text-xs font-medium text-slate-400 mt-1">{kpi.sub}</p>
                        </div>
                    ))}
                </div>

                {/* Nhóm B: Luồng Nội bộ (Sateco) */}
                {hasInternalFlow && !isInternalView && (
                    <>
                        <div className="bg-indigo-50/30 border-b border-indigo-100/50 flex items-center px-4 py-2 gap-2">
                            <span className="material-symbols-outlined notranslate text-indigo-500 text-[18px]" translate="no">engineering</span>
                            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Luồng Nội bộ (Thăng Long - Sateco)</span>
                        </div>
                        <div className="grid grid-cols-2 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-indigo-50">
                            {[
                                { label: 'Giao về Sateco', value: fmtB(actualValueSateco), sub: `Tỷ lệ khoán: ${project.sateco_actual_ratio || 95.5}%`, color: 'text-indigo-600', dot: 'bg-indigo-500', icon: 'account_balance' },
                                { label: 'Đã thanh toán Sateco', value: fmtB(satecoInternalPaid), sub: `Đạt ${satecoPaidPercentage.toFixed(1)}% hạn mức`, color: 'text-emerald-600', dot: 'bg-emerald-500', icon: 'check_circle' },
                                { label: 'Tổng Chi phí Sateco', value: fmtB(totalExpensesSateco), sub: 'Vật tư + Nhân công + CPSXC', color: 'text-orange-600', dot: 'bg-orange-500', icon: 'shopping_cart' },
                            ].map((kpi, i) => (
                                <div key={i} className="p-5 relative group hover:bg-indigo-50/20 transition-colors">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className={`w-2 h-2 rounded-full ${kpi.dot} shadow-sm`}></span>
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{kpi.label}</p>
                                    </div>
                                    <p className={`text-2xl font-black tabular-nums tracking-tight ${kpi.color}`}>{kpi.value}</p>
                                    <p className="text-xs font-medium text-slate-400 mt-1">{kpi.sub}</p>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* ── Tab Navigation ── */}
            <div className="flex gap-1 md:gap-2 mb-6 md:mb-8 overflow-x-auto no-scrollbar pb-1 px-1 bg-slate-100/60 p-1 rounded-xl md:rounded-2xl border border-slate-200/50">
                {TABS.map(tab => {
                    const isActive = activeTab === tab.id;
                    const badgeCount = tab.id === 'addenda' ? addendas.length : tab.id === 'payment' ? payments.length : 0;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-1.5 md:gap-2.5 px-3 md:px-4 py-2 md:py-2.5 rounded-lg md:rounded-xl text-[11px] md:text-sm font-bold whitespace-nowrap transition-all ${isActive
                                ? `bg-white shadow-sm ${tab.color} ring-1 ring-slate-200/80`
                                : 'text-slate-400 hover:bg-white/50 hover:text-slate-600'
                                }`}
                        >
                            <span className={`material-symbols-outlined notranslate text-[16px] md:text-[18px] ${isActive ? tab.color : 'text-slate-400'}`} translate="no">{tab.icon}</span>
                            <span className="hidden sm:inline">{tab.label}</span>
                            <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
                            {badgeCount > 0 && (
                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${tab.id === 'addenda' ? 'bg-rose-100 text-rose-700' : 'bg-green-100 text-green-700'}`}>{badgeCount}</span>
                            )}
                        </button>
                    )
                })}
            </div>

            {/* ── Tab: Tổng quan ── */}
            {activeTab === 'overview' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* LEFT COLUMN */}
                    <div className="lg:col-span-4 space-y-6">
                        {/* Contract Specs */}
                        <div className="glass-panel p-6 shadow-sm border border-slate-200/60">
                            <h3 className="font-bold text-sm mb-5 flex items-center gap-2 border-b border-slate-100 pb-3">
                                <span className="material-symbols-outlined notranslate text-blue-500 text-[20px]" translate="no">description</span>Đặc tả Hợp đồng
                            </h3>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-100">
                                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Loại hợp đồng</span>
                                    <span className="font-bold text-slate-700">{project.project_type || 'Thi công'}</span>
                                </div>
                                <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-100">
                                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Khu vực</span>
                                    <span className="font-bold text-slate-700">{project.location || 'Chưa cập nhật'}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100/50">
                                         <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest block mb-1">Khởi công</span>
                                         <span className="font-bold text-blue-700">{fmtDate(project.start_date)}</span>
                                    </div>
                                    <div className="bg-emerald-50/50 p-3 rounded-lg border border-emerald-100/50">
                                         <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest block mb-1">Hoàn thành</span>
                                         <span className="font-bold text-emerald-700">{fmtDate(project.end_date)}</span>
                                    </div>
                                </div>
                                {/* Payment Schedule (Milestones) */}
                                {(project.payment_schedule && project.payment_schedule.length > 0) ? (
                                    <div className="mt-4 space-y-3">
                                        <p className="text-[10px] text-blue-500 uppercase font-black tracking-widest mb-2 flex items-center gap-1">
                                            <span className="material-symbols-outlined notranslate text-[16px]" translate="no">account_tree</span> Lộ trình Thanh toán ({project.payment_schedule.length} đợt)
                                        </p>
                                        <div className="space-y-2">
                                            {project.payment_schedule.map((ms, idx) => (
                                                <div key={idx} className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm relative overflow-hidden group">
                                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 opacity-30"></div>
                                                    <div className="flex justify-between items-start mb-1.5">
                                                        <span className="text-xs font-black text-slate-800">{ms.name}</span>
                                                        <div className="flex items-center gap-1.5 flex-wrap justify-end">
                                                            {ms.has_guarantee && (
                                                                <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 text-[8px] font-black border border-amber-100 uppercase">Bảo lãnh</span>
                                                            )}
                                                            {ms.due_days > 0 && (
                                                                <span className="px-1.5 py-0.5 rounded bg-orange-50 text-orange-600 text-[8px] font-black border border-orange-100 flex items-center gap-0.5">
                                                                    <span className="material-symbols-outlined text-[10px]">schedule</span>
                                                                    {ms.due_days} ngày
                                                                </span>
                                                            )}
                                                            <span className="text-blue-600 font-black text-xs">{ms.percentage}%</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex justify-between items-baseline">
                                                        <span className="text-[10px] text-slate-400 font-medium truncate max-w-[180px]" title={ms.condition}>{ms.condition || '—'}</span>
                                                        <span className="font-bold text-slate-700 text-sm">{fmtB(ms.amount)}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    project.payment_terms && (
                                        <div className="mt-2 bg-slate-50 p-4 rounded-lg border border-slate-100">
                                            <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-2 flex items-center gap-1">
                                                <span className="material-symbols-outlined notranslate text-[14px]" translate="no">gavel</span> Điều khoản TT
                                            </p>
                                            <p className="text-sm font-medium text-slate-600 leading-relaxed">{project.payment_terms}</p>
                                        </div>
                                    )
                                )}

                                {/* Fallback for textual terms if schedule exists */}
                                {(project.payment_schedule && project.payment_schedule.length > 0 && project.payment_terms) && (
                                    <div className="mt-4 p-3 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mb-1">Ghi chú bổ sung</p>
                                        <p className="text-[11px] text-slate-500 italic">{project.payment_terms}</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Sateco Details */}
                         <div className="glass-panel p-6 shadow-sm border border-slate-200/60 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-100 rounded-full blur-[50px] -z-10"></div>
                            <h3 className="font-bold text-sm mb-5 flex items-center gap-2 border-b border-slate-100 pb-3">
                                <span className="material-symbols-outlined notranslate text-indigo-500 text-[20px]" translate="no">account_tree</span>Quyết toán Nội bộ (Sateco)
                            </h3>
                            <div className="space-y-4">
                                
                                <div className="grid grid-cols-2 gap-3 mb-2">
                                    <div className="bg-white border border-slate-200 p-3 rounded-lg shadow-sm text-center">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Tỷ lệ HĐ</span>
                                        <span className="font-black text-indigo-600 text-lg">{project.sateco_contract_ratio || 98}%</span>
                                    </div>
                                    <div className="bg-white border border-slate-200 p-3 rounded-lg shadow-sm text-center">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Tỷ lệ Thực tế</span>
                                        <span className="font-black text-purple-600 text-lg">{project.sateco_actual_ratio || 95.5}%</span>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[11px] font-bold text-slate-500">Giới hạn Chi phí (Thực tế)</span>
                                        <span className="font-black text-slate-800">{fmt(actualValueSateco)} ₫</span>
                                    </div>
                                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                        <div className="bg-indigo-500 h-full rounded-full transition-all" style={{ width: `${Math.min(100, (totalExpensesSateco / actualValueSateco) * 100 || 0)}%` }} />
                                    </div>
                                    <div className="flex justify-between items-center mt-1">
                                         <span className="text-[10px] text-slate-400 font-medium">Đã chi / Tiêu hao</span>
                                         <span className="font-bold text-[#f97316] text-xs">{fmt(totalExpensesSateco)} ₫</span>
                                    </div>

                                    <div className="h-px w-full bg-slate-100 my-4"></div>

                                    <div className="flex justify-between items-center text-sm">
                                        <span className="font-bold text-slate-600">Thăng Long đã thanh toán</span>
                                        <span className="font-bold text-emerald-600">{fmt(satecoInternalPaid)} ₫</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="font-bold text-slate-600">Dư nợ Sateco</span>
                                        <span className="font-bold text-rose-500">{fmt(satecoRemainingDebt)} ₫</span>
                                    </div>
                                </div>

                                {internalRefundToThangLong > 0 && (
                                     <div className="mt-4 bg-purple-50/80 rounded-xl p-4 border border-purple-200">
                                         <div className="flex items-center gap-2 mb-2">
                                              <span className="material-symbols-outlined notranslate text-[16px] text-purple-600" translate="no">currency_exchange</span>
                                              <span className="text-[10px] font-black text-purple-800 uppercase tracking-widest">Sateco hoàn tiền</span>
                                         </div>
                                         <div className="flex justify-between items-end">
                                             <span className="text-xs font-medium text-purple-700 w-2/3 leading-tight">Dự kiến bồi hoàn nội bộ chênh lệch tỷ lệ ({(project.sateco_contract_ratio || 98) - (project.sateco_actual_ratio || 95.5)}%)</span>
                                             <span className="font-black text-purple-700">{fmt(internalRefundToThangLong)} ₫</span>
                                         </div>
                                     </div>
                                )}
                            </div>
                        </div>

                        {/* Warranty Timeline: Premium Redesign */}
                        <div className="glass-panel p-8 shadow-sm border border-slate-200/60 relative overflow-hidden bg-white/40">
                            {/* Decorative background element */}
                            <div className="absolute -top-10 -right-10 w-40 h-40 bg-amber-50 rounded-full blur-[80px] -z-10"></div>
                            
                            <div className="flex justify-between items-center mb-8 border-b border-slate-100 pb-4">
                                <h3 className="font-black text-sm flex items-center gap-3 text-slate-700">
                                    <span className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600 shadow-sm">
                                        <span className="material-symbols-outlined notranslate text-[20px]" translate="no">verified_user</span>
                                    </span>
                                    Lịch thu hồi Bảo hành ({project.warranty_percentage || 5}%)
                                </h3>
                                {project.handover_date && (
                                    <div className="text-right">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Bàn giao ngày</span>
                                        <span className="font-bold text-slate-700 text-xs bg-slate-100 px-2 py-1 rounded-md border border-slate-200">{fmtDate(project.handover_date)}</span>
                                    </div>
                                )}
                            </div>
                            
                            {!project.handover_date ? (
                                <div className="text-center py-10 bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200">
                                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border border-slate-100">
                                        <span className="material-symbols-outlined notranslate text-slate-300 text-3xl" translate="no">event_busy</span>
                                    </div>
                                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Thiếu dữ liệu vận hành</p>
                                    <p className="text-[11px] text-slate-400 mt-2 max-w-[200px] mx-auto leading-relaxed">Cập nhật <span className="font-bold text-slate-600">Ngày bàn giao thực tế</span> để kích hoạt bộ đếm ngược bảo hành.</p>
                                </div>
                            ) : (
                                <div className="relative pl-8">
                                    {/* The Vertical Timeline Line */}
                                    <div className="absolute left-[15px] top-2 bottom-6 w-0.5 bg-gradient-to-b from-amber-200 via-slate-100 to-slate-100"></div>
                                    
                                    <div className="space-y-8">
                                        {(() => {
                                            const schedule = (project.warranty_schedule && project.warranty_schedule.length > 0) 
                                                ? project.warranty_schedule 
                                                : [{ label: 'Thu hồi Bảo hành', ratio: project.warranty_percentage || 5, months: project.warranty_duration_months || 24 }];
                                            
                                            return schedule.map((stage, idx) => {
                                                const { target, windowStart, windowEnd } = getWarrantyStageDates(project.handover_date, stage.months);
                                                const now = new Date();
                                                const isCurrentWindow = now >= windowStart && now <= windowEnd;
                                                const isPast = now > windowEnd;

                                                return (
                                                    <div key={idx} className="relative group animate-fade-in" style={{ animationDelay: `${idx * 150}ms` }}>
                                                        {/* Timeline Dot Marker */}
                                                        <div className={`absolute -left-[25.5px] top-1 w-5 h-5 rounded-full z-10 flex items-center justify-center border-2 transition-all duration-500 ${
                                                            isCurrentWindow 
                                                                ? 'bg-amber-500 border-amber-200 shadow-[0_0_12px_rgba(245,158,11,0.5)] scale-125' 
                                                                : isPast 
                                                                    ? 'bg-emerald-500 border-emerald-100' 
                                                                    : 'bg-white border-slate-200 group-hover:border-amber-300'
                                                        }`}>
                                                            {isPast ? (
                                                                <span className="material-symbols-outlined notranslate text-white text-[12px]" translate="no">check</span>
                                                            ) : isCurrentWindow ? (
                                                                <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping"></span>
                                                            ) : (
                                                                <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                                            )}
                                                        </div>

                                                        {/* Stage Card */}
                                                        <div className={`p-5 rounded-2xl border transition-all duration-300 ${
                                                            isCurrentWindow 
                                                                ? 'bg-amber-50/80 border-amber-300 shadow-md ring-1 ring-amber-200 -translate-y-1' 
                                                                : 'bg-white/60 border-slate-100 hover:border-slate-300 hover:shadow-sm'
                                                        }`}>
                                                            <div className="flex justify-between items-start mb-4">
                                                                <div>
                                                                    <div className="flex items-center gap-2 mb-1">
                                                                        <p className={`text-[10px] font-black uppercase tracking-[0.1em] ${isCurrentWindow ? 'text-amber-700' : 'text-slate-400'}`}>{stage.label}</p>
                                                                        {isPast && <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">Đã xong</span>}
                                                                    </div>
                                                                    <p className="font-black text-slate-800 text-xl tracking-tight leading-none leading-none flex items-baseline gap-1">
                                                                        {stage.ratio}% 
                                                                        <span className="text-[11px] font-medium text-slate-400 ml-1">≈ {fmtB(totalContractValueThangLong * (stage.ratio / 100))}</span>
                                                                    </p>
                                                                </div>
                                                                <div className="text-right">
                                                                    <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Dự kiến thu</p>
                                                                    <p className="text-sm font-black text-slate-700">{fmtDate(target)}</p>
                                                                </div>
                                                            </div>
                                                            
                                                            <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50/80 border border-slate-100/50">
                                                                <div className="flex items-center gap-2">
                                                                    <span className={`material-symbols-outlined notranslate text-[16px] ${isCurrentWindow ? 'text-amber-500' : 'text-blue-500'}`} translate="no">calendar_today</span>
                                                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Cửa sổ thanh toán:</span>
                                                                </div>
                                                                <span className={`text-[11px] font-black ${isCurrentWindow ? 'text-amber-700 animate-pulse' : 'text-blue-700'}`}>
                                                                    {windowStart.getDate()}-{windowEnd.getDate()} Tháng {windowStart.getMonth() + 1}/{windowStart.getFullYear()}
                                                                </span>
                                                            </div>

                                                            {isCurrentWindow && (
                                                                <div className="mt-4 flex items-center gap-2 text-amber-700 bg-amber-100/50 p-2.5 rounded-xl border border-amber-200/50">
                                                                    <span className="material-symbols-outlined notranslate text-[18px] animate-bounce" translate="no">verified</span>
                                                                    <p className="text-[10px] font-black uppercase tracking-tight">Yêu cầu thu hồi ngay!</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            });
                                        })()}
                                    </div>
                                </div>
                            )}

                            {project.has_warranty_guarantee && (
                                <div className="mt-8 p-4 bg-gradient-to-br from-emerald-50 to-white border border-emerald-200 rounded-2xl flex items-center gap-4 relative overflow-hidden group">
                                     <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-100/50 rounded-full -mr-10 -mt-10 blur-xl group-hover:scale-150 transition-transform"></div>
                                     <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm shrink-0">
                                        <span className="material-symbols-outlined notranslate text-[24px]" translate="no">verified</span>
                                     </div>
                                     <div className="relative z-10">
                                        <p className="text-[11px] font-black text-emerald-800 uppercase tracking-widest leading-none mb-1">Sẵn sàng bảo lãnh ngân hàng</p>
                                        <p className="text-[10px] text-emerald-600 font-medium leading-relaxed">Tiền bảo hành sẽ được thu hồi ngay lập tức qua ngân hàng, không chờ mốc thời gian.</p>
                                     </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* MIDDLE COLUMN: Cash Operations */}
                    <div className="lg:col-span-8 space-y-6">
                        {/* External Payments Timeline */}
                        <div className="glass-panel p-6 shadow-sm border border-slate-200/60 relative">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="font-bold text-lg flex items-center gap-2 text-slate-800">
                                    <span className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center text-green-600">
                                        <span className="material-symbols-outlined notranslate text-[18px]" translate="no">receipt_long</span>
                                    </span>
                                    Tiến độ Phê duyệt & Thanh toán từ CĐT
                                </h3>
                                <div className="text-right">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Tỷ lệ Lấy tiền</p>
                                    <p className="font-black text-green-600 text-xl">{cdtPaymentPercentage.toFixed(1)}%</p>
                                </div>
                            </div>
                            
                            {payments.length === 0 ? (
                                <div className="text-center py-10 bg-slate-50 border border-dashed border-slate-200 rounded-xl flex flex-col items-center">
                                    <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center mb-3">
                                        <span className="material-symbols-outlined notranslate text-slate-300 text-2xl" translate="no">payments</span>
                                    </div>
                                    <p className="text-sm font-bold text-slate-500">Chưa tạo Đợt yêu cầu thanh toán nào.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {payments.map((p, i) => {
                                        const isPaid = Number(p.external_income) >= Number(p.payment_request_amount) && Number(p.payment_request_amount) > 0;
                                        const isPartial = Number(p.external_income) > 0 && !isPaid;
                                        return (
                                            <div key={p.id} className="bg-white border border-slate-200 rounded-xl p-5 hover:border-blue-400 cursor-pointer transition-all hover:shadow-md group"
                                                onClick={() => setActiveTab('payment')}>
                                                <div className="flex justify-between items-center mb-4">
                                                    <div className="flex gap-4 items-center">
                                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black shadow-inner border-2 ${isPaid ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : isPartial ? 'bg-orange-50 text-orange-600 border-orange-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                                                            {i + 1}
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-[15px] group-hover:text-blue-600 transition-colors">{p.stage_name}</div>
                                                            <div className="text-xs font-medium text-slate-400 mt-0.5 flex items-center gap-1.5">
                                                                <span className="material-symbols-outlined notranslate text-[14px]" translate="no">event</span> Ngày xuất HĐ: {fmtDate(p.invoice_date)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <span className={`px-3 py-1 rounded-md text-[11px] font-black uppercase tracking-widest ${isPaid ? 'bg-emerald-100 text-emerald-700' : isPartial ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-600'}`}>
                                                        {isPaid ? 'Hoàn thành' : isPartial ? 'Một phần' : 'Chờ thu'}
                                                    </span>
                                                </div>
                                                <div className="grid grid-cols-3 gap-3">
                                                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-100/50">
                                                        <div className="text-slate-400 text-[10px] uppercase font-bold tracking-widest mb-1">Đề nghị / Nghiệm thu</div>
                                                        <div className="font-black text-slate-700">{fmt(p.payment_request_amount)} ₫</div>
                                                    </div>
                                                    <div className="bg-green-50/50 rounded-lg p-3 border border-green-100/50 relative overflow-hidden">
                                                        <div className="absolute top-0 right-0 w-8 h-8 bg-green-200 rounded-full blur-[20px]"></div>
                                                        <div className="text-green-600 text-[10px] uppercase font-bold tracking-widest mb-1 relative z-10">Thực thu CĐT</div>
                                                        <div className="font-black text-green-700 relative z-10">{fmt(p.external_income)} ₫</div>
                                                    </div>
                                                    <div className="bg-rose-50/50 rounded-lg p-3 border border-rose-100/50">
                                                        <div className="text-rose-500 text-[10px] uppercase font-bold tracking-widest mb-1">CĐT Giam nợ HĐ</div>
                                                        <div className="font-black text-rose-600">{fmt(Number(p.invoice_amount) - Number(p.external_income))} ₫</div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* P&L Estimations */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                             {/* Thang Long Profit */}
                             <div className="glass-panel p-6 shadow-sm border border-slate-200/60 relative overflow-hidden bg-gradient-to-br from-white to-blue-50/30">
                                 <div className="absolute top-0 right-0 p-4 opacity-[0.03]">
                                     <span className="material-symbols-outlined notranslate text-[100px]" translate="no">account_balance</span>
                                 </div>
                                 <h3 className="font-bold text-sm mb-5 flex items-center gap-2 border-b border-primary/10 pb-3 z-10 relative">
                                    <span className="material-symbols-outlined notranslate text-primary text-[20px]" translate="no">query_stats</span>Hiệu quả Đầu tư (Thăng Long)
                                </h3>
                                <div className="relative z-10 space-y-4">
                                     <div>
                                        <div className="flex justify-between items-center text-xs font-bold text-slate-500 mb-1">
                                            <span>Tiền thu về từ CĐT</span>
                                            <span>{fmt(cdtTotalIncome)} ₫</span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs font-bold text-slate-500 mb-2">
                                            <span>Trích chuyển lại Sateco (TT)</span>
                                            <span>- {fmt(cdtTotalIncome * SATECO_ACTUAL_RATIO)} ₫</span>
                                        </div>
                                     </div>
                                     <div className="pt-3 border-t border-primary/10">
                                         <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Lợi nhuận Gross Thăng Long giữ</p>
                                         <p className={`text-3xl font-black tabular-nums tracking-tight ${thangLongNetProfit >= 0 ? 'text-blue-600' : 'text-rose-600'}`}>
                                            {thangLongNetProfit >= 0 ? '+' : ''}{fmt(thangLongNetProfit)} ₫
                                         </p>
                                     </div>
                                </div>
                             </div>

                             {/* Sateco Profit */}
                             <div className="glass-panel p-6 shadow-sm border border-slate-200/60 relative overflow-hidden bg-gradient-to-br from-white to-orange-50/30">
                                 <div className="absolute top-0 right-0 p-4 opacity-[0.03]">
                                     <span className="material-symbols-outlined notranslate text-[100px]" translate="no">engineering</span>
                                 </div>
                                 <h3 className="font-bold text-sm mb-5 flex items-center gap-2 border-b border-orange-500/10 pb-3 z-10 relative">
                                    <span className="material-symbols-outlined notranslate text-orange-500 text-[20px]" translate="no">insights</span>Hiệu quả Thi công (Sateco)
                                </h3>
                                 <div className="relative z-10 space-y-4">
                                      <div className="space-y-2">
                                        <div className="flex justify-between text-xs font-bold text-slate-600 items-center">
                                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-orange-400"></span> Vật tư</span>
                                            <span>{fmt(totalMaterialExpenses)} ₫</span>
                                        </div>
                                        <div className="flex justify-between text-xs font-bold text-slate-600 items-center">
                                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-purple-400"></span> Thầu phụ/Nhân công</span>
                                            <span>{fmt(totalLaborExpenses)} ₫</span>
                                        </div>
                                        <div className="flex justify-between text-xs font-bold text-slate-600 items-center">
                                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-indigo-400"></span> Chi phí BQL & Khác</span>
                                            <span>{fmt(totalGenericExpenses)} ₫</span>
                                        </div>
                                     </div>
                                     <div className="pt-3 border-t border-orange-500/10">
                                         <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Lợi nhuận Thi công Sateco</p>
                                         <p className={`text-3xl font-black tabular-nums tracking-tight ${satecoNetProfit >= 0 ? 'text-green-600' : 'text-rose-600'}`}>
                                            {satecoNetProfit >= 0 ? '+' : ''}{fmt(satecoNetProfit)} ₫
                                         </p>
                                     </div>
                                </div>
                             </div>
                        </div>

                    </div>
                </div>
            )}

            {/* ── Tab: Thanh toán ── */}
            {activeTab === 'payment' && (
                <div className="glass-panel p-2 shadow-sm border border-slate-200/60 bg-white/50">
                     <PaymentTracking project={project} embedded={true} />
                </div>
            )}

            {/* ── Tab: Vật tư ── */}
            {activeTab === 'material' && (
                <div className="glass-panel p-2 shadow-sm border border-slate-200/60 bg-white/50">
                    <MaterialTracking project={project} embedded={true} />
                </div>
            )}

            {/* ── Tab: Thầu phụ ── */}
            {activeTab === 'labor' && (
                <div className="glass-panel p-2 shadow-sm border border-slate-200/60 bg-white/50">
                    <LaborTracking project={project} embedded={true} />
                </div>
            )}

            {/* ── Tab: Chi phí khác ── */}
            {activeTab === 'expense' && (
                <div className="glass-panel shadow-sm border border-slate-200/60 overflow-hidden bg-white/70">
                    <div className="p-6 border-b border-slate-200/60 bg-indigo-50/50">
                         <h3 className="font-bold text-lg mb-2 flex items-center gap-3">
                            <span className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-200/50">
                                <span className="material-symbols-outlined notranslate text-[22px]" translate="no">receipt_long</span>
                            </span>
                            Quản lý Chi phí Khác (Chỉ ngân Sateco)
                        </h3>
                        <p className="text-sm font-medium text-slate-500 ml-14">Hạch toán trực tiếp vào chi phí vận hành Của Sateco tại công trường.</p>
                    </div>
                   
                   <div className="p-6">
                        <div className="flex flex-wrap items-end gap-5 mb-8 bg-white p-5 rounded-2xl shadow-card border border-slate-200/60">
                            <div className="flex-1 min-w-[140px]">
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">Ngày</label>
                                <input type="date" value={newExpenseDate} onChange={e => setNewExpenseDate(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all shadow-sm" />
                            </div>
                            <div className="flex-[1.5] min-w-[160px]">
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">Mục Chi</label>
                                <select value={newExpenseType} onChange={e => setNewExpenseType(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all shadow-sm appearance-none">
                                    <option>BCH công trường (VPTT, điện nước...)</option>
                                    <option>Máy thi công & Xăng dầu</option>
                                    <option>Nghiệm thu & Thẩm duyệt</option>
                                    <option>Tiếp khách & Giao tế</option>
                                    <option>Lương cứng BQL</option>
                                    <option>Chi phí Chung (Khác)</option>
                                </select>
                            </div>
                            <div className="flex-[1.5] min-w-[140px]">
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">Số tiền (VNĐ)</label>
                                <div className="relative">
                                    <input type="number" value={newExpenseAmount} onChange={e => setNewExpenseAmount(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 pr-8 text-sm font-black text-indigo-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all shadow-sm" placeholder="0" />
                                    <span className="absolute right-4 top-3 text-indigo-400 font-bold">₫</span>
                                </div>
                            </div>
                            <div className="flex-[2] min-w-[180px]">
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">Diễn giải</label>
                                <input type="text" value={newExpenseNotes} onChange={e => setNewExpenseNotes(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all shadow-sm" placeholder="Mô tả cụ thể khoản chi..." />
                            </div>
                            <button onClick={handleAddExpense} className="btn bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md shadow-indigo-500/20 px-6 py-3 h-[46px]">Hạch toán</button>
                        </div>
                        
                        {expenses.length === 0 ? (
                            <div className="text-center py-12 bg-slate-50 border border-dashed border-slate-300 rounded-2xl flex flex-col items-center">
                                 <div className="w-16 h-16 bg-white rounded-full shadow-sm border border-slate-100 flex items-center justify-center mb-4">
                                     <span className="material-symbols-outlined notranslate text-slate-300 text-3xl" translate="no">receipt_long</span>
                                 </div>
                                <p className="font-bold text-slate-600 mb-1">Chưa có khoản chi phí khác nào</p>
                                <p className="text-xs text-slate-400">Các khoản chi nhỏ lẻ sẽ hiển thị tại đây.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto ring-1 ring-slate-200 rounded-2xl bg-white shadow-sm">
                                <table className="w-full text-sm text-left whitespace-nowrap">
                                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 tracking-widest uppercase font-black text-[10px]">
                                        <tr>
                                            <th className="px-6 py-4">Ngày ghi nhận</th>
                                            <th className="px-6 py-4">Hạng mục chi phí</th>
                                            <th className="px-6 py-4 w-full">Diễn giải</th>
                                            <th className="px-6 py-4 text-right">Giá trị (VNĐ)</th>
                                            <th className="px-6 py-4 w-16 text-center">Tác vụ</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {expenses.map(e => (
                                            <tr key={e.id} className="hover:bg-slate-50/80 transition-colors group">
                                                <td className="px-6 py-4 font-semibold text-slate-600">{fmtDate(e.expense_date)}</td>
                                                <td className="px-6 py-4">
                                                    <span className="inline-flex px-2.5 py-1 rounded bg-indigo-50 text-indigo-700 font-bold text-xs border border-indigo-100">
                                                        {e.expense_type}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-slate-600 font-medium truncate max-w-[400px]">{e.description || '—'}</td>
                                                <td className="px-6 py-4 text-right font-black text-indigo-600 text-[15px]">{fmt(e.amount)}</td>
                                                <td className="px-6 py-4 text-center">
                                                    <button onClick={() => handleDeleteExpense(e.id)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-all opacity-0 group-hover:opacity-100">
                                                        <span className="material-symbols-outlined notranslate text-[18px]" translate="no">delete</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-slate-50/80 font-black text-sm border-t-2 border-slate-200">
                                        <tr>
                                            <td colSpan={3} className="px-6 py-5 text-slate-600 uppercase tracking-widest text-[11px]">Tổng cộng Nhóm chi phí khác</td>
                                            <td className="px-6 py-5 text-right text-indigo-700 text-[18px] tabular-nums">{fmt(totalGenericExpenses)}</td>
                                            <td></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        )}
                   </div>
                </div>
            )}

            {/* ── Tab: Phụ lục ── */}
            {activeTab === 'addenda' && (
                 <div className="glass-panel shadow-sm border border-slate-200/60 overflow-hidden bg-white/70">
                    <div className="flex justify-between items-center p-6 border-b border-slate-200/60 bg-rose-50/50">
                        <div>
                             <h3 className="font-bold text-lg mb-1 flex items-center gap-3">
                                <span className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600 shadow-sm border border-rose-200/50">
                                    <span className="material-symbols-outlined notranslate text-[22px]" translate="no">post_add</span>
                                </span>
                                Lịch sử Phụ lục phát sinh ({addendas.length})
                            </h3>
                            <p className="text-sm font-medium text-slate-500 ml-14">Quản lý nâng/giảm giá trị Hợp đồng pháp lý gốc.</p>
                        </div>
                        <button onClick={() => onOpenFullscreen('addenda_new', project)} className="btn bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold shadow-md shadow-rose-500/20 flex items-center gap-2">
                            <span className="material-symbols-outlined notranslate text-[18px]" translate="no">add</span> Thêm phụ lục mới
                        </button>
                    </div>
                    
                    <div className="p-8">
                        {addendas.length === 0 ? (
                            <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200 flex flex-col items-center">
                                <div className="w-20 h-20 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center mb-5">
                                    <span className="material-symbols-outlined notranslate text-5xl text-slate-300" translate="no">post_add</span>
                                </div>
                                <p className="font-bold text-slate-600 text-lg mb-1">Dự án chưa có phát sinh</p>
                                <p className="text-sm text-slate-400 font-medium">Bấm "Thêm phụ lục mới" để ghi nhận biến động giá trị.</p>
                            </div>
                        ) : (
                            <div className="relative">
                                {/* Timeline line */}
                                <div className="absolute left-[39px] top-6 bottom-6 w-0.5 bg-slate-200" />
                                <div className="space-y-8 ml-[14px]">
                                    {addendas.map((a, i) => (
                                        <div key={a.id} className="relative flex items-start gap-6 group pl-[26px]">
                                            {/* Timeline dot */}
                                            <div className={`absolute -left-1.5 top-5 w-[22px] h-[22px] rounded-full border-[4px] border-white shadow-sm z-10 transition-transform group-hover:scale-125 ${a.status === 'Đã duyệt' ? 'bg-emerald-500' : a.status === 'Chờ duyệt' ? 'bg-orange-400' : 'bg-slate-400'}`} />
                                            
                                            <div className="glass-panel w-full bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                                                <div className="flex justify-between items-start mb-4 border-b border-slate-100 pb-4">
                                                    <div>
                                                        <div className="font-black text-lg text-slate-800 mb-0.5 flex items-center gap-2">
                                                            <span className="text-rose-600">#{addendas.length - i}</span> Phụ lục Hợp đồng
                                                        </div>
                                                        <div className="text-sm font-medium text-slate-500 flex items-center gap-1.5">
                                                            <span className="material-symbols-outlined notranslate text-[16px]" translate="no">event</span> {fmtDate(a.created_at)}
                                                        </div>
                                                    </div>
                                                    <span className={`px-4 py-1.5 rounded-md text-[11px] font-black uppercase tracking-widest border ${a.status === 'Đã duyệt' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : a.status === 'Chờ duyệt' ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                                                        {a.status}
                                                    </span>
                                                </div>

                                                {a.description && (
                                                    <p className="text-sm font-medium text-slate-600 mb-5 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">{a.description}</p>
                                                )}

                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm mt-2">
                                                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex flex-col justify-center">
                                                        <div className="text-[10px] font-black text-slate-400 mb-1 uppercase tracking-widest">Giá trị tăng thêm (Yêu cầu)</div>
                                                        <div className="font-black text-slate-800 text-xl">{fmt(a.requested_value)} ₫</div>
                                                    </div>
                                                    <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-100/50 flex flex-col justify-center relative overflow-hidden">
                                                        <div className="absolute top-0 right-0 w-16 h-16 bg-blue-100 rounded-full blur-[20px]"></div>
                                                        <div className="text-[10px] font-black text-blue-500 mb-1 uppercase tracking-widest relative z-10">Tự động phân quỹ Sateco ({project.sateco_contract_ratio || 98}%)</div>
                                                        <div className="font-black text-blue-700 text-xl relative z-10">{fmt(Number(a.requested_value) * SATECO_CONTRACT_RATIO)} ₫</div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Summary */}
                                <div className="mt-8 ml-[56px] bg-slate-50 rounded-2xl border border-slate-200 p-6 flex justify-between items-center shadow-sm relative overflow-hidden">
                                     <div className="absolute top-0 right-0 w-32 h-32 bg-orange-100 rounded-full blur-[40px] -z-0"></div>
                                    <div className="text-sm font-medium text-slate-600 relative z-10">
                                        Đã phê duyệt <span className="font-black text-rose-600 text-lg mx-1">{approvedAddendas.length}</span> / {addendas.length} phụ lục
                                    </div>
                                    <div className="text-right relative z-10">
                                        <div className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1">Tổng tiền phát sinh đã duyệt</div>
                                        <div className="font-black text-rose-600 text-3xl tabular-nums tracking-tight">+{fmt(totalAddendasValue)} ₫</div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
            {/* ── Tab: Tài liệu ── */}
            {activeTab === 'doc' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    <div className="lg:col-span-4">
                        <div className="glass-panel p-6 shadow-sm border border-slate-200/60 h-full">
                            <h3 className="font-bold text-sm mb-5 flex items-center gap-2 border-b border-slate-100 pb-3">
                                <span className="material-symbols-outlined notranslate text-emerald-500 text-[20px]" translate="no">folder_shared</span>Cấu trúc thư mục
                            </h3>
                            
                            {!project.google_drive_folder_id ? (
                                <div className="text-center py-10 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                                    <span className="material-symbols-outlined notranslate text-slate-300 text-4xl mb-3" translate="no">link_off</span>
                                    <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Chưa kết nối Drive</p>
                                    <p className="text-[11px] text-slate-400 mt-2 px-6">Hãy cập nhật thông tin dự án để khởi tạo thư mục Drive tự động.</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {subfolders.map(f => (
                                        <button
                                            key={f.id}
                                            onClick={() => setSelectedSubfolder(f)}
                                            className={`w-full flex items-center gap-3 p-3.5 rounded-xl transition-all border ${
                                                selectedSubfolder?.id === f.id
                                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm'
                                                    : 'bg-white border-slate-100 text-slate-500 hover:bg-slate-50 hover:border-slate-200'
                                            }`}
                                        >
                                            <span className={`material-symbols-outlined notranslate text-[20px] ${selectedSubfolder?.id === f.id ? 'filled' : ''}`}>
                                                {selectedSubfolder?.id === f.id ? 'folder_open' : 'folder'}
                                            </span>
                                            <span className="text-sm font-bold truncate">{f.name}</span>
                                            {selectedSubfolder?.id === f.id && (
                                                <span className="material-symbols-outlined notranslate text-[16px] ml-auto animate-pulse" translate="no">chevron_right</span>
                                            )}
                                        </button>
                                    ))}
                                    
                                    <div className="mt-8 pt-6 border-t border-slate-100">
                                        <a 
                                            href={`https://drive.google.com/drive/folders/${project.google_drive_folder_id}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-slate-900 text-white text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg"
                                        >
                                            <img src="https://www.gstatic.com/images/branding/product/1x/drive_2020q4_48dp.png" className="w-4 h-4" alt="Drive" />
                                            Mở toàn bộ trên Drive
                                        </a>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    
                    <div className="lg:col-span-8">
                        <div className="glass-panel p-8 shadow-sm border border-slate-200/60 bg-white/40 min-h-[400px] flex flex-col items-center justify-center">
                            {!project.google_drive_folder_id ? (
                                <div className="text-center max-w-sm">
                                    <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6">
                                        <span className="material-symbols-outlined notranslate text-emerald-400 text-4xl" translate="no">add_to_drive</span>
                                    </div>
                                    <h3 className="text-lg font-black text-slate-800 mb-2">Khởi tạo không gian lưu trữ</h3>
                                    <p className="text-sm text-slate-500 font-medium leading-relaxed mb-6">Bạn cần khởi tạo cấu trúc thư mục dự án trên Google Drive trước khi có thể tải tài liệu lên.</p>
                                    <button 
                                        onClick={() => onOpenFullscreen('contract_form', project)}
                                        className="px-8 py-3 bg-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 hover:bg-emerald-700 transition-all uppercase text-xs tracking-widest"
                                    >
                                        Chỉnh sửa & Kết nối Drive
                                    </button>
                                </div>
                            ) : selectedSubfolder ? (
                                <div className="w-full h-full flex flex-col">
                                    <div className="mb-8 flex items-center gap-4">
                                        <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm border border-emerald-200/50">
                                            <span className="material-symbols-outlined notranslate text-[28px]" translate="no">upload_file</span>
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-black text-slate-800 tracking-tight">Tải tài liệu lên</h3>
                                            <p className="text-sm font-medium text-slate-500">
                                                Tài liệu sẽ được đưa vào thư mục <span className="text-emerald-600 font-bold">"{selectedSubfolder.name}"</span>
                                            </p>
                                        </div>
                                    </div>
                                    
                                    <DriveFileUploader 
                                        parentId={selectedSubfolder.id} 
                                        folderName={selectedSubfolder.name}
                                        onUploadSuccess={() => {
                                            // Optional: Show a success toast or message
                                            console.log('Upload success!');
                                        }}
                                    />
                                    
                                    <div className="mt-12 p-6 rounded-2xl bg-white border border-slate-200 shadow-sm">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-1.5 h-6 bg-emerald-500 rounded-full"></div>
                                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Hướng dẫn</h4>
                                        </div>
                                        <ul className="space-y-3">
                                            {[
                                                'Chọn thư mục đích bên tay trái (Hợp đồng, Bản vẽ...).',
                                                'Kéo thả file hoặc nhấn vào vùng tải lên để chọn tài liệu.',
                                                'Hỗ trợ tất cả định dạng file (PDF, Excel, Ảnh, Bản vẽ...).',
                                                'File sau khi tải lên sẽ khả dụng ngay lập tức cho tất cả nhân sự có quyền truy cập.'
                                            ].map((text, i) => (
                                                <li key={i} className="flex gap-3 text-sm font-medium text-slate-600">
                                                    <span className="text-emerald-500 font-black">{i + 1}.</span>
                                                    {text}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center">
                                    <div className="animate-spin w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                                    <p className="text-sm font-bold text-slate-500">Đang tải cấu trúc thư mục...</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
