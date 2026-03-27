import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function ConstructionModule() {
    const [stats, setStats] = useState({
        activeDiaries: 0,
        pendingReports: 0,
        laborToday: 0,
        safetyIncidents: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            setLoading(true);
            // Simulate fetching stats from site_diary and other tables
            const { count: diaryCount } = await supabase.from('site_diary').select('*', { count: 'exact', head: true });
            
            setStats({
                activeDiaries: diaryCount || 0,
                pendingReports: 3, // Mock
                laborToday: 145, // Mock
                safetyIncidents: 0
            });
            setLoading(false);
        };
        fetchStats();
    }, []);

    if (loading) {
        return (
            <div className="space-y-6 animate-fade-in">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 animate-pulse">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-slate-100" />
                                <div className="space-y-2 flex-1">
                                    <div className="h-2.5 bg-slate-100 rounded-full w-2/3" />
                                    <div className="h-6 bg-slate-200 rounded-full w-1/3" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 h-[400px] bg-white rounded-3xl border border-slate-200 animate-pulse" />
                    <div className="h-[400px] bg-white rounded-3xl border border-slate-200 animate-pulse" />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header section with summary cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center">
                            <span className="material-symbols-outlined">edit_calendar</span>
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1 text-nowrap">Nhật ký đang mở</p>
                            <h3 className="text-2xl font-black text-slate-800 dark:text-white leading-none">{stats.activeDiaries}</h3>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 flex items-center justify-center">
                            <span className="material-symbols-outlined">pending_actions</span>
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1 text-nowrap">Báo cáo chờ duyệt</p>
                            <h3 className="text-2xl font-black text-slate-800 dark:text-white leading-none">{stats.pendingReports}</h3>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-purple-100 dark:bg-purple-900/30 text-purple-600 flex items-center justify-center">
                            <span className="material-symbols-outlined">groups</span>
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1 text-nowrap">Nhân công hôm nay</p>
                            <h3 className="text-2xl font-black text-slate-800 dark:text-white leading-none">{stats.laborToday}</h3>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center">
                            <span className="material-symbols-outlined">health_and_safety</span>
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1 text-nowrap">An toàn lao động</p>
                            <h3 className="text-2xl font-black text-emerald-600 leading-none">An Toàn</h3>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content Area (Work in Progress Dashboard) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 h-[400px] flex flex-col items-center justify-center text-center">
                        <div className="w-20 h-20 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center text-slate-400 mb-4 animate-pulse">
                            <span className="material-symbols-outlined text-4xl">map</span>
                        </div>
                        <h4 className="text-lg font-black text-slate-800 dark:text-white mb-2">Bản đồ Dự án Thi công</h4>
                        <p className="text-sm text-slate-500 max-w-sm">
                            Tính năng theo dõi vị trí và tiến độ thi công trực quan trên bản đồ đang được hoàn thiện.
                        </p>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200 dark:border-slate-700">
                    <h4 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest mb-4">Hoạt động gần đây</h4>
                    <div className="space-y-4">
                        {[1, 2, 3, 4, 5].map(i => (
                            <div key={i} className="flex gap-3 pb-4 border-b border-slate-50 dark:border-slate-700 last:border-0">
                                <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex-shrink-0 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-[16px] text-slate-400">person</span>
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Kỹ sư đã cập nhật Nhật ký {i}</p>
                                    <p className="text-[10px] text-slate-500">2 giờ trước • Dự án SATECO-{100+i}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
