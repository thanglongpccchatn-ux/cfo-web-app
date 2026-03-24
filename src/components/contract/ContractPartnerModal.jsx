import React from 'react';
import { labelBase } from './contractHelpers';

export default function ContractPartnerModal({
    showPartnerModal, setShowPartnerModal,
    partnerForm, setPartnerForm,
    handleCreatePartner, isSaving
}) {
    if (!showPartnerModal) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="glass-panel bg-white w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-slide-up border-none">
                <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600">
                            <span className="material-symbols-outlined notranslate" translate="no">person_add</span>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-800">Thêm Pháp nhân Đối tác Mới</h3>
                            <p className="text-xs text-slate-500 mt-0.5">Thông vị dùng cho hợp đồng, hóa đơn và giao dịch ngân hàng</p>
                        </div>
                    </div>
                    <button onClick={() => setShowPartnerModal(false)} className="p-2 hover:bg-slate-200 rounded-xl transition-colors text-slate-500 hover:text-slate-800">
                        <span className="material-symbols-outlined notranslate" translate="no">close</span>
                    </button>
                </div>
                <form onSubmit={handleCreatePartner} className="p-8 overflow-y-auto space-y-8 bg-white">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2">
                            <label className={labelBase}>Tên pháp nhân (Đầy đủ) *</label>
                            <input type="text" required value={partnerForm.name} onChange={e => setPartnerForm({ ...partnerForm, name: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all" placeholder="VD: CÔNG TY TNHH ABC VIỆT NAM" />
                        </div>
                        <div>
                            <label className={labelBase}>Mã số thuế</label>
                            <input type="text" value={partnerForm.tax_code} onChange={e => setPartnerForm({ ...partnerForm, tax_code: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all" placeholder="VD: 0123456789" />
                        </div>
                        <div>
                            <label className={labelBase}>Loại đối tác</label>
                            <select value={partnerForm.partner_type} onChange={e => setPartnerForm({ ...partnerForm, partner_type: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none appearance-none transition-all">
                                <option>Chủ đầu tư</option><option>Tổng thầu</option><option>Đối tác chiến lược</option><option>Công ty con / Sateco</option>
                            </select>
                        </div>
                        <div className="md:col-span-2">
                            <label className={labelBase}>Địa chỉ đăng ký kinh doanh</label>
                            <input type="text" value={partnerForm.address} onChange={e => setPartnerForm({ ...partnerForm, address: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all" placeholder="Địa chỉ ghi trên Hợp đồng/Hóa đơn" />
                        </div>
                    </div>
                    <div className="pt-6 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className={labelBase}>Người đại diện pháp luật</label>
                            <input type="text" value={partnerForm.representative} onChange={e => setPartnerForm({ ...partnerForm, representative: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all" placeholder="VD: Ông Nguyễn Văn A" />
                        </div>
                        <div>
                            <label className={labelBase}>Chức vụ đại diện</label>
                            <input type="text" value={partnerForm.representative_title} onChange={e => setPartnerForm({ ...partnerForm, representative_title: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all" placeholder="VD: Tổng Giám Đốc" />
                        </div>
                        <div>
                            <label className={labelBase}>Số tài khoản ngân hàng</label>
                            <input type="text" value={partnerForm.bank_account} onChange={e => setPartnerForm({ ...partnerForm, bank_account: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all" placeholder="VD: 1903xxx..." />
                        </div>
                        <div>
                            <label className={labelBase}>Ngân hàng (Tên & CN)</label>
                            <input type="text" value={partnerForm.bank_name} onChange={e => setPartnerForm({ ...partnerForm, bank_name: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all" placeholder="VD: Techcombank - CN Hà Thành" />
                        </div>
                    </div>
                    <div className="pt-6 mt-4 border-t border-slate-100 flex justify-end gap-3">
                        <button type="button" onClick={() => setShowPartnerModal(false)} className="btn btn-glass bg-white text-slate-600 hover:bg-slate-50 border-slate-200">Hủy bỏ</button>
                        <button type="submit" disabled={isSaving} className="btn bg-orange-600 hover:bg-orange-700 text-white font-bold shadow-md shadow-orange-500/20">Lưu & Chọn đối tác</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
