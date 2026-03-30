import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useToast } from '../context/ToastContext';
import { fmt } from '../utils/formatters';


export default function InflowPlanning() {
    const [showModal, setShowModal] = useState(false);
    const [filterMonth, setFilterMonth] = useState('All');
    const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());
    const { success, error: showError } = useToast();
    
    const [form, setForm] = useState({
        id: null,
        projectId: '',
        stageName: '',
        stageType: 'Nghiệm thu',
        dueDate: new Date().toISOString().split('T')[0],
        amount: '',
        status: 'Chờ thanh toán'
    });

    const queryClient = useQueryClient();
    const invalidateInflow = () => queryClient.invalidateQueries({ queryKey: ['inflowPlanningData'] });

    // ── React Query: Projects + Payments + Last Pay Dates ──
    const { data: queryData, isLoading: loading } = useQuery({
        queryKey: ['inflowPlanningData'],
        queryFn: async () => {
            const { data: projData } = await supabase.from('projects').select('*, partners!projects_partner_id_fkey(name, code)').order('created_at', { ascending: false });
            const { data: payData } = await supabase.from('payments').select(`
                *,
                projects ( name, code, internal_code, partners ( code ) )
            `).order('due_date', { ascending: true });

            let lastPayMap = {};
            if (payData && payData.length > 0) {
                const ids = payData.map(s => s.id);
                const { data: extHist } = await supabase.from('external_payment_history')
                    .select('payment_stage_id, payment_date')
                    .in('payment_stage_id', ids)
                    .order('payment_date', { ascending: false });
                if (extHist) extHist.forEach(h => { 
                    if (!lastPayMap[h.payment_stage_id]) lastPayMap[h.payment_stage_id] = h.payment_date; 
                });
            }
            return { projects: projData || [], payments: payData || [], lastPayDates: lastPayMap };
        },
        staleTime: 2 * 60 * 1000,
    });

    const projects = queryData?.projects || [];
    const payments = queryData?.payments || [];
    const lastPayDates = queryData?.lastPayDates || {};

    const selectedProject = projects.find(p => p.id === form.projectId);
    const rawMilestones = selectedProject?.payment_schedule || [];
    const projectPayments = payments.filter(p => p.project_id === form.projectId);
    
    const milestones = rawMilestones.map(m => {
        const relatedPayments = projectPayments.filter(p => p.stage_name === m.name);
        const totalCollected = relatedPayments.reduce((sum, p) => sum + Number(p.external_income || 0), 0);
        const remaining = Number(m.amount) - totalCollected;
        return {
            ...m,
            remaining: remaining > 0 ? remaining : 0,
            totalCollected
        };
    }).filter(m => m.remaining > 0 || m.name === form.stageName);

    const allUnpaidDebts = payments.filter(pay => {
        const request = Number(pay.payment_request_amount || 0);
        const income = Number(pay.external_income || 0);
        return request > 0 && request > income;
    }).map(pay => {
        const remaining = Number(pay.payment_request_amount || 0) - Number(pay.external_income || 0);
        return {
            id: pay.id,
            projectId: pay.project_id,
            projectCode: pay.projects?.internal_code || pay.projects?.code || '---',
            projectName: pay.projects?.name,
            stageName: pay.stage_name,
            stageType: pay.stage_type || 'Nghiệm thu',
            remaining,
            dueDate: pay.due_date,
            status: pay.status
        };
    });

    // Filtering logic
    const filteredPayments = payments.filter(item => {
        const date = new Date(item.due_date);
        const matchMonth = filterMonth === 'All' || (date.getMonth() + 1).toString() === filterMonth;
        const matchYear = filterYear === 'All' || date.getFullYear().toString() === filterYear;
        const showActive = !item.external_income || item.payment_request_amount > 0;
        return matchMonth && matchYear && showActive;
    });

    const years = ['All', ...new Set(payments.map(p => new Date(p.due_date).getFullYear().toString()))].sort().reverse();
    const months = ['All', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

    const handleNumChange = (val) => {
        const num = val.replace(/\./g, '').replace(/,/g, '');
        if (!isNaN(num)) setForm({ ...form, amount: num });
    };



    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                project_id: form.projectId,
                stage_name: form.stageName,
                stage_type: form.stageType,
                due_date: form.dueDate,
                payment_request_amount: Number(form.amount),
                status: form.status
            };

            if (form.id) {
                const { error: updateErr } = await supabase.from('payments').update(payload).eq('id', form.id);
                if (updateErr) throw updateErr;
                success('Cập nhật kế hoạch thành công');
            } else {
                const { error: insertErr } = await supabase.from('payments').insert([payload]);
                if (insertErr) throw insertErr;
                success('Ghi nhận kế hoạch mới thành công');
            }

            setShowModal(false);
            setForm({ id: null, projectId: '', stageName: '', stageType: 'Nghiệm thu', dueDate: new Date().toISOString().split('T')[0], amount: '', status: 'Chờ thanh toán' });
            invalidateInflow();
        } catch (err) {
            showError('Lỗi: ' + err.message);
        }
    };

    const deletePlan = async (id) => {
        if (!window.confirm('Bạn có chắc muốn xóa kế hoạch này?')) return;
        const { error: delErr } = await supabase.from('payments').delete().eq('id', id);
        if (delErr) showError('Lỗi xóa');
        else {
            success('Đã xóa');
            invalidateInflow();
        }
    };

    if (loading) return <div className="p-10 text-center text-slate-400">Đang tải...</div>;

    return (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200/60 overflow-hidden">
            {/* HEADER */}
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-slate-50 to-white">
                <div>
                    <h3 className="text-xl font-black text-slate-800 tracking-tight">Kế hoạch Thu tiền</h3>
                    <p className="text-slate-400 text-xs mt-0.5">Quản lý dòng tiền về chi tiết theo từng dự án & mốc thanh toán.</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex bg-slate-100 p-1 rounded-2xl">
                        <select 
                            value={filterMonth}
                            onChange={(e) => setFilterMonth(e.target.value)}
                            className="bg-transparent border-none text-xs font-bold text-slate-600 focus:ring-0 cursor-pointer px-3"
                        >
                            <option value="All">Tất cả tháng</option>
                            {months.filter(m => m !== 'All').map(m => <option key={m} value={m}>Tháng {m}</option>)}
                        </select>
                        <div className="w-[1px] h-4 bg-slate-300 self-center"></div>
                        <select 
                            value={filterYear}
                            onChange={(e) => setFilterYear(e.target.value)}
                            className="bg-transparent border-none text-xs font-bold text-slate-600 focus:ring-0 cursor-pointer px-3"
                        >
                            <option value="All">Tất cả năm</option>
                            {years.filter(y => y !== 'All').map(y => <option key={y} value={y}>Năm {y}</option>)}
                        </select>
                    </div>
                    <button 
                        onClick={() => {
                            setForm({ id: null, projectId: '', stageName: '', stageType: 'Nghiệm thu', dueDate: new Date().toISOString().split('T')[0], amount: '', status: 'Chờ thanh toán' });
                            setShowModal(true);
                        }}
                        className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                    >
                        <span className="material-symbols-outlined text-[20px]">add_circle</span>
                        Ghi nhận kế hoạch mới
                    </button>
                </div>
            </div>

            {/* TABLE */}
            <div className="overflow-x-auto p-2 bg-slate-50/30">
                <table className="w-full text-left border-separate border-spacing-y-0.5 max-w-6xl">
                    <thead>
                        <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">
                            <th className="px-3 py-2 w-48">Dự án</th>
                            <th className="px-3 py-2 w-20">Đối tác</th>
                            <th className="px-3 py-2 text-center w-24">Đợt TT</th>
                            <th className="px-3 py-2 text-center w-28">Ngày dự kiến</th>
                            <th className="px-3 py-2 text-right w-32">Kế hoạch</th>
                            <th className="px-3 py-2 text-center w-20">T/Thái</th>
                            <th className="px-3 py-2 text-right w-32">Thực thu</th>
                            <th className="px-3 py-2 text-center w-28">Ngày thực</th>
                            <th className="px-3 py-2 text-center w-16">#</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredPayments.map((item) => (
                            <tr key={item.id} className="bg-white/80 hover:bg-white hover:shadow-sm transition-all cursor-pointer group">
                                <td className="px-3 py-2 rounded-l-lg border-y border-l border-slate-100">
                                    <div className="font-black text-indigo-700 text-[11px] leading-tight truncate max-w-[180px]">{item.projects?.internal_code || item.projects?.code}</div>
                                    <div className="text-[9px] text-slate-400 font-medium truncate max-w-[180px]">{item.projects?.name}</div>
                                </td>
                                <td className="px-3 py-2 border-y border-slate-100">
                                    <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] font-black uppercase">
                                        {item.projects?.partners?.code || '—'}
                                    </span>
                                </td>
                                <td className="px-3 py-2 text-center text-[10px] font-bold text-slate-600 border-y border-slate-100">
                                    {item.stage_name}
                                </td>
                                <td className="px-3 py-2 text-center font-mono text-[10px] text-indigo-600 font-bold border-y border-slate-100">
                                    {new Date(item.due_date).toLocaleDateString('vi-VN')}
                                </td>
                                <td className="px-3 py-2 text-right font-black text-slate-800 tabular-nums text-[11px] border-y border-slate-100">
                                    {fmt(item.payment_request_amount)}
                                </td>
                                <td className="px-3 py-2 text-center border-y border-slate-100">
                                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                                        item.external_income >= item.payment_request_amount 
                                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                                        : 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                                    }`}>
                                        {item.external_income >= item.payment_request_amount ? 'Xong' : 'K/H'}
                                    </span>
                                </td>
                                <td className="px-3 py-2 text-right font-black text-emerald-600 tabular-nums text-[11px] border-y border-slate-100">
                                    {item.external_income > 0 ? fmt(item.external_income) : '—'}
                                </td>
                                <td className="px-3 py-2 text-center font-mono text-[9px] text-emerald-700 font-bold border-y border-slate-100">
                                    {lastPayDates[item.id] ? new Date(lastPayDates[item.id]).toLocaleDateString('vi-VN') : '—'}
                                </td>
                                <td className="px-3 py-2 text-center rounded-r-lg border-y border-r border-slate-100">
                                    <div className="flex justify-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button 
                                            onClick={() => {
                                                setForm({
                                                    id: item.id,
                                                    projectId: item.project_id,
                                                    stageName: item.stage_name,
                                                    stageType: item.stage_type || 'Nghiệm thu',
                                                    dueDate: item.due_date,
                                                    amount: String(item.payment_request_amount),
                                                    status: item.status
                                                });
                                                setShowModal(true);
                                            }}
                                            className="p-1.5 hover:bg-indigo-50 text-indigo-600 rounded-lg transition-colors"
                                        >
                                            <span className="material-symbols-outlined text-[16px]">edit</span>
                                        </button>
                                        <button 
                                            onClick={() => deletePlan(item.id)}
                                            className="p-1.5 hover:bg-rose-50 text-rose-600 rounded-lg transition-colors"
                                        >
                                            <span className="material-symbols-outlined text-[16px]">delete</span>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* MODAL FORM */}
            {showModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-200/50">
                        
                        {/* Header */}
                        <div className="px-8 py-6 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                            <div className="flex items-center gap-2 text-slate-400 text-[10px] mb-2 uppercase tracking-widest font-bold">
                                <span>Dự án</span>
                                <span className="material-symbols-outlined text-[12px]">chevron_right</span>
                                <span className="text-blue-700">{form.id ? 'Cập nhật kế hoạch' : 'Lập kế hoạch doanh thu'}</span>
                            </div>
                            <h3 className="text-2xl font-extrabold font-headline text-slate-800 tracking-tight">{form.id ? 'Cập nhật kế hoạch' : 'Lập kế hoạch doanh thu mới'}</h3>
                        </div>
                        
                        <form onSubmit={handleSubmit} className="px-8 py-6 space-y-6">
                            {/* Quick-pick debt list */}
                            {!form.id && allUnpaidDebts.length > 0 && (
                                <div className="space-y-2">
                                    <label className="block text-[11px] font-extrabold text-amber-600 uppercase tracking-wider flex items-center justify-between">
                                        <span className="flex items-center gap-2">
                                            <span className="material-symbols-outlined text-[16px]">bolt</span>
                                            Chọn nhanh công nợ cần thu ({allUnpaidDebts.length})
                                        </span>
                                        <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-md text-[9px] font-bold">TỰ ĐỘNG ĐIỀN</span>
                                    </label>
                                    <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1 border border-amber-200/60 bg-amber-50/20 p-2.5 rounded-xl custom-scrollbar">
                                        {allUnpaidDebts.map((d, idx) => {
                                            const isSelected = form.projectId === d.projectId && form.stageName === d.stageName;
                                            return (
                                                <div 
                                                    key={idx} 
                                                    onClick={() => setForm({ 
                                                        id: d.id, 
                                                        projectId: d.projectId, 
                                                        stageName: d.stageName, 
                                                        stageType: d.stageType,
                                                        amount: String(d.remaining),
                                                        dueDate: d.dueDate || new Date().toISOString().split('T')[0],
                                                        status: d.status
                                                    })}
                                                    className={`px-4 py-3 rounded-lg flex items-center justify-between cursor-pointer transition-all border ${
                                                        isSelected 
                                                        ? 'bg-blue-50 border-blue-300 shadow-sm ring-1 ring-blue-200' 
                                                        : 'bg-white border-slate-200 hover:border-amber-300 hover:shadow-sm'
                                                    }`}
                                                >
                                                    <div className="flex flex-col flex-1 min-w-0 pr-3">
                                                        <span className={`font-bold text-[13px] truncate ${isSelected ? 'text-blue-800' : 'text-slate-700'}`}>[{d.projectCode}] {d.projectName}</span>
                                                        <span className={`text-[11px] font-medium truncate mt-0.5 ${isSelected ? 'text-blue-500' : 'text-slate-400'}`}>
                                                            {d.stageName}
                                                        </span>
                                                    </div>
                                                    <span className={`font-extrabold tabular-nums text-sm shrink-0 px-3 py-1 rounded-md ${
                                                        isSelected ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                                                    }`}>
                                                        {fmt(d.remaining)}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Row 1: Project + Client (auto-fill) */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="block text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Tên dự án</label>
                                    <div className="relative">
                                        <select 
                                            required
                                            value={form.projectId} 
                                            onChange={(e) => setForm({...form, projectId: e.target.value})}
                                            className="w-full bg-slate-50 border-none rounded-lg px-4 py-3 text-sm appearance-none cursor-pointer focus:ring-2 focus:ring-blue-500 transition-all"
                                        >
                                            <option value="">Chọn dự án từ danh sách</option>
                                            {projects.map(p => <option key={p.id} value={p.id}>{p.internal_code || p.code} — {p.name}</option>)}
                                        </select>
                                        <span className="material-symbols-outlined absolute right-3 top-3 pointer-events-none text-slate-400 text-[20px]">expand_more</span>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Khách hàng (CĐT)</label>
                                    <input 
                                        readOnly 
                                        value={selectedProject?.partners?.name || selectedProject?.client_name || (selectedProject ? 'Chưa có thông tin' : 'Tự động điền khi chọn dự án')}
                                        className="w-full bg-slate-50/60 border-none rounded-lg px-4 py-3 text-sm text-slate-400 cursor-not-allowed"
                                    />
                                </div>
                            </div>

                            {/* Row 2: Stage + Due Date */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="block text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Giai đoạn thanh toán</label>
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <select 
                                                value={form.stageName} 
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    const ms = milestones.find(m => m.name === val);
                                                    setForm({
                                                        ...form, 
                                                        stageName: val,
                                                        amount: ms && ms.remaining ? String(ms.remaining) : form.amount
                                                    });
                                                }}
                                                className="w-full bg-slate-50 border-none rounded-lg px-4 py-3 text-sm appearance-none cursor-pointer focus:ring-2 focus:ring-blue-500"
                                            >
                                                <option value="">Chọn mốc công nợ...</option>
                                                {milestones.map((m, idx) => (
                                                    <option key={idx} value={m.name}>{m.name} (Còn: {fmt(m.remaining)})</option>
                                                ))}
                                            </select>
                                            <span className="material-symbols-outlined absolute right-3 top-3 pointer-events-none text-slate-400 text-[20px]">expand_more</span>
                                        </div>
                                        <input 
                                            placeholder="Hoặc tự nhập..."
                                            value={form.stageName}
                                            onChange={(e) => setForm({...form, stageName: e.target.value})}
                                            className="flex-1 bg-slate-50 border-none rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Ngày dự kiến thu</label>
                                    <div className="relative">
                                        <input 
                                            type="date"
                                            required
                                            value={form.dueDate} 
                                            onChange={(e) => setForm({...form, dueDate: e.target.value})}
                                            className="w-full bg-slate-50 border-none rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 transition-all"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Row 3: Amount + Status */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="block text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Số tiền kế hoạch</label>
                                    <div className="relative flex items-center">
                                        <input 
                                            required
                                            placeholder="0"
                                            value={fmt(form.amount)}
                                            onChange={(e) => handleNumChange(e.target.value)}
                                            className="w-full bg-slate-50 border-none rounded-lg px-4 py-3 text-sm font-headline font-bold focus:ring-2 focus:ring-blue-500 transition-all text-right pr-10"
                                        />
                                        <span className="absolute right-4 text-slate-400 font-bold text-xs">đ</span>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Trạng thái ban đầu</label>
                                    <div className="relative">
                                        <select 
                                            value={form.status}
                                            onChange={(e) => setForm({...form, status: e.target.value})}
                                            className="w-full bg-slate-50 border-none rounded-lg px-4 py-3 text-sm appearance-none cursor-pointer focus:ring-2 focus:ring-blue-500 transition-all"
                                        >
                                            <option value="Chờ thanh toán">Chờ thanh toán</option>
                                            <option value="Đã gửi yêu cầu">Đã gửi yêu cầu</option>
                                            <option value="Bản nháp">Bản nháp</option>
                                        </select>
                                        <span className="material-symbols-outlined absolute right-3 top-3 pointer-events-none text-slate-400 text-[20px]">expand_more</span>
                                    </div>
                                </div>
                            </div>

                            {/* Certainty Segmented Control */}
                            <div className="space-y-3">
                                <label className="block text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Mức độ chắc chắn</label>
                                <div className="flex p-1 bg-slate-100 rounded-xl w-fit">
                                    {['Cao', 'Trung bình', 'Thấp'].map(level => (
                                        <label key={level} className="relative cursor-pointer">
                                            <input 
                                                type="radio" 
                                                name="certainty" 
                                                value={level}
                                                defaultChecked={level === 'Cao'}
                                                className="peer sr-only"
                                            />
                                            <div className="px-6 py-2 text-sm font-semibold rounded-lg peer-checked:bg-white peer-checked:text-blue-700 peer-checked:shadow-sm text-slate-500 transition-all hover:text-slate-700">
                                                {level}
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Notes */}
                            <div className="space-y-2">
                                <label className="block text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Ghi chú thêm</label>
                                <textarea 
                                    rows="3"
                                    placeholder="Nhập các thông tin bổ sung cho kế hoạch doanh thu này..."
                                    className="w-full bg-slate-50 border-none rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 transition-all resize-none"
                                ></textarea>
                            </div>

                            {/* Form Actions */}
                            <div className="pt-4 mt-2 border-t border-slate-100 flex items-center justify-end gap-4">
                                <button 
                                    type="button" 
                                    onClick={() => setShowModal(false)}
                                    className="px-6 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-all active:scale-95"
                                >
                                    Hủy bỏ
                                </button>
                                <button 
                                    type="submit"
                                    className="px-8 py-2.5 bg-gradient-to-br from-[#003178] to-[#0d47a1] text-white text-sm font-bold rounded-lg shadow-md shadow-blue-900/10 hover:shadow-lg active:scale-95 transition-all"
                                >
                                    Lưu kế hoạch
                                </button>
                            </div>
                        </form>

                        {/* Contextual Help Cards */}
                        <div className="px-8 pb-6 grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="bg-slate-50 rounded-xl p-3.5 flex items-start gap-2.5">
                                <span className="material-symbols-outlined text-blue-700 text-[20px] mt-0.5">info</span>
                                <div>
                                    <p className="text-[10px] font-extrabold uppercase tracking-tight text-blue-900">Hướng dẫn nhanh</p>
                                    <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">Kế hoạch "Cao" sẽ ưu tiên trong dự báo dòng tiền tháng.</p>
                                </div>
                            </div>
                            <div className="bg-slate-50 rounded-xl p-3.5 flex items-start gap-2.5">
                                <span className="material-symbols-outlined text-emerald-600 text-[20px] mt-0.5">verified_user</span>
                                <div>
                                    <p className="text-[10px] font-extrabold uppercase tracking-tight text-emerald-700">Dữ liệu an toàn</p>
                                    <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">Chỉ hiển thị với Quản lý dự án và Kế toán.</p>
                                </div>
                            </div>
                            <div className="bg-slate-50 rounded-xl p-3.5 flex items-start gap-2.5">
                                <span className="material-symbols-outlined text-amber-600 text-[20px] mt-0.5">history</span>
                                <div>
                                    <p className="text-[10px] font-extrabold uppercase tracking-tight text-amber-600">Tự động sao lưu</p>
                                    <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">Hệ thống tự lưu bản nháp sau mỗi 30 giây.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
