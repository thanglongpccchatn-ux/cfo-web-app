import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useInventory } from '../../context/InventoryContext';
import { useToast } from '../../context/ToastContext';

export default function InventoryRequestList({ onCreateNew }) {
    const { warehouses } = useInventory();
    const { success, error } = useToast();
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState('all');

    const fetchRequests = async () => {
        setLoading(true);
        const { data, error: err } = await supabase
            .from('inventory_requests')
            .select('*, inventory_request_items(*)')
            .order('created_at', { ascending: false });
        
        if (err) error('Lỗi tải yêu cầu: ' + err.message);
        else setRequests(data || []);
        setLoading(false);
    };

    useEffect(() => {
        fetchRequests();
    }, []);

    const handleStatusUpdate = async (id, newStatus) => {
        const { error: err } = await supabase
            .from('inventory_requests')
            .update({ status: newStatus })
            .eq('id', id);
        
        if (err) error('Lỗi cập nhật: ' + err.message);
        else {
            success(`Đã ${newStatus === 'APPROVED' ? 'duyệt' : 'từ chối'} yêu cầu thành công`);
            fetchRequests();
        }
    };

    const getProjectName = (id) => warehouses.find(w => w.id === id)?.name || 'N/A';

    const filteredRequests = requests.filter(r => filterStatus === 'all' || r.status === filterStatus);

    const STATUS_MAP = {
        'PENDING': { label: 'Chờ duyệt', color: 'bg-amber-100 text-amber-700 border-amber-200' },
        'APPROVED': { label: 'Đã duyệt', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
        'REJECTED': { label: 'Từ chối', color: 'bg-red-100 text-red-700 border-red-200' }
    };

    if (loading) return <div className="p-12 text-center text-slate-500 animate-pulse">Đang tải danh sách yêu cầu...</div>;

    return (
        <div className="space-y-6 animate-fade-in px-2">
            <div className="flex justify-between items-center mb-4">
                <div className="flex gap-2 bg-slate-100 dark:bg-slate-900/50 p-1 rounded-2xl border border-slate-200 dark:border-slate-800">
                    {['all', 'PENDING', 'APPROVED', 'REJECTED'].map(s => (
                        <button 
                            key={s}
                            onClick={() => setFilterStatus(s)}
                            className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filterStatus === s ? 'bg-white dark:bg-slate-800 text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                        >
                            {s === 'all' ? 'Tất cả' : STATUS_MAP[s].label}
                        </button>
                    ))}
                </div>
                <button 
                    onClick={onCreateNew}
                    className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-2xl text-[11px] uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
                >
                    <span className="material-symbols-outlined text-[20px]">add_circle</span>
                    Tạo yêu cầu mới
                </button>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {filteredRequests.map(req => (
                    <div key={req.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-900 flex items-center justify-center border border-slate-200 dark:border-slate-800">
                                    <span className="material-symbols-outlined text-slate-400">description</span>
                                </div>
                                <div>
                                    <div className="flex items-center gap-3">
                                        <h4 className="text-lg font-black text-slate-800 dark:text-white tracking-tight uppercase">{req.number}</h4>
                                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase border ${STATUS_MAP[req.status]?.color}`}>
                                            {STATUS_MAP[req.status]?.label}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500 font-bold mt-0.5 flex items-center gap-1.5 uppercase tracking-wide">
                                        <span className="material-symbols-outlined text-[14px]">location_on</span>
                                        {getProjectName(req.project_id)}
                                    </p>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                                {req.status === 'PENDING' && (
                                    <>
                                        <button 
                                            onClick={() => handleStatusUpdate(req.id, 'APPROVED')}
                                            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-[10px] uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-lg shadow-emerald-500/10"
                                        >
                                            <span className="material-symbols-outlined text-[16px]">check_circle</span>
                                            Duyệt
                                        </button>
                                        <button 
                                            onClick={() => handleStatusUpdate(req.id, 'REJECTED')}
                                            className="px-4 py-2 bg-slate-100 hover:bg-red-100 text-slate-600 hover:text-red-600 font-bold rounded-xl text-[10px] uppercase tracking-wider flex items-center gap-1.5 transition-all"
                                        >
                                            <span className="material-symbols-outlined text-[16px]">cancel</span>
                                            Từ chối
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-4 mb-4">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="text-[9px] font-black uppercase text-slate-400 pb-2">
                                        <th className="px-2 py-1">Vật tư</th>
                                        <th className="px-2 py-1 text-center">Số lượng</th>
                                        <th className="px-2 py-1">ĐVT</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                    {req.inventory_request_items?.map(item => (
                                        <tr key={item.id} className="text-xs font-medium">
                                            <td className="px-2 py-2 text-slate-700 dark:text-slate-300 uppercase font-bold">{item.product_name || 'Vật tư'}</td>
                                            <td className="px-2 py-2 text-center font-black text-slate-900 dark:text-white uppercase leading-none">{item.quantity}</td>
                                            <td className="px-2 py-2 text-slate-400">{item.uom}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {req.notes && (
                            <div className="flex items-start gap-2 text-[11px] text-slate-500 bg-slate-100 dark:bg-slate-800/50 p-3 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                                <span className="material-symbols-outlined text-[16px] shrink-0 translate-y-0.5">sticky_note_2</span>
                                <div><span className="font-black uppercase text-[9px] block mb-0.5 text-slate-400">Ghi chú</span>{req.notes}</div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
