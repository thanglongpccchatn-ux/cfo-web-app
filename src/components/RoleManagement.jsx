import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { smartToast } from '../utils/globalToast';

export default function RoleManagement() {
    const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
    const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false);
    const [editingRole, setEditingRole] = useState(null);
    const [roleForm, setRoleForm] = useState({ code: '', name: '', description: '' });
    const [selectedRoleForPerm, setSelectedRoleForPerm] = useState(null);
    const [rolePermissions, setRolePermissions] = useState([]);
    const [isSavingPerms, setIsSavingPerms] = useState(false);

    const queryClient = useQueryClient();
    const invalidateRoles = () => queryClient.invalidateQueries({ queryKey: ['rolesManagement'] });

    // ── React Query: Roles + Permissions + Counts ──
    const { data: queryData, isLoading } = useQuery({
        queryKey: ['rolesManagement'],
        queryFn: async () => {
            const [rolesRes, permsRes, profilesRes] = await Promise.all([
                supabase.from('roles').select('*').order('code', { ascending: true }),
                supabase.from('permissions').select('*').order('module', { ascending: true }),
                supabase.from('profiles').select('role_code')
            ]);
            if (rolesRes.error) throw rolesRes.error;
            const counts = {};
            (profilesRes.data || []).forEach(p => {
                if (p.role_code) counts[p.role_code] = (counts[p.role_code] || 0) + 1;
            });
            return {
                roles: rolesRes.data || [],
                allPermissions: permsRes.data || [],
                roleCounts: counts
            };
        },
        staleTime: 2 * 60 * 1000,
    });

    const roles = queryData?.roles || [];
    const allPermissions = queryData?.allPermissions || [];
    const roleCounts = queryData?.roleCounts || {};

    // --- Role CRUD ---
    const handleOpenRoleModal = (role = null) => {
        if (role) {
            setEditingRole(role);
            setRoleForm({ code: role.code, name: role.name, description: role.description || '' });
        } else {
            setEditingRole(null);
            setRoleForm({ code: '', name: '', description: '' });
        }
        setIsRoleModalOpen(true);
    };

    const handleSaveRole = async (e) => {
        e.preventDefault();
        try {
            if (editingRole) {
                const { error } = await supabase.from('roles').update({
                    name: roleForm.name,
                    description: roleForm.description
                }).eq('code', editingRole.code);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('roles').insert([
                    { code: roleForm.code.toUpperCase(), name: roleForm.name, description: roleForm.description }
                ]);
                if (error) throw error;
            }
            setIsRoleModalOpen(false);
            invalidateRoles();
        } catch (err) {
            smartToast('Lỗi lưu vai trò: ' + err.message);
        }
    };

    const handleDeleteRole = async (code) => {
        if(window.confirm(`Bạn có chắc chắn muốn xóa vai trò ${code}?`)) {
            const { error } = await supabase.from('roles').delete().eq('code', code);
            if(error) smartToast('Lỗi xóa vai trò: ' + error.message);
            else invalidateRoles();
        }
    };

    // --- Permissions Matrix ---
    const handleOpenPermissions = async (role) => {
        setSelectedRoleForPerm(role);
        setIsPermissionModalOpen(true);
        // Fetch existing perms for this role
        const { data } = await supabase.from('role_permissions').select('permission_code').eq('role_code', role.code);
        if (data) {
            setRolePermissions(data.map(r => r.permission_code));
        } else {
            setRolePermissions([]);
        }
    };

    const togglePermission = (permCode) => {
        setRolePermissions(prev => 
            prev.includes(permCode) ? prev.filter(c => c !== permCode) : [...prev, permCode]
        );
    };

    const toggleModule = (moduleCode, modulePerms) => {
        const modulePermCodes = modulePerms.map(p => p.code);
        const allChecked = modulePermCodes.every(code => rolePermissions.includes(code));
        
        if (allChecked) {
            // Uncheck all
            setRolePermissions(prev => prev.filter(c => !modulePermCodes.includes(c)));
        } else {
            // Check all
            const newPerms = new Set([...rolePermissions, ...modulePermCodes]);
            setRolePermissions(Array.from(newPerms));
        }
    };

    const handleSavePermissions = async () => {
        setIsSavingPerms(true);
        try {
            // 1. Delete all existing exact perms for role
            await supabase.from('role_permissions').delete().eq('role_code', selectedRoleForPerm.code);
            // 2. Insert new
            if (rolePermissions.length > 0) {
                const inserts = rolePermissions.map(code => ({
                    role_code: selectedRoleForPerm.code,
                    permission_code: code
                }));
                const { error } = await supabase.from('role_permissions').insert(inserts);
                if (error) throw error;
            }
            setIsPermissionModalOpen(false);
            smartToast('Đã cập nhật phân quyền thành công.');
        } catch (err) {
            smartToast('Lỗi cập nhật quyền: ' + err.message);
        } finally {
            setIsSavingPerms(false);
        }
    };

    // Group permissions by module
    const permsByModule = allPermissions.reduce((acc, perm) => {
        if (!acc[perm.module]) acc[perm.module] = [];
        acc[perm.module].push(perm);
        return acc;
    }, {});

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-white">Quản lý phân quyền</h2>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => handleOpenRoleModal()}
                        className="h-10 flex items-center gap-2 px-4 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 active:scale-95 transition-all shadow-sm"
                    >
                        <span className="material-symbols-outlined notranslate text-[18px]" translate="no">admin_panel_settings</span>
                        Thêm vai trò
                    </button>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-700 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">
                                <th className="px-6 py-4 w-[35%]">TÊN VAI TRÒ</th>
                                <th className="px-6 py-4 w-[30%]">MÔ TẢ QUYỀN HẠN</th>
                                <th className="px-6 py-4 w-[15%] text-center">SỐ NGƯỜI DÙNG</th>
                                <th className="px-6 py-4 w-[10%] text-center">TRẠNG THÁI</th>
                                <th className="px-6 py-4 w-[10%] text-center">THAO TÁC</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                            {isLoading ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center text-slate-500">
                                        <div className="flex items-center justify-center gap-2">
                                            <span className="material-symbols-outlined notranslate animate-spin text-blue-500" translate="no">progress_activity</span>
                                            Đang tải dữ liệu định danh...
                                        </div>
                                    </td>
                                </tr>
                            ) : roles.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-8 text-center text-slate-500">
                                        Chưa thiết lập vai trò và phân quyền.
                                    </td>
                                </tr>
                            ) : (
                                roles.map((role) => (
                                    <tr key={role.code} className="hover:bg-blue-50/50 dark:hover:bg-slate-700/30 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-start gap-3">
                                                <div className="mt-1 w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
                                                    <span className="material-symbols-outlined notranslate text-[18px]" translate="no">verified_user</span>
                                                </div>
                                                <div>
                                                    <div className="font-bold text-slate-800 dark:text-slate-100 text-[14px]">
                                                        {role.name}
                                                    </div>
                                                    <div className="text-[11px] font-bold text-blue-500 uppercase tracking-widest mt-1">
                                                        {role.code}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-[13px] text-slate-600 dark:text-slate-400">
                                            {role.description}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="inline-flex items-baseline gap-1 font-semibold text-slate-700 dark:text-slate-300">
                                                <span className="text-base">{roleCounts[role.code] || 0}</span>
                                                <span className="text-[12px] font-normal text-slate-500">người</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="inline-flex flex-shrink-0 items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                                                Hoạt động
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex items-center justify-center gap-1 opacity-100 transition-opacity">
                                                <button onClick={() => handleOpenPermissions(role)} className="w-8 h-8 rounded-lg flex items-center justify-center text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors bg-blue-50 dark:bg-blue-900/10" title="Phân quyền chi tiết">
                                                    <span className="material-symbols-outlined notranslate text-[18px]" translate="no">tune</span>
                                                </button>
                                                <button onClick={() => handleOpenRoleModal(role)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:text-amber-400 dark:hover:bg-amber-900/30 transition-colors" title="Chỉnh sửa">
                                                    <span className="material-symbols-outlined notranslate text-[18px]" translate="no">edit</span>
                                                </button>
                                                {role.code !== 'ROLE01' && (
                                                    <button onClick={() => handleDeleteRole(role.code)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/30 transition-colors" title="Xóa">
                                                        <span className="material-symbols-outlined notranslate text-[18px]" translate="no">delete</span>
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Role Modal */}
            {isRoleModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-slide-in">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
                            <h3 className="font-bold text-lg">{editingRole ? 'Sửa Vai trò' : 'Thêm Vai trò mới'}</h3>
                            <button onClick={() => setIsRoleModalOpen(false)} className="text-slate-400 hover:text-slate-600"><span className="material-symbols-outlined notranslate">close</span></button>
                        </div>
                        <form onSubmit={handleSaveRole} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Mã Vai trò (Ví dụ: KETOAN)</label>
                                <input required disabled={!!editingRole} type="text" value={roleForm.code} onChange={e => setRoleForm({...roleForm, code: e.target.value.toUpperCase()})} className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700 disabled:opacity-50" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Tên Vai trò</label>
                                <input required type="text" value={roleForm.name} onChange={e => setRoleForm({...roleForm, name: e.target.value})} className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Mô tả</label>
                                <textarea value={roleForm.description} onChange={e => setRoleForm({...roleForm, description: e.target.value})} className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700 h-24"></textarea>
                            </div>
                            <div className="pt-2 flex justify-end gap-3">
                                <button type="button" onClick={() => setIsRoleModalOpen(false)} className="px-4 py-2 rounded-lg text-slate-500 hover:bg-slate-100 font-medium">Hủy</button>
                                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm">Lưu Vai trò</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Permissions Matrix Modal */}
            {isPermissionModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-slide-in">
                        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                            <div>
                                <h3 className="font-bold text-xl text-slate-800 dark:text-white">Kiểm soát phân quyền</h3>
                                <p className="text-sm text-slate-500 mt-1">Đang cấu hình quyền cho vai trò: <span className="font-bold text-blue-600 dark:text-blue-400">{selectedRoleForPerm?.name} ({selectedRoleForPerm?.code})</span></p>
                            </div>
                            <button onClick={() => setIsPermissionModalOpen(false)} className="w-8 h-8 bg-white dark:bg-slate-700 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-800 shadow-sm border border-slate-200 dark:border-slate-600"><span className="material-symbols-outlined notranslate text-[18px]">close</span></button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 dark:bg-slate-900">
                            {Object.keys(permsByModule).length === 0 ? (
                                <div className="text-center py-10 text-slate-500">Chưa có dữ liệu Permissions table. Vui lòng chạy Migration SQL.</div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {Object.entries(permsByModule).map(([module, perms]) => {
                                        const modulePermCodes = perms.map(p => p.code);
                                        const allChecked = modulePermCodes.every(code => rolePermissions.includes(code));
                                        
                                        return (
                                            <div key={module} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                                                <div className="px-4 py-3 bg-slate-100/50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                                                    <h4 className="font-bold text-sm text-slate-700 dark:text-slate-300 uppercase tracking-wider">{module}</h4>
                                                    <button 
                                                        onClick={() => toggleModule(module, perms)}
                                                        className={`text-xs font-semibold px-2 py-1 rounded-md transition-colors ${allChecked ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400'}`}
                                                    >
                                                        {allChecked ? 'Bỏ chọn' : 'Chọn tất cả'}
                                                    </button>
                                                </div>
                                                <div className="p-2">
                                                    {perms.map(perm => (
                                                        <label key={perm.code} className="flex items-start gap-3 p-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg cursor-pointer transition-colors group">
                                                            <div className="pt-0.5">
                                                                <input 
                                                                    type="checkbox" 
                                                                    checked={rolePermissions.includes(perm.code)}
                                                                    onChange={() => togglePermission(perm.code)}
                                                                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700" 
                                                                />
                                                            </div>
                                                            <div>
                                                                <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{perm.name}</div>
                                                                <div className="text-[11px] text-slate-500 line-clamp-2 mt-0.5 leading-snug">{perm.description}</div>
                                                            </div>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 bg-white dark:bg-slate-900">
                            <button onClick={() => setIsPermissionModalOpen(false)} className="px-5 py-2.5 rounded-xl text-slate-600 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">Hủy bỏ</button>
                            <button 
                                onClick={handleSavePermissions}
                                disabled={isSavingPerms} 
                                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center gap-2 shadow-lg shadow-blue-500/20 active:scale-95 transition-all disabled:opacity-70"
                            >
                                {isSavingPerms ? <span className="material-symbols-outlined notranslate animate-spin" translate="no">sync</span> : <span className="material-symbols-outlined notranslate" translate="no">save</span>}
                                Áp dụng quyền hạn
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
