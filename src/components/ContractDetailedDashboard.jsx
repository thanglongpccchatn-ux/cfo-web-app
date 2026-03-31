import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import PaymentTracking from './PaymentTracking';
import SkeletonLoader from './common/SkeletonLoader';
import MaterialTracking from './MaterialTracking';
import LaborTracking from './LaborTracking';
import * as drive from '../lib/googleDrive';
import { smartToast } from '../utils/globalToast';
import { fmt, fmtB, fmtDate } from '../utils/formatters';
import ContractExpenseTab from './contract/ContractExpenseTab';
import ContractAddendaTab from './contract/ContractAddendaTab';
import ContractDriveTab from './contract/ContractDriveTab';
import PaymentHistoryRow from './documentTracking/PaymentHistoryRow';

const TABS = [
    { id: 'overview', label: 'Tổng quan Dự án', icon: 'dashboard', color: 'text-blue-600', bg: 'bg-blue-50' },
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
    
    // History expansion state
    const [expandedId, setExpandedId] = useState(null);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [paymentHistoryCurrent, setPaymentHistoryCurrent] = useState([]);

    const toggleExpansion = async (item) => {
        if (expandedId === item.id) {
            setExpandedId(null);
            return;
        }
        setExpandedId(item.id);
        setHistoryLoading(true);
        setPaymentHistoryCurrent([]);
        try {
            const { data, error } = await supabase
                .from('payment_history')
                .select('*')
                .eq('payment_id', item.id)
                .order('payment_date', { ascending: false });
            if (error) throw error;
            setPaymentHistoryCurrent(data || []);
        } catch (error) {
            console.error('Error fetching payment history:', error);
        } finally {
            setHistoryLoading(false);
        }
    };

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
                        { label: isInternalView ? 'Giá Khoán Nội bộ (Gồm VAT)' : 'Tổng Giá trị HĐ (Gồm VAT)', value: fmtB(isInternalView ? contractValueSateco : totalContractValueThangLong), sub: isInternalView ? `Tỷ lệ khoán ${project.sateco_contract_ratio || 98}%` : `Gốc + ${approvedAddendas.length} phụ lục`, color: isInternalView ? 'text-emerald-700' : 'text-slate-800', dot: isInternalView ? 'bg-emerald-500' : 'bg-slate-400', icon: 'gavel' },
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
                        <div className={`p-4 rounded-xl border ${rating.border} ${rating.bg} flex flex-col items-center justify-center relative overflow-hidden group h-full`}>
                             <div className={`absolute inset-0 ${rating.bg} opacity-30 -z-10 group-hover:scale-110 transition-transform duration-700`}></div>
                            <div className="flex flex-col sm:flex-row items-center gap-3 z-10 w-full justify-center">
                                <div className={`w-14 h-14 shrink-0 rounded-full border-2 ${rating.border} bg-white flex flex-col items-center justify-center shadow-sm relative`}>
                                    <span className={`text-xl font-black ${rating.color}`}>{rating.label}</span>
                                    <div className="absolute -bottom-1.5 px-1 py-0 rounded-full bg-white border border-slate-100 shadow-sm">
                                        <span className="text-[8px] font-black text-slate-500">{ratingScore}đ</span>
                                    </div>
                                </div>
                                <div className="text-center sm:text-left">
                                    <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Xếp hạng Dự án</h3>
                                    <p className={`px-2 py-0.5 rounded-full text-[9px] inline-block font-black uppercase ${rating.bg} ${rating.color} border ${rating.border}`}>{rating.desc}</p>
                                </div>
                            </div>
                        </div>
                        
                        {/* KPI Grid */}
                        <div className="xl:col-span-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                            {[
                                { label: 'Tỷ suất LNG/DT', value: kpi_lng_dt, suffix: '%', icon: 'trending_up', color: 'emerald', desc: 'Mali/Doanh thu' },
                                { label: 'Tỷ suất SL & CP', value: kpi_sl_cp, suffix: '%', icon: 'balance', color: 'blue', desc: '(SL-CP)/SL' },
                                { label: 'Chỉ số SPI', value: kpi_spi, suffix: '', icon: 'speed', color: kpi_spi >= 1 ? 'green' : 'rose', desc: 'Tiến độ C.việc' },
                                { label: 'C.đổi ĐT-SL', value: kpi_dt_sl, suffix: '%', icon: 'account_balance_wallet', color: 'amber', desc: 'Thu/Sản lượng' },
                                { label: 'C.đổi Thu-DT', value: kpi_thu_dt, suffix: '%', icon: 'currency_exchange', color: 'indigo', desc: 'Thu/Tổng HĐ' },
                                { label: 'Cân đối Thu-Chi', value: kpi_thu_chi, suffix: 'x', icon: 'compare_arrows', color: kpi_thu_chi >= 1 ? 'emerald' : 'orange', desc: 'Thu/Chi thực' },
                            ].map((k, i) => (
                                <div key={i} className="glass-panel p-3 shadow-sm border border-slate-200/60 hover:shadow-md transition-all group bg-white flex flex-col justify-center min-h-[85px]">
                                    <div className="flex items-center gap-1.5 mb-1.5">
                                        <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 bg-${k.color}-50 text-${k.color}-600 group-hover:scale-110 transition-transform`}>
                                            <span className="material-symbols-outlined notranslate text-[13px]" translate="no">{k.icon}</span>
                                        </div>
                                        <h4 className="text-[8px] font-black text-slate-500 uppercase tracking-tighter truncate">{k.label}</h4>
                                    </div>
                                    <div className="flex items-baseline gap-0.5 mt-0.5">
                                        <span className={`text-sm font-black text-${k.color}-600 tracking-tighter`}>{k.value.toFixed(k.suffix === 'x' ? 2 : 1)}</span>
                                        <span className="text-[8px] font-bold text-slate-400">{k.suffix}</span>
                                    </div>
                                    <p className="text-[7.5px] text-slate-400 mt-1 truncate w-full italic leading-tight">{k.desc}</p>
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
                                
                                <div className="overflow-x-auto mt-2 pb-2">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="border-b border-slate-100 text-[9px] text-slate-400 uppercase font-black bg-slate-50/50">
                                                <th className="py-2.5 px-3">Hóa đơn / Đợt</th>
                                                <th className="py-2.5 px-3">Ngày xuất HĐ</th>
                                                <th className="py-2.5 px-3 text-right">Giá trị xuất HĐ</th>
                                                <th className="py-2.5 px-3 text-right">Giá trị Đề nghị</th>
                                                <th className="py-2.5 px-3 text-right">Thực thu</th>
                                                <th className="py-2.5 px-3 text-right">Còn lại</th>
                                                <th className="py-2.5 px-3 text-right">Trạng thái</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50 text-[11px] font-medium text-slate-600">
                                            {payments.map((p, i) => {
                                                const invoiceAmt = Number(p.invoice_amount || 0);
                                                const requestAmt = Number(p.payment_request_amount || 0);
                                                const actualAmt = Number(p.external_income || 0);
                                                const debt = Math.max(0, requestAmt - actualAmt);
                                                const isPaid = actualAmt >= requestAmt && requestAmt > 0;
                                                
                                                return (
                                                    <React.Fragment key={p.id}>
                                                        <tr 
                                                            className={`hover:bg-blue-50/30 transition-colors cursor-pointer border-l-4 ${expandedId === p.id ? 'border-blue-500 bg-blue-50/20' : 'border-transparent'}`}
                                                            onClick={() => toggleExpansion(p)}
                                                        >
                                                            <td className="py-3 px-3">
                                                                <div className="font-bold text-slate-700">{p.stage_name}</div>
                                                            </td>
                                                            <td className="py-3 px-3">
                                                                <div className="text-[10px] font-bold text-slate-600 flex items-center gap-1.5 whitespace-nowrap">
                                                                    <span className="material-symbols-outlined notranslate text-[14px] text-slate-400" translate="no">calendar_month</span>
                                                                    {p.invoice_date ? new Date(p.invoice_date).toLocaleDateString('vi-VN') : '---'}
                                                                </div>
                                                            </td>
                                                            <td className="py-3 px-3 text-right text-slate-500 font-bold tabular-nums">{fmt(invoiceAmt)}</td>
                                                            <td className="py-3 px-3 text-right text-slate-700 font-bold tabular-nums">{fmt(requestAmt)}</td>
                                                            <td className="py-3 px-3 text-right text-green-600 font-bold tabular-nums">{fmt(actualAmt)}</td>
                                                            <td className="py-3 px-3 text-right tabular-nums">
                                                                <span className={debt > 0 ? 'text-rose-600 font-black' : 'text-slate-400'}>{fmt(debt)}</span>
                                                            </td>
                                                            <td className="py-3 px-3 text-right">
                                                                <div className="flex items-center justify-end gap-2">
                                                                    <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${isPaid ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>
                                                                        {isPaid ? 'Đã thu' : 'Chờ thu'}
                                                                    </span>
                                                                    <span className={`material-symbols-outlined notranslate text-[16px] transition-transform duration-300 ${expandedId === p.id ? 'rotate-180 text-blue-600' : 'text-slate-300'}`} translate="no">
                                                                        expand_more
                                                                    </span>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                        <PaymentHistoryRow 
                                                            expandedId={expandedId} 
                                                            item={{ ...p, projects: project }} 
                                                            historyLoading={historyLoading} 
                                                            paymentHistory={paymentHistoryCurrent} 
                                                            generateHistory={() => {}} 
                                                        />
                                                    </React.Fragment>
                                                );
                                            })}
                                            {payments.length === 0 && (
                                                <tr>
                                                    <td colSpan="7" className="py-10 text-center opacity-50 italic">Chưa xuất hóa đơn / Chưa tạo đợt thu</td>
                                                </tr>
                                            )}
                                        </tbody>
                                        {payments.length > 0 && (
                                            <tfoot>
                                                <tr className="border-t border-slate-200 bg-slate-50/50 text-[11px] font-black text-slate-700">
                                                    <td className="py-3 px-3 uppercase text-[10px]" colSpan="2">Tổng cộng</td>
                                                    <td className="py-3 px-3 text-right tabular-nums text-slate-500">{fmt(payments.reduce((s, p) => s + Number(p.invoice_amount || 0), 0))}</td>
                                                    <td className="py-3 px-3 text-right tabular-nums">{fmt(payments.reduce((s, p) => s + Number(p.payment_request_amount || 0), 0))}</td>
                                                    <td className="py-3 px-3 text-right text-green-600 tabular-nums">{fmt(payments.reduce((s, p) => s + Number(p.external_income || 0), 0))}</td>
                                                    <td className="py-3 px-3 text-right tabular-nums text-rose-600">
                                                        {fmt(payments.reduce((s, p) => s + Math.max(0, Number(p.payment_request_amount || 0) - Number(p.external_income || 0)), 0))}
                                                    </td>
                                                    <td></td>
                                                </tr>
                                            </tfoot>
                                        )}
                                    </table>
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
            {/* ── Tab: Tài liệu ── */}
            {activeTab === 'doc' && (
                <ContractDriveTab project={project} subfolders={subfolders} selectedSubfolder={selectedSubfolder} onSelectSubfolder={setSelectedSubfolder} onOpenFullscreen={onOpenFullscreen} />
            )}
        </div>
    );
}
