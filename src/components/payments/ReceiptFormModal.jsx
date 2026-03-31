import React from 'react';
import { fmt } from '../../utils/formatters';

/**
 * ReceiptFormModal — Form for adding/editing payment receipts
 * Extracted from PaymentReceiptsModule to reduce file size
 */
export default function ReceiptFormModal({
    showModal, setShowModal,
    activeTab, activeEntity,
    isEditing, form, setForm,
    projects, availablePayments,
    handleProjectChange, handlePaymentChange,
    handleSubmit,
    formatNum
}) {
    if (!showModal) return null;

    let contextInfo = null;
    if (activeTab === 'internal' && form.paymentId && form.projectId) {
        const selectedPayment = availablePayments.find(p => String(p.id) === String(form.paymentId));
        const selectedProject = projects.find(p => String(p.id) === String(form.projectId));

        if (selectedPayment && selectedProject) {
            const extInc = Number(selectedPayment.external_income || 0);
            const taxRatio = selectedProject.sateco_contract_ratio != null ? selectedProject.sateco_contract_ratio : 98;
            const actualRatio = selectedProject.sateco_actual_ratio != null ? selectedProject.sateco_actual_ratio : 95.5;

            contextInfo = (
                <div className="bg-slate-50 border border-slate-100 p-3 rounded-2xl mt-3 animate-fade-in shadow-inner flex flex-col gap-2">
                    <p className="text-[11px] text-slate-500 font-bold flex justify-between items-center">
                        TL đã thu từ CĐT: <span className="text-emerald-600 font-black tabular-nums bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded shadow-sm">{formatNum(extInc)} ₫</span>
                    </p>
                    <div className="flex justify-between items-center text-[10px] whitespace-nowrap overflow-x-auto gap-2">
                        <span className="text-slate-400 font-medium">Tỷ lệ Nội bộ:</span>
                        <div className="flex gap-2">
                            <span className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-bold border border-blue-100">HĐ: {taxRatio}%</span>
                            <span className="bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-bold border border-indigo-100">Dòng tiền: {actualRatio}%</span>
                        </div>
                    </div>
                </div>
            );
        }
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowModal(false)}></div>
            <div className="bg-white w-full max-w-lg rounded-[32px] shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-200">
                <div className={`px-8 py-6 border-b border-slate-100 flex justify-between items-center ${activeTab === 'external' ? 'bg-orange-50' : 'bg-indigo-50'}`}>
                    <div>
                        <h3 className="text-xl font-black text-slate-800">{activeTab === 'external' ? 'Ghi nhận thu tiền CĐT' : 'Ghi nhận chuyển tiền Sateco'}</h3>
                        <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-1">Cập nhật lịch sử dòng tiền thực tế</p>
                    </div>
                    <button onClick={() => setShowModal(false)} className="w-9 h-9 flex items-center justify-center rounded-full bg-white hover:bg-slate-200 transition-colors text-slate-400 shadow-sm border border-slate-200">
                        <span className="material-symbols-outlined notranslate" translate="no">close</span>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-5">
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Chọn Dự án / Hợp đồng <span className="text-rose-500">*</span></label>
                        <select 
                            value={form.projectId}
                            onChange={(e) => handleProjectChange(e.target.value)}
                            className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-blue-500 outline-none font-black text-slate-700 bg-slate-50/50"
                            required
                        >
                            <option value="">-- Chọn hợp đồng --</option>
                            {projects
                                .filter(p => activeEntity === 'all' || (p.acting_entity_key || 'thanglong').toLowerCase() === activeEntity)
                                .map(p => (
                                    <option key={p.id} value={p.id}>{p.internal_code || p.code}</option>
                                ))
                            }
                        </select>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Chọn Đợt thanh toán <span className="text-rose-500">*</span></label>
                        <select 
                            value={form.paymentId}
                            onChange={(e) => handlePaymentChange(e.target.value)}
                            className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-blue-500 outline-none font-black text-blue-600 bg-slate-50/50"
                            required
                            disabled={!form.projectId}
                        >
                            <option value="">-- Chọn mã thanh toán --</option>
                            {availablePayments
                                .filter(p => {
                                    // Bắt buộc giữ lại item đang chọn trong trường hợp Edit
                                    if (isEditing && form.paymentId === p.id) return true;
                                    
                                    // Kiểm tra xem đã thanh toán đủ hay chưa tuỳ theo Tab đối ngoại / nội bộ
                                    const req = activeTab === 'external' ? Number(p.payment_request_amount || 0) : Number(p.internal_debt_actual || 0);
                                    const paid = activeTab === 'external' ? Number(p.external_income || 0) : Number(p.internal_paid || 0);
                                    const isFullyPaid = paid >= req && req > 0;
                                    
                                    // Nếu đã thu đủ thì ẩn đi khỏi danh sách
                                    return !isFullyPaid;
                                })
                                .map(p => (
                                    <option key={p.id} value={p.id} className="font-bold">
                                        {p.payment_code}
                                    </option>
                                ))
                            }
                        </select>
                    </div>

                    <div className="space-y-1.5">
                        <div className="flex justify-between items-center ml-1">
                            <label className={`text-[11px] font-black uppercase tracking-widest ${activeTab === 'external' ? 'text-orange-600' : 'text-indigo-600'}`}>Số tiền <span className="text-rose-500">*</span></label>
                            {activeTab === 'internal' && <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-black italic">Đã gợi ý theo tỷ lệ HĐ</span>}
                        </div>
                        <div className="relative">
                            <input 
                                type="text" 
                                value={formatNum(form.amount)}
                                onChange={(e) => {
                                    const clean = e.target.value.replace(/[^0-9]/g, '');
                                    setForm({...form, amount: clean});
                                }}
                                className={`w-full px-4 py-3 rounded-2xl border ${activeTab === 'external' ? 'border-orange-100 focus:border-orange-500' : 'border-indigo-100 focus:border-indigo-500'} outline-none font-black text-slate-800 pr-12 text-xl tabular-nums`}
                                placeholder="0"
                                required
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₫</span>
                        </div>
                        {contextInfo}
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">{activeTab === 'external' ? 'Ngày thu tiền' : 'Ngày chuyển tiền'} <span className="text-rose-500">*</span></label>
                        <input 
                            type="date" 
                            value={form.date}
                            onChange={(e) => setForm({...form, date: e.target.value})}
                            className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-blue-500 outline-none font-black text-slate-700 bg-slate-50/50"
                            required
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Ghi chú / Nội dung</label>
                        <textarea 
                            rows="1"
                            value={form.description}
                            onChange={(e) => setForm({...form, description: e.target.value})}
                            className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-blue-500 outline-none font-medium text-slate-600 resize-none text-sm"
                            placeholder="VD: Chuyển khoản qua ngân hàng Vietcombank..."
                        ></textarea>
                    </div>

                    <div className="pt-6 flex gap-3">
                        <button 
                            type="button"
                            onClick={() => setShowModal(false)}
                            className="flex-1 py-3.5 rounded-2xl border border-slate-200 font-bold text-slate-500 hover:bg-slate-50 transition-all active:scale-95"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit"
                            className={`flex-1 py-3.5 ${activeTab === 'external' ? 'bg-orange-500 hover:bg-orange-600 shadow-orange-100' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100'} text-white rounded-2xl font-black shadow-lg transition-all active:scale-95`}
                        >
                            {isEditing ? 'UPDATE' : 'SAVE DATA'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
