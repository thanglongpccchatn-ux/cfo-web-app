import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { smartToast } from '../../utils/globalToast';
import { fmt, fmtDate } from '../../utils/formatters';

export default function ContractExpenseTab({ project, expenses, totalGenericExpenses, onRefresh }) {
    const [newExpenseType, setNewExpenseType] = useState('Chi phí chung');
    const [newExpenseDate, setNewExpenseDate] = useState('');
    const [newExpenseAmount, setNewExpenseAmount] = useState('');
    const [newExpenseNotes, setNewExpenseNotes] = useState('');

    async function handleAddExpense() {
        if (!newExpenseDate || !newExpenseAmount) return;
        const { error } = await supabase.from('expenses').insert([{
            project_id: project.id,
            expense_type: newExpenseType,
            expense_date: newExpenseDate,
            amount: Number(newExpenseAmount),
            description: newExpenseNotes
        }]);
        if (error) { smartToast('Lỗi khi thêm chi phí'); return; }
        setNewExpenseDate(''); setNewExpenseAmount(''); setNewExpenseNotes('');
        onRefresh();
    }

    const handleDeleteExpense = async (id) => {
        if (!window.confirm('Xóa chi phí này?')) return;
        await supabase.from('expenses').delete().eq('id', id);
        onRefresh();
    };

    return (
        <div className="glass-panel shadow-sm border border-slate-200/60 overflow-hidden bg-white/70">
            <div className="p-6 border-b border-slate-200/60 bg-indigo-50/50">
                 <h3 className="font-bold text-lg mb-2 flex items-center gap-3">
                    <span className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-200/50">
                        <span className="material-symbols-outlined notranslate text-[22px]" translate="no">receipt_long</span>
                    </span>
                    Quản lý Chi phí Khác (Chỉ ngân Sateco)
                </h3>
                <p className="text-sm font-medium text-slate-500 ml-14">Hạch toán trực tiếp vào chi phí vận hành Của Sateco tại công trường.</p>
            </div>
           
           <div className="p-6">
                <div className="flex flex-wrap items-end gap-5 mb-8 bg-white p-5 rounded-2xl shadow-card border border-slate-200/60">
                    <div className="flex-1 min-w-[140px]">
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">Ngày</label>
                        <input type="date" value={newExpenseDate} onChange={e => setNewExpenseDate(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all shadow-sm" />
                    </div>
                    <div className="flex-[1.5] min-w-[160px]">
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">Mục Chi</label>
                        <select value={newExpenseType} onChange={e => setNewExpenseType(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all shadow-sm appearance-none">
                            <option>BCH công trường (VPTT, điện nước...)</option>
                            <option>Máy thi công &amp; Xăng dầu</option>
                            <option>Nghiệm thu &amp; Thẩm duyệt</option>
                            <option>Tiếp khách &amp; Giao tế</option>
                            <option>Lương cứng BQL</option>
                            <option>Chi phí Chung (Khác)</option>
                        </select>
                    </div>
                    <div className="flex-[1.5] min-w-[140px]">
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">Số tiền (VNĐ)</label>
                        <div className="relative">
                            <input type="number" value={newExpenseAmount} onChange={e => setNewExpenseAmount(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 pr-8 text-sm font-black text-indigo-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all shadow-sm" placeholder="0" />
                            <span className="absolute right-4 top-3 text-indigo-400 font-bold">₫</span>
                        </div>
                    </div>
                    <div className="flex-[2] min-w-[180px]">
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">Diễn giải</label>
                        <input type="text" value={newExpenseNotes} onChange={e => setNewExpenseNotes(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all shadow-sm" placeholder="Mô tả cụ thể khoản chi..." />
                    </div>
                    <button onClick={handleAddExpense} className="btn bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md shadow-indigo-500/20 px-6 py-3 h-[46px]">Hạch toán</button>
                </div>
                
                {expenses.length === 0 ? (
                    <div className="text-center py-12 bg-slate-50 border border-dashed border-slate-300 rounded-2xl flex flex-col items-center">
                         <div className="w-16 h-16 bg-white rounded-full shadow-sm border border-slate-100 flex items-center justify-center mb-4">
                             <span className="material-symbols-outlined notranslate text-slate-300 text-3xl" translate="no">receipt_long</span>
                         </div>
                        <p className="font-bold text-slate-600 mb-1">Chưa có khoản chi phí khác nào</p>
                        <p className="text-xs text-slate-400">Các khoản chi nhỏ lẻ sẽ hiển thị tại đây.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto ring-1 ring-slate-200 rounded-2xl bg-white shadow-sm">
                        <table className="w-full text-sm text-left whitespace-nowrap">
                            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 tracking-widest uppercase font-black text-[10px]">
                                <tr>
                                    <th className="px-6 py-4">Ngày ghi nhận</th>
                                    <th className="px-6 py-4">Hạng mục chi phí</th>
                                    <th className="px-6 py-4 w-full">Diễn giải</th>
                                    <th className="px-6 py-4 text-right">Giá trị (VNĐ)</th>
                                    <th className="px-6 py-4 w-16 text-center">Tác vụ</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {expenses.map(e => (
                                    <tr key={e.id} className="hover:bg-slate-50/80 transition-colors group">
                                        <td className="px-6 py-4 font-semibold text-slate-600">{fmtDate(e.expense_date)}</td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex px-2.5 py-1 rounded bg-indigo-50 text-indigo-700 font-bold text-xs border border-indigo-100">
                                                {e.expense_type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-slate-600 font-medium truncate max-w-[400px]">{e.description || '—'}</td>
                                        <td className="px-6 py-4 text-right font-black text-indigo-600 text-[15px]">{fmt(e.amount)}</td>
                                        <td className="px-6 py-4 text-center">
                                            <button onClick={() => handleDeleteExpense(e.id)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-all opacity-0 group-hover:opacity-100">
                                                <span className="material-symbols-outlined notranslate text-[18px]" translate="no">delete</span>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-slate-50/80 font-black text-sm border-t-2 border-slate-200">
                                <tr>
                                    <td colSpan={3} className="px-6 py-5 text-slate-600 uppercase tracking-widest text-[11px]">Tổng cộng Nhóm chi phí khác</td>
                                    <td className="px-6 py-5 text-right text-indigo-700 text-[18px] tabular-nums">{fmt(totalGenericExpenses)}</td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}
           </div>
        </div>
    );
}
