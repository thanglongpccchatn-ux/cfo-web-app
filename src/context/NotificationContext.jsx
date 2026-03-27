import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

const NotificationContext = createContext({});

 
export const NotificationProvider = ({ children }) => {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        if (!user) {
            setNotifications([]);
            setUnreadCount(0);
            return;
        }

        async function fetchNotifications() {
            const { data, error: _error } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(50);
            
            if (data) {
                setNotifications(data);
            }
        };

        fetchNotifications();

        const channel = supabase.channel(`notifications_${user.id}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${user.id}`
            }, (payload) => {
                if (payload.eventType === 'INSERT') {
                    setNotifications(prev => [payload.new, ...prev].slice(0, 50));
                } else if (payload.eventType === 'UPDATE') {
                    setNotifications(prev => prev.map(n => n.id === payload.new.id ? payload.new : n));
                } else if (payload.eventType === 'DELETE') {
                    setNotifications(prev => prev.filter(n => n.id !== payload.old.id));
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user]);

    useEffect(() => {
        setUnreadCount(notifications.filter(n => !n.is_read).length);
    }, [notifications]);

    const markAsRead = async (id) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
        await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    };

    async function markAllAsRead() {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
    };
    
    // Universal trigger: Sends a notification to anyone possessing the specific permission code
    const sendNotification = async (permissionCode, title, content, type = 'INFO', link = '') => {
        if (!user) return;
        try {
            const { data: targets } = await supabase.rpc('get_users_by_permission', { p_permission_code: permissionCode });
            if (!targets || targets.length === 0) return;
            
            const userIds = [...new Set(targets.map(t => t.user_id))];
            
            await supabase.rpc('send_notification', {
                p_user_ids: userIds,
                p_title: title,
                p_content: content,
                p_type: type,
                p_link: link,
                p_sender_id: user.id
            });
        } catch (error) {
            console.error("Failed to send notification via RPC:", error);
        }
    };

    return (
        <NotificationContext.Provider value={{ notifications, unreadCount, markAsRead, markAllAsRead, sendNotification }}>
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotification = () => useContext(NotificationContext);
