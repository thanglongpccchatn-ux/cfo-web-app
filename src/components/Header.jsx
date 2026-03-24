import React from 'react';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';

export default function Header({ title, subtitle, onAction, isSidebarOpen, setIsSidebarOpen, setActiveTab }) {
    const { profile, logout } = useAuth();
    return (
        <header className="h-16 bg-white dark:bg-[#1a2634] flex items-center justify-between px-3 md:px-8 z-10 shadow-sm flex-shrink-0 relative">
            <div className="flex items-center gap-2 md:gap-3">
                {/* Mobile Hamburger Menu */}
                <button 
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                  className="md:hidden p-1.5 -ml-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                >
                    <span className="material-symbols-outlined notranslate" translate="no">menu</span>
                </button>
                <div>
                    <h2 className="text-base md:text-lg font-bold text-slate-900 dark:text-white truncate max-w-[150px] sm:max-w-none">{title}</h2>
                    <p className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-[150px] sm:max-w-none">{subtitle}</p>
                </div>
            </div>

            <div className="flex items-center gap-1.5 md:gap-4">
                <div className="relative hidden md:block">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 material-symbols-outlined notranslate text-[18px]" translate="no">search</span>
                    <input
                        type="text"
                        placeholder="Tìm kiếm hợp đồng..."
                        className="pl-10 pr-4 py-2 w-64 bg-slate-50 dark:bg-slate-800 border-none rounded-full text-sm focus:ring-2 focus:ring-primary/50 text-slate-700 dark:text-white placeholder-slate-400 transition-all"
                    />
                </div>

                <NotificationBell />

                {onAction && (
                    <button
                        onClick={onAction}
                        className="flex items-center gap-1.5 md:gap-2 px-2.5 md:px-4 py-1.5 md:py-2 bg-primary hover:bg-blue-600 text-white rounded-full text-xs md:text-sm font-semibold shadow-md shadow-blue-500/20 transition-all"
                    >
                        <span className="material-symbols-outlined notranslate text-[16px] md:text-[18px]" translate="no">add</span>
                        <span className="hidden sm:inline">Tạo hợp đồng</span>
                        <span className="sm:hidden">Tạo Mới</span>
                    </button>
                )}

                <div className="flex items-center gap-2 md:gap-3 pl-2 md:pl-4 border-l border-slate-200 dark:border-slate-700">
                    <button onClick={() => setActiveTab && setActiveTab('profile')} className="flex items-center gap-2 md:gap-3 hover:opacity-80 transition-opacity cursor-pointer" title="Trang cá nhân">
                        <div className="text-right hidden md:block">
                            <div className="text-sm font-bold text-slate-800 dark:text-white leading-tight">
                                {profile?.full_name || 'Admin'}
                            </div>
                            <div className="text-[10px] uppercase font-black tracking-widest text-slate-500 dark:text-slate-400">
                                {profile?.roles?.name || profile?.role_code || 'GUEST'}
                            </div>
                        </div>
                        <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-slate-200 dark:bg-slate-700 border-2 border-white dark:border-slate-800 shadow-sm flex items-center justify-center text-slate-500 overflow-hidden">
                            {profile?.avatar_url ? (
                                <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                                <span className="material-symbols-outlined notranslate text-[18px] md:text-[24px]" translate="no">person</span>
                            )}
                        </div>
                    </button>
                    <button 
                        onClick={logout}
                        title="Đăng xuất"
                        className="hidden md:flex w-9 h-9 items-center justify-center rounded-full hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors ml-1"
                    >
                        <span className="material-symbols-outlined notranslate text-[20px]" translate="no">logout</span>
                    </button>
                </div>
            </div>
        </header>
    );
}
