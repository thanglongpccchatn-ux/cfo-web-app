import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../context/ToastContext';
import { fmt } from '../utils/formatters';

const EXPENSE_TYPES = [
    { value: 'BCH công trường', label: 'BCH Công trường (Kế toán nội bộ)', color: 'amber' },
    { value: 'Nghiệm thu/Thẩm duyệt', label: 'Thẩm duyệt / Nghiệm thu (Kế toán nội bộ)', color: 'cyan' },
    { value: 'Vận hành', label: 'Chi phí Vận hành (Nhân sự)', color: 'indigo' },
    { value: 'Khác', label: 'Chi phí Khác (Kế toán thuế)', color: 'slate' },
    { value: 'Máy thi công', label: 'Máy thi công', color: 'rose' },
    { value: 'Chi phí chung', label: 'Chi phí chung', color: 'slate' }
];

export default function ExpenseTracking() {
    const [expenses, setExpenses] = useState([]);
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [filterProject, setFilterProject] = useState('all');
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const toast = useToast();

    const [form, setForm] = useState({
        projectId: '',
        expenseType: 'BCH công trường',
        amount: '',
        paidAmount: '',
        expenseDate: new Date().toISOString().split('T')[0],
        paidDate: new Date().toISOString().split('T')[0],
        description: ''
    });

    const fetchData = React.useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('expenses')
            .select('*, projects(name, code)')
            .order('expense_date', { ascending: false });
        if (error) toast.error('Lỗi tải dữ liệu');
        else setExpenses(data || []);
        setLoading(false);
    }, [toast]);

    const fetchProjects = React.useCallback(async () => {
        const { data } = await supabase.from('projects').select('id, name, code');
        setProjects(data || []);
    }, []);

    useEffect(() => {
        fetchData();
        fetchProjects();
    }, [fetchData, fetchProjects]);

    const handleNumChange = (field, value) => {
        const clean = value.replace(/[^0-9]/g, '');
        setForm(prev => ({ ...prev, [field]: clean }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const payload = {
            project_id: form.projectId,
            expense_type: form.expenseType,
            amount: Number(form.amount) || 0,
            paid_amount: Number(form.paidAmount) || 0,
            expense_date: form.expenseDate,
            paid_date: form.paidAmount > 0 ? (form.paidDate || form.expenseDate) : null,
            description: form.description
        };

        let err;
        if (isEditing) {
            const { error } = await supabase.from('expenses').update(payload).eq('id', editingId);
            err = error;
        } else {
            const { error } = await supabase.from('expenses').insert([payload]);
            err = error;
        }

        if (err) {
            toast.error('Lỗi khi lưu: ' + err.message);
        } else {
            toast.success('Đã lưu chi phí');
            setShowModal(false);
            setIsEditing(false);
            setEditingId(null);
            fetchData();
            setForm({ projectId: '', expenseType: 'BCH công trường', amount: '', paidAmount: '', expenseDate: new Date().toISOString().split('T')[0], paidDate: new Date().toISOString().split('T')[0], description: '' });
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
            fetchData();
        }
    };

    const filtered = expenses.filter(x => filterProject === 'all' || x.project_id === filterProject);



    return (
        <div className="p-6 space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-black text-slate-800">Quản lý Chi phí Chung</h2>
                    <p className="text-sm text-slate-500">Dành cho bộ phận Kế toán nội bộ, Nhân sự, Thuế</p>
                </div>
                <button 
                    onClick={() => { setIsEditing(false); setShowModal(true); }}
                    className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all"
                >
                    <span className="material-symbols-outlined notranslate" translate="no">add</span>
                    Ghi nhận chi phí mới
                </button>
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
                            {projects.map(p => <option key={p.id} value={p.id}>Dự án: {p.code}</option>)}
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
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-slate-400 font-bold text-[10px] uppercase tracking-wider">
                            <tr>
                                <th className="px-6 py-3 text-left w-32">Ngày</th>
                                <th className="px-6 py-3 text-left">Dự án</th>
                                <th className="px-6 py-3 text-left">Loại chi phí</th>
                                <th className="px-6 py-3 text-right">Kế hoạch (Phải chi)</th>
                                <th className="px-6 py-3 text-right">Thực chi</th>
                                <th className="px-6 py-3 text-left">Ngày thực chi</th>
                                <th className="px-6 py-3 text-right">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr><td colSpan={7} className="py-10 text-center text-slate-400 font-medium">Đang tải...</td></tr>
                            ) : filtered.length === 0 ? (
                                <tr><td colSpan={7} className="py-10 text-center text-slate-400 font-medium">Chưa có dữ liệu chi phí</td></tr>
                            ) : filtered.map(item => (
                                <tr key={item.id} className="hover:bg-slate-50/50 group transition-colors">
                                    <td className="px-6 py-4 font-medium text-slate-600 font-mono text-xs">{new Date(item.expense_date).toLocaleDateString('vi-VN')}</td>
                                    <td className="px-6 py-4">
                                        <p className="font-bold text-slate-800">{item.projects?.name}</p>
                                        <p className="text-[10px] text-slate-400 uppercase font-bold">{item.projects?.code}</p>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter bg-slate-100 text-slate-600`}>
                                            {item.expense_type}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right font-bold text-slate-700">{fmt(item.amount)}</td>
                                    <td className="px-6 py-4 text-right font-black text-rose-600 bg-rose-50/30">{fmt(item.paid_amount)}</td>
                                    <td className="px-6 py-4 font-mono text-xs text-slate-500">
                                        {item.paid_date ? new Date(item.paid_date).toLocaleDateString('vi-VN') : '—'}
                                    </td>
                                    <td className="px-6 py-4 text-right">
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
                                            className="p-1 px-2 text-indigo-600 hover:bg-indigo-50 rounded-lg font-bold"
                                        >
                                            Sửa
                                        </button>
                                        <button 
                                            onClick={() => setDeleteConfirm(item)}
                                            className="p-1 px-2 text-rose-600 hover:bg-rose-50 rounded-lg font-bold"
                                        >
                                            Xóa
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowModal(false)} onKeyDown={(e) => e.key === 'Escape' && setShowModal(false)}>
                    <div className="bg-white rounded-[32px] w-full max-w-md shadow-2xl overflow-hidden animate-slide-up" onClick={(e) => e.stopPropagation()}>
                        <div className="px-8 pt-8 pb-4">
                            <h3 className="text-2xl font-black text-slate-800">{isEditing ? 'Cập nhật chi phí' : 'Ghi nhận chi phí mới'}</h3>
                            <p className="text-slate-500 text-sm">Nhập thông tin chi phí và số tiền thực chi.</p>
                        </div>
                        <form onSubmit={handleSubmit} className="px-8 pb-8 space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Dự án</label>
                                <select 
                                    required
                                    value={form.projectId} 
                                    onChange={(e) => setForm({...form, projectId: e.target.value})}
                                    className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="">Chọn dự án...</option>
                                    {projects.map(p => <option key={p.id} value={p.id}>[{p.code}] {p.name}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Loại chi phí (Bộ phận)</label>
                                <select 
                                    value={form.expenseType} 
                                    onChange={(e) => setForm({...form, expenseType: e.target.value})}
                                    className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500"
                                >
                                    {EXPENSE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Ngày chi</label>
                                    <input 
                                        type="date" 
                                        required
                                        value={form.expenseDate} 
                                        onChange={(e) => setForm({...form, expenseDate: e.target.value})}
                                        className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Số tiền (Kế hoạch)</label>
                                    <input 
                                        placeholder="0"
                                        value={fmt(form.amount)}
                                        onChange={(e) => handleNumChange('amount', e.target.value)}
                                        className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 font-bold"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-rose-600 uppercase tracking-widest ml-1">Số tiền Thực chi</label>
                                    <input 
                                        placeholder="0"
                                        value={fmt(form.paidAmount)}
                                        onChange={(e) => handleNumChange('paidAmount', e.target.value)}
                                        className="w-full bg-rose-50 border-none rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-rose-500 font-black text-rose-600"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Ngày thực chi</label>
                                    <input 
                                        type="date" 
                                        value={form.paidDate} 
                                        onChange={(e) => setForm({...form, paidDate: e.target.value})}
                                        className="w-full bg-rose-50 border-none rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-rose-500"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Ghi chú</label>
                                <input 
                                    placeholder="Nội dung chi phí..."
                                    value={form.description} 
                                    onChange={(e) => setForm({...form, description: e.target.value})}
                                    className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button 
                                    type="button" 
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 px-4 py-3 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200"
                                >
                                    Hủy
                                </button>
                                <button 
                                    type="submit"
                                    className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-700 shadow-lg shadow-indigo-100"
                                >
                                    Lưu lại
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

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
