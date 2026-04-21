/**
 * 📋 ConversationList — Chat Sidebar
 * 
 * Displays list of conversations with search, unread badges,
 * last message preview, and new chat button.
 */

import React, { useState, useMemo } from 'react';

export default function ConversationList({
    conversations = [],
    activeConversationId,
    isLoading,
    onSelect,
    onNewChat,
}) {
    const [searchQuery, setSearchQuery] = useState('');

    // Filter conversations by search
    const filtered = useMemo(() => {
        if (!searchQuery.trim()) return conversations;
        const q = searchQuery.toLowerCase();
        return conversations.filter(c => {
            const name = c.type === 'direct'
                ? c.otherUser?.full_name || ''
                : c.name || '';
            return name.toLowerCase().includes(q)
                || c.lastMessage?.content?.toLowerCase().includes(q);
        });
    }, [conversations, searchQuery]);

    // Format time for last message
    const formatTime = (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now - date;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        }
        if (diffDays === 1) return 'Hôm qua';
        if (diffDays < 7) {
            const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
            return dayNames[date.getDay()];
        }
        return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
    };

    // Get display name for conversation
    const getConvName = (conv) => {
        if (conv.type === 'group') return conv.name || 'Nhóm chat';
        return conv.otherUser?.full_name || 'Người dùng';
    };

    // Get avatar for conversation
    const getAvatar = (conv) => {
        if (conv.type === 'group') {
            return conv.avatar_url || null;
        }
        return conv.otherUser?.avatar_url || null;
    };

    // Get last message preview
    const getPreview = (conv) => {
        if (!conv.lastMessage) return 'Chưa có tin nhắn';
        const msg = conv.lastMessage;
        if (msg.type === 'image') return '📷 Hình ảnh';
        if (msg.type === 'file') return `📎 ${msg.file_name || 'Tệp đính kèm'}`;
        if (msg.type === 'system') return `ℹ️ ${msg.content}`;
        return msg.content || '';
    };

    return (
        <>
            {/* ─── Header ─── */}
            <div className="h-16 flex items-center justify-between px-5 border-b border-slate-200 dark:border-slate-700/50 flex-shrink-0">
                <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <span className="material-symbols-outlined text-blue-500 text-[22px]">chat</span>
                    Tin nhắn
                </h2>
                <button
                    onClick={onNewChat}
                    className="w-9 h-9 flex items-center justify-center rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 transition-all hover:shadow-blue-500/30 cursor-pointer"
                    title="Cuộc trò chuyện mới"
                    aria-label="Tạo cuộc trò chuyện mới"
                >
                    <span className="material-symbols-outlined text-[18px]">edit_square</span>
                </button>
            </div>

            {/* ─── Search ─── */}
            <div className="px-4 py-3 flex-shrink-0">
                <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-slate-400">search</span>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Tìm kiếm cuộc trò chuyện..."
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-100 dark:bg-slate-800/60 rounded-xl text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 border border-transparent focus:border-blue-400 focus:bg-white dark:focus:bg-slate-800 outline-none transition-all"
                    />
                </div>
            </div>

            {/* ─── Conversation List ─── */}
            <div className="flex-1 overflow-y-auto no-scrollbar">
                {isLoading ? (
                    <div className="space-y-1 px-3">
                        {[...Array(6)].map((_, i) => (
                            <div key={i} className="flex items-center gap-3 p-3 rounded-xl animate-pulse">
                                <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-700 flex-shrink-0" />
                                <div className="flex-1 space-y-2">
                                    <div className="h-3.5 bg-slate-200 dark:bg-slate-700 rounded-full w-2/3" />
                                    <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full w-full" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                        <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600 mb-3">
                            {searchQuery ? 'search_off' : 'forum'}
                        </span>
                        <p className="text-sm text-slate-400 dark:text-slate-500">
                            {searchQuery ? 'Không tìm thấy cuộc trò chuyện' : 'Chưa có cuộc trò chuyện nào'}
                        </p>
                        {!searchQuery && (
                            <button
                                onClick={onNewChat}
                                className="mt-4 text-sm text-blue-500 hover:text-blue-600 font-semibold cursor-pointer"
                            >
                                + Bắt đầu trò chuyện
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="px-2 space-y-0.5">
                        {filtered.map(conv => {
                            const isActive = conv.id === activeConversationId;
                            const hasUnread = conv.unreadCount > 0;
                            const avatarUrl = getAvatar(conv);

                            return (
                                <button
                                    key={conv.id}
                                    onClick={() => onSelect(conv.id)}
                                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all text-left cursor-pointer group ${
                                        isActive
                                            ? 'bg-blue-50 dark:bg-blue-500/10 border border-blue-200/50 dark:border-blue-500/20'
                                            : 'hover:bg-slate-100 dark:hover:bg-slate-800/60 border border-transparent'
                                    }`}
                                    aria-label={`Mở cuộc trò chuyện với ${getConvName(conv)}`}
                                    aria-current={isActive ? 'true' : undefined}
                                >
                                    {/* Avatar */}
                                    <div className="relative flex-shrink-0">
                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm overflow-hidden ${
                                            conv.type === 'group'
                                                ? 'bg-gradient-to-br from-indigo-500 to-purple-600'
                                                : 'bg-gradient-to-br from-blue-500 to-cyan-500'
                                        }`}>
                                            {avatarUrl ? (
                                                <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                                            ) : conv.type === 'group' ? (
                                                <span className="material-symbols-outlined text-[22px]">groups</span>
                                            ) : (
                                                <span>{getConvName(conv).charAt(0).toUpperCase()}</span>
                                            )}
                                        </div>
                                        {hasUnread && (
                                            <div className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-lg shadow-red-500/30 ring-2 ring-white dark:ring-slate-900">
                                                {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                                            </div>
                                        )}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-0.5">
                                            <span className={`text-sm truncate ${
                                                hasUnread
                                                    ? 'font-bold text-slate-900 dark:text-white'
                                                    : 'font-semibold text-slate-700 dark:text-slate-300'
                                            }`}>
                                                {getConvName(conv)}
                                            </span>
                                            <span className={`text-[11px] flex-shrink-0 ml-2 ${
                                                hasUnread ? 'text-blue-500 font-semibold' : 'text-slate-400'
                                            }`}>
                                                {formatTime(conv.lastMessage?.created_at || conv.last_message_at)}
                                            </span>
                                        </div>
                                        <p className={`text-[13px] truncate ${
                                            hasUnread
                                                ? 'text-slate-600 dark:text-slate-300 font-medium'
                                                : 'text-slate-400 dark:text-slate-500'
                                        }`}>
                                            {getPreview(conv)}
                                        </p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </>
    );
}
