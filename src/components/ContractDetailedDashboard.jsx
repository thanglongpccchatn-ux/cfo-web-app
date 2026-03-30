import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import PaymentTracking from './PaymentTracking';
import SkeletonLoader from './common/SkeletonLoader';
import MaterialTracking from './MaterialTracking';
import LaborTracking from './LaborTracking';
import * as drive from '../lib/googleDrive';
import DriveFileUploader from './common/DriveFileUploader';
import { smartToast } from '../utils/globalToast';
import { fmt, fmtB, fmtDate } from '../utils/formatters';

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

    const fetchSubfolders = React.useCallback(async () => {
        try {
            const folders = await drive.getSubfolders(project.google_drive_folder_id);
            setSubfolders(folders);
            if (folders.length > 0 && !selectedSubfolder) {
                setSelectedSubfolder(folders[0]);
            }
        } catch (err) {
            console.error('Error fetching subfolders:', err);
        }
    }, [project.google_drive_folder_id, selectedSubfolder]);

    const fetchDashboardData = React.useCallback(async () => {
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
    }, [project.id]);

    useEffect(() => {
        if (project) {
            fetchDashboardData();
            if (activeTab === 'doc' && project.google_drive_folder_id) {
                fetchSubfolders();
            }
        }
    }, [project, activeTab, fetchDashboardData, fetchSubfolders]);

    async function handleAddExpense() {
        if (!newExpenseDate || !newExpenseAmount) return;
        const { error } = await supabase.from('expenses').insert([{
            project_id: project.id,
            expense_type: newExpenseType,
            expense_date: newExpenseDate,
            amount: Number(newExpenseAmount),
            description: newExpenseNotes
        }]);
        if (error) { smartToast('Lỗi khi thêm chi phí'); return; }
        setNewExpenseDate(''); setNewExpenseAmount(''); setNewExpenseNotes('');
        fetchDashboardData();
    };

    const handleDeleteExpense = async (id) => {
        if (!window.confirm('Xóa chi phí này?')) return;
        await supabase.from('expenses').delete().eq('id', id);
        fetchDashboardData();
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
    const satecoInternalPaid = payments?.reduce((s, p) => s + Number(p.internal_paid || 0), 0) || 0;
    const satecoPaidPercentage = contractValueSateco > 0 ? (satecoInternalPaid / contractValueSateco) * 100 : 0;
    const raw_cdtTotalInvoiced = payments?.reduce((s, p) => s + Number(p.invoice_amount || 0), 0) || 0;
    const cdtTotalInvoiced = isInternalView ? (payments?.reduce((s, p) => s + Number(p.internal_invoiced_amount || 0), 0) || (raw_cdtTotalInvoiced * SATECO_CONTRACT_RATIO)) : raw_cdtTotalInvoiced;
    const raw_cdtTotalIncome = payments?.reduce((s, p) => s + Number(p.external_income || 0), 0) || 0;
    const cdtTotalIncome = isInternalView ? satecoInternalPaid : raw_cdtTotalIncome; 
    const cdtRemainingDebt = isInternalView ? (contractValueSateco - satecoInternalPaid) : (totalContractValueThangLong - raw_cdtTotalIncome);
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

    // === 6 PERFORMANCE KPIs & RATING (New Request) ===
    
    // 1. Tỷ suất LNG/DT (10%)
    const kpi_lng_dt = contractValueSateco > 0 ? (satecoNetProfit / contractValueSateco) * 100 : 0;
    
    // 2. Tỷ suất SL & CP (15%)
    const kpi_sl_cp = cdtTotalInvoiced > 0 ? ((cdtTotalInvoiced - totalExpensesSateco) / cdtTotalInvoiced) * 100 : 0;
    
    // 3. Hệ số SPI (20%)
    const today = new Date();
    const startDate = new Date(project.start_date);
    const endDate = new Date(project.end_date);
    const totalDays = Math.max(1, (endDate - startDate) / (1000 * 60 * 60 * 24));
    const daysPassed = Math.max(0, (today - startDate) / (1000 * 60 * 60 * 24));
    const timeProgress = Math.min(1, daysPassed / totalDays);
    const plannedVolume = contractValueSateco * timeProgress;
    const kpi_spi = plannedVolume > 0 ? (cdtTotalInvoiced / plannedVolume) : (cdtTotalInvoiced > 0 ? 1.2 : 1.0); // SPI > 1 is good

    // 4. Chuyển đổi DT -> SL (20%)
    const kpi_dt_sl = cdtTotalInvoiced > 0 ? (cdtTotalIncome / cdtTotalInvoiced) * 100 : 0;
    
    // 5. Chuyển đổi Thu -> DT (10%)
    const kpi_thu_dt = contractValueSateco > 0 ? (cdtTotalIncome / contractValueSateco) * 100 : 0;
    
    // 6. Cân đối Thu - Chi (5%)
    const kpi_thu_chi = totalExpensesSateco > 0 ? (cdtTotalIncome / totalExpensesSateco) : 0;

    // Project Rating (Scale 0-100)
    // Weights: 10, 15, 20, 20, 10, 5 -> Total 80
    const ratingScoreRaw = (
        (Math.min(100, Math.max(0, kpi_lng_dt + 10)) * 10) + // Offsetting for margin, typical 10% profit = 20 points
        (Math.min(100, Math.max(0, kpi_sl_cp + 5)) * 15) + 
        (Math.min(100, kpi_spi * 50) * 20) + 
        (Math.min(100, kpi_dt_sl) * 20) + 
        (Math.min(100, kpi_thu_dt) * 10) + 
        (Math.min(100, kpi_thu_chi * 50) * 5)
    ) / 80;
    
    const ratingScore = Math.min(100, Math.round(ratingScoreRaw));
    const getRatingLabel = (s) => {
        if (s >= 90) return { label: 'A+', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', desc: 'Xuất sắc' };
        if (s >= 80) return { label: 'A', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', desc: 'Tốt' };
        if (s >= 65) return { label: 'B', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', desc: 'Trung bình' };
        return { label: 'C', color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200', desc: 'Cần lưu ý' };
    };
    const rating = getRatingLabel(ratingScore);

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
                <div className="space-y-6">
                    {/* Performance Row */}
                    <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                        {/* Rating Card */}
                        <div className={`p-6 rounded-2xl border ${rating.border} ${rating.bg} flex flex-col items-center justify-center relative overflow-hidden group`}>
                             <div className={`absolute inset-0 ${rating.bg} opacity-30 -z-10 group-hover:scale-110 transition-transform duration-700`}></div>
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 z-10">Xếp hạng Dự án</h3>
                            <div className={`w-24 h-24 rounded-full border-4 ${rating.border} bg-white flex flex-col items-center justify-center shadow-md z-10 relative`}>
                                <span className={`text-3xl font-black ${rating.color}`}>{rating.label}</span>
                                <div className="absolute -bottom-2 px-2 py-0.5 rounded-full bg-white border border-slate-100 shadow-sm">
                                    <span className="text-[10px] font-black text-slate-500">{ratingScore}đ</span>
                                </div>
                            </div>
                            <p className={`mt-5 px-3 py-1 rounded-full text-[10px] font-black uppercase ${rating.bg} ${rating.color} border ${rating.border} z-10`}>{rating.desc}</p>
                        </div>
                        
                        {/* KPI Grid */}
                        <div className="xl:col-span-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                            {[
                                { label: 'Tỷ suất LNG/DT', value: kpi_lng_dt, suffix: '%', icon: 'trending_up', color: 'emerald', desc: 'Mali / Doanh thu' },
                                { label: 'Tỷ suất SL & CP', value: kpi_sl_cp, suffix: '%', icon: 'balance', color: 'blue', desc: '(SL - CP) / SL' },
                                { label: 'Chỉ số SPI', value: kpi_spi, suffix: '', icon: 'speed', color: kpi_spi >= 1 ? 'green' : 'rose', desc: 'Tiến độ thi công' },
                                { label: 'Chuyển đổi ĐT-SL', value: kpi_dt_sl, suffix: '%', icon: 'account_balance_wallet', color: 'amber', desc: 'Thu / Sản lượng' },
                                { label: 'Chuyển đổi Thu-DT', value: kpi_thu_dt, suffix: '%', icon: 'currency_exchange', color: 'indigo', desc: 'Thu / Tổng HĐ' },
                                { label: 'Cân đối Thu - Chi', value: kpi_thu_chi, suffix: 'x', icon: 'compare_arrows', color: kpi_thu_chi >= 1 ? 'emerald' : 'orange', desc: 'Thu / Chi thực' },
                            ].map((k, i) => (
                                <div key={i} className="glass-panel p-4 shadow-sm border border-slate-200/60 hover:shadow-md transition-all group bg-white">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className={`w-8 h-8 rounded-lg bg-${k.color}-50 text-${k.color}-600 flex items-center justify-center group-hover:scale-110 transition-transform`}>
                                            <span className="material-symbols-outlined notranslate text-[18px]" translate="no">{k.icon}</span>
                                        </div>
                                        <span className="text-[12px] font-black text-slate-200">#0{i+1}</span>
                                    </div>
                                    <div>
                                        <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-tighter mb-1 h-6">{k.label}</h4>
                                        <div className="flex items-baseline gap-0.5">
                                            <span className={`text-base font-black text-${k.color}-600 tracking-tighter`}>{k.value.toFixed(k.suffix === 'x' ? 2 : 1)}</span>
                                            <span className="text-[9px] font-bold text-slate-400">{k.suffix}</span>
                                        </div>
                                        <p className="text-[8px] text-slate-400 mt-2 italic truncate">{k.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        {/* LEFT COLUMN: Docs & Specs */}
                        <div className="lg:col-span-4 space-y-6">
                            {/* Contract Specs */}
                            <div className="glass-panel p-6 shadow-sm border border-slate-200/60 bg-white/50">
                                <h3 className="font-bold text-sm mb-5 flex items-center gap-2 border-b border-slate-100 pb-3 text-slate-700">
                                    <span className="material-symbols-outlined notranslate text-blue-500 text-[20px]" translate="no">description</span>Đặc tả Hợp đồng
                                </h3>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Loại hợp đồng</span>
                                        <span className="font-bold text-slate-700 text-sm">{project.project_type || 'Thi công'}</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100/50">
                                             <span className="text-[9px] font-bold text-blue-500 uppercase tracking-widest block mb-1">Khởi công</span>
                                             <span className="font-bold text-blue-700 text-xs">{fmtDate(project.start_date)}</span>
                                        </div>
                                        <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-100/50">
                                             <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest block mb-1">Hoàn thành</span>
                                             <span className="font-bold text-emerald-700 text-xs">{fmtDate(project.end_date)}</span>
                                        </div>
                                    </div>
                                    
                                    {/* Payment Schedule (Milestones) */}
                                    {(project.payment_schedule && project.payment_schedule.length > 0) && (
                                        <div className="mt-4 space-y-3">
                                            <p className="text-[10px] text-blue-500 uppercase font-black tracking-widest mb-2 flex items-center gap-1">
                                                <span className="material-symbols-outlined notranslate text-[16px]" translate="no">account_tree</span> Lộ trình Thanh toán ({project.payment_schedule.length})
                                            </p>
                                            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                                {project.payment_schedule.map((ms, idx) => (
                                                    <div key={idx} className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm relative overflow-hidden group">
                                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 opacity-20"></div>
                                                        <div className="flex justify-between items-start mb-1">
                                                            <span className="text-[11px] font-black text-slate-800 truncate pr-2">{ms.name}</span>
                                                            <span className="text-blue-600 font-black text-[11px] shrink-0">{ms.percentage}%</span>
                                                        </div>
                                                        <div className="flex justify-between items-baseline">
                                                            <span className="text-[9px] text-slate-400 truncate max-w-[120px]">{ms.condition || '—'}</span>
                                                            <span className="font-bold text-slate-700 text-xs">{fmtB(ms.amount)}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Internal Settlement */}
                            <div className="glass-panel p-6 shadow-sm border border-slate-200/60 bg-white/50 relative overflow-hidden">
                                <div className="absolute -top-6 -right-6 w-24 h-24 bg-indigo-50 rounded-full blur-2xl"></div>
                                <h3 className="font-bold text-sm mb-5 flex items-center gap-2 border-b border-slate-100 pb-3 text-slate-700 relative z-10">
                                    <span className="material-symbols-outlined notranslate text-indigo-500 text-[20px]" translate="no">account_tree</span>Quyết toán Nội bộ (Sateco)
                                </h3>
                                <div className="space-y-4 relative z-10">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="bg-white border border-slate-100 p-3 rounded-xl shadow-sm text-center">
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Tỷ lệ HĐ</span>
                                            <span className="font-black text-indigo-600 text-base">{project.sateco_contract_ratio || 98}%</span>
                                        </div>
                                        <div className="bg-white border border-slate-100 p-3 rounded-xl shadow-sm text-center">
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Tỷ lệ Thực</span>
                                            <span className="font-black text-purple-600 text-base">{project.sateco_actual_ratio || 95.5}%</span>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center text-[11px] font-bold text-slate-500">
                                            <span>Tiêu hao Ngân sách</span>
                                            <span className="text-slate-700">{Math.round((totalExpensesSateco / actualValueSateco) * 100 || 0)}%</span>
                                        </div>
                                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                            <div className="bg-indigo-500 h-full rounded-full transition-all" style={{ width: `${Math.min(100, (totalExpensesSateco / actualValueSateco) * 100 || 0)}%` }} />
                                        </div>
                                        <div className="flex justify-between items-center text-[10px] text-slate-400 font-medium">
                                             <span>Đã chi: {fmt(totalExpensesSateco)} ₫</span>
                                             <span>Quỹ: {fmt(actualValueSateco)} ₫</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* RIGHT COLUMN: Operations & Timeline */}
                        <div className="lg:col-span-8 space-y-6">
                            {/* Payments Timeline */}
                            <div className="glass-panel p-6 shadow-sm border border-slate-200/60 bg-white/50">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="font-bold text-sm flex items-center gap-2 text-slate-800">
                                        <span className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center text-green-600">
                                            <span className="material-symbols-outlined notranslate text-[18px]" translate="no">payments</span>
                                        </span>
                                        Tiến độ Phê duyệt & Thu hồi từ CĐT
                                    </h3>
                                    <span className="text-xs font-black text-green-600 bg-green-50 px-3 py-1.5 rounded-xl border border-green-100 shadow-sm">
                                        Đã thu: {cdtPaymentPercentage.toFixed(1)}%
                                    </span>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {payments.slice(0, 4).map((p, i) => {
                                        const isPaid = Number(p.external_income) >= Number(p.payment_request_amount) && Number(p.payment_request_amount) > 0;
                                        return (
                                            <div key={p.id} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm hover:border-green-200 transition-all cursor-pointer group" onClick={() => setActiveTab('payment')}>
                                                <div className="flex justify-between items-start mb-3">
                                                    <span className="text-[10px] font-black text-slate-300 uppercase">Đợt {i+1}</span>
                                                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${isPaid ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>
                                                        {isPaid ? 'Đã thu' : 'Chờ thu'}
                                                    </span>
                                                </div>
                                                <div className="font-bold text-xs text-slate-800 mb-2 truncate">{p.stage_name}</div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div className="p-2 bg-slate-50 rounded-lg">
                                                        <p className="text-[8px] font-bold text-slate-400 uppercase">Nghiệm thu</p>
                                                        <p className="font-black text-slate-700 text-[11px]">{fmtB(p.payment_request_amount)}</p>
                                                    </div>
                                                    <div className="p-2 bg-green-50/50 rounded-lg">
                                                        <p className="text-[8px] font-bold text-green-500 uppercase">Thực thu</p>
                                                        <p className="font-black text-green-700 text-[11px]">{fmtB(p.external_income)}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {payments.length === 0 && (
                                        <div className="col-span-2 text-center py-10 opacity-50">Chưa có dữ liệu thanh toán</div>
                                    )}
                                </div>
                            </div>

                            {/* P&L Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                 {/* TL Profit */}
                                 <div className="glass-panel p-6 shadow-sm border border-slate-200/60 bg-gradient-to-br from-blue-50/50 to-white relative overflow-hidden">
                                     <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-blue-100/50 rounded-full blur-2xl"></div>
                                     <h3 className="text-xs font-black text-blue-800 uppercase tracking-widest mb-4 flex items-center gap-2 relative z-10">
                                         <span className="material-symbols-outlined text-[18px]">account_balance</span> Thăng Long (Invest)
                                     </h3>
                                     <div className="relative z-10">
                                         <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Lợi nhuận Gross Dự kiến</p>
                                         <p className={`text-2xl font-black tabular-nums ${thangLongNetProfit >= 0 ? 'text-blue-600' : 'text-rose-600'}`}>
                                            {fmt(thangLongNetProfit)} ₫
                                         </p>
                                         <div className="mt-4 pt-4 border-t border-blue-100 flex justify-between items-center text-[10px] font-bold text-slate-500">
                                             <span>Thực thu CĐT:</span>
                                             <span>{fmt(cdtTotalIncome)} ₫</span>
                                         </div>
                                     </div>
                                 </div>

                                 {/* Sateco Profit */}
                                 <div className="glass-panel p-6 shadow-sm border border-slate-200/60 bg-gradient-to-br from-emerald-50/50 to-white relative overflow-hidden">
                                     <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-emerald-100/50 rounded-full blur-2xl"></div>
                                     <h3 className="text-xs font-black text-emerald-800 uppercase tracking-widest mb-4 flex items-center gap-2 relative z-10">
                                         <span className="material-symbols-outlined text-[18px]">engineering</span> Sateco (Execute)
                                     </h3>
                                     <div className="relative z-10">
                                         <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Lợi nhuận Thi công</p>
                                         <p className={`text-2xl font-black tabular-nums ${satecoNetProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                            {fmt(satecoNetProfit)} ₫
                                         </p>
                                         <div className="mt-4 pt-4 border-t border-emerald-100 flex justify-between items-center text-[10px] font-bold text-slate-500">
                                             <span>Tổng chi phí:</span>
                                             <span>{fmt(totalExpensesSateco)} ₫</span>
                                         </div>
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
                                            // Upload success
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
