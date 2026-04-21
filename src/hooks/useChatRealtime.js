/**
 * 🔄 useChatRealtime — Supabase Realtime Subscriptions for Chat
 * 
 * Manages real-time subscriptions for new messages, typing indicators,
 * and member changes. Auto-reconnects on connection loss.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

/**
 * Hook to manage realtime chat subscriptions
 * @param {Object} params
 * @param {string|null} params.activeConversationId - Currently active conversation
 * @param {string[]} params.conversationIds - All conversation IDs user is part of 
 * @param {Function} params.onNewMessage - Callback when new message arrives
 * @param {Function} params.onMessageUpdate - Callback when message is updated
 * @param {Function} params.onConversationChange - Callback when conversation changes
 */
export function useChatRealtime({
    activeConversationId,
    conversationIds = [],
    onNewMessage,
    onMessageUpdate,
    onReactionChange,
    onConversationChange,
}) {
    const { user } = useAuth();
    const channelsRef = useRef(new Map());
    const typingChannelRef = useRef(null);
    const [typingUsers, setTypingUsers] = useState([]); // [{userId, fullName}]
    const typingTimeoutRef = useRef(new Map());

    // ─── SUBSCRIBE TO MESSAGES ───
    useEffect(() => {
        if (!user || !conversationIds.length) return;

        // Clean up old channels
        channelsRef.current.forEach((channel) => {
            supabase.removeChannel(channel);
        });
        channelsRef.current.clear();

        // Subscribe to messages for all conversations
        const msgChannel = supabase
            .channel('chat_messages_realtime')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'chat_messages',
                },
                (payload) => {
                    const newMsg = payload.new;
                    // Only process if it's in one of our conversations
                    if (conversationIds.includes(newMsg.conversation_id)) {
                        // Don't process our own messages (already in state from optimistic update)
                        if (newMsg.sender_id !== user.id) {
                            onNewMessage?.(newMsg);
                        }
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'chat_messages',
                },
                (payload) => {
                    const updatedMsg = payload.new;
                    if (conversationIds.includes(updatedMsg.conversation_id)) {
                        onMessageUpdate?.(updatedMsg);
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'chat_reactions',
                },
                (payload) => {
                    // Reactions insert or delete
                    if (payload.eventType === 'INSERT' || payload.eventType === 'DELETE') {
                        onReactionChange?.(payload);
                    }
                }
            )
            .subscribe();

        channelsRef.current.set('messages', msgChannel);

        // Subscribe to member changes
        const memberChannel = supabase
            .channel('chat_members_realtime')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'chat_members',
                },
                (payload) => {
                    const record = payload.new || payload.old;
                    if (record?.user_id === user.id || conversationIds.includes(record?.conversation_id)) {
                        onConversationChange?.();
                    }
                }
            )
            .subscribe();

        channelsRef.current.set('members', memberChannel);

        return () => {
            channelsRef.current.forEach((channel) => {
                supabase.removeChannel(channel);
            });
            channelsRef.current.clear();
        };
    }, [user, conversationIds.join(','), onNewMessage, onMessageUpdate, onReactionChange, onConversationChange]);

    // ─── TYPING INDICATOR ───
    useEffect(() => {
        if (!activeConversationId || !user) {
            if (typingChannelRef.current) {
                supabase.removeChannel(typingChannelRef.current);
                typingChannelRef.current = null;
            }
            setTypingUsers([]);
            return;
        }

        const channelName = `typing_${activeConversationId}`;
        
        // Remove existing typing channel
        if (typingChannelRef.current) {
            supabase.removeChannel(typingChannelRef.current);
        }

        const channel = supabase
            .channel(channelName, {
                config: { broadcast: { self: false } },
            })
            .on('broadcast', { event: 'typing' }, ({ payload }) => {
                if (payload.userId === user.id) return;

                setTypingUsers(prev => {
                    const exists = prev.find(u => u.userId === payload.userId);
                    if (!exists) {
                        return [...prev, { userId: payload.userId, fullName: payload.fullName }];
                    }
                    return prev;
                });

                // Clear typing after 3 seconds
                const existingTimeout = typingTimeoutRef.current.get(payload.userId);
                if (existingTimeout) clearTimeout(existingTimeout);

                typingTimeoutRef.current.set(
                    payload.userId,
                    setTimeout(() => {
                        setTypingUsers(prev => prev.filter(u => u.userId !== payload.userId));
                        typingTimeoutRef.current.delete(payload.userId);
                    }, 3000)
                );
            })
            .subscribe();

        typingChannelRef.current = channel;

        return () => {
            if (typingChannelRef.current) {
                supabase.removeChannel(typingChannelRef.current);
                typingChannelRef.current = null;
            }
            typingTimeoutRef.current.forEach(timeout => clearTimeout(timeout));
            typingTimeoutRef.current.clear();
            setTypingUsers([]);
        };
    }, [activeConversationId, user]);

    // ─── BROADCAST TYPING ───
    const broadcastTyping = useCallback((fullName) => {
        if (!typingChannelRef.current || !user) return;
        
        typingChannelRef.current.send({
            type: 'broadcast',
            event: 'typing',
            payload: {
                userId: user.id,
                fullName: fullName || 'Someone',
            },
        });
    }, [user]);

    return {
        typingUsers,
        broadcastTyping,
    };
}
