import React from 'react';
import { formatInput } from './dtkHelpers';

export default function PaymentFormModal({
    showModal, setShowModal, isEditing,
    form, setForm,
    projects, activeEntity, entityLabel,
    STANDARD_STAGES,
    handleProjectChange, handleStageChange, handleNumChange, handleRequestDateChange, handleSubmit,
    duplicateWarning
}) {
    if (!showModal) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowModal(false)}></div>
            <div className="bg-white w-full max-w-4xl rounded-[32px] shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                {/* Modal Header */}
                <div className="bg-slate-50 px-8 py-6 border-b border-slate-100 flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-black text-slate-800">{isEditing ? 'Chỉnh sửa Hồ sơ Thanh toán' : 'Tạo Hồ sơ Thanh toán mới'}</h3>
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Thông tin đề nghị và xuất hóa đơn</p>
                    </div>
                    <button onClick={() => setShowModal(false)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-200 transition-colors text-slate-400">
                        <span className="material-symbols-outlined notranslate" translate="no">close</span>
                    </button>
                </div>

                {/* Modal Body */}
                <form onSubmit={handleSubmit} className="p-8 overflow-y-auto flex-1 border-b border-slate-100">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Left Column: Project & Code */}
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Chọn Dự án / Hợp đồng <span className="text-rose-500">*</span></label>
                                <select 
                                    value={form.projectId}
                                    onChange={(e) => handleProjectChange(e.target.value)}
                                    className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition-all font-bold text-slate-700"
                                    required
                                    disabled={isEditing}
                                >
                                    <option value="">-- Chọn dự án --</option>
                                    {projects
                                        .filter(p => activeEntity === 'all' || activeEntity === 'sateco' || (p.acting_entity_key || 'thanglong').toLowerCase() === activeEntity)
                                        .map(p => (
                                            <option key={p.id} value={p.id}>{p.internal_code || p.code}</option>
                                        ))
                                    }
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Mã thanh toán {entityLabel} <span className="text-emerald-500 italic opacity-80">(Tự động)</span></label>
                                <input 
                                    type="text" 
                                    value={form.paymentCode}
                                    onChange={(e) => setForm({...form, paymentCode: e.target.value})}
                                    className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 font-black text-blue-600 outline-none focus:border-blue-500"
                                    placeholder="VD: DA-001-IPC01"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Đợt thanh toán <span className="text-emerald-500 italic opacity-80">(Ghi thay đổi được)</span></label>
                                <input 
                                    type="text" 
                                    list="stage-suggestions"
                                    value={form.stageName}
                                    onChange={(e) => handleStageChange(e.target.value)}
                                    className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition-all font-bold text-slate-700 bg-white"
                                    placeholder="Nhập hoặc chọn đợt..."
                                />
                                <datalist id="stage-suggestions">
                                    {STANDARD_STAGES.map(st => (
                                        <option key={st} value={st} />
                                    ))}
                                </datalist>
                            </div>

                            {duplicateWarning && (
                                <div className="bg-rose-50 text-rose-600 px-4 py-2 rounded-xl text-[11px] font-bold animate-in slide-in-from-top-1 duration-200 border border-rose-100 flex items-center gap-2">
                                    <span className="material-symbols-outlined notranslate text-[16px]" translate="no">warning</span>
                                    {duplicateWarning}
                                </div>
                            )}
                        </div>

                        {/* Right Column: Status & Amounts */}
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Giá trị HĐ xuất (₫)</label>
                                    <input 
                                        type="text" 
                                        value={formatInput(form.invoiceAmount)}
                                        onChange={(e) => handleNumChange('invoiceAmount', e.target.value)}
                                        className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition-all font-black text-slate-800 text-right pr-6"
                                        placeholder="0"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Giá trị ĐNTT (₫)</label>
                                    <input 
                                        type="text" 
                                        value={formatInput(form.requestAmount)}
                                        onChange={(e) => handleNumChange('requestAmount', e.target.value)}
                                        className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition-all font-black text-slate-800 text-right pr-6"
                                        placeholder="0"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Trạng thái Hóa đơn</label>
                                <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
                                    {['Chưa xuất', 'Đã xuất'].map(status => (
                                        <button
                                            key={status}
                                            type="button"
                                            onClick={() => setForm({...form, invoiceStatus: status })}
                                            className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all ${
                                                form.invoiceStatus === status 
                                                ? (status === 'Đã xuất' ? 'bg-white text-emerald-600 shadow-sm ring-1 ring-slate-200' : 'bg-white text-rose-600 shadow-sm ring-1 ring-slate-200')
                                                : 'text-slate-400 hover:text-slate-600'
                                            }`}
                                        >
                                            {status}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Ngày đề nghị / Xuất HĐ</label>
                                    <input 
                                        type="date" 
                                        value={form.requestDate}
                                        onChange={(e) => handleRequestDateChange(e.target.value)}
                                        className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition-all font-bold text-slate-700"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1 text-amber-700">Ngày trả dự kiến</label>
                                    <input 
                                        type="date" 
                                        value={form.dueDate}
                                        onChange={(e) => setForm({...form, dueDate: e.target.value})}
                                        className="w-full px-4 py-3 rounded-2xl border border-amber-200 bg-amber-50 text-amber-900 font-bold focus:border-amber-500 outline-none"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 space-y-2">
                        <label className="text-[11px] font-black text-emerald-600 uppercase tracking-widest ml-1 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">account_balance</span>
                            Cấu hình VAT Nội bộ Sateco
                        </label>
                        <div className="flex items-center gap-3 bg-emerald-50 p-3 rounded-2xl border border-emerald-100">
                            <input 
                                type="number" step="1" min="0" max="100"
                                value={form.internalVat}
                                onChange={(e) => setForm({...form, internalVat: e.target.value})}
                                className="w-24 px-4 py-2.5 rounded-xl border border-emerald-200 focus:border-emerald-500 font-black text-emerald-700 outline-none text-center"
                                placeholder="8"
                            />
                            <span className="text-[11px] font-bold text-emerald-700">% <span className="text-emerald-600/70 font-medium ml-1">(Mặc định 8%. Dùng tính HĐ Trước VAT)</span></span>
                        </div>
                    </div>

                    <div className="mt-6 space-y-2">
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Ghi chú bổ sung</label>
                        <textarea 
                            rows="1"
                            value={form.notes}
                            onChange={(e) => setForm({...form, notes: e.target.value})}
                            className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition-all font-medium text-slate-700 resize-none"
                            placeholder="Nhập thông tin bổ sung nếu có..."
                        ></textarea>
                    </div>

                    <div className="mt-10 flex items-center justify-end gap-3">
                        <button 
                            type="button"
                            onClick={() => setShowModal(false)}
                            className="px-6 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-colors"
                        >
                            Hủy bỏ
                        </button>
                        <button 
                            type="submit"
                            className="px-10 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black shadow-lg shadow-emerald-100 transition-all active:scale-95 flex items-center gap-2"
                        >
                            <span className="material-symbols-outlined notranslate text-[20px]" translate="no">save</span>
                            {isEditing ? 'CẬP NHẬT' : 'LƯU HỒ SƠ'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
