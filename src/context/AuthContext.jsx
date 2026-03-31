import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
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
    const [userRoles, setUserRoles] = useState([]);
    const [loading, setLoading] = useState(true);
    const isFetchingProfile = useRef(false);

    async function fetchUserProfileAndPermissions(userId) {
        if (!userId || isFetchingProfile.current) return;
        isFetchingProfile.current = true;
        
        // Safety timeout for fetching
        const fetchTimeout = setTimeout(() => {
            isFetchingProfile.current = false;
        }, 10000);

        try {
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('*, roles:role_code(name)')
                .eq('id', userId)
                .single();
            
            if (profileError) {
                setProfile({ id: userId, full_name: 'Người dùng mới', role_code: 'GUEST', status: 'Hoạt động' });
            } else {
                if (profileData.status === 'Khóa') {
                    await supabase.auth.signOut();
                    setUser(null);
                    setProfile(null);
                    setPermissions([]);
                    return;
                }
                setProfile(profileData);
            }

            // Fetch all roles for this user from user_roles table
            const { data: rolesData } = await supabase
                .from('user_roles')
                .select('role_code, roles:role_code(name, code)')
                .eq('user_id', userId);
            setUserRoles(rolesData || []);

            // Permissions are aggregated from ALL roles via updated RPC
            const { data: permData } = await supabase.rpc('get_user_permissions', { p_user_id: userId });
            setPermissions(permData ? permData.map(p => p.permission_code) : []);
        } catch (error) {
            console.error("Auth init fetch error:", error);
        } finally {
            clearTimeout(fetchTimeout);
            isFetchingProfile.current = false;
        }
    };

    useEffect(() => {
        let isMounted = true;
        
        // Initial session check
        async function checkSession() {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (isMounted && session?.user) {
                    setUser(session.user);
                    await fetchUserProfileAndPermissions(session.user.id);
                }
            } catch (e) {
                console.error("Session check error:", e);
            } finally {
                if (isMounted) setLoading(false);
            }
        };
        checkSession();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (!isMounted) return;

            if (event === 'SIGNED_OUT' || !session) {
                setUser(null);
                setProfile(null);
                setPermissions([]);
                setUserRoles([]);
            } else if (session?.user) {
                setUser(session.user);
                
                // Re-fetch profile on important auth events
                if (event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
                    fetchUserProfileAndPermissions(session.user.id);
                }
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
    const hasRole = (roleCode) => userRoles.some(r => r.role_code === roleCode);
    const refreshProfile = () => user && fetchUserProfileAndPermissions(user.id);

    return (
        <AuthContext.Provider value={{ user, profile, permissions, userRoles, loading, login, logout, hasPermission, hasRole, refreshProfile }}>
            {children}
        </AuthContext.Provider>
    );
};
