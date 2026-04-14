import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { smartToast } from '../utils/globalToast';

const EMPTY_PARTNER = {
    code: '', name: '', short_name: '', tax_code: '',
    phone: '', email: '', address: '',
    representative: '', representative_title: '',
    bank_name: '', bank_account: '', bank_branch: '', account_holder: '',
    notes: ''
};

export default function PartnerModal({ isOpen, onClose, onSuccess, activeTab = 'Subcontractor' }) {
    const [newPartner, setNewPartner] = useState(EMPTY_PARTNER);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setNewPartner(EMPTY_PARTNER);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const getTableName = (tab) => {
        if (tab === 'Supplier') return 'suppliers';
        if (tab === 'Subcontractor') return 'subcontractors';
        return 'partners'; // Client
    };

    const getTabLabel = (type) => {
        switch (type) {
            case 'Client': return 'Chủ Đầu Tư';
            case 'Supplier': return 'Nhà Cung Cấp';
            case 'Subcontractor': return 'Tổ Đội / Thầu Phụ';
            default: return type;
        }
    };

    const handleSavePartner = async (e) => {
        e.preventDefault();
        if (!newPartner.name) {
            smartToast('Vui lòng nhập Tên đối tác');
            return;
        }

        setIsSubmitting(true);
        try {
            const table = getTableName(activeTab);
            const payload = { ...newPartner };

            if (!payload.code && payload.short_name) {
                payload.code = payload.short_name;
            }

            // Clean up and map columns based on target table
            if (table !== 'partners') {
                payload.contact_person = payload.representative;
                delete payload.representative;
                delete payload.representative_title;
                delete payload.type; 
            } else {
                payload.type = activeTab;
            }

            const { data, error } = await supabase.from(table).insert([payload]).select().single();
            if (error) throw error;

            onSuccess?.(data);
            onClose();
        } catch (error) {
            console.error(`Error saving ${activeTab}:`, error);
            smartToast('Đã xảy ra lỗi khi lưu: ' + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const inp = "w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition";

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-fade-in max-h-[90vh] flex flex-col">
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between shrink-0">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                        Thêm {getTabLabel(activeTab)} Mới
                    </h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    >
                        <span className="material-symbols-outlined notranslate" translate="no">close</span>
                    </button>
                </div>
                <form onSubmit={handleSavePartner} className="p-6 overflow-y-auto space-y-4 custom-scrollbar">
                    {/* --- THÔNG TIN CƠ BẢN --- */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Mã NCC</label>
                            <input type="text" value={newPartner.code}
                                onChange={e => setNewPartner({ ...newPartner, code: e.target.value })}
                                className={inp} placeholder="VD: KH001, NCC001" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tên viết tắt</label>
                            <input type="text" value={newPartner.short_name}
                                onChange={e => setNewPartner({ ...newPartner, short_name: e.target.value })}
                                className={inp} placeholder="VD: HOANG VINH" />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tên nhà cung cấp <span className="text-red-500">*</span></label>
                            <input type="text" value={newPartner.name}
                                onChange={e => setNewPartner({ ...newPartner, name: e.target.value })}
                                required className={inp} placeholder="Tên đầy đủ công ty hoặc cá nhân" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Mã số thuế</label>
                            <input type="text" value={newPartner.tax_code}
                                onChange={e => setNewPartner({ ...newPartner, tax_code: e.target.value })}
                                className={inp} placeholder="VD: 0107020866" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Điện thoại</label>
                            <input type="tel" value={newPartner.phone}
                                onChange={e => setNewPartner({ ...newPartner, phone: e.target.value })}
                                className={inp} placeholder="VD: 0915 503 570" />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
                            <input type="email" value={newPartner.email}
                                onChange={e => setNewPartner({ ...newPartner, email: e.target.value })}
                                className={inp} placeholder="VD: contact@company.com" />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Địa chỉ</label>
                            <input type="text" value={newPartner.address}
                                onChange={e => setNewPartner({ ...newPartner, address: e.target.value })}
                                className={inp} placeholder="Địa chỉ công ty hoặc văn phòng" />
                        </div>
                    </div>

                    {/* --- NGƯỜI ĐẠI DIỆN --- */}
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
                        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">Người đại diện</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Họ và tên</label>
                                <input type="text" value={newPartner.representative}
                                    onChange={e => setNewPartner({ ...newPartner, representative: e.target.value })}
                                    className={inp} placeholder="VD: Nguyễn Văn A" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Chức vụ</label>
                                <input type="text" value={newPartner.representative_title}
                                    onChange={e => setNewPartner({ ...newPartner, representative_title: e.target.value })}
                                    className={inp} placeholder="VD: Tổng giám đốc, Giám đốc" />
                            </div>
                        </div>
                    </div>

                    {/* --- TÀI KHOẢN NGÂN HÀNG --- */}
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
                        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">Tài khoản Ngân hàng</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tên Ngân hàng</label>
                                <input type="text" value={newPartner.bank_name}
                                    onChange={e => setNewPartner({ ...newPartner, bank_name: e.target.value })}
                                    className={inp} placeholder="VD: Vietcombank, Techcombank" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Số tài khoản</label>
                                <input type="text" value={newPartner.bank_account}
                                    onChange={e => setNewPartner({ ...newPartner, bank_account: e.target.value })}
                                    className={inp} placeholder="VD: 1012345678" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Chi nhánh NH</label>
                                <input type="text" value={newPartner.bank_branch}
                                    onChange={e => setNewPartner({ ...newPartner, bank_branch: e.target.value })}
                                    className={inp} placeholder="VD: Chi nhánh Hà Nội, CN Đống Đa" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tên Chủ tài khoản</label>
                                <input type="text" value={newPartner.account_holder}
                                    onChange={e => setNewPartner({ ...newPartner, account_holder: e.target.value })}
                                    className={inp} placeholder="VD: NGUYEN VAN A" />
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3 mt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                        >
                            Hủy
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-6 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-hover active:scale-95 transition-all shadow-sm disabled:opacity-50 flex items-center gap-2"
                        >
                            {isSubmitting && <span className="material-symbols-outlined notranslate animate-spin text-[18px]" translate="no">progress_activity</span>}
                            Lưu NCC
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
