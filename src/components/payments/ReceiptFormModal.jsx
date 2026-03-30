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
                                    <option key={p.id} value={p.id}>{p.internal_code || p.code} - {p.name}</option>
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
                            {availablePayments.map(p => (
                                    <option key={p.id} value={p.id} className="font-bold">
                                        {p.payment_code} ({p.stage_name})
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
