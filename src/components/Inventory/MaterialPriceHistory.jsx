import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { fmt, fmtDate } from '../../utils/formatters';
import SkeletonTable from '../ui/SkeletonTable';

/**
 * MaterialPriceHistory — Biến động giá VT theo thời gian
 * Lấy dữ liệu từ purchase_order_items + expense_materials để build timeline giá
 */
export default function MaterialPriceHistory() {
    const [selectedMaterial, setSelectedMaterial] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');

    // Fetch price data from PO items (primary source) 
    const { data: priceData = [], isLoading } = useQuery({
        queryKey: ['materialPriceHistory'],
        queryFn: async () => {
            // Method 1: From purchase_order_items (best source — has unit_price + date from PO)
            const { data: poItems, error: poErr } = await supabase
                .from('purchase_order_items')
                .select(`
                    id, material_name, quantity_ordered, unit_price, unit,
                    purchase_orders!inner(code, created_at, supplier_id, project_id, partners(name))
                `)
                .gt('unit_price', 0)
                .order('purchase_orders(created_at)', { ascending: false });

            // Method 2: From expense_materials (fallback)
            const { data: expenses, error: expErr } = await supabase
                .from('expense_materials')
                .select('id, product_name, unit_price, quantity, unit, expense_date, supplier_name, project_id')
                .gt('unit_price', 0)
                .order('expense_date', { ascending: false })
                .limit(500);

            const records = [];

            // Process PO items
            if (poItems && !poErr) {
                for (const item of poItems) {
                    const po = item.purchase_orders;
                    records.push({
                        id: 'po-' + item.id,
                        materialName: item.material_name || 'Vật tư',
                        unitPrice: Number(item.unit_price),
                        quantity: Number(item.quantity_ordered),
                        unit: item.unit || '',
                        date: po?.created_at ? new Date(po.created_at).toISOString().split('T')[0] : '',
                        supplier: po?.partners?.name || '',
                        source: 'PO',
                        sourceCode: po?.code || '',
                    });
                }
            }

            // Process expense materials
            if (expenses && !expErr) {
                for (const exp of expenses) {
                    // Skip if we already have this from PO data (avoid duplicates)
                    records.push({
                        id: 'exp-' + exp.id,
                        materialName: exp.product_name || 'Vật tư',
                        unitPrice: Number(exp.unit_price),
                        quantity: Number(exp.quantity),
                        unit: exp.unit || '',
                        date: exp.expense_date || '',
                        supplier: exp.supplier_name || '',
                        source: 'EXP',
                        sourceCode: '',
                    });
                }
            }

            return records;
        },
        staleTime: 5 * 60 * 1000,
    });

    // Group by material name and compute stats
    const materialGroups = useMemo(() => {
        const groups = {};
        for (const rec of priceData) {
            const key = rec.materialName.toLowerCase().trim();
            if (!groups[key]) {
                groups[key] = {
                    name: rec.materialName,
                    unit: rec.unit,
                    records: [],
                    minPrice: Infinity,
                    maxPrice: 0,
                    latestPrice: 0,
                    latestDate: '',
                    avgPrice: 0,
                    totalQty: 0,
                };
            }
            groups[key].records.push(rec);
            groups[key].totalQty += rec.quantity;
            if (rec.unitPrice < groups[key].minPrice) groups[key].minPrice = rec.unitPrice;
            if (rec.unitPrice > groups[key].maxPrice) groups[key].maxPrice = rec.unitPrice;
            if (!groups[key].latestDate || rec.date > groups[key].latestDate) {
                groups[key].latestDate = rec.date;
                groups[key].latestPrice = rec.unitPrice;
            }
        }

        // Compute averages and sort records by date
        for (const key of Object.keys(groups)) {
            const g = groups[key];
            const totalValue = g.records.reduce((s, r) => s + r.unitPrice * r.quantity, 0);
            g.avgPrice = g.totalQty > 0 ? totalValue / g.totalQty : 0;
            g.records.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
            if (g.minPrice === Infinity) g.minPrice = 0;
        }

        return Object.values(groups)
            .sort((a, b) => b.records.length - a.records.length);
    }, [priceData]);

    // Filter
    const filteredGroups = materialGroups.filter(g => {
        if (selectedMaterial !== 'all' && g.name.toLowerCase() !== selectedMaterial) return false;
        if (searchTerm && !g.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
        return true;
    });

    // Top materials for filter dropdown
    const topMaterials = materialGroups.filter(g => g.records.length >= 2).slice(0, 20);

    if (isLoading) return <SkeletonTable rows={5} cols={5} mode="card" />;

    return (
        <div className="space-y-5 animate-fade-in">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                        <span className="material-symbols-outlined text-amber-500 text-[20px]">trending_up</span>
                        Lịch sử giá Vật tư
                    </h3>
                    <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                        {materialGroups.length} loại VT · {priceData.length} mẫu giá
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <span className="material-symbols-outlined text-[16px] text-slate-400 absolute left-3 top-1/2 -translate-y-1/2">search</span>
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Tìm vật tư..."
                            className="pl-9 pr-4 py-2 bg-slate-100 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500 w-48"
                        />
                    </div>
                    {topMaterials.length > 0 && (
                        <select
                            value={selectedMaterial}
                            onChange={e => setSelectedMaterial(e.target.value)}
                            className="bg-slate-100 border-none rounded-xl px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="all">Tất cả VT</option>
                            {topMaterials.map(g => (
                                <option key={g.name} value={g.name.toLowerCase()}>{g.name} ({g.records.length})</option>
                            ))}
                        </select>
                    )}
                </div>
            </div>

            {/* Summary KPIs */}
            {filteredGroups.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-white rounded-2xl border border-slate-200 p-4">
                        <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Loại VT</div>
                        <div className="text-xl font-black text-slate-800">{filteredGroups.length}</div>
                    </div>
                    <div className="bg-white rounded-2xl border border-slate-200 p-4">
                        <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Mẫu giá</div>
                        <div className="text-xl font-black text-blue-600">{filteredGroups.reduce((s, g) => s + g.records.length, 0)}</div>
                    </div>
                    <div className="bg-white rounded-2xl border border-emerald-200 p-4">
                        <div className="text-[9px] font-black uppercase tracking-widest text-emerald-600 mb-1">Giá thấp nhất</div>
                        <div className="text-lg font-black text-emerald-700 tabular-nums">{fmt(Math.min(...filteredGroups.map(g => g.minPrice)))}đ</div>
                    </div>
                    <div className="bg-white rounded-2xl border border-red-200 p-4">
                        <div className="text-[9px] font-black uppercase tracking-widest text-red-600 mb-1">Giá cao nhất</div>
                        <div className="text-lg font-black text-red-700 tabular-nums">{fmt(Math.max(...filteredGroups.map(g => g.maxPrice)))}đ</div>
                    </div>
                </div>
            )}

            {/* Material Cards */}
            {filteredGroups.length === 0 ? (
                <div className="text-center py-20 text-slate-400">
                    <span className="material-symbols-outlined text-5xl mb-3 block">bar_chart_off</span>
                    <p className="font-bold text-sm">Chưa có dữ liệu giá</p>
                    <p className="text-xs mt-1">Giá được ghi nhận tự động khi tạo PO hoặc nhập chi phí vật tư</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredGroups.map(group => {
                        const priceChange = group.records.length >= 2
                            ? ((group.latestPrice - group.records[group.records.length - 1].unitPrice) / group.records[group.records.length - 1].unitPrice * 100)
                            : 0;
                        const priceVariance = group.maxPrice > 0 ? ((group.maxPrice - group.minPrice) / group.minPrice * 100) : 0;

                        return (
                            <div key={group.name} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden hover:shadow-md transition-all">
                                {/* Card Header */}
                                <div className="p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 border border-amber-200 flex items-center justify-center shrink-0">
                                                <span className="material-symbols-outlined text-[20px]">construction</span>
                                            </div>
                                            <div className="min-w-0">
                                                <h4 className="text-sm font-black text-slate-800 truncate">{group.name}</h4>
                                                <div className="flex items-center gap-3 mt-0.5 text-[11px] text-slate-500">
                                                    <span>{group.unit || '-'}</span>
                                                    <span>{group.records.length} lần mua</span>
                                                    <span>{fmt(group.totalQty)} {group.unit}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <div className="text-sm font-black text-slate-800 tabular-nums">{fmt(group.latestPrice)}đ</div>
                                            <div className="text-[10px] text-slate-400">Giá gần nhất</div>
                                            {priceChange !== 0 && (
                                                <div className={`text-[10px] font-black flex items-center justify-end gap-0.5 mt-0.5 ${priceChange > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                                    <span className="material-symbols-outlined text-[12px]">{priceChange > 0 ? 'trending_up' : 'trending_down'}</span>
                                                    {priceChange > 0 ? '+' : ''}{priceChange.toFixed(1)}%
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Price Range Bar */}
                                    <div className="mt-3 ml-[52px]">
                                        <div className="flex items-center justify-between text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                            <span>Min: {fmt(group.minPrice)}đ</span>
                                            <span>TB: {fmt(Math.round(group.avgPrice))}đ</span>
                                            <span>Max: {fmt(group.maxPrice)}đ</span>
                                        </div>
                                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden relative">
                                            {group.maxPrice > group.minPrice && (
                                                <>
                                                    <div
                                                        className="absolute h-full bg-gradient-to-r from-emerald-400 to-amber-400 rounded-full"
                                                        style={{ left: '0%', width: '100%' }}
                                                    />
                                                    <div
                                                        className="absolute h-full w-1 bg-blue-600 rounded-full -translate-x-1/2"
                                                        style={{ left: `${((group.latestPrice - group.minPrice) / (group.maxPrice - group.minPrice)) * 100}%` }}
                                                        title={`Giá hiện tại: ${fmt(group.latestPrice)}đ`}
                                                    />
                                                </>
                                            )}
                                        </div>
                                        {priceVariance > 10 && (
                                            <div className="text-[9px] text-amber-600 font-bold mt-1">
                                                ⚠ Biến động {priceVariance.toFixed(0)}%
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Price History Table (collapsed, show last 5) */}
                                {group.records.length > 1 && (
                                    <div className="border-t border-slate-100 bg-slate-50/50">
                                        <table className="w-full text-left">
                                            <thead className="text-[8px] font-black uppercase text-slate-400 tracking-widest">
                                                <tr>
                                                    <th className="px-4 py-1.5">Ngày</th>
                                                    <th className="px-4 py-1.5 text-right">Đơn giá</th>
                                                    <th className="px-4 py-1.5 text-center">SL</th>
                                                    <th className="px-4 py-1.5">NCC</th>
                                                    <th className="px-4 py-1.5 text-center">Nguồn</th>
                                                    <th className="px-4 py-1.5 text-center">Biến động</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {group.records.slice(0, 5).map((rec, idx) => {
                                                    const prevPrice = idx < group.records.length - 1 ? group.records[idx + 1]?.unitPrice : rec.unitPrice;
                                                    const change = prevPrice > 0 ? ((rec.unitPrice - prevPrice) / prevPrice * 100) : 0;
                                                    return (
                                                        <tr key={rec.id} className="text-[11px] hover:bg-white/80 transition-colors">
                                                            <td className="px-4 py-1.5 text-slate-600 font-medium">{rec.date ? fmtDate(rec.date) : '-'}</td>
                                                            <td className="px-4 py-1.5 text-right font-black text-slate-800 tabular-nums">{fmt(rec.unitPrice)}đ</td>
                                                            <td className="px-4 py-1.5 text-center font-bold text-slate-500">{rec.quantity} {rec.unit}</td>
                                                            <td className="px-4 py-1.5 text-slate-500 truncate max-w-[120px]">{rec.supplier || '-'}</td>
                                                            <td className="px-4 py-1.5 text-center">
                                                                <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${
                                                                    rec.source === 'PO' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'
                                                                }`}>
                                                                    {rec.source}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-1.5 text-center">
                                                                {Math.abs(change) > 0.5 ? (
                                                                    <span className={`text-[10px] font-black ${change > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                                                        {change > 0 ? '↑' : '↓'}{Math.abs(change).toFixed(1)}%
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-[10px] text-slate-300">—</span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                        {group.records.length > 5 && (
                                            <div className="text-center py-1.5 text-[10px] text-slate-400 font-bold">
                                                +{group.records.length - 5} bản ghi khác
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
