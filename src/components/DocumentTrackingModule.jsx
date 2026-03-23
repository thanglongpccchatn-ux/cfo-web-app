import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../context/ToastContext';
import { logAudit } from '../lib/auditLog';

function getDocStatus(stage) {
    const income = Number(stage.external_income || 0);
    const request = Number(stage.payment_request_amount || 0);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const dueDate = stage.due_date ? new Date(stage.due_date) : null;
    const isFullyPaid = request > 0 && income >= (request - 100); // Tolerance for rounding

    if (isFullyPaid) {
        return { label: 'Đã trả đủ', color: 'text-emerald-600 bg-emerald-50', icon: 'check_circle', isFullyPaid: true };
    }
    if (dueDate && today > dueDate) {
        const diff = Math.round((today - dueDate) / 86400000);
        return { label: `Quá hạn (${diff} ngày)`, color: 'text-rose-600 bg-rose-50', icon: 'error_outline', overdue: true, subLabel: `Hạn: ${dueDate.toLocaleDateString('vi-VN')}` };
    }
    if (income > 0) return { label: 'Chưa trả đủ', color: 'text-amber-600 bg-amber-50', icon: 'pending' };
    return { label: 'Chưa trả', color: 'text-slate-400 bg-slate-50', icon: 'schedule' };
}


const STANDARD_STAGES = ['Tạm ứng', 'IPC01', 'IPC02', 'IPC03', 'IPC04', 'IPC05', 'Quyết toán', 'Bảo hành', 'Phát sinh'];

export default function DocumentTrackingModule() {
    const [data, setData] = useState([]);
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [itemToDelete, setItemToDelete] = useState(null);
    const [projectStages, setProjectStages] = useState([]);
    const [duplicateWarning, setDuplicateWarning] = useState('');
    const [filterYear, setFilterYear] = useState('all');
    const [filterMonth, setFilterMonth] = useState('all');
    const [activeTab, setActiveTab] = useState('cdt'); // 'cdt' or 'internal'
    const [activeEntity, setActiveEntity] = useState('all'); // 'all', 'thanglong', 'thanhphat', 'sateco'
    
    // Entity dynamic labels
    const entityShort = activeEntity === 'thanhphat' ? 'TP' : activeEntity === 'sateco' ? 'ST' : 'TL';
    const entityLabel = activeEntity === 'thanhphat' ? 'Thành Phát' : activeEntity === 'sateco' ? 'Sateco' : 'Thăng Long';

    // Row Expansion State (History)
    const [expandedId, setExpandedId] = useState(null);
    const [paymentHistory, setPaymentHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    
    const toast = useToast();


    // Form State
    const [form, setForm] = useState({
        projectId: '',
        paymentCode: '',
        stageName: '',
        requestAmount: '',
        invoiceAmount: '',
        invoiceStatus: 'Chưa xuất',
        requestDate: '',
        dueDate: '',
        notes: '',
        internalPaid: '',
        internalVat: '8'
    });

    useEffect(() => {
        fetchData();
        fetchProjects();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        const { data: payments, error } = await supabase
            .from('payments')
            .select(`
                *,
                projects (
                    id, 
                    code, 
                    internal_code,
                    name,
                    acting_entity_key,
                    partners!projects_partner_id_fkey (id, name, code, short_name)
                )
            `)
            .order('due_date', { ascending: true });

        if (error) {
            console.error('Error fetching document tracking data:', error);
        } else {
            setData(payments || []);
        }
        setLoading(false);
    };

    const fetchProjects = async () => {
        const { data: projs } = await supabase
            .from('projects')
            .select('id, code, internal_code, name, sateco_contract_ratio, sateco_actual_ratio, acting_entity_key, partners!projects_partner_id_fkey(name, code, short_name)')
            .order('code', { ascending: true });
        setProjects(projs || []);
    };

    const handleProjectChange = async (projId) => {
        const selectedProj = projects.find(p => p.id === projId);
        if (!selectedProj) return;

        // Fetch existing stages for this project to suggest next
        const { data: existing } = await supabase
            .from('payments')
            .select('stage_name')
            .eq('project_id', projId);

        const existingStages = existing || [];
        setProjectStages(existingStages);

        let nextStage = STANDARD_STAGES[0]; // Default to first stage (Tạm ứng)
        if (existingStages.length > 0) {
            const existingNames = existingStages.map(s => s.stage_name);
            
            // Find the highest index among standard stages already present
            let maxIdx = -1;
            existingNames.forEach(name => {
                const idx = STANDARD_STAGES.indexOf(name);
                if (idx > maxIdx) maxIdx = idx;
            });

            if (maxIdx !== -1) {
                // Suggest the next stage in the sequence
                const nextIdx = Math.min(maxIdx + 1, STANDARD_STAGES.length - 1);
                nextStage = STANDARD_STAGES[nextIdx];
            }
        }

        setForm(prev => ({
            ...prev,
            projectId: projId,
            stageName: nextStage,
            paymentCode: `${selectedProj.internal_code || selectedProj.code}-${nextStage}`
        }));
        setDuplicateWarning('');
    };

    const handleStageChange = (newStage) => {
        const selectedProj = projects.find(p => p.id === form.projectId);
        const projectCode = selectedProj ? (selectedProj.internal_code || selectedProj.code) : '';
        
        setForm(prev => ({
            ...prev,
            stageName: newStage,
            paymentCode: projectCode ? `${projectCode}-${newStage}` : newStage
        }));

        if (projectStages.some(s => s.stage_name === newStage)) {
            setDuplicateWarning(`⚠️ Đợt "${newStage}" đã tồn tại dữ liệu cho dự án này!`);
        } else {
            setDuplicateWarning('');
        }
    };

    const handleEdit = (item) => {
        setIsEditing(true);
        setEditingId(item.id);
        setForm({
            projectId: item.project_id,
            paymentCode: item.payment_code || '',
            stageName: item.stage_name || '',
            requestAmount: String(item.payment_request_amount || ''),
            invoiceAmount: String(item.invoice_amount || ''),
            invoiceStatus: item.invoice_status || 'Chưa xuất',
            requestDate: item.invoice_date || '',
            dueDate: item.due_date || '',
            notes: item.notes || '',
            internalPaid: String(item.internal_paid || ''),
            internalVat: String(item.internal_vat_percentage ?? 8)
        });
        setShowModal(true);
    };

    const handleDelete = async () => {
        if (!itemToDelete) return;
        
        const { error } = await supabase.from('payments').delete().eq('id', itemToDelete.id);
        if (error) {
            console.error('Delete error details:', error);
            toast.error('Lỗi khi xóa: ' + (error.details || error.message));
        } else {
            // Audit log (non-blocking)
            logAudit({
                action: 'DELETE',
                tableName: 'payments',
                recordId: itemToDelete.id,
                recordName: `${itemToDelete.payment_code} - ${itemToDelete.stage_name}`
            });
            toast.success('Đã xóa hồ sơ thanh toán');
            setShowDeleteConfirm(false);
            setItemToDelete(null);
            fetchData();
        }
    };

    const handleRequestDateChange = (date) => {
        if (!date) return;
        const d = new Date(date);
        d.setDate(d.getDate() + 30);
        const due = d.toISOString().split('T')[0];
        setForm(prev => ({ ...prev, requestDate: date, dueDate: due }));
    };

    async function toggleExpansion(item) {
        if (expandedId === item.id) {
            setExpandedId(null);
            return;
        }

        setExpandedId(item.id);
        setHistoryLoading(true);
        setPaymentHistory([]);

        try {
            const { data: hist, error } = await supabase
                .from('external_payment_history')
                .select('*')
                .eq('payment_stage_id', item.id)
                .order('payment_date', { ascending: false });

            if (error) throw error;
            setPaymentHistory(hist || []);
        } catch (err) {
            console.error('Error fetching history:', err);
            toast.show('Không thể tải lịch sử thanh toán', 'error');
        } finally {
            setHistoryLoading(false);
        }
    }

    async function generateHistory(item) {
        setHistoryLoading(true);
        try {
            const payload = {
                payment_stage_id: item.id,
                amount: Number(item.external_income || 0),
                payment_date: item.invoice_date || new Date().toISOString().split('T')[0],
                description: 'Dữ liệu nhập tổng hợp từ trước'
            };

            const { error } = await supabase.from('external_payment_history').insert([payload]);
            if (error) throw error;

            toast.success('Đã tạo bản ghi lịch sử thành công');
            // Re-fetch history for this item
            const { data: hist } = await supabase
                .from('external_payment_history')
                .select('*')
                .eq('payment_stage_id', item.id)
                .order('payment_date', { ascending: false });
            setPaymentHistory(hist || []);
        } catch (err) {
            console.error('Error generating history:', err);
            toast.error('Lỗi khi tạo lịch sử: ' + err.message);
        } finally {
            setHistoryLoading(false);
        }
    }


    // Numeric helper: parse "1.000.000" -> 1000000
    const parseNum = (str) => {
        if (!str) return 0;
        return Number(String(str).replace(/\./g, '').replace(/,/g, ''));
    };

    // Numeric helper: format 1000000 -> "1.000.000"
    const formatInput = (val) => {
        if (val === '' || val === null || val === undefined) return '';
        // If it's already a string with dots, just return it or parse then format
        const num = parseNum(val);
        return num.toLocaleString('vi-VN');
    };

    const handleNumChange = (field, value) => {
        const cleanValue = value.replace(/[^0-9]/g, '');
        setForm(prev => ({ ...prev, [field]: cleanValue }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const selectedProj = projects.find(p => p.id === form.projectId);
        const contractRatio = selectedProj?.sateco_contract_ratio ? parseFloat(selectedProj.sateco_contract_ratio) / 100 : 0.98;
        const actualRatio = selectedProj?.sateco_actual_ratio ? parseFloat(selectedProj.sateco_actual_ratio) / 100 : 0.955;

        const invoiceAmt = parseNum(form.invoiceAmount) || 0;
        const requestAmt = parseNum(form.requestAmount) || 0;

        const payload = {
            project_id: form.projectId,
            stage_name: form.stageName,
            payment_code: form.paymentCode,
            payment_request_amount: requestAmt,
            invoice_amount: invoiceAmt,
            invoice_status: form.invoiceStatus,
            invoice_date: form.requestDate || null,
            due_date: form.dueDate || null,
            notes: form.notes,
            // Tự động tính toán nội bộ
            internal_debt_invoice: Math.round(invoiceAmt * contractRatio),
            internal_debt_actual: Math.round(requestAmt * actualRatio),
            
            // internal_paid should not be updated from here if we want strict history sync, 
            // but we keep it to avoid breaking current UI state until next fetch
            internal_paid: parseNum(form.internalPaid) || 0,
            internal_vat_percentage: Number(form.internalVat) || 8,
            status: isEditing ? undefined : 'Chưa thanh toán'
        };

        let result;
        if (isEditing) {
            result = await supabase.from('payments').update(payload).eq('id', editingId);
        } else {
            result = await supabase.from('payments').insert([payload]);
        }

        const { error } = result;

        if (error) {
            console.error('Save error:', error);
            if (error.message?.includes('due_date')) {
                toast.error('LỖI DATABASE: Thiếu cột "due_date". Vui lòng chạy file SQL Migration tôi đã gửi.');
            } else {
                toast.error('Lỗi khi lưu: ' + error.message);
            }
        } else {
            // Lấy ID bản ghi vừa lưu (đối với Create, parse từ data trả về nếu có, hoặc để null, supabase v2 không trả về data mặc định nếu không select)
            let recordId = isEditing ? editingId : null;
            if (!isEditing && result.data && result.data[0]) recordId = result.data[0].id;
            
            // Audit log (non-blocking)
            logAudit({
                action: isEditing ? 'UPDATE' : 'CREATE',
                tableName: 'payments',
                recordId: recordId,
                recordName: `${payload.payment_code} - ${payload.stage_name}`,
                changes: isEditing ? { invoice_amount: { new: payload.invoice_amount }, payment_request_amount: { new: payload.payment_request_amount } } : null
            });

            toast.success(isEditing ? 'Đã cập nhật hồ sơ thanh toán' : 'Đã tạo hồ sơ thanh toán mới');
            setShowModal(false);
            setIsEditing(false);
            setEditingId(null);
            fetchData();
            // Reset form
            setForm({
                projectId: '', paymentCode: '', stageName: '',
                requestAmount: '', invoiceAmount: '', invoiceStatus: 'Chưa xuất',
                requestDate: '', dueDate: '', notes: '',
                internalPaid: '', internalVat: '8'
            });
            setProjectStages([]);
            setDuplicateWarning('');
        }
    };

    const fmt = (v) => v ? Number(v).toLocaleString('vi-VN') : '0';
    const fmtDate = (d) => d ? new Date(d).toLocaleDateString('vi-VN') : '—';

    const filtered = data.filter(item => {
        const matchesSearch = 
            item.projects?.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.projects?.internal_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.projects?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.payment_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.stage_name?.toLowerCase().includes(searchTerm.toLowerCase());

        const projEntity = (item.projects?.acting_entity_key || 'thanglong').toLowerCase();
        const matchesEntity = activeEntity === 'all' || activeEntity === 'sateco' || projEntity === activeEntity;
        
        // Date Filter (CEO Logic: Filter by Due Date for Cash Flow Projection)
        let matchesDate = true;
        if (item.due_date) {
            const d = new Date(item.due_date);
            const y = d.getFullYear().toString();
            const m = (d.getMonth() + 1).toString();
            
            if (filterYear !== 'all' && y !== filterYear) matchesDate = false;
            if (filterMonth !== 'all' && m !== filterMonth) matchesDate = false;
        } else if (filterYear !== 'all' || filterMonth !== 'all') {
            // If filtering by date but item has no due_date, hide it
            matchesDate = false;
        }

        return matchesSearch && matchesEntity && matchesDate;
    });

    return (
        <div className="p-6 max-w-[1600px] mx-auto animate-fade-in space-y-6">
            {/* Entity Navigation Bar */}
            <div className="flex items-center gap-4 md:gap-6 mb-2 overflow-x-auto pb-1">
                {[
                    { id: 'all', label: 'TẤT CẢ GROUP', icon: 'hub' },
                    { id: 'thanglong', label: 'THĂNG LONG', icon: 'corporate_fare' },
                    { id: 'thanhphat', label: 'THÀNH PHÁT', icon: 'business' },
                    { id: 'sateco', label: 'SATECO (CORE)', icon: 'verified_user' },
                ].map(entity => (
                    <button
                        key={entity.id}
                        onClick={() => setActiveEntity(entity.id)}
                        className={`flex items-center gap-1.5 md:gap-2 px-1 py-3 transition-all relative whitespace-nowrap ${
                            activeEntity === entity.id 
                            ? 'text-blue-600 font-black' 
                            : 'text-slate-400 hover:text-slate-600 font-bold'
                        }`}
                    >
                        <span className={`material-symbols-outlined notranslate text-[18px] md:text-[20px] ${activeEntity === entity.id ? 'text-blue-600' : 'text-slate-300'}`} translate="no">
                            {entity.icon}
                        </span>
                        <span className="text-[10px] md:text-xs uppercase tracking-widest">{entity.label}</span>
                        {activeEntity === entity.id && (
                            <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-600 rounded-t-full shadow-[0_-2px_8px_rgba(37,99,235,0.4)]"></div>
                        )}
                    </button>
                ))}
            </div>

            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full -mr-16 -mt-16 opacity-50"></div>
                
                <div className="relative z-10">
                    <h1 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                        <span className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-200">
                            <span className="material-symbols-outlined notranslate" translate="no">description</span>
                        </span>
                        Theo dõi Hồ sơ & Thanh toán
                    </h1>
                    <p className="text-slate-500 text-sm mt-1 font-medium italic">Quản lý tập trung công nợ, hóa đơn và chứng từ toàn dự án</p>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto relative z-10">
                    <div className="relative flex-1 md:w-64">
                         <span className="material-symbols-outlined notranslate absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]" translate="no">search</span>
                         <input 
                            type="text" 
                            placeholder="Mã HĐ, dự án..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 focus:border-blue-500 outline-none transition-all text-sm font-medium bg-slate-50/30"
                         />
                    </div>

                    <div className="flex items-center gap-2">
                        <select 
                            value={filterMonth}
                            onChange={(e) => setFilterMonth(e.target.value)}
                            className="pl-4 pr-10 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 outline-none bg-white hover:border-blue-400 transition-colors cursor-pointer shadow-sm appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M5%208l5%205%205-5%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%222%22%20fill%3D%22none%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2Fc%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:right_10px_center] bg-[size:16px]"
                        >
                            <option value="all">Tất cả tháng</option>
                            {Array.from({length: 12}, (_, i) => (
                                <option key={i+1} value={(i+1).toString()}>Tháng {i+1}</option>
                            ))}
                        </select>

                        <select 
                            value={filterYear}
                            onChange={(e) => setFilterYear(e.target.value)}
                            className="pl-4 pr-10 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 outline-none bg-white hover:border-blue-400 transition-colors cursor-pointer shadow-sm appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M5%208l5%205%205-5%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%222%22%20fill%3D%22none%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2Fc%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:right_10px_center] bg-[size:16px]"
                        >
                            <option value="all">Tất cả năm</option>
                            {['2024', '2025', '2026'].map(y => (
                                <option key={y} value={y}>Năm {y}</option>
                            ))}
                        </select>
                    </div>
                    
                    <button 
                        onClick={() => {
                            setIsEditing(false);
                            setEditingId(null);
                            setForm({
                                projectId: '', paymentCode: '', stageName: '',
                                requestAmount: '', invoiceAmount: '', invoiceStatus: 'Chưa xuất',
                                requestDate: '', dueDate: '', notes: '',
                                internalPaid: '', internalVat: '8'
                            });
                            setProjectStages([]);
                            setDuplicateWarning('');
                            setShowModal(true);
                        }}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-black text-sm flex items-center gap-2 shadow-lg shadow-emerald-100 transition-all active:scale-95"
                    >
                        <span className="material-symbols-outlined notranslate text-[20px]" translate="no">add_circle</span>
                        TẠO HỒ SƠ MỚI
                    </button>

                    <button onClick={fetchData} className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors text-slate-600">
                         <span className="material-symbols-outlined notranslate block" translate="no">refresh</span>
                    </button>
                </div>
            </header>

            {/* Tabs Navigation */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl w-full md:w-fit border border-slate-200 shadow-inner overflow-x-auto">
                <button 
                    onClick={() => setActiveTab('cdt')}
                    className={`flex items-center gap-1.5 md:gap-2 px-4 md:px-6 py-2.5 rounded-xl text-xs md:text-sm font-black transition-all whitespace-nowrap ${activeTab === 'cdt' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    <span className="material-symbols-outlined notranslate text-[18px] md:text-[20px]" translate="no">business_center</span>
                    Hồ sơ & Thanh toán CĐT
                </button>
                <button 
                    onClick={() => setActiveTab('internal')}
                    className={`flex items-center gap-1.5 md:gap-2 px-4 md:px-6 py-2.5 rounded-xl text-xs md:text-sm font-black transition-all whitespace-nowrap ${activeTab === 'internal' ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    <span className="material-symbols-outlined notranslate text-[18px] md:text-[20px]" translate="no">sync_alt</span>
                    TT Nội bộ ({activeEntity === 'all' ? 'Group' : entityShort} - Sateco)
                </button>
            </div>

            {/* Overall Statistics - Moved to Top */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                 <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-12 h-12 bg-slate-50 rounded-bl-3xl -tr-8 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                        {activeEntity === 'sateco' ? 'TỔNG KHOÁN NỘI BỘ' : 'TỔNG ĐỀ NGHỊ TT'}
                    </p>
                    <p className="text-2xl font-black text-slate-800 tabular-nums">
                        {fmt(filtered.reduce((s,i) => {
                            const isInternal = activeEntity === 'sateco' && (i.projects?.acting_entity_key || 'thanglong').toLowerCase() !== 'sateco';
                            return s + (Number(isInternal ? i.internal_debt_actual : i.payment_request_amount)||0);
                        }, 0))} 
                        <span className="text-xs text-slate-400">₫</span>
                    </p>
                 </div>
                 <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-12 h-12 bg-emerald-50 rounded-bl-3xl -tr-8 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                        {activeEntity === 'sateco' ? 'THỰC THU SATECO' : 'ĐÃ THỰC THU (THANH TOÁN)'}
                    </p>
                    <p className="text-2xl font-black text-emerald-700 tabular-nums">
                        {fmt(filtered.reduce((s,i) => {
                            const isInternal = activeEntity === 'sateco' && (i.projects?.acting_entity_key || 'thanglong').toLowerCase() !== 'sateco';
                            return s + (Number(isInternal ? i.internal_paid : i.external_income)||0);
                        }, 0))}
                        <span className="text-xs text-emerald-400">₫</span>
                    </p>
                 </div>
                 <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-12 h-12 bg-rose-50 rounded-bl-3xl -tr-8 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                        CÔNG NỢ CÒN LẠI
                    </p>
                    <p className="text-2xl font-black text-rose-700 tabular-nums">
                        {fmt(filtered.reduce((s,i) => {
                             const isInternal = activeEntity === 'sateco' && (i.projects?.acting_entity_key || 'thanglong').toLowerCase() !== 'sateco';
                             const req = Number(isInternal ? i.internal_debt_actual : i.payment_request_amount) || 0;
                             const paid = Number(isInternal ? i.internal_paid : i.external_income) || 0;
                             return s + Math.max(0, req - paid);
                        }, 0))}
                        <span className="text-xs text-rose-400 ml-1">₫</span>
                    </p>
                 </div>
                 <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-12 h-12 bg-blue-50 rounded-bl-3xl -tr-8 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                        Số hồ sơ trễ hạn
                    </p>
                    <p className="text-2xl font-black text-blue-700 tabular-nums">{filtered.filter(i => getDocStatus(i).overdue).length} <span className="text-xs text-blue-400 ml-1 italic font-medium">Hồ sơ</span></p>
                 </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[400px]">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100 text-[12px] font-bold text-slate-500 uppercase tracking-tight">
                                <th className="px-3 py-3 whitespace-nowrap">Mã hợp đồng {entityShort}</th>
                                {activeTab === 'cdt' && <th className="px-3 py-3 whitespace-nowrap">Mã đối tác</th>}
                                <th className="px-3 py-3 whitespace-nowrap">Đợt thanh toán</th>
                                
                                {activeTab === 'cdt' ? (
                                    <>
                                        <th className="px-3 py-3 whitespace-nowrap text-right">Giá trị xuất HĐ</th>
                                        <th className="px-3 py-3 whitespace-nowrap">Ngày xuất HĐ</th>
                                        <th className="px-3 py-3 whitespace-nowrap">Trạng thái HĐ</th>
                                        <th className="px-3 py-3 whitespace-nowrap text-right">Giá trị ĐNTT</th>
                                        <th className="px-3 py-3 whitespace-nowrap text-right">Thực thu</th>
                                        <th className="px-3 py-3 whitespace-nowrap text-right">Chênh lệch HĐ</th>
                                        <th className="px-3 py-3 whitespace-nowrap">Trạng thái trả</th>
                                        <th className="px-3 py-3 whitespace-nowrap">Ngày đến hạn</th>
                                        <th className="px-3 py-3 whitespace-nowrap text-right">Còn lại</th>
                                    </>
                                ) : (
                                    <>
                                        <th className="px-3 py-3 whitespace-nowrap text-right bg-blue-50/50 text-blue-700">{entityShort} Nợ (Thuế)</th>
                                        <th className="px-3 py-3 whitespace-nowrap text-right bg-indigo-50/50 text-indigo-700">Sateco Nợ (Nội bộ)</th>
                                        <th className="px-3 py-3 whitespace-nowrap text-right font-black">Tổng Công nợ</th>
                                        <th className="px-3 py-3 whitespace-nowrap text-right text-emerald-600">{entityShort} Đã chuyển</th>
                                        <th className="px-3 py-3 whitespace-nowrap text-right text-rose-600">Còn nợ Tổng</th>
                                    </>
                                )}
                                <th className="px-3 py-3 whitespace-nowrap text-center">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                [1,2,3,4,5].map(i => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan="13" className="px-6 py-4"><div className="h-10 bg-slate-100 rounded-lg"></div></td>
                                    </tr>
                                ))
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan="13" className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center gap-2">
                                            <span className="material-symbols-outlined notranslate text-4xl text-slate-200" translate="no">data_alert</span>
                                            <p className="text-slate-400 font-medium italic">Không tìm thấy dữ liệu phù hợp</p>
                                        </div>
                                    </td>
                                </tr>
                             ) : filtered.map((item) => {
                                   const isInternalSatecoView = activeEntity === 'sateco' && (item.projects?.acting_entity_key || 'thanglong').toLowerCase() !== 'sateco';
                                   
                                   const status = getDocStatus(item);
                                   const rawInvoiceAmt = Number(item.invoice_amount || 0);
                                   const rawRequestAmt = Number(item.payment_request_amount || 0);
                                   const rawActualAmt = Number(item.external_income || 0);

                                   // Logic đồng bộ: Nếu xem tab Sateco cho dự án Group -> Chuyển sang giá trị khoán (98%)
                                   const invoiceAmt = isInternalSatecoView ? Number(item.internal_debt_invoice || 0) : rawInvoiceAmt;
                                   const requestAmt = isInternalSatecoView ? Number(item.internal_debt_actual || 0) : rawRequestAmt;
                                   const actualAmt = isInternalSatecoView ? Number(item.internal_paid || 0) : rawActualAmt;
                                   
                                   const diffInvoice = invoiceAmt - actualAmt;
                                   const remaining = Math.max(0, requestAmt - actualAmt);
                                  
                                  const isHighlight = status.overdue || !status.isFullyPaid || item.invoice_status === 'Chưa xuất';
                                  const textWeight = isHighlight ? 'font-black' : 'font-medium';
                                  
                                  return (
                                      <React.Fragment key={item.id}>
                                          <tr 
                                            onClick={() => toggleExpansion(item)}
                                            className={`hover:bg-blue-50/60 hover:shadow-[0_4px_20px_rgba(59,130,246,0.08)] cursor-pointer transition-all group text-[11px] text-slate-600 border-l-4 ${expandedId === item.id ? 'border-blue-500 bg-blue-50/30' : 'border-transparent'} ${isHighlight ? 'bg-rose-50/5' : ''}`}
                                          >
                                               {/* 1. Mã HĐ TL */}
                                               <td className="px-3 py-4">
                                                   <div className="flex items-center gap-1.5">
                                                       {activeTab === 'cdt' && (
                                                           status.isFullyPaid ? (
                                                               <span className="material-symbols-outlined notranslate text-emerald-500 text-[16px]" translate="no">check_circle</span>
                                                           ) : (
                                                               <span className="material-symbols-outlined notranslate text-slate-300 text-[16px]" translate="no">history</span>
                                                           )
                                                       )}
                                                       <span className={`text-emerald-700 uppercase tracking-tighter ${textWeight}`}>
                                                           {item.projects?.internal_code || item.projects?.code}
                                                       </span>
                                                   </div>
                                               </td>
                                               {/* 2. Mã đối tác */}
                                               {activeTab === 'cdt' && (
                                                   <td className="px-3 py-4">
                                                       {isInternalSatecoView ? (
                                                            <div className="flex flex-col">
                                                                <span className="flex items-center gap-1 text-slate-700 font-bold uppercase tracking-tighter">
                                                                    <span className="material-symbols-outlined text-[14px] text-emerald-600">sync_alt</span>
                                                                    {(item.projects?.acting_entity_key || 'thanglong').toLowerCase() === 'thanhphat' ? 'THÀNH PHÁT (Nội bộ)' : 'THĂNG LONG (Nội bộ)'}
                                                                </span>
                                                                <span className="text-[9px] text-slate-400 font-medium truncate max-w-[120px] italic">
                                                                    Giao khoán {item.projects?.sateco_contract_ratio || 98}%
                                                                </span>
                                                            </div>
                                                       ) : (
                                                            <span className={`text-slate-500 uppercase ${textWeight}`}>{item.projects?.partners?.short_name || item.projects?.partners?.code || 'ZYF'}</span>
                                                       )}
                                                   </td>
                                               )}
                                               {/* 3. Đợt thanh toán */}
                                               <td className="px-3 py-4">
                                                   <span className={`uppercase ${textWeight}`}>{item.stage_name}</span>
                                               </td>

                                               {activeTab === 'cdt' ? (
                                                   <>
                                                       {/* 4. Giá trị xuất HĐ */}
                                                       <td className="px-3 py-4 text-right">
                                                           <span className={`tabular-nums ${textWeight}`}>{fmt(invoiceAmt)}</span>
                                                       </td>
                                                       {/* 5. Ngày xuất HĐ */}
                                                       <td className="px-3 py-4">
                                                           <span className={`text-slate-400 tabular-nums ${textWeight}`}>{item.invoice_date ? new Date(item.invoice_date).toLocaleDateString('vi-VN') : ''}</span>
                                                       </td>
                                                       {/* 6. Trạng thái HĐ */}
                                                       <td className="px-3 py-4">
                                                           <div className="flex items-center gap-1">
                                                               <span className={`material-symbols-outlined notranslate text-[14px] ${item.invoice_status === 'Đã xuất' ? 'text-blue-500' : 'text-rose-500'}`} translate="no">
                                                                   {item.invoice_status === 'Đã xuất' ? 'description' : 'error'}
                                                               </span>
                                                               <span className={`text-[10px] uppercase tracking-tighter whitespace-nowrap ${item.invoice_status === 'Đã xuất' ? 'text-emerald-600' : 'text-rose-600 font-black'}`}>
                                                                   {item.invoice_status || 'Chưa xuất'}
                                                               </span>
                                                           </div>
                                                       </td>
                                                       {/* 7. Giá trị ĐNTT */}
                                                       <td className="px-3 py-4 text-right">
                                                           <span className={`tabular-nums text-slate-700 ${textWeight}`}>{fmt(requestAmt)}</span>
                                                       </td>
                                                       {/* 8. Thực thu */}
                                                       <td className="px-3 py-4 text-right">
                                                           <div className="flex flex-col items-end">
                                                              <span className={`tabular-nums text-emerald-600 font-black flex items-center gap-1`}>
                                                                  {fmt(actualAmt)}
                                                              </span>
                                                           </div>
                                                       </td>

                                                       {/* 9. Chênh lệch HĐ */}
                                                       <td className="px-3 py-4 text-right">
                                                           <span className={`tabular-nums text-slate-400 font-medium`}>{fmt(diffInvoice)}</span>
                                                       </td>
                                                       {/* 10. Trạng thái trả */}
                                                       <td className="px-3 py-4">
                                                          <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-full w-fit shadow-sm border ${status.overdue ? 'bg-rose-100 border-rose-200 text-rose-700' : (status.isFullyPaid ? 'bg-emerald-100 border-emerald-200 text-emerald-700' : 'bg-slate-100 border-slate-200 text-slate-600')}`}>
                                                               <span className="material-symbols-outlined notranslate text-[16px] leading-none" translate="no">
                                                                   {status.icon}
                                                               </span>
                                                               <span className="text-[9px] uppercase font-black tracking-wider whitespace-nowrap">
                                                                   {status.label}
                                                               </span>
                                                          </div>
                                                       </td>

                                                       {/* 11. Ngày đến hạn */}
                                                       <td className="px-3 py-4 whitespace-nowrap">
                                                           <span className={`tabular-nums ${status.overdue ? 'text-rose-600 font-black' : 'text-slate-500'}`}>
                                                               {item.due_date ? new Date(item.due_date).toLocaleDateString('vi-VN') : '—'}
                                                           </span>
                                                       </td>
                                                       {/* 12. Còn lại */}
                                                       <td className="px-3 py-4 text-right">
                                                           <span className={`tabular-nums ${remaining > 0 ? 'text-rose-600 font-black' : 'text-slate-400 font-medium'}`}>
                                                               {fmt(remaining)}
                                                           </span>
                                                       </td>
                                                   </>
                                               ) : (
                                                   (() => {
                                                       const targetTax = Number(item.internal_debt_invoice || 0);
                                                       const targetActual = Number(item.internal_debt_actual || 0);
                                                       const paid = Number(item.internal_paid || 0);
                                                       
                                                       const tlDebtTax = Math.max(0, targetTax - paid);
                                                       const satecoDebtInternal = paid >= targetTax ? Math.max(0, paid - targetActual) : 0;
                                                       const totalDebt = tlDebtTax + satecoDebtInternal;

                                                       return (
                                                           <>
                                                               {/* {entityShort} Nợ (Thuế) */}
                                                               <td className="px-3 py-4 text-right bg-blue-50/20">
                                                                   <span className={`tabular-nums font-black ${tlDebtTax > 0 ? 'text-blue-600' : 'text-slate-400'}`}>
                                                                       {fmt(tlDebtTax)}
                                                                   </span>
                                                               </td>
                                                               {/* Sateco Nợ (Nội bộ) */}
                                                               <td className="px-3 py-4 text-right bg-indigo-50/20">
                                                                   <span className={`tabular-nums font-black ${satecoDebtInternal > 0 ? 'text-indigo-600' : 'text-slate-400'}`}>
                                                                       {fmt(satecoDebtInternal)}
                                                                   </span>
                                                               </td>
                                                               {/* Tổng Công nợ */}
                                                               <td className="px-3 py-4 text-right">
                                                                   <span className={`tabular-nums font-black ${totalDebt > 0 ? 'text-slate-800' : 'text-slate-400'}`}>
                                                                       {fmt(totalDebt)}
                                                                   </span>
                                                               </td>
                                                               {/* {entityShort} Đã chuyển */}
                                                               <td className="px-3 py-4 text-right">
                                                                   <span className="tabular-nums text-emerald-600 font-black">{fmt(paid)}</span>
                                                               </td>
                                                               {/* Còn nợ Tổng */}
                                                               <td className="px-3 py-4 text-right">
                                                                   <span className={`tabular-nums font-black ${totalDebt > 0 ? (tlDebtTax > 0 ? 'text-rose-600' : 'text-indigo-600') : 'text-slate-400'}`}>
                                                                       {fmt(totalDebt)}
                                                                   </span>
                                                               </td>
                                                           </>
                                                       );
                                                   })()
                                               )}
                                               {/* 13. Thao tác */}
                                               <td className="px-3 py-4 text-center">
                                                   <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                       <button 
                                                           onClick={(e) => { e.stopPropagation(); handleEdit(item); }}
                                                           className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-white flex items-center justify-center transition-all border border-indigo-100"
                                                       >
                                                           <span className="material-symbols-outlined notranslate text-[14px]" translate="no">edit</span>
                                                       </button>
                                                       <button 
                                                           onClick={(e) => {
                                                               e.stopPropagation();
                                                               setItemToDelete(item);
                                                               setShowDeleteConfirm(true);
                                                           }}
                                                           className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 hover:bg-white flex items-center justify-center transition-all border border-rose-100"
                                                       >
                                                           <span className="material-symbols-outlined notranslate text-[14px]" translate="no">delete</span>
                                                       </button>
                                                   </div>
                                               </td>
                                          </tr>

                                          {/* Expanded History Row */}
                                          {expandedId === item.id && (
                                              <tr className="bg-slate-50 border-b border-slate-100 animate-in slide-in-from-top-1 duration-300">
                                                  <td colSpan="13" className="p-0">
                                                      <div className="px-8 py-6 bg-white shadow-inner border-x-4 border-blue-500">
                                                          <div className="flex items-center justify-between mb-4">
                                                              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                                                  <span className="w-6 h-[1px] bg-slate-200"></span>
                                                                  LỊCH SỬ THANH TOÁN CHI TIẾT
                                                              </h4>
                                                              <div className="text-[10px] font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
                                                                  Dự án: <span className="text-blue-600">{item.projects?.internal_code || item.projects?.code}</span>
                                                              </div>
                                                          </div>

                                                          {historyLoading ? (
                                                              <div className="py-8 flex flex-col items-center justify-center gap-2">
                                                                  <div className="w-6 h-6 border-2 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
                                                                  <p className="text-[10px] text-slate-400 font-bold italic">Đang tải dữ liệu...</p>
                                                              </div>
                                                          ) : paymentHistory.length === 0 ? (
                                                               <div className="py-10 text-center bg-slate-50/50 rounded-[24px] border border-dashed border-slate-200 flex flex-col items-center justify-center gap-4">
                                                                   <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-300">
                                                                       <span className="material-symbols-outlined notranslate text-3xl" translate="no">history</span>
                                                                   </div>
                                                                   <div className="max-w-xs">
                                                                       <p className="text-[11px] text-slate-500 font-black uppercase tracking-wider mb-1">Chưa có bản ghi lịch sử</p>
                                                                       <p className="text-[10px] text-slate-400 font-medium leading-relaxed italic">Hồ sơ này có thể đã được nhập số tổng từ trước mà chưa có chi tiết các lần thu.</p>
                                                                   </div>
                                                                   
                                                                   {Number(item.external_income || 0) > 0 && (
                                                                       <button 
                                                                           onClick={(e) => { e.stopPropagation(); generateHistory(item); }}
                                                                           className="mt-2 px-6 py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-xl text-[10px] font-black transition-all border border-emerald-100 flex items-center gap-2 group"
                                                                       >
                                                                           <span className="material-symbols-outlined notranslate text-[16px]" translate="no">auto_fix</span>
                                                                           TẠO NHANH BẢN GHI LỊCH SỬ ({fmt(item.external_income)} ₫)
                                                                       </button>
                                                                   )}
                                                               </div>
                                                           ) : (
                                                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                                                  {paymentHistory.map((hist, idx) => (
                                                                      <div key={hist.id} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-start gap-4">
                                                                          <div className="w-8 h-8 rounded-full bg-slate-50 text-slate-400 text-[10px] font-black flex items-center justify-center">
                                                                              {paymentHistory.length - idx}
                                                                          </div>
                                                                          <div className="flex-1">
                                                                              <div className="flex justify-between items-start mb-1">
                                                                                  <span className="text-[11px] font-black text-slate-700">{new Date(hist.payment_date).toLocaleDateString('vi-VN')}</span>
                                                                                  <span className="text-sm font-black text-emerald-600 tabular-nums">{fmt(hist.amount)} <span className="text-[9px]">₫</span></span>
                                                                              </div>
                                                                              <p className="text-[10px] text-slate-400 font-medium italic line-clamp-2 leading-relaxed">{hist.description || '(Không có ghi chú)'}</p>
                                                                          </div>
                                                                      </div>
                                                                  ))}
                                                              </div>
                                                          )}
                                                          
                                                          <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end items-center gap-3">
                                                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">TỔNG CỘNG ĐÃ THU:</span>
                                                              <span className="text-base font-black text-emerald-600 tabular-nums">
                                                                  {fmt(paymentHistory.reduce((sum, h) => sum + Number(h.amount), 0))} <span className="text-[11px]">₫</span>
                                                              </span>
                                                          </div>
                                                      </div>
                                                  </td>
                                              </tr>
                                          )}
                                      </React.Fragment>
                                  );
                              })}
                         </tbody>
                     </table>
                 </div>
             </div>


            {/* Popup Modal for New Payment Submission */}
            {showModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowModal(false)}></div>
                    <div className="bg-white w-full max-w-4xl rounded-[32px] shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                        {/* Modal Header */}
                        <div className="bg-slate-50 px-8 py-6 border-b border-slate-100 flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-black text-slate-800">{isEditing ? 'Chỉnh sửa Hồ sơ Thanh toán' : 'Tạo Hồ sơ Thanh toán mới'}</h3>
                                <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Thông tin đề nghị và xuất hóa đơn</p>
                            </div>
                            <button onClick={() => setShowModal(false)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-200 transition-colors text-slate-400">
                                <span className="material-symbols-outlined notranslate" translate="no">close</span>
                            </button>
                        </div>

                        {/* Modal Body */}
                        <form onSubmit={handleSubmit} className="p-8 overflow-y-auto flex-1 border-b border-slate-100">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* Left Column: Project & Code */}
                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Chọn Dự án / Hợp đồng <span className="text-rose-500">*</span></label>
                                        <select 
                                            value={form.projectId}
                                            onChange={(e) => handleProjectChange(e.target.value)}
                                            className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition-all font-bold text-slate-700"
                                            required
                                            disabled={isEditing}
                                        >
                                            <option value="">-- Chọn dự án --</option>
                                            {projects
                                                .filter(p => activeEntity === 'all' || activeEntity === 'sateco' || (p.acting_entity_key || 'thanglong').toLowerCase() === activeEntity)
                                                .map(p => (
                                                    <option key={p.id} value={p.id}>{p.internal_code || p.code}</option>
                                                ))
                                            }
                                        </select>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Mã thanh toán {entityLabel} <span className="text-emerald-500 italic opacity-80">(Tự động)</span></label>
                                        <input 
                                            type="text" 
                                            value={form.paymentCode}
                                            onChange={(e) => setForm({...form, paymentCode: e.target.value})}
                                            className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 font-black text-blue-600 outline-none focus:border-blue-500"
                                            placeholder="VD: DA-001-IPC01"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Đợt thanh toán <span className="text-emerald-500 italic opacity-80">(Ghi thay đổi được)</span></label>
                                        <input 
                                            type="text" 
                                            list="stage-suggestions"
                                            value={form.stageName}
                                            onChange={(e) => handleStageChange(e.target.value)}
                                            className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition-all font-bold text-slate-700 bg-white"
                                            placeholder="Nhập hoặc chọn đợt..."
                                        />
                                        <datalist id="stage-suggestions">
                                            {STANDARD_STAGES.map(st => (
                                                <option key={st} value={st} />
                                            ))}
                                        </datalist>
                                    </div>

                                    {duplicateWarning && (
                                        <div className="bg-rose-50 text-rose-600 px-4 py-2 rounded-xl text-[11px] font-bold animate-in slide-in-from-top-1 duration-200 border border-rose-100 flex items-center gap-2">
                                            <span className="material-symbols-outlined notranslate text-[16px]" translate="no">warning</span>
                                            {duplicateWarning}
                                        </div>
                                    )}
                                </div>

                                {/* Right Column: Status & Amounts */}
                                <div className="space-y-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Giá trị ĐNTT (₫)</label>
                                            <input 
                                                type="text" 
                                                value={formatInput(form.requestAmount)}
                                                onChange={(e) => handleNumChange('requestAmount', e.target.value)}
                                                className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition-all font-black text-slate-800 text-right pr-6"
                                                placeholder="0"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Giá trị HĐ xuất (₫)</label>
                                            <input 
                                                type="text" 
                                                value={formatInput(form.invoiceAmount)}
                                                onChange={(e) => handleNumChange('invoiceAmount', e.target.value)}
                                                className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition-all font-black text-slate-800 text-right pr-6"
                                                placeholder="0"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Trạng thái Hóa đơn</label>
                                        <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
                                            {['Chưa xuất', 'Đã xuất'].map(status => (
                                                <button
                                                    key={status}
                                                    type="button"
                                                    onClick={() => setForm({...form, invoiceStatus: status })}
                                                    className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all ${
                                                        form.invoiceStatus === status 
                                                        ? (status === 'Đã xuất' ? 'bg-white text-emerald-600 shadow-sm ring-1 ring-slate-200' : 'bg-white text-rose-600 shadow-sm ring-1 ring-slate-200')
                                                        : 'text-slate-400 hover:text-slate-600'
                                                    }`}
                                                >
                                                    {status}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Ngày đề nghị / Xuất HĐ</label>
                                            <input 
                                                type="date" 
                                                value={form.requestDate}
                                                onChange={(e) => handleRequestDateChange(e.target.value)}
                                                className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition-all font-bold text-slate-700"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1 text-amber-700">Ngày trả dự kiến</label>
                                            <input 
                                                type="date" 
                                                value={form.dueDate}
                                                onChange={(e) => setForm({...form, dueDate: e.target.value})}
                                                className="w-full px-4 py-3 rounded-2xl border border-amber-200 bg-amber-50 text-amber-900 font-bold focus:border-amber-500 outline-none"
                                            />
                                        </div>
                                    </div>

                                </div>
                            </div>

                            <div className="mt-6 space-y-2">
                                <label className="text-[11px] font-black text-emerald-600 uppercase tracking-widest ml-1 flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[14px]">account_balance</span>
                                    Cấu hình VAT Nội bộ Sateco
                                </label>
                                <div className="flex items-center gap-3 bg-emerald-50 p-3 rounded-2xl border border-emerald-100">
                                    <input 
                                        type="number" step="1" min="0" max="100"
                                        value={form.internalVat}
                                        onChange={(e) => setForm({...form, internalVat: e.target.value})}
                                        className="w-24 px-4 py-2.5 rounded-xl border border-emerald-200 focus:border-emerald-500 font-black text-emerald-700 outline-none text-center"
                                        placeholder="8"
                                    />
                                    <span className="text-[11px] font-bold text-emerald-700">% <span className="text-emerald-600/70 font-medium ml-1">(Mặc định 8%. Dùng tính HĐ Trước VAT)</span></span>
                                </div>
                            </div>

                            <div className="mt-6 space-y-2">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Ghi chú bổ sung</label>
                                <textarea 
                                    rows="1"
                                    value={form.notes}
                                    onChange={(e) => setForm({...form, notes: e.target.value})}
                                    className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition-all font-medium text-slate-700 resize-none"
                                    placeholder="Nhập thông tin bổ sung nếu có..."
                                ></textarea>
                            </div>

                            <div className="mt-10 flex items-center justify-end gap-3">
                                <button 
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-6 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-colors"
                                >
                                    Hủy bỏ
                                </button>
                                <button 
                                    type="submit"
                                    className="px-10 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black shadow-lg shadow-emerald-100 transition-all active:scale-95 flex items-center gap-2"
                                >
                                    <span className="material-symbols-outlined notranslate text-[20px]" translate="no">save</span>
                                    {isEditing ? 'CẬP NHẬT' : 'LƯU HỒ SƠ'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(false)}></div>
                    <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100">
                        <div className="p-8 text-center">
                            <div className="w-20 h-20 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-600 mx-auto mb-6 shadow-sm border border-rose-100">
                                <span className="material-symbols-outlined notranslate text-4xl" translate="no">delete_forever</span>
                            </div>
                            <h3 className="text-xl font-black text-slate-800 mb-2">Xác nhận xóa?</h3>
                            <p className="text-slate-500 text-sm font-medium leading-relaxed">
                                Bạn có chắc chắn muốn xóa hồ sơ <span className="text-rose-600 font-black">{itemToDelete?.stage_name}</span> của dự án <span className="font-bold text-slate-700">{itemToDelete?.projects?.internal_code || itemToDelete?.projects?.code}</span>? Hành động này không thể hoàn tác.
                            </p>
                        </div>
                        <div className="bg-slate-50 p-6 flex gap-3 border-t border-slate-100">
                            <button 
                                onClick={() => setShowDeleteConfirm(false)}
                                className="flex-1 py-3 bg-white hover:bg-slate-100 text-slate-600 font-bold rounded-xl border border-slate-200 transition-all active:scale-95"
                            >
                                Hủy bỏ
                            </button>
                            <button 
                                onClick={handleDelete}
                                className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl shadow-lg shadow-rose-100 transition-all active:scale-95"
                            >
                                Xóa ngay
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
