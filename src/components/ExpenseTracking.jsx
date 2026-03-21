import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../context/ToastContext';

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

    useEffect(() => {
        fetchData();
        fetchProjects();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('expenses')
            .select('*, projects(name, code)')
            .order('expense_date', { ascending: false });
        if (error) toast.error('Lỗi tải dữ liệu');
        else setExpenses(data || []);
        setLoading(false);
    };

    const fetchProjects = async () => {
        const { data } = await supabase.from('projects').select('id, name, code');
        setProjects(data || []);
    };

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
            fetchData();
            setForm({ projectId: '', expenseType: 'BCH công trường', amount: '', paidAmount: '', expenseDate: new Date().toISOString().split('T')[0], paidDate: new Date().toISOString().split('T')[0], description: '' });
        }
    };

    const filtered = expenses.filter(x => filterProject === 'all' || x.project_id === filterProject);

    const fmt = (v) => new Intl.NumberFormat('vi-VN').format(v || 0);

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
                    <select 
                        value={filterProject} 
                        onChange={(e) => setFilterProject(e.target.value)}
                        className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value="all">Tất cả dự án</option>
                        {projects.map(p => <option key={p.id} value={p.id}>[{p.code}] {p.name}</option>)}
                    </select>
                </div>

                <div className="overflow-x-auto">
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
                                <tr><td colSpan={6} className="py-10 text-center text-slate-400 font-medium">Đang tải...</td></tr>
                            ) : filtered.length === 0 ? (
                                <tr><td colSpan={6} className="py-10 text-center text-slate-400 font-medium">Chưa có dữ liệu chi phí</td></tr>
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
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-[32px] w-full max-w-md shadow-2xl overflow-hidden animate-slide-up">
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
        </div>
    );
}
