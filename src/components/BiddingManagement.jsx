import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import SkeletonLoader from './common/SkeletonLoader';
import { useAuth } from '../context/AuthContext';
import { smartToast } from '../utils/globalToast';
import { fmt, fmtDatePadded as fmtDate } from '../utils/formatters';

export default function BiddingManagement() {
    const { profile } = useAuth();
    const [bids, setBids] = useState([]);
    const [partners, setPartners] = useState([]);
    const [directors, setDirectors] = useState([]);       // Giám đốc → Người yêu cầu
    const [biddingStaff, setBiddingStaff] = useState([]); // Đấu thầu → Người phụ trách
    const [loading, setLoading] = useState(true);

    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const statusOptions = ['Theo dõi', 'Đang báo giá', 'Đã nộp', 'Trúng thầu', 'Trượt thầu', 'Hủy'];

    // Modal states
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingBid, setEditingBid] = useState(null);
    const [formData, setFormData] = useState({
        bid_code: '', requester: '', partner_id: '', du_an_id: '',
        location: '', investor: '', status: 'Theo dõi',
        assigned_to: '', change_description: '',
        price_before_vat: '', price_after_vat: '',
        total_cost_before_vat: '', total_cost_after_vat: '',
        rejection_reason: '', submission_deadline: '', result_date: '', notes: ''
    });

    // History modal
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [historyLogs, setHistoryLogs] = useState([]);
    const [selectedBidName, setSelectedBidName] = useState('');

    useEffect(() => {
        fetchData();
        const subscription = supabase
            .channel('public:bids')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'bids' }, () => fetchData())
            .subscribe();
        return () => supabase.removeChannel(subscription);
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [bidRes, partnerRes, profilesRes] = await Promise.all([
                supabase.from('bids').select('*, partners(name, code, short_name)').order('created_at', { ascending: false }),
                supabase.from('partners').select('id, name, code, short_name, type').or('type.eq.Client,type.eq.Subcontractor').order('name'),
                supabase.from('profiles').select('id, full_name, role_code, roles:role_code(name)').eq('status', 'Hoạt động').order('full_name')
            ]);
            setBids(bidRes.data || []);
            setPartners(partnerRes.data || []);

            // Lọc nhân viên theo role name
            const allProfiles = profilesRes.data || [];
            setDirectors(allProfiles.filter(p => p.roles?.name?.toLowerCase().includes('giám đốc')));
            setBiddingStaff(allProfiles.filter(p => p.roles?.name?.toLowerCase().includes('đấu thầu')));
        } catch (err) {
            console.error('Error fetching bids:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenForm = (bid = null) => {
        if (bid) {
            setEditingBid(bid);
            setFormData({
                bid_code: bid.bid_code || '',
                requester: bid.requester || '',
                partner_id: bid.partner_id || '',
                du_an_id: bid.du_an_id || '',
                location: bid.location || '',
                investor: bid.investor || '',
                status: bid.status || 'Theo dõi',
                assigned_to: bid.assigned_to || '',
                change_description: '',
                price_before_vat: bid.price_before_vat || '',
                price_after_vat: bid.price_after_vat || '',
                total_cost_before_vat: bid.total_cost_before_vat || '',
                total_cost_after_vat: bid.total_cost_after_vat || '',
                rejection_reason: bid.rejection_reason || '',
                submission_deadline: bid.submission_deadline ? bid.submission_deadline.split('T')[0] : '',
                result_date: bid.result_date ? bid.result_date.split('T')[0] : '',
                notes: bid.notes || ''
            });
        } else {
            setEditingBid(null);
            const nextCode = `BG-${new Date().getFullYear()}-${String(bids.length + 1).padStart(3, '0')}`;
            setFormData({
                bid_code: nextCode, requester: profile?.full_name || '', partner_id: '', du_an_id: '',
                location: '', investor: '', status: 'Theo dõi',
                assigned_to: profile?.full_name || '', change_description: '',
                price_before_vat: '', price_after_vat: '',
                total_cost_before_vat: '', total_cost_after_vat: '',
                rejection_reason: '', submission_deadline: '', result_date: '', notes: ''
            });
        }
        setIsFormOpen(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                bid_code: formData.bid_code,
                requester: formData.requester,
                partner_id: formData.partner_id || null,
                du_an_id: formData.du_an_id || null,
                location: formData.location,
                investor: formData.investor,
                status: formData.status,
                assigned_to: formData.assigned_to,
                change_description: formData.change_description || null,
                price_before_vat: parseFloat(formData.price_before_vat) || 0,
                price_after_vat: parseFloat(formData.price_after_vat) || 0,
                total_cost_before_vat: parseFloat(formData.total_cost_before_vat) || 0,
                total_cost_after_vat: parseFloat(formData.total_cost_after_vat) || 0,
                rejection_reason: formData.rejection_reason || null,
                submission_deadline: formData.submission_deadline || null,
                result_date: formData.result_date || null,
                notes: formData.notes || null,
                updated_at: new Date().toISOString()
            };

            if (editingBid) {
                const oldStatus = editingBid.status;
                const oldPriceBV = parseFloat(editingBid.price_before_vat) || 0;
                const oldPriceAV = parseFloat(editingBid.price_after_vat) || 0;
                const newPriceBV = parseFloat(formData.price_before_vat) || 0;
                const newPriceAV = parseFloat(formData.price_after_vat) || 0;
                const hasChanged = oldStatus !== formData.status || oldPriceBV !== newPriceBV || oldPriceAV !== newPriceAV;

                if (hasChanged && !formData.change_description?.trim()) {
                    smartToast('Vui lòng nhập nội dung thay đổi khi thay đổi giá hoặc trạng thái!');
                    return;
                }

                const newVersion = (editingBid.current_version || 0) + (hasChanged ? 1 : 0);
                payload.current_version = newVersion;

                const { error } = await supabase.from('bids').update(payload).eq('id', editingBid.id);
                if (error) throw error;

                if (hasChanged) {
                    await supabase.from('bid_versions').insert([{
                        bid_id: editingBid.id,
                        version_number: newVersion,
                        price_before_vat: newPriceBV,
                        price_after_vat: newPriceAV,
                        total_cost_before_vat: parseFloat(formData.total_cost_before_vat) || 0,
                        total_cost_after_vat: parseFloat(formData.total_cost_after_vat) || 0,
                        change_description: formData.change_description,
                        old_status: oldStatus,
                        new_status: formData.status,
                        changed_by: profile?.full_name || 'System'
                    }]);
                }
            } else {
                payload.current_version = 1;
                const { data, error } = await supabase.from('bids').insert([payload]).select().single();
                if (error) throw error;

                await supabase.from('bid_versions').insert([{
                    bid_id: data.id,
                    version_number: 1,
                    price_before_vat: parseFloat(formData.price_before_vat) || 0,
                    price_after_vat: parseFloat(formData.price_after_vat) || 0,
                    total_cost_before_vat: parseFloat(formData.total_cost_before_vat) || 0,
                    total_cost_after_vat: parseFloat(formData.total_cost_after_vat) || 0,
                    change_description: 'Khởi tạo báo giá',
                    old_status: null,
                    new_status: formData.status,
                    changed_by: profile?.full_name || 'System'
                }]);
            }

            setIsFormOpen(false);
            fetchData();
        } catch (err) {
            console.error('Lỗi lưu báo giá:', err);
            smartToast('Có lỗi xảy ra khi lưu: ' + err.message);
        }
    };

    const handleOpenHistory = async (bid) => {
        setSelectedBidName(`${bid.bid_code} — ${bid.investor || bid.du_an_id || 'N/A'}`);
        setIsHistoryOpen(true);
        setHistoryLogs([]);
        try {
            const { data, error } = await supabase
                .from('bid_versions')
                .select('*')
                .eq('bid_id', bid.id)
                .order('version_number', { ascending: false });
            if (error) throw error;
            setHistoryLogs(data || []);
        } catch (err) {
            console.error('Error fetching bid history:', err);
        }
    };

    // Helpers
    const fmtDateTime = (d) => { if (!d) return '-'; const dt = new Date(d); return `${fmtDate(d)} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`; };

    const getStatusColor = (s) => {
        switch (s) {
            case 'Theo dõi': return 'bg-slate-100 text-slate-600 border-slate-200';
            case 'Đang báo giá': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'Đã nộp': return 'bg-amber-100 text-amber-700 border-amber-200';
            case 'Trúng thầu': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            case 'Trượt thầu': return 'bg-rose-100 text-rose-700 border-rose-200';
            case 'Hủy': return 'bg-red-100 text-red-700 border-red-200';
            default: return 'bg-slate-100 text-slate-600 border-slate-200';
        }
    };

    const getDaysLeft = (deadline) => {
        if (!deadline) return null;
        const diff = Math.ceil((new Date(deadline) - new Date()) / (1000 * 60 * 60 * 24));
        return diff;
    };

    const filtered = bids.filter(b => {
        const matchSearch = (b.bid_code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (b.investor || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (b.du_an_id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (b.location || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (b.assigned_to || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchStatus = statusFilter === 'All' || b.status === statusFilter;
        return matchSearch && matchStatus;
    });

    // KPIs
    const totalBids = filtered.length;
    const tracking = filtered.filter(b => b.status === 'Theo dõi').length;
    const quoting = filtered.filter(b => b.status === 'Đang báo giá').length;
    const submitted = filtered.filter(b => b.status === 'Đã nộp').length;
    const won = filtered.filter(b => b.status === 'Trúng thầu');
    const lost = filtered.filter(b => b.status === 'Trượt thầu').length;
    const winRate = (won.length + lost) > 0 ? ((won.length / (won.length + lost)) * 100).toFixed(1) : '-';

    return (
        <div className="pb-10 animate-fade-in font-sans">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                    <h2 className="text-xl md:text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2 md:gap-3">
                        <span className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-cyan-100 text-cyan-600 flex items-center justify-center shadow-sm flex-shrink-0">
                            <span className="material-symbols-outlined notranslate text-[20px] md:text-[24px]" translate="no">assignment_turned_in</span>
                        </span>
                        Theo dõi Báo giá / Đấu thầu
                    </h2>
                    <p className="text-slate-500 text-[10px] md:text-sm mt-1 ml-10 md:ml-[52px]">
                        Quản lý toàn bộ vòng đời báo giá: từ theo dõi → báo giá → nộp thầu → kết quả
                    </p>
                </div>
                <button onClick={() => handleOpenForm()} className="btn bg-cyan-600 hover:bg-cyan-700 text-white font-bold shadow-md flex items-center gap-2 text-xs md:text-sm rounded-xl px-4 py-2.5 transition-all">
                    <span className="material-symbols-outlined text-[18px]">add</span> Tạo Báo giá mới
                </button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
                {[
                    { label: 'Tổng gói', value: totalBids, icon: 'format_list_numbered', color: 'slate' },
                    { label: 'Theo dõi', value: tracking, icon: 'visibility', color: 'slate' },
                    { label: 'Đang báo giá', value: quoting, icon: 'edit_note', color: 'blue' },
                    { label: 'Đã nộp', value: submitted, icon: 'upload_file', color: 'amber' },
                    { label: 'Trúng thầu', value: won.length, icon: 'emoji_events', color: 'emerald' },
                    { label: 'Tỷ lệ thắng', value: winRate === '-' ? '-' : `${winRate}%`, icon: 'trending_up', color: 'purple' },
                ].map((kpi, i) => (
                    <div key={i} className="glass-panel p-4 border border-slate-200/60 shadow-sm bg-white/70 relative overflow-hidden">
                        <div className="flex items-center gap-2 mb-1.5">
                            <span className={`w-7 h-7 rounded bg-${kpi.color}-100 text-${kpi.color}-500 flex items-center justify-center`}>
                                <span className="material-symbols-outlined text-[16px]">{kpi.icon}</span>
                            </span>
                            <h3 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{kpi.label}</h3>
                        </div>
                        <p className={`text-xl font-black text-${kpi.color}-700`}>{kpi.value}</p>
                    </div>
                ))}
            </div>

            {/* Filter Bar */}
            <div className="glass-panel p-0 shadow-sm border border-slate-200/60 bg-white/70 overflow-hidden">
                <div className="p-4 border-b border-slate-200/60 flex flex-wrap gap-4 items-center bg-slate-50/50">
                    <div className="relative w-full md:w-[300px] flex-shrink-0">
                        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
                        <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Tìm mã BG, CĐT, địa điểm, người phụ trách..."
                            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-xs md:text-sm focus:ring-2 focus:ring-cyan-500/20 outline-none" />
                    </div>
                    <div className="flex gap-2">
                        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                            className="pl-3 pr-8 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 outline-none bg-white hover:border-cyan-400">
                            <option value="All">Trạng thái (Tất cả)</option>
                            {statusOptions.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                        <button onClick={fetchData} className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-500 transition-all">
                            <span className="material-symbols-outlined block text-[18px]">refresh</span>
                        </button>
                    </div>
                </div>

                {/* Data Table View */}
                <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden mt-0">
                    {/* Mobile Card View */}
                    <div className="block xl:hidden p-3 space-y-3 max-h-[calc(100vh-360px)] overflow-y-auto bg-slate-50/50">
                        {loading ? (
                            <div className="p-8 text-center text-slate-400">Đang tải dữ liệu...</div>
                        ) : filtered.length === 0 ? (
                            <div className="p-10 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
                                <span className="material-symbols-outlined text-4xl mb-2 text-slate-200 block mx-auto">assignment</span>
                                Chưa có gói thầu nào.
                            </div>
                        ) : (
                            filtered.map((b, idx) => {
                                const daysLeft = getDaysLeft(b.submission_deadline);
                                return (
                                    <div key={b.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative group">
                                        <div className="absolute -top-2 left-4 px-2 py-0.5 bg-slate-100 border border-slate-200 rounded-md text-[9px] font-black text-slate-500">
                                            #{idx + 1}
                                        </div>
                                        <div className="flex justify-between items-start mb-2 mt-1">
                                            <div>
                                                <span className="font-bold text-sm text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded font-mono border border-cyan-100">{b.bid_code}</span>
                                                <span className={`ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${getStatusColor(b.status)}`}>
                                                   {b.status}
                                                </span>
                                            </div>
                                            <div className="flex gap-1">
                                                <button onClick={() => handleOpenHistory(b)} className="w-8 h-8 rounded-lg bg-slate-50 text-slate-500 hover:text-blue-600 flex items-center justify-center border border-slate-200 shadow-sm">
                                                    <span className="material-symbols-outlined text-[18px]">history</span>
                                                </button>
                                                <button onClick={() => handleOpenForm(b)} className="w-8 h-8 rounded-lg bg-slate-50 text-slate-500 hover:text-cyan-600 flex items-center justify-center border border-slate-200 shadow-sm">
                                                    <span className="material-symbols-outlined text-[18px]">edit_note</span>
                                                </button>
                                            </div>
                                        </div>
                                        
                                        <div className="mb-3 space-y-1">
                                            <div className="text-sm font-bold text-slate-800 leading-tight pr-2">{b.investor || '-'}</div>
                                            {b.du_an_id && <div className="text-[10px] text-slate-400 font-bold">{b.du_an_id}</div>}
                                            <div className="text-xs text-slate-500 line-clamp-1">{b.location || '-'}</div>
                                            <div className="text-xs font-medium text-slate-600 mt-1 flex items-center gap-1.5 bg-slate-50 py-1 px-2 rounded-md w-fit">
                                                <span className="material-symbols-outlined text-[14px]">business</span>{b.partners?.short_name || b.partners?.name || '-'}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 mb-3">
                                            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                                                 <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 line-clamp-1">Giá chào (s.VAT)</div>
                                                 <div className="text-[13px] font-black text-slate-800">{fmt(b.price_after_vat)}</div>
                                            </div>
                                            <div className="bg-indigo-50/50 p-2.5 rounded-lg border border-indigo-100/50">
                                                 <div className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1 line-clamp-1">Giá vốn (s.VAT)</div>
                                                 <div className="text-[13px] font-black text-indigo-700">{fmt(b.total_cost_after_vat)}</div>
                                            </div>
                                        </div>

                                        <div className="flex justify-between items-center text-xs border-t border-slate-100 pt-3">
                                             <div className="flex items-center gap-1.5 text-slate-500">
                                                 <span className="material-symbols-outlined text-[16px]">person</span> <span className="font-bold">{b.assigned_to || '-'}</span>
                                             </div>
                                             <div className="text-right">
                                                 <div className="text-slate-500 text-[11px] font-bold"><span className="material-symbols-outlined text-[14px] align-text-bottom mr-1">event</span>{fmtDate(b.submission_deadline)}</div>
                                                 {daysLeft !== null && daysLeft >= 0 && daysLeft <= 7 && (
                                                     <span className="text-[10px] font-black text-rose-500 animate-pulse mt-0.5 block">Còn {daysLeft} ngày</span>
                                                 )}
                                                 {daysLeft !== null && daysLeft < 0 && (
                                                     <span className="text-[10px] font-black text-rose-600 mt-0.5 block">Quá hạn</span>
                                                 )}
                                             </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Desktop Table View */}
                    <div className="hidden xl:block overflow-auto max-h-[calc(100vh-360px)]">
                        <table className="w-full text-left border-collapse min-w-[1400px]">
                            <thead className="sticky top-0 z-20 bg-slate-50 backdrop-blur-md shadow-sm">
                                <tr className="text-[9px] uppercase tracking-widest text-slate-500 font-black border-b border-slate-200">
                                    <th className="px-3 py-3 w-10 text-center">STT</th>
                                    <th className="px-3 py-3">Mã BG</th>
                                    <th className="px-3 py-3">Đối tác</th>
                                    <th className="px-3 py-3">CĐT / Dự án</th>
                                    <th className="px-3 py-3">Địa điểm</th>
                                    <th className="px-3 py-3 text-right">Giá chào (tr.VAT)</th>
                                    <th className="px-3 py-3 text-right">Giá chào (s.VAT)</th>
                                    <th className="px-3 py-3 text-right text-indigo-600">Giá vốn (tr.VAT)</th>
                                    <th className="px-3 py-3 text-right text-indigo-600">Giá vốn (s.VAT)</th>
                                    <th className="px-3 py-3 text-center">Ver</th>
                                    <th className="px-3 py-3 text-center">Trạng thái</th>
                                    <th className="px-3 py-3">Hạn nộp</th>
                                    <th className="px-3 py-3">Phụ trách</th>
                                    <th className="px-3 py-3 text-center">Tác vụ</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white/50">
                                {loading ? (
                                    <tr><td colSpan="14" className="p-8 text-center text-slate-400">Đang tải dữ liệu...</td></tr>
                                ) : filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan="14" className="p-10 text-center text-slate-400">
                                            <span className="material-symbols-outlined text-4xl mb-2 text-slate-200 block mx-auto">assignment</span>
                                            Chưa có gói thầu nào.
                                        </td>
                                    </tr>
                                ) : (
                                    filtered.map((b, idx) => {
                                        const daysLeft = getDaysLeft(b.submission_deadline);
                                        return (
                                            <tr key={b.id} className="hover:bg-slate-50 transition-colors group">
                                                <td className="px-3 py-3 text-center text-xs text-slate-400 font-medium">{idx + 1}</td>
                                                <td className="px-3 py-3">
                                                    <span className="font-bold text-xs text-cyan-700 bg-cyan-50 px-1.5 py-0.5 rounded font-mono">{b.bid_code}</span>
                                                </td>
                                                <td className="px-3 py-3">
                                                    <div className="text-xs font-bold text-slate-700">{b.partners?.short_name || b.partners?.name || '-'}</div>
                                                    {b.partners?.code && <div className="text-[10px] text-slate-400 mt-0.5">{b.partners.code}</div>}
                                                </td>
                                                <td className="px-3 py-3">
                                                    <div className="text-xs font-bold text-slate-800 line-clamp-1">{b.investor || '-'}</div>
                                                    {b.du_an_id && <div className="text-[10px] text-slate-400 mt-0.5">{b.du_an_id}</div>}
                                                </td>
                                                <td className="px-3 py-3 text-xs text-slate-600 max-w-[120px] truncate" title={b.location}>{b.location || '-'}</td>
                                                <td className="px-3 py-3 text-right text-xs font-medium text-slate-700 tabular-nums">{fmt(b.price_before_vat)}</td>
                                                <td className="px-3 py-3 text-right text-xs font-bold text-slate-800 tabular-nums">{fmt(b.price_after_vat)}</td>
                                                <td className="px-3 py-3 text-right text-xs font-medium text-indigo-600 tabular-nums bg-indigo-50/30">{fmt(b.total_cost_before_vat)}</td>
                                                <td className="px-3 py-3 text-right text-xs font-bold text-indigo-700 tabular-nums bg-indigo-50/30">{fmt(b.total_cost_after_vat)}</td>
                                                <td className="px-3 py-3 text-center">
                                                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 text-slate-700 text-[10px] font-black border border-slate-200">
                                                        v{b.current_version || 1}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-3 text-center">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${getStatusColor(b.status)}`}>
                                                        {b.status}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-3 text-xs text-slate-500 whitespace-nowrap">
                                                    {fmtDate(b.submission_deadline)}
                                                    {daysLeft !== null && daysLeft >= 0 && daysLeft <= 7 && (
                                                        <span className="block text-[9px] font-black text-rose-500 animate-pulse mt-0.5">Còn {daysLeft} ngày</span>
                                                    )}
                                                    {daysLeft !== null && daysLeft < 0 && (
                                                        <span className="block text-[9px] font-black text-rose-600 mt-0.5">Quá hạn</span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-3 text-xs text-slate-600 font-medium">{b.assigned_to || '-'}</td>
                                                <td className="px-3 py-3 text-center">
                                                    <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={() => handleOpenHistory(b)} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Lịch sử phiên bản">
                                                            <span className="material-symbols-outlined text-[16px]">history</span>
                                                        </button>
                                                        <button onClick={() => handleOpenForm(b)} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 transition-colors" title="Sửa">
                                                            <span className="material-symbols-outlined text-[16px]">edit_note</span>
                                                        </button>
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

            {/* ===== MODAL: Create / Edit Bid ===== */}
            {isFormOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden animate-fade-in flex flex-col max-h-[92vh]">
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                                <span className="material-symbols-outlined text-cyan-600">edit_document</span>
                                {editingBid ? `Cập nhật BG: ${editingBid.bid_code}` : 'Tạo Báo giá mới'}
                                {editingBid && <span className="text-xs font-bold text-slate-400 ml-2">v{editingBid.current_version || 1}</span>}
                            </h3>
                            <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-red-500 transition-colors">
                                <span className="material-symbols-outlined text-xl">close</span>
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto w-full">
                            <form id="bidForm" onSubmit={handleSave} className="space-y-5">
                                {/* Row 1 */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-700 mb-1 uppercase tracking-wide">Mã Báo giá</label>
                                        <input type="text" value={formData.bid_code} onChange={(e) => setFormData({...formData, bid_code: e.target.value})}
                                            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-mono font-bold focus:ring-2 focus:ring-cyan-500/20 outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-700 mb-1 uppercase tracking-wide">Người yêu cầu <span className="text-[8px] text-slate-400 normal-case">(Giám đốc)</span></label>
                                        <select value={formData.requester} onChange={(e) => setFormData({...formData, requester: e.target.value})}
                                            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-cyan-500/20 outline-none">
                                            <option value="">-- Chọn --</option>
                                            {directors.map(d => <option key={d.id} value={d.full_name}>{d.full_name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-700 mb-1 uppercase tracking-wide">CĐT / Tổng thầu <span className="text-rose-500">*</span></label>
                                        <select required value={formData.partner_id} onChange={(e) => setFormData({...formData, partner_id: e.target.value})}
                                            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-cyan-500/20 outline-none">
                                            <option value="">-- Chọn CĐT / Tổng thầu --</option>
                                            {partners.map(p => <option key={p.id} value={p.id}>{p.short_name || p.name} ({p.code})</option>)}
                                        </select>
                                    </div>
                                </div>
                                {/* Row 2 */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-700 mb-1 uppercase tracking-wide">Dự án ID</label>
                                        <input type="text" value={formData.du_an_id} onChange={(e) => setFormData({...formData, du_an_id: e.target.value})}
                                            placeholder="Mã dự án nội bộ (nếu có)"
                                            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-cyan-500/20 outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-700 mb-1 uppercase tracking-wide">Chủ đầu tư <span className="text-rose-500">*</span></label>
                                        <input type="text" required value={formData.investor} onChange={(e) => setFormData({...formData, investor: e.target.value})}
                                            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-medium focus:ring-2 focus:ring-cyan-500/20 outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-700 mb-1 uppercase tracking-wide">Địa điểm</label>
                                        <input type="text" value={formData.location} onChange={(e) => setFormData({...formData, location: e.target.value})}
                                            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-cyan-500/20 outline-none" />
                                    </div>
                                </div>

                                {/* Price Section */}
                                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/60">
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                        <span className="material-symbols-outlined text-[14px]">payments</span> Giá trị báo giá
                                    </p>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-600 mb-1">Giá chào (tr.VAT)</label>
                                            <div className="relative">
                                                <input type="number" value={formData.price_before_vat} onChange={(e) => setFormData({...formData, price_before_vat: e.target.value})}
                                                    className="w-full px-3 py-2 pr-8 rounded-xl border border-slate-200 text-sm font-mono text-right focus:ring-2 focus:ring-cyan-500/20 outline-none" />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-black">₫</span>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-600 mb-1">Giá chào (s.VAT)</label>
                                            <div className="relative">
                                                <input type="number" value={formData.price_after_vat} onChange={(e) => setFormData({...formData, price_after_vat: e.target.value})}
                                                    className="w-full px-3 py-2 pr-8 rounded-xl border border-cyan-200 text-sm font-mono text-right font-bold text-cyan-700 focus:ring-2 focus:ring-cyan-500/20 outline-none" />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-black">₫</span>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-indigo-600 mb-1">Giá vốn (tr.VAT)</label>
                                            <div className="relative">
                                                <input type="number" value={formData.total_cost_before_vat} onChange={(e) => setFormData({...formData, total_cost_before_vat: e.target.value})}
                                                    className="w-full px-3 py-2 pr-8 rounded-xl border border-indigo-200 text-sm font-mono text-right text-indigo-600 focus:ring-2 focus:ring-indigo-500/20 outline-none" />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-black">₫</span>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-indigo-600 mb-1">Giá vốn (s.VAT)</label>
                                            <div className="relative">
                                                <input type="number" value={formData.total_cost_after_vat} onChange={(e) => setFormData({...formData, total_cost_after_vat: e.target.value})}
                                                    className="w-full px-3 py-2 pr-8 rounded-xl border border-indigo-200 text-sm font-mono text-right font-bold text-indigo-700 focus:ring-2 focus:ring-indigo-500/20 outline-none" />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-black">₫</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Status & Dates */}
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-700 mb-1 uppercase tracking-wide">Trạng thái</label>
                                        <select value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value})}
                                            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold focus:ring-2 focus:ring-cyan-500/20 outline-none">
                                            {statusOptions.map(o => <option key={o} value={o}>{o}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-700 mb-1 uppercase tracking-wide">Người phụ trách <span className="text-[8px] text-slate-400 normal-case">(Đấu thầu)</span></label>
                                        <select value={formData.assigned_to} onChange={(e) => setFormData({...formData, assigned_to: e.target.value})}
                                            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-cyan-500/20 outline-none">
                                            <option value="">-- Chọn --</option>
                                            {biddingStaff.map(s => <option key={s.id} value={s.full_name}>{s.full_name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-700 mb-1 uppercase tracking-wide">Hạn nộp HS</label>
                                        <input type="date" value={formData.submission_deadline} onChange={(e) => setFormData({...formData, submission_deadline: e.target.value})}
                                            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-cyan-500/20 outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-700 mb-1 uppercase tracking-wide">Ngày công bố KQ</label>
                                        <input type="date" value={formData.result_date} onChange={(e) => setFormData({...formData, result_date: e.target.value})}
                                            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-cyan-500/20 outline-none" />
                                    </div>
                                </div>

                                {/* Rejection reason (only if Trượt thầu) */}
                                {formData.status === 'Trượt thầu' && (
                                    <div>
                                        <label className="block text-[10px] font-bold text-rose-600 mb-1 uppercase tracking-wide">Lý do trượt thầu</label>
                                        <textarea rows={2} value={formData.rejection_reason} onChange={(e) => setFormData({...formData, rejection_reason: e.target.value})}
                                            placeholder="Giá cao hơn đối thủ, thiếu năng lực kinh nghiệm..."
                                            className="w-full px-3 py-2 rounded-xl border border-rose-200 text-sm focus:ring-2 focus:ring-rose-500/20 outline-none" />
                                    </div>
                                )}

                                {/* Notes */}
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-700 mb-1 uppercase tracking-wide">Ghi chú</label>
                                    <textarea rows={2} value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})}
                                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-cyan-500/20 outline-none" />
                                </div>

                                {/* Change description (required when editing and values changed) */}
                                {editingBid && (formData.status !== editingBid.status || parseFloat(formData.price_before_vat) !== (parseFloat(editingBid.price_before_vat) || 0) || parseFloat(formData.price_after_vat) !== (parseFloat(editingBid.price_after_vat) || 0)) && (
                                    <div className="p-4 rounded-xl border-l-[3px] border-amber-500 bg-amber-50/50">
                                        <label className="block text-xs font-bold text-amber-800 mb-1 uppercase tracking-wide flex items-center gap-1">
                                            <span className="material-symbols-outlined text-[16px]">info</span> Nội dung thay đổi (bắt buộc — sẽ ghi vào lịch sử v{(editingBid.current_version || 0) + 1}) <span className="text-rose-500">*</span>
                                        </label>
                                        <textarea required value={formData.change_description} onChange={(e) => setFormData({...formData, change_description: e.target.value})}
                                            rows={2} placeholder="VD: Điều chỉnh giá chào giảm 5% theo yêu cầu CĐT..."
                                            className="w-full px-3 py-2 mt-1 rounded-lg border border-amber-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-sm bg-white outline-none" />
                                    </div>
                                )}
                            </form>
                        </div>
                        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                            <button onClick={() => setIsFormOpen(false)} className="btn bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 font-bold px-5 py-2 rounded-xl transition-all">Hủy</button>
                            <button type="submit" form="bidForm" className="btn bg-cyan-600 hover:bg-cyan-700 text-white font-bold px-5 py-2 rounded-xl transition-all flex items-center gap-2 shadow-md">
                                <span className="material-symbols-outlined text-[18px]">save</span> Lưu
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== MODAL: Version History ===== */}
            {isHistoryOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl overflow-hidden animate-fade-in flex flex-col max-h-[85vh]">
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <div>
                                <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-blue-600">history</span>
                                    Lịch sử Phiên bản
                                </h3>
                                <p className="text-[11px] text-slate-500 mt-0.5 ml-7 font-medium line-clamp-1">{selectedBidName}</p>
                            </div>
                            <button onClick={() => setIsHistoryOpen(false)} className="text-slate-400 hover:text-red-500 transition-colors">
                                <span className="material-symbols-outlined text-xl">close</span>
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto w-full flex-1 bg-slate-50/50">
                            {historyLogs.length === 0 ? (
                                <div className="text-center text-slate-400 p-6 flex flex-col items-center">
                                    <span className="material-symbols-outlined text-4xl mb-2 text-slate-200">history_toggle_off</span>
                                    Chưa có lịch sử thay đổi nào.
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {historyLogs.map((log) => (
                                        <div key={log.id} className="bg-white p-4 rounded-xl border border-slate-200/60 shadow-sm hover:border-blue-200 hover:shadow-md transition-all">
                                            <div className="flex items-center justify-between mb-3">
                                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-700 text-[10px] font-black border border-cyan-200">
                                                    <span className="material-symbols-outlined text-[12px]">tag</span> v{log.version_number}
                                                </span>
                                                <div className="text-right">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">{fmtDateTime(log.changed_at)}</span>
                                                    <span className="text-[9px] font-bold text-slate-500">{log.changed_by}</span>
                                                </div>
                                            </div>

                                            {/* Status change */}
                                            {log.old_status !== log.new_status && (
                                                <div className="flex items-center gap-1.5 mb-2 text-xs font-medium">
                                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase border ${getStatusColor(log.old_status || 'Mới')}`}>{log.old_status || 'Mới'}</span>
                                                    <span className="material-symbols-outlined text-[14px] text-slate-300">arrow_forward</span>
                                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase border ${getStatusColor(log.new_status)}`}>{log.new_status}</span>
                                                </div>
                                            )}

                                            {/* Price comparison */}
                                            <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 rounded-lg p-2.5 mb-2">
                                                <div className="flex justify-between"><span className="text-slate-500">Chào (tr.VAT):</span><span className="font-bold tabular-nums">{fmt(log.price_before_vat)}</span></div>
                                                <div className="flex justify-between"><span className="text-slate-500">Chào (s.VAT):</span><span className="font-bold tabular-nums">{fmt(log.price_after_vat)}</span></div>
                                                <div className="flex justify-between"><span className="text-indigo-500">Vốn (tr.VAT):</span><span className="font-bold text-indigo-600 tabular-nums">{fmt(log.total_cost_before_vat)}</span></div>
                                                <div className="flex justify-between"><span className="text-indigo-500">Vốn (s.VAT):</span><span className="font-bold text-indigo-700 tabular-nums">{fmt(log.total_cost_after_vat)}</span></div>
                                            </div>

                                            {/* Change description */}
                                            {log.change_description && (
                                                <div className="pt-2 border-t border-slate-100">
                                                    <p className="text-[11px] text-slate-500 leading-relaxed italic border-l-2 border-slate-300 pl-2">
                                                        "{log.change_description}"
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
