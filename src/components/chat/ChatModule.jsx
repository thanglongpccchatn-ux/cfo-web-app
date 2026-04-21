/**
 * 💬 ChatModule — Main Chat Layout
 * 
 * Two-pane layout: ConversationList (left) + ChatWindow (right).
 * Responsive: mobile shows one pane at a time.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { useChat } from '../../hooks/useChat';
import { useChatRealtime } from '../../hooks/useChatRealtime';
import { useAuth } from '../../context/AuthContext';
import ConversationList from './ConversationList';
import ChatWindow from './ChatWindow';
import CreateConversationModal from './CreateConversationModal';

export default function ChatModule() {
    const { profile } = useAuth();
    const chat = useChat();
    const [showNewChat, setShowNewChat] = useState(false);
    const [mobileShowChat, setMobileShowChat] = useState(false);

    // Realtime subscriptions
    const conversationIds = useMemo(
        () => chat.conversations.map(c => c.id),
        [chat.conversations]
    );

    const handleNewMessage = useCallback((msg) => {
        chat.handleNewMessage(msg);
    }, [chat.handleNewMessage]);

    const handleMessageUpdate = useCallback((msg) => {
        // Handled by refreshing messages
    }, []);

    const handleConversationChange = useCallback(() => {
        chat.loadConversations();
    }, [chat.loadConversations]);

    const { typingUsers, broadcastTyping } = useChatRealtime({
        activeConversationId: chat.activeConversationId,
        conversationIds,
        onNewMessage: handleNewMessage,
        onMessageUpdate: handleMessageUpdate,
        onConversationChange: handleConversationChange,
    });

    // Handle selecting a conversation
    const handleSelectConversation = useCallback((convId) => {
        chat.setActiveConversation(convId);
        setMobileShowChat(true);
    }, [chat.setActiveConversation]);

    // Handle going back to list (mobile)
    const handleBackToList = useCallback(() => {
        setMobileShowChat(false);
    }, []);

    return (
        <div className="h-[calc(100vh-7rem)] flex rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-900 shadow-xl" id="chat-module">

            {/* ─── LEFT: Conversation List ─── */}
            <div className={`
                w-full md:w-[340px] lg:w-[380px] flex-shrink-0 border-r border-slate-200 dark:border-slate-700/50
                ${mobileShowChat ? 'hidden md:flex' : 'flex'} flex-col
                bg-slate-50/50 dark:bg-slate-900/50
            `}>
                <ConversationList
                    conversations={chat.conversations}
                    activeConversationId={chat.activeConversationId}
                    isLoading={chat.isLoadingConversations}
                    onSelect={handleSelectConversation}
                    onNewChat={() => setShowNewChat(true)}
                />
            </div>

            {/* ─── RIGHT: Chat Window ─── */}
            <div className={`
                flex-1 flex flex-col
                ${mobileShowChat ? 'flex' : 'hidden md:flex'}
                bg-white dark:bg-[#0f1729]
            `}>
                {chat.activeConversation ? (
                    <ChatWindow
                        conversation={chat.activeConversation}
                        messages={chat.messages}
                        isLoading={chat.isLoadingMessages}
                        isSending={chat.isSending}
                        hasMore={chat.hasMoreMessages}
                        uploadProgress={chat.uploadProgress}
                        typingUsers={typingUsers}
                        onSendMessage={chat.sendMessage}
                        onSendFile={chat.sendFile}
                        onLoadMore={chat.loadMoreMessages}
                        onDeleteMessage={chat.deleteMessage}
                        onReaction={chat.addReaction}
                        onBack={handleBackToList}
                        onBroadcastTyping={() => broadcastTyping(profile?.full_name)}
                        currentUserId={profile?.id}
                    />
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                        <div className="relative mb-8">
                            <div className="absolute inset-0 bg-blue-500/10 blur-[60px] rounded-full"></div>
                            <div className="relative w-24 h-24 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 dark:from-blue-500/20 dark:to-indigo-500/20 rounded-[28px] flex items-center justify-center border border-blue-200/30 dark:border-blue-500/20">
                                <span className="material-symbols-outlined text-5xl text-blue-500/60">forum</span>
                            </div>
                        </div>
                        <h3 className="text-xl font-bold text-slate-700 dark:text-slate-300 mb-2">
                            Tin nhắn nội bộ
                        </h3>
                        <p className="text-sm text-slate-400 dark:text-slate-500 max-w-xs leading-relaxed">
                            Chọn một cuộc trò chuyện hoặc bắt đầu cuộc trò chuyện mới để trao đổi với đồng nghiệp.
                        </p>
                        <button
                            onClick={() => setShowNewChat(true)}
                            className="mt-6 flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-lg shadow-blue-500/20 transition-all hover:shadow-blue-500/30 hover:-translate-y-0.5 cursor-pointer"
                        >
                            <span className="material-symbols-outlined text-[18px]">edit_square</span>
                            Tin nhắn mới
                        </button>
                    </div>
                )}
            </div>

            {/* ─── New Chat Modal ─── */}
            {showNewChat && (
                <CreateConversationModal
                    onClose={() => setShowNewChat(false)}
                    onCreate={chat.createConversation}
                />
            )}
        </div>
    );
}
