import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

// ─── Constants ───────────────────────────────────────────────
const STATUSES = [
    { id: 'todo', label: 'Cần làm', icon: 'radio_button_unchecked', color: 'slate', bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-600', accent: '#64748b' },
    { id: 'in_progress', label: 'Đang làm', icon: 'pending', color: 'blue', bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-600', accent: '#3b82f6' },
    { id: 'review', label: 'Chờ duyệt', icon: 'visibility', color: 'amber', bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-600', accent: '#f59e0b' },
    { id: 'done', label: 'Hoàn thành', icon: 'check_circle', color: 'emerald', bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-600', accent: '#10b981' },
];

const PRIORITIES = [
    { id: 'urgent', label: 'Khẩn cấp', icon: 'error', color: 'text-rose-500', bg: 'bg-rose-100 dark:bg-rose-900/30', border: 'border-l-rose-500' },
    { id: 'high', label: 'Cao', icon: 'arrow_upward', color: 'text-amber-500', bg: 'bg-amber-100 dark:bg-amber-900/30', border: 'border-l-amber-500' },
    { id: 'medium', label: 'Trung bình', icon: 'remove', color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30', border: 'border-l-blue-500' },
    { id: 'low', label: 'Thấp', icon: 'arrow_downward', color: 'text-slate-400', bg: 'bg-slate-100 dark:bg-slate-800', border: 'border-l-slate-300' },
];

const VIEWS = [
    { id: 'kanban', icon: 'view_kanban', label: 'Kanban' },
    { id: 'calendar', icon: 'calendar_month', label: 'Lịch' },
    { id: 'list', icon: 'view_list', label: 'Danh sách' },
    { id: 'timeline', icon: 'view_timeline', label: 'Timeline' },
];

const getPriority = (id) => PRIORITIES.find(p => p.id === id) || PRIORITIES[2];
const getStatus = (id) => STATUSES.find(s => s.id === id) || STATUSES[0];

// ─── Main Component ──────────────────────────────────────────
export default function TaskManagement() {
    const { profile } = useAuth();
    const [tasks, setTasks] = useState([]);
    const [projects, setProjects] = useState([]);
    const [users, setUsers] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeView, setActiveView] = useState('kanban');
    const [showModal, setShowModal] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    const [detailTask, setDetailTask] = useState(null);
    const [filters, setFilters] = useState({ project_id: '', assigned_to: '', priority: '', category_id: '', search: '' });
    const [draggedTask, setDraggedTask] = useState(null);
    const [calendarDate, setCalendarDate] = useState(new Date());

    // ─── Fetch Data ──────────────────────────────────────────
    useEffect(() => {
        fetchAll();
    }, []);

    const fetchAll = async () => {
        setLoading(true);
        const [{ data: t }, { data: p }, { data: u }, { data: c }] = await Promise.all([
            supabase.from('tasks').select('*').order('sort_order', { ascending: true }),
            supabase.from('projects').select('id, name, code'),
            supabase.from('profiles').select('id, full_name, avatar_url, roles:role_code(name)').order('full_name', { ascending: true }),
            supabase.from('task_categories').select('*').order('sort_order', { ascending: true }),
        ]);
        setTasks(t || []);
        setProjects(p || []);
        setUsers(u || []);
        setCategories(c || []);
        setLoading(false);
    };

    // ─── Category CRUD ──────────────────────────────────────
    const addCategory = async (name) => {
        const { data, error } = await supabase.from('task_categories').insert({
            name, sort_order: categories.length + 1,
        }).select().single();
        if (!error && data) setCategories(prev => [...prev, data]);
        return data;
    };

    // ─── Filtered Tasks ─────────────────────────────────────
    const filteredTasks = useMemo(() => {
        return tasks.filter(t => {
            if (filters.project_id && t.project_id !== filters.project_id) return false;
            if (filters.assigned_to && t.assigned_to !== filters.assigned_to) return false;
            if (filters.priority && t.priority !== filters.priority) return false;
            if (filters.category_id && t.category_id !== filters.category_id) return false;
            if (filters.search && !t.title.toLowerCase().includes(filters.search.toLowerCase())) return false;
            return true;
        });
    }, [tasks, filters]);

    // ─── KPIs ────────────────────────────────────────────────
    const kpis = useMemo(() => {
        const total = filteredTasks.length;
        const done = filteredTasks.filter(t => t.status === 'done').length;
        const overdue = filteredTasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done').length;
        const inProgress = filteredTasks.filter(t => t.status === 'in_progress').length;
        const progress = total > 0 ? Math.round((done / total) * 100) : 0;
        return { total, done, overdue, inProgress, progress };
    }, [filteredTasks]);

    // ─── CRUD ────────────────────────────────────────────────
    const saveTask = async (taskData) => {
        if (taskData.id) {
            const { error } = await supabase.from('tasks').update(taskData).eq('id', taskData.id);
            if (!error) setTasks(prev => prev.map(t => t.id === taskData.id ? { ...t, ...taskData } : t));
        } else {
            const { data, error } = await supabase.from('tasks').insert({
                ...taskData,
                assigned_by: profile?.user_id,
                sort_order: tasks.filter(t => t.status === (taskData.status || 'todo')).length,
            }).select().single();
            if (!error && data) setTasks(prev => [...prev, data]);
        }
        setShowModal(false);
        setEditingTask(null);
    };

    const deleteTask = async (id) => {
        const { error } = await supabase.from('tasks').delete().eq('id', id);
        if (!error) {
            setTasks(prev => prev.filter(t => t.id !== id));
            setDetailTask(null);
        }
    };

    const updateTaskStatus = async (taskId, newStatus) => {
        const updates = { status: newStatus };
        if (newStatus === 'done') updates.completed_at = new Date().toISOString();
        else updates.completed_at = null;
        const { error } = await supabase.from('tasks').update(updates).eq('id', taskId);
        if (!error) setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t));
    };

    const getUserName = (userId) => users.find(u => u.id === userId)?.full_name || '—';
    const getProjectName = (projectId) => projects.find(p => p.id === projectId)?.name || '';
    const getCategory = (categoryId) => categories.find(c => c.id === categoryId);

    // ─── Drag & Drop ─────────────────────────────────────────
    const handleDragStart = (e, task) => {
        setDraggedTask(task);
        e.dataTransfer.effectAllowed = 'move';
        e.target.style.opacity = '0.5';
    };
    const handleDragEnd = (e) => {
        e.target.style.opacity = '1';
        setDraggedTask(null);
    };
    const handleDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
    const handleDrop = (e, status) => {
        e.preventDefault();
        if (draggedTask && draggedTask.status !== status) {
            updateTaskStatus(draggedTask.id, status);
        }
    };

    // ═══════════════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════════════

    if (loading) return <LoadingSkeleton />;

    return (
        <div className="space-y-5 animate-fade-in">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard icon="assignment" label="Tổng công việc" value={kpis.total} color="blue" />
                <KpiCard icon="trending_up" label="Đang thực hiện" value={kpis.inProgress} color="indigo" />
                <KpiCard icon="warning" label="Quá hạn" value={kpis.overdue} color="rose" alert={kpis.overdue > 0} />
                <KpiCard icon="task_alt" label="Tiến độ" value={`${kpis.progress}%`} color="emerald" progress={kpis.progress} />
            </div>

            {/* Toolbar: Views + Filters + Add Button */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                {/* View Tabs */}
                <div className="flex items-center gap-1 bg-slate-100/80 dark:bg-slate-800/50 p-1 rounded-2xl border border-slate-200/50 dark:border-slate-700/30 shadow-sm">
                    {VIEWS.map(v => (
                        <button key={v.id} onClick={() => setActiveView(v.id)}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-bold transition-all cursor-pointer ${activeView === v.id
                                ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-700/50'}`}>
                            <span className="material-symbols-outlined text-[16px]">{v.icon}</span>
                            <span className="hidden sm:inline">{v.label}</span>
                        </button>
                    ))}
                </div>

                {/* Filters */}
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="relative">
                        <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[16px] text-slate-400">search</span>
                        <input type="text" placeholder="Tìm kiếm..." value={filters.search}
                            onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
                            className="pl-8 pr-3 py-2 text-[13px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white w-44 focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none" />
                    </div>
                    <select value={filters.category_id} onChange={e => setFilters(f => ({ ...f, category_id: e.target.value }))}
                        className="text-[13px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 outline-none cursor-pointer">
                        <option value="">Tất cả nhóm CV</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <select value={filters.project_id} onChange={e => setFilters(f => ({ ...f, project_id: e.target.value }))}
                        className="text-[13px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 outline-none cursor-pointer">
                        <option value="">Tất cả dự án</option>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <select value={filters.priority} onChange={e => setFilters(f => ({ ...f, priority: e.target.value }))}
                        className="text-[13px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 outline-none cursor-pointer">
                        <option value="">Tất cả ưu tiên</option>
                        {PRIORITIES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                    </select>

                    <button onClick={() => { setEditingTask(null); setShowModal(true); }}
                        className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-[13px] font-bold shadow-lg shadow-primary/20 transition-all cursor-pointer">
                        <span className="material-symbols-outlined text-[16px]">add</span> Tạo mới
                    </button>
                </div>
            </div>

            {/* Active View */}
            <div className="animate-fade-in">
                {activeView === 'kanban' && <KanbanBoard tasks={filteredTasks} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragOver={handleDragOver} onDrop={handleDrop} onEdit={t => { setEditingTask(t); setShowModal(true); }} onDetail={setDetailTask} getUserName={getUserName} getProjectName={getProjectName} getCategory={getCategory} />}
                {activeView === 'calendar' && <CalendarView tasks={filteredTasks} date={calendarDate} setDate={setCalendarDate} onEdit={t => { setEditingTask(t); setShowModal(true); }} onDetail={setDetailTask} />}
                {activeView === 'list' && <ListView tasks={filteredTasks} onEdit={t => { setEditingTask(t); setShowModal(true); }} onDetail={setDetailTask} getUserName={getUserName} getProjectName={getProjectName} onStatusChange={updateTaskStatus} getCategory={getCategory} />}
                {activeView === 'timeline' && <TimelineView tasks={filteredTasks} getUserName={getUserName} onDetail={setDetailTask} getCategory={getCategory} />}
            </div>

            {/* Modals */}
            {showModal && <TaskModal task={editingTask} projects={projects} users={users} categories={categories} onAddCategory={addCategory} onSave={saveTask} onClose={() => { setShowModal(false); setEditingTask(null); }} />}
            {detailTask && <TaskDetailDrawer task={detailTask} onClose={() => setDetailTask(null)} onEdit={t => { setDetailTask(null); setEditingTask(t); setShowModal(true); }} onDelete={deleteTask} getUserName={getUserName} getProjectName={getProjectName} getCategory={getCategory} profile={profile} />}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
// KPI CARD
// ═══════════════════════════════════════════════════════════════
function KpiCard({ icon, label, value, color, alert, progress }) {
    const colors = {
        blue: 'from-blue-500 to-blue-600',
        indigo: 'from-indigo-500 to-indigo-600',
        rose: 'from-rose-500 to-rose-600',
        emerald: 'from-emerald-500 to-emerald-600',
    };
    return (
        <div className={`relative bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200/50 dark:border-slate-700/50 shadow-sm overflow-hidden group hover:shadow-md transition-shadow ${alert ? 'ring-1 ring-rose-300 dark:ring-rose-800' : ''}`}>
            <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colors[color]} flex items-center justify-center shadow-lg shadow-${color}-500/20 group-hover:scale-105 transition-transform`}>
                    <span className="material-symbols-outlined text-white text-[20px]">{icon}</span>
                </div>
                <div>
                    <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest leading-none mb-1">{label}</p>
                    <h3 className="text-xl font-black text-slate-800 dark:text-white leading-none">{value}</h3>
                </div>
            </div>
            {progress !== undefined && (
                <div className="mt-3 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all duration-700" style={{ width: `${progress}%` }} />
                </div>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
// KANBAN BOARD
// ═══════════════════════════════════════════════════════════════
function KanbanBoard({ tasks, onDragStart, onDragEnd, onDragOver, onDrop, onEdit, onDetail, getUserName, getProjectName, getCategory }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {STATUSES.map(status => {
                const columnTasks = tasks.filter(t => t.status === status.id);
                return (
                    <div key={status.id}
                        className={`rounded-2xl border border-slate-200/50 dark:border-slate-700/30 ${status.bg} min-h-[400px] flex flex-col`}
                        onDragOver={onDragOver} onDrop={e => onDrop(e, status.id)}>
                        {/* Column Header */}
                        <div className="px-4 py-3 flex items-center justify-between border-b border-slate-200/30 dark:border-slate-700/30">
                            <div className="flex items-center gap-2">
                                <span className={`material-symbols-outlined text-[18px] ${status.text}`}>{status.icon}</span>
                                <span className="text-[13px] font-black text-slate-700 dark:text-white">{status.label}</span>
                                <span className="text-[11px] font-bold bg-white/60 dark:bg-slate-700/60 text-slate-500 px-2 py-0.5 rounded-full">{columnTasks.length}</span>
                            </div>
                        </div>
                        {/* Cards */}
                        <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[65vh] no-scrollbar">
                            {columnTasks.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                                    <span className="material-symbols-outlined text-3xl mb-2">inbox</span>
                                    <p className="text-[11px] font-bold">Chưa có công việc</p>
                                </div>
                            )}
                            {columnTasks.map(task => (
                                <TaskCard key={task.id} task={task} onDragStart={onDragStart} onDragEnd={onDragEnd} onEdit={onEdit} onDetail={onDetail} getUserName={getUserName} getProjectName={getProjectName} getCategory={getCategory} />
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
// TASK CARD (Kanban)
// ═══════════════════════════════════════════════════════════════
function TaskCard({ task, onDragStart, onDragEnd, onEdit, onDetail, getUserName, getProjectName, getCategory }) {
    const priority = getPriority(task.priority);
    const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done';
    const projectName = getProjectName(task.project_id);
    const category = getCategory(task.category_id);

    return (
        <div draggable onDragStart={e => onDragStart(e, task)} onDragEnd={onDragEnd}
            onClick={() => onDetail(task)}
            className={`bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200/50 dark:border-slate-700/30 p-3 cursor-pointer hover:shadow-md hover:border-primary/30 transition-all group border-l-[3px] ${priority.border} backdrop-blur-sm`}>
            {/* Category + Project badges */}
            <div className="flex items-center gap-1.5 flex-wrap">
                {category && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md inline-flex items-center gap-0.5" style={{ backgroundColor: category.color + '18', color: category.color }}>
                        <span className="material-symbols-outlined text-[10px]">{category.icon}</span>{category.name}
                    </span>
                )}
                {projectName && (
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{projectName}</span>
                )}
            </div>
            {/* Title */}
            <h4 className="text-[13px] font-bold text-slate-800 dark:text-white mt-1 leading-snug line-clamp-2">{task.title}</h4>
            {/* Tags */}
            {task.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                    {task.tags.slice(0, 3).map((tag, i) => (
                        <span key={i} className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-primary/10 text-primary">{tag}</span>
                    ))}
                </div>
            )}
            {/* Footer */}
            <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-1.5">
                    <span className={`material-symbols-outlined text-[14px] ${priority.color}`}>{priority.icon}</span>
                    {task.due_date && (
                        <span className={`text-[10px] font-bold flex items-center gap-0.5 ${isOverdue ? 'text-rose-500' : 'text-slate-400'}`}>
                            <span className="material-symbols-outlined text-[12px]">event</span>
                            {new Date(task.due_date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                        </span>
                    )}
                </div>
                {task.assigned_to && (
                    <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-600 bg-cover bg-center text-[8px] flex items-center justify-center font-black text-slate-500 dark:text-white"
                        title={getUserName(task.assigned_to)}
                        style={{ backgroundImage: `url('https://api.dicebear.com/7.x/avataaars/svg?seed=${task.assigned_to}')` }} />
                )}
            </div>
            {/* Edit button (hover) */}
            <button onClick={e => { e.stopPropagation(); onEdit(task); }}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-primary transition-all cursor-pointer">
                <span className="material-symbols-outlined text-[14px]">edit</span>
            </button>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
// CALENDAR VIEW
// ═══════════════════════════════════════════════════════════════
function CalendarView({ tasks, date, setDate, onEdit, onDetail }) {
    const year = date.getFullYear(), month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();

    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(d);

    const getTasksForDay = (day) => {
        if (!day) return [];
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return tasks.filter(t => t.due_date === dateStr);
    };

    const isToday = (day) => day && today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
    const monthNames = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];

    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/50 dark:border-slate-700/30 overflow-hidden shadow-sm">
            {/* Calendar Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700/50">
                <button onClick={() => setDate(new Date(year, month - 1, 1))} className="w-8 h-8 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center cursor-pointer transition-colors">
                    <span className="material-symbols-outlined text-[18px] text-slate-500">chevron_left</span>
                </button>
                <h3 className="text-[15px] font-black text-slate-800 dark:text-white">{monthNames[month]} {year}</h3>
                <button onClick={() => setDate(new Date(year, month + 1, 1))} className="w-8 h-8 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center cursor-pointer transition-colors">
                    <span className="material-symbols-outlined text-[18px] text-slate-500">chevron_right</span>
                </button>
            </div>
            {/* Day Headers */}
            <div className="grid grid-cols-7 border-b border-slate-100 dark:border-slate-700/50">
                {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map(d => (
                    <div key={d} className="py-2 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">{d}</div>
                ))}
            </div>
            {/* Calendar Grid */}
            <div className="grid grid-cols-7">
                {days.map((day, i) => {
                    const dayTasks = getTasksForDay(day);
                    return (
                        <div key={i} className={`min-h-[100px] p-1.5 border-b border-r border-slate-50 dark:border-slate-700/30 ${!day ? 'bg-slate-50/50 dark:bg-slate-900/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'} transition-colors`}>
                            {day && (
                                <>
                                    <span className={`text-[12px] font-bold inline-flex w-6 h-6 items-center justify-center rounded-full ${isToday(day) ? 'bg-primary text-white' : 'text-slate-600 dark:text-slate-400'}`}>{day}</span>
                                    <div className="mt-1 space-y-0.5">
                                        {dayTasks.slice(0, 3).map(t => {
                                            const p = getPriority(t.priority);
                                            return (
                                                <div key={t.id} onClick={() => onDetail(t)}
                                                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md truncate cursor-pointer hover:opacity-80 transition-opacity ${p.bg} ${p.color}`}>
                                                    {t.title}
                                                </div>
                                            );
                                        })}
                                        {dayTasks.length > 3 && <span className="text-[9px] text-slate-400 font-bold pl-1">+{dayTasks.length - 3}</span>}
                                    </div>
                                </>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
// LIST VIEW
// ═══════════════════════════════════════════════════════════════
function ListView({ tasks, onEdit, onDetail, getUserName, getProjectName, onStatusChange, getCategory }) {
    const [sortBy, setSortBy] = useState('created_at');
    const [sortDir, setSortDir] = useState('desc');

    const sorted = useMemo(() => {
        return [...tasks].sort((a, b) => {
            let va = a[sortBy], vb = b[sortBy];
            if (sortBy === 'priority') {
                const order = { urgent: 0, high: 1, medium: 2, low: 3 };
                va = order[va] ?? 2; vb = order[vb] ?? 2;
            }
            if (va < vb) return sortDir === 'asc' ? -1 : 1;
            if (va > vb) return sortDir === 'asc' ? 1 : -1;
            return 0;
        });
    }, [tasks, sortBy, sortDir]);

    const toggleSort = (col) => {
        if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortBy(col); setSortDir('asc'); }
    };

    const SortIcon = ({ col }) => sortBy === col ? <span className="material-symbols-outlined text-[12px]">{sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward'}</span> : null;

    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/50 dark:border-slate-700/30 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                    <thead>
                        <tr className="border-b border-slate-100 dark:border-slate-700/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            <th className="text-left px-4 py-3 cursor-pointer hover:text-slate-600" onClick={() => toggleSort('title')}>Công việc <SortIcon col="title" /></th>
                            <th className="text-left px-3 py-3">Nhóm CV</th>
                            <th className="text-left px-3 py-3">Dự án</th>
                            <th className="text-left px-3 py-3 cursor-pointer hover:text-slate-600" onClick={() => toggleSort('status')}>Trạng thái <SortIcon col="status" /></th>
                            <th className="text-left px-3 py-3 cursor-pointer hover:text-slate-600" onClick={() => toggleSort('priority')}>Ưu tiên <SortIcon col="priority" /></th>
                            <th className="text-left px-3 py-3">Người thực hiện</th>
                            <th className="text-left px-3 py-3 cursor-pointer hover:text-slate-600" onClick={() => toggleSort('due_date')}>Hạn <SortIcon col="due_date" /></th>
                            <th className="px-3 py-3"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {sorted.map(t => {
                            const priority = getPriority(t.priority);
                            const status = getStatus(t.status);
                            const isOverdue = t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done';
                            return (
                                <tr key={t.id} className="border-b border-slate-50 dark:border-slate-700/20 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors cursor-pointer" onClick={() => onDetail(t)}>
                                    <td className="px-4 py-3 font-bold text-slate-800 dark:text-white max-w-[300px] truncate">{t.title}</td>
                                    <td className="px-3 py-3">{(() => { const cat = getCategory(t.category_id); return cat ? <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md inline-flex items-center gap-0.5 whitespace-nowrap" style={{ backgroundColor: cat.color + '18', color: cat.color }}><span className="material-symbols-outlined text-[11px]">{cat.icon}</span>{cat.name}</span> : <span className="text-slate-400 text-[12px]">—</span>; })()}</td>
                                    <td className="px-3 py-3 text-slate-500 text-[12px]">{getProjectName(t.project_id) || '—'}</td>
                                    <td className="px-3 py-3">
                                        <select value={t.status} onClick={e => e.stopPropagation()} onChange={e => onStatusChange(t.id, e.target.value)}
                                            className={`text-[11px] font-bold px-2 py-1 rounded-lg border-0 outline-none cursor-pointer ${status.bg} ${status.text}`}>
                                            {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                                        </select>
                                    </td>
                                    <td className="px-3 py-3">
                                        <span className={`text-[11px] font-bold flex items-center gap-1 ${priority.color}`}>
                                            <span className="material-symbols-outlined text-[13px]">{priority.icon}</span>{priority.label}
                                        </span>
                                    </td>
                                    <td className="px-3 py-3 text-slate-500 text-[12px]">{getUserName(t.assigned_to)}</td>
                                    <td className={`px-3 py-3 text-[12px] font-bold ${isOverdue ? 'text-rose-500' : 'text-slate-500'}`}>
                                        {t.due_date ? new Date(t.due_date).toLocaleDateString('vi-VN') : '—'}
                                    </td>
                                    <td className="px-3 py-3">
                                        <button onClick={e => { e.stopPropagation(); onEdit(t); }} className="text-slate-400 hover:text-primary transition-colors cursor-pointer">
                                            <span className="material-symbols-outlined text-[16px]">edit</span>
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                        {sorted.length === 0 && (
                            <tr><td colSpan={8} className="text-center py-16 text-slate-400">
                                <span className="material-symbols-outlined text-4xl mb-2 block">search_off</span>
                                <p className="text-sm font-bold">Không tìm thấy công việc</p>
                            </td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
// TIMELINE VIEW (Gantt-style)
// ═══════════════════════════════════════════════════════════════
function TimelineView({ tasks, getUserName, onDetail }) {
    const timelineTasks = tasks.filter(t => t.start_date || t.due_date);
    const today = new Date();

    // Calculate date range (4 weeks centered on today)
    const startRange = new Date(today); startRange.setDate(startRange.getDate() - 7);
    const endRange = new Date(today); endRange.setDate(endRange.getDate() + 21);
    const totalDays = Math.ceil((endRange - startRange) / (1000 * 60 * 60 * 24));

    const getDayOffset = (dateStr) => {
        if (!dateStr) return null;
        const d = new Date(dateStr);
        return Math.ceil((d - startRange) / (1000 * 60 * 60 * 24));
    };

    const weeks = [];
    for (let d = new Date(startRange); d < endRange; d.setDate(d.getDate() + 1)) {
        weeks.push(new Date(d));
    }

    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/50 dark:border-slate-700/30 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
                <div style={{ minWidth: `${Math.max(800, totalDays * 40)}px` }}>
                    {/* Date headers */}
                    <div className="flex border-b border-slate-100 dark:border-slate-700/50 sticky top-0 bg-white dark:bg-slate-800 z-10">
                        <div className="w-48 flex-shrink-0 px-3 py-2 text-[10px] font-black text-slate-400 uppercase border-r border-slate-100 dark:border-slate-700/50">Công việc</div>
                        <div className="flex-1 flex">
                            {weeks.map((d, i) => {
                                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                                const isTodayCol = d.toDateString() === today.toDateString();
                                return (
                                    <div key={i} className={`flex-1 min-w-[40px] text-center text-[9px] font-bold py-2 border-r border-slate-50 dark:border-slate-700/20 ${isWeekend ? 'bg-slate-50/50 dark:bg-slate-900/20 text-slate-300' : 'text-slate-400'} ${isTodayCol ? 'bg-primary/5 text-primary font-black' : ''}`}>
                                        <div>{d.toLocaleDateString('vi-VN', { weekday: 'narrow' })}</div>
                                        <div className={`text-[11px] ${isTodayCol ? 'bg-primary text-white rounded-full w-5 h-5 flex items-center justify-center mx-auto' : ''}`}>{d.getDate()}</div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    {/* Task rows */}
                    {timelineTasks.map(t => {
                        const priority = getPriority(t.priority);
                        const status = getStatus(t.status);
                        const startOff = getDayOffset(t.start_date || t.due_date);
                        const endOff = getDayOffset(t.due_date || t.start_date);
                        const barStart = Math.max(0, Math.min(startOff, totalDays));
                        const barEnd = Math.max(0, Math.min(endOff + 1, totalDays));
                        const barWidth = Math.max(1, barEnd - barStart);

                        return (
                            <div key={t.id} className="flex border-b border-slate-50 dark:border-slate-700/20 hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors cursor-pointer" onClick={() => onDetail(t)}>
                                <div className="w-48 flex-shrink-0 px-3 py-2.5 border-r border-slate-100 dark:border-slate-700/50">
                                    <p className="text-[12px] font-bold text-slate-800 dark:text-white truncate">{t.title}</p>
                                    <p className="text-[9px] text-slate-400 mt-0.5">{getUserName(t.assigned_to)}</p>
                                </div>
                                <div className="flex-1 relative py-2">
                                    <div className="absolute top-1/2 -translate-y-1/2 h-5 rounded-md shadow-sm flex items-center px-2 text-[9px] font-bold text-white"
                                        style={{
                                            left: `${(barStart / totalDays) * 100}%`,
                                            width: `${(barWidth / totalDays) * 100}%`,
                                            backgroundColor: status.accent,
                                            minWidth: '20px',
                                        }}>
                                        <span className="truncate">{t.title}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    {timelineTasks.length === 0 && (
                        <div className="text-center py-16 text-slate-400">
                            <span className="material-symbols-outlined text-4xl mb-2 block">timeline</span>
                            <p className="text-sm font-bold">Thêm ngày bắt đầu/kết thúc để hiển thị timeline</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
// TASK MODAL (Create/Edit)
// ═══════════════════════════════════════════════════════════════
function TaskModal({ task, projects, users, categories, onAddCategory, onSave, onClose }) {
    const [form, setForm] = useState({
        title: task?.title || '',
        description: task?.description || '',
        status: task?.status || 'todo',
        priority: task?.priority || 'medium',
        category_id: task?.category_id || '',
        project_id: task?.project_id || '',
        assigned_to: task?.assigned_to || '',
        due_date: task?.due_date || '',
        start_date: task?.start_date || '',
        tags: task?.tags?.join(', ') || '',
    });
    const [showNewCategory, setShowNewCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');

    const handleAddCategory = async () => {
        if (!newCategoryName.trim()) return;
        const cat = await onAddCategory(newCategoryName.trim());
        if (cat) {
            setForm(f => ({ ...f, category_id: cat.id }));
            setShowNewCategory(false);
            setNewCategoryName('');
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!form.title.trim()) return;
        onSave({
            ...(task?.id ? { id: task.id } : {}),
            ...form,
            category_id: form.category_id || null,
            project_id: form.project_id || null,
            assigned_to: form.assigned_to || null,
            tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        });
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700/50">
                    <h3 className="text-lg font-black text-slate-800 dark:text-white">{task ? 'Chỉnh sửa Công việc' : 'Tạo Công việc mới'}</h3>
                    <button onClick={onClose} className="w-8 h-8 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center cursor-pointer">
                        <span className="material-symbols-outlined text-[18px] text-slate-400">close</span>
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Title */}
                    <div>
                        <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Tiêu đề *</label>
                        <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Nhập tên công việc..."
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white text-[14px] font-medium focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none" autoFocus />
                    </div>
                    {/* Description */}
                    <div>
                        <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Mô tả</label>
                        <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} placeholder="Mô tả chi tiết công việc..."
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white text-[13px] focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none resize-none" />
                    </div>
                    {/* Nhóm Công việc */}
                    <div>
                        <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Nhóm công việc</label>
                        <div className="flex gap-2">
                            <select value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
                                className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white text-[13px] outline-none cursor-pointer">
                                <option value="">— Chọn nhóm —</option>
                                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                            <button type="button" onClick={() => setShowNewCategory(!showNewCategory)}
                                className="px-2.5 py-2.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 hover:border-primary hover:text-primary text-slate-400 transition-colors cursor-pointer flex-shrink-0"
                                title="Thêm nhóm mới">
                                <span className="material-symbols-outlined text-[16px]">{showNewCategory ? 'close' : 'add'}</span>
                            </button>
                        </div>
                        {showNewCategory && (
                            <div className="flex gap-2 mt-2 animate-fade-in">
                                <input type="text" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddCategory())}
                                    placeholder="Tên nhóm mới..." autoFocus
                                    className="flex-1 px-3 py-2 rounded-xl border border-primary/30 bg-primary/5 text-slate-800 dark:text-white text-[13px] outline-none focus:ring-2 focus:ring-primary/30" />
                                <button type="button" onClick={handleAddCategory}
                                    className="px-3 py-2 bg-primary text-white rounded-xl text-[12px] font-bold cursor-pointer hover:bg-primary/90 transition-colors">Thêm</button>
                            </div>
                        )}
                        {/* Category chips preview */}
                        {categories.length > 0 && !form.category_id && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                                {categories.slice(0, 6).map(c => (
                                    <button type="button" key={c.id} onClick={() => setForm(f => ({ ...f, category_id: c.id }))}
                                        className="text-[10px] font-bold px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-primary/50 transition-colors cursor-pointer flex items-center gap-1 text-slate-500 hover:text-primary">
                                        <span className="material-symbols-outlined text-[12px]" style={{ color: c.color }}>{c.icon}</span>{c.name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    {/* Status + Priority */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Trạng thái</label>
                            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white text-[13px] outline-none cursor-pointer">
                                {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Ưu tiên</label>
                            <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white text-[13px] outline-none cursor-pointer">
                                {PRIORITIES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                            </select>
                        </div>
                    </div>
                    {/* Project + Assignee */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Dự án</label>
                            <select value={form.project_id} onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))}
                                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white text-[13px] outline-none cursor-pointer">
                                <option value="">— Không chọn —</option>
                                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Người thực hiện</label>
                            <select value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))}
                                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white text-[13px] outline-none cursor-pointer">
                                <option value="">— Chưa giao —</option>
                                {Object.entries(
                                    users.reduce((acc, u) => {
                                        const groupName = u.roles?.name || 'Khác';
                                        if (!acc[groupName]) acc[groupName] = [];
                                        acc[groupName].push(u);
                                        return acc;
                                    }, {})
                                ).map(([groupName, groupUsers]) => (
                                    <optgroup key={groupName} label={groupName}>
                                        {groupUsers.map(u => (
                                            <option key={u.id} value={u.id}>{u.full_name || u.id}</option>
                                        ))}
                                    </optgroup>
                                ))}
                            </select>
                        </div>
                    </div>
                    {/* Dates */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Ngày bắt đầu</label>
                            <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white text-[13px] outline-none" />
                        </div>
                        <div>
                            <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Ngày hết hạn</label>
                            <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white text-[13px] outline-none" />
                        </div>
                    </div>
                    {/* Tags */}
                    <div>
                        <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Tags (cách nhau bởi dấu phẩy)</label>
                        <input type="text" value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} placeholder="thiết kế, thi công, PCCC..."
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white text-[13px] focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none" />
                    </div>
                    {/* Actions */}
                    <div className="flex justify-end gap-2 pt-2">
                        <button type="button" onClick={onClose} className="px-5 py-2.5 text-[13px] font-bold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer">Huỷ</button>
                        <button type="submit" className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl text-[13px] font-bold shadow-lg shadow-primary/20 transition-all cursor-pointer">
                            {task ? 'Cập nhật' : 'Tạo công việc'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
// TASK DETAIL DRAWER
// ═══════════════════════════════════════════════════════════════
function TaskDetailDrawer({ task, onClose, onEdit, onDelete, getUserName, getProjectName, getCategory, profile }) {
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState('');
    const [loadingComments, setLoadingComments] = useState(true);

    useEffect(() => {
        fetchComments();
    }, [task.id]);

    const fetchComments = async () => {
        setLoadingComments(true);
        const { data } = await supabase.from('task_comments').select('*').eq('task_id', task.id).order('created_at', { ascending: true });
        setComments(data || []);
        setLoadingComments(false);
    };

    const addComment = async () => {
        if (!newComment.trim()) return;
        const { data, error } = await supabase.from('task_comments').insert({
            task_id: task.id,
            user_id: profile?.user_id,
            content: newComment.trim(),
        }).select().single();
        if (!error && data) {
            setComments(prev => [...prev, data]);
            setNewComment('');
        }
    };

    const priority = getPriority(task.priority);
    const status = getStatus(task.status);
    const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done';

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex justify-end" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 w-full max-w-md h-full shadow-2xl overflow-y-auto animate-slide-in-right" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700/50 sticky top-0 bg-white dark:bg-slate-800 z-10">
                    <div className="flex items-center gap-2">
                        <span className={`material-symbols-outlined text-[20px] ${status.text}`}>{status.icon}</span>
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg ${status.bg} ${status.text}`}>{status.label}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <button onClick={() => onEdit(task)} className="w-8 h-8 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center cursor-pointer" title="Chỉnh sửa">
                            <span className="material-symbols-outlined text-[16px] text-slate-400">edit</span>
                        </button>
                        <button onClick={() => { if(window.confirm('Xóa công việc này?')) onDelete(task.id); }} className="w-8 h-8 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-900/20 flex items-center justify-center cursor-pointer" title="Xóa">
                            <span className="material-symbols-outlined text-[16px] text-rose-400">delete</span>
                        </button>
                        <button onClick={onClose} className="w-8 h-8 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center cursor-pointer">
                            <span className="material-symbols-outlined text-[16px] text-slate-400">close</span>
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-5 space-y-5">
                    <h2 className="text-lg font-black text-slate-800 dark:text-white leading-snug">{task.title}</h2>
                    {task.description && <p className="text-[13px] text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">{task.description}</p>}

                    {/* Properties */}
                    <div className="space-y-3 bg-slate-50 dark:bg-slate-900/30 rounded-xl p-4">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Nhóm CV</span>
                            {(() => { const cat = getCategory(task.category_id); return cat ? <span className="text-[12px] font-bold px-2 py-0.5 rounded-md inline-flex items-center gap-1" style={{ backgroundColor: cat.color + '18', color: cat.color }}><span className="material-symbols-outlined text-[13px]">{cat.icon}</span>{cat.name}</span> : <span className="text-[12px] text-slate-400">—</span>; })()}
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Ưu tiên</span>
                            <span className={`text-[12px] font-bold flex items-center gap-1 ${priority.color}`}>
                                <span className="material-symbols-outlined text-[14px]">{priority.icon}</span>{priority.label}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Dự án</span>
                            <span className="text-[12px] font-bold text-slate-700 dark:text-white">{getProjectName(task.project_id) || '—'}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Người thực hiện</span>
                            <span className="text-[12px] font-bold text-slate-700 dark:text-white">{getUserName(task.assigned_to)}</span>
                        </div>
                        {task.start_date && (
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Bắt đầu</span>
                                <span className="text-[12px] font-bold text-slate-700 dark:text-white">{new Date(task.start_date).toLocaleDateString('vi-VN')}</span>
                            </div>
                        )}
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Hạn hoàn thành</span>
                            <span className={`text-[12px] font-bold ${isOverdue ? 'text-rose-500' : 'text-slate-700 dark:text-white'}`}>
                                {task.due_date ? new Date(task.due_date).toLocaleDateString('vi-VN') : '—'}
                                {isOverdue && <span className="ml-1 text-[10px]">⚠️ Quá hạn</span>}
                            </span>
                        </div>
                        {task.tags?.length > 0 && (
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tags</span>
                                <div className="flex gap-1 flex-wrap justify-end">
                                    {task.tags.map((tag, i) => (
                                        <span key={i} className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-primary/10 text-primary">{tag}</span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Comments */}
                    <div>
                        <h4 className="text-[12px] font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[16px]">comment</span>Bình luận ({comments.length})
                        </h4>
                        <div className="space-y-3 mb-4 max-h-[30vh] overflow-y-auto no-scrollbar">
                            {loadingComments ? (
                                <div className="text-center py-4"><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary mx-auto"></div></div>
                            ) : comments.length === 0 ? (
                                <p className="text-[12px] text-slate-400 text-center py-4">Chưa có bình luận</p>
                            ) : comments.map(c => (
                                <div key={c.id} className="flex gap-2.5">
                                    <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 flex-shrink-0 bg-cover bg-center"
                                        style={{ backgroundImage: `url('https://api.dicebear.com/7.x/avataaars/svg?seed=${c.user_id}')` }} />
                                    <div className="flex-1 bg-slate-50 dark:bg-slate-900/30 rounded-xl px-3 py-2">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-[11px] font-bold text-slate-700 dark:text-white">{getUserName(c.user_id)}</span>
                                            <span className="text-[9px] text-slate-400">{new Date(c.created_at).toLocaleString('vi-VN')}</span>
                                        </div>
                                        <p className="text-[12px] text-slate-600 dark:text-slate-400">{c.content}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {/* Add comment */}
                        <div className="flex gap-2">
                            <input type="text" value={newComment} onChange={e => setNewComment(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && addComment()}
                                placeholder="Viết bình luận..." className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[13px] text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-primary/30" />
                            <button onClick={addComment} className="px-3 py-2 bg-primary text-white rounded-xl cursor-pointer hover:bg-primary/90 transition-colors">
                                <span className="material-symbols-outlined text-[16px]">send</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
// LOADING SKELETON
// ═══════════════════════════════════════════════════════════════
function LoadingSkeleton() {
    return (
        <div className="space-y-5 animate-fade-in">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[1,2,3,4].map(i => <div key={i} className="h-20 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 animate-pulse" />)}
            </div>
            <div className="h-12 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 animate-pulse" />
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[1,2,3,4].map(i => <div key={i} className="h-96 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 animate-pulse" />)}
            </div>
        </div>
    );
}
