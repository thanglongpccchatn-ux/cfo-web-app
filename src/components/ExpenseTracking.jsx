import React, { useState, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useToast } from '../context/ToastContext';
import { fmt } from '../utils/formatters';
import { autoJournal } from '../lib/accountingService';

const EXPENSE_TYPES = [
    { value: 'BCH công trường', label: 'BCH Công trường (Kế toán nội bộ)', color: 'amber' },
    { value: 'Nghiệm thu/Thẩm duyệt', label: 'Thẩm duyệt / Nghiệm thu (Kế toán nội bộ)', color: 'cyan' },
    { value: 'Vận hành', label: 'Chi phí Vận hành (Nhân sự)', color: 'indigo' },
    { value: 'Khác', label: 'Chi phí Khác (Kế toán thuế)', color: 'slate' },
    { value: 'Máy thi công', label: 'Máy thi công', color: 'rose' },
    { value: 'Chi phí chung', label: 'Chi phí chung', color: 'slate' }
];

function SearchSelect({ value, onChange, options, placeholder = 'Chọn...' }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const btnRef = useRef(null);
    const dropRef = useRef(null);
    const selected = options.find(o => String(o.value) === String(value));
    const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

    React.useEffect(() => {
        const handler = (e) => {
            if (btnRef.current && !btnRef.current.contains(e.target) && dropRef.current && !dropRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleOpen = () => {
        if (!open && btnRef.current) {
            const rect = btnRef.current.getBoundingClientRect();
            setPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
        }
        setOpen(!open);
        setSearch('');
    };

    const filtered = options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="relative w-full">
            <button ref={btnRef} type="button" onClick={handleOpen}
                className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-left focus:ring-1 focus:ring-indigo-500 outline-none truncate flex items-center justify-between gap-1">
                <span className={selected ? 'text-slate-800 font-medium' : 'text-slate-400'}>{selected ? selected.label : placeholder}</span>
                <span className="material-symbols-outlined text-[14px] text-slate-300 shrink-0">expand_more</span>
            </button>
            {open && ReactDOM.createPortal(
                <div ref={dropRef} style={{ position: 'fixed', top: pos.top, left: pos.left, width: Math.max(pos.width, 200), zIndex: 9999 }}
                    className="bg-white border border-slate-200 rounded-xl shadow-2xl max-h-52 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
                    <div className="p-1.5 border-b border-slate-100">
                        <input autoFocus type="text" value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="Gõ để tìm..."
                            className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-indigo-400" />
                    </div>
                    <div className="overflow-y-auto max-h-40">
                        {filtered.length === 0 && <div className="px-3 py-2 text-xs text-slate-400">Không tìm thấy</div>}
                        {filtered.map(o => (
                            <button key={o.value} type="button"
                                onClick={() => { onChange(o.value); setOpen(false); setSearch(''); }}
                                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-indigo-50 transition-colors truncate ${String(o.value) === String(value) ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-700'}`}>
                                {o.label}
                            </button>
                        ))}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}

export default function ExpenseTracking() {
    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [filterProject, setFilterProject] = useState('all');
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const toast = useToast();
    const queryClient = useQueryClient();

    const emptyRow = () => ({
        _key: Date.now() + Math.random(),
        projectId: '',
        expenseType: 'BCH công trường',
        amount: '',
        paidAmount: '',
        requestedDate: new Date().toISOString().split('T')[0],
        expenseDate: new Date().toISOString().split('T')[0],
        paidDate: new Date().toISOString().split('T')[0],
        recipientId: '',
        description: ''
    });

    const [draftRows, setDraftRows] = useState([]);
    const [editForm, setEditForm] = useState(null); // for editing existing row

    // ── React Query: Expenses ──
    const { data: expenses = [], isLoading: loading } = useQuery({
        queryKey: ['expenses'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('expenses')
                .select('*, projects(name, code, internal_code), recipient:profiles!expenses_recipient_id_fkey(full_name)')
                .order('expense_date', { ascending: false });
            if (error) throw error;
            return data || [];
        },
        staleTime: 2 * 60 * 1000,
    });

    // ── React Query: Projects ──
    const { data: projects = [] } = useQuery({
        queryKey: ['expenseProjects'],
        queryFn: async () => {
            const { data } = await supabase.from('projects').select('id, name, code, internal_code');
            return data || [];
        },
        staleTime: 5 * 60 * 1000,
    });

    // ── React Query: Employees ──
    const { data: employees = [] } = useQuery({
        queryKey: ['expenseEmployees'],
        queryFn: async () => {
            const { data } = await supabase.from('profiles').select('id, full_name').eq('status', 'Hoạt động').order('full_name');
            return data || [];
        },
        staleTime: 5 * 60 * 1000,
    });

    const updateDraft = (key, field, value) => {
        setDraftRows(prev => prev.map(r => r._key === key ? { ...r, [field]: value } : r));
    };

    const updateDraftNum = (key, field, value) => {
        const clean = value.replace(/[^0-9]/g, '');
        setDraftRows(prev => prev.map(r => {
            if (r._key === key) {
                if (field === 'amount' && (r.paidAmount === r.amount || !r.paidAmount)) {
                    return { ...r, amount: clean, paidAmount: clean };
                }
                return { ...r, [field]: clean };
            }
            return r;
        }));
    };

    const removeDraft = (key) => {
        setDraftRows(prev => prev.filter(r => r._key !== key));
    };

    const handleApprove = async (id, amount) => {
        const { error } = await supabase.from('expenses')
            .update({ 
                paid_amount: amount, 
                paid_date: new Date().toISOString().split('T')[0] 
            })
            .eq('id', id);
            
        if (error) { toast.error('Lỗi khi duyệt chi: ' + error.message); }
        else {
            // Auto-create journal entry: Nợ 627/642 / Có 112
            const expense = expenses.find(e => e.id === id);
            if (expense) {
                const projectCode = expense.projects?.internal_code || expense.projects?.code || '';
                autoJournal.generalExpense(
                    { ...expense, paid_amount: amount, paid_date: new Date().toISOString().split('T')[0] },
                    projectCode
                ).catch(err => console.warn('[Accounting] Auto journal failed (non-critical):', err));
            }
            toast.success('Đã duyệt chi phí thành công!');
            queryClient.invalidateQueries({ queryKey: ['expenses'] });
        }
    };

    const handleSaveAll = async () => {
        const valid = draftRows.filter(r => r.projectId && (Number(r.amount) > 0 || Number(r.paidAmount) > 0));
        if (valid.length === 0) { toast.warning('Không có dòng hợp lệ để lưu'); return; }
        const payloads = valid.map(r => ({
            project_id: r.projectId,
            expense_type: r.expenseType,
            amount: Number(r.amount) || 0,
            paid_amount: Number(r.paidAmount) || 0,
            requested_date: r.requestedDate || null,
            expense_date: r.expenseDate,
            paid_date: Number(r.paidAmount) > 0 ? (r.paidDate || r.expenseDate) : null,
            recipient_id: r.recipientId || null,
            description: r.description
        }));
        const { error } = await supabase.from('expenses').insert(payloads);
        if (error) {
            toast.error('Lỗi: ' + error.message);
        } else {
            toast.success(`Đã lưu ${valid.length} dòng chi phí`);
            setDraftRows([]);
            queryClient.invalidateQueries({ queryKey: ['expenses'] });
        }
    };

    const handleEditSubmit = async () => {
        if (!editForm) return;
        const payload = {
            project_id: editForm.projectId,
            expense_type: editForm.expenseType,
            amount: Number(editForm.amount) || 0,
            paid_amount: Number(editForm.paidAmount) || 0,
            requested_date: editForm.requestedDate || null,
            expense_date: editForm.expenseDate,
            paid_date: Number(editForm.paidAmount) > 0 ? (editForm.paidDate || editForm.expenseDate) : null,
            recipient_id: editForm.recipientId || null,
            description: editForm.description
        };
        const { error } = await supabase.from('expenses').update(payload).eq('id', editingId);
        if (error) { toast.error('Lỗi: ' + error.message); }
        else {
            toast.success('Đã cập nhật');
            setEditForm(null); setEditingId(null); setIsEditing(false);
            queryClient.invalidateQueries({ queryKey: ['expenses'] });
        }
    };

    const handleDelete = async () => {
        if (!deleteConfirm) return;
        const { error } = await supabase.from('expenses').delete().eq('id', deleteConfirm.id);
        if (error) {
            toast.error('Lỗi khi xóa: ' + error.message);
        } else {
            toast.success('Đã xóa chi phí');
            setDeleteConfirm(null);
            queryClient.invalidateQueries({ queryKey: ['expenses'] });
        }
    };

    const filtered = expenses.filter(x => filterProject === 'all' || x.project_id === filterProject);

    // ── Sort ──
    const [sortCol, setSortCol] = useState(null);
    const [sortDir, setSortDir] = useState('asc');
    const handleSort = (col) => {
        if (sortCol === col) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortCol(col);
            setSortDir('asc');
        }
    };
    const sorted = [...filtered].sort((a, b) => {
        if (!sortCol) return 0;
        let va, vb;
        switch (sortCol) {
            case 'requested_date': va = a.requested_date || ''; vb = b.requested_date || ''; break;
            case 'project': va = a.projects?.internal_code || a.projects?.name || ''; vb = b.projects?.internal_code || b.projects?.name || ''; break;
            case 'expense_type': va = a.expense_type; vb = b.expense_type; break;
            case 'amount': return sortDir === 'asc' ? a.amount - b.amount : b.amount - a.amount;
            case 'paid_amount': return sortDir === 'asc' ? a.paid_amount - b.paid_amount : b.paid_amount - a.paid_amount;
            case 'paid_date': va = a.paid_date || ''; vb = b.paid_date || ''; break;
            case 'recipient': va = a.recipient?.full_name || ''; vb = b.recipient?.full_name || ''; break;
            default: return 0;
        }
        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    });

    // ── Column Resize ──
    const [colWidths, setColWidths] = useState({ requestedDate: 130, project: 100, expenseType: 130, amount: 120, paidAmount: 120, paidDate: 130, recipient: 120, description: 200, actions: 80 });
    const resizing = useRef(null);
    const startResize = useCallback((colKey, e) => {
        e.preventDefault();
        const startX = e.clientX;
        const startW = colWidths[colKey];
        const onMove = (ev) => {
            const diff = ev.clientX - startX;
            setColWidths(prev => ({ ...prev, [colKey]: Math.max(60, startW + diff) }));
        };
        const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }, [colWidths]);

    const cols = [
        { key: 'requestedDate', sortKey: 'requested_date', label: 'Ngày ĐN', align: 'left' },
        { key: 'project', sortKey: 'project', label: 'Dự án', align: 'left' },
        { key: 'expenseType', sortKey: 'expense_type', label: 'Loại chi phí', align: 'left' },
        { key: 'amount', sortKey: 'amount', label: 'Kế hoạch', align: 'right' },
        { key: 'paidAmount', sortKey: 'paid_amount', label: 'Thực chi', align: 'right' },
        { key: 'paidDate', sortKey: 'paid_date', label: 'Ngày thực chi', align: 'left' },
        { key: 'recipient', sortKey: 'recipient', label: 'Người nhận', align: 'left' },
        { key: 'description', sortKey: null, label: 'Ghi chú', align: 'left' },
        { key: 'actions', sortKey: null, label: 'Thao tác', align: 'center' },
    ];



    return (
        <div className="p-6 space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-black text-slate-800">Quản lý Chi phí Chung</h2>
                    <p className="text-sm text-slate-500">Dành cho bộ phận Kế toán nội bộ, Nhân sự, Thuế</p>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[14px] text-indigo-500">receipt_long</span>
                        <select 
                            value={filterProject} 
                            onChange={(e) => setFilterProject(e.target.value)}
                            className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 px-3 py-1 rounded-full text-[12px] font-black focus:ring-2 focus:ring-indigo-500 outline-none transition-all cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-900/30"
                        >
                            <option value="all">Tất cả dự án (Toàn cục)</option>
                            {projects.map(p => <option key={p.id} value={p.id}>Dự án: {p.internal_code || p.code}</option>)}
                        </select>
                    </div>
                </div>

                {/* Mobile Card View */}
                <div className="block xl:hidden space-y-3 p-4 bg-slate-50/30">
                    {loading ? (
                        <div className="py-10 text-center text-slate-400 font-medium bg-white rounded-xl border border-slate-200">Đang tải...</div>
                    ) : filtered.length === 0 ? (
                        <div className="py-10 text-center text-slate-400 font-medium bg-white rounded-xl border border-slate-200">Chưa có dữ liệu chi phí</div>
                    ) : filtered.map((item) => (
                        <div key={item.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm relative group animate-slide-up">
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex-1 pr-2">
                                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1 flex items-center gap-1">
                                        <span className="material-symbols-outlined text-[12px]">calendar_today</span>
                                        {new Date(item.expense_date).toLocaleDateString('vi-VN')}
                                    </div>
                                    <div className="font-bold text-slate-800 leading-tight line-clamp-2">{item.projects?.name}</div>
                                    <div className="text-[10px] text-slate-400 uppercase font-bold mt-1 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 w-fit">{item.projects?.code}</div>
                                </div>
                                <div className="flex gap-1 shrink-0">
                                    <button 
                                        onClick={() => {
                                            setEditingId(item.id);
                                            setIsEditing(true);
                                            setForm({
                                                projectId: item.project_id,
                                                expenseType: item.expense_type,
                                                amount: String(item.amount),
                                                paidAmount: String(item.paid_amount),
                                                expenseDate: item.expense_date,
                                                paidDate: item.paid_date || item.expense_date,
                                                description: item.description || ''
                                            });
                                            setShowModal(true);
                                        }}
                                        className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 shadow-sm active:scale-95 transition-transform"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">edit</span>
                                    </button>
                                    <button 
                                        onClick={() => setDeleteConfirm(item)}
                                        className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100 shadow-sm active:scale-95 transition-transform"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">delete</span>
                                    </button>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2 mb-3">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
                                    {item.expense_type}
                                </span>
                                {item.paid_amount > 0 && (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-100">
                                        Đã chi: {new Date(item.paid_date).toLocaleDateString('vi-VN')}
                                    </span>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-50">
                                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Kế hoạch</div>
                                    <div className="text-sm font-black text-slate-700 tabular-nums">{fmt(item.amount)}</div>
                                </div>
                                <div className="p-2.5 rounded-xl bg-orange-50/50 border border-orange-100">
                                    <div className="text-[9px] font-black text-orange-600 uppercase tracking-widest mb-1">Thực chi</div>
                                    <div className="text-sm font-black text-orange-700 tabular-nums">{fmt(item.paid_amount)}</div>
                                </div>
                            </div>

                            {item.description && (
                                <p className="mt-3 text-[11px] text-slate-500 italic line-clamp-2 leading-relaxed">
                                    "{item.description}"
                                </p>
                            )}
                        </div>
                    ))}
                </div>

                <div className="hidden xl:block overflow-x-auto">
                    <table className="w-full text-sm" style={{tableLayout:'fixed'}}>
                        <thead className="bg-slate-50 text-slate-400 font-bold text-[10px] uppercase tracking-wider">
                            <tr>
                                {cols.map(col => (
                                    <th key={col.key} className={`px-4 py-3 text-${col.align} relative select-none group/th`} style={{width: colWidths[col.key]}}>
                                        <span className={`cursor-pointer hover:text-slate-600 inline-flex items-center gap-0.5 ${col.sortKey ? '' : 'cursor-default'}`} onClick={() => col.sortKey && handleSort(col.sortKey)}>
                                            {col.label}
                                            {sortCol === col.sortKey && <span className="material-symbols-outlined text-[12px] text-indigo-500">{sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward'}</span>}
                                        </span>
                                        <div onMouseDown={(e) => startResize(col.key, e)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-indigo-400/40 opacity-0 group-hover/th:opacity-100 transition-opacity" />
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr><td colSpan={9} className="py-10 text-center text-slate-400 font-medium">Đang tải...</td></tr>
                            ) : sorted.length === 0 && draftRows.length === 0 ? (
                                <tr><td colSpan={9} className="py-10 text-center text-slate-400 font-medium">Chưa có dữ liệu chi phí</td></tr>
                            ) : sorted.map(item => (
                                <tr key={item.id} className="hover:bg-slate-50/50 group transition-colors">
                                    <td className="px-4 py-3 font-mono text-xs text-slate-400">{item.requested_date ? new Date(item.requested_date).toLocaleDateString('vi-VN') : <span className="text-slate-200">—</span>}</td>
                                    <td className="px-4 py-3">
                                        <p className="font-bold text-slate-800 text-xs">{item.projects?.internal_code || item.projects?.name}</p>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-slate-100 text-slate-600">
                                            {item.expense_type}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right font-bold text-slate-700 text-xs">{fmt(item.amount)}</td>
                                    <td className="px-4 py-3 text-right font-black text-rose-600 bg-rose-50/30 text-xs">{fmt(item.paid_amount)}</td>
                                    <td className="px-4 py-3 font-mono text-[10px] text-slate-500">
                                        {item.paid_date ? new Date(item.paid_date).toLocaleDateString('vi-VN') : '—'}
                                    </td>
                                    <td className="px-4 py-3 text-xs text-slate-600 font-medium truncate">{item.recipient?.full_name || <span className="text-slate-200">—</span>}</td>
                                    <td className="px-4 py-3 text-xs text-slate-500 truncate" title={item.description}>{item.description || ''}</td>
                                    <td className="px-4 py-3 text-right flex items-center justify-end gap-1">
                                        {(Number(item.amount) > 0 && Number(item.paid_amount) === 0) && (
                                            <button 
                                                onClick={() => handleApprove(item.id, item.amount)}
                                                title="Duyệt chi số tiền này"
                                                className="p-1 px-2.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg font-black text-[10px] uppercase tracking-wider flex items-center gap-1 border border-emerald-200/50 shadow-sm transition-all"
                                            >
                                                <span className="material-symbols-outlined text-[14px]">payments</span> Duyệt
                                            </button>
                                        )}
                                        <button 
                                            onClick={() => {
                                                setEditingId(item.id);
                                                setIsEditing(true);
                                                setEditForm({
                                                    projectId: item.project_id,
                                                    expenseType: item.expense_type,
                                                    amount: String(item.amount),
                                                    paidAmount: String(item.paid_amount),
                                                    requestedDate: item.requested_date || '',
                                                    expenseDate: item.expense_date,
                                                    paidDate: item.paid_date || item.expense_date,
                                                    recipientId: item.recipient_id || '',
                                                    description: item.description || ''
                                                });
                                            }}
                                            className="p-1 px-2 text-indigo-600 hover:bg-indigo-50 rounded-lg font-bold text-xs"
                                        >
                                            Sửa
                                        </button>
                                        <button 
                                            onClick={() => setDeleteConfirm(item)}
                                            className="p-1 px-2 text-rose-600 hover:bg-rose-50 rounded-lg font-bold text-xs"
                                        >
                                            Xóa
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {/* Draft rows for new entries */}
                            {draftRows.map(row => (
                                <tr key={row._key} className="bg-indigo-50/50 border-t border-indigo-100">
                                    <td className="px-2 py-1.5"><input type="date" value={row.requestedDate} onChange={e => updateDraft(row._key, 'requestedDate', e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 outline-none" /></td>
                                    <td className="px-2 py-1.5">
                                        <SearchSelect
                                            value={row.projectId}
                                            onChange={(val) => updateDraft(row._key, 'projectId', val)}
                                            options={projects.map(p => ({ value: p.id, label: p.internal_code || p.name }))}
                                            placeholder="Chọn DA..."
                                        />
                                    </td>
                                    <td className="px-2 py-1.5">
                                        <select value={row.expenseType} onChange={e => updateDraft(row._key, 'expenseType', e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 outline-none">
                                            {EXPENSE_TYPES.map(t => <option key={t.value} value={t.value}>{t.value}</option>)}
                                        </select>
                                    </td>
                                    <td className="px-2 py-1.5"><input placeholder="0" value={fmt(row.amount)} onChange={e => updateDraftNum(row._key, 'amount', e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-right font-bold focus:ring-1 focus:ring-indigo-500 outline-none" /></td>
                                    <td className="px-2 py-1.5">
                                        <div className="w-full bg-slate-50 border border-slate-100 rounded-lg px-2 py-1.5 text-[10px] text-center italic text-slate-400 font-medium">Chờ duyệt chi</div>
                                    </td>
                                    <td className="px-2 py-1.5">
                                        <div className="w-full bg-slate-50 border border-slate-100 rounded-lg px-2 py-1.5 text-[10px] text-center italic text-slate-400 font-medium">—</div>
                                    </td>
                                    <td className="px-2 py-1.5">
                                        <SearchSelect
                                            value={row.recipientId}
                                            onChange={(val) => updateDraft(row._key, 'recipientId', val)}
                                            options={employees.map(e => ({ value: e.id, label: e.full_name }))}
                                            placeholder="Chọn..."
                                        />
                                    </td>
                                    <td className="px-2 py-1.5"><input placeholder="Ghi chú..." value={row.description} onChange={e => updateDraft(row._key, 'description', e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 outline-none" /></td>
                                    <td className="px-2 py-1.5 text-center">
                                        <button onClick={() => removeDraft(row._key)} className="p-1 text-slate-400 hover:text-rose-500 transition-colors"><span className="material-symbols-outlined text-[16px]">close</span></button>
                                    </td>
                                </tr>
                            ))}
                            {/* + Thêm dòng + Lưu */}
                            <tr>
                                <td colSpan={9} className="px-4 py-2">
                                    <div className="flex items-center gap-3">
                                        <button onClick={() => setDraftRows(prev => [...prev, emptyRow()])} className="text-indigo-600 hover:text-indigo-800 font-bold text-xs flex items-center gap-1 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors">
                                            <span className="material-symbols-outlined text-[16px]">add</span> Thêm dòng
                                        </button>
                                        {draftRows.length > 0 && (
                                            <>
                                                <button onClick={handleSaveAll} className="bg-indigo-600 text-white font-bold text-xs flex items-center gap-1 px-4 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm">
                                                    <span className="material-symbols-outlined text-[14px]">check</span> Lưu tất cả ({draftRows.length})
                                                </button>
                                                <button onClick={() => setDraftRows([])} className="text-slate-400 hover:text-slate-600 font-bold text-xs flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                                                    Hủy bỏ
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Delete Confirm Modal */}
            {deleteConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in" onClick={() => setDeleteConfirm(null)}>
                    <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-slide-up" onClick={(e) => e.stopPropagation()}>
                        <div className="p-6 text-center">
                            <div className="w-14 h-14 mx-auto rounded-full bg-rose-100 flex items-center justify-center mb-4">
                                <span className="material-symbols-outlined text-rose-600 text-3xl">delete_forever</span>
                            </div>
                            <h3 className="text-lg font-black text-slate-800 mb-2">Xác nhận xóa?</h3>
                            <p className="text-sm text-slate-500">Bạn có chắc muốn xóa chi phí cho dự án <strong>{deleteConfirm.projects?.name}</strong>?</p>
                        </div>
                        <div className="flex border-t border-slate-100">
                            <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-3.5 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors">Hủy</button>
                            <button onClick={handleDelete} className="flex-1 py-3.5 text-sm font-black text-rose-600 hover:bg-rose-50 transition-colors border-l border-slate-100">Xóa</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
