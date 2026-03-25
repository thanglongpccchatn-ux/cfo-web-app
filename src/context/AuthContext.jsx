import React, { createContext, useContext, useState, useEffect } from 'react';
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

    useEffect(() => {
        let isMounted = true;

        const initSession = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (session?.user && isMounted) {
                    setUser(session.user);
                    await fetchUserProfileAndPermissions(session.user.id);
                }
            } catch (err) {
                console.error("Auth init error:", err);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        initSession();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session?.user && isMounted) {
                setUser(session.user);
                await fetchUserProfileAndPermissions(session.user.id);
            } else if (event === 'SIGNED_OUT' && isMounted) {
                setUser(null);
                setProfile(null);
                setPermissions([]);
            }
        });

        return () => {
            isMounted = false;
            subscription.unsubscribe();
        };
    }, []);

    async function fetchUserProfileAndPermissions(userId) {
        try {
            // Fetch Profile
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('*, roles:role_code(name)')
                .eq('id', userId)
                .single();
            
            if (profileError) {
                console.warn("Could not fetch profile (might not exist yet):", profileError);
                // Fallback basic profile
                setProfile({ id: userId, full_name: 'No Profile', role_code: 'GUEST', status: 'Hoạt động' });
            } else {
                if (profileData.status === 'Khóa') {
                    // Force logout if blocked
                    await supabase.auth.signOut();
                    setUser(null);
                    setProfile(null);
                    setPermissions([]);
                    alert("Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Quản trị viên.");
                    return;
                }
                setProfile(profileData);
            }

            // Fetch Permissions via RPC
            const { data: permData, error: permError } = await supabase
                .rpc('get_user_permissions', { p_user_id: userId });

            if (permError) {
                console.warn("Could not fetch permissions (RPC might be missing):", permError);
                setPermissions([]);
            } else {
                // permData is an array of { permission_code: '...' }
                setPermissions(permData ? permData.map(p => p.permission_code) : []);
            }
        } catch (error) {
            console.error("Error fetching user details:", error);
        }
    };

    // eslint-disable-next-line
    const login = async (email, password) => {
        return await supabase.auth.signInWithPassword({ email, password });
    };

    const logout = async () => {
        return await supabase.auth.signOut();
    };

    const refreshProfile = async () => {
        if (user) {
            await fetchUserProfileAndPermissions(user.id);
        }
    };

    const hasPermission = (permCode) => {
        // If Admin role (ROLE01 or custom admin code), optionally bypass. 
        // For now, rely on strictly mapped permissions.
        return permissions.includes(permCode);
    };

    const value = {
        user,
        profile,
        permissions,
        loading,
        login,
        logout,
        hasPermission,
        refreshProfile
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
