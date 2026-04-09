import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../context/ToastContext';
import { Project } from '../types/database';
import { fmt } from './documentTracking/dtkHelpers';

interface WarrantyProject extends Project {
    partners?: { name: string; short_name: string; code: string };
    warranty_collected?: boolean; // mapped from DB is_warranty_collected
    calculated_warranty_amount: number;
    warranty_end_date: Date | null;
    days_remaining: number;
    warranty_status_badge: { label: string; color: string; icon: string };
    warranty_duration_months?: number;
    warranty_percentage?: number;
    has_warranty_guarantee?: boolean;
    handover_date?: string | null;
}

export default function WarrantyTracking() {
    const [projects, setProjects] = useState<WarrantyProject[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'expired' | 'collected'>('all');
    
    // Inline editing states
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({ handover_date: '', warranty_duration_months: '', warranty_percentage: '' });
    
    // Add-warranty modal states
    const [showAddModal, setShowAddModal] = useState(false);
    const [availableProjects, setAvailableProjects] = useState<any[]>([]);
    const [loadingProjects, setLoadingProjects] = useState(false);
    const [projectSearch, setProjectSearch] = useState('');
    const [addForm, setAddForm] = useState({
        project_id: '',
        project_label: '',
        handover_date: new Date().toISOString().split('T')[0],
        warranty_duration_months: '12',
        warranty_percentage: '5',
        has_warranty_guarantee: false
    });
    const [savingAdd, setSavingAdd] = useState(false);
    
    const toast = useToast();

    const fetchWarrantyData = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('projects')
                .select(`
                    id, code, internal_code, name, status,
                    handover_date, has_warranty_guarantee, 
                    warranty_duration_months, warranty_percentage, 
                    total_value_post_vat, is_warranty_collected, acting_entity_key,
                    partners!projects_partner_id_fkey(name, short_name, code)
                `)
                .or('warranty_percentage.gt.0,has_warranty_guarantee.eq.true')
                .not('handover_date', 'is', null);

            if (error) throw error;

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const processed: WarrantyProject[] = (data || []).map((p: any) => {
                const amount = (Number(p.total_value_post_vat) || 0) * ((Number(p.warranty_percentage) || 0) / 100);
                
                let endDate = null;
                let daysRem = 9999;
                if (p.handover_date && p.warranty_duration_months) {
                    endDate = new Date(p.handover_date);
                    // Add months to handover date
                    endDate.setMonth(endDate.getMonth() + Number(p.warranty_duration_months));
                    daysRem = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
                }

                let badge = { label: 'Đang bảo hành', color: 'bg-emerald-50 text-emerald-600 border-emerald-200', icon: 'verified_user' };
                if (p.is_warranty_collected) {
                    badge = { label: 'Đã thu hồi', color: 'bg-slate-100 text-slate-500 border-slate-200', icon: 'task_alt' };
                } else if (daysRem <= 0) {
                    badge = { label: 'Quá hạn thu', color: 'bg-rose-50 text-rose-600 border-rose-200 font-black', icon: 'warning' };
                } else if (daysRem <= 30) {
                    badge = { label: 'Sắp đến hạn', color: 'bg-amber-50 text-amber-600 border-amber-200 font-bold', icon: 'alarm' };
                }

                return {
                    ...p,
                    warranty_collected: p.is_warranty_collected,
                    calculated_warranty_amount: amount,
                    warranty_end_date: endDate,
                    days_remaining: daysRem,
                    warranty_status_badge: badge
                };
            }).sort((a, b) => a.days_remaining - b.days_remaining);

            setProjects(processed);
        } catch (err: any) {
            toast.error('Lỗi tải dữ liệu: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchWarrantyData();
    }, []);

    // Fetch projects eligible for warranty registration (no handover_date yet)
    const fetchAvailableProjects = async () => {
        setLoadingProjects(true);
        try {
            const { data, error } = await supabase
                .from('projects')
                .select('id, code, internal_code, name, total_value_post_vat, partners!projects_partner_id_fkey(short_name)')
                .is('handover_date', null)
                .order('code', { ascending: true });

            if (error) throw error;
            setAvailableProjects(data || []);
        } catch (err: any) {
            toast.error('Lỗi tải danh sách dự án: ' + err.message);
        } finally {
            setLoadingProjects(false);
        }
    };

    const handleOpenAddModal = () => {
        setAddForm({
            project_id: '',
            project_label: '',
            handover_date: new Date().toISOString().split('T')[0],
            warranty_duration_months: '12',
            warranty_percentage: '5',
            has_warranty_guarantee: false
        });
        setProjectSearch('');
        setShowAddModal(true);
        fetchAvailableProjects();
    };

    const handleSaveAdd = async () => {
        if (!addForm.project_id) {
            toast.error('Vui lòng chọn dự án!');
            return;
        }
        if (!addForm.handover_date) {
            toast.error('Vui lòng nhập ngày bàn giao!');
            return;
        }
        setSavingAdd(true);
        try {
            const { error } = await supabase
                .from('projects')
                .update({
                    handover_date: addForm.handover_date,
                    warranty_duration_months: Number(addForm.warranty_duration_months) || 12,
                    warranty_percentage: Number(addForm.warranty_percentage) || 5,
                    has_warranty_guarantee: addForm.has_warranty_guarantee
                })
                .eq('id', addForm.project_id);

            if (error) throw error;
            toast.success(`Đã ghi nhận bảo hành cho dự án ${addForm.project_label}`);
            setShowAddModal(false);
            fetchWarrantyData();
        } catch (err: any) {
            toast.error('Lỗi lưu: ' + err.message);
        } finally {
            setSavingAdd(false);
        }
    };

    const filteredAvailableProjects = useMemo(() => {
        if (!projectSearch.trim()) return availableProjects;
        const q = projectSearch.toLowerCase();
        return availableProjects.filter((p: any) =>
            (p.code || '').toLowerCase().includes(q) ||
            (p.internal_code || '').toLowerCase().includes(q) ||
            (p.name || '').toLowerCase().includes(q) ||
            (p.partners?.short_name || '').toLowerCase().includes(q)
        );
    }, [availableProjects, projectSearch]);

    const handleMarkCollected = async (id: string, currentStatus: boolean, code: string) => {
        try {
            const { error } = await supabase
                .from('projects')
                .update({ is_warranty_collected: !currentStatus })
                .eq('id', id);

            if (error) {
                if (error.message.includes('is_warranty_collected')) {
                    toast.error('LỖI CSDL: Thiếu cột "is_warranty_collected". Vui lòng chạy lại file SQL setup!');
                    return;
                }
                throw error;
            }

            toast.success(`Đã cập nhật trạng thái thu hồi dự án ${code}`);
            fetchWarrantyData();
        } catch (err: any) {
            toast.error('Lỗi cập nhật: ' + err.message);
        }
    };

    const startEdit = (item: WarrantyProject) => {
        setEditingId(item.id);
        const ltzOffset = (new Date()).getTimezoneOffset() * 60000;
        setEditForm({
            handover_date: item.handover_date ? new Date(new Date(item.handover_date).getTime() - ltzOffset).toISOString().split('T')[0] : '',
            warranty_duration_months: item.warranty_duration_months?.toString() || '12',
            warranty_percentage: item.warranty_percentage?.toString() || '5'
        });
    };

    const handleSaveEdit = async () => {
        if (!editingId) return;
        try {
            const { error } = await supabase
                .from('projects')
                .update({
                    handover_date: editForm.handover_date || null,
                    warranty_duration_months: Number(editForm.warranty_duration_months) || 0,
                    warranty_percentage: Number(editForm.warranty_percentage) || 0
                })
                .eq('id', editingId);

            if (error) throw error;
            toast.success("Đã cập nhật thông số bảo hành");
            setEditingId(null);
            fetchWarrantyData();
        } catch (err: any) {
            toast.error("Lỗi lưu dữ liệu: " + err.message);
        }
    };


    const filtered = useMemo(() => {
        return projects.filter(p => {
            const matchSearch = String(p.code || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                                String(p.internal_code || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                                String(p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                                String(p.partners?.short_name || '').toLowerCase().includes(searchTerm.toLowerCase());
            
            let matchTab = true;
            if (activeTab === 'collected') matchTab = !!p.warranty_collected;
            if (activeTab === 'pending') matchTab = !p.warranty_collected && p.days_remaining > 0;
            if (activeTab === 'expired') matchTab = !p.warranty_collected && p.days_remaining <= 0;

            return matchSearch && matchTab;
        });
    }, [projects, searchTerm, activeTab]);

    // KPI Calcs
    const kpi = useMemo(() => {
        let activeHolding = 0;
        let expiredUncollected = 0;
        let totalCollected = 0;

        projects.forEach(p => {
            if (p.warranty_collected) {
                totalCollected += p.calculated_warranty_amount;
            } else {
                activeHolding += p.calculated_warranty_amount;
                if (p.days_remaining <= 0) {
                    expiredUncollected += p.calculated_warranty_amount;
                }
            }
        });

        return { activeHolding, expiredUncollected, totalCollected };
    }, [projects]);

    return (
        <div className="p-6 max-w-[1600px] mx-auto animate-fade-in space-y-6">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-50 rounded-full -mr-16 -mt-16 opacity-50"></div>
                
                <div className="relative z-10">
                    <h1 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                        <span className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-white shadow-lg shadow-amber-200">
                            <span className="material-symbols-outlined notranslate" translate="no">security</span>
                        </span>
                        Theo dõi Tiền Bảo hành
                    </h1>
                    <p className="text-slate-500 text-sm mt-1 font-medium italic">Quản lý và cảnh báo thời hạn thu hồi 5% bảo hành các dự án đã bàn giao</p>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto relative z-10">
                    <div className="relative flex-1 md:w-64">
                         <span className="material-symbols-outlined notranslate absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]" translate="no">search</span>
                         <input 
                            type="text" 
                            placeholder="Mã dự án, tên CĐT..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-amber-500 outline-none transition-all text-sm font-medium bg-slate-50/50"
                         />
                    </div>
                    <button onClick={handleOpenAddModal} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm shadow-lg shadow-amber-500/20 transition-all active:scale-95" title="Ghi nhận bảo hành cho dự án mới">
                         <span className="material-symbols-outlined notranslate text-[18px]" translate="no">add_circle</span>
                         <span className="hidden sm:inline">Ghi nhận BH</span>
                    </button>
                    <button onClick={fetchWarrantyData} className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors text-slate-600 bg-white shadow-sm">
                         <span className="material-symbols-outlined notranslate block" translate="no">refresh</span>
                    </button>
                </div>
            </header>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-blue-50 rounded-bl-full -tr-8 transition-transform group-hover:scale-110"></div>
                    <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                        Tổng tiền đang bị giữ
                    </p>
                    <p className="text-3xl font-black text-blue-700 tabular-nums">
                        {fmt(kpi.activeHolding)} <span className="text-sm text-blue-400">₫</span>
                    </p>
                 </div>
                 
                 <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-rose-50 rounded-bl-full -tr-8 transition-transform group-hover:scale-110"></div>
                    <p className="text-xs font-black text-rose-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                        Đã tới hạn thu hồi
                    </p>
                    <p className="text-3xl font-black text-rose-700 tabular-nums">
                        {fmt(kpi.expiredUncollected)} <span className="text-sm text-rose-400">₫</span>
                    </p>
                 </div>
                 
                 <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-50 rounded-bl-full -tr-8 transition-transform group-hover:scale-110"></div>
                    <p className="text-xs font-black text-emerald-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                        Tổng đã thu xong
                    </p>
                    <p className="text-3xl font-black text-emerald-700 tabular-nums">
                        {fmt(kpi.totalCollected)} <span className="text-sm text-emerald-400 ml-1">₫</span>
                    </p>
                 </div>
            </div>

            {/* Tabs Navigation */}
            <div className="flex items-center gap-1 bg-slate-100 p-1.5 rounded-2xl w-full md:w-fit border border-slate-200 shadow-inner overflow-x-auto">
                {[
                    { id: 'all', label: 'Tất cả Dự án', icon: 'format_list_bulleted' },
                    { id: 'pending', label: 'Đang bảo hành', icon: 'timelapse' },
                    { id: 'expired', label: 'Quá hạn thu (Còn nợ)', icon: 'notification_important' },
                    { id: 'collected', label: 'Đã hoàn tất thu', icon: 'task' },
                ].map(tab => (
                    <button 
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm transition-all whitespace-nowrap ${
                            activeTab === tab.id 
                            ? (tab.id === 'expired' ? 'bg-rose-500 text-white font-black shadow-md' : 'bg-white text-amber-700 font-black shadow-sm ring-1 ring-slate-200')
                            : 'text-slate-500 font-bold hover:text-slate-700 hover:bg-slate-200/50'
                        }`}
                    >
                        <span className="material-symbols-outlined notranslate text-[20px]" translate="no">{tab.icon}</span>
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[400px]">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-xs font-black text-slate-500 uppercase tracking-wider">
                                <th className="px-5 py-4 whitespace-nowrap">Dự án</th>
                                <th className="px-5 py-4 whitespace-nowrap">CĐT</th>
                                <th className="px-5 py-4 whitespace-nowrap">Nghiệm thu / Hết hạn</th>
                                <th className="px-5 py-4 whitespace-nowrap text-right">Tỷ lệ</th>
                                <th className="px-5 py-4 whitespace-nowrap text-right text-amber-700">Giá trị BH (VNĐ)</th>
                                <th className="px-5 py-4 whitespace-nowrap text-center">Tình trạng</th>
                                <th className="px-5 py-4 whitespace-nowrap text-center">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                [1, 2, 3].map(i => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={7} className="px-6 py-5"><div className="h-10 bg-slate-100 rounded-xl"></div></td>
                                    </tr>
                                ))
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-24 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300">
                                                <span className="material-symbols-outlined notranslate text-4xl" translate="no">security</span>
                                            </div>
                                            <p className="text-slate-500 font-bold">Chưa có dữ liệu bảo hành phù hợp</p>
                                        </div>
                                    </td>
                                </tr>
                             ) : filtered.map((item) => (
                                  <tr key={item.id} className={`hover:bg-amber-50/30 transition-colors ${item.days_remaining <= 0 && !item.warranty_collected ? 'bg-rose-50/20' : ''}`}>
                                       <td className="px-5 py-4">
                                            <div className="flex flex-col">
                                                <span className="font-black text-slate-800 uppercase text-sm">{item.internal_code || item.code}</span>
                                                <span className="text-[11px] font-bold text-slate-400 mt-0.5 max-w-[200px] truncate">{item.name}</span>
                                            </div>
                                       </td>
                                       <td className="px-5 py-4">
                                            <span className="font-black text-slate-600 uppercase">{item.partners?.short_name || item.partners?.code || '---'}</span>
                                       </td>
                                       <td className="px-5 py-4">
                                            {editingId === item.id ? (
                                                <div className="flex flex-col gap-2">
                                                    <input 
                                                        type="date" 
                                                        value={editForm.handover_date} 
                                                        onChange={e => setEditForm({...editForm, handover_date: e.target.value})}
                                                        className="px-2 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                                                        title="Ngày bàn giao / Nghiệm thu"
                                                    />
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-[10px] text-slate-500 font-bold uppercase">Thời gian BH:</span>
                                                        <input 
                                                            type="number" 
                                                            value={editForm.warranty_duration_months} 
                                                            onChange={e => setEditForm({...editForm, warranty_duration_months: e.target.value})}
                                                            placeholder="Tháng"
                                                            className="px-2 py-1.5 text-xs font-bold text-center text-slate-700 bg-white border border-slate-300 rounded shadow-sm w-16 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                                                        />
                                                        <span className="text-[10px] text-slate-500 font-bold uppercase">Tháng</span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-xs text-slate-500 font-medium">Bắt đầu: <span className="font-bold text-slate-700">{item.handover_date ? new Date(item.handover_date).toLocaleDateString('vi-VN') : '---'}</span></span>
                                                    <span className="text-xs text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded-md w-fit inline-flex items-center gap-1 border border-amber-100/50">
                                                        Kết thúc: {item.warranty_end_date ? item.warranty_end_date.toLocaleDateString('vi-VN') : '---'}
                                                        <span className="text-[10px] text-amber-600/70 ml-1">({item.warranty_duration_months}T)</span>
                                                    </span>
                                                </div>
                                            )}
                                       </td>
                                       <td className="px-5 py-4 text-right">
                                            {editingId === item.id ? (
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <input 
                                                        type="number" 
                                                        step="0.1"
                                                        value={editForm.warranty_percentage} 
                                                        onChange={e => setEditForm({...editForm, warranty_percentage: e.target.value})}
                                                        className="px-2 py-1.5 text-xs font-black text-slate-700 bg-white border border-slate-300 rounded shadow-sm w-16 text-right outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                                                    />
                                                    <span className="text-xs font-black text-slate-500">%</span>
                                                </div>
                                            ) : (
                                                <span className="text-sm font-black text-slate-700">{item.warranty_percentage}%</span>
                                            )}
                                       </td>
                                       <td className="px-5 py-4 text-right">
                                           <span className="text-base font-black text-amber-600 tabular-nums select-all">{fmt(item.calculated_warranty_amount)}</span>
                                           {item.has_warranty_guarantee && (
                                               <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1"><span className="material-symbols-outlined text-[10px] inline align-text-bottom">verified</span> Chứng thư</p>
                                           )}
                                       </td>
                                       <td className="px-5 py-4 text-center">
                                            <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${item.warranty_status_badge.color}`}>
                                                <span className="material-symbols-outlined text-[14px]" translate="no">{item.warranty_status_badge.icon}</span>
                                                <span className="text-[10px] font-black uppercase tracking-widest">{item.warranty_status_badge.label}</span>
                                            </div>
                                            {!item.warranty_collected && item.days_remaining > 0 && (
                                                <p className={`text-[10px] font-bold mt-1.5 ${item.days_remaining <= 30 ? 'text-amber-600' : 'text-slate-400'}`}>Còn {item.days_remaining} ngày</p>
                                            )}
                                            {!item.warranty_collected && item.days_remaining <= 0 && (
                                                <p className="text-[10px] font-black mt-1.5 text-rose-600">Trễ {Math.abs(item.days_remaining)} ngày</p>
                                            )}
                                       </td>
                                       <td className="px-5 py-4 text-center">
                                            {editingId === item.id ? (
                                                <div className="flex flex-col items-center justify-center gap-2">
                                                    <button onClick={handleSaveEdit} className="w-full px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-bold text-xs flex items-center justify-center gap-1 shadow-sm shadow-blue-500/30 transition-all active:scale-95" title="Lưu thông số">
                                                        <span className="material-symbols-outlined text-[16px]">save</span> Lưu
                                                    </button>
                                                    <button onClick={() => setEditingId(null)} className="w-full px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 font-bold text-xs flex items-center justify-center gap-1 transition-all active:scale-95" title="Hủy bỏ">
                                                        <span className="material-symbols-outlined text-[16px]">close</span> Hủy
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-center gap-3">
                                                    <button onClick={() => startEdit(item)} className="p-2 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Cập nhật Ngày bàn giao / Tỷ lệ BH">
                                                        <span className="material-symbols-outlined text-[20px]" translate="no">edit</span>
                                                    </button>
                                                    <button 
                                                        onClick={() => handleMarkCollected(item.id, !!item.warranty_collected, item.internal_code || item.code)}
                                                        className={`px-4 py-2 rounded-xl text-xs font-black transition-all shadow-sm flex items-center justify-center gap-1.5 ${
                                                            item.warranty_collected 
                                                            ? 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700' 
                                                            : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20 hover:shadow-md'
                                                        }`}
                                                    >
                                                        {item.warranty_collected ? (
                                                            <>
                                                                <span className="material-symbols-outlined text-[16px]" translate="no">undo</span>
                                                                Huỷ Thu
                                                            </>
                                                        ) : (
                                                            <>
                                                                <span className="material-symbols-outlined text-[16px]" translate="no">payments</span>
                                                                Đã Thu
                                                            </>
                                                        )}
                                                    </button>
                                                </div>
                                            )}
                                       </td>
                                  </tr>
                              ))}
                         </tbody>
                     </table>
                 </div>
                 
                 <div className="p-4 bg-amber-50/50 border-t border-slate-100 flex items-start gap-3">
                     <span className="material-symbols-outlined text-amber-500" translate="no">info</span>
                     <div>
                         <p className="text-xs font-medium text-slate-600 leading-relaxed mb-1">
                             Dữ liệu trên phụ thuộc vào <span className="font-bold text-slate-800">Ngày Bàn giao</span>, <span className="font-bold text-slate-800">Thời gian BH</span> và <span className="font-bold text-slate-800">Tỷ lệ %</span>. 
                             Bạn có thể click vào biểu tượng <span className="material-symbols-outlined text-[14px] align-middle text-blue-500 mx-0.5">edit</span> ở cột Thao tác để <strong>nhập và cập nhật nhanh</strong> các thông số này ngay tại đây.
                         </p>
                     </div>
                 </div>
             </div>
            {/* ══════ MODAL: Ghi nhận Bảo hành ══════ */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowAddModal(false)}>
                    <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-slide-in" onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-amber-50 to-white">
                            <div>
                                <h3 className="font-black text-lg text-slate-800 flex items-center gap-2">
                                    <span className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center text-white shadow-sm">
                                        <span className="material-symbols-outlined text-[18px]" translate="no">add_task</span>
                                    </span>
                                    Ghi nhận Bảo hành
                                </h3>
                                <p className="text-xs text-slate-500 mt-1 font-medium">Chọn dự án đã bàn giao và nhập thông tin bảo hành</p>
                            </div>
                            <button onClick={() => setShowAddModal(false)} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors">
                                <span className="material-symbols-outlined text-[18px]">close</span>
                            </button>
                        </div>

                        {/* Body */}
                        <div className="px-6 py-5 space-y-5">
                            {/* Project Selector */}
                            <div>
                                <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">Chọn Dự án</label>
                                {addForm.project_id ? (
                                    <div className="flex items-center justify-between p-3 bg-amber-50 rounded-xl border border-amber-200">
                                        <div>
                                            <p className="font-black text-slate-800 text-sm">{addForm.project_label}</p>
                                        </div>
                                        <button onClick={() => setAddForm({...addForm, project_id: '', project_label: ''})} className="text-slate-400 hover:text-rose-500 transition-colors">
                                            <span className="material-symbols-outlined text-[18px]">close</span>
                                        </button>
                                    </div>
                                ) : (
                                    <div>
                                        <div className="relative mb-2">
                                            <span className="material-symbols-outlined notranslate absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[16px]" translate="no">search</span>
                                            <input
                                                type="text"
                                                placeholder="Tìm theo mã, tên dự án..."
                                                value={projectSearch}
                                                onChange={e => setProjectSearch(e.target.value)}
                                                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 focus:border-amber-500 outline-none text-sm font-medium bg-slate-50/50 transition-all"
                                                autoFocus
                                            />
                                        </div>
                                        <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-200 bg-white divide-y divide-slate-50">
                                            {loadingProjects ? (
                                                <div className="flex items-center justify-center py-6 text-slate-400">
                                                    <span className="material-symbols-outlined animate-spin text-[20px] mr-2">progress_activity</span>
                                                    <span className="text-xs font-bold">Đang tải...</span>
                                                </div>
                                            ) : filteredAvailableProjects.length === 0 ? (
                                                <div className="py-6 text-center">
                                                    <span className="material-symbols-outlined text-3xl text-slate-200 mb-1 block">search_off</span>
                                                    <p className="text-xs font-bold text-slate-400">{availableProjects.length === 0 ? 'Tất cả dự án đã được ghi nhận bảo hành' : 'Không tìm thấy dự án phù hợp'}</p>
                                                </div>
                                            ) : filteredAvailableProjects.map((p: any) => (
                                                <button
                                                    key={p.id}
                                                    onClick={() => setAddForm({...addForm, project_id: p.id, project_label: `${p.internal_code || p.code} — ${p.name}`})}
                                                    className="w-full text-left px-4 py-3 hover:bg-amber-50 transition-colors flex items-center justify-between group"
                                                >
                                                    <div>
                                                        <p className="text-sm font-bold text-slate-800 group-hover:text-amber-700 transition-colors">{p.internal_code || p.code}</p>
                                                        <p className="text-[11px] text-slate-400 truncate max-w-[280px]">{p.name}</p>
                                                    </div>
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase">{p.partners?.short_name || ''}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Date + Duration + Percentage */}
                            <div className="grid grid-cols-3 gap-4">
                                <div className="col-span-3 sm:col-span-1">
                                    <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">Ngày Bàn giao</label>
                                    <input
                                        type="date"
                                        value={addForm.handover_date}
                                        onChange={e => setAddForm({...addForm, handover_date: e.target.value})}
                                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-amber-500 outline-none text-sm font-bold bg-white transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">Thời gian BH</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            min="1"
                                            value={addForm.warranty_duration_months}
                                            onChange={e => setAddForm({...addForm, warranty_duration_months: e.target.value})}
                                            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-amber-500 outline-none text-sm font-bold bg-white transition-all pr-14"
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400">tháng</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">Tỷ lệ BH</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            step="0.1"
                                            min="0"
                                            value={addForm.warranty_percentage}
                                            onChange={e => setAddForm({...addForm, warranty_percentage: e.target.value})}
                                            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-amber-500 outline-none text-sm font-bold bg-white transition-all pr-8"
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400">%</span>
                                    </div>
                                </div>
                            </div>

                            {/* Warranty Guarantee Toggle */}
                            <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={addForm.has_warranty_guarantee}
                                    onChange={e => setAddForm({...addForm, has_warranty_guarantee: e.target.checked})}
                                    className="w-4 h-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                                />
                                <div>
                                    <p className="text-sm font-bold text-slate-700">Có chứng thư bảo hành</p>
                                    <p className="text-[11px] text-slate-400">Bảo lãnh bảo hành từ ngân hàng hoặc tổ chức tín dụng</p>
                                </div>
                            </label>

                            {/* Preview */}
                            {addForm.project_id && addForm.handover_date && (
                                <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                                    <p className="text-[11px] font-bold text-blue-500 uppercase tracking-widest mb-1">Xem trước</p>
                                    <p className="text-xs text-slate-600">
                                        Hết hạn BH: <span className="font-black text-slate-800">
                                            {(() => {
                                                const d = new Date(addForm.handover_date);
                                                d.setMonth(d.getMonth() + (Number(addForm.warranty_duration_months) || 0));
                                                return d.toLocaleDateString('vi-VN');
                                            })()}
                                        </span>
                                        {' · '}Giữ lại <span className="font-black text-amber-600">{addForm.warranty_percentage}%</span> giá trị hợp đồng
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50">
                            <button onClick={() => setShowAddModal(false)} className="px-5 py-2.5 rounded-xl text-slate-600 font-semibold hover:bg-slate-100 transition-colors">
                                Hủy bỏ
                            </button>
                            <button
                                onClick={handleSaveAdd}
                                disabled={savingAdd || !addForm.project_id}
                                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold flex items-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {savingAdd ? (
                                    <span className="material-symbols-outlined animate-spin text-[18px]">sync</span>
                                ) : (
                                    <span className="material-symbols-outlined text-[18px]">check_circle</span>
                                )}
                                Ghi nhận Bảo hành
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
