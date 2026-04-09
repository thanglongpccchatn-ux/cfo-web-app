import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { logAudit } from '../lib/auditLog';
import { smartToast } from '../utils/globalToast';
import { fmt, fmtDate } from '../utils/formatters';
import { autoJournal } from '../lib/accountingService';

function getPaymentStatus(stage, lastExternalPaymentDate) {
    const income = Number(stage.external_income || 0);
    const request = Number(stage.payment_request_amount || 0);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const dueDate = stage.due_date ? new Date(stage.due_date) : null;
    const isFullyPaid = request > 0 && income >= request;

    if (isFullyPaid) {
        if (dueDate && lastExternalPaymentDate) {
            const lastPaid = new Date(lastExternalPaymentDate);
            if (lastPaid > dueDate) return { key: 'late', label: 'CĐT trả muộn', color: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500', ring: 'border-orange-200' };
        }
        return { key: 'done', label: 'CĐT trả đủ', color: 'bg-green-100 text-green-700', dot: 'bg-green-500', ring: 'border-green-200' };
    }
    if (dueDate && today > dueDate) return { key: 'overdue', label: 'Quá hạn thu', color: 'bg-rose-100 text-rose-700', dot: 'bg-rose-500 animate-pulse', ring: 'border-rose-200' };
    if (income > 0) return { key: 'partial', label: 'Đang thu CĐT', color: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-500', ring: 'border-yellow-200' };
    return { key: 'pending', label: 'Chưa thu', color: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400', ring: 'border-slate-200' };
}

function daysDiff(dateStr) {
    if (!dateStr) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return Math.round((today - new Date(dateStr)) / 86400000);
}

const STAGE_TYPES = ['Tạm ứng', 'Nghiệm thu', 'Quyết toán', 'Bảo hành', 'Phát sinh'];

export default function PaymentTracking({ project, onBack, embedded }) {
    const [stages, setStages] = useState([]);
    const queryClient = useQueryClient();
    const [_isAdding, setIsAdding] = useState(false);
    const [expandedCard, setExpandedCard] = useState(null);
    const [editingStage, setEditingStage] = useState(null);
    const [lastPayDates, setLastPayDates] = useState({});
    const [form, setForm] = useState({ 
        name: '', 
        type: 'Nghiệm thu', 
        expected: '', 
        dueDate: '', 
        invoiceAmount: '', 
        invoiceStatus: 'Chưa xuất',
        paymentCode: '',
        notes: ''
    });
    const [editForm, setEditForm] = useState({ invoice: '', invoiceDate: '', request: '', dueDate: '', addenda: '', invoiceStatus: '', paymentCode: '' });
    
    // Modals
    const [cdtModal, setCdtModal] = useState(null);
    const [cdtHistory, setCdtHistory] = useState([]);
    const [_loadingCdt, setLoadingCdt] = useState(false);
    const [cdtForm, setCdtForm] = useState({ date: '', amount: '', notes: '' });

    const [tlSatecoModal, setTlSatecoModal] = useState(null);
    const [tlSatecoHistory, setTlSatecoHistory] = useState([]);
    const [_loadingTlSateco, setLoadingTlSateco] = useState(false);
    const [tlSatecoForm, setTlSatecoForm] = useState({ date: '', amount: '', notes: '' });

    const contractRatio = project ? parseFloat(project.sateco_contract_ratio || 98) / 100 : 0.98;
    const actualRatio = project ? parseFloat(project.sateco_actual_ratio || 95.5) / 100 : 0.955;
    const refundRatio = Math.max(0, contractRatio - actualRatio);



    const suggestNextStage = React.useCallback(() => {
        if (!project) return;
        const prjCode = project.internal_code || project.code;
        if (!stages || stages.length === 0) {
            setForm(f => ({ 
                ...f, 
                name: 'Tạm ứng', 
                type: 'Tạm ứng',
                paymentCode: `${prjCode}-ADV`
            }));
            return;
        }

        const ipcs = stages.filter(s => s.stage_name.startsWith('IPC'));
        const nextNum = ipcs.length + 1;
        const nextIPC = `IPC${nextNum.toString().padStart(2, '0')}`;
        
        setForm(f => ({ 
            ...f, 
            name: nextIPC, 
            type: 'Nghiệm thu',
            paymentCode: `${prjCode}-${nextIPC}`
        }));
    }, [project, stages]);

    const _handleInvoiceDateChange = (date) => {
        if (!date) return;
        const d = new Date(date);
        d.setDate(d.getDate() + 30);
        const due = d.toISOString().split('T')[0];
        setForm(f => ({ ...f, invoiceDate: date, dueDate: due }));
    };

    // ── React Query: Payment stages ──
    const { isLoading: loading } = useQuery({
        queryKey: ['paymentStages', project?.id],
        queryFn: async () => {
            const { data } = await supabase.from('payments').select('*').eq('project_id', project.id).order('created_at', { ascending: true });
            setStages(data || []);
            if (data && data.length > 0) {
                const ids = data.map(s => s.id);
                const { data: extHist } = await supabase.from('external_payment_history').select('payment_stage_id, payment_date').in('payment_stage_id', ids).order('payment_date', { ascending: false });
                const map = {};
                if (extHist) extHist.forEach(h => { if (!map[h.payment_stage_id]) map[h.payment_stage_id] = h.payment_date; });
                setLastPayDates(map);
            }
            suggestNextStage();
            return data || [];
        },
        enabled: !!project,
        staleTime: 2 * 60 * 1000,
    });

    const invalidateStages = () => queryClient.invalidateQueries({ queryKey: ['paymentStages'] });

    async function _handleAddStage() {
        if (!form.name || !form.expected) {
            smartToast('Vui lòng nhập tên đợt và giá trị dự kiến');
            return;
        }
        
        const { error } = await supabase.from('payments').insert([{ 
            project_id: project.id, 
            stage_name: form.name, 
            stage_type: form.type, 
            expected_amount: Number(form.expected), 
            due_date: form.dueDate || null, 
            invoice_date: form.invoiceDate || null,
            invoice_amount: Number(form.invoiceAmount) || 0, 
            invoice_status: form.invoiceStatus,
            payment_code: form.paymentCode,
            payment_request_amount: Number(form.expected), // Default request to expected
            external_income: 0, 
            internal_paid: 0, 
            addenda_amount: 0, 
            notes: form.notes,
            status: 'Chưa thanh toán' 
        }]);

        if (error) {
            console.error('Error adding stage:', error);
            smartToast('Lỗi khi lưu: ' + error.message);
            return;
        }

        setIsAdding(false);
        invalidateStages();
        // Reset form for next entry
        setForm({ name: '', type: 'Nghiệm thu', expected: '', dueDate: '', invoiceAmount: '', invoiceStatus: 'Chưa xuất', paymentCode: '', notes: '' });
    };

    const handleDeleteStage = async (id) => {
        if (!window.confirm('Xóa đợt thanh toán này?')) return;
        await supabase.from('payments').delete().eq('id', id);
        invalidateStages();
    };

    const handleSaveEdit = async (stage) => {
        const inv = Number(editForm.invoice) || 0;
        const req = Number(editForm.request) || 0;
        await supabase.from('payments').update({ 
            invoice_amount: inv, 
            invoice_date: editForm.invoiceDate || null, 
            payment_request_amount: req, 
            due_date: editForm.dueDate || null, 
            addenda_amount: Number(editForm.addenda) || 0 
        }).eq('id', stage.id);
        
        setEditingStage(null);
        invalidateStages();
    };

    // --- CĐT -> Thăng Long (Thu tiền Khách hàng) ---
    const openCdtModal = async (stage) => {
        setCdtModal(stage); setLoadingCdt(true);
        const { data } = await supabase.from('external_payment_history').select('*').eq('payment_stage_id', stage.id).order('payment_date', { ascending: true });
        setCdtHistory(data || []); setLoadingCdt(false);
    };

    async function handleAddCdtPayment() {
        if (!cdtForm.date || !cdtForm.amount) return;
        const amount = Number(cdtForm.amount);
        const { data: insertedData } = await supabase.from('external_payment_history').insert([{ payment_stage_id: cdtModal.id, payment_date: cdtForm.date, amount, description: cdtForm.notes }]).select().single();
        // Fetch-before-write: lấy giá trị mới nhất từ DB để tránh race condition
        const { data: freshStage } = await supabase.from('payments').select('external_income').eq('id', cdtModal.id).single();
        const currentIncome = Number(freshStage?.external_income || 0);
        const newIncome = currentIncome + amount;
        await supabase.from('payments').update({ external_income: newIncome, status: newIncome > 0 ? 'CĐT Đã thanh toán' : 'Chưa thanh toán' }).eq('id', cdtModal.id);
        
        await logAudit({
            action: 'CREATE',
            tableName: 'external_payment_history',
            recordId: insertedData?.id || cdtModal.id,
            recordName: `Thanh toán CĐT - Đợt ${cdtModal.name}`,
            changes: { amount: { old: null, new: amount } },
            metadata: { project_id: project.id }
        });

        // Auto-create journal entry: Nợ 112 / Có 131
        autoJournal.customerReceipt(cdtModal, amount, cdtForm.date, project?.code || project?.name).catch(err =>
            console.warn('[Accounting] Auto journal failed (non-critical):', err)
        );

        setCdtForm({ date: '', amount: '', notes: '' });
        invalidateStages();
        const { data: updated } = await supabase.from('payments').select('*').eq('id', cdtModal.id).single();
        if (updated) setCdtModal(updated);
        openCdtModal(updated || cdtModal);
    };

    const handleDeleteCdtPayment = async (record) => {
        if (!window.confirm('Xóa giao dịch này?')) return;
        await supabase.from('external_payment_history').delete().eq('id', record.id);
        
        await logAudit({
            action: 'DELETE',
            tableName: 'external_payment_history',
            recordId: record.id,
            recordName: `Xóa Nhận tiền CĐT - Đợt ${cdtModal.name}`,
            changes: { amount: { old: record.amount, new: null } },
            metadata: { project_id: project.id }
        });

        // SUM-based recalculation: tính lại tổng từ lịch sử thay vì phép trừ
        const { data: remaining } = await supabase.from('external_payment_history').select('amount').eq('payment_stage_id', cdtModal.id);
        const newIncome = (remaining || []).reduce((sum, r) => sum + Number(r.amount || 0), 0);
        await supabase.from('payments').update({ external_income: newIncome, status: newIncome > 0 ? 'CĐT Đã thanh toán' : 'Chưa thanh toán' }).eq('id', cdtModal.id);
        invalidateStages();
        const { data: updated } = await supabase.from('payments').select('*').eq('id', cdtModal.id).single();
        if (updated) setCdtModal(updated);
        openCdtModal(updated || cdtModal);
    };

    // --- Thăng Long -> Sateco (Chuyển khoản dòng Giấy tờ) ---
    const openTlSatecoModal = async (stage) => {
        setTlSatecoModal(stage); setLoadingTlSateco(true);
        const { data } = await supabase.from('internal_payment_history').select('*').eq('payment_stage_id', stage.id).order('payment_date', { ascending: false });
        setTlSatecoHistory(data || []); setLoadingTlSateco(false);
    };

    async function handleAddTlSatecoPayment() {
        if (!tlSatecoForm.date || !tlSatecoForm.amount) return;
        const amount = Number(tlSatecoForm.amount);
        const { data: insertedData } = await supabase.from('internal_payment_history').insert([{ payment_stage_id: tlSatecoModal.id, payment_date: tlSatecoForm.date, amount, description: tlSatecoForm.notes }]).select().single();
        // Fetch-before-write: lấy giá trị mới nhất từ DB để tránh race condition
        const { data: freshStage } = await supabase.from('payments').select('internal_paid').eq('id', tlSatecoModal.id).single();
        const currentPaid = Number(freshStage?.internal_paid || 0);
        const newPaid = currentPaid + amount;
        await supabase.from('payments').update({ internal_paid: newPaid }).eq('id', tlSatecoModal.id);
        
        await logAudit({
            action: 'CREATE',
            tableName: 'internal_payment_history',
            recordId: insertedData?.id || tlSatecoModal.id,
            recordName: `Thanh toán Nội bộ - Đợt ${tlSatecoModal.name}`,
            changes: { amount: { old: null, new: amount } },
            metadata: { project_id: project.id }
        });

        setTlSatecoForm({ date: '', amount: '', notes: '' });
        invalidateStages();
        const { data: updated } = await supabase.from('payments').select('*').eq('id', tlSatecoModal.id).single();
        if (updated) setTlSatecoModal(updated);
        openTlSatecoModal(updated || tlSatecoModal);
    };

    const handleDeleteTlSatecoPayment = async (record) => {
        if (!window.confirm('Xóa giao dịch này?')) return;
        await supabase.from('internal_payment_history').delete().eq('id', record.id);
        
        await logAudit({
            action: 'DELETE',
            tableName: 'internal_payment_history',
            recordId: record.id,
            recordName: `Xóa Lịch sử Thanh toán Nội bộ - Đợt ${tlSatecoModal.name}`,
            changes: { amount: { old: record.amount, new: null } },
            metadata: { project_id: project.id }
        });

        // SUM-based recalculation: tính lại tổng từ lịch sử thay vì phép trừ
        const { data: remaining } = await supabase.from('internal_payment_history').select('amount').eq('payment_stage_id', tlSatecoModal.id);
        const newPaid = (remaining || []).reduce((sum, r) => sum + Number(r.amount || 0), 0);
        await supabase.from('payments').update({ internal_paid: newPaid }).eq('id', tlSatecoModal.id);
        invalidateStages();
        const { data: updated } = await supabase.from('payments').select('*').eq('id', tlSatecoModal.id).single();
        if (updated) setTlSatecoModal(updated);
        openTlSatecoModal(updated || tlSatecoModal);
    };

    // Kpis Summary
    const totalRequest = stages.reduce((s, p) => s + Number(p.payment_request_amount || 0), 0);
    const totalIncome = stages.reduce((s, p) => s + Number(p.external_income || 0), 0);
    const totalExpected = stages.reduce((s, p) => s + Number(p.expected_amount || 0), 0);
    
    // Thang Long -> Sateco
    const totalTransferRequired = totalIncome * contractRatio;
    const totalTransferred = stages.reduce((s, p) => s + Number(p.internal_paid || 0), 0);
    const totalTransferDebt = totalTransferRequired - totalTransferred;

    // Sateco -> Thang Long
    const totalRefundCashRequired = totalIncome * refundRatio;

    const overallProgress = totalExpected > 0 ? Math.min(100, (totalIncome / totalExpected) * 100) : 0;

    if (!project) return null;

    return (
        <div className={`flex flex-col h-full bg-white border border-slate-200/60 rounded-xl overflow-hidden animate-fade-in shadow-sm ${embedded ? 'min-h-[600px] mb-8' : 'absolute inset-0 z-50'}`}>
            
            {/* Header Area */}
            <div className="flex justify-between items-center p-4 border-b border-slate-200/60 bg-white shadow-sm z-10 shrink-0 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-full bg-gradient-to-l from-emerald-50 to-transparent -z-10"></div>
                <div className="absolute top-0 left-0 w-96 h-full bg-gradient-to-r from-blue-50 to-transparent -z-10"></div>
                
                <div className="flex items-center gap-4">
                    {!embedded && (
                        <button onClick={onBack} className="w-10 h-10 flex items-center justify-center bg-white hover:bg-slate-50 rounded-xl transition-all shadow-sm border border-slate-200 text-slate-500 hover:text-emerald-600">
                             <span className="material-symbols-outlined notranslate text-[22px]" translate="no">arrow_back</span>
                        </button>
                    )}
                    <div>
                        <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                             <span className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm border border-emerald-200/50">
                                <span className="material-symbols-outlined notranslate text-[18px]" translate="no">account_balance_wallet</span>
                            </span>
                            Kế hoạch Tiền Về & Phân bổ Nội Bộ
                        </h2>
                        <div className="text-[11px] font-bold text-slate-500 tracking-widest uppercase mt-0.5 ml-10">
                            Quản lý dòng tiền {project?.code} (HĐ: {contractRatio*100}% - Thực tế: {actualRatio*100}%)
                        </div>
                    </div>
                </div>

                <div className="flex gap-4 items-center">
                    <div className="bg-amber-50 text-amber-700 px-3 py-1.5 rounded-lg text-[10px] font-black border border-amber-100 flex items-center gap-2">
                        <span className="material-symbols-outlined notranslate text-[14px]" translate="no">info</span>
                        NHẬP LIỆU TẠI TAB "HỒ SƠ & THANH TOÁN"
                    </div>
                    <button onClick={invalidateStages} className="w-10 h-10 flex items-center justify-center bg-white hover:bg-slate-50 rounded-xl transition-all shadow-sm border border-slate-200 text-slate-500 hover:text-emerald-600">
                        <span className="material-symbols-outlined notranslate block" translate="no">refresh</span>
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className={`flex-1 overflow-auto bg-slate-50/50 ${embedded ? 'p-0 relative' : 'p-6'}`}>
                <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
                    
                    {/* KPI Section */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-white rounded-xl border border-blue-200 shadow-sm p-4 relative overflow-hidden group">
                            <div className="absolute -right-6 -top-6 w-24 h-24 bg-blue-50 rounded-full blur-2xl group-hover:bg-blue-100 transition-colors"></div>
                            <div className="flex items-center gap-2 mb-2 relative z-10">
                                <span className="material-symbols-outlined notranslate text-blue-500 text-[18px]" translate="no">receipt_long</span>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Tổng Đề Nghị TT (Thăng Long)</p>
                            </div>
                            <p className="text-2xl font-black text-blue-700 tabular-nums relative z-10">{fmt(totalRequest)} <span className="text-sm text-blue-400 font-bold">₫</span></p>
                        </div>
                        <div className="bg-white rounded-xl border border-emerald-200 shadow-sm p-4 relative overflow-hidden group">
                            <div className="absolute -right-6 -top-6 w-24 h-24 bg-emerald-50 rounded-full blur-2xl group-hover:bg-emerald-100 transition-colors"></div>
                            <div className="flex items-center gap-2 mb-2 relative z-10">
                                <span className="material-symbols-outlined notranslate text-emerald-500 text-[18px]" translate="no">account_balance</span>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Thực Thu từ CĐT</p>
                            </div>
                            <p className="text-2xl font-black text-emerald-600 tabular-nums relative z-10">{fmt(totalIncome)} <span className="text-sm text-emerald-400 font-bold">₫</span></p>
                        </div>
                        <div className="bg-white rounded-xl border border-indigo-200 shadow-sm p-4 relative overflow-hidden group">
                            <div className="absolute -right-6 -top-6 w-24 h-24 bg-indigo-50 rounded-full blur-2xl group-hover:bg-indigo-100 transition-colors"></div>
                            <div className="flex items-center gap-2 mb-2 relative z-10">
                                <span className="material-symbols-outlined notranslate text-indigo-500 text-[18px]" translate="no">sync_alt</span>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">TL Nợ Sateco (Dòng giấy tờ)</p>
                            </div>
                            <p className="text-2xl font-black text-indigo-700 tabular-nums relative z-10">{fmt(totalTransferDebt)} <span className="text-sm text-indigo-400 font-bold">₫</span></p>
                            <p className="text-[10px] text-slate-400 mt-1 relative z-10">Đã chuyển: {fmt(totalTransferred)} ₫</p>
                        </div>
                        <div className="bg-white rounded-xl border border-amber-200 shadow-sm p-4 relative overflow-hidden group bg-gradient-to-br from-amber-50/50 to-white">
                            <div className="absolute -right-6 -top-6 w-24 h-24 bg-amber-100 rounded-full blur-2xl group-hover:bg-amber-200 transition-colors"></div>
                            <div className="flex items-center gap-2 mb-2 relative z-10">
                                <span className="material-symbols-outlined notranslate text-amber-500 text-[18px]" translate="no">payments</span>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Sateco Hoàn Trả Thăng Long</p>
                            </div>
                            <p className="text-2xl font-black text-amber-600 tabular-nums relative z-10">{fmt(totalRefundCashRequired)} <span className="text-sm text-amber-400 font-bold">₫</span></p>
                            <p className="text-[10px] text-amber-600/60 mt-1 font-bold relative z-10">Dòng tiền mặt nội bộ Sateco ({Math.round(refundRatio*1000)/10}%)</p>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                        <div className="flex justify-between text-xs mb-2">
                            <span className="font-bold text-slate-600 uppercase tracking-widest text-[10px]">Tiến độ thu tiền CĐT so với Kế Hoạch ({fmt(totalExpected)} ₫)</span>
                            <span className={`font-black text-sm ${overallProgress >= 80 ? 'text-emerald-600' : overallProgress >= 40 ? 'text-blue-600' : 'text-orange-500'}`}>{overallProgress.toFixed(1)}%</span>
                        </div>
                        <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                            <div className={`h-full rounded-full transition-all duration-1000 ${overallProgress >= 80 ? 'bg-emerald-500' : overallProgress >= 40 ? 'bg-blue-500' : 'bg-orange-400'}`} style={{ width: `${overallProgress}%` }} />
                        </div>
                    </div>

                    {/* Input is now centralized in DocumentTrackingModule */}











                    {/* Stage Cards */}
                    {loading ? (
                        <div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="h-24 bg-slate-200 rounded-xl animate-pulse" />)}</div>
                    ) : stages.length === 0 ? (
                        <div className="text-center py-20 bg-white border border-slate-200 rounded-xl shadow-sm">
                            <span className="material-symbols-outlined notranslate text-5xl text-slate-300 block mb-3" translate="no">account_balance_wallet</span>
                            <p className="text-slate-600 font-bold mb-1">Chưa có giai đoạn thanh toán nào</p>
                            <p className="text-slate-400 text-sm">Nhấn "Thêm đợt thanh toán" để lập kế hoạch dòng tiền.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {stages.map((stage, idx) => {
                                const status = getPaymentStatus(stage, lastPayDates[stage.id]);
                                const income = Number(stage.external_income || 0);
                                const request = Number(stage.payment_request_amount || 0);
                                const pct = request > 0 ? Math.min(100, (income / request) * 100) : 0;
                                const diff = daysDiff(stage.due_date);
                                const isExpanded = expandedCard === stage.id;
                                const isEditing = editingStage === stage.id;
                                const isOverdue = status.key === 'overdue';

                                // Logic Math
                                const tlMustTransferToSateco = income * contractRatio;
                                const tlDidTransferToSateco = Number(stage.internal_paid || 0);
                                const tlDebtToSateco = tlMustTransferToSateco - tlDidTransferToSateco;

                                const satecoRefundCash = income * refundRatio;

                                return (
                                    <div key={stage.id} className={`bg-white rounded-xl shadow-sm border transition-all duration-300 ${isExpanded ? 'ring-2 ring-emerald-500 border-emerald-500' : 'border-slate-200 hover:border-emerald-300 hover:shadow-md'} ${isOverdue ? 'border-rose-300 ring-1 ring-rose-200' : ''}`}>
                                        
                                        {/* Card Header */}
                                        <div className="p-4 cursor-pointer" onClick={() => setExpandedCard(isExpanded ? null : stage.id)}>
                                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                                
                                                {/* Left: Info */}
                                                <div className="flex items-center gap-4 flex-1">
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black shadow-sm ${status.key === 'done' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : status.key === 'overdue' ? 'bg-rose-100 text-rose-700 border border-rose-200' : status.key === 'partial' ? 'bg-amber-100 text-amber-700 border border-amber-200' : status.key === 'late' ? 'bg-orange-100 text-orange-700 border border-orange-200' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                                                        {idx + 1}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <h3 className="font-bold text-slate-800 text-[15px]">{stage.stage_name}</h3>
                                                            {stage.stage_type && <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider border border-slate-200">{stage.stage_type}</span>}
                                                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest border border-slate-200/50 ${status.color}`}>
                                                                <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`}></span>
                                                                {status.label}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
                                                            <span>Kế hoạch: <strong className="text-slate-700">{fmt(stage.expected_amount)} ₫</strong></span>
                                                            {stage.due_date && (
                                                                <span className={`flex items-center gap-1 ${isOverdue ? 'text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded' : ''}`}>
                                                                    <span className="material-symbols-outlined notranslate text-[14px]" translate="no">calendar_clock</span>
                                                                    Hạn: {fmtDate(stage.due_date)}
                                                                    {diff !== null && diff > 0 && <span className="ml-1">(Trễ {diff} ngày)</span>}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Right: Metrics */}
                                                <div className="flex items-center gap-6 w-full md:w-auto">
                                                    <div className="text-right flex-1 md:flex-none">
                                                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-0.5">Tiến độ thu tiền CĐT</div>
                                                        <div className="flex items-baseline justify-end gap-1">
                                                            <span className={`text-xl font-black tabular-nums tracking-tight ${status.key === 'done' ? 'text-emerald-600' : 'text-slate-800'}`}>{fmt(income)}</span>
                                                            <span className="text-xs text-slate-400 font-bold">/ {fmt(request)}</span>
                                                        </div>
                                                    </div>
                                                    
                                                    {/* Small Progress */}
                                                    <div className="w-12 h-12 flex items-center justify-center relative shrink-0">
                                                        <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                                                            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#f1f5f9" strokeWidth="3" />
                                                            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={status.key === 'done' ? '#10b981' : status.key === 'overdue' ? '#f43f5e' : status.key === 'partial' ? '#f59e0b' : '#3b82f6'} strokeWidth="3" strokeDasharray={`${pct}, 100`} className="transition-all duration-1000" />
                                                        </svg>
                                                        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-slate-700">{pct.toFixed(0)}%</span>
                                                    </div>

                                                    <button className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${isExpanded ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                                                        <span className="material-symbols-outlined notranslate transition-transform duration-300" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }} translate="no">expand_more</span>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Expanded Details */}
                                        {isExpanded && (
                                            <div className="bg-slate-50 border-t border-slate-200 p-5 space-y-5 rounded-b-xl">
                                                
                                                {/* 3 Columns Logic */}
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                    
                                                    {/* Column 1: CĐT -> Thăng Long */}
                                                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 relative overflow-hidden">
                                                        <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                                                        <div className="flex items-center gap-2 mb-3">
                                                            <span className="material-symbols-outlined notranslate text-blue-500" translate="no">business_center</span>
                                                            <h4 className="font-bold text-slate-800 text-sm">CĐT nộp Thăng Long</h4>
                                                        </div>
                                                        <div className="space-y-2 text-sm">
                                                            <div className="flex justify-between items-center"><span className="text-slate-500">Đề nghị TT (Gồm VAT):</span> <strong className="text-slate-800">{fmt(request)}</strong></div>
                                                            <div className="flex justify-between items-center"><span className="text-slate-500">Thực thu CĐT:</span> <strong className="text-blue-600 text-base">{fmt(income)}</strong></div>
                                                            <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                                                                <span className="text-slate-500">CĐT còn nợ TL:</span> 
                                                                <strong className="text-rose-500">{fmt(Math.max(0, request - income))}</strong>
                                                            </div>
                                                        </div>
                                                        <div className="mt-4 pt-3 border-t border-slate-100">
                                                            <button onClick={() => openCdtModal(stage)} className="w-full py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-lg border border-blue-200 transition-colors">Cập nhật Lịch sử Thu CĐT</button>
                                                        </div>
                                                    </div>

                                                    {/* Column 2: Thăng Long -> Sateco */}
                                                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 relative overflow-hidden">
                                                        <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                                                        <div className="flex items-center gap-2 mb-3">
                                                            <span className="material-symbols-outlined notranslate text-indigo-500" translate="no">account_balance</span>
                                                            <h4 className="font-bold text-slate-800 text-sm">TL chuyển Sateco ({contractRatio*100}%)</h4>
                                                        </div>
                                                        <div className="space-y-2 text-sm">
                                                            <div className="flex justify-between items-center"><span className="text-slate-500">Phải chuyển Sateco:</span> <strong className="text-slate-800">{fmt(tlMustTransferToSateco)}</strong></div>
                                                            <div className="flex justify-between items-center"><span className="text-slate-500">Đã chuyển Sateco:</span> <strong className="text-indigo-600 text-base">{fmt(tlDidTransferToSateco)}</strong></div>
                                                            <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                                                                <span className="text-slate-500">TL còn nợ HT:</span> 
                                                                <strong className="text-rose-500">{fmt(Math.max(0, tlDebtToSateco))}</strong>
                                                            </div>
                                                        </div>
                                                        <div className="mt-4 pt-3 border-t border-slate-100">
                                                            <button onClick={() => openTlSatecoModal(stage)} className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg border border-indigo-200 transition-colors">Cập nhật Lịch sử Chuyển Sateco</button>
                                                        </div>
                                                    </div>

                                                    {/* Column 3: Sateco -> Thăng Long (Hoàn trả) */}
                                                    <div className="bg-amber-50 rounded-xl border border-amber-200 shadow-sm p-4 relative overflow-hidden flex flex-col justify-between">
                                                        <div className="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>
                                                        <div>
                                                            <div className="flex items-center gap-2 mb-3">
                                                                <span className="material-symbols-outlined notranslate text-amber-600" translate="no">currency_exchange</span>
                                                                <h4 className="font-bold text-amber-900 text-sm">Sateco hoàn Thăng Long</h4>
                                                            </div>
                                                            <p className="text-xs text-amber-700 mb-4">Hoàn trả tiền mặt phần chênh lệch tỷ lệ dòng tiền ({contractRatio*100}% - {actualRatio*100}% = {Math.round(refundRatio*1000)/10}%).</p>
                                                            <div className="text-center p-3 bg-white rounded-lg border border-amber-200 shadow-inner">
                                                                <div className="text-[10px] text-amber-600 font-bold uppercase tracking-widest mb-1">Cần hoàn trả ngay</div>
                                                                <div className="text-2xl font-black text-amber-600">{fmt(satecoRefundCash)} ₫</div>
                                                            </div>
                                                        </div>
                                                        <div className="mt-4 text-xs text-center text-amber-700 font-medium opacity-70">
                                                            (Phát sinh tự động dựa trên Thực thu)
                                                        </div>
                                                    </div>

                                                </div>

                                                {/* Edit Form (Hóa Đơn & ĐNTT Setup) */}
                                                <div className="mt-4">
                                                    {isEditing ? (
                                                        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm mt-4">
                                                            <div className="flex justify-between items-center mb-4">
                                                                <p className="text-xs font-black text-slate-700 uppercase tracking-widest">Cập nhật Chữ ký / Hóa đơn</p>
                                                                <div className="flex gap-2">
                                                                    <button onClick={() => setEditingStage(null)} className="px-4 py-1.5 bg-slate-100 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-200 transition-colors">Hủy</button>
                                                                    <button onClick={() => handleSaveEdit(stage)} className="px-4 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 shadow-sm shadow-emerald-500/20 transition-colors">Lưu Thay Đổi</button>
                                                                </div>
                                                            </div>
                                                            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                                                                <div>
                                                                    <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Ngày xuất HĐ</label>
                                                                    <input type="date" value={editForm.invoiceDate} onChange={e => setEditForm(f => ({ ...f, invoiceDate: e.target.value }))} className="w-full rounded border border-slate-300 bg-white px-2.5 py-2 text-sm focus:border-emerald-500 outline-none" />
                                                                </div>
                                                                <div>
                                                                    <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Giá trị HĐ (Gồm VAT)</label>
                                                                    <input type="number" value={editForm.invoice} onChange={e => setEditForm(f => ({ ...f, invoice: e.target.value }))} className="w-full rounded border border-slate-300 bg-white px-2.5 py-2 text-sm focus:border-emerald-500 outline-none font-bold" />
                                                                </div>
                                                                <div className="bg-blue-50/50 p-2 -m-2 rounded-lg border border-blue-100">
                                                                    <label className="block text-[10px] font-black text-blue-600 mb-1 uppercase">ĐNTT tới CĐT (Gồm VAT)</label>
                                                                    <input type="number" value={editForm.request} onChange={e => setEditForm(f => ({ ...f, request: e.target.value }))} className="w-full rounded border border-blue-300 bg-white px-2.5 py-2 text-sm focus:border-blue-500 outline-none font-black text-blue-700 shadow-inner" />
                                                                </div>
                                                                <div>
                                                                    <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Hạn TT của CĐT</label>
                                                                    <input type="date" value={editForm.dueDate} onChange={e => setEditForm(f => ({ ...f, dueDate: e.target.value }))} className="w-full rounded border border-slate-300 bg-white px-2.5 py-2 text-sm focus:border-emerald-500 outline-none" />
                                                                </div>
                                                                <div>
                                                                    <label className="block text-[10px] font-bold text-orange-600 mb-1 uppercase">Tiền Phụ lục đợt này (₫)</label>
                                                                    <input type="number" value={editForm.addenda} onChange={e => setEditForm(f => ({ ...f, addenda: e.target.value }))} className="w-full rounded border border-orange-300 bg-white px-2.5 py-2 text-sm text-orange-600 font-bold focus:border-orange-500 outline-none" />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                                                            <button onClick={() => { setEditingStage(stage.id); setEditForm({ invoice: stage.invoice_amount || '', invoiceDate: stage.invoice_date || '', request: stage.payment_request_amount || '', dueDate: stage.due_date || '', addenda: stage.addenda_amount || '' }); }}
                                                                className="px-4 py-2 text-xs bg-white border border-slate-300 text-slate-700 hover:border-emerald-400 hover:text-emerald-700 rounded-lg font-bold transition-all flex items-center gap-1.5 shadow-sm">
                                                                <span className="material-symbols-outlined notranslate text-[16px]" translate="no">edit_document</span> Set Thông Số Hóa Đơn / ĐNTT
                                                            </button>
                                                            <button onClick={() => handleDeleteStage(stage.id)} className="px-3 py-2 text-xs text-rose-500 hover:bg-rose-50 rounded-lg font-bold transition-colors flex items-center gap-1 whitespace-nowrap">
                                                                <span className="material-symbols-outlined notranslate text-[16px]" translate="no">delete</span> Xóa đợt
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>

                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Modals for updates */}
            {cdtModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in" onClick={() => setCdtModal(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-slide-in" onClick={e => e.stopPropagation()}>
                        <div className="bg-blue-600 p-5 text-white flex justify-between items-center">
                            <div>
                                <h3 className="font-black text-lg flex items-center gap-2"><span className="material-symbols-outlined notranslate" translate="no">business_center</span> Lịch sử CĐT Nộp Tiền</h3>
                                <p className="text-blue-100 text-xs font-medium mt-1">Giai đoạn: {cdtModal.stage_name}</p>
                            </div>
                            <button onClick={() => setCdtModal(null)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-700 hover:bg-blue-800 transition-colors"><span className="material-symbols-outlined notranslate text-[20px]" translate="no">close</span></button>
                        </div>
                        <div className="p-6">
                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                                <p className="text-xs font-black text-blue-800 uppercase tracking-widest mb-3">Thêm giao dịch mới (CĐT -&gt; Thăng Long)</p>
                                <div className="flex flex-wrap gap-3">
                                    <div className="flex-1 min-w-[120px]">
                                        <input type="date" value={cdtForm.date} onChange={e => setCdtForm(f => ({ ...f, date: e.target.value }))} className="w-full rounded border border-blue-300 px-3 py-2 text-sm focus:border-blue-500 outline-none" />
                                    </div>
                                    <div className="flex-1 min-w-[140px]">
                                        <input type="number" value={cdtForm.amount} onChange={e => setCdtForm(f => ({ ...f, amount: e.target.value }))} className="w-full rounded border border-blue-300 px-3 py-2 text-sm font-bold text-blue-700 placeholder-blue-300 focus:border-blue-500 outline-none" placeholder="Số tiền (₫)" />
                                    </div>
                                    <div className="flex-[2] min-w-[160px]">
                                        <input type="text" value={cdtForm.notes} onChange={e => setCdtForm(f => ({ ...f, notes: e.target.value }))} className="w-full rounded border border-blue-300 px-3 py-2 text-sm focus:border-blue-500 outline-none" placeholder="Ghi chú (VD: Bank transfer...)" />
                                    </div>
                                    <button onClick={handleAddCdtPayment} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded shadow transition-colors">Lưu</button>
                                </div>
                            </div>
                            
                            <h4 className="font-black text-slate-700 uppercase tracking-widest text-[11px] mb-3">Lịch sử thu tiền ({cdtHistory.length})</h4>
                            <div className="space-y-2 max-h-60 overflow-auto">
                                {cdtHistory.map(rec => (
                                    <div key={rec.id} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg">
                                        <div>
                                            <div className="font-bold text-blue-700">{fmt(rec.amount)} ₫</div>
                                            <div className="text-xs text-slate-500 mt-1">{fmtDate(rec.payment_date)} {rec.description && `• ${rec.description}`}</div>
                                        </div>
                                        <button onClick={() => handleDeleteCdtPayment(rec)} className="w-8 h-8 flex items-center justify-center text-rose-500 hover:bg-rose-100 rounded-lg transition-colors"><span className="material-symbols-outlined notranslate text-[18px]" translate="no">delete</span></button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {tlSatecoModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in" onClick={() => setTlSatecoModal(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-slide-in" onClick={e => e.stopPropagation()}>
                        <div className="bg-indigo-600 p-5 text-white flex justify-between items-center">
                            <div>
                                <h3 className="font-black text-lg flex items-center gap-2"><span className="material-symbols-outlined notranslate" translate="no">sync_alt</span> Lịch sử Thăng Long Chuyển Sateco</h3>
                                <p className="text-indigo-100 text-xs font-medium mt-1">Giai đoạn: {tlSatecoModal.stage_name} (Tỷ lệ phân bổ: {contractRatio*100}%)</p>
                            </div>
                            <button onClick={() => setTlSatecoModal(null)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-indigo-700 hover:bg-indigo-800 transition-colors"><span className="material-symbols-outlined notranslate text-[20px]" translate="no">close</span></button>
                        </div>
                        <div className="p-6">
                            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-6">
                                <p className="text-xs font-black text-indigo-800 uppercase tracking-widest mb-3">Thêm giao dịch chuyển khoản nội bộ</p>
                                <div className="flex flex-wrap gap-3">
                                    <div className="flex-1 min-w-[120px]">
                                        <input type="date" value={tlSatecoForm.date} onChange={e => setTlSatecoForm(f => ({ ...f, date: e.target.value }))} className="w-full rounded border border-indigo-300 px-3 py-2 text-sm focus:border-indigo-500 outline-none" />
                                    </div>
                                    <div className="flex-1 min-w-[140px]">
                                        <input type="number" value={tlSatecoForm.amount} onChange={e => setTlSatecoForm(f => ({ ...f, amount: e.target.value }))} className="w-full rounded border border-indigo-300 px-3 py-2 text-sm font-bold text-indigo-700 placeholder-indigo-300 focus:border-indigo-500 outline-none" placeholder="Số tiền (₫)" />
                                    </div>
                                    <div className="flex-[2] min-w-[160px]">
                                        <input type="text" value={tlSatecoForm.notes} onChange={e => setTlSatecoForm(f => ({ ...f, notes: e.target.value }))} className="w-full rounded border border-indigo-300 px-3 py-2 text-sm focus:border-indigo-500 outline-none" placeholder="Ghi chú (VD: CK nội bộ...)" />
                                    </div>
                                    <button onClick={handleAddTlSatecoPayment} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded shadow transition-colors">Lưu</button>
                                </div>
                            </div>
                            
                            <h4 className="font-black text-slate-700 uppercase tracking-widest text-[11px] mb-3">Lịch sử chuyển ({tlSatecoHistory.length})</h4>
                            <div className="space-y-2 max-h-60 overflow-auto">
                                {tlSatecoHistory.map(rec => (
                                    <div key={rec.id} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg">
                                        <div>
                                            <div className="font-bold text-indigo-700">{fmt(rec.amount)} ₫</div>
                                            <div className="text-xs text-slate-500 mt-1">{fmtDate(rec.payment_date)} {rec.description && `• ${rec.description}`}</div>
                                        </div>
                                        <button onClick={() => handleDeleteTlSatecoPayment(rec)} className="w-8 h-8 flex items-center justify-center text-rose-500 hover:bg-rose-100 rounded-lg transition-colors"><span className="material-symbols-outlined notranslate text-[18px]" translate="no">delete</span></button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
