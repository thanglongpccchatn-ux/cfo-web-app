import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import SkeletonTable from './ui/SkeletonTable';
import { EmptyState } from './ui/SkeletonTable';

const ACTION_CONFIG = {
    CREATE: { icon: 'add_circle', label: 'Tạo mới', color: 'emerald', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    UPDATE: { icon: 'edit', label: 'Cập nhật', color: 'blue', bg: 'bg-blue-50 text-blue-700 border-blue-200' },
    DELETE: { icon: 'delete', label: 'Xóa', color: 'rose', bg: 'bg-rose-50 text-rose-700 border-rose-200' },
};

const TABLE_NAME_MAP = {
    projects: 'Hợp đồng / Dự án',
    payments: 'Thanh toán',
    partners: 'Đối tác / CĐT',
    profiles: 'Người dùng',
    addendas: 'Phụ lục HĐ',
    materials: 'Vật tư',
    subcontractors: 'Thầu phụ',
    staff_assignments: 'Gán dự án',
    settlement_documents: 'Hồ sơ QT',
    variations: 'Phát sinh',
    site_diary: 'Nhật ký',
    expenses: 'Chi phí',
    loans: 'Vay vốn',
};

export default function AuditTrailViewer() {
    const [searchTerm, setSearchTerm] = useState('');
    const [actionFilter, setActionFilter] = useState('ALL');
    const [tableFilter, setTableFilter] = useState('ALL');
    const [expandedId, setExpandedId] = useState(null);
    const [page, setPage] = useState(0);
    const pageSize = 50;

    const { data: logs, isLoading } = useQuery({
        queryKey: ['audit-logs', page],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('audit_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .range(page * pageSize, (page + 1) * pageSize - 1);
            if (error) throw error;
            return data || [];
        },
        staleTime: 30 * 1000,
    });

    // Unique tables for filter
    const uniqueTables = useMemo(() => {
        if (!logs) return [];
        return [...new Set(logs.map(l => l.table_name))].filter(Boolean).sort();
    }, [logs]);

    // Filtered logs  
    const filtered = useMemo(() => {
        if (!logs) return [];
        return logs.filter(l => {
            if (actionFilter !== 'ALL' && l.action !== actionFilter) return false;
            if (tableFilter !== 'ALL' && l.table_name !== tableFilter) return false;
            if (searchTerm) {
                const q = searchTerm.toLowerCase();
                return (l.user_name || '').toLowerCase().includes(q)
                    || (l.record_name || '').toLowerCase().includes(q)
                    || (l.table_name || '').toLowerCase().includes(q)
                    || (l.user_email || '').toLowerCase().includes(q);
            }
            return true;
        });
    }, [logs, actionFilter, tableFilter, searchTerm]);

    const formatTime = (ts) => {
        if (!ts) return '';
        const d = new Date(ts);
        const now = new Date();
        const diff = (now - d) / 1000;
        if (diff < 60) return 'Vừa xong';
        if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
        if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
        if (diff < 604800) return `${Math.floor(diff / 86400)} ngày trước`;
        return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const renderChanges = (changes) => {
        if (!changes || typeof changes !== 'object') return null;
        const entries = Object.entries(changes);
        if (entries.length === 0) return null;
        return (
            <div className="mt-3 space-y-1.5">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Chi tiết thay đổi</p>
                <div className="grid gap-1.5">
                    {entries.map(([field, val]) => (
                        <div key={field} className="flex items-start gap-3 px-3 py-2 rounded-lg bg-slate-50 border border-slate-100 text-xs">
                            <span className="font-bold text-slate-600 min-w-[100px] shrink-0">{field}</span>
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                {val?.old != null && (
                                    <span className="text-rose-500 line-through truncate max-w-[200px]" title={String(val.old)}>
                                        {String(val.old).substring(0, 60)}
                                    </span>
                                )}
                                <span className="material-symbols-outlined text-slate-300 text-[14px] shrink-0">arrow_forward</span>
                                <span className="text-emerald-600 font-bold truncate max-w-[200px]" title={String(val?.new ?? '')}>
                                    {String(val?.new ?? '').substring(0, 60)}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="max-w-[1400px] mx-auto animate-fade-in space-y-5">
            {/* Header */}
            <header className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-xl md:text-2xl font-black text-slate-800 flex items-center gap-3">
                            <span className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-white shadow-lg shadow-amber-200">
                                <span className="material-symbols-outlined text-[22px]">history</span>
                            </span>
                            Nhật ký Hoạt động
                        </h1>
                        <p className="text-slate-500 text-xs md:text-sm mt-1 font-medium italic ml-[52px]">
                            Theo dõi mọi thao tác tạo, sửa, xóa dữ liệu trong hệ thống
                        </p>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3 mt-5">
                    <div className="relative flex-1 min-w-[200px] max-w-md">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
                        <input
                            type="text"
                            placeholder="Tìm người dùng, bản ghi..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-amber-500 outline-none text-sm font-medium bg-slate-50/50"
                        />
                    </div>
                    <select
                        value={actionFilter}
                        onChange={e => setActionFilter(e.target.value)}
                        className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-bold bg-white outline-none focus:border-amber-500"
                    >
                        <option value="ALL">Tất cả hành động</option>
                        <option value="CREATE">🟢 Tạo mới</option>
                        <option value="UPDATE">🔵 Cập nhật</option>
                        <option value="DELETE">🔴 Xóa</option>
                    </select>
                    <select
                        value={tableFilter}
                        onChange={e => setTableFilter(e.target.value)}
                        className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-bold bg-white outline-none focus:border-amber-500"
                    >
                        <option value="ALL">Tất cả module</option>
                        {uniqueTables.map(t => (
                            <option key={t} value={t}>{TABLE_NAME_MAP[t] || t}</option>
                        ))}
                    </select>
                </div>
            </header>

            {/* Timeline */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {isLoading ? (
                    <SkeletonTable rows={8} cols={4} />
                ) : filtered.length === 0 ? (
                    <EmptyState icon="history" title="Chưa có hoạt động" description="Các thao tác tạo, sửa, xóa dữ liệu sẽ được ghi lại tại đây" />
                ) : (
                    <div className="divide-y divide-slate-100">
                        {filtered.map(log => {
                            const cfg = ACTION_CONFIG[log.action] || ACTION_CONFIG.UPDATE;
                            const isExpanded = expandedId === log.id;
                            const hasChanges = log.changes && Object.keys(log.changes).length > 0;

                            return (
                                <div
                                    key={log.id}
                                    className={`px-5 py-4 transition-colors ${isExpanded ? 'bg-amber-50/30' : 'hover:bg-slate-50/50'} ${hasChanges ? 'cursor-pointer' : ''}`}
                                    onClick={() => hasChanges && setExpandedId(isExpanded ? null : log.id)}
                                >
                                    <div className="flex items-start gap-4">
                                        {/* Timeline dot */}
                                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${cfg.bg}`}>
                                            <span className="material-symbols-outlined text-[18px]">{cfg.icon}</span>
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-bold text-sm text-slate-800">{log.user_name || log.user_email || 'Hệ thống'}</span>
                                                <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${cfg.bg}`}>
                                                    {cfg.label}
                                                </span>
                                                <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                                                    {TABLE_NAME_MAP[log.table_name] || log.table_name}
                                                </span>
                                            </div>
                                            <p className="text-sm text-slate-600 mt-1">
                                                {log.record_name && (
                                                    <span className="font-bold text-slate-700">"{log.record_name}"</span>
                                                )}
                                                {log.record_id && !log.record_name && (
                                                    <span className="text-xs text-slate-400 font-mono">ID: {log.record_id.substring(0, 8)}...</span>
                                                )}
                                            </p>
                                            <div className="flex items-center gap-3 mt-1.5">
                                                <span className="text-[11px] text-slate-400 font-medium">{formatTime(log.created_at)}</span>
                                                {hasChanges && (
                                                    <button className="text-[10px] font-bold text-amber-600 flex items-center gap-0.5 hover:text-amber-800">
                                                        <span className={`material-symbols-outlined text-[14px] transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                                                            expand_more
                                                        </span>
                                                        {Object.keys(log.changes).length} thay đổi
                                                    </button>
                                                )}
                                            </div>

                                            {/* Expanded changes */}
                                            {isExpanded && renderChanges(log.changes)}
                                        </div>

                                        {/* Time (desktop) */}
                                        <div className="hidden md:block text-right shrink-0">
                                            <span className="text-[11px] font-medium text-slate-400">
                                                {log.created_at ? new Date(log.created_at).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : ''}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Pagination */}
                {!isLoading && filtered.length > 0 && (
                    <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-t border-slate-200">
                        <span className="text-xs font-bold text-slate-500">{filtered.length} bản ghi (trang {page + 1})</span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage(Math.max(0, page - 1))}
                                disabled={page === 0}
                                className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                                ← Trước
                            </button>
                            <button
                                onClick={() => setPage(page + 1)}
                                disabled={filtered.length < pageSize}
                                className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                                Sau →
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
