import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const formatVND = (v) => v ? Number(Math.round(v)).toLocaleString('vi-VN') : '0';

export default function DashboardOverview() {
    const [stats, setStats] = useState({ 
        totalProjects: 0, 
        pendingPayments: 0, 
        approvedPayments: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchBasicStats = async () => {
            setLoading(true);
            try {
                const { count: projCount } = await supabase.from('projects').select('*', { count: 'exact', head: true });
                const { count: pendingCount } = await supabase.from('payments').select('*', { count: 'exact', head: true }).eq('status', 'Chờ duyệt');
                const { count: approvedCount } = await supabase.from('payments').select('*', { count: 'exact', head: true }).eq('status', 'Đã duyệt');
                
                setStats({
                    totalProjects: projCount || 0,
                    pendingPayments: pendingCount || 0,
                    approvedPayments: approvedCount || 0
                });
            } catch (error) {
                console.error("Error fetching generic stats:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchBasicStats();
    }, []);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-slate-500 mb-1">Tổng Số Dự Án</p>
                            <h3 className="text-3xl font-bold text-slate-800">{stats.totalProjects}</h3>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                            <span className="material-symbols-outlined">business</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-slate-500 mb-1">Hồ Sơ Chờ Duyệt</p>
                            <h3 className="text-3xl font-bold text-orange-600">{stats.pendingPayments}</h3>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center text-orange-600">
                            <span className="material-symbols-outlined">pending_actions</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-slate-500 mb-1">Hồ Sơ Đã Duyệt</p>
                            <h3 className="text-3xl font-bold text-emerald-600">{stats.approvedPayments}</h3>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                            <span className="material-symbols-outlined">task_alt</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-slate-500 mb-1">Sức Khoẻ Hệ Thống</p>
                            <h3 className="text-xl font-bold text-slate-800 mt-2">Tuyệt Vời</h3>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-600">
                            <span className="material-symbols-outlined">health_and_safety</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center min-h-[400px] flex flex-col items-center justify-center">
                <div className="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 mb-6">
                    <span className="material-symbols-outlined text-4xl">monitoring</span>
                </div>
                <h2 className="text-2xl font-bold text-slate-800 mb-3">Báo Cáo Tài Chính Chuyên Sâu</h2>
                <p className="text-slate-500 max-w-lg mb-8 text-base">
                    Giao diện <strong className="text-slate-800">"Financial Architect | Báo Cáo Thu - Chi Tổng Hợp"</strong> đã được tách riêng và chuyển sang chuyên mục báo cáo để bạn dễ dàng quản lý chuyên biệt.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="px-6 py-3 bg-slate-100 text-slate-500 rounded-xl font-medium text-sm border border-slate-200 shadow-sm">
                        Menu bên trái <span className="mx-2">&rarr;</span> Kế Hoạch & Báo Cáo <span className="mx-2">&rarr;</span> Báo Cáo Thu - Chi Tháng
                    </div>
                </div>
            </div>
        </div>
    );
}
