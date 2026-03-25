import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [permissions, setPermissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const isFetchingProfile = useRef(false);

    async function fetchUserProfileAndPermissions(userId) {
        if (isFetchingProfile.current) return;
        isFetchingProfile.current = true;
        try {
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('*, roles:role_code(name)')
                .eq('id', userId)
                .single();
            
            if (profileError) {
                setProfile({ id: userId, full_name: 'No Profile', role_code: 'GUEST', status: 'Hoạt động' });
            } else {
                if (profileData.status === 'Khóa') {
                    await supabase.auth.signOut();
                    setUser(null);
                    setProfile(null);
                    setPermissions([]);
                    alert("Tài khoản của bạn đã bị khóa.");
                    return;
                }
                setProfile(profileData);
            }

            const { data: permData } = await supabase.rpc('get_user_permissions', { p_user_id: userId });
            setPermissions(permData ? permData.map(p => p.permission_code) : []);
        } catch (error) {
            console.error("Auth init fetch error:", error);
        } finally {
            isFetchingProfile.current = false;
        }
    };

    useEffect(() => {
        let isMounted = true;
        
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (!isMounted) return;

            if (session?.user) {
                setUser(session.user);
                await fetchUserProfileAndPermissions(session.user.id);
                if (isMounted) setLoading(false);
            } else if (event === 'SIGNED_OUT' || !session) {
                setUser(null);
                setProfile(null);
                setPermissions([]);
                if (isMounted) setLoading(false);
            }
        });

        return () => {
            isMounted = false;
            subscription.unsubscribe();
        };
    }, []);

    const login = (email, password) => supabase.auth.signInWithPassword({ email, password });
    const logout = () => supabase.auth.signOut();
    const hasPermission = (p) => permissions.includes(p);
    const refreshProfile = () => user && fetchUserProfileAndPermissions(user.id);

    return (
        <AuthContext.Provider value={{ user, profile, permissions, loading, login, logout, hasPermission, refreshProfile }}>
            {children}
        </AuthContext.Provider>
    );
};
