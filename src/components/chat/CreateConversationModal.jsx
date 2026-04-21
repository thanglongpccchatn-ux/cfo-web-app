/**
 * ➕ CreateConversationModal — New Chat / Group Creation
 * 
 * Select users from the company directory to create
 * direct (1-on-1) or group conversations.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

export default function CreateConversationModal({ onClose, onCreate }) {
    const { user } = useAuth();
    const [mode, setMode] = useState('direct'); // 'direct' | 'group'
    const [users, setUsers] = useState([]);
    const [selectedUsers, setSelectedUsers] = useState([]);
    const [groupName, setGroupName] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);

    // Load all users
    useEffect(() => {
        async function loadUsers() {
            setIsLoading(true);
            try {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('id, full_name, avatar_url, role_code, status, roles:role_code(name)')
                    .neq('id', user.id)
                    .neq('status', 'Khóa')
                    .order('full_name');

                if (error) throw error;
                setUsers(data || []);
            } catch (err) {
                console.error('[CreateConversation] Load users error:', err);
            } finally {
                setIsLoading(false);
            }
        }
        loadUsers();
    }, [user]);

    // Filter users by search
    const filteredUsers = useMemo(() => {
        if (!searchQuery.trim()) return users;
        const q = searchQuery.toLowerCase();
        return users.filter(u =>
            u.full_name?.toLowerCase().includes(q) ||
            u.role_code?.toLowerCase().includes(q)
        );
    }, [users, searchQuery]);

    // Toggle user selection
    const toggleUser = (userId) => {
        if (mode === 'direct') {
            setSelectedUsers([userId]);
        } else {
            setSelectedUsers(prev =>
                prev.includes(userId)
                    ? prev.filter(id => id !== userId)
                    : [...prev, userId]
            );
        }
    };

    // Handle create
    const handleCreate = async () => {
        if (selectedUsers.length === 0) return;
        if (mode === 'group' && !groupName.trim()) return;

        setIsCreating(true);
        try {
            await onCreate({
                type: mode,
                name: mode === 'group' ? groupName.trim() : null,
                memberIds: selectedUsers,
            });
            onClose();
        } catch (err) {
            console.error('[CreateConversation] Create error:', err);
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700/50 overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="h-16 flex items-center justify-between px-6 border-b border-slate-200 dark:border-slate-700/50">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                        Cuộc trò chuyện mới
                    </h3>
                    <button
                        onClick={onClose}
                        className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors cursor-pointer"
                        aria-label="Đóng"
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* Mode toggle */}
                <div className="px-6 pt-4 flex gap-2">
                    <button
                        onClick={() => { setMode('direct'); setSelectedUsers([]); }}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                            mode === 'direct'
                                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        <span className="material-symbols-outlined text-[16px] mr-1 align-middle">person</span>
                        Chat 1-1
                    </button>
                    <button
                        onClick={() => { setMode('group'); setSelectedUsers([]); }}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                            mode === 'group'
                                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        <span className="material-symbols-outlined text-[16px] mr-1 align-middle">groups</span>
                        Nhóm
                    </button>
                </div>

                {/* Group name input */}
                {mode === 'group' && (
                    <div className="px-6 pt-4">
                        <input
                            type="text"
                            value={groupName}
                            onChange={e => setGroupName(e.target.value)}
                            placeholder="Tên nhóm chat..."
                            className="w-full px-4 py-2.5 bg-slate-100 dark:bg-slate-800/60 rounded-xl text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 border border-transparent focus:border-blue-400 outline-none transition-all"
                            autoFocus
                        />
                    </div>
                )}

                {/* Selected users (for group mode) */}
                {mode === 'group' && selectedUsers.length > 0 && (
                    <div className="px-6 pt-3 flex flex-wrap gap-2">
                        {selectedUsers.map(uid => {
                            const u = users.find(usr => usr.id === uid);
                            if (!u) return null;
                            return (
                                <div key={uid} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-full border border-blue-200 dark:border-blue-500/20">
                                    <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">{u.full_name}</span>
                                    <button
                                        onClick={() => toggleUser(uid)}
                                        className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-blue-200 dark:hover:bg-blue-800 text-blue-400 cursor-pointer"
                                    >
                                        <span className="material-symbols-outlined text-[12px]">close</span>
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Search */}
                <div className="px-6 pt-4">
                    <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-slate-400">search</span>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Tìm đồng nghiệp..."
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-100 dark:bg-slate-800/60 rounded-xl text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 border border-transparent focus:border-blue-400 outline-none transition-all"
                        />
                    </div>
                </div>

                {/* User list */}
                <div className="px-4 pt-3 pb-4 max-h-[40vh] overflow-y-auto no-scrollbar">
                    {isLoading ? (
                        <div className="space-y-2 p-2">
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className="flex items-center gap-3 p-2 animate-pulse">
                                    <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700" />
                                    <div className="flex-1 space-y-2">
                                        <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full w-1/2" />
                                        <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full w-1/3" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : filteredUsers.length === 0 ? (
                        <div className="text-center py-8">
                            <span className="material-symbols-outlined text-3xl text-slate-300 dark:text-slate-600 mb-2">search_off</span>
                            <p className="text-sm text-slate-400">Không tìm thấy người dùng</p>
                        </div>
                    ) : (
                        <div className="space-y-0.5">
                            {filteredUsers.map(u => {
                                const isSelected = selectedUsers.includes(u.id);
                                return (
                                    <button
                                        key={u.id}
                                        onClick={() => toggleUser(u.id)}
                                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all cursor-pointer text-left ${
                                            isSelected
                                                ? 'bg-blue-50 dark:bg-blue-500/10 border border-blue-200/50 dark:border-blue-500/20'
                                                : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 border border-transparent'
                                        }`}
                                    >
                                        {/* Avatar */}
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold text-sm overflow-hidden flex-shrink-0">
                                            {u.avatar_url ? (
                                                <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <span>{u.full_name?.charAt(0).toUpperCase() || '?'}</span>
                                            )}
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 truncate">
                                                {u.full_name}
                                            </p>
                                            <p className="text-[11px] text-slate-400 truncate">
                                                {u.roles?.name || u.role_code || 'Nhân viên'}
                                            </p>
                                        </div>

                                        {/* Checkbox */}
                                        {mode === 'group' && (
                                            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                                                isSelected
                                                    ? 'bg-blue-600 border-blue-600'
                                                    : 'border-slate-300 dark:border-slate-600'
                                            }`}>
                                                {isSelected && (
                                                    <span className="material-symbols-outlined text-[14px] text-white">check</span>
                                                )}
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="h-16 flex items-center justify-end gap-3 px-6 border-t border-slate-200 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/30">
                    <button
                        onClick={onClose}
                        className="px-5 py-2 rounded-xl text-sm font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                    >
                        Hủy
                    </button>
                    <button
                        onClick={handleCreate}
                        disabled={selectedUsers.length === 0 || (mode === 'group' && !groupName.trim()) || isCreating}
                        className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                            selectedUsers.length > 0 && !isCreating
                                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20'
                                : 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
                        }`}
                    >
                        {isCreating ? (
                            <span className="flex items-center gap-2">
                                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                Đang tạo...
                            </span>
                        ) : mode === 'direct' ? (
                            'Bắt đầu trò chuyện'
                        ) : (
                            `Tạo nhóm (${selectedUsers.length} người)`
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
