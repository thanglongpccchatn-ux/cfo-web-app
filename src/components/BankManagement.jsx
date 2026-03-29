import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { smartToast } from '../utils/globalToast';

const EMPTY_PROFILE = {
    label: '',
    tl_account_number: '',
    tl_bank_name: '',
    tl_branch: '',
    tl_holder: 'CÔNG TY TNHH THĂNG LONG',
    st_account_number: '',
    st_bank_name: '',
    st_branch: '',
    st_holder: 'CÔNG TY CP SATECO'
};

export default function BankManagement() {
    const [profiles, setProfiles] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [newProfile, setNewProfile] = useState(EMPTY_PROFILE);

    const fetchProfiles = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('company_bank_profiles')
                .select('*')
                .order('label');
            if (error) throw error;
            setProfiles(data || []);
        } catch (error) {
            console.error('Error fetching bank profiles:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchProfiles();
    }, []);

    const handleSave = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            if (editingId) {
                const { error } = await supabase
                    .from('company_bank_profiles')
                    .update(newProfile)
                    .eq('id', editingId);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('company_bank_profiles')
                    .insert([newProfile]);
                if (error) throw error;
            }
            setIsModalOpen(false);
            setEditingId(null);
            setNewProfile(EMPTY_PROFILE);
            fetchProfiles();
        } catch (error) {
            console.error('Error saving bank profile:', error);
            smartToast('Lỗi: ' + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEdit = (profile) => {
        setNewProfile({ ...profile });
        setEditingId(profile.id);
        setIsModalOpen(true);
    };

    const handleDelete = async (id, label) => {
        if (window.confirm(`Xóa cấu hình ngân hàng "${label}"?`)) {
            try {
                const { error } = await supabase
                    .from('company_bank_profiles')
                    .delete()
                    .eq('id', id);
                if (error) throw error;
                fetchProfiles();
            } catch (error) {
                console.error('Error deleting profile:', error);
                smartToast('Lỗi: ' + error.message);
            }
        }
    };

    const inp = "w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all";

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
                        <span className="material-symbols-outlined notranslate text-3xl text-teal-600" translate="no">account_balance</span>
                        Cấu hình Ngân hàng Công ty
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 pl-11">
                        Quản lý các cặp tài khoản ngân hàng của Thăng Long và Sateco để chọn nhanh khi tạo hợp đồng.
                    </p>
                </div>
                <button
                    onClick={() => {
                        setEditingId(null);
                        setNewProfile(EMPTY_PROFILE);
                        setIsModalOpen(true);
                    }}
                    className="h-11 flex items-center gap-2 px-6 bg-teal-600 text-white text-sm font-bold rounded-2xl hover:bg-teal-700 active:scale-95 transition-all shadow-lg shadow-teal-500/20"
                >
                    <span className="material-symbols-outlined notranslate text-[20px]" translate="no">add</span>
                    Thêm cấu hình mới
                </button>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {isLoading ? (
                    <div className="p-12 text-center text-slate-500 bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col items-center gap-4">
                        <span className="material-symbols-outlined notranslate animate-spin text-4xl text-teal-500" translate="no">progress_activity</span>
                        <p className="font-medium">Đang tải cấu hình...</p>
                    </div>
                ) : profiles.length === 0 ? (
                    <div className="p-12 text-center text-slate-500 bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col items-center gap-4">
                        <span className="material-symbols-outlined notranslate text-5xl text-slate-300" translate="no">account_balance_wallet</span>
                        <p className="font-medium text-slate-400">Chưa có cấu hình ngân hàng nào.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {profiles.map(profile => (
                            <div key={profile.id} className="group relative bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-[32px] p-6 shadow-sm hover:shadow-xl hover:border-teal-500/30 transition-all duration-300">
                                <div className="flex items-start justify-between mb-6">
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 rounded-2xl bg-teal-50 dark:bg-teal-500/10 border border-teal-100 dark:border-teal-500/20 flex items-center justify-center text-teal-600 animate-pulse-subtle">
                                            <span className="material-symbols-outlined notranslate text-3xl" translate="no">account_balance</span>
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">{profile.label}</h3>
                                            <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest mt-1">Hệ thống đồng bộ</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => handleEdit(profile)} className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-700 text-slate-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-500/20 transition-all flex items-center justify-center">
                                            <span className="material-symbols-outlined notranslate text-[20px]" translate="no">edit</span>
                                        </button>
                                        <button onClick={() => handleDelete(profile.id, profile.label)} className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-700 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/20 transition-all flex items-center justify-center">
                                            <span className="material-symbols-outlined notranslate text-[20px]" translate="no">delete</span>
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700/50">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-2">Thăng Long</p>
                                        <div className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{profile.tl_bank_name}</div>
                                        <div className="text-xs font-mono text-teal-600 dark:text-teal-400 mt-1">{profile.tl_account_number}</div>
                                        <div className="text-[10px] text-slate-500 mt-2 truncate font-medium">{profile.tl_branch}</div>
                                    </div>
                                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700/50">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-2">Sateco</p>
                                        <div className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{profile.st_bank_name}</div>
                                        <div className="text-xs font-mono text-teal-600 dark:text-teal-400 mt-1">{profile.st_account_number}</div>
                                        <div className="text-[10px] text-slate-500 mt-2 truncate font-medium">{profile.st_branch}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in shadow-2xl">
                    <div className="bg-white dark:bg-slate-800 rounded-[40px] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col border border-white/20">
                        <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                            <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                                {editingId ? 'Cập nhật cấu hình' : 'Thêm cấu hình ngân hàng'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-all active:scale-90">
                                <span className="material-symbols-outlined notranslate" translate="no">close</span>
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-8 overflow-y-auto max-h-[75vh] space-y-8 scroll-smooth">
                             <div>
                                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">Tên gợi nhớ (VD: MSB, Techcombank...)</label>
                                <input type="text" value={newProfile.label} onChange={e => setNewProfile({ ...newProfile, label: e.target.value })} required className={inp} placeholder="MSB, TCB, VCB..." />
                             </div>

                             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* TL Column */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="w-2 h-6 bg-teal-500 rounded-full"></div>
                                        <h4 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight">Thăng Long (Nhận)</h4>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Tên Ngân hàng</label>
                                        <input type="text" value={newProfile.tl_bank_name} onChange={e => setNewProfile({ ...newProfile, tl_bank_name: e.target.value })} className={inp} />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Số tài khoản</label>
                                        <input type="text" value={newProfile.tl_account_number} onChange={e => setNewProfile({ ...newProfile, tl_account_number: e.target.value })} className={inp} />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Chi nhánh</label>
                                        <input type="text" value={newProfile.tl_branch} onChange={e => setNewProfile({ ...newProfile, tl_branch: e.target.value })} className={inp} />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Chủ tài khoản</label>
                                        <input type="text" value={newProfile.tl_holder} onChange={e => setNewProfile({ ...newProfile, tl_holder: e.target.value })} className={inp} />
                                    </div>
                                </div>

                                {/* ST Column */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 mb-2 text-indigo-600">
                                        <div className="w-2 h-6 bg-indigo-500 rounded-full"></div>
                                        <h4 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight">Sateco (Trả)</h4>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Tên Ngân hàng</label>
                                        <input type="text" value={newProfile.st_bank_name} onChange={e => setNewProfile({ ...newProfile, st_bank_name: e.target.value })} className={inp} />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Số tài khoản</label>
                                        <input type="text" value={newProfile.st_account_number} onChange={e => setNewProfile({ ...newProfile, st_account_number: e.target.value })} className={inp} />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Chi nhánh</label>
                                        <input type="text" value={newProfile.st_branch} onChange={e => setNewProfile({ ...newProfile, st_branch: e.target.value })} className={inp} />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Chủ tài khoản</label>
                                        <input type="text" value={newProfile.st_holder} onChange={e => setNewProfile({ ...newProfile, st_holder: e.target.value })} className={inp} />
                                    </div>
                                </div>
                             </div>

                             <div className="pt-8 flex justify-end gap-4 border-t border-slate-100 dark:border-slate-700">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 text-sm font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700/50 rounded-2xl hover:bg-slate-200 transition-all active:scale-95">Hủy</button>
                                <button type="submit" disabled={isSubmitting} className="px-10 py-3 text-sm font-black text-white bg-teal-600 rounded-2xl hover:bg-teal-700 active:scale-95 transition-all shadow-xl shadow-teal-500/20 disabled:opacity-50 flex items-center gap-3">
                                    {isSubmitting && <span className="material-symbols-outlined notranslate animate-spin text-[20px]" translate="no">progress_activity</span>}
                                    Lưu cấu hình
                                </button>
                             </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
