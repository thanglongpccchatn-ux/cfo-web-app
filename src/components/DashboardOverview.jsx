import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const formatVND = (v) => v ? Number(Math.round(v)).toLocaleString('vi-VN') : '0';

export default function DashboardOverview() {
    const [stats, setStats] = useState({ 
        totalProjects: 0, 
        pendingPayments: 0, 
        approvedPayments: 0
    });
    const [performance, setPerformance] = useState({
        avg_lng_dt: 0,
        avg_sl_cp: 0,
        avg_spi: 1,
        avg_dt_sl: 0,
        avg_thu_dt: 0,
        avg_thu_chi: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            setLoading(true);
            try {
                // 1. Basic Counts
                const { count: projCount } = await supabase.from('projects').select('*', { count: 'exact', head: true });
                const { count: pendingCount } = await supabase.from('payments').select('*', { count: 'exact', head: true }).eq('status', 'Chờ duyệt');
                const { count: approvedCount } = await supabase.from('payments').select('*', { count: 'exact', head: true }).eq('status', 'Đã duyệt');
                
                setStats({
                    totalProjects: projCount || 0,
                    pendingPayments: pendingCount || 0,
                    approvedPayments: approvedCount || 0
                });

                // 2. Performance Metrics
                const { data: projects, error: projError } = await supabase
                    .from('projects')
                    .select('*, payments(*), external_payment_history(*), internal_payment_history(*)');
                
                if (projects && projects.length > 0) {
                    const processed = projects.map(p => {
                        const totalIncome = (p.external_payment_history || []).reduce((sum, h) => sum + (parseFloat(h.amount) || 0), 0);
                        const totalInvoice = (p.payments || []).reduce((sum, pay) => sum + (parseFloat(pay.payment_request_amount) || 0), 0);
                        const satecoInternalRevenue = parseFloat(p.sateco_internal_revenue) || (parseFloat(p.totalValuePostVat || 0) * (parseFloat(p.sateco_contract_ratio || 98) / 100));
                        const totalExpensesSateco = (p.internal_payment_history || []).reduce((sum, h) => sum + (parseFloat(h.amount_spent) || 0), 0);
                        
                        return { ...p, totalIncome, totalInvoice, satecoInternalRevenue, totalExpensesSateco };
                    });

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

                    setPerformance({ avg_lng_dt, avg_sl_cp, avg_spi, avg_dt_sl, avg_thu_dt, avg_thu_chi });
                }
            } catch (error) {
                console.error("Error fetching generic stats:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Top Row: Basic Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between hover:shadow-md transition-all group">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1 group-hover:text-blue-500 transition-colors">Tổng Số Dự Án</p>
                            <h3 className="text-3xl font-black text-slate-800 tracking-tight">{stats.totalProjects}</h3>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shadow-inner group-hover:scale-110 group-hover:rotate-3 transition-transform">
                            <span className="material-symbols-outlined text-[28px]">business</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between hover:shadow-md transition-all group">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1 group-hover:text-orange-500 transition-colors">Hồ Sơ Chờ Duyệt</p>
                            <h3 className="text-3xl font-black text-orange-600 tracking-tight">{stats.pendingPayments}</h3>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600 shadow-inner group-hover:scale-110 group-hover:-rotate-3 transition-transform">
                            <span className="material-symbols-outlined text-[28px]">pending_actions</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between hover:shadow-md transition-all group">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1 group-hover:text-emerald-500 transition-colors">Hồ Sơ Đã Duyệt</p>
                            <h3 className="text-3xl font-black text-emerald-600 tracking-tight">{stats.approvedPayments}</h3>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shadow-inner group-hover:scale-110 group-hover:rotate-3 transition-transform">
                            <span className="material-symbols-outlined text-[28px]">task_alt</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between hover:shadow-md transition-all group relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50/50 rounded-full blur-3xl -mr-12 -mt-12"></div>
                    <div className="flex justify-between items-start relative z-10">
                        <div>
                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">Sức Khoẻ Hệ Thống</p>
                            <div className="flex items-center gap-2 mt-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                <h3 className="text-lg font-black text-emerald-600 uppercase tracking-tighter">Ổn Định</h3>
                            </div>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-inner group-hover:scale-110 transition-transform">
                            <span className="material-symbols-outlined text-[28px]">health_and_safety</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Performance Overview section */}
            <div className="bg-white/40 backdrop-blur-md rounded-[32px] p-8 border border-white/60 shadow-xl shadow-slate-200/50">
                <div className="flex items-center gap-4 mb-8">
                     <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                        <span className="material-symbols-outlined text-[24px]">analytics</span>
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-slate-800 tracking-tight">Hiệu suất Toàn hệ thống</h3>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">Chỉ số tài chính và vận hành trung bình (Tất cả dự án)</p>
                    </div>
                    <div className="hidden lg:block h-px flex-1 bg-slate-200/60 ml-4 italic text-[10px] text-slate-300 text-right">Dữ liệu thời gian thực từ hệ thống báo cáo</div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-5">
                    {[
                        { label: 'LNG / Doanh thu', value: performance.avg_lng_dt, suffix: '%', icon: 'trending_up', color: 'emerald' },
                        { label: 'Sản lượng / Chi phí', value: performance.avg_sl_cp, suffix: '%', icon: 'balance', color: 'blue' },
                        { label: 'Hệ số SPI (TB)', value: performance.avg_spi, suffix: '', icon: 'speed', color: 'amber' },
                        { label: 'Thu tiền / Sản lượng', value: performance.avg_dt_sl, suffix: '%', icon: 'account_balance_wallet', color: 'indigo' },
                        { label: 'Thu tiền / Doanh thu', value: performance.avg_thu_dt, suffix: '%', icon: 'purple', color: 'purple' },
                        { label: 'Cân đối Thu / Chi', value: performance.avg_thu_chi, suffix: 'x', icon: 'compare_arrows', color: 'rose' },
                    ].map((k, i) => (
                        <div key={i} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-lg hover:border-indigo-100 transition-all group flex flex-col justify-between min-h-[140px]">
                            <div className="flex justify-between items-start mb-4">
                                <div className={`w-10 h-10 rounded-xl bg-${k.color}-50 text-${k.color}-600 flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner`}>
                                    <span className="material-symbols-outlined text-[22px]">{k.icon}</span>
                                </div>
                                <span className="text-[11px] font-black text-slate-200">#0{i+1}</span>
                            </div>
                            <div>
                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-tighter mb-2 leading-tight h-7">{k.label}</p>
                                <div className="flex items-baseline gap-1">
                                    <span className={`text-2xl font-black text-${k.color}-700 tracking-tighter`}>
                                        {k.value.toFixed(k.suffix === 'x' || k.suffix === '' ? 2 : 1)}
                                    </span>
                                    <span className="text-[10px] font-black text-slate-400">{k.suffix}</span>
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
