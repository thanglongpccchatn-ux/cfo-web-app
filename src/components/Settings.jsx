import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { currentTheme, DEFAULT_THEME } from '../config/brand';

export default function Settings() {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    // Initialize with currentTheme so it doesn't flash empty values
    const [settings, setSettings] = useState({ id: '11111111-1111-1111-1111-111111111111', ...currentTheme });
    const [message, setMessage] = useState({ type: '', text: '' });

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        setLoading(true);
        const { data, error } = await supabase.from('theme_settings').select('*').limit(1).maybeSingle();
        if (data) {
            setSettings(data);
        }
        setLoading(false);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setSettings(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        setMessage({ type: '', text: '' });

        try {
            const { error } = await supabase.from('theme_settings').upsert({
                id: settings.id,
                company_name: settings.company_name,
                sub_name: settings.sub_name,
                logo_url: settings.logo_url,
                logo_icon: settings.logo_icon,
                primary_color: settings.primary_color,
                primary_hover_color: settings.primary_hover_color,
                sidebar_bg_light: settings.sidebar_bg_light,
                sidebar_bg_dark: settings.sidebar_bg_dark,
                app_bg_light: settings.app_bg_light,
                app_bg_dark: settings.app_bg_dark,
                font_family: settings.font_family,
                font_url: settings.font_url
            });

            if (error) throw error;
            
            setMessage({ type: 'success', text: 'Cập nhật thành công! Trình duyệt sẽ tải lại ngay bây giờ để áp dụng giao diện.' });
            
            setTimeout(() => {
                window.location.reload();
            }, 1200);

        } catch (error) {
            console.error('Lỗi lưu cấu hình:', error);
            setMessage({ type: 'error', text: 'Lỗi khi lưu cài đặt: ' + error.message });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="p-8 text-slate-500">Đang tải cài đặt...</div>;
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 md:p-8">
                <div className="mb-8 border-b border-slate-200 dark:border-slate-800 pb-5">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary notranslate">palette</span> 
                        Giao diện & Thương hiệu
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">
                        Tùy chỉnh Logo, tên công ty, màu sắc và phông chữ của hệ thống. Thay đổi sẽ áp dụng cho tất cả người dùng ngay khi Lưu.
                    </p>
                </div>

                {message.text && (
                    <div className={`p-4 rounded-xl mb-6 text-sm flex gap-3 items-start ${message.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
                        <span className="material-symbols-outlined notranslate mt-0.5">{message.type === 'error' ? 'error' : 'check_circle'}</span>
                        <p className="font-medium font-sans mt-0.5">{message.text}</p>
                    </div>
                )}

                <form onSubmit={handleSave} className="space-y-8">
                    {/* KHỐI 1: THÔNG TIN */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px]">business</span> Thông tin Công ty
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 px-1">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Tên công ty / Tiêu đề chính</label>
                                <input required type="text" name="company_name" value={settings.company_name || ''} onChange={handleChange} className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-primary/50 text-sm font-bold shadow-inner" placeholder="VD: Thăng Long" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Slogan / Cụm phụ đề</label>
                                <input type="text" name="sub_name" value={settings.sub_name || ''} onChange={handleChange} className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-primary/50 text-sm shadow-inner" placeholder="VD: Construction & Admin" />
                            </div>
                            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex justify-between">
                                        Đường dẫn Ảnh Logo 
                                        <span className="text-xs text-slate-400 font-normal">(Ưu tiên hiển thị nếu có)</span>
                                    </label>
                                    <input type="text" name="logo_url" value={settings.logo_url || ''} onChange={handleChange} className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-primary/50 text-sm shadow-inner" placeholder="https://..." />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex justify-between">
                                        Mã Icon Logo
                                        <a href="https://fonts.google.com/icons?icon.set=Material+Symbols" target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline">Xem bộ icon Google</a>
                                    </label>
                                    <input type="text" name="logo_icon" value={settings.logo_icon || ''} onChange={handleChange} className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-primary/50 text-sm font-mono shadow-inner" placeholder="VD: apartment, corporate_fare, token" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* KHỐI 2: MÀU SẮC */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px]">format_color_fill</span> Màu sắc Giao diện
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-5 px-1">
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Màu Chủ đạo (Nhấn)</label>
                                <div className="flex bg-slate-50 dark:bg-slate-800 rounded-xl overflow-hidden shadow-inner pr-2">
                                    <input type="color" name="primary_color" value={settings.primary_color || '#005faf'} onChange={handleChange} className="w-12 h-10 border-0 p-0 cursor-pointer appearance-none bg-transparent" />
                                    <input type="text" name="primary_color" value={settings.primary_color || '#005faf'} onChange={handleChange} className="w-full bg-transparent border-none text-xs font-mono py-2 pl-2 outline-none focus:ring-0 uppercase" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Màu lúc bấm nút</label>
                                <div className="flex bg-slate-50 dark:bg-slate-800 rounded-xl overflow-hidden shadow-inner pr-2">
                                    <input type="color" name="primary_hover_color" value={settings.primary_hover_color || '#004786'} onChange={handleChange} className="w-12 h-10 border-0 p-0 cursor-pointer appearance-none bg-transparent" />
                                    <input type="text" name="primary_hover_color" value={settings.primary_hover_color || '#004786'} onChange={handleChange} className="w-full bg-transparent border-none text-xs font-mono py-2 pl-2 outline-none focus:ring-0 uppercase" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Màu Menu Ban ngày</label>
                                <div className="flex bg-slate-50 dark:bg-slate-800 rounded-xl overflow-hidden shadow-inner pr-2">
                                    <input type="color" name="sidebar_bg_light" value={settings.sidebar_bg_light || '#ffffff'} onChange={handleChange} className="w-12 h-10 border-0 p-0 cursor-pointer appearance-none bg-transparent" />
                                    <input type="text" name="sidebar_bg_light" value={settings.sidebar_bg_light || '#ffffff'} onChange={handleChange} className="w-full bg-transparent border-none text-xs font-mono py-2 pl-2 outline-none focus:ring-0 uppercase" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Màu Nền Tổng thể</label>
                                <div className="flex bg-slate-50 dark:bg-slate-800 rounded-xl overflow-hidden shadow-inner pr-2">
                                    <input type="color" name="app_bg_light" value={settings.app_bg_light || '#f8fafc'} onChange={handleChange} className="w-12 h-10 border-0 p-0 cursor-pointer appearance-none bg-transparent" />
                                    <input type="text" name="app_bg_light" value={settings.app_bg_light || '#f8fafc'} onChange={handleChange} className="w-full bg-transparent border-none text-xs font-mono py-2 pl-2 outline-none focus:ring-0 uppercase" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* KHỐI 3: FONT CHỮ */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px]">match_case</span> Font Chữ Web
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 px-1">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Tên CSS Font Family</label>
                                <input type="text" name="font_family" value={settings.font_family || ''} onChange={handleChange} className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-primary/50 text-sm font-mono shadow-inner" placeholder="'Inter', sans-serif" />
                                <p className="text-[10px] text-slate-500 mt-2">Ví dụ: 'Roboto', 'Montserrat', 'Inter', 'Be Vietnam Pro'</p>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex justify-between">
                                    Link Nạp Font (CSS URL)
                                    <a href="https://fonts.google.com/" target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline">Google Fonts</a>
                                </label>
                                <input type="text" name="font_url" value={settings.font_url || ''} onChange={handleChange} className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-primary/50 text-sm shadow-inner" placeholder="https://fonts.googleapis.com/css2?..." />
                                <p className="text-[10px] text-slate-500 mt-2">Chỉ cần điền nếu bộ gốc của Windows không có font này.</p>
                            </div>
                        </div>
                    </div>

                    {/* NÚT LƯU */}
                    <div className="pt-6 border-t border-slate-200 dark:border-slate-800 flex justify-end">
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex items-center gap-2 bg-primary hover:bg-blue-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50"
                        >
                            {saving ? (
                                <span className="material-symbols-outlined animate-spin notranslate">progress_activity</span>
                            ) : (
                                <span className="material-symbols-outlined notranslate">save</span>
                            )}
                            Lưu Cài Đặt Giao Diện
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
