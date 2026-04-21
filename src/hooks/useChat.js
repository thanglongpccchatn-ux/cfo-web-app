/**
 * 💬 useChat — Main Chat State Management Hook
 * 
 * Handles conversations, messages, sending, pagination, and file uploads.
 * Uses Supabase for data persistence and React state for UI.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { uploadChatFile, getSignedUrls } from '../lib/chatStorage';
import { useAuth } from '../context/AuthContext';

const MESSAGES_PER_PAGE = 40;

export function useChat() {
    const { user } = useAuth();
    const [conversations, setConversations] = useState([]);
    const [activeConversationId, setActiveConversationId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [isLoadingConversations, setIsLoadingConversations] = useState(true);
    const [isLoadingMessages, setIsLoadingMessages] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [hasMoreMessages, setHasMoreMessages] = useState(true);
    const [uploadProgress, setUploadProgress] = useState(null); // {fileName, progress}
    const messagesOffsetRef = useRef(0);
    const fileUrlCacheRef = useRef(new Map());

    // ─── LOAD CONVERSATIONS ───
    const loadConversations = useCallback(async () => {
        if (!user) return;
        setIsLoadingConversations(true);
        try {
            // Get all conversation IDs where user is a member
            const { data: memberData } = await supabase
                .from('chat_members')
                .select('conversation_id')
                .eq('user_id', user.id);

            if (!memberData?.length) {
                setConversations([]);
                setIsLoadingConversations(false);
                return;
            }

            const convIds = memberData.map(m => m.conversation_id);

            // Get conversations with last message preview
            const { data: convData, error } = await supabase
                .from('chat_conversations')
                .select(`
                    *,
                    chat_members(user_id, last_read_at, role)
                `)
                .in('id', convIds)
                .order('last_message_at', { ascending: false });

            if (error) throw error;

            // Get last message for each conversation
            const enriched = await Promise.all(
                (convData || []).map(async (conv) => {
                    // Get last message
                    const { data: lastMsgData } = await supabase
                        .from('chat_messages')
                        .select('content, type, sender_id, created_at, file_name')
                        .eq('conversation_id', conv.id)
                        .eq('is_deleted', false)
                        .order('created_at', { ascending: false })
                        .limit(1);

                    // Count unread messages
                    const myMembership = conv.chat_members?.find(m => m.user_id === user.id);
                    const lastReadAt = myMembership?.last_read_at || conv.created_at;

                    const { count: unreadCount } = await supabase
                        .from('chat_messages')
                        .select('id', { count: 'exact', head: true })
                        .eq('conversation_id', conv.id)
                        .eq('is_deleted', false)
                        .neq('sender_id', user.id)
                        .gt('created_at', lastReadAt);

                    // Load profiles for all members in the conversation
                    let chat_users = [];
                    const memberIds = conv.chat_members?.map(m => m.user_id) || [];
                    if (memberIds.length > 0) {
                        const { data: profilesData } = await supabase
                            .from('profiles')
                            .select('id, full_name, avatar_url')
                            .in('id', memberIds);
                        chat_users = profilesData || [];
                    }

                    // For direct chats, get the other user's profile specifically
                    let otherUser = null;
                    if (conv.type === 'direct') {
                        const otherMemberId = conv.chat_members?.find(m => m.user_id !== user.id)?.user_id;
                        otherUser = chat_users.find(u => u.id === otherMemberId) || null;
                    }

                    return {
                        ...conv,
                        chat_users, // List of all member profiles {id, full_name, avatar_url}
                        lastMessage: lastMsgData?.[0] || null,
                        unreadCount: unreadCount || 0,
                        otherUser,
                    };
                })
            );

            setConversations(enriched);
        } catch (err) {
            console.error('[useChat] loadConversations error:', err);
        } finally {
            setIsLoadingConversations(false);
        }
    }, [user]);

    // ─── LOAD MESSAGES ───
    const loadMessages = useCallback(async (conversationId, reset = true) => {
        if (!conversationId || !user) return;
        setIsLoadingMessages(true);

        if (reset) {
            messagesOffsetRef.current = 0;
            setMessages([]);
            setHasMoreMessages(true);
        }

        try {
            const { data, error } = await supabase
                .from('chat_messages')
                .select(`
                    *,
                    reply_msg:reply_to(id, content, sender_id, type, file_name)
                `)
                .eq('conversation_id', conversationId)
                .order('created_at', { ascending: false })
                .range(messagesOffsetRef.current, messagesOffsetRef.current + MESSAGES_PER_PAGE - 1);

            if (error) throw error;

            if (!data || data.length < MESSAGES_PER_PAGE) {
                setHasMoreMessages(false);
            }

            // Resolve file URLs for messages with files
            const fileMessages = data?.filter(m => m.file_url && !m.file_url.startsWith('http')) || [];
            if (fileMessages.length > 0) {
                const paths = fileMessages.map(m => m.file_url);
                const uncachedPaths = paths.filter(p => !fileUrlCacheRef.current.has(p));
                
                if (uncachedPaths.length > 0) {
                    const urlMap = await getSignedUrls(uncachedPaths);
                    Object.entries(urlMap).forEach(([path, url]) => {
                        fileUrlCacheRef.current.set(path, url);
                    });
                }
            }

            const resolvedMessages = (data || []).map(msg => ({
                ...msg,
                file_signed_url: msg.file_url ? (fileUrlCacheRef.current.get(msg.file_url) || msg.file_url) : null,
            })).reverse();

            if (reset) {
                setMessages(resolvedMessages);
            } else {
                setMessages(prev => [...resolvedMessages, ...prev]);
            }

            messagesOffsetRef.current += data?.length || 0;
        } catch (err) {
            console.error('[useChat] loadMessages error:', err);
        } finally {
            setIsLoadingMessages(false);
        }
    }, [user]);

    // ─── LOAD MORE (PAGINATION) ───
    const loadMoreMessages = useCallback(() => {
        if (activeConversationId && hasMoreMessages && !isLoadingMessages) {
            loadMessages(activeConversationId, false);
        }
    }, [activeConversationId, hasMoreMessages, isLoadingMessages, loadMessages]);

    // ─── SET ACTIVE CONVERSATION ───
    const setActiveConversation = useCallback((convId) => {
        setActiveConversationId(convId);
        if (convId) {
            loadMessages(convId, true);
            markAsRead(convId);
        }
    }, [loadMessages]);

    // ─── SEND TEXT MESSAGE ───
    const sendMessage = useCallback(async (content, replyTo = null) => {
        if (!content?.trim() || !activeConversationId || !user) return null;
        setIsSending(true);

        try {
            const { data, error } = await supabase
                .from('chat_messages')
                .insert({
                    conversation_id: activeConversationId,
                    sender_id: user.id,
                    content: content.trim(),
                    type: 'text',
                    reply_to: replyTo,
                })
                .select(`
                    *,
                    reply_msg:reply_to(id, content, sender_id, type, file_name)
                `)
                .single();

            if (error) throw error;
            
            // Update local state immediately
            setMessages(prev => [...prev, data]);
            
            return data;
        } catch (err) {
            console.error('[useChat] sendMessage error:', err);
            return null;
        } finally {
            setIsSending(false);
        }
    }, [activeConversationId, user]);

    // ─── SEND FILE/IMAGE ───
    const sendFile = useCallback(async (file, replyTo = null) => {
        if (!file || !activeConversationId || !user) return null;
        setIsSending(true);
        setUploadProgress({ fileName: file.name, progress: 0 });

        try {
            // Simulate progress (Supabase JS doesn't expose upload progress)
            const progressInterval = setInterval(() => {
                setUploadProgress(prev => prev ? {
                    ...prev,
                    progress: Math.min((prev.progress || 0) + 15, 90)
                } : null);
            }, 200);

            const { path, error: uploadError } = await uploadChatFile(file, activeConversationId);
            clearInterval(progressInterval);

            if (uploadError || !path) {
                setUploadProgress(null);
                throw new Error(uploadError || 'Upload failed');
            }

            setUploadProgress(prev => prev ? { ...prev, progress: 95 } : null);

            const msgType = file.type.startsWith('image/') ? 'image' : 'file';

            const { data, error } = await supabase
                .from('chat_messages')
                .insert({
                    conversation_id: activeConversationId,
                    sender_id: user.id,
                    content: msgType === 'image' ? '📷 Hình ảnh' : `📎 ${file.name}`,
                    type: msgType,
                    file_url: path,
                    file_name: file.name,
                    file_size: file.size,
                    file_type: file.type,
                    reply_to: replyTo,
                })
                .select(`
                    *,
                    reply_msg:reply_to(id, content, sender_id, type, file_name)
                `)
                .single();

            if (error) throw error;

            // Update local state immediately (with signed url for immediate view)
            setMessages(prev => [...prev, { ...data, file_signed_url: path }]);

            setUploadProgress({ fileName: file.name, progress: 100 });
            setTimeout(() => setUploadProgress(null), 1000);

            return data;
        } catch (err) {
            console.error('[useChat] sendFile error:', err);
            setUploadProgress(null);
            return null;
        } finally {
            setIsSending(false);
        }
    }, [activeConversationId, user]);

    // ─── MARK AS READ ───
    const markAsRead = useCallback(async (conversationId) => {
        if (!conversationId || !user) return;
        try {
            await supabase
                .from('chat_members')
                .update({ last_read_at: new Date().toISOString() })
                .eq('conversation_id', conversationId)
                .eq('user_id', user.id);

            // Update local state
            setConversations(prev =>
                prev.map(c => c.id === conversationId ? { ...c, unreadCount: 0 } : c)
            );
        } catch (err) {
            console.error('[useChat] markAsRead error:', err);
        }
    }, [user]);

    // ─── CREATE CONVERSATION ───
    const createConversation = useCallback(async ({ type = 'direct', name = null, memberIds = [] }) => {
        if (!user) return null;

        try {
            // For direct chats, check if conversation already exists
            if (type === 'direct' && memberIds.length === 1) {
                const otherId = memberIds[0];
                const existing = conversations.find(c =>
                    c.type === 'direct' &&
                    c.chat_members?.some(m => m.user_id === otherId)
                );
                if (existing) {
                    setActiveConversation(existing.id);
                    return existing;
                }
            }

            // Create conversation
            const { data: conv, error: convError } = await supabase
                .from('chat_conversations')
                .insert({
                    type,
                    name: type === 'group' ? name : null,
                    created_by: user.id,
                })
                .select()
                .single();

            if (convError) throw convError;

            // Add self as admin FIRST (required for RLS to allow adding others)
            const { error: selfError } = await supabase
                .from('chat_members')
                .insert({
                    conversation_id: conv.id,
                    user_id: user.id,
                    role: 'admin',
                });

            if (selfError) throw selfError;

            // Then add other members
            const otherMembers = memberIds.filter(id => id !== user.id);
            if (otherMembers.length > 0) {
                const otherInserts = otherMembers.map(userId => ({
                    conversation_id: conv.id,
                    user_id: userId,
                    role: 'member',
                }));

                const { error: memberError } = await supabase
                    .from('chat_members')
                    .insert(otherInserts);

                if (memberError) throw memberError;
            }

            // Add system message for group creation
            if (type === 'group') {
                await supabase.from('chat_messages').insert({
                    conversation_id: conv.id,
                    sender_id: user.id,
                    content: `Nhóm "${name}" đã được tạo`,
                    type: 'system',
                });
            }

            // Reload and navigate to new conversation
            await loadConversations();
            setActiveConversation(conv.id);
            return conv;
        } catch (err) {
            console.error('[useChat] createConversation error:', err);
            return null;
        }
    }, [user, conversations, loadConversations, setActiveConversation]);

    // ─── DELETE CONVERSATION ───
    const deleteConversation = useCallback(async (convId) => {
        if (!convId || !window.confirm('Bạn có chắc chắn muốn xóa cuộc trò chuyện này? Toàn bộ dữ liệu sẽ bị xóa vĩnh viễn khỏi hệ thống.')) return false;
        try {
            // Because chat_members and chat_messages have ON DELETE CASCADE, deleting the conversation deletes everything.
            const { error: convError } = await supabase.from('chat_conversations').delete().eq('id', convId);
            if (convError) throw convError;
            
            // Delete associated files from storage
            // Note: Ideally handled by an edge function or DB trigger, but omitting for frontend simplicity
            
            // Update local state immediately
            setConversations(prev => prev.filter(c => c.id !== convId));
            if (activeConversationId === convId) setActiveConversationId(null);
            return true;
        } catch (err) {
            console.error('[useChat] deleteConversation error:', err);
            alert('Lỗi: Bạn không có quyền xóa cuộc trò chuyện này.');
            return false;
        }
    }, [activeConversationId]);

    // ─── DELETE MESSAGE (soft) ───
    const deleteMessage = useCallback(async (messageId) => {
        if (!messageId || !user) return;
        try {
            await supabase
                .from('chat_messages')
                .update({ is_deleted: true, content: 'Tin nhắn đã bị xóa', updated_at: new Date().toISOString() })
                .eq('id', messageId)
                .eq('sender_id', user.id);

            setMessages(prev =>
                prev.map(m => m.id === messageId
                    ? { ...m, is_deleted: true, content: 'Tin nhắn đã bị xóa' }
                    : m
                )
            );
        } catch (err) {
            console.error('[useChat] deleteMessage error:', err);
        }
    }, [user]);

    // ─── EDIT MESSAGE ───
    const editMessage = useCallback(async (messageId, newContent) => {
        if (!messageId || !newContent?.trim() || !user) return;
        try {
            const { error } = await supabase
                .from('chat_messages')
                .update({
                    content: newContent.trim(),
                    is_edited: true,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', messageId)
                .eq('sender_id', user.id);

            if (error) throw error;

            setMessages(prev =>
                prev.map(m => m.id === messageId
                    ? { ...m, content: newContent.trim(), is_edited: true }
                    : m
                )
            );
        } catch (err) {
            console.error('[useChat] editMessage error:', err);
        }
    }, [user]);

    // ─── ADD REACTION ───
    const addReaction = useCallback(async (messageId, emoji) => {
        if (!messageId || !emoji || !user) return;
        try {
            const { error } = await supabase
                .from('chat_reactions')
                .upsert({
                    message_id: messageId,
                    user_id: user.id,
                    emoji,
                }, { onConflict: 'message_id,user_id,emoji' });

            if (error) throw error;
        } catch (err) {
            console.error('[useChat] addReaction error:', err);
        }
    }, [user]);

    // ─── HANDLE INCOMING REALTIME MESSAGE ───
    const handleNewMessage = useCallback(async (newMsg) => {
        if (newMsg.conversation_id === activeConversationId) {
            // Resolve file URL if needed
            let fileSignedUrl = null;
            if (newMsg.file_url && !newMsg.file_url.startsWith('http')) {
                const cached = fileUrlCacheRef.current.get(newMsg.file_url);
                if (cached) {
                    fileSignedUrl = cached;
                } else {
                    const urlMap = await getSignedUrls([newMsg.file_url]);
                    fileSignedUrl = urlMap[newMsg.file_url] || newMsg.file_url;
                    fileUrlCacheRef.current.set(newMsg.file_url, fileSignedUrl);
                }
            }

            setMessages(prev => {
                // Avoid duplicates
                if (prev.some(m => m.id === newMsg.id)) return prev;
                return [...prev, { ...newMsg, file_signed_url: fileSignedUrl }];
            });

            // Mark as read if it's the active conversation
            if (newMsg.sender_id !== user?.id) {
                markAsRead(newMsg.conversation_id);
            }
        }

        // Update conversation list (last message, unread count)
        setConversations(prev => {
            const updated = prev.map(c => {
                if (c.id !== newMsg.conversation_id) return c;
                return {
                    ...c,
                    lastMessage: {
                        content: newMsg.content,
                        type: newMsg.type,
                        sender_id: newMsg.sender_id,
                        created_at: newMsg.created_at,
                        file_name: newMsg.file_name,
                    },
                    last_message_at: newMsg.created_at,
                    unreadCount: newMsg.conversation_id === activeConversationId
                        ? 0
                        : (c.unreadCount || 0) + (newMsg.sender_id !== user?.id ? 1 : 0),
                };
            });
            // Sort by last message
            return updated.sort((a, b) =>
                new Date(b.last_message_at) - new Date(a.last_message_at)
            );
        });
    }, [activeConversationId, user, markAsRead]);

    // ─── TOTAL UNREAD COUNT ───
    const totalUnreadCount = conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);

    // ─── GET ACTIVE CONVERSATION OBJECT ───
    const activeConversation = conversations.find(c => c.id === activeConversationId) || null;

    // Load conversations on mount
    useEffect(() => {
        if (user) {
            loadConversations();
        }
    }, [user, loadConversations]);

    return {
        // State
        conversations,
        activeConversation,
        activeConversationId,
        messages,
        totalUnreadCount,
        isLoadingConversations,
        isLoadingMessages,
        isSending,
        hasMoreMessages,
        uploadProgress,

        // Actions
        setActiveConversation,
        sendMessage,
        sendFile,
        markAsRead,
        createConversation,
        deleteMessage,
        editMessage,
        addReaction,
        loadMoreMessages,
        loadConversations,
        handleNewMessage,
        deleteConversation,
    };
}
