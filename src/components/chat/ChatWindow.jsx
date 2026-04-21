/**
 * 💬 ChatWindow — Message Display Area
 * 
 * Renders messages in a scrollable area with date separators,
 * auto-scroll, infinite scroll up, and typing indicator.
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import ChatImageViewer from './ChatImageViewer';

export default function ChatWindow({
    conversation,
    messages = [],
    isLoading,
    isSending,
    hasMore,
    uploadProgress,
    typingUsers = [],
    onSendMessage,
    onSendFile,
    onLoadMore,
    onDeleteMessage,
    onReaction,
    onBack,
    onBroadcastTyping,
    onDeleteConversation,
    currentUserId,
}) {
    const messagesEndRef = useRef(null);
    const scrollContainerRef = useRef(null);
    const [replyTo, setReplyTo] = useState(null);
    const [viewingImage, setViewingImage] = useState(null);
    const [autoScroll, setAutoScroll] = useState(true);
    const prevMessageCountRef = useRef(0);

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        if (autoScroll && messages.length > prevMessageCountRef.current) {
            setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 50);
        }
        prevMessageCountRef.current = messages.length;
    }, [messages.length, autoScroll]);

    // Scroll to bottom on conversation change
    useEffect(() => {
        setAutoScroll(true);
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
        }, 100);
    }, [conversation?.id]);

    // Detect scroll position for auto-scroll and load more
    const handleScroll = useCallback(() => {
        const el = scrollContainerRef.current;
        if (!el) return;

        // Auto-scroll: if user is near bottom
        const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
        setAutoScroll(isNearBottom);

        // Load more: if user scrolls to top
        if (el.scrollTop < 50 && hasMore && !isLoading) {
            const prevHeight = el.scrollHeight;
            onLoadMore?.();
            // Preserve scroll position after loading
            requestAnimationFrame(() => {
                el.scrollTop = el.scrollHeight - prevHeight;
            });
        }
    }, [hasMore, isLoading, onLoadMore]);

    // Group messages by date
    const groupedMessages = React.useMemo(() => {
        const groups = [];
        let currentDate = '';

        messages.forEach(msg => {
            const msgDate = new Date(msg.created_at).toLocaleDateString('vi-VN');
            if (msgDate !== currentDate) {
                currentDate = msgDate;
                groups.push({ type: 'date', date: formatDateLabel(msg.created_at) });
            }
            groups.push({ type: 'message', data: msg });
        });

        return groups;
    }, [messages]);

    // Get conversation display name
    const convName = conversation?.type === 'direct'
        ? conversation?.otherUser?.full_name || 'Người dùng'
        : conversation?.name || 'Nhóm chat';

    const memberCount = conversation?.chat_members?.length || 0;

    // Get all images for gallery navigation
    const imageMessages = messages.filter(m => m.type === 'image' && m.file_signed_url);

    return (
        <div className="flex-1 flex flex-col h-full">
            {/* ─── Chat Header ─── */}
            <div className="h-16 flex items-center gap-3 px-4 md:px-6 border-b border-slate-200 dark:border-slate-700/50 flex-shrink-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
                {/* Back button (mobile) */}
                <button
                    onClick={onBack}
                    className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors cursor-pointer"
                    aria-label="Quay lại danh sách"
                >
                    <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                </button>

                {/* Avatar */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm overflow-hidden flex-shrink-0 ${
                    conversation?.type === 'group'
                        ? 'bg-gradient-to-br from-indigo-500 to-purple-600'
                        : 'bg-gradient-to-br from-blue-500 to-cyan-500'
                }`}>
                    {conversation?.type === 'group' ? (
                        <span className="material-symbols-outlined text-[20px]">groups</span>
                    ) : conversation?.otherUser?.avatar_url ? (
                        <img src={conversation.otherUser.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                        <span>{convName.charAt(0).toUpperCase()}</span>
                    )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-white truncate">{convName}</h3>
                    <p className="text-[11px] text-slate-400">
                        {conversation?.type === 'group'
                            ? `${memberCount} thành viên`
                            : 'Đang hoạt động'}
                    </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                    <button className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer" title="Tìm kiếm">
                        <span className="material-symbols-outlined text-[20px]">search</span>
                    </button>
                    <button 
                        onClick={() => onDeleteConversation(conversation.id)}
                        className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 transition-colors cursor-pointer" 
                        title="Xóa cuộc trò chuyện"
                    >
                        <span className="material-symbols-outlined text-[20px]">delete</span>
                    </button>
                </div>
            </div>

            {/* ─── Messages Area ─── */}
            <div
                ref={scrollContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-1 scroll-smooth"
                style={{
                    backgroundImage: 'radial-gradient(circle at 20% 80%, rgba(59, 130, 246, 0.03) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(99, 102, 241, 0.03) 0%, transparent 50%)',
                }}
            >
                {/* Load more spinner */}
                {isLoading && (
                    <div className="flex justify-center py-3">
                        <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-full">
                            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                            <span className="text-xs text-slate-500">Đang tải...</span>
                        </div>
                    </div>
                )}

                {/* Messages */}
                {groupedMessages.map((item, i) => {
                    if (item.type === 'date') {
                        return (
                            <div key={`date-${i}`} className="flex items-center justify-center py-3">
                                <div className="px-4 py-1.5 bg-slate-100 dark:bg-slate-800/60 rounded-full text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                    {item.date}
                                </div>
                            </div>
                        );
                    }

                    const msg = item.data;
                    const isOwn = msg.sender_id === currentUserId;
                    const prevMsg = i > 0 && groupedMessages[i - 1].type === 'message'
                        ? groupedMessages[i - 1].data : null;
                    const showAvatar = !isOwn && (!prevMsg || prevMsg.sender_id !== msg.sender_id);
                    
                    // Find sender profile
                    const senderProfile = conversation.chat_users?.find(u => u.id === msg.sender_id);

                    return (
                        <MessageBubble
                            key={msg.id}
                            message={msg}
                            isOwn={isOwn}
                            showAvatar={showAvatar}
                            senderName={senderProfile?.full_name}
                            senderAvatar={senderProfile?.avatar_url}
                            onReply={() => setReplyTo(msg)}
                            onDelete={() => onDeleteMessage(msg.id)}
                            onReaction={(emoji) => onReaction(msg.id, emoji)}
                            onImageClick={(url) => setViewingImage(url)}
                        />
                    );
                })}

                {/* Typing indicator */}
                {typingUsers.length > 0 && (
                    <div className="flex items-center gap-2 py-2 pl-14 animate-fade-in">
                        <div className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-100 dark:bg-slate-800/60 rounded-2xl rounded-bl-md">
                            <div className="flex gap-1">
                                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                            <span className="text-[11px] text-slate-400 ml-1">
                                {typingUsers.map(u => u.fullName).join(', ')} đang nhập...
                            </span>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* ─── Upload Progress ─── */}
            {uploadProgress && (
                <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800 bg-blue-50/50 dark:bg-blue-900/10 animate-fade-in">
                    <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-blue-500 text-[18px] animate-spin">sync</span>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-slate-600 dark:text-slate-400 truncate">{uploadProgress.fileName}</p>
                            <div className="mt-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-blue-500 rounded-full transition-all duration-300"
                                    style={{ width: `${uploadProgress.progress}%` }}
                                />
                            </div>
                        </div>
                        <span className="text-[11px] font-semibold text-blue-500">{uploadProgress.progress}%</span>
                    </div>
                </div>
            )}

            {/* ─── Reply Preview ─── */}
            {replyTo && (
                <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 animate-slide-up">
                    <div className="flex items-center gap-3">
                        <div className="w-1 h-10 bg-blue-500 rounded-full flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-bold text-blue-500">Trả lời</p>
                            <p className="text-xs text-slate-500 truncate">{replyTo.content}</p>
                        </div>
                        <button
                            onClick={() => setReplyTo(null)}
                            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 cursor-pointer"
                        >
                            <span className="material-symbols-outlined text-[16px]">close</span>
                        </button>
                    </div>
                </div>
            )}

            {/* ─── Message Input & Scroll Button ─── */}
            <div className="relative">
                {/* Scroll to bottom button */}
                {!autoScroll && (
                    <button
                        onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
                        className="absolute -top-12 right-6 w-10 h-10 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 shadow-lg rounded-full flex items-center justify-center text-blue-500 hover:text-blue-600 hover:bg-slate-50 transition-all z-20 animate-fade-in cursor-pointer group"
                        title="Cuộn xuống cuối"
                    >
                        <span className="material-symbols-outlined text-[20px] group-hover:translate-y-0.5 transition-transform">arrow_downward</span>
                        
                        {/* Unread badge logic could go here in future */}
                    </button>
                )}

                <MessageInput
                onSend={(content) => {
                    onSendMessage(content, replyTo?.id);
                    setReplyTo(null);
                }}
                onSendFile={(file) => {
                    onSendFile(file, replyTo?.id);
                    setReplyTo(null);
                }}
                onTyping={onBroadcastTyping}
                isSending={isSending}
                chatUsers={conversation?.chat_users}
            />
            </div>

            {/* ─── Image Viewer ─── */}
            {viewingImage && (
                <ChatImageViewer
                    imageUrl={viewingImage}
                    images={imageMessages.map(m => m.file_signed_url)}
                    onClose={() => setViewingImage(null)}
                />
            )}
        </div>
    );
}

// ─── Helper: Format date label ───
function formatDateLabel(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const msgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffDays = Math.round((today - msgDay) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Hôm nay';
    if (diffDays === 1) return 'Hôm qua';
    return date.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
}
