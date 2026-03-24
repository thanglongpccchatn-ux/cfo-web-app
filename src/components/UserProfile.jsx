import React, { useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export default function UserProfile() {
    const { user, profile, refreshProfile } = useAuth();
    const [isUploading, setIsUploading] = useState(false);
    const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [passwordMsg, setPasswordMsg] = useState({ type: '', text: '' });
    const [avatarMsg, setAvatarMsg] = useState({ type: '', text: '' });
    const fileInputRef = useRef(null);

    // ── Avatar Upload ──
    const handleAvatarUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Validate
        if (!file.type.startsWith('image/')) {
            setAvatarMsg({ type: 'error', text: 'Vui lòng chọn file ảnh (JPG, PNG, WEBP).' });
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            setAvatarMsg({ type: 'error', text: 'Ảnh quá lớn. Tối đa 2MB.' });
            return;
        }

        setIsUploading(true);
        setAvatarMsg({ type: '', text: '' });

        try {
            const fileExt = file.name.split('.').pop();
            const filePath = `avatars/${user.id}.${fileExt}`;

            // Upload to Supabase Storage
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file, { upsert: true });

            if (uploadError) throw uploadError;

            // Get public URL
            const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
            const publicUrl = urlData.publicUrl + '?t=' + Date.now(); // Cache bust

            // Update profile
            const { error: updateError } = await supabase
                .from('profiles')
                .update({ avatar_url: publicUrl })
                .eq('id', user.id);

            if (updateError) throw updateError;

            // Refresh the global profile state
            if (refreshProfile) await refreshProfile();
            setAvatarMsg({ type: 'success', text: 'Cập nhật ảnh đại diện thành công!' });
        } catch (err) {
            console.error('Avatar upload error:', err);
            setAvatarMsg({ type: 'error', text: 'Lỗi tải ảnh: ' + (err.message || 'Không xác định') });
        } finally {
            setIsUploading(false);
        }
    };

    // ── Password Change ──
    const handleChangePassword = async (e) => {
        e.preventDefault();
        setPasswordMsg({ type: '', text: '' });

        if (passwordForm.new.length < 6) {
            setPasswordMsg({ type: 'error', text: 'Mật khẩu mới phải có ít nhất 6 ký tự.' });
            return;
        }
        if (passwordForm.new !== passwordForm.confirm) {
            setPasswordMsg({ type: 'error', text: 'Mật khẩu xác nhận không khớp.' });
            return;
        }

        setIsChangingPassword(true);
        try {
            const { error } = await supabase.auth.updateUser({
                password: passwordForm.new
            });

            if (error) throw error;

            setPasswordForm({ current: '', new: '', confirm: '' });
            setPasswordMsg({ type: 'success', text: 'Đổi mật khẩu thành công! Mật khẩu mới sẽ có hiệu lực ngay.' });
        } catch (err) {
            setPasswordMsg({ type: 'error', text: 'Lỗi: ' + (err.message || 'Không thể đổi mật khẩu.') });
        } finally {
            setIsChangingPassword(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto py-8 px-4 md:px-0 space-y-8 animate-in fade-in duration-500">
            {/* Page Title */}
            <div>
                <h2 className="text-2xl font-extrabold text-slate-800 dark:text-white tracking-tight">Trang cá nhân</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Quản lý thông tin cá nhân, ảnh đại diện và mật khẩu của bạn.</p>
            </div>

            {/* ── Profile Card ── */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                {/* Banner */}
                <div className="h-28 bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 relative">
                    <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgdmlld0JveD0iMCAwIDYwIDYwIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iLjA1Ij48cGF0aCBkPSJNMzYgMzBjMC0zLjMxMy0yLjY4Ny02LTYtNnMtNiAyLjY4Ny02IDYgMi42ODcgNiA2IDYgNi0yLjY4NyA2LTZ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-50"></div>
                </div>

                {/* Avatar & Info */}
                <div className="px-6 pb-6 -mt-14 relative z-10">
                    <div className="flex flex-col sm:flex-row items-start sm:items-end gap-5">
                        {/* Avatar */}
                        <div className="relative group">
                            <div className="w-24 h-24 rounded-2xl border-4 border-white dark:border-slate-800 shadow-xl bg-slate-200 dark:bg-slate-700 overflow-hidden">
                                {profile?.avatar_url ? (
                                    <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-400 to-indigo-500 text-white">
                                        <span className="material-symbols-outlined notranslate text-[48px]" translate="no">person</span>
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isUploading}
                                className="absolute -bottom-1 -right-1 w-8 h-8 bg-white dark:bg-slate-700 rounded-xl border-2 border-white dark:border-slate-800 shadow-lg flex items-center justify-center text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-600 transition-all active:scale-90 cursor-pointer"
                                title="Đổi ảnh đại diện"
                            >
                                {isUploading ? (
                                    <span className="material-symbols-outlined notranslate animate-spin text-[16px]" translate="no">progress_activity</span>
                                ) : (
                                    <span className="material-symbols-outlined notranslate text-[16px]" translate="no">photo_camera</span>
                                )}
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleAvatarUpload}
                            />
                        </div>

                        {/* Name & Role */}
                        <div className="flex-1 pt-2 sm:pt-0">
                            <h3 className="text-xl font-extrabold text-slate-800 dark:text-white tracking-tight">
                                {profile?.full_name || 'Chưa đặt tên'}
                            </h3>
                            <div className="flex items-center gap-2 mt-1.5">
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800">
                                    <span className="material-symbols-outlined notranslate text-[12px]" translate="no">verified_user</span>
                                    {profile?.roles?.name || profile?.role_code || 'N/A'}
                                </span>
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                    {profile?.status || 'Hoạt động'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Avatar upload message */}
                    {avatarMsg.text && (
                        <div className={`mt-4 px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 ${avatarMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400'}`}>
                            <span className="material-symbols-outlined notranslate text-[18px]" translate="no">{avatarMsg.type === 'success' ? 'check_circle' : 'error'}</span>
                            {avatarMsg.text}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Account Info ── */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
                    <h4 className="font-bold text-sm text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        <span className="material-symbols-outlined notranslate text-blue-500 text-[18px]" translate="no">badge</span>
                        Thông tin tài khoản
                    </h4>
                </div>
                <div className="p-6 divide-y divide-slate-100 dark:divide-slate-700/50">
                    <div className="flex items-center justify-between py-3 first:pt-0">
                        <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">Họ và tên</span>
                        <span className="text-sm font-bold text-slate-800 dark:text-white">{profile?.full_name || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between py-3">
                        <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">Email</span>
                        <span className="text-sm font-bold text-slate-800 dark:text-white">{profile?.email || user?.email || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between py-3">
                        <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">Vai trò</span>
                        <span className="text-sm font-bold text-blue-600 dark:text-blue-400">{profile?.roles?.name || profile?.role_code || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between py-3">
                        <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">Trạng thái</span>
                        <span className={`text-sm font-bold ${profile?.status === 'Khóa' ? 'text-rose-600' : 'text-emerald-600'}`}>{profile?.status || 'Hoạt động'}</span>
                    </div>
                    <div className="flex items-center justify-between py-3 last:pb-0">
                        <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">Mã vai trò</span>
                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{profile?.role_code || '—'}</span>
                    </div>
                </div>
            </div>

            {/* ── Change Password ── */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
                    <h4 className="font-bold text-sm text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        <span className="material-symbols-outlined notranslate text-amber-500 text-[18px]" translate="no">lock</span>
                        Đổi mật khẩu
                    </h4>
                </div>
                <form onSubmit={handleChangePassword} className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Mật khẩu mới</label>
                        <input
                            type="password"
                            required
                            minLength={6}
                            value={passwordForm.new}
                            onChange={(e) => setPasswordForm({ ...passwordForm, new: e.target.value })}
                            placeholder="Nhập mật khẩu mới (ít nhất 6 ký tự)"
                            className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-700/50 text-sm text-slate-800 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Xác nhận mật khẩu mới</label>
                        <input
                            type="password"
                            required
                            minLength={6}
                            value={passwordForm.confirm}
                            onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                            placeholder="Nhập lại mật khẩu mới"
                            className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-700/50 text-sm text-slate-800 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all"
                        />
                    </div>

                    {passwordMsg.text && (
                        <div className={`px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 ${passwordMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400'}`}>
                            <span className="material-symbols-outlined notranslate text-[18px]" translate="no">{passwordMsg.type === 'success' ? 'check_circle' : 'error'}</span>
                            {passwordMsg.text}
                        </div>
                    )}

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={isChangingPassword}
                            className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl shadow-lg shadow-amber-500/20 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-60"
                        >
                            {isChangingPassword ? (
                                <span className="material-symbols-outlined notranslate animate-spin text-[18px]" translate="no">progress_activity</span>
                            ) : (
                                <span className="material-symbols-outlined notranslate text-[18px]" translate="no">key</span>
                            )}
                            Đổi mật khẩu
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
