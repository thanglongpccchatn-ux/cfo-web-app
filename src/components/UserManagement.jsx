import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function UserManagement() {
    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [form, setForm] = useState({ full_name: '', email: '', password: '', role_code: 'GUEST', status: 'Hoạt động' });
    const [isSaving, setIsSaving] = useState(false);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [usersRes, rolesRes] = await Promise.all([
                supabase.from('profiles').select('*, roles:role_code (name)').order('created_at', { ascending: false }),
                supabase.from('roles').select('*').order('name')
            ]);
            if (usersRes.error) throw usersRes.error;
            setUsers(usersRes.data || []);
            setRoles(rolesRes.data || []);
        } catch (error) {
            console.error('Error fetching data:', error);
            alert('Không thể tải danh sách người dùng.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleOpenModal = (user = null) => {
        if (user) {
            setEditingUser(user);
            setForm({
                full_name: user.full_name || '',
                email: user.email || '',
                password: '', // Password is only for creating new users
                role_code: user.role_code || 'GUEST',
                status: user.status || 'Hoạt động'
            });
        } else {
            setEditingUser(null);
            setForm({ full_name: '', email: '', password: '', role_code: 'GUEST', status: 'Hoạt động' });
        }
        setIsModalOpen(true);
    };

    const handleSaveUser = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            if (editingUser) {
                const { error } = await supabase.from('profiles').update({
                    full_name: form.full_name,
                    role_code: form.role_code,
                    status: form.status,
                    updated_at: new Date().toISOString()
                }).eq('id', editingUser.id);
                if (error) throw error;
                alert('Cập nhật thông tin thành công!');
            } else {
                // Call the admin creation RPC
                if (!form.password || form.password.length < 6) {
                    throw new Error('Mật khẩu khởi tạo phải dài ít nhất 6 ký tự.');
                }
                const { data, error } = await supabase.rpc('admin_create_user', {
                    p_email: form.email,
                    p_password: form.password,
                    p_full_name: form.full_name,
                    p_role_code: form.role_code
                });
                
                if (error) throw error;
                
                if (data && data.success === false) {
                    throw new Error(data.error || 'Lỗi không xác định khi tạo người dùng.');
                }
                alert('Thêm tài khoản mới thành công! Người dùng có thể đăng nhập ngay.');
            }
            setIsModalOpen(false);
            fetchData();
        } catch (err) {
            alert('Lỗi lưu thông tin: ' + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleToggleStatus = async (user) => {
        const newStatus = user.status === 'Hoạt động' ? 'Khóa' : 'Hoạt động';
        if(window.confirm(`Bạn muốn đổi trạng thái tài khoản ${user.email} thành ${newStatus}?`)) {
            const { error } = await supabase.from('profiles').update({ status: newStatus }).eq('id', user.id);
            if (error) alert('Lỗi: ' + error.message);
            else fetchData();
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-white">Quản lý người dùng</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Quản lý danh sách nhân sự và tài khoản truy cập hệ thống.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={() => handleOpenModal()} className="h-10 flex items-center gap-2 px-4 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 active:scale-95 transition-all shadow-sm">
                        <span className="material-symbols-outlined notranslate text-[18px]" translate="no">person_add</span>
                        Thêm người dùng
                    </button>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-700 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">
                                <th className="px-6 py-4">NGƯỜI DÙNG</th>
                                <th className="px-6 py-4">VAI TRÒ</th>
                                <th className="px-6 py-4 text-center">TRẠNG THÁI</th>
                                <th className="px-6 py-4 text-center">NGÀY TẠO</th>
                                <th className="px-6 py-4 text-center">THAO TÁC</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                            {isLoading ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center text-slate-500">
                                        <div className="flex items-center justify-center gap-2">
                                            <span className="material-symbols-outlined notranslate animate-spin text-blue-500" translate="no">progress_activity</span>
                                            Đang tải danh sách người dùng...
                                        </div>
                                    </td>
                                </tr>
                            ) : users.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center text-slate-500">
                                        <div className="flex flex-col items-center gap-2">
                                            <span className="material-symbols-outlined notranslate text-4xl text-slate-300" translate="no">group_off</span>
                                            <p>Chưa có người dùng nào trong hệ thống.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                users.map((user) => (
                                    <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400 overflow-hidden border border-slate-200 dark:border-slate-600">
                                                    {user.avatar_url ? (
                                                        <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <span className="material-symbols-outlined notranslate" translate="no">person</span>
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-slate-800 dark:text-slate-100">
                                                        {user.full_name || 'Chưa cập nhật'}
                                                    </div>
                                                    <div className="text-xs text-slate-500 dark:text-slate-400">
                                                        {user.email || 'N/A'}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[12px] font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800">
                                                {user.roles?.name || user.role_code || 'GUEST'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button 
                                                onClick={() => handleToggleStatus(user)}
                                                className={`inline-flex hover:scale-105 transition-transform items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${user.status === 'Hoạt động'
                                                    ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20'
                                                    : 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-500/20'
                                                }`}
                                            >
                                                <span className={`w-1.5 h-1.5 rounded-full ${user.status === 'Hoạt động' ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                                                {user.status || 'Khóa'}
                                            </button>
                                        </td>
                                        <td className="px-6 py-4 text-center text-xs text-slate-500 dark:text-slate-400">
                                            {user.created_at ? new Date(user.created_at).toLocaleDateString('vi-VN') : '-'}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex items-center justify-center gap-1 opacity-100 transition-opacity">
                                                <button onClick={() => handleOpenModal(user)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:text-blue-400 dark:hover:bg-blue-900/30 transition-colors" title="Chỉnh sửa">
                                                    <span className="material-symbols-outlined notranslate text-[18px]" translate="no">edit</span>
                                                </button>
                                                {user.status === 'Hoạt động' && (
                                                    <button onClick={() => handleToggleStatus(user)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:text-amber-400 dark:hover:bg-amber-900/30 transition-colors" title="Khóa tài khoản">
                                                        <span className="material-symbols-outlined notranslate text-[18px]" translate="no">block</span>
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

            {/* Modal Edit */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-slide-in">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
                            <h3 className="font-bold text-lg">{editingUser ? 'Sửa thông tin Người dùng' : 'Thêm Người dùng (Hồ sơ)'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600"><span className="material-symbols-outlined notranslate">close</span></button>
                        </div>
                        <form onSubmit={handleSaveUser} className="p-6 space-y-4">
                            {!editingUser && (
                                <div className="p-3 bg-blue-50 border border-blue-200 text-blue-700 text-[12px] font-medium rounded-lg mb-2 leading-relaxed">
                                    <span className="font-bold">Hệ thống tạo tự động:</span> Tài khoản mới sẽ được cấp quyền truy cập ngay lập tức vào Admin Dashboard.
                                </div>
                            )}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Họ Tên</label>
                                <input required type="text" value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} className="w-full px-3 py-2.5 border rounded-xl dark:bg-slate-800 dark:border-slate-700" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Email / Tài khoản đăng nhập</label>
                                <input required disabled={!!editingUser} type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="w-full px-3 py-2.5 border rounded-xl dark:bg-slate-800 dark:border-slate-700 disabled:opacity-50 disabled:bg-slate-50" />
                            </div>
                            {!editingUser && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Mật khẩu khởi tạo</label>
                                    <input required minLength={6} type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} className="w-full px-3 py-2.5 border rounded-xl dark:bg-slate-800 dark:border-slate-700" placeholder="••••••••" />
                                </div>
                            )}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Gán Vai Trò (Phân Quyền)</label>
                                <select value={form.role_code} onChange={e => setForm({...form, role_code: e.target.value})} className="w-full px-3 py-2.5 border rounded-xl dark:bg-slate-800 dark:border-slate-700 bg-white dark:bg-slate-800">
                                    <option value="GUEST">GUEST (Không có quyền)</option>
                                    {roles.map(r => (
                                        <option key={r.code} value={r.code}>{r.name} ({r.code})</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Trạng thái hệ thống</label>
                                <select value={form.status} onChange={e => setForm({...form, status: e.target.value})} className="w-full px-3 py-2.5 border rounded-xl dark:bg-slate-800 dark:border-slate-700 bg-white dark:bg-slate-800">
                                    <option value="Hoạt động">Cho phép truy cập (Hoạt động)</option>
                                    <option value="Khóa">Chặn truy cập (Khóa)</option>
                                </select>
                            </div>
                            
                            <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
                                <button type="button" disabled={isSaving} onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 rounded-xl text-slate-500 hover:bg-slate-100 font-medium transition-colors disabled:opacity-50">Hủy</button>
                                <button type="submit" disabled={isSaving} className="px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium shadow-sm active:scale-95 transition-all disabled:opacity-70 flex items-center gap-2">
                                    {isSaving && <span className="material-symbols-outlined notranslate animate-spin" translate="no">sync</span>}
                                    {editingUser ? 'Lưu Thông Tin' : 'Tạo Tài Khoản'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
