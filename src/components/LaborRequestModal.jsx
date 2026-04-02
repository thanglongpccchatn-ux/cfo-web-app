import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { fmt, formatInputNumber } from '../utils/formatters';
import SearchableSelect from './SearchableSelect';

export default function LaborRequestModal({ isOpen, onClose, onSuccess, project, projects = [] }) {
    const [form, setForm] = useState({
        contractId: '',
        projectId: project?.id || '',
        paymentStage: 'Tạm ứng',
        contractValue: '',
        requestDate: new Date().toISOString().split('T')[0],
        completedPrevious: '',
        completedCurrent: '',
        requestedAmount: '',
        invoicedAmount: '',
        dailyLaborCount: '',
        dailyLaborRate: '',
        priority: 'Bình thường',
        notes: ''
    });
    const [submitting, setSubmitting] = useState(false);
    const isCongNhat = form.paymentStage === 'Công nhật';

    // Fetch Active Contracts for Dropdown (include Hoàn thành to allow final payments)
    const { data: activeContracts = [] } = useQuery({
        queryKey: ['active-contracts-dropdown', project?.id],
        queryFn: async () => {
            let query = supabase
                .from('subcontractor_contracts')
                .select('id, contract_code, contract_name, contract_type, contract_value, vat_rate, partners(id, name, short_name, code), projects(id, name, code, internal_code)')
                .in('status', ['Đang thực hiện', 'Tạm dừng', 'Hoàn thành'])
                .order('created_at', { ascending: false });

            if (project) {
                query = query.eq('project_id', project.id);
            }
            const { data } = await query;
            return data || [];
        },
        staleTime: 2 * 60 * 1000,
        enabled: isOpen,
    });

    const selectedContract = activeContracts.find(c => c.id === form.contractId);

    const handleContractChange = (val) => {
        const contract = activeContracts.find(c => c.id === val);
        if (contract) {
            const totalValue = contract.contract_value * (1 + (contract.vat_rate || 0) / 100);
            setForm(prev => ({
                ...prev,
                contractId: val,
                projectId: contract.projects?.id || prev.projectId,
                contractValue: String(Math.round(totalValue)),
            }));
        } else {
            setForm(prev => ({
                ...prev,
                contractId: '', contractValue: '',
            }));
        }
    };

    const handleNumChange = (field, value) => {
        const clean = value.replace(/[^0-9]/g, '');
        setForm(prev => ({ ...prev, [field]: clean }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!form.contractId) {
            alert('Vui lòng chọn Hợp đồng.');
            return;
        }
        if (!form.requestedAmount || Number(form.requestedAmount) <= 0) {
            alert('Vui lòng nhập Số tiền Đề nghị.');
            return;
        }

        setSubmitting(true);
        const contract = selectedContract;
        const teamName = contract?.partners?.short_name || contract?.partners?.code || contract?.partners?.name || 'Chưa xác định';

        const finalAmount = isCongNhat
            ? (Number(form.dailyLaborCount) || 0) * (Number(form.dailyLaborRate) || 0)
            : Number(form.requestedAmount) || 0;

        const payload = {
            project_id: form.projectId || null,
            team_name: teamName,
            payment_stage: form.paymentStage,
            request_type: isCongNhat ? 'Công nhật' : (form.paymentStage === 'Tạm ứng' ? 'Tạm ứng' : 'Nghiệm thu'),
            contract_value: Number(form.contractValue) || 0,
            request_date: form.requestDate || null,
            completed_previous: Number(form.completedPrevious) || 0,
            completed_current: Number(form.completedCurrent) || 0,
            requested_amount: finalAmount,
            daily_labor_count: Number(form.dailyLaborCount) || 0,
            daily_labor_rate: Number(form.dailyLaborRate) || 0,
            approved_amount: 0,
            payment_date: null,
            paid_amount: 0,
            priority: form.priority,
            notes: form.notes,
            status: 'PENDING'
        };

        const { error } = await supabase.from('expense_labor').insert([payload]);

        // Also update invoiced_amount on contract if provided
        if (!error && form.invoicedAmount && Number(form.invoicedAmount) > 0 && contract) {
            await supabase
                .from('subcontractor_contracts')
                .update({ invoiced_amount: Number(form.invoicedAmount) })
                .eq('id', contract.id);
        }

        setSubmitting(false);

        if (error) {
            alert('Lỗi: ' + error.message);
        } else {
            onSuccess?.();
            onClose();
            setForm({
                contractId: '', projectId: project?.id || '', paymentStage: 'Tạm ứng',
                contractValue: '', requestDate: new Date().toISOString().split('T')[0],
                completedPrevious: '', completedCurrent: '', requestedAmount: '',
                invoicedAmount: '', dailyLaborCount: '', dailyLaborRate: '',
                priority: 'Bình thường', notes: ''
            });
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-200/50 animate-slide-up">
                {/* Header */}
                <div className="px-8 py-5 bg-gradient-to-r from-indigo-50 via-white to-purple-50 border-b border-slate-100 relative overflow-hidden">
                    <div className="absolute -right-8 -top-8 w-32 h-32 bg-purple-100 rounded-full opacity-30 blur-2xl"></div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 text-[10px] mb-2 uppercase tracking-widest font-bold text-slate-400">
                            <span className="material-symbols-outlined text-[14px] text-purple-500">engineering</span>
                            <span>Quản lý Thầu phụ</span>
                            <span className="material-symbols-outlined text-[12px]">chevron_right</span>
                            <span className="text-purple-700">Tạo Đề nghị Thanh toán</span>
                        </div>
                        <h3 className="text-xl font-extrabold text-slate-800 tracking-tight flex items-center gap-3">
                            <span className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600 border border-purple-200 shadow-sm">
                                <span className="material-symbols-outlined text-[22px]">add_task</span>
                            </span>
                            Đề Nghị Thanh Toán
                        </h3>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="px-8 py-6 space-y-5 max-h-[65vh] overflow-y-auto">
                    {/* Row 1: Chọn Hợp đồng */}
                    <div className="space-y-2">
                        <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                            <span className="material-symbols-outlined text-[13px] align-middle mr-1 text-purple-500">assignment</span>
                            Chọn Hợp đồng <span className="text-rose-500">*</span>
                        </label>
                        <SearchableSelect
                            required
                            value={form.contractId}
                            onChange={handleContractChange}
                            placeholder={activeContracts.length > 0 ? "Gõ tìm HĐ, Nhà thầu, Dự án..." : "Không có hợp đồng nào..."}
                            options={activeContracts.map(c => ({
                                value: c.id,
                                label: `[${c.projects?.code || '??'}] ${c.partners?.short_name || c.partners?.name || '??'} — ${c.contract_name}`,
                                sub: c.contract_code ? `Số HĐ: ${c.contract_code}` : `Loại: ${c.contract_type}`
                            }))}
                        />
                    </div>

                    {/* Contract Info Card (shown when selected) */}
                    {selectedContract && (
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-3 gap-4 text-xs">
                            <div>
                                <div className="text-[9px] text-slate-400 uppercase tracking-widest font-bold mb-1">Dự án</div>
                                <div className="font-black text-purple-700">{selectedContract.projects?.code || '—'}</div>
                            </div>
                            <div>
                                <div className="text-[9px] text-slate-400 uppercase tracking-widest font-bold mb-1">Nhà thầu</div>
                                <div className="font-bold text-slate-800">{selectedContract.partners?.short_name || selectedContract.partners?.name || '—'}</div>
                            </div>
                            <div>
                                <div className="text-[9px] text-slate-400 uppercase tracking-widest font-bold mb-1">GT Hợp đồng (sau thuế)</div>
                                <div className="font-black text-emerald-700">{fmt(form.contractValue)}</div>
                            </div>
                        </div>
                    )}

                    {/* Row 2: Giai đoạn + Ngày */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-2">
                            <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Giai đoạn TT</label>
                            <SearchableSelect
                                value={form.paymentStage}
                                onChange={(val) => setForm({ ...form, paymentStage: val })}
                                placeholder="Chọn giai đoạn..."
                                options={[
                                    { value: 'Tạm ứng', label: 'Tạm ứng' },
                                    { value: 'Nghiệm thu lần 1', label: 'Nghiệm thu lần 1' },
                                    { value: 'Nghiệm thu lần 2', label: 'Nghiệm thu lần 2' },
                                    { value: 'Nghiệm thu lần 3', label: 'Nghiệm thu lần 3' },
                                    { value: 'Nghiệm thu lần 4', label: 'Nghiệm thu lần 4' },
                                    { value: 'Nghiệm thu lần 5', label: 'Nghiệm thu lần 5' },
                                    { value: 'Công nhật', label: '🔨 Công nhật' },
                                    { value: 'Phát sinh', label: '📌 Phát sinh' },
                                    { value: 'Quyết toán', label: 'Quyết toán' },
                                    { value: 'Bảo lãnh', label: 'Bảo lãnh' },
                                ]}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Ngày đề nghị</label>
                            <input
                                type="date"
                                value={form.requestDate}
                                onChange={(e) => setForm({ ...form, requestDate: e.target.value })}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                            />
                        </div>
                    </div>

                    {/* Row 3: Công nhật fields OR KL Hoàn thành */}
                    {isCongNhat ? (
                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-4">
                            <div className="text-[10px] font-extrabold text-amber-700 uppercase tracking-widest flex items-center gap-1">
                                <span className="material-symbols-outlined text-[13px]">construction</span>
                                Chi tiết Công nhật
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="block text-[11px] font-bold text-amber-600 uppercase">Số công (ngày)</label>
                                    <input
                                        placeholder="VD: 15"
                                        value={form.dailyLaborCount}
                                        onChange={(e) => setForm({ ...form, dailyLaborCount: e.target.value.replace(/[^0-9.]/g, '') })}
                                        className="w-full bg-white border border-amber-300 rounded-xl px-4 py-3 text-sm text-right font-bold text-amber-700 focus:ring-2 focus:ring-amber-400 outline-none"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="block text-[11px] font-bold text-amber-600 uppercase">Đơn giá / công</label>
                                    <input
                                        placeholder="VD: 350,000"
                                        value={form.dailyLaborRate ? formatInputNumber(form.dailyLaborRate) : ''}
                                        onChange={(e) => handleNumChange('dailyLaborRate', e.target.value)}
                                        className="w-full bg-white border border-amber-300 rounded-xl px-4 py-3 text-sm text-right font-bold text-amber-700 focus:ring-2 focus:ring-amber-400 outline-none"
                                    />
                                </div>
                            </div>
                            {form.dailyLaborCount && form.dailyLaborRate && (
                                <div className="text-right text-sm font-black text-amber-800 bg-amber-100 rounded-lg px-4 py-2 border border-amber-200">
                                    = {Number(form.dailyLaborCount)} công × {fmt(form.dailyLaborRate)} = <span className="text-lg">{fmt(Number(form.dailyLaborCount) * Number(form.dailyLaborRate))} ₫</span>
                                </div>
                            )}
                        </div>
                    ) : (
                        <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="space-y-2">
                                <label className="block text-[11px] font-extrabold text-orange-500 uppercase tracking-wider">KL Hoàn thành Lũy kế Kỳ trước</label>
                                <input
                                    placeholder="VD: 500,000,000"
                                    value={form.completedPrevious ? formatInputNumber(form.completedPrevious) : ''}
                                    onChange={(e) => handleNumChange('completedPrevious', e.target.value)}
                                    className="w-full bg-orange-50/30 border border-orange-200 rounded-xl px-4 py-3 text-sm text-right font-medium text-orange-700 focus:ring-2 focus:ring-orange-400 outline-none transition-all"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="block text-[11px] font-extrabold text-orange-600 uppercase tracking-wider">KL Hoàn thành Kỳ này</label>
                                <input
                                    placeholder="VD: 150,000,000"
                                    value={form.completedCurrent ? formatInputNumber(form.completedCurrent) : ''}
                                    onChange={(e) => handleNumChange('completedCurrent', e.target.value)}
                                    className="w-full bg-orange-50/50 border border-orange-200 rounded-xl px-4 py-3 text-sm text-right font-bold text-orange-700 focus:ring-2 focus:ring-orange-400 outline-none transition-all"
                                />
                            </div>
                        </div>

                        {/* Row 4: Tiền Hóa đơn (chỉ hiển thị nếu là Thầu phụ) */}
                        {selectedContract?.contract_type === 'Thầu phụ' && (
                            <div className="space-y-2">
                                <label className="block text-[11px] font-extrabold text-amber-600 uppercase tracking-wider">
                                    <span className="material-symbols-outlined text-[13px] align-middle mr-1">receipt_long</span>
                                    Tiền Hóa đơn (Lũy kế đến hiện tại)
                                </label>
                                <input
                                    placeholder="Tổng tiền đã xuất hóa đơn..."
                                    value={form.invoicedAmount ? formatInputNumber(form.invoicedAmount) : ''}
                                    onChange={(e) => handleNumChange('invoicedAmount', e.target.value)}
                                    className="w-full bg-amber-50/50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-right font-bold text-amber-700 focus:ring-2 focus:ring-amber-400 outline-none transition-all"
                                />
                            </div>
                        )}
                        </>
                    )}

                    {/* Row 5: SỐ TIỀN ĐỀ NGHỊ (highlight) — ẩn khi Công nhật vì auto-calc */}
                    {!isCongNhat && (
                    <div className="p-5 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-200 shadow-sm">
                        <label className="block text-[11px] font-extrabold text-indigo-600 uppercase tracking-wider mb-2">
                            <span className="material-symbols-outlined text-[14px] align-middle mr-1">payments</span>
                            Số tiền Đề nghị Thanh toán <span className="text-rose-500">*</span>
                        </label>
                        <input
                            required={!isCongNhat}
                            placeholder="Nhập số tiền..."
                            value={form.requestedAmount ? formatInputNumber(form.requestedAmount) : ''}
                            onChange={(e) => handleNumChange('requestedAmount', e.target.value)}
                            className="w-full bg-white border-2 border-indigo-300 rounded-xl px-5 py-4 text-lg text-right font-black text-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-inner"
                        />
                        {form.requestedAmount && (
                            <div className="mt-2 text-right text-xs font-bold text-indigo-500">
                                = {fmt(form.requestedAmount)} ₫
                            </div>
                        )}
                    </div>
                    )}

                    {/* Row 6: Priority + Notes */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        <div className="space-y-2">
                            <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Mức độ khẩn</label>
                            <SearchableSelect
                                value={form.priority}
                                onChange={(val) => setForm({ ...form, priority: val })}
                                placeholder="Chọn mức độ..."
                                options={[
                                    { value: 'Bình thường', label: 'Bình thường' },
                                    { value: 'Cao', label: '🔥 Cao' },
                                    { value: 'Khẩn cấp', label: '🚨 Khẩn cấp' },
                                    { value: 'Thấp', label: 'Thấp' },
                                ]}
                            />
                        </div>
                        <div className="md:col-span-2 space-y-2">
                            <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Ghi chú nội bộ</label>
                            <input
                                placeholder="Ghi chú trình ký, xác nhận khối lượng..."
                                value={form.notes}
                                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                            />
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-5 border-t border-slate-100 flex justify-between items-center">
                        <div className="text-[10px] text-slate-400 font-medium">
                            <span className="material-symbols-outlined text-[14px] align-middle mr-1">info</span>
                            Phiếu sẽ chuyển sang trạng thái <span className="font-black text-amber-600">Chờ Kế Toán Chi</span>
                        </div>
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-6 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                            >
                                Hủy bỏ
                            </button>
                            <button
                                type="submit"
                                disabled={submitting || !form.contractId}
                                className="px-8 py-2.5 bg-gradient-to-br from-purple-600 to-indigo-700 text-white text-sm font-bold rounded-xl shadow-lg shadow-purple-500/20 hover:shadow-xl hover:shadow-purple-500/30 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center gap-2"
                            >
                                {submitting ? (
                                    <>
                                        <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                                        Đang lưu...
                                    </>
                                ) : (
                                    <>
                                        <span className="material-symbols-outlined text-[18px]">send</span>
                                        Gửi Yêu Cầu
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
