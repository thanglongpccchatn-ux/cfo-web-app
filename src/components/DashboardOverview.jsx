import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { CashFlowChart, PortfolioChart, ReceivablesAgingChart, TopProfitChart } from './DashboardCharts';
import AIFinanceInsights from './AIFinanceInsights';
import LiquidityGauge from './LiquidityGauge';
import SkeletonLoader from './common/SkeletonLoader';

const formatVND = (v) => v ? Number(Math.round(v)).toLocaleString('vi-VN') : '0';

const DashboardOverview = () => {
    const { data: dashboardData, refetch: refetchDashboard, isLoading: loading } = useQuery({
        queryKey: ['dashboard-overview-data'],
        staleTime: 1000 * 60 * 5, // 5 minutes cache
        queryFn: async () => {
            const currentYear = new Date().getFullYear();

            // All queries run in parallel for maximum speed
            const [planRes, projRes, pmtRes, , extHistRes, intHistRes, loansRes] = await Promise.all([
                supabase.from('revenue_plan').select('*').eq('year', currentYear),
                supabase.from('projects').select('*, partners!projects_partner_id_fkey(name, code, short_name)'),
                supabase.from('payments').select('*, projects!inner(code, internal_code, name)'),
                supabase.from('addendas').select('*').eq('status', 'Đã duyệt'),
                supabase.from('external_payment_history').select('*'),
                supabase.from('internal_payment_history').select('*'),
                supabase.from('loans').select('loan_amount, total_paid, status')
            ]);

            const planData = planRes.data?.[0] || { target_revenue: 0, year: currentYear };
            const projs = projRes.data;
            const pmts = pmtRes.data;
            const extHist = extHistRes.data;
            const intHist = intHistRes.data;
            const loansData = loansRes.data || [];

            // Calculate Total Debt from Loans
            const activeLoans = loansData.filter(l => l.status === 'active' || l.status === 'partially_paid' || l.status === 'overdue');
            const totalDebtAll = activeLoans.reduce((s, l) => s + (Number(l.loan_amount) - Number(l.total_paid || 0)), 0);

            // 1. Basic Counts & Lists (from fetched data to avoid extra requests)
            const projCount = projs?.length || 0;
            const unsignedProjects = (projs || []).filter(p => p.signature_status !== 'Đã ký');
            const unsettledProjects = (projs || []).filter(p => p.status === 'Đã hoàn thành' && p.settlement_status !== 'Đã quyết toán');
            const pendingPaymentsList = (pmts || []).filter(p => p.status === 'Chờ duyệt');
            const approvedCount = (pmts || []).filter(p => p.status === 'Đã duyệt').length;
            
            const stats = {
                totalProjects: projCount,
                unsignedContracts: unsignedProjects.length,
                unsettledContracts: unsettledProjects.length,
                pendingPayments: pendingPaymentsList.length,
                approvedPayments: approvedCount
            };
            
            let financials = { totalValueAll: 0, totalIncomeAll: 0, totalDebtInvoiceAll: 0, totalRequestedAll: 0, totalInvoiceAll: 0, recoveryRate: 0 };
            let performance = { avg_lng_dt: 0, avg_sl_cp: 0, avg_spi: 1, avg_dt_sl: 0, avg_thu_dt: 0, avg_thu_chi: 0 };
            let chartData = { trend: { labels: [], values: [] }, portfolio: { labels: [], values: [] }, aging: { labels: [], invoiceValues: [], incomeValues: [] }, topProfit: { labels: [], values: [] } };
            let processed = [];

            if (projs && projs.length > 0) {
                processed = projs.map(p => {
                    const projPmts = (pmts || []).filter(pm => pm.project_id === p.id);
                    const projExtHist = (extHist || []).filter(h => h.project_id === p.id);
                    const projIntHist = (intHist || []).filter(h => h.project_id === p.id);

                    const baseTotalValuePreVat = parseFloat(p.original_value) || 0;
                    const baseVatAmount = p.vat_amount || (baseTotalValuePreVat * (p.vat_percentage ?? 8) / 100);
                    const baseTotalValuePostVat = p.total_value_post_vat || (baseTotalValuePreVat + baseVatAmount);

                    const approvedVariationsPreVat = parseFloat(p.total_approved_variations) || 0;

                    const totalValuePostVat = baseTotalValuePostVat + approvedVariationsPreVat * (1 + (p.vat_percentage ?? 8) / 100);

                    const totalIncomeFromHistory = projExtHist.reduce((sum, h) => sum + (parseFloat(h.amount) || 0), 0);
                    const totalIncomeFromPayments = projPmts.reduce((sum, pm) => sum + (parseFloat(pm.external_income) || 0), 0);
                    const totalIncome = totalIncomeFromHistory > 0 ? totalIncomeFromHistory : totalIncomeFromPayments;

                    const totalInvoice = projPmts.reduce((sum, pay) => sum + (parseFloat(pay.invoice_amount) || 0), 0);
                    const totalRequested = projPmts.reduce((sum, pay) => sum + (parseFloat(pay.payment_request_amount) || 0), 0);
                    
                    const debtInvoice = totalInvoice - totalIncome;
                    const debtRequested = totalRequested - totalIncome;
                    
                    const satecoInternalRevenue = parseFloat(p.sateco_internal_revenue) || (totalValuePostVat * (parseFloat(p.sateco_contract_ratio || 98) / 100));
                    const totalExpensesSateco = projIntHist.reduce((sum, h) => sum + (parseFloat(h.amount_spent) || 0), 0);
                    
                    const profit = (totalIncome * (parseFloat(p.sateco_actual_ratio || 95.5) / 100)) - totalExpensesSateco;

                    return { ...p, totalIncome, totalInvoice, totalRequested, debtInvoice, debtRequested, totalValuePostVat, satecoInternalRevenue, totalExpensesSateco, profit, projPmts };
                });

                // Aggregate Financials
                const totalValueAll = processed.reduce((s, p) => s + (p.totalValuePostVat || 0), 0);
                const totalIncomeAll = processed.reduce((s, p) => s + (p.totalIncome || 0), 0);
                const totalInvoiceAll = processed.reduce((s, p) => s + (p.totalInvoice || 0), 0);
                const totalRequestedAll = processed.reduce((s, p) => s + (p.totalRequested || 0), 0);
                const totalDebtInvoiceAll = totalInvoiceAll - totalIncomeAll;
                const recoveryRate = totalValueAll > 0 ? (totalIncomeAll / totalValueAll) * 100 : 0;

                // ADD: Calculate income for the current year based on due_date (to match DocumentTrackingModule)
                const targetYear = planData?.year || new Date().getFullYear();
                const totalIncomeThisYear = (pmts || [])
                    .filter(pm => pm.due_date && new Date(pm.due_date).getFullYear() === targetYear)
                    .reduce((sum, pm) => sum + (parseFloat(pm.external_income) || 0), 0);

                financials = { totalValueAll, totalIncomeAll, totalDebtInvoiceAll, totalRequestedAll, totalInvoiceAll, recoveryRate, totalIncomeThisYear, totalDebtAll };

                // 3. Chart Data Processing
                // Trend Chart (Last 6 Months Income)
                const monthlyIncome = {};
                (extHist || []).forEach(h => {
                    const date = new Date(h.payment_date);
                    const key = `Tháng ${date.getMonth() + 1}/${date.getFullYear().toString().slice(-2)}`;
                    monthlyIncome[key] = (monthlyIncome[key] || 0) + (parseFloat(h.amount) || 0);
                });
                const trendLabels = Object.keys(monthlyIncome).sort().slice(-6);
                const trendValues = trendLabels.map(l => monthlyIncome[l]);

                // Portfolio Chart (Value by Status)
                const statusGroups = {};
                processed.forEach(p => {
                    statusGroups[p.status || 'Khác'] = (statusGroups[p.status || 'Khác'] || 0) + (p.totalValuePostVat || 0);
                });
                
                // Aging Chart (Monthly Invoice vs Income)
                const monthlyInvoice = {};
                const monthlyRec = {};
                (pmts || []).forEach(pm => {
                    const date = new Date(pm.created_at);
                    const key = `${date.getMonth() + 1}/${date.getFullYear().toString().slice(-2)}`;
                    monthlyInvoice[key] = (monthlyInvoice[key] || 0) + (parseFloat(pm.invoice_amount) || 0);
                    monthlyRec[key] = (monthlyRec[key] || 0) + (parseFloat(pm.external_income) || 0);
                });
                const agingLabels = Object.keys(monthlyInvoice).sort().slice(-6);
                
                // Top Profit
                const top5Profit = [...processed].sort((a,b) => b.profit - a.profit).slice(0, 5);

                chartData = {
                    trend: { labels: trendLabels, values: trendValues },
                    portfolio: { labels: Object.keys(statusGroups), values: Object.values(statusGroups) },
                    aging: { 
                        labels: agingLabels, 
                        invoiceValues: agingLabels.map(l => monthlyInvoice[l] || 0), 
                        incomeValues: agingLabels.map(l => monthlyRec[l] || 0) 
                    },
                    topProfit: { 
                        labels: top5Profit.map(p => p.code || p.name || 'N/A').map(s => String(s).length > 15 ? String(s).slice(0,12)+'...' : s), 
                        values: top5Profit.map(p => p.profit) 
                    }
                };

                // Aggregate Performance
                const projectsWithData = processed.filter(p => (parseFloat(p.totalValuePostVat) || 0) > 0);
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

                performance = { avg_lng_dt, avg_sl_cp, avg_spi, avg_dt_sl, avg_thu_dt, avg_thu_chi };
            }

            return { planData, stats, financials, chartData, performance, projectDetails: processed, unsignedProjects, unsettledProjects, pendingPaymentsList };
        }
    });

    const { planData, stats, financials, chartData, performance, projectDetails, unsignedProjects, unsettledProjects, pendingPaymentsList } = dashboardData || {
        planData: { target_revenue: 0, year: new Date().getFullYear() },
        stats: { totalProjects: 0, pendingPayments: 0, approvedPayments: 0, unsignedContracts: 0, unsettledContracts: 0 },
        financials: { totalValueAll: 0, totalIncomeAll: 0, totalDebtInvoiceAll: 0, totalRequestedAll: 0, totalInvoiceAll: 0, recoveryRate: 0, totalIncomeThisYear: 0, totalDebtAll: 0 },
        performance: { avg_lng_dt: 0, avg_sl_cp: 0, avg_spi: 1, avg_dt_sl: 0, avg_thu_dt: 0, avg_thu_chi: 0 },
        chartData: { trend: { labels: [], values: [] }, portfolio: { labels: [], values: [] }, aging: { labels: [], invoiceValues: [], incomeValues: [] }, topProfit: { labels: [], values: [] } },
        projectDetails: [], unsignedProjects: [], unsettledProjects: [], pendingPaymentsList: []
    };

    const [targetModal, setTargetModal] = useState({ isOpen: false, target: 0, isSaving: false });

    // Revenue Plan Calculations
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const elapsedRatio = (currentMonth - 1) / 12; // e.g March -> 2/12 = 16.7%
    const targetRevenue = parseFloat(planData?.target_revenue) || 0;
    const achievedRevenue = financials?.totalIncomeThisYear || 0;
    const remainingRevenue = Math.max(0, targetRevenue - achievedRevenue);
    
    let completionPercent = 0;
    if (targetRevenue > 0) {
        completionPercent = (achievedRevenue / targetRevenue) * 100;
    }

    const gap = elapsedRatio - (completionPercent / 100);
    
    let evalStatus = { color: 'slate', text: 'Chưa khả dụng', icon: 'help_outline' };
    if (targetRevenue > 0) {
        if (completionPercent >= 90) evalStatus = { color: 'violet', text: 'Xuất Sắc', icon: 'award_star' };
        else if (gap <= 0) evalStatus = { color: 'emerald', text: 'Đúng Tiến Độ', icon: 'check_circle' };
        else if (gap <= 0.1) evalStatus = { color: 'amber', text: 'Cần Đẩy Nhanh', icon: 'warning' };
        else evalStatus = { color: 'rose', text: 'Chậm Tiến Độ', icon: 'error' };
    } else {
        evalStatus = { color: 'slate', text: 'Chưa thiết lập mục tiêu', icon: 'info' };
    }

    const handleSaveTarget = async () => {
        try {
            setTargetModal(prev => ({ ...prev, isSaving: true }));
            const { error } = await supabase.from('revenue_plan').upsert(
                { year: currentYear, target_revenue: targetModal.target }, 
                { onConflict: 'year' }
            );
            if (error) throw error;
            setTargetModal({ isOpen: false, target: 0, isSaving: false });
            refetchDashboard();
        } catch (error) {
            console.error('Error saving target:', error);
            alert('Lỗi lưu mục tiêu: ' + error.message);
            setTargetModal(prev => ({ ...prev, isSaving: false }));
        }
    };


    const formatBillion = (val) => {
        if (!val) return '0';
        return (val / 1000000000).toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
    };

    const [detailModal, setDetailModal] = useState({ isOpen: false, type: null, data: [] });
    const [expandedProject, setExpandedProject] = useState(null);

    const handleOpenDetail = (type) => {
        let data = [];
        if (type === 'invoice' || type === 'requested') {
            if (!projectDetails || projectDetails.length === 0) return;
            data = projectDetails.filter(p => {
                const debt = type === 'invoice' ? p.debtInvoice : p.debtRequested;
                return debt > 0;
            }).sort((a,b) => (type === 'invoice' ? b.debtInvoice - a.debtInvoice : b.debtRequested - a.debtRequested));
        } else if (type === 'unsigned') {
            data = unsignedProjects || [];
        } else if (type === 'unsettled') {
            data = unsettledProjects || [];
        } else if (type === 'pending') {
            data = pendingPaymentsList || [];
        }

        setDetailModal({ isOpen: true, type, data });
        setExpandedProject(null);
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-4 md:space-y-8 animate-fade-in relative">
            {/* Target Modal */}
            {targetModal.isOpen && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b flex items-center justify-between bg-blue-50/50">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-xl">flag</span>
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-slate-800">Mục tiêu năm {currentYear}</h3>
                                    <p className="text-xs font-bold text-slate-500">Thiết lập doanh thu kỳ vọng</p>
                                </div>
                            </div>
                            <button onClick={() => setTargetModal({ isOpen: false, target: 0, isSaving: false })} className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 shadow-sm transition-all border border-slate-200">
                                <span className="material-symbols-outlined text-[18px]">close</span>
                            </button>
                        </div>
                        <div className="p-6">
                            <label className="text-sm font-black text-slate-700 block mb-2">Mục tiêu Thực thu (VNĐ)</label>
                            <input 
                                type="number" 
                                value={targetModal.target}
                                onChange={(e) => setTargetModal(prev => ({ ...prev, target: e.target.value }))}
                                className="w-full border-slate-200 rounded-xl px-4 py-3 font-bold text-lg focus:ring-blue-500 focus:border-transparent transition-all"
                                placeholder="Nhập số tiền..."
                                autoFocus
                            />
                            {targetModal.target > 0 && (
                                <p className="text-xs font-black text-blue-600 mt-2 bg-blue-50 p-2 rounded-lg inline-block">
                                    ~ {formatBillion(targetModal.target)} Tỷ VNĐ
                                </p>
                            )}
                        </div>
                        <div className="p-4 border-t bg-slate-50 flex justify-end gap-3">
                            <button onClick={() => setTargetModal({ isOpen: false, target: 0, isSaving: false })} className="px-5 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-200 transition-colors">
                                Hủy
                            </button>
                            <button onClick={handleSaveTarget} disabled={targetModal.isSaving} className="px-5 py-2.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2">
                                {targetModal.isSaving ? <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span> : <span className="material-symbols-outlined text-[18px]">save</span>}
                                Lưu mục tiêu
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Top Row: Revenue Plan */}
            <div className="bg-white rounded-[24px] md:rounded-[32px] p-4 md:p-6 shadow-sm border border-slate-200/60 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-slate-50/50 rounded-full blur-3xl -mr-20 -mt-20 z-0 pointer-events-none"></div>
                
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 md:mb-8 relative z-10">
                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-200/50 shrink-0 text-white">
                            <span className="material-symbols-outlined text-[28px] md:text-[32px]">query_stats</span>
                        </div>
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <h2 className="text-xl md:text-3xl font-black text-slate-800 tracking-tight">KẾ HOẠCH NĂM {currentYear}</h2>
                                <div className={`flex items-center gap-1.5 px-3 py-1 bg-${evalStatus.color}-50 border border-${evalStatus.color}-100 rounded-full`}>
                                    <span className={`material-symbols-outlined text-[14px] text-${evalStatus.color}-500`}>{evalStatus.icon}</span>
                                    <span className={`text-[10px] md:text-xs font-black uppercase tracking-widest text-${evalStatus.color}-600`}>{evalStatus.text}</span>
                                </div>
                            </div>
                            <p className="text-xs md:text-sm font-bold text-slate-400">Theo dõi tiến độ Thực thu (Cash-in) so với Mục tiêu đề ra</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => setTargetModal({ isOpen: true, target: targetRevenue, isSaving: false })}
                        className="self-start md:self-auto flex items-center gap-2 px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-blue-600 rounded-xl font-bold text-sm transition-colors border border-slate-200"
                    >
                        <span className="material-symbols-outlined text-[18px]">edit</span>
                        Thiết lập Mục tiêu
                    </button>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 relative z-10">
                    <div className="bg-slate-50 rounded-2xl p-4 md:p-5 border border-slate-100">
                        <p className="text-[10px] md:text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5">MỤC TIÊU NĂM</p>
                        <div className="flex items-baseline gap-1">
                            <h3 className="text-2xl md:text-4xl font-black text-slate-800 tracking-tighter">{formatBillion(targetRevenue)}</h3>
                            <span className="text-xs font-black text-slate-400">Tỷ</span>
                        </div>
                    </div>
                    
                    <div className="bg-emerald-50/50 rounded-2xl p-4 md:p-5 border border-emerald-100/50">
                        <p className="text-[10px] md:text-xs font-black text-emerald-600 uppercase tracking-widest mb-1.5">ĐÃ ĐẠT ĐƯỢC</p>
                        <div className="flex items-baseline gap-1">
                            <h3 className="text-2xl md:text-4xl font-black text-emerald-600 tracking-tighter">{formatBillion(achievedRevenue)}</h3>
                            <span className="text-xs font-black text-emerald-400">Tỷ</span>
                        </div>
                    </div>

                    <div className="bg-amber-50/50 rounded-2xl p-4 md:p-5 border border-amber-100/50">
                        <p className="text-[10px] md:text-xs font-black text-amber-600 uppercase tracking-widest mb-1.5">CÒN THIẾU</p>
                        <div className="flex items-baseline gap-1">
                            <h3 className="text-2xl md:text-4xl font-black text-amber-600 tracking-tighter">{targetRevenue > 0 ? formatBillion(remainingRevenue) : '0'}</h3>
                            <span className="text-xs font-black text-amber-400">Tỷ</span>
                        </div>
                    </div>

                    <div className="bg-blue-50/50 rounded-2xl p-4 md:p-5 border border-blue-100/50 flex flex-col justify-center">
                        <div className="flex items-end justify-between mb-2">
                            <p className="text-[10px] md:text-xs font-black text-blue-600 uppercase tracking-widest">% HOÀN THÀNH</p>
                            <span className="text-2xl md:text-3xl font-black text-blue-600 tracking-tighter leading-none">{targetRevenue > 0 ? completionPercent.toFixed(1) : '0'}%</span>
                        </div>
                        <div className="w-full h-3 md:h-4 bg-slate-200/60 rounded-full overflow-hidden shrink-0 shadow-inner">
                            <div 
                                className={`h-full rounded-full transition-all duration-1000 ease-out bg-gradient-to-r ${completionPercent > 100 ? 'from-emerald-400 to-emerald-500' : 'from-blue-400 to-indigo-500'} relative`}
                                style={{ width: `${Math.min(100, targetRevenue > 0 ? completionPercent : 0)}%` }}
                            >
                                <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.2)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.2)_50%,rgba(255,255,255,0.2)_75%,transparent_75%,transparent)] bg-[length:20px_20px] animate-[slide_2s_linear_infinite]"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Top Row: Financial KPIs (Moved from Contracts) */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-7 gap-3 md:gap-4">
                {[
                    { label: 'TỔNG GIÁ TRỊ HĐ', subLabel: '(SAU VAT, GỒM PHÁT SINH)', value: financials.totalValueAll, icon: 'payments', color: 'blue' },
                    { label: 'THỰC THU (CASH-IN)', value: financials.totalIncomeAll, icon: 'account_balance_wallet', color: 'emerald' },
                    { label: 'CÔNG NỢ HÓA ĐƠN', subLabel: '(ĐÃ XUẤT HĐ - THỰC THU)', value: financials.totalDebtInvoiceAll, icon: 'assignment_turned_in', color: 'rose', type: 'invoice' },
                    { label: 'CÔNG NỢ ĐỀ NGHỊ', subLabel: '(ĐỀ NGHỊ - THỰC THU)', value: financials.totalRequestedAll - financials.totalIncomeAll, icon: 'pending_actions', color: 'amber', type: 'requested' },
                    { label: 'TỔNG DƯ NỢ VAY', subLabel: '(CẬP NHẬT TỪ HỆ THỐNG)', value: financials.totalDebtAll || 0, icon: 'credit_card', color: 'rose', route: '/loans' },
                    { label: 'TỔNG XUẤT HÓA ĐƠN', value: financials.totalInvoiceAll, icon: 'description', color: 'slate' },
                    { label: 'TỶ LỆ THU HỒI DÒNG TIỀN', value: financials.recoveryRate, icon: 'analytics', color: 'indigo', isPercent: true }
                ].map((kpi, idx) => (
                    <div 
                        key={idx} 
                        onClick={() => {
                            if (kpi.route) window.location.href = kpi.route;
                            else if (kpi.type) handleOpenDetail(kpi.type);
                        }}
                        className={`bg-white rounded-2xl md:rounded-[20px] p-3 md:p-4 shadow-sm border border-slate-200/60 relative overflow-hidden group hover:shadow-md transition-all ${(kpi.type || kpi.route) ? 'cursor-pointer hover:ring-2 hover:border-transparent hover:-translate-y-1 ' + (kpi.color === 'rose' ? 'hover:ring-rose-400' : 'hover:ring-amber-400') : ''}`}
                    >
                        {kpi.type && (
                            <div className={`absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity ${kpi.color === 'rose' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>
                                <span className="material-symbols-outlined text-[12px]">open_in_new</span>
                            </div>
                        )}
                        <div className={`absolute -right-4 -top-4 w-20 h-20 bg-${kpi.color === 'slate' ? 'slate' : kpi.color}-50 rounded-full opacity-60 group-hover:scale-110 transition-transform`} />
                        <div className="relative flex flex-col h-full justify-between">
                            <div className="mb-2">
                                <p className="text-[8px] md:text-[9px] font-black text-slate-500 uppercase tracking-widest leading-tight">{kpi.label}</p>
                                {kpi.subLabel && (
                                    <p className="text-[7px] md:text-[8px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">{kpi.subLabel}</p>
                                )}
                            </div>
                            <div className="flex justify-between items-end">
                                <div className="flex items-baseline gap-0.5 md:gap-1">
                                    <h3 className={`text-lg md:text-xl font-black text-${kpi.color === 'slate' ? 'slate-700' : (kpi.color === 'rose' ? 'rose-600' : (kpi.color === 'emerald' ? 'emerald-600' : (kpi.color === 'amber' ? 'amber-600' : (kpi.color === 'blue' ? 'blue-600' : 'indigo-600'))))} tracking-tighter`}>
                                        {kpi.isPercent ? kpi.value.toFixed(1) : formatBillion(kpi.value)}
                                    </h3>
                                    <span className="text-[9px] md:text-[10px] font-black text-slate-400 capitalize">
                                        {kpi.isPercent ? '%' : 'Tỷ'}
                                    </span>
                                </div>
                                <div className={`w-7 h-7 md:w-8 md:h-8 rounded-lg bg-${kpi.color === 'slate' ? 'slate' : kpi.color}-50 text-${kpi.color === 'slate' ? 'slate' : kpi.color}-500 flex items-center justify-center shadow-inner shrink-0`}>
                                    <span className="material-symbols-outlined notranslate text-[16px] md:text-[18px]" translate="no">{kpi.icon}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Middle Row: Basic Stats & Warnings */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 md:gap-4 mb-4 md:mb-6">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 md:p-4 flex flex-col justify-between hover:shadow-md transition-all group">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 group-hover:text-blue-500 transition-colors">Tổng Số Hợp Đồng</p>
                            <h3 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight">{stats.totalProjects}</h3>
                        </div>
                        <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 shadow-inner group-hover:scale-110 group-hover:rotate-3 transition-transform shrink-0">
                            <span className="material-symbols-outlined text-[20px] md:text-[24px]">folder_copy</span>
                        </div>
                    </div>
                </div>

                <div 
                    onClick={() => handleOpenDetail('unsigned')}
                    className="bg-rose-50/30 rounded-xl shadow-sm border border-rose-100 p-3 md:p-4 flex flex-col justify-between hover:shadow-md transition-all group cursor-pointer hover:-translate-y-1 hover:ring-2 hover:ring-rose-200"
                >
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-[9px] md:text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1">Chưa Ký HĐ</p>
                            <div className="flex items-baseline gap-1.5">
                                <h3 className="text-xl md:text-2xl font-black text-rose-700 tracking-tight">{stats.unsignedContracts}</h3>
                                <span className="text-[9px] font-bold text-rose-400">Hợp đồng</span>
                            </div>
                        </div>
                        <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-rose-100 flex items-center justify-center text-rose-600 shadow-inner group-hover:scale-110 transition-transform shrink-0">
                            <span className="material-symbols-outlined text-[20px] md:text-[24px]">draw</span>
                        </div>
                    </div>
                </div>

                <div 
                    onClick={() => handleOpenDetail('unsettled')}
                    className="bg-amber-50/30 rounded-xl shadow-sm border border-amber-100 p-3 md:p-4 flex flex-col justify-between hover:shadow-md transition-all group cursor-pointer hover:-translate-y-1 hover:ring-2 hover:ring-amber-200"
                >
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-[9px] md:text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1" title="Đã hoàn thành thi công nhưng chưa quyết toán">Chưa Quyết Toán</p>
                            <div className="flex items-baseline gap-1.5">
                                <h3 className="text-xl md:text-2xl font-black text-amber-700 tracking-tight">{stats.unsettledContracts}</h3>
                                <span className="text-[9px] font-bold text-amber-500">Dự án H.Thành</span>
                            </div>
                        </div>
                        <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600 shadow-inner group-hover:scale-110 transition-transform shrink-0">
                            <span className="material-symbols-outlined text-[20px] md:text-[24px]">fact_check</span>
                        </div>
                    </div>
                </div>

                <div 
                    onClick={() => handleOpenDetail('pending')}
                    className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 md:p-4 flex flex-col justify-between hover:shadow-md transition-all group cursor-pointer hover:-translate-y-1 hover:ring-2 hover:ring-orange-200"
                >
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 group-hover:text-orange-500 transition-colors">Chờ Duyệt Chi</p>
                            <div className="flex items-baseline gap-1.5">
                                <h3 className="text-xl md:text-2xl font-black text-orange-600 tracking-tight">{stats.pendingPayments}</h3>
                            </div>
                        </div>
                        <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-orange-50 flex items-center justify-center text-orange-600 shadow-inner group-hover:scale-110 group-hover:-rotate-3 transition-transform shrink-0">
                            <span className="material-symbols-outlined text-[20px] md:text-[24px]">pending_actions</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 md:p-4 flex flex-col justify-between hover:shadow-md transition-all group">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 group-hover:text-emerald-500 transition-colors">Đã Duyệt</p>
                            <h3 className="text-2xl md:text-3xl font-black text-emerald-600 tracking-tight">{stats.approvedPayments}</h3>
                        </div>
                        <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shadow-inner group-hover:scale-110 group-hover:rotate-3 transition-transform">
                            <span className="material-symbols-outlined text-[24px] md:text-[28px]">task_alt</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 md:p-4 flex flex-col justify-between hover:shadow-md transition-all group relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50/50 rounded-full blur-3xl -mr-12 -mt-12"></div>
                    <div className="flex justify-between items-start relative z-10">
                        <div>
                            <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Sức Khoẻ</p>
                            <div className="flex items-center gap-1.5 mt-1">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                <h3 className="text-sm md:text-lg font-black text-emerald-600 uppercase tracking-tighter">Ổn Định</h3>
                            </div>
                        </div>
                        <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-inner group-hover:scale-110 transition-transform">
                            <span className="material-symbols-outlined text-[24px] md:text-[28px]">health_and_safety</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Actions (Mobile-First) */}
            <div className="md:hidden grid grid-cols-1 gap-4">
                <a href="/site_diary" className="bg-gradient-to-r from-blue-600 to-indigo-700 p-5 rounded-3xl shadow-lg shadow-blue-200 flex items-center justify-between text-white active:scale-95 transition-all">
                    <div className="flex items-center gap-4">
                        <div className="bg-white/20 p-3 rounded-2xl">
                            <span className="material-symbols-outlined text-3xl">edit_calendar</span>
                        </div>
                        <div>
                            <h4 className="font-black text-lg leading-tight tracking-tight">NHẬT KÝ HIỆN TRƯỜNG</h4>
                            <p className="text-blue-100 text-xs font-bold opacity-80 uppercase tracking-widest mt-0.5">3 cú chạm để báo cáo &rarr;</p>
                        </div>
                    </div>
                </a>
            </div>

            {/* AI Financial Insights Section */}
            <AIFinanceInsights 
                financials={financials} 
                performance={performance} 
                planData={planData} 
                dashboardData={dashboardData} 
            />

            {/* Strategic Analysis Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Chart 1: Cash Flow Trend */}
                <div className="bg-white rounded-[24px] md:rounded-[32px] p-4 md:p-6 shadow-sm border border-slate-200/60 overflow-hidden group">
                    <div className="flex items-center justify-between mb-4 md:mb-6">
                        <div className="flex items-center gap-2 md:gap-3">
                            <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                                <span className="material-symbols-outlined text-[18px] md:text-[20px]">trending_up</span>
                            </div>
                            <div>
                                <h4 className="text-[11px] md:text-sm font-black text-slate-800 uppercase tracking-tight">Xu hướng Thực thu</h4>
                                <p className="text-[8px] md:text-[10px] font-bold text-slate-400">Dòng tiền Cash-in 6 tháng</p>
                            </div>
                        </div>
                    </div>
                    <div className="h-[200px] md:h-[280px]">
                        <CashFlowChart data={chartData.trend} />
                    </div>
                </div>

                {/* Chart 2: Portfolio Distribution */}
                <div className="bg-white rounded-[24px] md:rounded-[32px] p-4 md:p-6 shadow-sm border border-slate-200/60 overflow-hidden group">
                    <div className="flex items-center justify-between mb-4 md:mb-6">
                        <div className="flex items-center gap-2 md:gap-3">
                            <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                <span className="material-symbols-outlined text-[18px] md:text-[20px]">pie_chart</span>
                            </div>
                            <div>
                                <h4 className="text-[11px] md:text-sm font-black text-slate-800 uppercase tracking-tight">Cơ cấu Giá trị</h4>
                                <p className="text-[8px] md:text-[10px] font-bold text-slate-400">Phân bổ theo trạng thái</p>
                            </div>
                        </div>
                    </div>
                    <div className="h-[200px] md:h-[280px]">
                        <PortfolioChart data={chartData.portfolio} />
                    </div>
                </div>

                {/* Chart 3: Receivables Aging */}
                <div className="bg-white rounded-[24px] md:rounded-[32px] p-4 md:p-6 shadow-sm border border-slate-200/60 overflow-hidden group">
                    <div className="flex items-center justify-between mb-4 md:mb-6">
                        <div className="flex items-center gap-2 md:gap-3">
                            <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                                <span className="material-symbols-outlined text-[18px] md:text-[20px]">fact_check</span>
                            </div>
                            <div>
                                <h4 className="text-[11px] md:text-sm font-black text-slate-800 uppercase tracking-tight">Hiệu quả Thu nợ</h4>
                                <p className="text-[8px] md:text-[10px] font-bold text-slate-400">Xuất HĐ vs Thực thu</p>
                            </div>
                        </div>
                    </div>
                    <div className="h-[200px] md:h-[280px]">
                        <ReceivablesAgingChart data={chartData.aging} />
                    </div>
                </div>

                {/* Chart 4: Top Profit Projects */}
                <div className="bg-white rounded-[24px] md:rounded-[32px] p-4 md:p-6 shadow-sm border border-slate-200/60 overflow-hidden group">
                    <div className="flex items-center justify-between mb-4 md:mb-6">
                        <div className="flex items-center gap-2 md:gap-3">
                            <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                                <span className="material-symbols-outlined text-[18px] md:text-[20px]">workspace_premium</span>
                            </div>
                            <div>
                                <h4 className="text-[11px] md:text-sm font-black text-slate-800 uppercase tracking-tight">Top Lợi nhuận</h4>
                                <p className="text-[8px] md:text-[10px] font-bold text-slate-400">5 dự án cao nhất</p>
                            </div>
                        </div>
                    </div>
                    <div className="h-[200px] md:h-[280px]">
                        <TopProfitChart data={chartData.topProfit} />
                    </div>
                </div>
            </div>

            {/* Performance Overview section */}
            <div className="bg-white/40 backdrop-blur-md rounded-[24px] md:rounded-[32px] p-4 md:p-8 border border-white/60 shadow-xl shadow-slate-200/50">
                <div className="flex items-center gap-3 md:gap-4 mb-5 md:mb-8">
                     <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200 shrink-0">
                        <span className="material-symbols-outlined text-[20px] md:text-[24px]">analytics</span>
                    </div>
                    <div>
                        <h3 className="text-base md:text-xl font-black text-slate-800 tracking-tight">Hiệu suất Hệ thống</h3>
                        <p className="text-[9px] md:text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5 line-clamp-1">Chỉ số tài chính và vận hành trung bình</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 md:gap-5">
                    {[
                        { label: 'LNG / Doanh thu', value: performance.avg_lng_dt, suffix: '%', icon: 'trending_up', color: 'emerald', note: 'Lợi nhuận gộp' },
                        { label: 'Sản lượng / Chi phí', value: performance.avg_sl_cp, suffix: '%', icon: 'balance', color: 'blue', note: 'Tỷ lệ thanh toán/CP' },
                        { label: 'Hệ số SPI (TB)', value: performance.avg_spi, suffix: '', icon: 'speed', color: 'amber', note: 'Hiệu quả tiến độ' },
                        { label: 'Thu tiền / Sản lượng', value: performance.avg_dt_sl, suffix: '%', icon: 'account_balance_wallet', color: 'indigo', note: 'Thu nợ/Hóa đơn' },
                        { label: 'Thu tiền / Doanh thu', value: performance.avg_thu_dt, suffix: '%', icon: 'payments', color: 'purple', note: 'Thực thu/Doanh thu' },
                        { label: 'Cân đối Thu / Chi', value: performance.avg_thu_chi, suffix: 'x', icon: 'compare_arrows', color: 'rose', note: 'Thu / Chi' },
                    ].map((k, i) => (
                        <div key={i} className="bg-white rounded-xl md:rounded-2xl p-3 md:p-5 border border-slate-100 shadow-sm hover:shadow-lg hover:border-indigo-100 transition-all group flex flex-col justify-between min-h-[120px] md:min-h-[160px]">
                            <div className="flex justify-between items-start mb-1 md:mb-2">
                                <div className={`w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-${k.color}-50 text-${k.color}-600 flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner shrink-0`}>
                                    <span className="material-symbols-outlined text-[18px] md:text-[22px]">{k.icon}</span>
                                </div>
                                <span className="text-[9px] md:text-[11px] font-black text-slate-200">#0{i+1}</span>
                            </div>
                            <div>
                                <p className="text-[8px] md:text-[11px] font-black text-slate-500 uppercase tracking-tighter mb-0.5 md:mb-1.5 leading-tight line-clamp-1">{k.label}</p>
                                <p className="hidden md:block text-[10.5px] font-bold text-slate-400 italic mb-2.5 leading-tight h-8 line-clamp-2">{k.note}</p>
                                <div className="flex items-baseline gap-0.5 md:gap-1">
                                    <span className={`text-lg md:text-2xl font-black text-${k.color}-700 tracking-tighter`}>
                                        {k.value.toFixed(k.suffix === 'x' || k.suffix === '' ? 2 : 1)}
                                    </span>
                                    <span className="text-[8px] md:text-[10px] font-black text-slate-400">{k.suffix}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Quick Actions / Link */}
            <div className="bg-slate-900 rounded-[32px] p-10 text-center relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_30%_50%,rgba(59,130,246,0.1),transparent)] transition-opacity opacity-50 group-hover:opacity-100"></div>
                <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-blue-600/10 rounded-full blur-3xl"></div>
                
                <h2 className="text-2xl font-black text-white mb-4 relative z-10 tracking-tight">Phân phân tài chính nâng cao</h2>
                <p className="text-slate-400 max-w-lg mx-auto mb-8 text-sm leading-relaxed relative z-10">
                    Sử dụng module <strong className="text-blue-400 italic">Kế hoạch & Báo cáo</strong> để xem phân tích chi tiết dòng tiền, dự báo lợi nhuận và biến động chi phí theo tháng.
                </p>
                
                <div className="flex justify-center gap-4 relative z-10">
                    <div className="flex items-center gap-3 px-6 py-3 bg-white/5 rounded-2xl border border-white/10 text-white font-bold text-xs hover:bg-white/10 transition-all cursor-default">
                        <span className="material-symbols-outlined text-[18px]">find_in_page</span>
                        Kế Hoạch & Báo Cáo &rarr; Báo cáo Tổng hợp
                    </div>
                </div>
            </div>

            {/* Detail Modal */}
            {detailModal.isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setDetailModal({ isOpen: false, type: null, data: [] })}>
                    <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200/60 relative animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className={`p-6 md:p-8 border-b flex items-center justify-between ${
                            detailModal.type === 'invoice' || detailModal.type === 'unsigned' ? 'bg-rose-50/80 border-rose-100' : 
                            detailModal.type === 'requested' || detailModal.type === 'unsettled' ? 'bg-amber-50/80 border-amber-100' :
                            'bg-orange-50/80 border-orange-100'
                        }`}>
                            <div className="flex items-center gap-4">
                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm ${
                                    detailModal.type === 'invoice' || detailModal.type === 'unsigned' ? 'bg-rose-100 text-rose-600 border border-rose-200/50' : 
                                    detailModal.type === 'requested' || detailModal.type === 'unsettled' ? 'bg-amber-100 text-amber-600 border border-amber-200/50' :
                                    'bg-orange-100 text-orange-600 border border-orange-200/50'
                                }`}>
                                    <span className="material-symbols-outlined text-[32px]">
                                        {detailModal.type === 'unsigned' ? 'draw' : 
                                         detailModal.type === 'unsettled' ? 'fact_check' :
                                         detailModal.type === 'pending' ? 'pending_actions' :
                                         detailModal.type === 'invoice' ? 'assignment_turned_in' : 'pending_actions'}
                                    </span>
                                </div>
                                <div>
                                    <h3 className={`text-xl md:text-2xl font-black tracking-tight ${
                                        detailModal.type === 'invoice' || detailModal.type === 'unsigned' ? 'text-rose-700' : 
                                        detailModal.type === 'requested' || detailModal.type === 'unsettled' ? 'text-amber-800' :
                                        'text-orange-800'
                                    }`}>
                                        {detailModal.type === 'unsigned' ? 'HĐ CHƯA KÝ' : 
                                         detailModal.type === 'unsettled' ? 'DA CHƯA QUYẾT TOÁN' :
                                         detailModal.type === 'pending' ? 'HỒ SƠ CHỜ DUYỆT' :
                                         detailModal.type === 'invoice' ? 'CHI TIẾT CÔNG NỢ HÓA ĐƠN' : 'CHI TIẾT CÔNG NỢ ĐỀ NGHỊ'}
                                    </h3>
                                    <p className="text-xs font-black text-slate-500 uppercase tracking-widest mt-1">
                                        {detailModal.type === 'unsigned' ? 'DANH SÁCH CÁC HỢP ĐỒNG CHƯA HOÀN TẤT KÝ KẾT' :
                                         detailModal.type === 'unsettled' ? 'DỰ ÁN ĐÃ HOÀN THÀNH NHƯNG CHƯA QUYẾT TOÁN XONG' :
                                         detailModal.type === 'pending' ? 'DỊNH SÁCH HỒ SƠ THANH TOÁN ĐANG CHỜ XÉT DUYỆT' :
                                         'CÁC DỰ ÁN ĐANG GHI NHẬN CÔNG NỢ > 0 ₫'}
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setDetailModal({ isOpen: false, type: null, data: [] })} className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 shadow-sm transition-all active:scale-95 border border-slate-200">
                                <span className="material-symbols-outlined text-[20px]">close</span>
                            </button>
                        </div>
                        
                        <div className="p-0 overflow-auto flex-1 bg-slate-50/30">
                            <table className="w-full text-left border-collapse table-fixed">
                                <colgroup>
                                    <col style={{width:'14%'}} />
                                    <col style={{width:'26%'}} />
                                    <col style={{width:'20%'}} />
                                    <col style={{width:'20%'}} />
                                    <col style={{width:'20%'}} />
                                </colgroup>
                                <thead className="bg-white sticky top-0 z-10 shadow-sm border-b border-slate-200">
                                    <tr className="text-[11px] font-black text-slate-500 uppercase tracking-widest">
                                        <th className="px-5 py-4">Mã {detailModal.type === 'pending' ? 'Hồ sơ' : 'Dự án'}</th>
                                        <th className="px-5 py-4">{detailModal.type === 'pending' ? 'Công việc / Dự án' : 'Tên Dự án'}</th>
                                        <th className="px-5 py-4 text-right">
                                            {detailModal.type === 'pending' ? 'Giá trị ĐNTT' : 
                                             detailModal.type === 'unsigned' || detailModal.type === 'unsettled' ? 'Giá trị TVH' :
                                             detailModal.type === 'invoice' ? 'Tổng Hóa Đơn' : 'Tổng Đề Nghị'}
                                        </th>
                                        <th className="px-5 py-4 text-right">Thực Thu</th>
                                        <th className="px-5 py-4 text-right text-rose-600 bg-rose-50/30">
                                            {detailModal.type === 'pending' || detailModal.type === 'invoice' || detailModal.type === 'requested' ? 'Công Nợ' : 'Giá trị gốc'}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {detailModal.data.map(p => {
                                        let val1 = 0, valThu = 0, valNo = 0;
                                        let code = '', name = '', sub = '';
                                        
                                        if (detailModal.type === 'pending') {
                                            code = p.payment_code;
                                            name = p.projects?.name || 'N/A';
                                            sub = p.stage_name;
                                            val1 = parseFloat(p.payment_request_amount) || 0;
                                            valThu = parseFloat(p.external_income) || 0;
                                            valNo = val1 - valThu;
                                        } else {
                                            code = p.internal_code || p.code;
                                            name = p.name;
                                            sub = p.partners?.short_name || p.partners?.name || 'N/A';
                                            
                                            if (detailModal.type === 'invoice' || detailModal.type === 'requested') {
                                                val1 = detailModal.type === 'invoice' ? p.totalInvoice : p.totalRequested;
                                                valThu = p.totalIncome;
                                                valNo = detailModal.type === 'invoice' ? p.debtInvoice : p.debtRequested;
                                            } else {
                                                // unsigned or unsettled
                                                val1 = p.total_value_post_vat || (parseFloat(p.original_value || 0) * 1.08);
                                                valThu = p.totalIncome || 0;
                                                valNo = val1; // Giá trị gốc của hợp đồng
                                            }
                                        }

                                        const isExpanded = expandedProject === (detailModal.type === 'pending' ? p.id : p.id) && (detailModal.type === 'invoice' || detailModal.type === 'requested');
                                        
                                        // Compute phases that actually have debt
                                        const pendingPhases = (detailModal.type === 'invoice' || detailModal.type === 'requested') ? 
                                            (p.projPmts || []).filter(pm => {
                                                const phaseReq = detailModal.type === 'invoice' ? (parseFloat(pm.invoice_amount)||0) : (parseFloat(pm.payment_request_amount)||0);
                                                const phaseInc = parseFloat(pm.external_income)||0;
                                                return phaseReq - phaseInc > 0;
                                            }) : [];

                                        return (
                                            <React.Fragment key={p.id}>
                                                <tr 
                                                    onClick={() => (detailModal.type === 'invoice' || detailModal.type === 'requested') && setExpandedProject(isExpanded ? null : p.id)}
                                                    className={`transition-colors group ${detailModal.type === 'invoice' || detailModal.type === 'requested' ? 'cursor-pointer' : ''} ${isExpanded ? 'bg-blue-50/40 relative z-0' : 'bg-white hover:bg-slate-50/80'}`}
                                                >
                                                    <td className="px-5 py-4">
                                                        <div className="flex items-center gap-2">
                                                            {(detailModal.type === 'invoice' || detailModal.type === 'requested') && (
                                                                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-transform ${isExpanded ? 'bg-blue-100 text-blue-600 rotate-180' : 'bg-slate-100 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500'}`}>
                                                                    <span className="material-symbols-outlined text-[16px]">expand_more</span>
                                                                </div>
                                                            )}
                                                            <span className="text-xs font-mono font-black text-slate-600 bg-slate-100 px-2 py-1 rounded-md border border-slate-200 truncate">{code}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        <p className="text-sm font-black text-slate-800 truncate" title={name}>{name}</p>
                                                        <p className="text-xs font-bold text-slate-400 mt-0.5 truncate" title={sub}>{sub}</p>
                                                    </td>
                                                    <td className="px-5 py-4 text-right text-sm font-black text-slate-700 tabular-nums whitespace-nowrap">
                                                        {formatVND(val1)}
                                                    </td>
                                                    <td className="px-5 py-4 text-right text-sm font-black text-emerald-600 tabular-nums whitespace-nowrap">
                                                        {formatVND(valThu)}
                                                    </td>
                                                    <td className={`px-5 py-4 text-right text-sm font-black tabular-nums whitespace-nowrap ${detailModal.type === 'unsigned' || detailModal.type === 'unsettled' ? 'text-slate-600' : 'text-rose-600 bg-rose-50/10'}`}>
                                                        {formatVND(valNo)}&nbsp;₫
                                                    </td>
                                                </tr>
                                                {isExpanded && (
                                                    <tr className="bg-slate-50/50 shadow-inner">
                                                        <td colSpan={5} className="p-0">
                                                            <div className="px-14 py-4 animate-in slide-in-from-top-2 duration-200 border-l-[3px] border-blue-400 ml-6 my-2 bg-white rounded-r-xl shadow-sm">
                                                                <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                                    <span className="material-symbols-outlined text-[16px]">format_list_bulleted</span>
                                                                    Chi tiết các đợt phát sinh công nợ
                                                                </h4>
                                                                {pendingPhases.length > 0 ? (
                                                                    <div className="space-y-2">
                                                                        {pendingPhases.map(pm => {
                                                                            const phaseReq = detailModal.type === 'invoice' ? (parseFloat(pm.invoice_amount)||0) : (parseFloat(pm.payment_request_amount)||0);
                                                                            const phaseInc = parseFloat(pm.external_income)||0;
                                                                            const phaseDebt = phaseReq - phaseInc;
                                                                            return (
                                                                                <div key={pm.id} className="flex justify-between items-center p-3 rounded-lg border border-slate-100 bg-slate-50/50 hover:bg-white transition-colors">
                                                                                    <div className="flex items-center gap-3">
                                                                                        <div className="w-2 h-2 rounded-full bg-rose-400"></div>
                                                                                        <div>
                                                                                            <p className="text-sm font-bold text-slate-700">{pm.stage_name}</p>
                                                                                            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 bg-white border border-slate-200 px-1.5 py-0.5 rounded mt-1 inline-block">{pm.stage_type || 'Đợt thanh toán'}</span>
                                                                                        </div>
                                                                                    </div>
                                                                                    <div className="flex items-center gap-8 text-right">
                                                                                        <div>
                                                                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Giá trị gốc</p>
                                                                                            <p className="text-sm font-black text-slate-600">{formatVND(phaseReq)}</p>
                                                                                        </div>
                                                                                        <div>
                                                                                            <p className="text-[10px] font-bold text-emerald-600/70 uppercase tracking-widest">Thực thu</p>
                                                                                            <p className="text-sm font-black text-emerald-600">{formatVND(phaseInc)}</p>
                                                                                        </div>
                                                                                        <div className="min-w-[150px] bg-white p-2 rounded-md border border-rose-100 shadow-[0_2px_8px_-4px_rgba(244,63,94,0.3)]">
                                                                                            <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest mb-0.5">Công nợ đợt này</p>
                                                                                            <p className="text-[15px] font-black text-rose-600 leading-none whitespace-nowrap">{formatVND(phaseDebt)}&nbsp;₫</p>
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                ) : (
                                                                    <div className="text-slate-500 text-sm font-medium italic p-4 bg-slate-50 rounded-lg">Không xác định được đợt thanh toán nào gây ra công nợ (có thể do sai lệch số liệu lịch sử thu tiền).</div>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                    {detailModal.data.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-16 text-center">
                                                <div className="w-20 h-20 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-300 mx-auto mb-4">
                                                    <span className="material-symbols-outlined text-4xl">done_all</span>
                                                </div>
                                                <p className="text-slate-600 font-bold text-lg">Thật tuyệt vời!</p>
                                                <p className="text-slate-400 text-sm mt-1">Không có dự án nào ghi nhận công nợ trên hệ thống.</p>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                                <tfoot className="bg-white sticky bottom-0 z-10 shadow-[0_-10px_40px_rgba(0,0,0,0.06)] border-t-2 border-slate-200">
                                    <tr>
                                        <td colSpan={2} className="px-5 py-5 text-xs font-black text-slate-400 uppercase tracking-widest">
                                            TỔNG CỘNG ({detailModal.data.length} DỰ ÁN)
                                        </td>
                                        <td className="px-5 py-5 text-right text-base font-black text-slate-800 tabular-nums whitespace-nowrap">
                                            {formatVND(detailModal.data.reduce((s, p) => s + (detailModal.type === 'invoice' ? p.totalInvoice : p.totalRequested), 0))}
                                        </td>
                                        <td className="px-5 py-5 text-right text-base font-black text-emerald-600 tabular-nums whitespace-nowrap">
                                            {formatVND(detailModal.data.reduce((s, p) => s + p.totalIncome, 0))}
                                        </td>
                                        <td className="px-5 py-5 text-right text-lg font-black text-rose-600 bg-rose-50/30 tabular-nums whitespace-nowrap">
                                            {formatVND(detailModal.data.reduce((s, p) => s + (detailModal.type === 'invoice' ? p.debtInvoice : p.debtRequested), 0))}&nbsp;₫
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DashboardOverview;
