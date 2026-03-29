import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { logAudit } from '../lib/auditLog';
import SearchableSelect from './common/SearchableSelect';
import { smartToast } from '../utils/globalToast';

export default function UserManagement() {
    const { hasPermission, profile: currentProfile } = useAuth();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [form, setForm] = useState({ full_name: '', email: '', password: '', role_code: 'GUEST', status: 'Hoạt động' });
    const [isSaving, setIsSaving] = useState(false);

    // Assignment modal
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [transferUser, setTransferUser] = useState(null);
    const [transferProjectId, setTransferProjectId] = useState('');
    const [transferNotes, setTransferNotes] = useState('');
    const [allAssignments, setAllAssignments] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [isTransferring, setIsTransferring] = useState(false);

    const canTransfer = hasPermission('manage_staff_assignment') || currentProfile?.role_code === 'ROLE01';

    // ── React Query: Users, Roles, Projects ──
    const { data: queryData, isLoading, refetch: fetchData } = useQuery({
        queryKey: ['userManagementData'],
        queryFn: async () => {
            const [rolesRes, projRes] = await Promise.all([
                supabase.from('roles').select('*').order('name'),
                supabase.from('projects').select('id, name, code, internal_code').order('name')
            ]);

            let usersData;
            const { data: d1, error: e1 } = await supabase.from('profiles')
                .select('*, roles:role_code (name), current_project:current_project_id (id, name, code, internal_code)')
                .order('created_at', { ascending: false });
            if (e1) {
                const { data: d2 } = await supabase.from('profiles')
                    .select('*, roles:role_code (name)')
                    .order('created_at', { ascending: false });
                usersData = d2 || [];
            } else {
                usersData = d1 || [];
            }

            const { data: assignData } = await supabase.from('staff_assignments')
                .select('user_id, project_id, project:project_id (id, name, code, internal_code)')
                .is('end_date', null);
            
            const assignMap = {};
            (assignData || []).forEach(a => {
                if (!assignMap[a.user_id]) assignMap[a.user_id] = [];
                assignMap[a.user_id].push(a.project);
            });
            
            usersData.forEach(u => { u.active_projects = assignMap[u.id] || []; });

            return {
                users: usersData,
                roles: rolesRes.data || [],
                projects: projRes.data || []
            };
        },
        staleTime: 5 * 60 * 1000,
    });

    const users = queryData?.users || [];
    const roles = queryData?.roles || [];
    const projects = queryData?.projects || [];

    const handleOpenModal = (user = null) => {
        if (user) {
            setEditingUser(user);
            setForm({ full_name: user.full_name || '', email: user.email || '', password: '', role_code: user.role_code || 'GUEST', status: user.status || 'Hoạt động' });
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
                    full_name: form.full_name, role_code: form.role_code, status: form.status, updated_at: new Date().toISOString()
                }).eq('id', editingUser.id);
                if (error) throw error;
                smartToast('Cập nhật thông tin thành công!');
            } else {
                if (!form.password || form.password.length < 6) throw new Error('Mật khẩu phải dài ít nhất 6 ký tự.');
                const { data, error } = await supabase.rpc('admin_create_user', { p_email: form.email, p_password: form.password, p_full_name: form.full_name, p_role_code: form.role_code });
                if (error) throw error;
                if (data && data.success === false) throw new Error(data.error || 'Lỗi tạo người dùng.');
                smartToast('Thêm tài khoản mới thành công!');
            }
            setIsModalOpen(false);
            fetchData();
        } catch (err) { smartToast('Lỗi: ' + err.message); } finally { setIsSaving(false); }
    };

    const handleToggleStatus = async (user) => {
        const newStatus = user.status === 'Hoạt động' ? 'Khóa' : 'Hoạt động';
        if (window.confirm(`Đổi trạng thái ${user.email} thành ${newStatus}?`)) {
            const { error } = await supabase.from('profiles').update({ status: newStatus }).eq('id', user.id);
            if (error) smartToast('Lỗi: ' + error.message);
            else fetchData();
        }
    };

    // =================== ASSIGNMENT (Multi-project) ===================
    const openAssignModal = async (user) => {
        setTransferUser(user);
        setTransferProjectId('');
        setTransferNotes('');
        setShowTransferModal(true);
        setLoadingHistory(true);

        const { data } = await supabase
            .from('staff_assignments')
            .select('*, project:project_id (name, code, internal_code)')
            .eq('user_id', user.id)
            .order('assigned_date', { ascending: false });

        const assignments = data || [];
        if (assignments.length > 0) {
            const ids = [...new Set(assignments.map(a => a.assigned_by).filter(Boolean))];
            if (ids.length > 0) {
                const { data: p } = await supabase.from('profiles').select('id, full_name').in('id', ids);
                const m = {}; (p || []).forEach(x => { m[x.id] = x.full_name; });
                assignments.forEach(a => { a.assigner_name = m[a.assigned_by] || ''; });
            }
        }
        setAllAssignments(assignments);
        setLoadingHistory(false);
    };

    const activeAssignments = allAssignments.filter(a => !a.end_date);
    const pastAssignments = allAssignments.filter(a => a.end_date);
    const activeProjectIds = activeAssignments.map(a => a.project_id);

    // Thêm dự án
    const handleAddProject = async () => {
        if (!transferProjectId) { smartToast('Chọn dự án'); return; }
        if (activeProjectIds.includes(transferProjectId)) { smartToast('Đã ở dự án này rồi!'); return; }
        setIsTransferring(true);
        try {
            const proj = projects.find(p => p.id === transferProjectId);
            const { error: insErr } = await supabase.from('staff_assignments').insert([{
                user_id: transferUser.id,
                project_id: transferProjectId,
                assigned_date: new Date().toISOString().split('T')[0],
                assigned_by: currentProfile?.id || null,
                notes: transferNotes || `Gán vào ${proj?.internal_code || ''}`
            }]);
            if (insErr) throw insErr;
            const { error: updErr } = await supabase.from('profiles').update({ current_project_id: transferProjectId }).eq('id', transferUser.id);
            if (updErr) console.warn('Update profile err:', updErr);
            setTransferProjectId('');
            setTransferNotes('');
            // Reload assignments
            const { data: freshAssign } = await supabase.from('staff_assignments')
                .select('*, project:project_id (name, code, internal_code)')
                .eq('user_id', transferUser.id)
                .order('assigned_date', { ascending: false });
            setAllAssignments(freshAssign || []);
            fetchData();
        } catch (err) { smartToast('Lỗi thêm dự án: ' + err.message); }
        finally { setIsTransferring(false); }
    };

    // Rút khỏi dự án — no confirm dialog, direct action
    const handleRemoveProject = async (assignmentId, projectCode) => {
        setIsTransferring(true);
        try {
            const { error: rmErr } = await supabase.from('staff_assignments')
                .update({ end_date: new Date().toISOString().split('T')[0] })
                .eq('id', assignmentId);
            if (rmErr) throw rmErr;
            const remaining = activeAssignments.filter(a => a.id !== assignmentId);
            await supabase.from('profiles').update({ current_project_id: remaining.length > 0 ? remaining[0].project_id : null }).eq('id', transferUser.id);
            const { data: freshAssign } = await supabase.from('staff_assignments')
                .select('*, project:project_id (name, code, internal_code)')
                .eq('user_id', transferUser.id)
                .order('assigned_date', { ascending: false });
            setAllAssignments(freshAssign || []);
            fetchData();
        } catch (err) { smartToast('Lỗi rút dự án: ' + err.message); }
        finally { setIsTransferring(false); }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-white">Quản lý người dùng</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Quản lý nhân sự, phân quyền và gán dự án.</p>
                </div>
                <button onClick={() => handleOpenModal()} className="h-10 flex items-center gap-2 px-4 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 active:scale-95 transition-all shadow-sm">
                    <span className="material-symbols-outlined notranslate text-[18px]" translate="no">person_add</span>
                    Thêm người dùng
                </button>
            </div>

            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-700 text-[11px] uppercase tracking-wider text-slate-500 font-bold">
                                <th className="px-6 py-4">Người dùng</th>
                                <th className="px-6 py-4">Vai trò</th>
                                <th className="px-6 py-4">Dự án hiện tại</th>
                                <th className="px-6 py-4 text-center">Trạng thái</th>
                                <th className="px-6 py-4 text-center">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                            {isLoading ? (
                                <tr><td colSpan="5" className="px-6 py-12 text-center text-slate-500 animate-pulse">Đang tải...</td></tr>
                            ) : users.length === 0 ? (
                                <tr><td colSpan="5" className="px-6 py-12 text-center text-slate-400">Chưa có người dùng</td></tr>
                            ) : (
                                users.map(user => (
                                    <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center overflow-hidden border border-slate-200">
                                                    {user.avatar_url ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="material-symbols-outlined notranslate text-slate-400" translate="no">person</span>}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-slate-800 dark:text-slate-100">{user.full_name || 'Chưa cập nhật'}</div>
                                                    <div className="text-xs text-slate-500">{user.email || 'N/A'}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[12px] font-medium bg-blue-50 text-blue-700 border border-blue-100">
                                                {user.roles?.name || user.role_code || 'GUEST'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            {user.active_projects && user.active_projects.length > 0 ? (
                                                <div className="flex flex-wrap gap-1.5">
                                                    {user.active_projects.map((p, i) => (
                                                        <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-orange-50 text-orange-700 border border-orange-200">
                                                            <span className="material-symbols-outlined notranslate text-[12px]" translate="no">location_on</span>
                                                            {p?.internal_code || p?.code || '?'}
                                                        </span>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="text-xs text-slate-400 italic">Chưa gán</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button onClick={() => handleToggleStatus(user)}
                                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${user.status === 'Hoạt động' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${user.status === 'Hoạt động' ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                                                {user.status || 'Khóa'}
                                            </button>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                <button onClick={() => handleOpenModal(user)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Sửa">
                                                    <span className="material-symbols-outlined notranslate text-[18px]" translate="no">edit</span>
                                                </button>
                                                {canTransfer && (
                                                    <button onClick={() => openAssignModal(user)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-orange-600 hover:bg-orange-50 transition-colors" title="Gán dự án">
                                                        <span className="material-symbols-outlined notranslate text-[18px]" translate="no">swap_horiz</span>
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

            {/* Modal Edit User */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-slide-in">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                            <h3 className="font-bold text-lg">{editingUser ? 'Sửa thông tin' : 'Thêm người dùng'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600"><span className="material-symbols-outlined notranslate">close</span></button>
                        </div>
                        <form onSubmit={handleSaveUser} className="p-6 space-y-4">
                            {!editingUser && <div className="p-3 bg-blue-50 border border-blue-200 text-blue-700 text-[12px] font-medium rounded-lg">Tài khoản mới sẽ được cấp quyền truy cập ngay.</div>}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Họ Tên</label>
                                <input required type="text" value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} className="w-full px-3 py-2.5 border rounded-xl dark:bg-slate-800 dark:border-slate-700" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Email</label>
                                <input required disabled={!!editingUser} type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="w-full px-3 py-2.5 border rounded-xl disabled:opacity-50 disabled:bg-slate-50" />
                            </div>
                            {!editingUser && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Mật khẩu</label>
                                    <input required minLength={6} type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} className="w-full px-3 py-2.5 border rounded-xl" placeholder="••••••••" />
                                </div>
                            )}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Vai trò</label>
                                <select value={form.role_code} onChange={e => setForm({...form, role_code: e.target.value})} className="w-full px-3 py-2.5 border rounded-xl bg-white">
                                    <option value="GUEST">GUEST</option>
                                    {roles.map(r => <option key={r.code} value={r.code}>{r.name} ({r.code})</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Trạng thái</label>
                                <select value={form.status} onChange={e => setForm({...form, status: e.target.value})} className="w-full px-3 py-2.5 border rounded-xl bg-white">
                                    <option value="Hoạt động">Hoạt động</option>
                                    <option value="Khóa">Khóa</option>
                                </select>
                            </div>
                            <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 rounded-xl text-slate-500 hover:bg-slate-100 font-medium">Hủy</button>
                                <button type="submit" disabled={isSaving} className="px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium shadow-sm active:scale-95 disabled:opacity-70 flex items-center gap-2">
                                    {isSaving && <span className="material-symbols-outlined notranslate animate-spin" translate="no">sync</span>}
                                    {editingUser ? 'Lưu' : 'Tạo tài khoản'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Gán dự án (Multi-project) */}
            {showTransferModal && transferUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-slide-in flex flex-col max-h-[90vh]">
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-slate-100 bg-orange-50/50 shrink-0">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1">Nhân sự › Gán dự án</div>
                                    <h3 className="font-bold text-lg text-slate-800">{transferUser.full_name}</h3>
                                    <p className="text-xs text-slate-500">{transferUser.roles?.name || transferUser.role_code} • {transferUser.email}</p>
                                </div>
                                <button onClick={() => setShowTransferModal(false)} className="w-9 h-9 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400">
                                    <span className="material-symbols-outlined notranslate text-[20px]" translate="no">close</span>
                                </button>
                            </div>
                        </div>

                        <div className="p-6 space-y-5 overflow-y-auto">
                            {/* Active projects */}
                            <div className="space-y-2">
                                <h4 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-2">
                                    <span className="material-symbols-outlined notranslate text-[14px]" translate="no">location_on</span>
                                    Đang ở ({activeAssignments.length} dự án)
                                </h4>
                                {loadingHistory ? (
                                    <div className="text-xs text-slate-400 animate-pulse py-3 text-center">Đang tải...</div>
                                ) : activeAssignments.length === 0 ? (
                                    <div className="text-xs text-slate-400 italic py-3 text-center bg-slate-50 rounded-xl">Chưa gán dự án nào</div>
                                ) : (
                                    <div className="space-y-2">
                                        {activeAssignments.map(a => (
                                            <div key={a.id} className="px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <span className="material-symbols-outlined notranslate text-emerald-500 text-[18px]" translate="no">check_circle</span>
                                                        <div className="font-bold text-sm text-slate-800">{a.project?.internal_code || a.project?.code}</div>
                                                    </div>
                                                    <span
                                                        role="button"
                                                        tabIndex={0}
                                                        onClick={() => handleRemoveProject(a.id, a.project?.internal_code || a.project?.code)}
                                                        className="text-[11px] font-bold text-red-500 hover:text-red-700 cursor-pointer select-none px-2 py-1 rounded hover:bg-red-50"
                                                    >Rút</span>
                                                </div>
                                                <div className="text-[10px] text-slate-500 mt-1 ml-7">Từ {a.assigned_date} {a.assigner_name && `• bởi ${a.assigner_name}`}</div>
                                                {a.notes && <div className="text-[11px] text-orange-600 font-medium mt-1 ml-7 italic">{a.notes}</div>}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Add new project */}
                            <div className="space-y-2 p-4 bg-blue-50/50 rounded-xl border border-blue-100">
                                <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-2">
                                    <span className="material-symbols-outlined notranslate text-[14px]" translate="no">add_circle</span>
                                    Thêm dự án
                                </h4>
                                <SearchableSelect
                                    options={projects.filter(p => !activeProjectIds.includes(p.id)).map(p => ({
                                        id: p.id,
                                        label: p.internal_code || p.code,
                                        subLabel: p.name
                                    }))}
                                    value={transferProjectId}
                                    onChange={(val) => setTransferProjectId(val)}
                                    placeholder="Tìm và chọn dự án..."
                                />
                                <input value={transferNotes} onChange={(e) => setTransferNotes(e.target.value)}
                                    placeholder="VD: Chính / Hỗ trợ / Luân chuyển Q2..."
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-white text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                                <button onClick={handleAddProject} disabled={!transferProjectId || isTransferring}
                                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm shadow-sm active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                                    {isTransferring ? <><span className="material-symbols-outlined notranslate animate-spin text-[16px]" translate="no">sync</span>Đang xử lý...</>
                                        : <><span className="material-symbols-outlined notranslate text-[16px]" translate="no">add</span>Thêm dự án</>}
                                </button>
                            </div>

                            {/* Past assignments */}
                            {pastAssignments.length > 0 && (
                                <div className="space-y-2">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        <span className="material-symbols-outlined notranslate text-[14px]" translate="no">history</span>
                                        Lịch sử ({pastAssignments.length})
                                    </h4>
                                    <div className="max-h-[150px] overflow-y-auto space-y-1 pr-1">
                                        {pastAssignments.map(h => (
                                            <div key={h.id} className="flex items-start gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-100 text-xs">
                                                <span className="material-symbols-outlined text-slate-400 text-[14px] mt-0.5 shrink-0" translate="no">check_circle</span>
                                                <div className="flex-1 min-w-0">
                                                    <span className="font-bold text-slate-600">{h.project?.internal_code || h.project?.code}</span>
                                                    <span className="text-slate-400 ml-2">{h.assigned_date} → {h.end_date}</span>
                                                    {h.assigner_name && <span className="text-slate-400 ml-2">bởi {h.assigner_name}</span>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-3 border-t border-slate-100 shrink-0 flex justify-end">
                            <button onClick={() => setShowTransferModal(false)} className="px-5 py-2 rounded-xl text-slate-500 hover:bg-slate-100 font-medium text-sm">Đóng</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
