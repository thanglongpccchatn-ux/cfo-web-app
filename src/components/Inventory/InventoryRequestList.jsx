import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useInventory } from '../../context/InventoryContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

const STATUS_CONFIG = {
    'DRAFT':       { label: 'Nháp',         color: 'bg-slate-100 text-slate-600 border-slate-200',   icon: 'edit_note',      step: 0 },
    'PENDING_L1':  { label: 'Chờ CHT duyệt', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: 'hourglass_top',  step: 1 },
    'PENDING_L2':  { label: 'Chờ KSKL duyệt', color: 'bg-blue-100 text-blue-700 border-blue-200',   icon: 'hourglass_bottom', step: 2 },
    'APPROVED':    { label: 'Đã duyệt',     color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: 'check_circle', step: 3 },
    'REJECTED_L1': { label: 'CHT từ chối',  color: 'bg-red-100 text-red-700 border-red-200',        icon: 'cancel',         step: -1 },
    'REJECTED_L2': { label: 'KSKL từ chối', color: 'bg-red-100 text-red-700 border-red-200',        icon: 'cancel',         step: -1 },
    'CANCELLED':   { label: 'Đã hủy',       color: 'bg-slate-100 text-slate-400 border-slate-200',  icon: 'block',          step: -2 },
};

const STEPS = [
    { label: 'Tạo ĐN', icon: 'description' },
    { label: 'CHT duyệt', icon: 'verified' },
    { label: 'KSKL duyệt', icon: 'fact_check' },
    { label: 'Đã duyệt', icon: 'check_circle' },
];

const URGENCY_MAP = {
    'NORMAL':   { label: 'Bình thường', color: 'text-slate-400' },
    'URGENT':   { label: 'Gấp', color: 'text-orange-500' },
    'CRITICAL': { label: 'Rất gấp', color: 'text-red-600' },
};

const timeAgo = (dateStr) => {
    if (!dateStr) return '';
    const seconds = Math.floor((new Date() - new Date(dateStr)) / 1000);
    if (seconds < 60) return 'Vừa xong';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return minutes + ' phút trước';
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + ' giờ trước';
    const days = Math.floor(hours / 24);
    return days + ' ngày trước';
};

export default function InventoryRequestList({ onCreateNew }) {
    const { approveRequestL1, approveRequestL2, rejectRequest } = useInventory();
    const { profile } = useAuth();
    const { success, error: toastError } = useToast();
    const [filterStatus, setFilterStatus] = useState('all');
    const [expandedId, setExpandedId] = useState(null);
    const [rejectModalId, setRejectModalId] = useState(null);
    const [rejectReason, setRejectReason] = useState('');
    const [processing, setProcessing] = useState(false);

    const roleCode = profile?.role_code;

    // ── React Query: Inventory Requests ──
    const { data: requests = [], isLoading: loading, refetch: fetchRequests } = useQuery({
        queryKey: ['inventoryRequestList'],
        queryFn: async () => {
            const { data, error: err } = await supabase
                .from('inventory_requests')
                .select('*, inventory_request_items(*), projects(name, code, internal_code), creator:profiles!inventory_requests_created_by_fkey(full_name), approver_l1:profiles!inventory_requests_approved_by_l1_fkey(full_name), approver_l2:profiles!inventory_requests_approved_by_l2_fkey(full_name)')
                .order('created_at', { ascending: false });
            
            if (err) {
                console.warn('Fetch requests error:', err);
                const { data: simpleData } = await supabase
                    .from('inventory_requests')
                    .select('*, inventory_request_items(*)')
                    .order('created_at', { ascending: false });
                return simpleData || [];
            }
            return data || [];
        },
        staleTime: 5 * 60 * 1000,
    });

    const handleApproveL1 = async (id) => {
        setProcessing(true);
        try {
            await approveRequestL1(id);
            success('Đã duyệt đề nghị VT (Cấp 1)');
            fetchRequests();
        } catch (e) { toastError('Lỗi duyệt: ' + e.message); }
        finally { setProcessing(false); }
    };

    const handleApproveL2 = async (id) => {
        setProcessing(true);
        try {
            await approveRequestL2(id);
            success('Đã duyệt đề nghị VT (Cấp 2) — Sẵn sàng tạo PO');
            fetchRequests();
        } catch (e) { toastError('Lỗi duyệt: ' + e.message); }
        finally { setProcessing(false); }
    };

    const handleReject = async () => {
        if (!rejectReason.trim()) { toastError('Vui lòng nhập lý do từ chối'); return; }
        setProcessing(true);
        const req = requests.find(r => r.id === rejectModalId);
        try {
            await rejectRequest(rejectModalId, rejectReason, req.status);
            success('Đã từ chối đề nghị VT');
            setRejectModalId(null);
            setRejectReason('');
            fetchRequests();
        } catch (e) { toastError('Lỗi: ' + e.message); }
        finally { setProcessing(false); }
    };

    const filteredRequests = requests.filter(r => filterStatus === 'all' || r.status === filterStatus);

    const canApproveL1 = roleCode === 'ROLE07' || roleCode === 'ROLE01';
    const canApproveL2 = roleCode === 'ROLE04' || roleCode === 'ROLE01';

    if (loading) return <div className="p-12 text-center text-slate-500 animate-pulse">Đang tải danh sách đề nghị...</div>;

    return (
        <div className="space-y-5 animate-fade-in">
            {/* Filter Tabs + Create Button */}
            <div className="flex flex-wrap justify-between items-center gap-3">
                <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200 overflow-x-auto">
                    {[
                        { key: 'all', label: 'Tất cả', count: requests.length },
                        { key: 'PENDING_L1', label: 'Chờ L1', count: requests.filter(r => r.status === 'PENDING_L1').length },
                        { key: 'PENDING_L2', label: 'Chờ L2', count: requests.filter(r => r.status === 'PENDING_L2').length },
                        { key: 'APPROVED', label: 'Đã duyệt', count: requests.filter(r => r.status === 'APPROVED').length },
                        { key: 'REJECTED', label: 'Từ chối', count: requests.filter(r => r.status?.startsWith('REJECTED')).length },
                    ].map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setFilterStatus(tab.key === 'REJECTED' ? 'REJECTED' : tab.key)}
                            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-1.5 ${
                                filterStatus === tab.key ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                            }`}
                        >
                            {tab.label}
                            {tab.count > 0 && <span className="bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded-full text-[9px]">{tab.count}</span>}
                        </button>
                    ))}
                </div>
                <button
                    onClick={onCreateNew}
                    className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-2xl text-[11px] uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95 transition-all shrink-0"
                >
                    <span className="material-symbols-outlined text-[18px]">add_circle</span>
                    Tạo đề nghị
                </button>
            </div>

            {/* Request Cards */}
            {filteredRequests.length === 0 ? (
                <div className="text-center py-20 text-slate-400">
                    <span className="material-symbols-outlined text-5xl mb-3 block">inbox</span>
                    <p className="font-bold text-sm">Không có đề nghị nào</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredRequests.map(req => {
                        const statusCfg = STATUS_CONFIG[req.status] || STATUS_CONFIG['DRAFT'];
                        const isExpanded = expandedId === req.id;
                        const urgCfg = URGENCY_MAP[req.urgency] || URGENCY_MAP['NORMAL'];
                        const itemCount = req.inventory_request_items?.length || 0;
                        const projectName = req.projects?.internal_code || req.projects?.code || '';

                        return (
                            <div key={req.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-all overflow-hidden">
                                {/* Card Header */}
                                <div
                                    className="p-4 cursor-pointer"
                                    onClick={() => setExpandedId(isExpanded ? null : req.id)}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 ${statusCfg.color}`}>
                                                <span className="material-symbols-outlined text-[20px]">{statusCfg.icon}</span>
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">{req.code}</h4>
                                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${statusCfg.color}`}>{statusCfg.label}</span>
                                                    {req.urgency && req.urgency !== 'NORMAL' && (
                                                        <span className={`text-[9px] font-black uppercase ${urgCfg.color} flex items-center gap-0.5`}>
                                                            <span className="material-symbols-outlined text-[12px]">priority_high</span>{urgCfg.label}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500">
                                                    {projectName && <span className="font-bold text-orange-600">{projectName}</span>}
                                                    <span>{itemCount} vật tư</span>
                                                    <span>{timeAgo(req.created_at)}</span>
                                                    {req.creator?.full_name && <span>bởi {req.creator.full_name}</span>}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                            {/* Approve/Reject Buttons */}
                                            {req.status === 'PENDING_L1' && canApproveL1 && (
                                                <>
                                                    <button onClick={(e) => { e.stopPropagation(); handleApproveL1(req.id); }} disabled={processing} className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-[10px] uppercase tracking-wider flex items-center gap-1 transition-all shadow-sm disabled:opacity-50">
                                                        <span className="material-symbols-outlined text-[14px]">check</span>Duyệt L1
                                                    </button>
                                                    <button onClick={(e) => { e.stopPropagation(); setRejectModalId(req.id); }} className="px-3 py-1.5 bg-slate-100 hover:bg-red-100 text-slate-500 hover:text-red-600 font-bold rounded-xl text-[10px] uppercase tracking-wider flex items-center gap-1 transition-all">
                                                        <span className="material-symbols-outlined text-[14px]">close</span>Từ chối
                                                    </button>
                                                </>
                                            )}
                                            {req.status === 'PENDING_L2' && canApproveL2 && (
                                                <>
                                                    <button onClick={(e) => { e.stopPropagation(); handleApproveL2(req.id); }} disabled={processing} className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl text-[10px] uppercase tracking-wider flex items-center gap-1 transition-all shadow-sm disabled:opacity-50">
                                                        <span className="material-symbols-outlined text-[14px]">check</span>Duyệt L2
                                                    </button>
                                                    <button onClick={(e) => { e.stopPropagation(); setRejectModalId(req.id); }} className="px-3 py-1.5 bg-slate-100 hover:bg-red-100 text-slate-500 hover:text-red-600 font-bold rounded-xl text-[10px] uppercase tracking-wider flex items-center gap-1 transition-all">
                                                        <span className="material-symbols-outlined text-[14px]">close</span>Từ chối
                                                    </button>
                                                </>
                                            )}
                                            <span className={`material-symbols-outlined text-[20px] text-slate-300 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>expand_more</span>
                                        </div>
                                    </div>

                                    {/* Progress Steps (compact) */}
                                    {statusCfg.step >= 0 && (
                                        <div className="flex items-center gap-1 mt-3 ml-[52px]">
                                            {STEPS.map((step, i) => (
                                                <React.Fragment key={i}>
                                                    <div className={`flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider ${i <= statusCfg.step ? 'text-emerald-600' : 'text-slate-300'}`}>
                                                        <span className="material-symbols-outlined text-[14px]">{i < statusCfg.step ? 'check_circle' : i === statusCfg.step ? step.icon : 'radio_button_unchecked'}</span>
                                                        <span className="hidden sm:inline">{step.label}</span>
                                                    </div>
                                                    {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 rounded-full max-w-[40px] ${i < statusCfg.step ? 'bg-emerald-400' : 'bg-slate-200'}`} />}
                                                </React.Fragment>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Expanded: Items + Details */}
                                {isExpanded && (
                                    <div className="border-t border-slate-100 bg-slate-50/50 p-4 space-y-3 animate-slide-down">
                                        {/* Rejection Info */}
                                        {req.status?.startsWith('REJECTED') && req.rejection_reason && (
                                            <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
                                                <span className="material-symbols-outlined text-red-500 text-[18px] mt-0.5">error</span>
                                                <div>
                                                    <p className="text-[10px] font-black uppercase text-red-600 mb-0.5">Lý do từ chối</p>
                                                    <p className="text-xs text-red-700">{req.rejection_reason}</p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Approval Trail */}
                                        <div className="flex flex-wrap gap-4 text-[10px] text-slate-500">
                                            {req.approver_l1?.full_name && (
                                                <div className="flex items-center gap-1">
                                                    <span className="material-symbols-outlined text-emerald-500 text-[14px]">verified</span>
                                                    <span>L1: {req.approver_l1.full_name}</span>
                                                    {req.approved_at_l1 && <span className="text-slate-400">({new Date(req.approved_at_l1).toLocaleDateString('vi-VN')})</span>}
                                                </div>
                                            )}
                                            {req.approver_l2?.full_name && (
                                                <div className="flex items-center gap-1">
                                                    <span className="material-symbols-outlined text-blue-500 text-[14px]">fact_check</span>
                                                    <span>L2: {req.approver_l2.full_name}</span>
                                                    {req.approved_at_l2 && <span className="text-slate-400">({new Date(req.approved_at_l2).toLocaleDateString('vi-VN')})</span>}
                                                </div>
                                            )}
                                        </div>

                                        {/* Items Table */}
                                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                                            <table className="w-full text-left">
                                                <thead className="bg-slate-50 text-[9px] font-black uppercase text-slate-400 tracking-widest">
                                                    <tr>
                                                        <th className="px-3 py-2">#</th>
                                                        <th className="px-3 py-2">Vật tư</th>
                                                        <th className="px-3 py-2 text-center">SL yêu cầu</th>
                                                        <th className="px-3 py-2">ĐVT</th>
                                                        <th className="px-3 py-2">Ghi chú</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {req.inventory_request_items?.map((item, idx) => (
                                                        <tr key={item.id} className="text-xs hover:bg-slate-50 transition-colors">
                                                            <td className="px-3 py-2 text-slate-400 font-bold">{idx + 1}</td>
                                                            <td className="px-3 py-2 font-bold text-slate-700">{item.product_name || item.material_name_manual || 'Vật tư'}</td>
                                                            <td className="px-3 py-2 text-center font-black text-slate-900">{item.quantity}</td>
                                                            <td className="px-3 py-2 text-slate-500">{item.unit || item.uom || '-'}</td>
                                                            <td className="px-3 py-2 text-slate-400 italic">{item.note || '-'}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>

                                        {req.notes && (
                                            <div className="bg-white rounded-xl border border-dashed border-slate-200 p-3 text-xs text-slate-500 flex items-start gap-2">
                                                <span className="material-symbols-outlined text-[16px] text-slate-400 shrink-0">sticky_note_2</span>
                                                <div><span className="font-black text-[9px] uppercase text-slate-400 block mb-0.5">Mục đích</span>{req.notes}</div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Reject Modal */}
            {rejectModalId && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4" onClick={() => setRejectModalId(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                                <span className="material-symbols-outlined text-red-500 text-[20px]">block</span>
                            </div>
                            <div>
                                <h3 className="text-base font-black text-slate-800">Từ chối đề nghị</h3>
                                <p className="text-[11px] text-slate-500">Vui lòng nhập lý do từ chối</p>
                            </div>
                        </div>
                        <textarea
                            value={rejectReason}
                            onChange={e => setRejectReason(e.target.value)}
                            placeholder="Lý do từ chối (bắt buộc)..."
                            className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none min-h-[100px] resize-none"
                            autoFocus
                        />
                        <div className="flex justify-end gap-3">
                            <button onClick={() => { setRejectModalId(null); setRejectReason(''); }} className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl text-sm transition-all">
                                Hủy
                            </button>
                            <button onClick={handleReject} disabled={processing} className="px-5 py-2 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-red-500/20 disabled:opacity-50 flex items-center gap-2">
                                {processing ? 'Đang xử lý...' : <><span className="material-symbols-outlined text-[16px]">send</span>Xác nhận từ chối</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
