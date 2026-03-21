import React from 'react';
import { supabase } from '../../lib/supabase';
import { useInventory } from '../../context/InventoryContext';

export default function InventoryDashboard({ onAction }) {
    const { stocks, materials, warehouses } = useInventory();
    const [statsData, setStatsData] = React.useState({ pendingReq: 0, todayIn: 0 });

    React.useEffect(() => {
        const fetchDashboardStats = async () => {
            try {
                const today = new Date().toISOString().split('T')[0];
                
                // Pending Requests
                const { count: pendingCount, error: reqError } = await supabase
                    .from('inventory_requests')
                    .select('*', { count: 'exact', head: true })
                    .eq('status', 'PENDING');
                if (reqError) console.warn("Dashboard: inventory_requests table missing.");
                
                // Today's Inbound Receipts
                const { count: inboundCount, error: inError } = await supabase
                    .from('inventory_receipts')
                    .select('*', { count: 'exact', head: true })
                    .eq('type', 'IN')
                    .gte('created_at', today);
                if (inError) console.warn("Dashboard: inventory_receipts table missing.");
                
                setStatsData({
                    pendingReq: pendingCount || 0,
                    todayIn: inboundCount || 0
                });
            } catch (err) {
                console.error("Dashboard Stats Fetch Error:", err);
                setStatsData({ pendingReq: 0, todayIn: 0 });
            }
        };
        fetchDashboardStats();
    }, []);

    const stats = [
        { 
            label: 'Tổng giá trị tồn kho', 
            value: stocks.reduce((acc, s) => {
                const mat = materials.find(m => m.id === s.material_id);
                const price = Number(mat?.avg_unit_price || mat?.price || 0);
                return acc + (Number(s.quantity) * price);
            }, 0).toLocaleString('vi-VN'), 
            unit: 'VNĐ',
            icon: 'account_balance_wallet',
            color: 'blue'
        },
        { 
            label: 'Yêu cầu chờ duyệt', 
            value: statsData.pendingReq, 
            unit: 'Cần xử lý ngay',
            icon: 'assignment_late',
            color: 'orange'
        },
        { 
            label: 'Vật tư sắp hết', 
            value: stocks.filter(s => Number(s.quantity) <= Number(s.min_quantity || 10)).length, 
            unit: 'Cần nhập thêm',
            icon: 'warning',
            color: 'red'
        },
        { 
            label: 'Phiếu nhập hôm nay', 
            value: statsData.todayIn, 
            unit: 'Giao dịch nhập kho',
            icon: 'login',
            color: 'emerald'
        }
    ];

    const colorClasses = {
        blue: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 border-blue-100 dark:border-blue-500/20',
        orange: 'bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400 border-orange-100 dark:border-orange-500/20',
        red: 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400 border-red-100 dark:border-red-500/20',
        emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-100 dark:border-emerald-500/20',
    };

    return (
        <div className="space-y-8 animate-fade-in">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat, i) => (
                    <div key={i} className={`p-6 rounded-[32px] border ${colorClasses[stat.color]} glass-panel hover:scale-[1.05] relative overflow-hidden group`}>
                        <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform">
                            <span className="material-symbols-outlined notranslate text-9xl" translate="no">{stat.icon}</span>
                        </div>
                        <div className="flex items-start justify-between mb-4 relative z-10">
                            <span className="material-symbols-outlined notranslate text-3xl" translate="no">{stat.icon}</span>
                            <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Hôm nay</span>
                        </div>
                        <div className="text-3xl font-black mb-1">{stat.value}</div>
                        <div className="text-xs font-bold opacity-80 uppercase tracking-tight">{stat.label}</div>
                        <div className="mt-4 pt-4 border-t border-current opacity-20 text-[10px] font-bold">
                            {stat.unit}
                        </div>
                    </div>
                ))}
            </div>

            {/* Quick Actions */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-8 rounded-[32px] shadow-lg shadow-blue-500/20 text-white flex flex-col md:flex-row items-center justify-between gap-6">
                <div>
                    <h3 className="text-xl font-black mb-1">Thao tác kho nhanh</h3>
                    <p className="text-blue-100 text-sm font-medium">Lập phiếu nhập xuất vật tư cho dự án chỉ với vài bước</p>
                </div>
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <button 
                        onClick={() => onAction('inbound')}
                        className="flex-1 md:flex-none px-8 py-4 bg-white text-blue-600 font-black rounded-2xl text-sm hover:bg-blue-50 transition-all flex items-center justify-center gap-2 active:scale-95"
                    >
                        <span className="material-symbols-outlined notranslate text-[20px]" translate="no">login</span>
                        Lập phiếu Nhập
                    </button>
                    <button 
                        onClick={() => onAction('outbound')}
                        className="flex-1 md:flex-none px-8 py-4 bg-blue-500/30 border border-white/20 backdrop-blur-md text-white font-black rounded-2xl text-sm hover:bg-blue-500/50 transition-all flex items-center justify-center gap-2 active:scale-95"
                    >
                        <span className="material-symbols-outlined notranslate text-[20px]" translate="no">logout</span>
                        Lập phiếu Xuất
                    </button>
                    <button 
                        onClick={() => onAction('requests')}
                        className="flex-1 md:flex-none px-8 py-4 bg-amber-500/30 border border-white/20 backdrop-blur-md text-white font-black rounded-2xl text-sm hover:bg-amber-500/50 transition-all flex items-center justify-center gap-2 active:scale-95"
                    >
                        <span className="material-symbols-outlined notranslate text-[20px]" translate="no">assignment</span>
                        Gửi yêu cầu
                    </button>
                </div>
            </div>

            {/* Project Inventory Table */}
            <div className="bg-white dark:bg-slate-800 rounded-[32px] shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                    <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                        <span className="material-symbols-outlined notranslate text-blue-500" translate="no">domain</span>
                        Danh sách kho dự án
                    </h3>
                    <button className="text-sm font-bold text-blue-500 hover:underline">Quản lý kho</button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 dark:bg-slate-900/50 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-slate-700">
                            <tr>
                                <th className="px-8 py-4">Mã Dự án</th>
                                <th className="px-8 py-4">Tên Dự án / Kho</th>
                                <th className="px-8 py-4">Địa điểm</th>
                                <th className="px-8 py-4 text-center">Tồn kho</th>
                                <th className="px-8 py-4 text-center">Trạng thái</th>
                                <th className="px-8 py-4 text-center">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {warehouses.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-8 py-12 text-center text-slate-400 italic">Chưa có thông tin kho dự án</td>
                                </tr>
                            ) : warehouses.map(wh => (
                                <tr key={wh.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
                                    <td className="px-8 py-4 font-mono text-xs font-bold text-blue-600">{wh.project_id || 'K-TONG'}</td>
                                    <td className="px-8 py-4">
                                        <div className="font-bold text-slate-900 dark:text-white">{wh.name}</div>
                                        <div className="text-[10px] text-slate-500">{wh.type}</div>
                                    </td>
                                    <td className="px-8 py-4 text-xs text-slate-500 max-w-[200px] truncate">{wh.location || '-'}</td>
                                    <td className="px-8 py-4 text-center font-black text-slate-700 dark:text-slate-300">
                                        {stocks.filter(s => s.warehouse_id === wh.id).reduce((acc, s) => acc + Number(s.quantity), 0).toLocaleString('vi-VN')}
                                    </td>
                                    <td className="px-8 py-4 text-center">
                                        <span className="px-3 py-1 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full text-[10px] font-black uppercase">Hoàn thành</span>
                                    </td>
                                    <td className="px-8 py-4 text-center">
                                        <button className="material-symbols-outlined notranslate text-slate-400 hover:text-blue-500 transition-colors text-xl" translate="no">visibility</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
