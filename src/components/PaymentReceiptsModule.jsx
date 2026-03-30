import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../context/ToastContext';
import { fmt } from '../utils/formatters';

export default function PaymentReceiptsModule() {
    const [activeTab, setActiveTab] = useState('external'); // 'external' (CĐT -> TL) or 'internal' (TL -> Sateco)
    const [receipts, setReceipts] = useState([]);
    const [internalReceipts, setInternalReceipts] = useState([]);
    const [projects, setProjects] = useState([]);
    const [availablePayments, setAvailablePayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [activeEntity, setActiveEntity] = useState('all'); // 'all', 'thanglong', 'thanhphat'
    const [searchTerm, setSearchTerm] = useState('');
    const [filterPartnerId, setFilterPartnerId] = useState('');
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [quickFilter, setQuickFilter] = useState('all'); // 'all', 'thisWeek', 'lastWeek', 'thisMonth', 'lastMonth'
    const toast = useToast();

    // Form State
    const [form, setForm] = useState({
        projectId: '',
        paymentId: '', // payment_stage_id
        amount: '',
        date: new Date().toISOString().split('T')[0],
        description: ''
    });

    useEffect(() => {
        fetchReceipts();
        fetchInternalReceipts();
        fetchProjects();
    }, []);

    const fetchReceipts = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('external_payment_history')
            .select(`
                *,
                payments!external_payment_history_payment_stage_id_fkey (
                    id,
                    stage_name,
                    payment_code,
                    projects (
                        id,
                        code,
                        internal_code,
                        name,
                        acting_entity_key,
                        partners!projects_partner_id_fkey (id, name, code, short_name)
                    )
                )
            `)
            .order('payment_date', { ascending: false });

        if (error) {
            console.error('Error fetching receipts:', error);
            toast.error('Lỗi khi tải lịch sử thu tiền CĐT');
        } else {
            setReceipts(data || []);
        }
        setLoading(false);
    };

    const fetchInternalReceipts = async () => {
        const { data, error } = await supabase
            .from('internal_payment_history')
            .select(`
                *,
                payments!internal_payment_history_payment_stage_id_fkey (
                    id,
                    stage_name,
                    payment_code,
                    projects (
                        id,
                        code,
                        internal_code,
                        name,
                        acting_entity_key,
                        sateco_contract_ratio,
                        partners!projects_partner_id_fkey (id, name, code, short_name)
                    )
                )
            `)
            .order('payment_date', { ascending: false });

        if (error) {
            console.error('Error fetching internal receipts:', error);
            toast.error('Lỗi khi tải lịch sử chuyển tiền nội bộ');
        } else {
            setInternalReceipts(data || []);
        }
    };

    const fetchProjects = async () => {
        const { data } = await supabase
            .from('projects')
            .select('id, code, internal_code, name, sateco_contract_ratio, acting_entity_key, partners!projects_partner_id_fkey(id, name, code, short_name)')
            .order('internal_code', { ascending: true });
        setProjects(data || []);
    };

    const getDates = (type) => {
        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1)); // Monday
        startOfWeek.setHours(0,0,0,0);

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23,59,59,999);

        const startOfLastWeek = new Date(startOfWeek);
        startOfLastWeek.setDate(startOfWeek.getDate() - 7);
        const endOfLastWeek = new Date(endOfWeek);
        endOfLastWeek.setDate(endOfWeek.getDate() - 7);

        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

        switch(type) {
            case 'thisWeek': return { start: startOfWeek, end: endOfWeek };
            case 'lastWeek': return { start: startOfLastWeek, end: endOfLastWeek };
            case 'thisMonth': return { start: startOfMonth, end: endOfMonth };
            case 'lastMonth': return { start: startOfLastMonth, end: endOfLastMonth };
            default: return null;
        }
    };

    const filteredReceipts = React.useMemo(() => {
        let list = activeTab === 'external' ? receipts : internalReceipts;

        // 1. Entity Filter
        if (activeEntity !== 'all') {
            list = list.filter(r => (r.payments?.projects?.acting_entity_key || 'thanglong').toLowerCase() === activeEntity);
        }

        // 2. Search Term
        if (searchTerm) {
            const s = searchTerm.toLowerCase();
            list = list.filter(r => 
                (r.payments?.projects?.internal_code || '').toLowerCase().includes(s) ||
                (r.payments?.projects?.code || '').toLowerCase().includes(s) ||
                (r.payments?.payment_code || '').toLowerCase().includes(s) ||
                (r.description || '').toLowerCase().includes(s)
            );
        }

        // 3. Partner Filter
        if (filterPartnerId) {
            list = list.filter(r => r.payments?.projects?.partners?.id === filterPartnerId);
        }

        // 4. Date Range / Quick Filter
        let start = dateRange.start ? new Date(dateRange.start) : null;
        let end = dateRange.end ? new Date(dateRange.end) : null;

        if (quickFilter !== 'all') {
            const q = getDates(quickFilter);
            if (q) {
                start = q.start;
                end = q.end;
            }
        }

        if (start || end) {
            list = list.filter(r => {
                const d = new Date(r.payment_date);
                if (start && d < start) return false;
                if (end && d > end) return false;
                return true;
            });
        }

        return list;
    }, [receipts, internalReceipts, activeTab, activeEntity, searchTerm, filterPartnerId, dateRange, quickFilter]);

    const partners = React.useMemo(() => {
        const pMap = new Map();
        projects.forEach(p => {
            if (p.partners) pMap.set(p.partners.id, p.partners);
        });
        return Array.from(pMap.values());
    }, [projects]);

    const fetchPaymentsByProject = async (projId) => {
        if (!projId) {
            setAvailablePayments([]);
            return;
        }
        const { data } = await supabase
            .from('payments')
            .select('id, stage_name, payment_code, payment_request_amount, external_income, internal_paid')
            .eq('project_id', projId)
            .order('stage_name', { ascending: true });
        
        setAvailablePayments(data || []);
        return data || [];
    };

    const handleProjectChange = async (projId) => {
        setForm(prev => ({ ...prev, projectId: projId, paymentId: '', amount: '' }));
        const payments = await fetchPaymentsByProject(projId);
        
        if (activeTab === 'external') {
            // Smart Selection for External: Find first stage not fully paid by CĐT
            const nextUnpaid = payments.find(p => (Number(p.external_income) || 0) < (Number(p.payment_request_amount) || 0));
            if (nextUnpaid) {
                const remaining = (Number(nextUnpaid.payment_request_amount) || 0) - (Number(nextUnpaid.external_income) || 0);
                setForm(prev => ({ 
                    ...prev, 
                    paymentId: nextUnpaid.id,
                    amount: String(remaining)
                }));
            }
        } else {
            // Smart Selection for Internal: Suggest amount based on ratio and current external income
            const lastStagePaidByCdt = [...payments].reverse().find(p => (Number(p.external_income) || 0) > 0);
            if (lastStagePaidByCdt) {
                const proj = projects.find(p => p.id === projId);
                const ratio = proj?.sateco_contract_ratio ? parseFloat(proj.sateco_contract_ratio) / 100 : 0.98;
                const suggestedAmount = Math.round((Number(lastStagePaidByCdt.external_income) || 0) * ratio);
                
                // Suggest Date from latest CĐT receipt
                const { data: extDocs } = await supabase
                    .from('external_payment_history')
                    .select('payment_date')
                    .eq('payment_stage_id', lastStagePaidByCdt.id)
                    .order('payment_date', { ascending: false })
                    .limit(1);

                const suggestedDate = extDocs?.[0]?.payment_date;

                setForm(prev => ({ 
                    ...prev, 
                    paymentId: lastStagePaidByCdt.id,
                    amount: String(suggestedAmount),
                    date: suggestedDate || prev.date
                }));
            }
        }
    };

    const handlePaymentChange = async (paymentId) => {
        const selectedPayment = availablePayments.find(p => p.id === paymentId);
        if (selectedPayment && activeTab === 'internal') {
            const proj = projects.find(p => p.id === form.projectId);
            const ratio = proj?.sateco_contract_ratio ? parseFloat(proj.sateco_contract_ratio) / 100 : 0.98;
            const suggestedAmount = Math.round((Number(selectedPayment.external_income) || 0) * ratio);
            
            // Suggest Date from latest CĐT receipt
            const { data: extDocs } = await supabase
                .from('external_payment_history')
                .select('payment_date')
                .eq('payment_stage_id', paymentId)
                .order('payment_date', { ascending: false })
                .limit(1);

            const suggestedDate = extDocs?.[0]?.payment_date || form.date;

            setForm(prev => ({ 
                ...prev, 
                paymentId, 
                amount: String(suggestedAmount), 
                date: suggestedDate 
            }));
        } else {
            setForm(prev => ({ ...prev, paymentId }));
        }
    };

    const parseNum = (str) => {
        if (!str) return 0;
        return Number(String(str).replace(/\./g, '').replace(/,/g, ''));
    };

    const formatNum = (num) => {
        if (num === '' || num === null || num === undefined) return '';
        return Number(parseNum(num)).toLocaleString('vi-VN');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.paymentId || !form.amount || !form.date) {
            toast.error('Vui lòng điền đầy đủ thông tin bắt buộc');
            return;
        }

        const payload = {
            payment_stage_id: form.paymentId,
            amount: parseNum(form.amount),
            payment_date: form.date,
            description: form.description
        };

        const table = activeTab === 'external' ? 'external_payment_history' : 'internal_payment_history';
        
        let result;
        if (isEditing) {
            result = await supabase.from(table).update(payload).eq('id', editingId);
        } else {
            result = await supabase.from(table).insert([payload]);
        }

        if (result.error) {
            toast.error('Lỗi khi lưu: ' + result.error.message);
        } else {
            // Trigger Sync
            if (activeTab === 'external') {
                await syncExternalIncome(payload.payment_stage_id);
                fetchReceipts();
            } else {
                await syncInternalPaid(payload.payment_stage_id);
                fetchInternalReceipts();
            }
            
            toast.success(isEditing ? 'Đã cập nhật giao dịch' : 'Đã ghi nhận thành công');
            setShowModal(false);
            resetForm();
        }
    };

    const syncExternalIncome = async (paymentStageId) => {
        if (!paymentStageId) return;
        const { data: history } = await supabase.from('external_payment_history').select('amount').eq('payment_stage_id', paymentStageId);
        const total = (history || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
        await supabase.from('payments').update({ external_income: total }).eq('id', paymentStageId);
    };

    const syncInternalPaid = async (paymentStageId) => {
        if (!paymentStageId) return;
        const { data: history } = await supabase.from('internal_payment_history').select('amount').eq('payment_stage_id', paymentStageId);
        const total = (history || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
        await supabase.from('payments').update({ internal_paid: total }).eq('id', paymentStageId);
    };

    const resetForm = () => {
        setForm({
            projectId: '',
            paymentId: '',
            amount: '',
            date: new Date().toISOString().split('T')[0],
            description: ''
        });
        setIsEditing(false);
        setEditingId(null);
        setAvailablePayments([]);
    };

    const [confirmDeleteId, setConfirmDeleteId] = useState(null);

    const handleDelete = async (id) => {
        setLoading(true);
        try {
            const table = activeTab === 'external' ? 'external_payment_history' : 'internal_payment_history';
            const list = activeTab === 'external' ? receipts : internalReceipts;
            const item = list.find(r => r.id === id);
            const stageId = item?.payment_stage_id;

            const { error } = await supabase.from(table).delete().eq('id', id);
            if (error) throw error;

            // Sync
            if (stageId) {
                if (activeTab === 'external') await syncExternalIncome(stageId);
                else await syncInternalPaid(stageId);
            }
            
            toast.success('Đã xóa giao dịch');
            if (activeTab === 'external') fetchReceipts();
            else fetchInternalReceipts();
        } catch (error) {
            toast.error('Lỗi khi xóa: ' + error.message);
        } finally {
            setLoading(false);
            setConfirmDeleteId(null);
        }
    };

    const handleEdit = async (item) => {
        setIsEditing(true);
        setEditingId(item.id);
        const projId = item.payments?.projects?.id;
        await fetchPaymentsByProject(projId);
        setForm({
            projectId: projId || '',
            paymentId: item.payment_stage_id,
            amount: String(item.amount),
            date: item.payment_date,
            description: item.description || ''
        });
        setShowModal(true);
    };



    const currentList = filteredReceipts;

    return (
        <div className="p-6 max-w-[1400px] mx-auto animate-fade-in space-y-6">
            <header className="flex justify-between items-center bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-orange-50 rounded-full -mr-16 -mt-16 opacity-50"></div>
                <div className="relative z-10">
                    <h1 className="text-xl md:text-2xl font-black text-slate-800 flex items-center gap-2 md:gap-3">
                        <span className={`w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl flex items-center justify-center text-white shadow-lg flex-shrink-0 ${activeTab === 'external' ? 'bg-orange-500 shadow-orange-100' : 'bg-indigo-600 shadow-indigo-100'}`}>
                            <span className="material-symbols-outlined notranslate text-[20px] md:text-[24px]" translate="no">{activeTab === 'external' ? 'receipt_long' : 'sync_alt'}</span>
                        </span>
                        Lịch sử tiền {activeTab === 'external' ? 'Thu' : 'Chuyển'}
                    </h1>
                    <p className="text-slate-500 text-[10px] md:text-sm mt-1 font-medium italic ml-10 md:ml-[52px]">Theo dõi dòng tiền thực tế tập trung</p>
                </div>

                <div className="flex items-center gap-3 relative z-10">
                    <button 
                        onClick={() => { resetForm(); setShowModal(true); }}
                        className={`${activeTab === 'external' ? 'bg-orange-500 hover:bg-orange-600 shadow-orange-100' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100'} text-white px-6 py-2.5 rounded-xl font-black text-sm flex items-center gap-2 shadow-lg transition-all active:scale-95`}
                    >
                        <span className="material-symbols-outlined notranslate text-[20px]" translate="no">add_circle</span>
                        {activeTab === 'external' ? 'GHI NHẬN THU TIỀN' : 'GHI NHẬN CHUYỂN TIỀN'}
                    </button>
                </div>
            </header>

            {/* Tabs Navigation */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-inner overflow-x-auto w-full md:w-fit scrollbar-none">
                    <button 
                        onClick={() => setActiveTab('external')}
                        className={`flex items-center gap-1.5 md:gap-2 px-4 md:px-6 py-2 rounded-xl text-xs md:text-sm font-black transition-all whitespace-nowrap ${activeTab === 'external' ? 'bg-white text-orange-600 shadow-sm ring-1 ring-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        <span className="material-symbols-outlined notranslate text-[18px] md:text-[20px]" translate="no">account_balance_wallet</span>
                        1. Thu CĐT
                    </button>
                    <button 
                        onClick={() => setActiveTab('internal')}
                        className={`flex items-center gap-1.5 md:gap-2 px-4 md:px-6 py-2 rounded-xl text-xs md:text-sm font-black transition-all whitespace-nowrap ${activeTab === 'internal' ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        <span className="material-symbols-outlined notranslate text-[18px] md:text-[20px]" translate="no">sync_alt</span>
                        2. Nội bộ
                    </button>
                </div>

                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-inner overflow-x-auto w-full md:w-fit scrollbar-none">
                    {[
                        { id: 'all', label: 'TẤT CẢ' },
                        { id: 'thanglong', label: 'THĂNG LONG' },
                        { id: 'thanhphat', label: 'THÀNH PHÁT' }
                    ].map(e => (
                        <button
                            key={e.id}
                            onClick={() => setActiveEntity(e.id)}
                            className={`px-3 md:px-4 py-2 rounded-xl text-[9px] md:text-[10px] font-black tracking-widest transition-all whitespace-nowrap ${activeEntity === e.id ? 'bg-white text-blue-600 shadow-sm ring-1 ring-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            {e.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Advanced Filters */}
            <div className="bg-white p-3 md:p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:grid md:grid-cols-4 gap-3 md:gap-4 items-end">
                <div className="space-y-1.5 w-full col-span-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tìm kiếm</label>
                    <div className="relative">
                        <span className="material-symbols-outlined notranslate absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]" translate="no">search</span>
                        <input 
                            type="text" 
                            placeholder="Mã dự án, nội dung..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:bg-white focus:border-blue-500 transition-all outline-none"
                        />
                    </div>
                </div>

                <div className="space-y-1.5 w-full col-span-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Đối tác (CĐT)</label>
                    <select 
                        value={filterPartnerId}
                        onChange={(e) => setFilterPartnerId(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:bg-white focus:border-blue-500 transition-all outline-none appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M5%208l5%205%205-5%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%222%22%20fill%3D%22none%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2Fc%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:right_10px_center] bg-[size:16px]"
                    >
                        <option value="">-- Tất cả đối tác --</option>
                        {partners.map(p => (
                            <option key={p.id} value={p.id}>{p.short_name || p.name}</option>
                        ))}
                    </select>
                </div>

                <div className="space-y-1.5 w-full col-span-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Khoảng ngày</label>
                    <div className="flex items-center gap-2">
                        <input 
                            type="date" 
                            value={dateRange.start}
                            onChange={(e) => { setDateRange(prev => ({ ...prev, start: e.target.value })); setQuickFilter('all'); }}
                            className="flex-1 w-0 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold outline-none"
                        />
                        <span className="text-slate-300 font-bold">→</span>
                        <input 
                            type="date" 
                            value={dateRange.end}
                            onChange={(e) => { setDateRange(prev => ({ ...prev, end: e.target.value })); setQuickFilter('all'); }}
                            className="flex-1 w-0 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold outline-none"
                        />
                    </div>
                </div>

                <div className="flex flex-wrap gap-1 w-full col-span-1 overflow-x-auto pb-1 scrollbar-none">
                    {[
                        { id: 'all', label: 'TẤT CẢ' },
                        { id: 'thisMonth', label: 'THÁNG NÀY' },
                        { id: 'lastMonth', label: 'THÁNG TRƯỚC' }
                    ].map(f => (
                        <button
                            key={f.id}
                            onClick={() => { setQuickFilter(f.id); setDateRange({ start: '', end: '' }); }}
                            className={`px-2 py-1 rounded-lg text-[8px] font-black tracking-tight transition-all border whitespace-nowrap ${quickFilter === f.id ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'}`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Stats Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm group">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full ${activeTab === 'external' ? 'bg-orange-400' : 'bg-indigo-400'}`}></span>
                        Tổng tiền {activeTab === 'external' ? 'đã thu' : 'đã chuyển'}
                    </p>
                    <p className={`text-3xl font-black tabular-nums ${activeTab === 'external' ? 'text-slate-800' : 'text-indigo-700'}`}>
                        {fmt(currentList.reduce((s, r) => s + (Number(r.amount) || 0), 0))} <span className="text-xs text-slate-400">₫</span>
                    </p>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm group">
                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                        {activeTab === 'external' ? 'Thu tiền' : 'Chuyển khoản'} tháng này
                    </p>
                    <p className="text-3xl font-black text-emerald-700 tabular-nums">
                        {fmt(currentList.filter(r => r.payment_date?.startsWith(new Date().toISOString().slice(0, 7))).reduce((s, r) => s + (Number(r.amount) || 0), 0))} <span className="text-xs text-emerald-400">₫</span>
                    </p>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm group">
                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                        Số lượng giao dịch
                    </p>
                    <p className="text-3xl font-black text-blue-700 tabular-nums">{currentList.length} <span className="text-xs text-blue-400 italic">Lần</span></p>
                </div>
            </div>

            {/* Main Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[400px]">
                {/* Mobile Card View */}
                <div className="block lg:hidden space-y-3 p-3 bg-slate-50/50">
                    {loading ? (
                        [1,2,3].map(i => <div key={i} className="h-32 bg-white rounded-2xl animate-pulse" />)
                    ) : currentList.length === 0 ? (
                        <div className="py-20 text-center text-slate-400 italic text-sm">Chưa có dữ liệu lịch sử</div>
                    ) : currentList.map(item => (
                        <div key={item.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col gap-2">
                            <div className="flex justify-between items-start">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-slate-400">{new Date(item.payment_date).toLocaleDateString('vi-VN')}</span>
                                    <span className={`text-[11px] font-black uppercase mt-0.5 ${activeTab === 'external' ? 'text-orange-600' : 'text-indigo-600'}`}>{item.payments?.payment_code}</span>
                                </div>
                                <div className={`text-[12px] font-black tabular-nums ${activeTab === 'external' ? 'text-emerald-600' : 'text-indigo-700'}`}>
                                    {fmt(item.amount)} ₫
                                </div>
                            </div>
                            
                            <div className="flex flex-wrap items-center gap-1.5">
                                <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[8px] font-black uppercase tracking-tighter">
                                    #{item.payments?.projects?.internal_code || item.payments?.projects?.code}
                                </span>
                                <span className="text-[9px] text-slate-500 font-bold line-clamp-1">{item.description || 'Không có ghi chú'}</span>
                            </div>

                            <div className="flex justify-end gap-2 pt-2 border-t border-slate-50 mt-1">
                                <button onClick={() => handleEdit(item)} className="p-1.5 rounded-lg bg-blue-50 text-blue-600"><span className="material-symbols-outlined text-[16px]">edit</span></button>
                                <button onClick={() => setConfirmDeleteId(item.id)} className="p-1.5 rounded-lg bg-rose-50 text-rose-600"><span className="material-symbols-outlined text-[16px]">delete</span></button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Desktop Table View */}
                <div className="hidden lg:block overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-tight">
                                <th className="px-6 py-4">{activeTab === 'external' ? 'Ngày thu tiền' : 'Ngày chuyển tiền'}</th>
                                <th className="px-6 py-4">Dự án</th>
                                <th className="px-6 py-4">Đợt thanh toán</th>
                                <th className="px-6 py-4">Nội dung / Ghi chú</th>
                                <th className="px-6 py-4 text-right">Số tiền {activeTab === 'external' ? 'thực nhận' : 'đã chuyển'}</th>
                                <th className="px-6 py-4 text-center">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 text-sm font-medium text-slate-600">
                            {loading ? (
                                [1,2,3].map(i => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan="6" className="px-6 py-4"><div className="h-10 bg-slate-50 rounded-lg"></div></td>
                                    </tr>
                                ))
                            ) : currentList.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center gap-2">
                                            <span className="material-symbols-outlined notranslate text-4xl text-slate-200" translate="no">payments</span>
                                            <p className="text-slate-400 font-medium italic">Chưa có dữ liệu lịch sử</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : currentList.map((item) => (
                                <tr key={item.id} className="hover:bg-slate-50 transition-colors group">
                                    <td className="px-6 py-4 font-black">
                                        {new Date(item.payment_date).toLocaleDateString('vi-VN')}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col gap-1">
                                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase w-fit border ${
                                                (item.payments?.projects?.acting_entity_key || 'thanglong').toLowerCase() === 'thanhphat' 
                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                                                : 'bg-blue-50 text-blue-700 border-blue-100'
                                            }`}>
                                                {item.payments?.projects?.internal_code || item.payments?.projects?.code}
                                            </span>
                                            {activeTab === 'external' && item.payments?.projects?.partners && (
                                                <span className="text-[10px] text-slate-400 font-bold ml-0.5 flex items-center gap-1">
                                                    <span className="material-symbols-outlined notranslate text-[12px]" translate="no">corporate_fare</span>
                                                    {item.payments?.projects?.partners?.short_name || item.payments?.projects?.partners?.name}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className={`text-xs font-black uppercase ${activeTab === 'external' ? 'text-blue-600' : 'text-indigo-600'}`}>
                                                {item.payments?.payment_code}
                                            </span>
                                            <span className="text-[10px] text-slate-400 font-medium tracking-tight">({item.payments?.stage_name})</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-slate-500 italic text-xs max-w-xs truncate">
                                        {item.description || '—'}
                                    </td>
                                    <td className={`px-6 py-4 text-right font-black tabular-nums ${activeTab === 'external' ? 'text-emerald-600' : 'text-indigo-700'}`}>
                                        {fmt(item.amount)} ₫
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => handleEdit(item)} className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors" title="Sửa">
                                                <span className="material-symbols-outlined notranslate text-[18px]" translate="no">edit</span>
                                            </button>
                                            <button onClick={() => setConfirmDeleteId(item.id)} className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors" title="Xóa">
                                                <span className="material-symbols-outlined notranslate text-[18px]" translate="no">delete</span>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal Form */}
            {showModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowModal(false)}></div>
                    <div className="bg-white w-full max-w-lg rounded-[32px] shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className={`px-8 py-6 border-b border-slate-100 flex justify-between items-center ${activeTab === 'external' ? 'bg-orange-50' : 'bg-indigo-50'}`}>
                            <div>
                                <h3 className="text-xl font-black text-slate-800">{activeTab === 'external' ? 'Ghi nhận thu tiền CĐT' : 'Ghi nhận chuyển tiền Sateco'}</h3>
                                <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-1">Cập nhật lịch sử dòng tiền thực tế</p>
                            </div>
                            <button onClick={() => setShowModal(false)} className="w-9 h-9 flex items-center justify-center rounded-full bg-white hover:bg-slate-200 transition-colors text-slate-400 shadow-sm border border-slate-200">
                                <span className="material-symbols-outlined notranslate" translate="no">close</span>
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-8 space-y-5">
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Chọn Dự án / Hợp đồng <span className="text-rose-500">*</span></label>
                                <select 
                                    value={form.projectId}
                                    onChange={(e) => handleProjectChange(e.target.value)}
                                    className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-blue-500 outline-none font-black text-slate-700 bg-slate-50/50"
                                    required
                                >
                                    <option value="">-- Chọn hợp đồng --</option>
                                    {projects
                                        .filter(p => activeEntity === 'all' || (p.acting_entity_key || 'thanglong').toLowerCase() === activeEntity)
                                        .map(p => (
                                            <option key={p.id} value={p.id}>{p.internal_code || p.code} - {p.name}</option>
                                        ))
                                    }
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Chọn Đợt thanh toán <span className="text-rose-500">*</span></label>
                                <select 
                                    value={form.paymentId}
                                    onChange={(e) => handlePaymentChange(e.target.value)}
                                    className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-blue-500 outline-none font-black text-blue-600 bg-slate-50/50"
                                    required
                                    disabled={!form.projectId}
                                >
                                    <option value="">-- Chọn mã thanh toán --</option>
                                    {availablePayments.map(p => (
                                            <option key={p.id} value={p.id} className="font-bold">
                                                {p.payment_code} ({p.stage_name})
                                            </option>
                                        ))
                                    }
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <div className="flex justify-between items-center ml-1">
                                    <label className={`text-[11px] font-black uppercase tracking-widest ${activeTab === 'external' ? 'text-orange-600' : 'text-indigo-600'}`}>Số tiền <span className="text-rose-500">*</span></label>
                                    {activeTab === 'internal' && <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-black italic">Đã gợi ý theo tỷ lệ HĐ</span>}
                                </div>
                                <div className="relative">
                                    <input 
                                        type="text" 
                                        value={formatNum(form.amount)}
                                        onChange={(e) => {
                                            const clean = e.target.value.replace(/[^0-9]/g, '');
                                            setForm({...form, amount: clean});
                                        }}
                                        className={`w-full px-4 py-3 rounded-2xl border ${activeTab === 'external' ? 'border-orange-100 focus:border-orange-500' : 'border-indigo-100 focus:border-indigo-500'} outline-none font-black text-slate-800 pr-12 text-xl tabular-nums`}
                                        placeholder="0"
                                        required
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₫</span>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">{activeTab === 'external' ? 'Ngày thu tiền' : 'Ngày chuyển tiền'} <span className="text-rose-500">*</span></label>
                                <input 
                                    type="date" 
                                    value={form.date}
                                    onChange={(e) => setForm({...form, date: e.target.value})}
                                    className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-blue-500 outline-none font-black text-slate-700 bg-slate-50/50"
                                    required
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Ghi chú / Nội dung</label>
                                <textarea 
                                    rows="1"
                                    value={form.description}
                                    onChange={(e) => setForm({...form, description: e.target.value})}
                                    className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-blue-500 outline-none font-medium text-slate-600 resize-none text-sm"
                                    placeholder="VD: Chuyển khoản qua ngân hàng Vietcombank..."
                                ></textarea>
                            </div>

                            <div className="pt-6 flex gap-3">
                                <button 
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 py-3.5 rounded-2xl border border-slate-200 font-bold text-slate-500 hover:bg-slate-50 transition-all active:scale-95"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit"
                                    className={`flex-1 py-3.5 ${activeTab === 'external' ? 'bg-orange-500 hover:bg-orange-600 shadow-orange-100' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100'} text-white rounded-2xl font-black shadow-lg transition-all active:scale-95`}
                                >
                                    {isEditing ? 'UPDATE' : 'SAVE DATA'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Confirmation Modal */}
            {confirmDeleteId && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={() => setConfirmDeleteId(null)}></div>
                    <div className="bg-white rounded-3xl p-8 max-w-sm w-full relative z-10 shadow-2xl animate-in zoom-in-95 duration-200 border border-slate-100">
                        <div className="w-20 h-20 bg-rose-50 text-rose-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
                            <span className="material-symbols-outlined notranslate text-4xl" translate="no">delete_forever</span>
                        </div>
                        <h3 className="text-xl font-black text-slate-800 text-center mb-2">Xác nhận xóa?</h3>
                        <p className="text-slate-500 text-center text-xs mb-8 leading-relaxed font-semibold">
                            Hành động này không thể hoàn tác. Số liệu thực thu/chuyển của đợt thanh toán tương ứng sẽ được tự động cập nhật lại ngay lập tức.
                        </p>
                        <div className="flex gap-3">
                            <button 
                                onClick={() => setConfirmDeleteId(null)}
                                className="flex-1 py-3 rounded-2xl border border-slate-200 font-black text-slate-500 hover:bg-slate-100 transition-all active:scale-95 text-xs"
                            >
                                HỦY BỎ
                            </button>
                            <button 
                                onClick={() => handleDelete(confirmDeleteId)}
                                className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-black shadow-lg shadow-rose-100 transition-all active:scale-95 text-xs"
                            >
                                XÓA NGAY
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
