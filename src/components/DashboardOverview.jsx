import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { CashFlowChart, PortfolioChart, ReceivablesAgingChart, TopProfitChart } from './DashboardCharts';

const formatVND = (v) => v ? Number(Math.round(v)).toLocaleString('vi-VN') : '0';

export default function DashboardOverview() {
    const { data: dashboardData, isLoading: loading } = useQuery({
        queryKey: ['dashboard-overview-data'],
        staleTime: 1000 * 60 * 5, // 5 minutes cache
        queryFn: async () => {
            // 1. Basic Counts
            const { count: projCount } = await supabase.from('projects').select('*', { count: 'exact', head: true });
            const { count: pendingCount } = await supabase.from('payments').select('*', { count: 'exact', head: true }).eq('status', 'Chờ duyệt');
            const { count: approvedCount } = await supabase.from('payments').select('*', { count: 'exact', head: true }).eq('status', 'Đã duyệt');
            
            const stats = {
                totalProjects: projCount || 0,
                pendingPayments: pendingCount || 0,
                approvedPayments: approvedCount || 0
            };

            // 2. Performance & Financial Metrics
            const { data: projs } = await supabase.from('projects').select('*');
            const { data: pmts } = await supabase.from('payments').select('*');
            const { data: adds } = await supabase.from('addendas').select('*').eq('status', 'Đã duyệt');
            const { data: extHist } = await supabase.from('external_payment_history').select('*');
            const { data: intHist } = await supabase.from('internal_payment_history').select('*');
            
            let financials = { totalValueAll: 0, totalIncomeAll: 0, totalDebtInvoiceAll: 0, totalRequestedAll: 0, totalInvoiceAll: 0, recoveryRate: 0 };
            let performance = { avg_lng_dt: 0, avg_sl_cp: 0, avg_spi: 1, avg_dt_sl: 0, avg_thu_dt: 0, avg_thu_chi: 0 };
            let chartData = { trend: { labels: [], values: [] }, portfolio: { labels: [], values: [] }, aging: { labels: [], invoiceValues: [], incomeValues: [] }, topProfit: { labels: [], values: [] } };

            if (projs && projs.length > 0) {
                const processed = projs.map(p => {
                    const projPmts = (pmts || []).filter(pm => pm.project_id === p.id);
                    const projExtHist = (extHist || []).filter(h => h.project_id === p.id);
                    const projIntHist = (intHist || []).filter(h => h.project_id === p.id);

                    const totalValuePreVat = parseFloat(p.original_value) || 0;
                    const vatAmount = p.vat_amount || (totalValuePreVat * (p.vat_percentage ?? 8) / 100);
                    const totalValuePostVat = p.total_value_post_vat || (totalValuePreVat + vatAmount);

                    const totalIncomeFromHistory = projExtHist.reduce((sum, h) => sum + (parseFloat(h.amount) || 0), 0);
                    const totalIncomeFromPayments = projPmts.reduce((sum, pm) => sum + (parseFloat(pm.external_income) || 0), 0);
                    const totalIncome = totalIncomeFromHistory > 0 ? totalIncomeFromHistory : totalIncomeFromPayments;

                    const totalInvoice = projPmts.reduce((sum, pay) => sum + (parseFloat(pay.invoice_amount) || 0), 0);
                    const totalRequested = projPmts.reduce((sum, pay) => sum + (parseFloat(pay.payment_request_amount) || 0), 0);
                    
                    const satecoInternalRevenue = parseFloat(p.sateco_internal_revenue) || (totalValuePostVat * (parseFloat(p.sateco_contract_ratio || 98) / 100));
                    const totalExpensesSateco = projIntHist.reduce((sum, h) => sum + (parseFloat(h.amount_spent) || 0), 0);
                    
                    const profit = (totalIncome * (parseFloat(p.sateco_actual_ratio || 95.5) / 100)) - totalExpensesSateco;

                    return { ...p, totalIncome, totalInvoice, totalRequested, totalValuePostVat, satecoInternalRevenue, totalExpensesSateco, profit };
                });

                // Aggregate Financials
                const totalValueAll = processed.reduce((s, p) => s + (p.totalValuePostVat || 0), 0);
                const totalIncomeAll = processed.reduce((s, p) => s + (p.totalIncome || 0), 0);
                const totalInvoiceAll = processed.reduce((s, p) => s + (p.totalInvoice || 0), 0);
                const totalRequestedAll = processed.reduce((s, p) => s + (p.totalRequested || 0), 0);
                const totalDebtInvoiceAll = totalInvoiceAll - totalIncomeAll;
                const recoveryRate = totalValueAll > 0 ? (totalIncomeAll / totalValueAll) * 100 : 0;

                financials = { totalValueAll, totalIncomeAll, totalDebtInvoiceAll, totalRequestedAll, totalInvoiceAll, recoveryRate };

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

            return { stats, financials, chartData, performance };
        }
    });

    const { stats, financials, chartData, performance } = dashboardData || {
        stats: { totalProjects: 0, pendingPayments: 0, approvedPayments: 0 },
        financials: { totalValueAll: 0, totalIncomeAll: 0, totalDebtInvoiceAll: 0, totalRequestedAll: 0, totalInvoiceAll: 0, recoveryRate: 0 },
        performance: { avg_lng_dt: 0, avg_sl_cp: 0, avg_spi: 1, avg_dt_sl: 0, avg_thu_dt: 0, avg_thu_chi: 0 },
        chartData: { trend: { labels: [], values: [] }, portfolio: { labels: [], values: [] }, aging: { labels: [], invoiceValues: [], incomeValues: [] }, topProfit: { labels: [], values: [] } }
    };

    const formatBillion = (val) => {
        if (!val) return '0';
        return (val / 1000000000).toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-4 md:space-y-8 animate-fade-in">
            {/* Top Row: Financial KPIs (Moved from Contracts) */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 md:gap-4">
                {[
                    { label: 'TỔNG GIÁ TRỊ HĐ', subLabel: '(SAU VAT, GỒM PHÁT SINH)', value: financials.totalValueAll, icon: 'payments', color: 'blue' },
                    { label: 'THỰC THU (CASH-IN)', value: financials.totalIncomeAll, icon: 'account_balance_wallet', color: 'emerald' },
                    { label: 'CÔNG NỢ HÓA ĐƠN', subLabel: '(ĐÃ XUẤT HĐ - THỰC THU)', value: financials.totalDebtInvoiceAll, icon: 'assignment_turned_in', color: 'rose' },
                    { label: 'CÔNG NỢ ĐỀ NGHỊ', subLabel: '(ĐỀ NGHỊ - THỰC THU)', value: financials.totalRequestedAll - financials.totalIncomeAll, icon: 'pending_actions', color: 'amber' },
                    { label: 'TỔNG XUẤT HÓA ĐƠN', value: financials.totalInvoiceAll, icon: 'description', color: 'slate' },
                    { label: 'TỶ LỆ THU HỒI DÒNG TIỀN', value: financials.recoveryRate, icon: 'analytics', color: 'indigo', isPercent: true }
                ].map((kpi, idx) => (
                    <div key={idx} className="bg-white rounded-2xl md:rounded-[20px] p-3 md:p-4 shadow-sm border border-slate-200/60 relative overflow-hidden group hover:shadow-md transition-all">
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

            {/* Middle Row: Basic Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 md:p-6 flex flex-col justify-between hover:shadow-md transition-all group">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-[9px] md:text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1 group-hover:text-blue-500 transition-colors">Tổng Số Dự Án</p>
                            <h3 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">{stats.totalProjects}</h3>
                        </div>
                        <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shadow-inner group-hover:scale-110 group-hover:rotate-3 transition-transform">
                            <span className="material-symbols-outlined text-[24px] md:text-[28px]">business</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 md:p-6 flex flex-col justify-between hover:shadow-md transition-all group">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-[9px] md:text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1 group-hover:text-orange-500 transition-colors">Chờ Duyệt</p>
                            <h3 className="text-2xl md:text-3xl font-black text-orange-600 tracking-tight">{stats.pendingPayments}</h3>
                        </div>
                        <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600 shadow-inner group-hover:scale-110 group-hover:-rotate-3 transition-transform">
                            <span className="material-symbols-outlined text-[24px] md:text-[28px]">pending_actions</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 md:p-6 flex flex-col justify-between hover:shadow-md transition-all group">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-[9px] md:text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1 group-hover:text-emerald-500 transition-colors">Đã Duyệt</p>
                            <h3 className="text-2xl md:text-3xl font-black text-emerald-600 tracking-tight">{stats.approvedPayments}</h3>
                        </div>
                        <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shadow-inner group-hover:scale-110 group-hover:rotate-3 transition-transform">
                            <span className="material-symbols-outlined text-[24px] md:text-[28px]">task_alt</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 md:p-6 flex flex-col justify-between hover:shadow-md transition-all group relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50/50 rounded-full blur-3xl -mr-12 -mt-12"></div>
                    <div className="flex justify-between items-start relative z-10">
                        <div>
                            <p className="text-[9px] md:text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">Sức Khoẻ</p>
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
        </div>
    );
}
