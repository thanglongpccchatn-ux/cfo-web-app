import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { fmt } from '../../utils/formatters';
import SkeletonTable from '../ui/SkeletonTable';
import SupplierPaymentModal from '../supplier/SupplierPaymentModal';

const STATUS_MAP = {
    'ORDERED':   { label: 'Đã đặt', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: 'local_shipping' },
    'PARTIAL':   { label: 'Nhận 1 phần', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: 'inventory' },
    'COMPLETED': { label: 'Hoàn thành', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: 'check_circle' },
    'CANCELLED': { label: 'Đã hủy', color: 'bg-slate-100 text-slate-400 border-slate-200', icon: 'block' },
};

const PAY_STATUS = {
    'UNPAID':  { label: 'Chưa TT', color: 'text-red-600 bg-red-50 border-red-200' },
    'PARTIAL': { label: 'TT 1 phần', color: 'text-amber-600 bg-amber-50 border-amber-200' },
    'PAID':    { label: 'Đã TT', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
};



export default function PurchaseOrderList({ onCreateNew, onViewTab }) {
    const { profile } = useAuth();
    const { error: toastError } = useToast();
    const [filter, setFilter] = useState('all');
    const [expandedId, setExpandedId] = useState(null);
    const [paymentPO, setPaymentPO] = useState(null);

    const canCreatePO = profile?.role_code === 'ROLE03' || profile?.role_code === 'ROLE01';

    const queryClient = useQueryClient();
    const invalidatePOs = () => queryClient.invalidateQueries({ queryKey: ['purchaseOrderList'] });

    // ── React Query: POs + Approved Requests ──
    const { data: queryData, isLoading: loading } = useQuery({
        queryKey: ['purchaseOrderList'],
        queryFn: async () => {
            const [poRes, reqRes] = await Promise.all([
                supabase.from('purchase_orders')
                    .select('*, purchase_order_items(*), partners(name, code), projects(name, code, internal_code), po_payments(*)')
                    .order('created_at', { ascending: false }),
                supabase.from('inventory_requests')
                    .select('id, code, project_id, notes, inventory_request_items(id, quantity, unit, product_name, material_name_manual)')
                    .eq('status', 'APPROVED')
                    .order('created_at', { ascending: false })
            ]);

            if (poRes.error) console.warn('PO fetch error:', poRes.error);
            const pos = poRes.data || [];
            const poRequestIds = pos.map(po => po.request_id).filter(Boolean);
            const approvedRequests = (reqRes.data || []).filter(r => !poRequestIds.includes(r.id));

            return { pos, approvedRequests };
        },
        staleTime: 5 * 60 * 1000,
    });

    const pos = queryData?.pos || [];
    const approvedRequests = queryData?.approvedRequests || [];

    const filteredPOs = pos.filter(po => filter === 'all' || po.status === filter);

    if (loading) return <SkeletonTable rows={4} cols={6} />;

    return (
        <div className="space-y-5 animate-fade-in">
            {/* Approved Requests Banner */}
            {canCreatePO && approvedRequests.length > 0 && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-black uppercase tracking-wider text-emerald-700 flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px]">assignment_turned_in</span>
                            Đề nghị VT đã duyệt — Sẵn sàng tạo PO
                        </h4>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {approvedRequests.map(req => (
                            <button
                                key={req.id}
                                onClick={() => onCreateNew(req.id)}
                                className="px-3 py-2 bg-white border border-emerald-300 rounded-xl text-xs font-bold text-emerald-700 hover:bg-emerald-100 transition-all flex items-center gap-1.5 shadow-sm"
                            >
                                <span className="material-symbols-outlined text-[14px]">add_shopping_cart</span>
                                {req.code} ({req.inventory_request_items?.length || 0} VT)
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Filter + Actions */}
            <div className="flex flex-wrap justify-between items-center gap-3">
                <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200">
                    {[
                        { key: 'all', label: 'Tất cả' },
                        { key: 'ORDERED', label: 'Đã đặt' },
                        { key: 'PARTIAL', label: 'Nhận 1 phần' },
                        { key: 'COMPLETED', label: 'Hoàn thành' },
                    ].map(tab => (
                        <button key={tab.key} onClick={() => setFilter(tab.key)}
                            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${filter === tab.key ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >{tab.label}</button>
                    ))}
                </div>
                {canCreatePO && (
                    <button onClick={() => onCreateNew(null)} className="px-5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white font-black rounded-2xl text-[11px] uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-blue-500/20 active:scale-95 transition-all">
                        <span className="material-symbols-outlined text-[18px]">add_circle</span>Tạo PO mới
                    </button>
                )}
            </div>

            {/* PO Cards */}
            {filteredPOs.length === 0 ? (
                <div className="text-center py-20 text-slate-400">
                    <span className="material-symbols-outlined text-5xl mb-3 block">shopping_cart</span>
                    <p className="font-bold text-sm">Chưa có đơn đặt hàng nào</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredPOs.map(po => {
                        const sCfg = STATUS_MAP[po.status] || STATUS_MAP['ORDERED'];
                        const pCfg = PAY_STATUS[po.payment_status] || PAY_STATUS['UNPAID'];
                        const isExpanded = expandedId === po.id;
                        const totalReceived = (po.purchase_order_items || []).reduce((s, i) => s + Number(i.quantity_received || 0), 0);
                        const totalOrdered = (po.purchase_order_items || []).reduce((s, i) => s + Number(i.quantity_ordered || 0), 0);
                        const totalPaid = (po.po_payments || []).reduce((s, p) => s + Number(p.amount || 0), 0);
                        const projectCode = po.projects?.internal_code || po.projects?.code || '';

                        return (
                            <div key={po.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-all overflow-hidden">
                                <div className="p-4 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : po.id)}>
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 ${sCfg.color}`}>
                                                <span className="material-symbols-outlined text-[20px]">{sCfg.icon}</span>
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h4 className="text-sm font-black text-slate-800 uppercase">{po.code}</h4>
                                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${sCfg.color}`}>{sCfg.label}</span>
                                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${pCfg.color}`}>{pCfg.label}</span>
                                                </div>
                                                <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500">
                                                    {projectCode && <span className="font-bold text-orange-600">{projectCode}</span>}
                                                    <span>NCC: <b className="text-slate-700">{po.partners?.name || '-'}</b></span>
                                                    <span>{po.purchase_order_items?.length || 0} mặt hàng</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0 flex items-center gap-3">
                                            <div>
                                                <div className="text-sm font-black text-slate-800 tabular-nums">{fmt(po.total_amount)}đ</div>
                                                <div className="text-[10px] text-slate-400">Đã TT: <span className="font-bold text-emerald-600">{fmt(totalPaid)}đ</span></div>
                                            </div>
                                            <span className={`material-symbols-outlined text-[20px] text-slate-300 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>expand_more</span>
                                        </div>
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="border-t border-slate-100 bg-slate-50/50 p-4 space-y-3 animate-slide-down">
                                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                                            <table className="w-full text-left">
                                                <thead className="bg-slate-50 text-[9px] font-black uppercase text-slate-400 tracking-widest">
                                                    <tr>
                                                        <th className="px-3 py-2">Vật tư</th>
                                                        <th className="px-3 py-2 text-center">SL đặt</th>
                                                        <th className="px-3 py-2 text-center">SL nhận</th>
                                                        <th className="px-3 py-2 text-right">Đơn giá</th>
                                                        <th className="px-3 py-2 text-right">Thành tiền</th>
                                                        <th className="px-3 py-2 text-center">Trạng thái</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {po.purchase_order_items?.map(item => {
                                                        const qo = Number(item.quantity_ordered || 0);
                                                        const qr = Number(item.quantity_received || 0);
                                                        const variance = qr >= qo ? 'Đủ' : qr > 0 ? 'Thiếu' : 'Chờ';
                                                        const vColor = qr >= qo ? 'text-emerald-600' : qr > 0 ? 'text-amber-600' : 'text-slate-400';
                                                        return (
                                                            <tr key={item.id} className="text-xs hover:bg-slate-50">
                                                                <td className="px-3 py-2 font-bold text-slate-700">{item.material_name || 'Vật tư'}</td>
                                                                <td className="px-3 py-2 text-center font-black">{qo}</td>
                                                                <td className="px-3 py-2 text-center font-black">{qr}</td>
                                                                <td className="px-3 py-2 text-right tabular-nums">{fmt(item.unit_price)}</td>
                                                                <td className="px-3 py-2 text-right font-bold tabular-nums">{fmt(qo * Number(item.unit_price || 0))}</td>
                                                                <td className={`px-3 py-2 text-center font-black text-[10px] uppercase ${vColor}`}>{variance}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Payment History */}
                                        {po.po_payments?.length > 0 && (
                                            <div className="bg-white rounded-xl border border-slate-200 p-3">
                                                <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">Lịch sử thanh toán</h5>
                                                <div className="space-y-1">
                                                    {po.po_payments.map(pay => (
                                                        <div key={pay.id} className="flex justify-between text-xs bg-slate-50 rounded-lg px-3 py-1.5">
                                                            <span className="text-slate-500">{new Date(pay.payment_date).toLocaleDateString('vi-VN')}</span>
                                                            <span className="font-bold text-emerald-600">+{fmt(pay.amount)}đ</span>
                                                            <span className="text-slate-400 italic">{pay.notes || pay.reference_number || ''}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {po.notes && (
                                            <div className="text-xs text-slate-500 italic bg-white rounded-xl border border-dashed border-slate-200 p-3 flex items-start gap-2">
                                                <span className="material-symbols-outlined text-[16px] text-slate-400 shrink-0">sticky_note_2</span>
                                                {po.notes}
                                            </div>
                                        )}

                                        {/* Actions Row */}
                                        <div className="flex items-center justify-end gap-2 pt-2">
                                            {po.payment_status !== 'PAID' && Number(po.total_amount) > totalPaid && (
                                                <button
                                                    onClick={() => setPaymentPO(po)}
                                                    className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl text-[10px] uppercase tracking-wider flex items-center gap-1 transition-all shadow-sm"
                                                >
                                                    <span className="material-symbols-outlined text-[14px]">payments</span>Thanh toán NCC
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {paymentPO && (
                <SupplierPaymentModal
                    po={{
                        id: paymentPO.id,
                        code: paymentPO.code,
                        total_amount: paymentPO.total_amount,
                        paid_amount: (paymentPO.po_payments || []).reduce((s, p) => s + Number(p.amount || 0), 0),
                        project_id: paymentPO.project_id,
                    }}
                    supplier={{ id: paymentPO.supplier_id, name: paymentPO.partners?.name || '', code: paymentPO.partners?.code || '' }}
                    onClose={() => setPaymentPO(null)}
                    onSuccess={() => { invalidatePOs(); setPaymentPO(null); }}
                    existingPayments={paymentPO.po_payments || []}
                />
            )}
        </div>
    );
}
