import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import LaborTracking from './LaborTracking';

export default function LaborExpensePlanning() {
    const [projects, setProjects] = useState([]);
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchProjects = async () => {
            setLoading(true);
            const { data } = await supabase.from('projects').select('id, name, code, internal_code').order('created_at', { ascending: false });
            setProjects(data || []);
            setLoading(false);
        };
        fetchProjects();
    }, []);

    const selectedProject = projects.find(p => p.id === selectedProjectId);

    return (
        <div className="space-y-4">
            {/* Project Selector Header */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center text-violet-600 shadow-sm border border-violet-200/50">
                        <span className="material-symbols-outlined notranslate text-[22px]" translate="no">engineering</span>
                    </div>
                    <div>
                        <h3 className="text-lg font-extrabold text-slate-800">Chi phí Nhân công</h3>
                        <p className="text-xs text-slate-400 font-medium">Quản lý chi phí nhân công theo từng dự án</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <label className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Chọn dự án:</label>
                    <select
                        value={selectedProjectId}
                        onChange={(e) => setSelectedProjectId(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-violet-500 focus:border-violet-500 min-w-[280px]"
                    >
                        <option value="">— Chọn dự án để xem/nhập nhân công —</option>
                        {projects.map(p => (
                            <option key={p.id} value={p.id}>{p.internal_code || p.code} — {p.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Content */}
            {loading ? (
                <div className="p-12 text-center text-slate-400">
                    <div className="w-8 h-8 rounded-full border-4 border-violet-200 border-t-violet-500 animate-spin mx-auto mb-3"></div>
                    Đang tải...
                </div>
            ) : !selectedProject ? (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-16 text-center">
                    <div className="w-16 h-16 rounded-full bg-violet-50 flex items-center justify-center text-violet-400 mx-auto mb-4">
                        <span className="material-symbols-outlined text-3xl">engineering</span>
                    </div>
                    <h4 className="text-lg font-bold text-slate-700 mb-2">Chọn dự án để bắt đầu</h4>
                    <p className="text-sm text-slate-400 max-w-md mx-auto">Vui lòng chọn một dự án từ danh sách phía trên để xem và nhập liệu chi phí nhân công.</p>
                </div>
            ) : (
                <LaborTracking project={selectedProject} embedded={true} />
            )}
        </div>
    );
}
