/**
 * 💬 MessageBubble — Single Message Component
 * 
 * Renders text, image, file, and system messages with
 * context menu actions (reply, delete, react).
 */

import React, { useState } from 'react';
import { getFileIcon, formatFileSize } from '../../lib/chatStorage';

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

export default function MessageBubble({
    message,
    isOwn,
    showAvatar,
    senderName,
    senderAvatar,
    onReply,
    onDelete,
    onReaction,
    onImageClick,
    currentUserId,
}) {
    const [showActions, setShowActions] = useState(false);
    const [showReactions, setShowReactions] = useState(false);

    // System messages
    if (message.type === 'system') {
        return (
            <div className="flex justify-center py-2">
                <div className="px-4 py-1.5 bg-slate-100 dark:bg-slate-800/40 rounded-full text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                    {message.content}
                </div>
            </div>
        );
    }

    // Deleted messages
    if (message.is_deleted) {
        return (
            <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} py-0.5 ${showAvatar ? 'mt-3' : ''}`}>
                <div className={`max-w-[75%] md:max-w-[60%] ${isOwn ? '' : 'pl-12'}`}>
                    <div className="px-4 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800/30 border border-dashed border-slate-200 dark:border-slate-700">
                        <p className="text-xs text-slate-400 italic flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[14px]">block</span>
                            Tin nhắn đã bị xóa
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    const time = new Date(message.created_at).toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
    });

    return (
        <div
            className={`flex ${isOwn ? 'justify-end' : 'justify-start'} py-0.5 ${showAvatar ? 'mt-3' : ''} group`}
            onMouseEnter={() => setShowActions(true)}
            onMouseLeave={() => { setShowActions(false); setShowReactions(false); }}
        >
            <div className={`max-w-[75%] md:max-w-[60%] flex ${isOwn ? 'flex-row-reverse' : 'flex-row'} items-end gap-2`}>
                {/* Avatar (for received messages) */}
                {!isOwn && (
                    <div className="flex-shrink-0 w-8">
                        {showAvatar ? (
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-300 to-slate-400 dark:from-slate-600 dark:to-slate-700 flex items-center justify-center text-white text-[11px] font-bold overflow-hidden" title={senderName}>
                                {senderAvatar ? (
                                    <img src={senderAvatar} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <span>{senderName ? senderName.charAt(0).toUpperCase() : <span className="material-symbols-outlined text-[16px]">person</span>}</span>
                                )}
                            </div>
                        ) : null}
                    </div>
                )}

                <div className={`relative ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
                    {/* Sender Name label (only for others and if showAvatar is true, mainly for groups) */}
                    {!isOwn && showAvatar && senderName && (
                        <span className="text-[11px] text-slate-500 font-semibold mb-1 ml-1">{senderName}</span>
                    )}

                    {/* Reply preview */}
                    {message.reply_msg && (
                        <div className={`mb-1 px-3 py-1.5 rounded-lg bg-slate-100/80 dark:bg-slate-800/40 border-l-2 border-blue-400 max-w-full`}>
                            <p className="text-[10px] font-semibold text-blue-500 mb-0.5">Trả lời</p>
                            <p className="text-[11px] text-slate-500 truncate">
                                {message.reply_msg.type === 'image' ? '📷 Hình ảnh' : message.reply_msg.content}
                            </p>
                        </div>
                    )}

                    {/* Message Bubble */}
                    <div className={`relative rounded-2xl overflow-hidden ${
                        isOwn
                            ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-br-md shadow-md shadow-blue-500/10'
                            : 'bg-slate-100 dark:bg-slate-800/60 text-slate-800 dark:text-slate-200 rounded-bl-md'
                    }`}>
                        {/* Image message */}
                        {message.type === 'image' && message.file_signed_url && (
                            <button
                                onClick={() => onImageClick?.(message.file_signed_url)}
                                className="block cursor-pointer"
                            >
                                <img
                                    src={message.file_signed_url}
                                    alt={message.file_name || 'Image'}
                                    className="max-w-full max-h-[300px] object-cover rounded-t-2xl"
                                    loading="lazy"
                                />
                            </button>
                        )}

                        {/* File message */}
                        {message.type === 'file' && (
                            <a
                                href={message.file_signed_url || '#'}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`flex items-center gap-3 px-4 py-3 transition-opacity hover:opacity-80 ${
                                    isOwn ? 'text-white/90' : 'text-slate-600 dark:text-slate-300'
                                }`}
                                download={message.file_name}
                            >
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                    isOwn ? 'bg-white/20' : 'bg-blue-50 dark:bg-blue-900/30'
                                }`}>
                                    <span className={`material-symbols-outlined text-[20px] ${
                                        isOwn ? 'text-white' : 'text-blue-500'
                                    }`}>
                                        {getFileIcon(message.file_type)}
                                    </span>
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className={`text-sm font-medium truncate ${isOwn ? 'text-white' : ''}`}>
                                        {message.file_name || 'Tệp đính kèm'}
                                    </p>
                                    <p className={`text-[11px] ${isOwn ? 'text-white/60' : 'text-slate-400'}`}>
                                        {formatFileSize(message.file_size)}
                                    </p>
                                </div>
                                <span className={`material-symbols-outlined text-[18px] ${isOwn ? 'text-white/60' : 'text-slate-400'}`}>
                                    download
                                </span>
                            </a>
                        )}

                        {/* Text content */}
                        {(message.type === 'text' || (message.type === 'image' && message.content && message.content !== '📷 Hình ảnh')) && (
                            <div className="px-4 py-2.5">
                                <p className="text-[14px] leading-relaxed whitespace-pre-wrap break-words">
                                    {message.type === 'text' ? (
                                        message.content.split(/(https?:\/\/[^\s]+|@\S+)/g).map((part, i) => {
                                            if (part.match(/(https?:\/\/[^\s]+)/g)) {
                                                return (
                                                    <a key={i} href={part} target="_blank" rel="noopener noreferrer" className={`hover:underline font-medium ${isOwn ? 'text-white underline-offset-2' : 'text-blue-500'}`}>
                                                        {part}
                                                    </a>
                                                );
                                            } else if (part.startsWith('@')) {
                                                return (
                                                    <span key={i} className={`font-bold ${isOwn ? 'text-white bg-white/20' : 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/20'} px-1 rounded-md`}>
                                                        {part.replace(/_/g, ' ')}
                                                    </span>
                                                );
                                            }
                                            return <React.Fragment key={i}>{part}</React.Fragment>;
                                        })
                                    ) : null}
                                </p>
                            </div>
                        )}

                        {/* Time & edited badge */}
                        <div className={`flex items-center gap-1.5 px-4 pb-2 -mt-0.5 ${
                            isOwn ? 'justify-end' : 'justify-start'
                        }`}>
                            {message.is_edited && (
                                <span className={`text-[10px] italic ${isOwn ? 'text-white/40' : 'text-slate-400'}`}>
                                    đã sửa
                                </span>
                            )}
                            <span className={`text-[10px] ${isOwn ? 'text-white/40' : 'text-slate-400'}`}>
                                {time}
                            </span>
                        </div>

                        {/* Reactions render */}
                        {message.reactions && message.reactions.length > 0 && !message.is_deleted && (
                            <div className={`absolute -bottom-3 ${isOwn ? 'right-4' : 'left-4'} flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 shadow-sm rounded-full px-1.5 py-0.5 z-10`}>
                                {Object.entries(
                                    message.reactions.reduce((acc, r) => {
                                        acc[r.emoji] = acc[r.emoji] || { count: 0, users: [] };
                                        acc[r.emoji].count++;
                                        acc[r.emoji].users.push(r.user_id);
                                        return acc;
                                    }, {})
                                ).map(([emoji, data]) => (
                                    <button 
                                        key={emoji} 
                                        onClick={() => onReaction?.(emoji)} 
                                        className={`flex items-center gap-0.5 text-[11px] font-medium px-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer ${data.users.includes(currentUserId) ? 'text-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'text-slate-600 dark:text-slate-300'}`}
                                    >
                                        <span className="text-[12px] -mt-0.5">{emoji}</span>
                                        <span className="opacity-80">{data.count > 1 ? data.count : ''}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Quick Actions (on hover) */}
                    {showActions && !message.is_deleted && (
                        <div className={`absolute top-0 ${isOwn ? '-left-36' : '-right-36'} flex items-center gap-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg p-0.5 z-10 animate-fade-in`}>
                            {message.type === 'text' && (
                                <button
                                    onClick={() => navigator.clipboard.writeText(message.content)}
                                    className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 transition-colors cursor-pointer"
                                    title="Sao chép"
                                >
                                    <span className="material-symbols-outlined text-[15px]">content_copy</span>
                                </button>
                            )}
                            <button
                                onClick={() => setShowReactions(!showReactions)}
                                className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 transition-colors cursor-pointer"
                                title="Thả cảm xúc"
                            >
                                <span className="text-sm">😊</span>
                            </button>
                            <button
                                onClick={onReply}
                                className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 transition-colors cursor-pointer"
                                title="Trả lời"
                            >
                                <span className="material-symbols-outlined text-[16px]">reply</span>
                            </button>
                            {isOwn && (
                                <button
                                    onClick={onDelete}
                                    className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                                    title="Thu hồi tin nhắn"
                                >
                                    <span className="material-symbols-outlined text-[16px]">delete</span>
                                </button>
                            )}
                        </div>
                    )}

                    {/* Reaction picker */}
                    {showReactions && (
                        <div className={`absolute top-8 ${isOwn ? '-left-4' : '-right-4'} flex items-center gap-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-1.5 z-20 animate-slide-up`}>
                            {QUICK_REACTIONS.map(emoji => (
                                <button
                                    key={emoji}
                                    onClick={() => { onReaction?.(emoji); setShowReactions(false); }}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-transform hover:scale-125 cursor-pointer text-lg"
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
