import React, { useState, useRef, useEffect } from 'react';
import { useNotification } from '../context/NotificationContext';

const timeAgo = (dateStr) => {
    if (!dateStr) return '';
    const seconds = Math.floor((new Date() - new Date(dateStr)) / 1000);
    let interval = Math.floor(seconds / 31536000);
    if (interval >= 1) return interval + " năm trước";
    interval = Math.floor(seconds / 2592000);
    if (interval >= 1) return interval + " tháng trước";
    interval = Math.floor(seconds / 86400);
    if (interval >= 1) return interval + " ngày trước";
    interval = Math.floor(seconds / 3600);
    if (interval >= 1) return interval + " giờ trước";
    interval = Math.floor(seconds / 60);
    if (interval >= 1) return interval + " phút trước";
    return "Vừa xong";
};

export default function NotificationBell() {
    const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotification();
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('UNREAD'); // ALL or UNREAD
    const dropdownRef = useRef(null);

    // Close when clicking outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredNotifs = notifications.filter(n => activeTab === 'ALL' || !n.is_read);

    const getIconInfo = (type) => {
        switch(type) {
            case 'SUCCESS': return { icon: 'check_circle', color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20' };
            case 'WARNING': return { icon: 'warning', color: 'text-amber-500 bg-amber-50 dark:bg-amber-500/10 border-amber-100 dark:border-amber-500/20' };
            case 'APPROVAL': return { icon: 'gavel', color: 'text-rose-500 bg-rose-50 dark:bg-rose-500/10 border-rose-100 dark:border-rose-500/20' };
            case 'INFO':
            default: return { icon: 'info', color: 'text-blue-500 bg-blue-50 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/20' };
        }
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className={`relative w-8 h-8 rounded-full flex items-center justify-center transition-colors focus:outline-none ${isOpen ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400' : 'bg-slate-100 hover:bg-slate-200 text-slate-500 dark:text-slate-400 dark:bg-slate-800 dark:hover:bg-slate-700'}`}
            >
                <span className="material-symbols-outlined notranslate text-[20px]" translate="no">notifications</span>
                {unreadCount > 0 && (
                    <span className="absolute -top-1.5 -right-1 flex h-[18px] min-w-[18px] px-1 items-center justify-center rounded-full bg-rose-500 text-[9px] font-black text-white border-2 border-white dark:border-[#111827] shadow-sm animate-pulse">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-3 w-[340px] sm:w-[400px] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden z-[100] animate-slide-down origin-top-right flex flex-col">
                    <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/50 backdrop-blur-xl shrink-0">
                        <h3 className="font-exstrabold text-slate-800 dark:text-white text-base tracking-tight flex items-center gap-2">
                            Thông báo
                            {unreadCount > 0 && <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-[10px] uppercase font-black tracking-widest">{unreadCount} MỚI</span>}
                        </h3>
                        {unreadCount > 0 && (
                            <button onClick={markAllAsRead} className="text-[11px] font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline">
                                Đánh dấu đã đọc tất cả
                            </button>
                        )}
                    </div>
                    
                    <div className="px-5 pt-3 flex gap-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
                        <button onClick={() => setActiveTab('UNREAD')} className={`pb-2.5 text-[12px] font-bold uppercase tracking-wider transition-colors flex gap-1.5 items-center ${activeTab === 'UNREAD' ? 'text-blue-600 border-b-[3px] border-blue-600' : 'text-slate-400 hover:text-slate-600'}`}>
                            Chưa đọc 
                        </button>
                        <button onClick={() => setActiveTab('ALL')} className={`pb-2.5 text-[12px] font-bold uppercase tracking-wider transition-colors ${activeTab === 'ALL' ? 'text-blue-600 border-b-[3px] border-blue-600' : 'text-slate-400 hover:text-slate-600'}`}>
                            Tất cả
                        </button>
                    </div>

                    <div className="max-h-[60vh] overflow-y-auto no-scrollbar bg-slate-50/30 dark:bg-slate-900/50 relative">
                        {filteredNotifs.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                                <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center mb-4 ring-4 ring-white dark:ring-slate-900 shadow-inner">
                                    <span className="material-symbols-outlined notranslate text-3xl text-slate-300 dark:text-slate-600" translate="no">notifications_paused</span>
                                </div>
                                <p className="text-[14px] font-bold text-slate-600 dark:text-slate-300">Hoàn toàn trống trơn</p>
                                <p className="text-[12px] text-slate-400/80 mt-1 max-w-[200px]">Bạn không có thông báo nào trong hộp thư này.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100 dark:divide-slate-800/60 p-2">
                                {filteredNotifs.map(notif => {
                                    const { icon, color } = getIconInfo(notif.type);
                                    return (
                                        <div 
                                            key={notif.id} 
                                            onClick={() => {
                                                if (!notif.is_read) markAsRead(notif.id);
                                                if (notif.link) {
                                                    // Add deep linking if necessary: window.location.hash = notif.link;
                                                }
                                                // setIsOpen(false); // Optional: close panel on click
                                            }}
                                            className={`p-3 mx-2 my-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors cursor-pointer group flex gap-3 ${!notif.is_read ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''}`}
                                        >
                                            <div className="relative shrink-0 mt-0.5">
                                                <div className={`w-[38px] h-[38px] rounded-[10px] flex items-center justify-center border shadow-sm ${color}`}>
                                                    <span className="material-symbols-outlined notranslate text-[18px]" translate="no">{icon}</span>
                                                </div>
                                                {!notif.is_read && (
                                                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-white dark:border-slate-900 ring-2 ring-blue-500/20 animate-pulse"></div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0 pr-1">
                                                <div className="flex justify-between items-start mb-0.5 gap-2">
                                                    <span className={`text-[13px] font-bold line-clamp-1 ${!notif.is_read ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'}`}>{notif.title}</span>
                                                    <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 whitespace-nowrap mt-0.5 flex-shrink-0">{timeAgo(notif.created_at)}</span>
                                                </div>
                                                <p className={`text-[12px] line-clamp-2 leading-relaxed mt-1 ${!notif.is_read ? 'text-slate-600 dark:text-slate-300 font-medium' : 'text-slate-500 dark:text-slate-500'}`}>
                                                    {notif.content}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
