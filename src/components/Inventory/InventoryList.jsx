import React, { useState, useMemo } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { exportStockToExcel } from './InventoryExportUtils';

export default function InventoryList({ onAction }) {
    const { stocks, warehouses, materials } = useInventory();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedWarehouse, setSelectedWarehouse] = useState('all');

    const getMaterialName = (id) => materials.find(m => m.id === id)?.name || 'N/A';
    const getMaterialSku = (id) => materials.find(m => m.id === id)?.sku || 'N/A';
    const getUom = (id) => materials.find(m => m.id === id)?.uom || 'ĐVT';
    const getWarehouseName = (id) => warehouses.find(w => w.id === id)?.name || 'N/A';

    const filteredStocks = useMemo(() => {
        return stocks.filter(item => {
            const mat = materials.find(m => m.id === item.material_id);
            const searchLower = searchTerm.toLowerCase();
            const matchesSearch = 
                (mat?.name?.toLowerCase() || '').includes(searchLower) ||
                (mat?.sku?.toLowerCase() || '').includes(searchLower);
            const matchesWarehouse = selectedWarehouse === 'all' || item.warehouse_id === selectedWarehouse;
            return matchesSearch && matchesWarehouse;
        });
    }, [stocks, materials, searchTerm, selectedWarehouse]);

    return (
        <div className="space-y-6 animate-fade-in px-2">
            {/* Filter Bar */}
            <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl p-4 md:p-6 rounded-[24px] md:rounded-[32px] border border-white/20 dark:border-slate-700/50 flex flex-col md:flex-row flex-wrap items-stretch md:items-center gap-3 md:gap-4 shadow-xl shadow-slate-200/20 dark:shadow-none">
                <div className="flex-1 min-w-0 md:min-w-[300px] relative">
                    <span className="material-symbols-outlined notranslate absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" translate="no">search</span>
                    <input 
                        type="text" 
                        placeholder="Tìm kiếm vật tư theo tên hoặc mã SKU..."
                        className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-900/50 border-none rounded-2xl text-xs md:text-sm focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <select 
                    className="w-full md:w-auto px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border-none rounded-2xl text-xs md:text-sm focus:ring-2 focus:ring-blue-500 md:min-w-[200px] font-bold text-slate-600 dark:text-slate-300 transition-all"
                    value={selectedWarehouse}
                    onChange={(e) => setSelectedWarehouse(e.target.value)}
                >
                    <option value="all">Tất cả kho dự án</option>
                    {warehouses.map(wh => (
                        <option key={wh.id} value={wh.id}>{wh.name}</option>
                    ))}
                </select>
                <div className="flex flex-wrap items-center gap-2 md:gap-3">
                    <button 
                        onClick={() => exportStockToExcel(filteredStocks, materials, warehouses)}
                        className="flex-1 md:flex-none px-4 md:px-6 py-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-emerald-50 dark:hover:bg-slate-600 text-emerald-600 font-black rounded-2xl text-[10px] md:text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95"
                    >
                        <span className="material-symbols-outlined notranslate text-[18px] md:text-[20px]" translate="no">download</span>
                        Xuất Excel
                    </button>
                    <button 
                        onClick={() => onAction('inbound')}
                        className="flex-1 md:flex-none px-4 md:px-6 py-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-900 dark:text-white font-black rounded-2xl text-[10px] md:text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95"
                    >
                        <span className="material-symbols-outlined notranslate text-[18px] md:text-[20px] text-emerald-500" translate="no">add_circle</span>
                        Nhập kho
                    </button>
                    <button 
                        onClick={() => onAction('outbound')}
                        className="flex-1 md:flex-none px-4 md:px-6 py-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-900 dark:text-white font-black rounded-2xl text-[10px] md:text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95"
                    >
                        <span className="material-symbols-outlined notranslate text-[18px] md:text-[20px] text-blue-500" translate="no">remove_circle</span>
                        Xuất kho
                    </button>
                </div>
            </div>

            {/* List Table */}
            <div className="glass-panel overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="whitespace-nowrap">
                            <tr className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800">
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Vật tư / Thiết bị</th>
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Vị trí kho</th>
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">ĐVT</th>
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Số lượng tồn</th>
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Trạng thái</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {filteredStocks.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-8 py-16 text-center text-slate-400 italic text-sm">
                                        Không tìm thấy dữ liệu tồn kho nào phù hợp với bộ lọc
                                    </td>
                                </tr>
                            ) : (
                                filteredStocks.map((stock) => {
                                    const isLow = stock.quantity < (stock.min_quantity || 10);
                                    return (
                                        <tr key={stock.id} className="group hover:bg-blue-50/30 dark:hover:bg-blue-500/5 transition-all">
                                            <td className="px-8 py-5">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-900 flex items-center justify-center group-hover:bg-blue-100 dark:group-hover:bg-blue-500/20 transition-colors">
                                                        <span className="material-symbols-outlined notranslate text-slate-400 group-hover:text-blue-500 transition-colors" translate="no">inventory</span>
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="font-black text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors tracking-tight text-sm uppercase">
                                                            {getMaterialName(stock.material_id)}
                                                        </span>
                                                        <span className="text-[10px] font-mono text-slate-400 font-bold">
                                                            SKU: {getMaterialSku(stock.material_id)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5">
                                                <span className="text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200/50 dark:border-slate-700/50">
                                                    {getWarehouseName(stock.warehouse_id)}
                                                </span>
                                            </td>
                                            <td className="px-8 py-5 text-center">
                                                <span className="text-xs font-black text-slate-500 bg-slate-50 dark:bg-slate-900 px-2 py-1 rounded-lg border border-slate-100 dark:border-slate-800">
                                                    {getUom(stock.material_id)}
                                                </span>
                                            </td>
                                            <td className="px-8 py-5 text-right">
                                                <div className="flex flex-col items-end">
                                                    <span className={`text-xl font-black tracking-tighter ${isLow ? 'text-red-500' : 'text-slate-900 dark:text-white'}`}>
                                                        {Number(stock.quantity).toLocaleString('vi-VN')}
                                                    </span>
                                                    {isLow && <span className="text-[9px] font-black text-red-400 uppercase tracking-tighter">Dưới hạn mức</span>}
                                                </div>
                                            </td>
                                            <td className="px-8 py-5 text-center">
                                                <div className="flex justify-center">
                                                    <span className={`status-badge ${isLow ? 'status-critical' : 'status-safe'} !text-[9px] !px-4`}>
                                                        {isLow ? 'Sắp hết' : 'An toàn'}
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
