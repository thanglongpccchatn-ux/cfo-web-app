import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { smartToast } from '../utils/globalToast';
import { fmt, formatInputNumber as fmtInput } from '../utils/formatters';
import { autoJournal } from '../lib/accountingService';

const LENDER_TYPES = [
    { value: 'company', label: 'Công ty', icon: 'domain', color: 'bg-blue-100 text-blue-700' },
    { value: 'individual', label: 'Cá nhân', icon: 'person', color: 'bg-amber-100 text-amber-700' },
    { value: 'bank', label: 'Ngân hàng', icon: 'account_balance', color: 'bg-emerald-100 text-emerald-700' },
];

const STATUS_MAP = {
    active: { label: 'Đang vay', color: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
    partially_paid: { label: 'Trả 1 phần', color: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
    fully_paid: { label: 'Đã trả hết', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
    overdue: { label: 'Quá hạn', color: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' },
};

export default function LoanManagement() {
    const { hasPermission, profile } = useAuth();
    const canManage = hasPermission('manage_loans') || profile?.role_code === 'ROLE01';

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingLoan, setEditingLoan] = useState(null);
    const [isPaymentOpen, setIsPaymentOpen] = useState(false);
    const [selectedLoan, setSelectedLoan] = useState(null);
    const [paymentHistory, setPaymentHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [expandedLoan, setExpandedLoan] = useState(null);

    const [form, setForm] = useState({
        lender_type: 'company', lender_name: '', project_id: '',
        loan_amount: '', interest_rate: '', interest_type: 'fixed',
        loan_date: new Date().toISOString().split('T')[0], due_date: '', notes: ''
    });

    const [payForm, setPayForm] = useState({
        payment_date: new Date().toISOString().split('T')[0],
        principal_amount: '', interest_amount: '', notes: ''
    });

    const queryClient = useQueryClient();
    const invalidateLoans = () => queryClient.invalidateQueries({ queryKey: ['loanManagementData'] });

    // ── React Query: Loans + Projects (parallel) ──
    const { data: loanData, isLoading } = useQuery({
        queryKey: ['loanManagementData'],
        queryFn: async () => {
            const [loansRes, projRes] = await Promise.all([
                supabase.from('loans').select('*, projects(name, code)').order('created_at', { ascending: false }),
                supabase.from('projects').select('id, name, code').order('name'),
            ]);
            return { loans: loansRes.data || [], projects: projRes.data || [] };
        },
        staleTime: 5 * 60 * 1000,
    });

    const loans = loanData?.loans || [];
    const projects = loanData?.projects || [];

    const handleNumberChange = (e, setter, field) => {
        const val = e.target.value.replace(/[^0-9]/g, '');
        setter(prev => ({ ...prev, [field]: val }));
    };

    // Auto-detect overdue
    const getStatus = (loan) => {
        if (loan.status === 'fully_paid') return 'fully_paid';
        if (loan.due_date && new Date(loan.due_date) < new Date() && loan.status !== 'fully_paid') return 'overdue';
        return loan.status;
    };

    // KPI calculations
    const activeLoans = loans.filter(l => getStatus(l) === 'active' || getStatus(l) === 'partially_paid' || getStatus(l) === 'overdue');
    const totalDebt = activeLoans.reduce((s, l) => s + (Number(l.loan_amount) - Number(l.total_paid || 0)), 0);
    const totalLoanAmount = activeLoans.reduce((s, l) => s + Number(l.loan_amount), 0);
    const totalPaidAll = loans.reduce((s, l) => s + Number(l.total_paid || 0), 0);
    const overdueCount = loans.filter(l => getStatus(l) === 'overdue').length;
    const dueSoonLoans = activeLoans.filter(l => {
        if (!l.due_date) return false;
        const diff = (new Date(l.due_date) - new Date()) / (1000 * 60 * 60 * 24);
        return diff >= 0 && diff <= 30;
    });

    // Generate loan code
    const generateCode = () => {
        const d = new Date();
        const prefix = 'KV';
        const date = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
        const seq = String(loans.length + 1).padStart(3, '0');
        return `${prefix}-${date}-${seq}`;
    };

    // CRUD
    const handleOpenForm = (loan = null) => {
        if (loan) {
            setEditingLoan(loan);
            setForm({
                lender_type: loan.lender_type, lender_name: loan.lender_name,
                project_id: loan.project_id || '', loan_amount: loan.loan_amount,
                interest_rate: loan.interest_rate || '', interest_type: loan.interest_type || 'fixed',
                loan_date: loan.loan_date, due_date: loan.due_date || '', notes: loan.notes || ''
            });
        } else {
            setEditingLoan(null);
            setForm({
                lender_type: 'company', lender_name: '', project_id: '',
                loan_amount: '', interest_rate: '', interest_type: 'fixed',
                loan_date: new Date().toISOString().split('T')[0], due_date: '', notes: ''
            });
        }
        setIsFormOpen(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        const payload = {
            lender_type: form.lender_type,
            lender_name: form.lender_name,
            project_id: form.project_id || null,
            loan_amount: Number(form.loan_amount),
            interest_rate: Number(form.interest_rate) || 0,
            interest_type: form.interest_type,
            loan_date: form.loan_date,
            due_date: form.due_date || null,
            notes: form.notes || null,
        };

        try {
            if (editingLoan) {
                const { error } = await supabase.from('loans').update(payload).eq('id', editingLoan.id);
                if (error) throw error;
            } else {
                payload.loan_code = generateCode();
                payload.status = 'active';
                payload.total_paid = 0;
                const { error } = await supabase.from('loans').insert([payload]);
                if (error) throw error;
            }
            setIsFormOpen(false);
            invalidateLoans();
        } catch (err) {
            smartToast('Lỗi: ' + err.message);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Xác nhận xóa khoản vay này?')) return;
        await supabase.from('loans').delete().eq('id', id);
        invalidateLoans();
    };

    // Payment
    const openPayment = async (loan) => {
        setSelectedLoan(loan);
        setPayForm({
            payment_date: new Date().toISOString().split('T')[0],
            principal_amount: '', interest_amount: '', notes: ''
        });
        setIsPaymentOpen(true);
    };

    const handlePayment = async (e) => {
        e.preventDefault();
        const principal = Number(payForm.principal_amount) || 0;
        const interest = Number(payForm.interest_amount) || 0;
        if (principal + interest <= 0) return smartToast('Vui lòng nhập số tiền trả');

        try {
            const { error } = await supabase.from('loan_payments').insert([{
                loan_id: selectedLoan.id,
                payment_date: payForm.payment_date,
                principal_amount: principal,
                interest_amount: interest,
                notes: payForm.notes || null,
            }]);
            if (error) throw error;

            // Recalculate total_paid from history
            const { data: allPayments } = await supabase.from('loan_payments')
                .select('principal_amount, interest_amount').eq('loan_id', selectedLoan.id);
            const newTotalPaid = (allPayments || []).reduce((s, p) => s + Number(p.principal_amount) + Number(p.interest_amount), 0);
            const totalPrincipalPaid = (allPayments || []).reduce((s, p) => s + Number(p.principal_amount), 0);
            
            let newStatus = 'partially_paid';
            if (totalPrincipalPaid >= Number(selectedLoan.loan_amount)) newStatus = 'fully_paid';
            else if (totalPrincipalPaid === 0 && newTotalPaid === 0) newStatus = 'active';

            await supabase.from('loans').update({ total_paid: newTotalPaid, status: newStatus }).eq('id', selectedLoan.id);

            // Auto-create journal entry: Nợ 341+635 / Có 112
            autoJournal.loanPayment(selectedLoan, principal, interest, payForm.payment_date).catch(err =>
                console.warn('[Accounting] Auto journal failed (non-critical):', err)
            );
            
            setIsPaymentOpen(false);
            invalidateLoans();
        } catch (err) {
            smartToast('Lỗi trả nợ: ' + err.message);
        }
    };

    // Expand to see payment history
    const toggleExpand = async (loan) => {
        if (expandedLoan === loan.id) {
            setExpandedLoan(null);
            return;
        }
        setExpandedLoan(loan.id);
        setLoadingHistory(true);
        const { data } = await supabase.from('loan_payments').select('*').eq('loan_id', loan.id).order('payment_date', { ascending: false });
        setPaymentHistory(data || []);
        setLoadingHistory(false);
    };

    const deletePayment = async (paymentId, loanId) => {
        if (!window.confirm('Xóa giao dịch trả nợ này?')) return;
        await supabase.from('loan_payments').delete().eq('id', paymentId);
        // Recalculate
        const { data: remaining } = await supabase.from('loan_payments').select('principal_amount, interest_amount').eq('loan_id', loanId);
        const newTotal = (remaining || []).reduce((s, p) => s + Number(p.principal_amount) + Number(p.interest_amount), 0);
        const totalPrincipal = (remaining || []).reduce((s, p) => s + Number(p.principal_amount), 0);
        const loan = loans.find(l => l.id === loanId);
        let status = 'active';
        if (totalPrincipal > 0 && totalPrincipal < Number(loan?.loan_amount)) status = 'partially_paid';
        else if (totalPrincipal >= Number(loan?.loan_amount)) status = 'fully_paid';
        await supabase.from('loans').update({ total_paid: newTotal, status }).eq('id', loanId);
        setPaymentHistory(prev => prev.filter(p => p.id !== paymentId));
        invalidateLoans();
    };

    // Interest suggestion
    const suggestInterest = () => {
        if (!selectedLoan) return 0;
        const rate = Number(selectedLoan.interest_rate) || 0;
        const principal = Number(selectedLoan.loan_amount) - (loans.find(l => l.id === selectedLoan.id)?.total_paid || 0);
        const days = Math.floor((new Date() - new Date(selectedLoan.loan_date)) / (1000 * 60 * 60 * 24));
        return Math.round(principal * (rate / 100) * (days / 365));
    };

    const kpis = [
        { label: 'Tổng dư nợ hiện tại', value: fmt(totalDebt), suffix: '₫', icon: 'account_balance_wallet', color: 'from-red-500 to-rose-600', sub: `${activeLoans.length} khoản đang vay` },
        { label: 'Tổng tiền đã vay', value: fmt(totalLoanAmount), suffix: '₫', icon: 'trending_up', color: 'from-blue-500 to-indigo-600', sub: `${loans.length} khoản tổng cộng` },
        { label: 'Tổng đã trả', value: fmt(totalPaidAll), suffix: '₫', icon: 'payments', color: 'from-emerald-500 to-teal-600', sub: 'Gốc + lãi' },
        { label: 'Cảnh báo', value: overdueCount > 0 ? overdueCount : dueSoonLoans.length, suffix: overdueCount > 0 ? ' quá hạn' : ' sắp đáo hạn', icon: overdueCount > 0 ? 'warning' : 'schedule', color: overdueCount > 0 ? 'from-red-500 to-orange-600' : 'from-amber-500 to-yellow-600', sub: overdueCount > 0 ? 'Cần xử lý ngay!' : 'Trong 30 ngày tới' },
    ];

    return (
        <div className="space-y-6 animate-fade-in">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {kpis.map((kpi, i) => (
                    <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between mb-3">
                            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${kpi.color} flex items-center justify-center shadow-md`}>
                                <span className="material-symbols-outlined notranslate text-white text-lg" translate="no">{kpi.icon}</span>
                            </div>
                        </div>
                        <div className="text-2xl font-black text-slate-800 tracking-tight">{kpi.value}<span className="text-sm font-medium text-slate-500 ml-1">{kpi.suffix}</span></div>
                        <div className="text-[12px] text-slate-500 font-medium mt-1">{kpi.label}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{kpi.sub}</div>
                    </div>
                ))}
            </div>

            {/* Toolbar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <h2 className="text-xl font-bold text-slate-800">Danh sách khoản vay</h2>
                {canManage && (
                    <button onClick={() => handleOpenForm()} className="h-10 flex items-center gap-2 px-5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 active:scale-95 transition-all shadow-lg shadow-blue-500/20">
                        <span className="material-symbols-outlined notranslate text-[18px]" translate="no">add_circle</span>
                        Tạo khoản vay mới
                    </button>
                )}
            </div>

            {/* Loans Table/Cards */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {isLoading ? (
                    <div className="p-12 text-center text-slate-500">
                        <span className="material-symbols-outlined notranslate animate-spin text-blue-500 text-3xl" translate="no">progress_activity</span>
                        <p className="mt-2">Đang tải dữ liệu...</p>
                    </div>
                ) : loans.length === 0 ? (
                    <div className="p-12 text-center">
                        <span className="material-symbols-outlined notranslate text-5xl text-slate-300" translate="no">account_balance_wallet</span>
                        <p className="text-slate-500 mt-3 font-medium">Chưa có khoản vay nào</p>
                        <p className="text-slate-400 text-sm mt-1">Nhấn "Tạo khoản vay mới" để bắt đầu</p>
                    </div>
                ) : (
                    <>
                        {/* Desktop table */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500 font-bold">
                                        <th className="px-5 py-3">Bên cho vay</th>
                                        <th className="px-4 py-3">Dự án</th>
                                        <th className="px-4 py-3 text-right">Số tiền vay</th>
                                        <th className="px-4 py-3 text-center">Lãi suất</th>
                                        <th className="px-4 py-3 text-right">Đã trả</th>
                                        <th className="px-4 py-3 text-right">Còn nợ</th>
                                        <th className="px-4 py-3 text-center">Trạng thái</th>
                                        <th className="px-4 py-3 text-center">Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {loans.map(loan => {
                                        const status = getStatus(loan);
                                        const st = STATUS_MAP[status] || STATUS_MAP.active;
                                        const lt = LENDER_TYPES.find(t => t.value === loan.lender_type) || LENDER_TYPES[0];
                                        const remaining = Number(loan.loan_amount) - Number(loan.total_paid || 0);

                                        return (
                                            <React.Fragment key={loan.id}>
                                                <tr className="hover:bg-blue-50/30 transition-colors group cursor-pointer" onClick={() => toggleExpand(loan)}>
                                                    <td className="px-5 py-3.5">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-9 h-9 rounded-lg ${lt.color} flex items-center justify-center shrink-0`}>
                                                                <span className="material-symbols-outlined notranslate text-[16px]" translate="no">{lt.icon}</span>
                                                            </div>
                                                            <div>
                                                                <div className="font-bold text-slate-800 text-[13px]">{loan.lender_name}</div>
                                                                <div className="text-[11px] text-slate-400">{loan.loan_code} · {lt.label}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3.5 text-[13px] text-slate-600">{loan.projects?.name || '—'}</td>
                                                    <td className="px-4 py-3.5 text-right font-bold text-[13px] text-slate-800">{fmt(loan.loan_amount)}</td>
                                                    <td className="px-4 py-3.5 text-center text-[13px] text-slate-600">{loan.interest_rate || 0}%/năm</td>
                                                    <td className="px-4 py-3.5 text-right text-[13px] text-emerald-600 font-semibold">{fmt(loan.total_paid || 0)}</td>
                                                    <td className="px-4 py-3.5 text-right text-[13px] font-bold text-red-600">{fmt(remaining > 0 ? remaining : 0)}</td>
                                                    <td className="px-4 py-3.5 text-center">
                                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${st.color}`}>
                                                            <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`}></span>
                                                            {st.label}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                                                        <div className="flex items-center justify-center gap-1">
                                                            {canManage && status !== 'fully_paid' && (
                                                                <button onClick={() => openPayment(loan)} className="w-8 h-8 rounded-lg flex items-center justify-center text-emerald-500 hover:bg-emerald-50 transition-colors" title="Ghi nhận trả nợ">
                                                                    <span className="material-symbols-outlined notranslate text-[18px]" translate="no">payments</span>
                                                                </button>
                                                            )}
                                                            {canManage && (
                                                                <button onClick={() => handleOpenForm(loan)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Sửa">
                                                                    <span className="material-symbols-outlined notranslate text-[18px]" translate="no">edit</span>
                                                                </button>
                                                            )}
                                                            {canManage && (
                                                                <button onClick={() => handleDelete(loan.id)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Xóa">
                                                                    <span className="material-symbols-outlined notranslate text-[18px]" translate="no">delete</span>
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                                {/* Expanded payment history */}
                                                {expandedLoan === loan.id && (
                                                    <tr>
                                                        <td colSpan="8" className="px-5 py-4 bg-slate-50/80">
                                                            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Lịch sử trả nợ · {loan.lender_name}</div>
                                                            {loadingHistory ? (
                                                                <div className="text-center py-3 text-slate-400 text-sm">Đang tải...</div>
                                                            ) : paymentHistory.length === 0 ? (
                                                                <div className="text-center py-3 text-slate-400 text-sm">Chưa có giao dịch trả nợ</div>
                                                            ) : (
                                                                <div className="space-y-2">
                                                                    {paymentHistory.map(p => (
                                                                        <div key={p.id} className="flex items-center justify-between bg-white rounded-lg px-4 py-2.5 border border-slate-200">
                                                                            <div className="flex items-center gap-3">
                                                                                <span className="material-symbols-outlined notranslate text-emerald-500 text-[16px]" translate="no">check_circle</span>
                                                                                <div>
                                                                                    <span className="text-[13px] font-semibold text-slate-700">{new Date(p.payment_date).toLocaleDateString('vi-VN')}</span>
                                                                                    {p.notes && <span className="text-[11px] text-slate-400 ml-2">— {p.notes}</span>}
                                                                                </div>
                                                                            </div>
                                                                            <div className="flex items-center gap-4">
                                                                                <div className="text-right">
                                                                                    <div className="text-[12px] text-slate-500">Gốc: <span className="font-bold text-slate-700">{fmt(p.principal_amount)}</span></div>
                                                                                    <div className="text-[12px] text-slate-500">Lãi: <span className="font-bold text-amber-600">{fmt(p.interest_amount)}</span></div>
                                                                                </div>
                                                                                <div className="text-[13px] font-black text-emerald-600 min-w-[100px] text-right">{fmt(Number(p.principal_amount) + Number(p.interest_amount))}</div>
                                                                                {canManage && (
                                                                                    <button onClick={() => deletePayment(p.id, loan.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                                                                                        <span className="material-symbols-outlined notranslate text-[16px]" translate="no">close</span>
                                                                                    </button>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile cards */}
                        <div className="md:hidden divide-y divide-slate-100">
                            {loans.map(loan => {
                                const status = getStatus(loan);
                                const st = STATUS_MAP[status] || STATUS_MAP.active;
                                const lt = LENDER_TYPES.find(t => t.value === loan.lender_type) || LENDER_TYPES[0];
                                const remaining = Number(loan.loan_amount) - Number(loan.total_paid || 0);

                                return (
                                    <div key={loan.id} className="p-4 space-y-3">
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-xl ${lt.color} flex items-center justify-center`}>
                                                    <span className="material-symbols-outlined notranslate text-lg" translate="no">{lt.icon}</span>
                                                </div>
                                                <div>
                                                    <div className="font-bold text-slate-800 text-sm">{loan.lender_name}</div>
                                                    <div className="text-[11px] text-slate-400">{loan.loan_code} · {lt.label}</div>
                                                </div>
                                            </div>
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${st.color}`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`}></span>
                                                {st.label}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-3 gap-2 text-center">
                                            <div className="bg-slate-50 rounded-lg py-2">
                                                <div className="text-[11px] text-slate-400">Vay</div>
                                                <div className="font-bold text-sm text-slate-800">{fmt(loan.loan_amount)}</div>
                                            </div>
                                            <div className="bg-emerald-50 rounded-lg py-2">
                                                <div className="text-[11px] text-slate-400">Đã trả</div>
                                                <div className="font-bold text-sm text-emerald-600">{fmt(loan.total_paid || 0)}</div>
                                            </div>
                                            <div className="bg-red-50 rounded-lg py-2">
                                                <div className="text-[11px] text-slate-400">Còn nợ</div>
                                                <div className="font-bold text-sm text-red-600">{fmt(remaining > 0 ? remaining : 0)}</div>
                                            </div>
                                        </div>
                                        {canManage && (
                                            <div className="flex gap-2">
                                                {status !== 'fully_paid' && (
                                                    <button onClick={() => openPayment(loan)} className="flex-1 h-9 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-lg flex items-center justify-center gap-1">
                                                        <span className="material-symbols-outlined notranslate text-[14px]" translate="no">payments</span>Trả nợ
                                                    </button>
                                                )}
                                                <button onClick={() => handleOpenForm(loan)} className="h-9 px-3 bg-slate-100 text-slate-600 text-xs font-bold rounded-lg">Sửa</button>
                                                <button onClick={() => handleDelete(loan.id)} className="h-9 px-3 bg-red-50 text-red-600 text-xs font-bold rounded-lg">Xóa</button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>

            {/* Create/Edit Loan Modal */}
            {isFormOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-slide-in">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
                            <h3 className="font-bold text-lg text-slate-800">{editingLoan ? 'Sửa khoản vay' : 'Tạo khoản vay mới'}</h3>
                            <button onClick={() => setIsFormOpen(false)} className="w-8 h-8 rounded-full bg-white border flex items-center justify-center text-slate-400 hover:text-slate-600">
                                <span className="material-symbols-outlined notranslate text-[18px]" translate="no">close</span>
                            </button>
                        </div>
                        <form onSubmit={handleSave} className="p-6 space-y-5">
                            {/* Lender type */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Loại bên cho vay</label>
                                <div className="flex gap-2">
                                    {LENDER_TYPES.map(lt => (
                                        <button key={lt.value} type="button" onClick={() => setForm({...form, lender_type: lt.value})}
                                            className={`flex-1 px-3 py-2.5 rounded-xl border-2 text-sm font-semibold flex items-center justify-center gap-2 transition-all ${form.lender_type === lt.value ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                                            <span className="material-symbols-outlined notranslate text-[18px]" translate="no">{lt.icon}</span>
                                            {lt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {/* Lender name */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Tên bên cho vay *</label>
                                <input required type="text" value={form.lender_name} onChange={e => setForm({...form, lender_name: e.target.value})}
                                    placeholder={form.lender_type === 'company' ? 'VD: Cty Thăng Long' : form.lender_type === 'bank' ? 'VD: Vietcombank' : 'VD: Ông Nguyễn Văn A'}
                                    className="w-full px-3 py-2.5 border rounded-xl text-sm" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Số tiền vay (₫) *</label>
                                    <input required type="text" value={fmtInput(form.loan_amount)} onChange={e => handleNumberChange(e, setForm, 'loan_amount')}
                                        placeholder="500,000,000" className="w-full px-3 py-2.5 border rounded-xl text-sm" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Lãi suất (%/năm)</label>
                                    <input type="number" step="0.1" value={form.interest_rate} onChange={e => setForm({...form, interest_rate: e.target.value})}
                                        placeholder="8" className="w-full px-3 py-2.5 border rounded-xl text-sm" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Ngày vay *</label>
                                    <input required type="date" value={form.loan_date} onChange={e => setForm({...form, loan_date: e.target.value})}
                                        className="w-full px-3 py-2.5 border rounded-xl text-sm" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Ngày đáo hạn</label>
                                    <input type="date" value={form.due_date} onChange={e => setForm({...form, due_date: e.target.value})}
                                        className="w-full px-3 py-2.5 border rounded-xl text-sm" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Dự án sử dụng</label>
                                <select value={form.project_id} onChange={e => setForm({...form, project_id: e.target.value})} className="w-full px-3 py-2.5 border rounded-xl text-sm">
                                    <option value="">— Không gắn dự án —</option>
                                    {projects.map(p => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Ghi chú</label>
                                <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2}
                                    className="w-full px-3 py-2.5 border rounded-xl text-sm" placeholder="Mục đích vay, điều kiện..." />
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={() => setIsFormOpen(false)} className="px-5 py-2.5 rounded-xl text-slate-500 font-semibold hover:bg-slate-100">Hủy</button>
                                <button type="submit" className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 shadow-lg shadow-blue-500/20 active:scale-95 transition-all flex items-center gap-2">
                                    <span className="material-symbols-outlined notranslate text-[18px]" translate="no">save</span>
                                    {editingLoan ? 'Cập nhật' : 'Tạo khoản vay'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Payment Modal */}
            {isPaymentOpen && selectedLoan && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-slide-in">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-emerald-50">
                            <div>
                                <h3 className="font-bold text-lg text-slate-800">Ghi nhận trả nợ</h3>
                                <p className="text-sm text-slate-500 mt-0.5">{selectedLoan.lender_name} · Còn nợ: <span className="font-bold text-red-600">{fmt(Number(selectedLoan.loan_amount) - Number(selectedLoan.total_paid || 0))}</span> ₫</p>
                            </div>
                            <button onClick={() => setIsPaymentOpen(false)} className="w-8 h-8 rounded-full bg-white border flex items-center justify-center text-slate-400 hover:text-slate-600">
                                <span className="material-symbols-outlined notranslate text-[18px]" translate="no">close</span>
                            </button>
                        </div>
                        <form onSubmit={handlePayment} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Ngày trả *</label>
                                <input required type="date" value={payForm.payment_date} onChange={e => setPayForm({...payForm, payment_date: e.target.value})}
                                    className="w-full px-3 py-2.5 border rounded-xl text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Trả gốc (₫)</label>
                                <input type="text" value={fmtInput(payForm.principal_amount)} onChange={e => handleNumberChange(e, setPayForm, 'principal_amount')}
                                    placeholder="0" className="w-full px-3 py-2.5 border rounded-xl text-sm" />
                            </div>
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Trả lãi (₫)</label>
                                    {selectedLoan.interest_rate > 0 && (
                                        <button type="button" onClick={() => setPayForm({...payForm, interest_amount: suggestInterest()})}
                                            className="text-[11px] text-blue-600 font-semibold hover:underline">
                                            Gợi ý: {fmt(suggestInterest())} ₫
                                        </button>
                                    )}
                                </div>
                                <input type="text" value={fmtInput(payForm.interest_amount)} onChange={e => handleNumberChange(e, setPayForm, 'interest_amount')}
                                    placeholder="0" className="w-full px-3 py-2.5 border rounded-xl text-sm" />
                            </div>
                            <div className="bg-slate-50 rounded-xl p-3 text-center">
                                <span className="text-sm text-slate-500">Tổng trả: </span>
                                <span className="text-xl font-black text-emerald-600">{fmt((Number(payForm.principal_amount) || 0) + (Number(payForm.interest_amount) || 0))} ₫</span>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Ghi chú</label>
                                <input type="text" value={payForm.notes} onChange={e => setPayForm({...payForm, notes: e.target.value})}
                                    placeholder="Trả đợt 1, CK ngân hàng..." className="w-full px-3 py-2.5 border rounded-xl text-sm" />
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={() => setIsPaymentOpen(false)} className="px-5 py-2.5 rounded-xl text-slate-500 font-medium hover:bg-slate-100">Hủy</button>
                                <button type="submit" className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all flex items-center gap-2">
                                    <span className="material-symbols-outlined notranslate text-[18px]" translate="no">check_circle</span>
                                    Xác nhận trả nợ
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
