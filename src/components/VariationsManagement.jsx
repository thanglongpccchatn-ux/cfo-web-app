import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { smartToast } from '../utils/globalToast';

export default function VariationsManagement() {
    const { profile, hasPermission: _hasPermission } = useAuth();
    const [projects, setProjects] = useState([]);
    const [variations, setVariations] = useState([]);
    const [loading, setLoading] = useState(true);

    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const statusOptions = ['Chờ duyệt', 'Đang xử lý', 'Đã duyệt', 'Hủy'];

    // Modal States
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingVar, setEditingVar] = useState(null);
    const [formData, setFormData] = useState({
        project_id: '',
        variation_no: '',
        name: '',
        proposed_value: '',
        approved_value: '',
        status: 'Chờ duyệt',
        approval_date: '',
        reason: ''
    });

    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [historyLogs, setHistoryLogs] = useState([]);
    const [selectedVarName, setSelectedVarName] = useState('');

    const fetchData = React.useCallback(async () => {
        setLoading(true);
        try {
            const { data: projData, error: projError } = await supabase.from('projects').select('id, name, code, internal_code, vat_percentage').order('created_at', { ascending: false });
            if (projError) console.error("Error fetching projects:", projError);
            
            const { data: varData, error: varError } = await supabase.from('contract_variations').select(`*, projects (name, code, internal_code)`).order('created_at', { ascending: false });
            if (varError) console.error("Error fetching variations:", varError);
            
            setProjects(projData || []);
            setVariations(varData || []);
        } catch (error) {
            console.error('Error fetching variations data:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
        // Set up real-time subscription for variations
        const subscription = supabase
            .channel('public:contract_variations')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'contract_variations' }, _payload => {
                fetchData();
            })
            .subscribe();

        return () => supabase.removeChannel(subscription);
    }, [fetchData]);

    const handleProjectSelection = (e) => {
        const pId = e.target.value;
        const proj = projects.find(p => p.id === pId);
        
        let autoVariationNo = '';
        if (proj) {
            const existingCount = variations.filter(v => v.project_id === pId).length;
            autoVariationNo = `${proj.internal_code || proj.code}-PL${String(existingCount + 1).padStart(2, '0')}`;
        }
        
        setFormData(prev => ({
            ...prev,
            project_id: pId,
            variation_no: autoVariationNo
        }));
    };

    const handleOpenForm = (variation = null) => {
        if (variation) {
            setEditingVar(variation);
            setFormData({
                project_id: variation.project_id,
                variation_no: variation.variation_no || '',
                name: variation.name || '',
                proposed_value: variation.proposed_value || '',
                approved_value: variation.approved_value || '',
                status: variation.status || 'Chờ duyệt',
                approval_date: variation.approval_date || '',
                notes: variation.notes || '',
                reason: '' // Reset reason for new edit
            });
        } else {
            setEditingVar(null);
            const initialProjectId = projects.length > 0 ? projects[0].id : '';
            let initialVariationNo = '';
            if (initialProjectId) {
                const proj = projects.find(p => p.id === initialProjectId);
                const existingCount = variations.filter(v => v.project_id === initialProjectId).length;
                initialVariationNo = `${proj.internal_code || proj.code}-PL${String(existingCount + 1).padStart(2, '0')}`;
            }
            setFormData({
                project_id: initialProjectId,
                variation_no: initialVariationNo,
                name: '',
                proposed_value: '',
                approved_value: '',
                status: 'Chờ duyệt',
                approval_date: '',
                notes: '',
                reason: ''
            });
        }
        setIsFormOpen(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                project_id: formData.project_id,
                variation_no: formData.variation_no,
                name: formData.name,
                proposed_value: parseFloat(formData.proposed_value) || 0,
                approved_value: parseFloat(formData.approved_value) || 0,
                status: formData.status,
                approval_date: formData.approval_date || null,
                notes: formData.notes
            };

            let savedVarId;

            if (editingVar) {
                // Determine if a status or value changed to require history tracking
                const oldStatus = editingVar.status;
                const newStatus = formData.status;
                const oldValue = parseFloat(editingVar.approved_value) || 0;
                const newValue = parseFloat(formData.approved_value) || 0;

                const hasChanged = oldStatus !== newStatus || oldValue !== newValue;
                if (hasChanged && !formData.reason?.trim() && editingVar) {
                    smartToast('Vui lòng nhập lý do thay đổi trạng thái hoặc giá trị!');
                    return;
                }

                const { data: _data, error } = await supabase.from('contract_variations').update(payload).eq('id', editingVar.id).select().single();
                if (error) throw error;
                savedVarId = editingVar.id;

                if (hasChanged) {
                    await supabase.from('variation_history').insert([{
                        variation_id: savedVarId,
                        old_status: oldStatus,
                        new_status: newStatus,
                        old_value: oldValue,
                        new_value: newValue,
                        reason: formData.reason,
                        changed_by: profile?.full_name || profile?.role_code || 'System'
                    }]);
                }
            } else {
                const { data, error } = await supabase.from('contract_variations').insert([payload]).select().single();
                if (error) throw error;
                savedVarId = data.id;

                // Initial history log
                await supabase.from('variation_history').insert([{
                    variation_id: savedVarId,
                    old_status: null,
                    new_status: formData.status,
                    old_value: 0,
                    new_value: payload.approved_value,
                    reason: 'Khởi tạo phát sinh',
                    changed_by: profile?.full_name || profile?.role_code || 'System'
                }]);
            }
            
            setIsFormOpen(false);
            fetchData();
        } catch (error) {
            console.error('Lỗi lưu phát sinh:', error);
            smartToast('Có lỗi xảy ra khi lưu phát sinh');
        }
    };

    const handleOpenHistory = async (variation) => {
        setSelectedVarName(variation.name);
        setIsHistoryOpen(true);
        setHistoryLogs([]); // temporary clear
        try {
            const { data, error } = await supabase
                .from('variation_history')
                .select('*')
                .eq('variation_id', variation.id)
                .order('changed_at', { ascending: false });
            if (error) throw error;
            setHistoryLogs(data || []);
        } catch (error) {
            console.error('Error fetching history:', error);
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    };

    const formatDateTime = (dateStr) => {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    };

    const formatBillion = (val) => {
        if (!val || isNaN(val)) return '-';
        return new Intl.NumberFormat('vi-VN').format(Math.round(val));
    };

    const formatCurrency = (val) => {
        if (!val || isNaN(val)) return '0 ₫';
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'Đã duyệt': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            case 'Chờ duyệt': return 'bg-amber-100 text-amber-700 border-amber-200';
            case 'Đang xử lý': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'Hủy': return 'bg-rose-100 text-rose-700 border-rose-200';
            default: return 'bg-slate-100 text-slate-700 border-slate-200';
        }
    };

    const filteredVariations = variations.filter(v => {
        const matchesSearch = v.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              v.projects?.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              (v.variation_no || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'All' || v.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const totalApproved = filteredVariations.filter(v => v.status === 'Đã duyệt').reduce((sum, v) => sum + (parseFloat(v.approved_value) || 0), 0);
    const totalProposed = filteredVariations.reduce((sum, v) => sum + (parseFloat(v.proposed_value) || 0), 0);

    return (
        <div className="pb-10 animate-fade-in font-sans">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                    <h2 className="text-xl md:text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2 md:gap-3">
                        <span className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center shadow-sm flex-shrink-0">
                            <span className="material-symbols-outlined notranslate text-[20px] md:text-[24px]" translate="no">playlist_add_check</span>
                        </span>
                        Quản lý Phát sinh
                    </h2>
                    <p className="text-slate-500 text-[10px] md:text-sm mt-1 ml-10 md:ml-[52px]">
                        Theo dõi danh sách phụ lục, phát sinh tăng/giảm giá trị hợp đồng
                    </p>
                </div>
                <div className="flex gap-2 min-w-max">
                    <button onClick={() => handleOpenForm()} className="btn bg-orange-600 hover:bg-orange-700 text-white font-bold shadow-md flex items-center gap-2 text-xs md:text-sm rounded-xl px-4 py-2 transition-all">
                        <span className="material-symbols-outlined text-[18px]">add</span> Tạo lệnh Phát sinh
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="glass-panel p-5 border border-slate-200/60 shadow-sm relative overflow-hidden bg-white/70">
                    <div className="flex items-center gap-3 mb-2">
                        <span className="w-8 h-8 rounded bg-slate-100 text-slate-500 flex items-center justify-center">
                            <span className="material-symbols-outlined text-[18px]">format_list_numbered</span>
                        </span>
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">TỔNG LỆNH PS</h3>
                    </div>
                    <p className="text-2xl font-black text-slate-800">{filteredVariations.length}</p>
                </div>
                
                <div className="glass-panel p-5 border border-slate-200/60 shadow-sm relative overflow-hidden bg-white/70">
                    <div className="flex items-center gap-3 mb-2">
                        <span className="w-8 h-8 rounded bg-amber-100 text-amber-600 flex items-center justify-center">
                            <span className="material-symbols-outlined text-[18px]">pending_actions</span>
                        </span>
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">ĐANG CHỜ DUYỆT</h3>
                    </div>
                    <p className="text-2xl font-black text-amber-600">{filteredVariations.filter(v => ['Chờ duyệt', 'Đang xử lý'].includes(v.status)).length}</p>
                </div>

                <div className="glass-panel p-5 border border-slate-200/60 shadow-sm relative overflow-hidden bg-white/70">
                    <div className="flex items-center gap-3 mb-2">
                        <span className="w-8 h-8 rounded bg-blue-100 text-blue-600 flex items-center justify-center">
                            <span className="material-symbols-outlined text-[18px]">request_quote</span>
                        </span>
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">TỔNG TIỀN ĐỀ NGHỊ</h3>
                    </div>
                    <p className="text-lg md:text-xl font-black text-slate-800" title={formatCurrency(totalProposed)}>{formatBillion(totalProposed)}</p>
                </div>

                <div className="glass-panel p-5 border border-slate-200/60 shadow-sm relative overflow-hidden bg-white/70">
                    <div className="absolute right-0 top-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl"></div>
                    <div className="flex items-center gap-3 mb-2 relative z-10">
                        <span className="w-8 h-8 rounded bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-sm border border-emerald-200">
                            <span className="material-symbols-outlined text-[18px]">check_circle</span>
                        </span>
                        <h3 className="text-xs font-bold text-emerald-600 uppercase tracking-widest">TỔNG TIỀN ĐÃ DUYỆT</h3>
                    </div>
                    <p className="text-lg md:text-xl font-black text-emerald-600 relative z-10" title={formatCurrency(totalApproved)}>{formatBillion(totalApproved)}</p>
                </div>
            </div>

            {/* List Table */}
            <div className="glass-panel p-0 shadow-sm border border-slate-200/60 bg-white/70 overflow-hidden">
                <div className="p-4 border-b border-slate-200/60 flex flex-wrap gap-4 items-center bg-slate-50/50">
                    <div className="relative w-full md:w-[280px] flex-shrink-0">
                        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Tìm nội dung phạt sinh, dự án..."
                            className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 bg-white text-xs md:text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                        />
                    </div>
                    
                    <div className="flex gap-2">
                        <select 
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="pl-3 pr-8 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 outline-none bg-white hover:border-blue-400"
                        >
                            <option value="All">Trạng thái (Tất cả)</option>
                            {statusOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                        <button onClick={fetchData} className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-500 transition-all">
                            <span className="material-symbols-outlined block text-[18px]">refresh</span>
                        </button>
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden mt-0">
                    {/* Mobile Card View */}
                    <div className="block lg:hidden p-3 space-y-3 max-h-[calc(100vh-320px)] overflow-y-auto bg-slate-50/50">
                        {loading ? (
                            <div className="p-8 text-center text-slate-400">Đang tải dữ liệu...</div>
                        ) : filteredVariations.length === 0 ? (
                            <div className="p-10 text-center text-slate-400 bg-white rounded-xl border border-slate-200 shadow-sm">
                                <span className="material-symbols-outlined text-4xl mb-2 text-slate-200 block mx-auto">receipt_long</span>
                                Chưa có khoản phát sinh nào.
                            </div>
                        ) : (
                            filteredVariations.map((v, index) => (
                                <div key={v.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative group">
                                    <div className="absolute -top-2 left-4 px-2 py-0.5 bg-slate-100 border border-slate-200 rounded-md text-[9px] font-black text-slate-500">
                                        #{index + 1}
                                    </div>
                                    <div className="flex justify-between items-start mb-2 mt-1">
                                        <div className="flex-1 pr-2">
                                            <div className="font-bold text-sm text-blue-700 leading-tight block">{v.name}</div>
                                            {v.variation_no && <span className="inline-block mt-1.5 px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-mono border border-slate-200">{v.variation_no}</span>}
                                        </div>
                                        <div className="flex gap-1 shrink-0">
                                            <button onClick={() => handleOpenHistory(v)} className="w-8 h-8 rounded-lg bg-slate-50 text-slate-500 hover:text-blue-600 flex items-center justify-center border border-slate-200 shadow-sm">
                                                <span className="material-symbols-outlined text-[18px]">history</span>
                                            </button>
                                            <button onClick={() => handleOpenForm(v)} className="w-8 h-8 rounded-lg bg-slate-50 text-slate-500 hover:text-orange-600 flex items-center justify-center border border-slate-200 shadow-sm">
                                                <span className="material-symbols-outlined text-[18px]">edit_note</span>
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <div className="mb-3 space-y-1 bg-slate-50 p-2.5 rounded-lg border border-slate-100 mt-3">
                                        <div className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mb-1 flex items-center gap-1"><span className="material-symbols-outlined text-[12px]">account_tree</span> Dự án</div>
                                        <div className="text-sm font-bold text-slate-800 line-clamp-2 leading-tight">{v.projects?.name || '-'}</div>
                                        <div className="text-[10px] text-slate-500 font-mono mt-0.5 bg-white px-1.5 py-0.5 rounded border border-slate-200 w-fit">{v.projects?.internal_code || v.projects?.code || '-'}</div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 mb-3">
                                        <div className="bg-white p-2.5 rounded-lg border border-slate-100 shadow-sm">
                                             <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Đề nghị</div>
                                             <div className="text-[13px] font-black text-slate-700">{formatBillion(v.proposed_value)}</div>
                                        </div>
                                        <div className="bg-emerald-50/50 p-2.5 rounded-lg border border-emerald-100/50 shadow-sm">
                                             <div className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-1">CĐT Chốt</div>
                                             <div className="text-[13px] font-black text-emerald-700 mt-0.5 block">
                                                 {v.status === 'Đã duyệt' ? formatBillion(v.approved_value) : <span className="text-emerald-500/70 font-normal italic pr-2 text-[10px]">Chưa chốt</span>}
                                             </div>
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-center text-xs border-t border-slate-100 pt-3">
                                         <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${getStatusColor(v.status)}`}>
                                            {v.status}
                                         </span>
                                         <div className="text-right text-slate-500 text-[11px] font-medium flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                                             <span className="material-symbols-outlined text-[13px]">event_available</span> {formatDate(v.approval_date)}
                                         </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Desktop Table View */}
                    <div className="hidden xl:block overflow-auto max-h-[calc(100vh-320px)]">
                        <table className="w-full text-left border-collapse min-w-[1000px]">
                            <thead className="sticky top-0 z-20 bg-slate-50 backdrop-blur-md shadow-sm">
                                <tr className="text-[10px] uppercase tracking-widest text-slate-500 font-black border-b border-slate-200">
                                    <th className="px-4 py-3 w-12 text-center">STT</th>
                                    <th className="px-4 py-3 max-w-[200px]">Dự án</th>
                                    <th className="px-4 py-3">Số PLHĐ / Nội dung</th>
                                    <th className="px-4 py-3 text-right">Đề nghị</th>
                                    <th className="px-4 py-3 text-right text-emerald-700">CĐT Chốt</th>
                                    <th className="px-4 py-3 text-center">Trạng thái</th>
                                    <th className="px-4 py-3">Ngày duyệt</th>
                                    <th className="px-4 py-3 text-center">Tác vụ</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white/50">
                                {loading ? (
                                    <tr>
                                        <td colSpan="8" className="p-8 text-center text-slate-400">Đang tải dữ liệu...</td>
                                    </tr>
                                ) : filteredVariations.length === 0 ? (
                                    <tr>
                                        <td colSpan="8" className="p-10 text-center text-slate-400 flex flex-col items-center">
                                            <span className="material-symbols-outlined text-4xl mb-2 text-slate-200">receipt_long</span>
                                            Chưa có khoản phát sinh nào.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredVariations.map((v, index) => (
                                        <tr key={v.id} className="hover:bg-slate-50 transition-colors group">
                                            <td className="px-4 py-3 text-center text-xs text-slate-400 font-medium">{index + 1}</td>
                                            <td className="px-4 py-3">
                                                <div className="font-bold text-xs text-slate-800 line-clamp-2" title={v.projects?.name}>
                                                    {v.projects?.name || '-'}
                                                </div>
                                                <div className="text-[10px] text-slate-500 mt-0.5">{v.projects?.internal_code || v.projects?.code || '-'}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="font-bold text-sm text-blue-700">{v.name}</div>
                                                {v.variation_no && <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-mono">{v.variation_no}</span>}
                                            </td>
                                            <td className="px-4 py-3 text-right font-medium text-slate-600 border-l border-slate-50">
                                                {formatBillion(v.proposed_value)}
                                            </td>
                                            <td className="px-4 py-3 text-right font-bold text-emerald-600 bg-emerald-50/30">
                                                {v.status === 'Đã duyệt' ? formatBillion(v.approved_value) : <span className="text-slate-300 font-normal italic pr-2">Chưa chốt</span>}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${getStatusColor(v.status)}`}>
                                                    {v.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-xs text-slate-500 font-medium text-center">
                                                {formatDate(v.approval_date)}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => handleOpenHistory(v)} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Lịch sử thay đổi">
                                                        <span className="material-symbols-outlined text-[16px]">history</span>
                                                    </button>
                                                    <button onClick={() => handleOpenForm(v)} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-orange-600 hover:bg-orange-50 transition-colors" title="Sửa">
                                                        <span className="material-symbols-outlined text-[16px]">edit_note</span>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Modal Form: Create / Edit Variation */}
            {isFormOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-fade-in flex flex-col max-h-[90vh]">
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                                <span className="material-symbols-outlined text-orange-600">edit_document</span>
                                {editingVar ? 'Cập nhật lệnh Phát sinh' : 'Tạo lệnh Phát sinh mới'}
                            </h3>
                            <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-red-500 transition-colors">
                                <span className="material-symbols-outlined text-xl">close</span>
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto w-full">
                            <form id="variationForm" onSubmit={handleSave} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wide">Dự án áp dụng <span className="text-rose-500">*</span></label>
                                    <select 
                                        required
                                        disabled={!!editingVar}
                                        value={formData.project_id}
                                        onChange={handleProjectSelection}
                                        className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-sm disabled:bg-slate-50 disabled:text-slate-500"
                                    >
                                        <option value="" disabled>-- Chọn dự án --</option>
                                        {projects.map(p => (
                                            <option key={p.id} value={p.id}>{p.internal_code || p.code}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wide">Số Phụ Lục HĐ</label>
                                        <input 
                                            type="text"
                                            value={formData.variation_no}
                                            onChange={(e) => setFormData({...formData, variation_no: e.target.value})}
                                            placeholder="Năm/Tháng/PLHĐ..."
                                            className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wide">Nội dung / Hạng mục phát sinh <span className="text-rose-500">*</span></label>
                                        <input 
                                            type="text"
                                            required
                                            value={formData.name}
                                            onChange={(e) => setFormData({...formData, name: e.target.value})}
                                            placeholder="Bổ sung vật tư A..."
                                            className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-sm font-medium"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wide">Giá trị Đề nghị</label>
                                        <div className="relative">
                                            <input 
                                                type="number"
                                                value={formData.proposed_value}
                                                onChange={(e) => setFormData({...formData, proposed_value: e.target.value})}
                                                className="w-full px-3 py-2 pl-3 pr-8 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-sm font-mono text-right"
                                            />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-black">₫</span>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wide">Giá trị Được Duyệt <span className="text-rose-500">*</span></label>
                                        <div className="relative">
                                            <input 
                                                type="number"
                                                required
                                                value={formData.approved_value}
                                                onChange={(e) => setFormData({...formData, approved_value: e.target.value})}
                                                className="w-full px-3 py-2 pl-3 pr-8 rounded-xl border border-emerald-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-sm font-mono text-right font-bold text-emerald-700"
                                            />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-black">₫</span>
                                        </div>
                                    </div>

                                    {/* VAT and Post VAT Auto-Calculation */}
                                    {(() => {
                                        const selectedProj = projects.find(p => p.id === formData.project_id);
                                        const vatPct = selectedProj?.vat_percentage ?? 8;
                                        const approvedPreVat = parseFloat(formData.approved_value) || 0;
                                        const approvedPostVat = approvedPreVat * (1 + vatPct / 100);
                                        
                                        return (
                                            <>
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wide flex items-center gap-1">Thuế VAT (Theo HĐ)</label>
                                                    <div className="relative">
                                                        <input 
                                                            type="text" 
                                                            disabled
                                                            value={`${vatPct}%`}
                                                            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-500 bg-slate-50 text-right"
                                                        />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wide flex items-center gap-1">Giá trị Sau VAT</label>
                                                    <div className="relative">
                                                        <input 
                                                            type="text" 
                                                            disabled
                                                            value={new Intl.NumberFormat('vi-VN').format(Math.round(approvedPostVat))}
                                                            className="w-full px-3 py-2 pl-3 pr-8 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 bg-slate-100 text-right font-mono"
                                                        />
                                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-black">₫</span>
                                                    </div>
                                                </div>
                                            </>
                                        );
                                    })()}

                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wide">Trạng thái <span className="text-rose-500">*</span></label>
                                        <select 
                                            value={formData.status}
                                            onChange={(e) => setFormData({...formData, status: e.target.value})}
                                            className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-sm font-bold text-slate-700"
                                        >
                                            {statusOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wide">Ngày chốt duyệt</label>
                                        <input 
                                            type="date"
                                            value={formData.approval_date}
                                            onChange={(e) => setFormData({...formData, approval_date: e.target.value})}
                                            className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-sm text-slate-600"
                                        />
                                    </div>
                                    
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wide">Ghi chú / Mô tả thêm</label>
                                        <textarea 
                                            rows={2}
                                            value={formData.notes || ''}
                                            onChange={(e) => setFormData({...formData, notes: e.target.value})}
                                            placeholder="Ghi chú thêm về phụ lục này..."
                                            className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-sm"
                                        />
                                    </div>
                                </div>
                                
                                {editingVar && (formData.status !== editingVar.status || parseFloat(formData.approved_value) !== (parseFloat(editingVar.approved_value)||0)) && (
                                    <div className="mt-4 p-4 rounded-xl border-l-[3px] border-amber-500 bg-amber-50/50">
                                        <label className="block text-xs font-bold text-amber-800 mb-1 uppercase tracking-wide flex items-center gap-1">
                                            <span className="material-symbols-outlined text-[16px]">info</span> Lý do thay đổi (Bắt buộc để lưu LS) <span className="text-rose-500">*</span>
                                        </label>
                                        <textarea
                                            value={formData.reason}
                                            onChange={(e) => setFormData({...formData, reason: e.target.value})}
                                            rows="2"
                                            required
                                            placeholder="Ghi rõ lý do lùi trạng thái CĐT hoặc lý do CĐT chốt giá mới..."
                                            className="w-full px-3 py-2 mt-1 rounded-lg border border-amber-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-sm bg-white"
                                        ></textarea>
                                    </div>
                                )}
                            </form>
                        </div>
                        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                            <button onClick={() => setIsFormOpen(false)} className="btn bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 font-bold px-5 py-2 rounded-xl transition-all">
                                Hủy
                            </button>
                            <button type="submit" form="variationForm" className="btn bg-orange-600 hover:bg-orange-700 text-white font-bold px-5 py-2 rounded-xl transition-all flex items-center gap-2 shadow-md">
                                <span className="material-symbols-outlined text-[18px]">save</span> Lưu Hệ Thống
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: History Timeline */}
            {isHistoryOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-fade-in flex flex-col max-h-[85vh]">
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <div>
                                <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-blue-600">history</span>
                                    Lịch sử Thay đổi
                                </h3>
                                <p className="text-[11px] text-slate-500 mt-0.5 ml-7 font-medium line-clamp-1">{selectedVarName}</p>
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
                                <div className="space-y-6 relative before:absolute before:inset-0 before:ml-2 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
                                    {historyLogs.map((log, index) => (
                                        <div key={log.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                                            {/* Icon */}
                                            <div className="flex items-center justify-center w-5 h-5 rounded-full border-2 border-slate-200 bg-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 text-slate-300">
                                                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                                            </div>
                                            {/* Card */}
                                            <div className="w-[calc(100%-2rem)] md:w-[calc(50%-1.5rem)] bg-white p-4 rounded-xl border border-slate-200/60 shadow-sm ml-4 md:ml-0 group-hover:border-blue-200 group-hover:shadow-md transition-all">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                                        {formatDateTime(log.changed_at)}
                                                    </span>
                                                    <span className="px-2 py-0.5 bg-slate-100 rounded text-[9px] font-bold text-slate-600">{log.changed_by}</span>
                                                </div>
                                                <div className="text-xs text-slate-600 space-y-1.5">
                                                    {log.old_status !== log.new_status && (
                                                        <div className="flex flex-wrap items-center gap-1.5 font-medium">
                                                            <span className="text-slate-400 line-through text-[10px]">{log.old_status || 'Mới'}</span>
                                                            <span className="material-symbols-outlined text-[14px] text-slate-300">arrow_forward</span>
                                                            <span className={`px-1.5 rounded py-0.5 text-[10px] uppercase font-black tracking-wider border ${getStatusColor(log.new_status)}`}>{log.new_status}</span>
                                                        </div>
                                                    )}
                                                    {log.old_value !== log.new_value && (
                                                        <div className="flex items-center gap-1.5 font-mono">
                                                            <span className="text-slate-400 line-through text-xs leading-none">{formatBillion(log.old_value)}</span>
                                                            <span className="material-symbols-outlined text-[14px] text-slate-300">arrow_forward</span>
                                                            <span className="text-emerald-600 font-bold bg-emerald-50 px-1 py-0.5 rounded leading-none">{formatBillion(log.new_value)}</span>
                                                        </div>
                                                    )}
                                                </div>
                                                {log.reason && (
                                                    <div className="mt-2.5 pt-2.5 border-t border-slate-100/80">
                                                        <p className="text-[11px] text-slate-500 leading-relaxed italic border-l-2 border-slate-300 pl-2">
                                                            "{log.reason}"
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
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
