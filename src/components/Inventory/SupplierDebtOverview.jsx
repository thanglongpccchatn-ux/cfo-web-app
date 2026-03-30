import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { fmt } from '../../utils/formatters';

export default function SupplierDebtOverview() {
    const [expandedId, setExpandedId] = useState(null);
    const [search, setSearch] = useState('');

    // ── React Query: Supplier debt data ──
    const { data: suppliers = [], isLoading: loading } = useQuery({
        queryKey: ['supplierDebtOverview'],
        queryFn: async () => {
            const { data: poData, error } = await supabase
                .from('purchase_orders')
                .select('*, partners(id, code, name), projects(name, code, internal_code), purchase_order_items(quantity_ordered, quantity_received, unit_price, material_name), po_payments(amount, payment_date)')
                .neq('status', 'CANCELLED')
                .order('created_at', { ascending: false });

            if (error) { console.warn('Supplier debt fetch error:', error); return []; }

            const supplierMap = {};
            (poData || []).forEach(po => {
                const sid = po.supplier_id;
                if (!sid) return;
                if (!supplierMap[sid]) {
                    supplierMap[sid] = {
                        id: sid,
                        name: po.partners?.name || 'N/A',
                        code: po.partners?.code || '',
                        pos: [],
                        totalAmount: 0,
                        totalPaid: 0,
                    };
                }
                const totalPaid = (po.po_payments || []).reduce((s, p) => s + Number(p.amount || 0), 0);
                supplierMap[sid].pos.push({ ...po, paid: totalPaid });
                supplierMap[sid].totalAmount += Number(po.total_amount || 0);
                supplierMap[sid].totalPaid += totalPaid;
            });

            return Object.values(supplierMap).sort((a, b) => (b.totalAmount - b.totalPaid) - (a.totalAmount - a.totalPaid));
        },
        staleTime: 5 * 60 * 1000,
    });

    const filtered = suppliers.filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()) || (s.code && s.code.toLowerCase().includes(search.toLowerCase())));

    const grandTotal = suppliers.reduce((s, sp) => s + sp.totalAmount, 0);
    const grandPaid = suppliers.reduce((s, sp) => s + sp.totalPaid, 0);
    const grandDebt = grandTotal - grandPaid;

    if (loading) return <div className="p-12 text-center text-slate-500 animate-pulse">Đang tải công nợ NCC...</div>;

    return (
        <div className="space-y-5 animate-fade-in">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Tổng giá trị PO</div>
                    <div className="text-xl font-black text-slate-800 tabular-nums">{fmt(grandTotal)}đ</div>
                </div>
                <div className="bg-white rounded-2xl border border-emerald-200 p-4 shadow-sm">
                    <div className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-1">Đã thanh toán</div>
                    <div className="text-xl font-black text-emerald-700 tabular-nums">{fmt(grandPaid)}đ</div>
                </div>
                <div className="bg-white rounded-2xl border border-red-200 p-4 shadow-sm">
                    <div className="text-[10px] font-black uppercase tracking-widest text-red-600 mb-1">Công nợ còn lại</div>
                    <div className="text-xl font-black text-red-700 tabular-nums">{fmt(grandDebt)}đ</div>
                </div>
            </div>

            {/* Search */}
            <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 text-[18px]">search</span>
                <input
                    type="text" placeholder="Tìm nhà cung cấp..."
                    value={search} onChange={e => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
            </div>

            {/* Supplier Cards */}
            {filtered.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                    <span className="material-symbols-outlined text-5xl mb-3 block">account_balance</span>
                    <p className="font-bold text-sm">Chưa có dữ liệu công nợ</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map(s => {
                        const debt = s.totalAmount - s.totalPaid;
                        const isExpanded = expandedId === s.id;
                        const paidPercent = s.totalAmount > 0 ? Math.round((s.totalPaid / s.totalAmount) * 100) : 0;

                        return (
                            <div key={s.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-all overflow-hidden">
                                <div className="p-4 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : s.id)}>
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0">
                                                <span className="material-symbols-outlined text-blue-500 text-[20px]">storefront</span>
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-black text-slate-800">{s.name}</h4>
                                                <div className="flex items-center gap-3 mt-0.5 text-[11px] text-slate-500">
                                                    {s.code && <span className="font-mono text-slate-400">{s.code}</span>}
                                                    <span>{s.pos.length} đơn hàng</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4 shrink-0">
                                            <div className="text-right">
                                                <div className={`text-base font-black tabular-nums ${debt > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                                    {debt > 0 ? `−${fmt(debt)}đ` : 'Đã tất toán'}
                                                </div>
                                                <div className="flex items-center gap-2 justify-end mt-0.5">
                                                    <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                        <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${paidPercent}%` }} />
                                                    </div>
                                                    <span className="text-[10px] font-bold text-slate-400">{paidPercent}%</span>
                                                </div>
                                            </div>
                                            <span className={`material-symbols-outlined text-[20px] text-slate-300 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>expand_more</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Expanded: All POs for this supplier */}
                                {isExpanded && (
                                    <div className="border-t border-slate-100 bg-slate-50/50 p-4 animate-slide-down">
                                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                                            <table className="w-full text-left">
                                                <thead className="bg-slate-50 text-[9px] font-black uppercase text-slate-400 tracking-widest">
                                                    <tr>
                                                        <th className="px-3 py-2">Mã PO</th>
                                                        <th className="px-3 py-2">Dự án</th>
                                                        <th className="px-3 py-2 text-right">Giá trị</th>
                                                        <th className="px-3 py-2 text-right">Đã TT</th>
                                                        <th className="px-3 py-2 text-right">Còn nợ</th>
                                                        <th className="px-3 py-2 text-center">Trạng thái</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {s.pos.map(po => {
                                                        const poDebt = Number(po.total_amount || 0) - po.paid;
                                                        const projectCode = po.projects?.internal_code || po.projects?.code || '-';
                                                        return (
                                                            <tr key={po.id} className="text-xs hover:bg-slate-50">
                                                                <td className="px-3 py-2 font-black text-slate-700 uppercase">{po.code}</td>
                                                                <td className="px-3 py-2 font-bold text-orange-600">{projectCode}</td>
                                                                <td className="px-3 py-2 text-right tabular-nums font-bold">{fmt(po.total_amount)}</td>
                                                                <td className="px-3 py-2 text-right tabular-nums text-emerald-600 font-bold">{fmt(po.paid)}</td>
                                                                <td className={`px-3 py-2 text-right tabular-nums font-black ${poDebt > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{poDebt > 0 ? fmt(poDebt) : '0'}</td>
                                                                <td className="px-3 py-2 text-center">
                                                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${
                                                                        po.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                                                                        po.status === 'PARTIAL' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                                                                        'bg-amber-100 text-amber-700 border-amber-200'
                                                                    }`}>{po.status === 'COMPLETED' ? 'Xong' : po.status === 'PARTIAL' ? '1 phần' : 'Đã đặt'}</span>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
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
