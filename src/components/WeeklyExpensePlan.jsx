import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useToast } from '../context/ToastContext';

export default function WeeklyExpensePlan() {
    const toast = useToast();
    const [currentDate, setCurrentDate] = useState(new Date());

    // Helper: ISO Week string formatting
    const getWeekNumber = (d) => {
        const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
        const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
        const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
        return { week: weekNo, year: date.getUTCFullYear() };
    };

    const { week: activeWeek, year: activeYear } = getWeekNumber(currentDate);

    // Calculate Week Date Boundaries
    const { startStr, endStr } = useMemo(() => {
        const simple = new Date(activeYear, 0, 1 + (activeWeek - 1) * 7);
        const dow = simple.getDay();
        const ISOweekStart = simple;
        if (dow <= 4) ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
        else ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
        
        const startDate = new Date(ISOweekStart);
        const endDate = new Date(ISOweekStart);
        endDate.setDate(startDate.getDate() + 6);
        
        // Pad and setup for postgrest search 
        // Note: keeping time as 00:00:00 to 23:59:59
        return {
            startStr: `${startDate.getFullYear()}-${String(startDate.getMonth()+1).padStart(2,'0')}-${String(startDate.getDate()).padStart(2,'0')}`,
            endStr: `${endDate.getFullYear()}-${String(endDate.getMonth()+1).padStart(2,'0')}-${String(endDate.getDate()).padStart(2,'0')}`
        };
    }, [activeWeek, activeYear]);

    // Fetch Aggegated Data
    const { data: plans = [], isLoading } = useQuery({
        queryKey: ['aggregated_weekly_plans', startStr, endStr],
        queryFn: async () => {
            const list = [];
            try {
                // 1. Fetch General Expenses (Chi phí chung)
                const resExp = await supabase.from('expenses')
                    .select('*, projects(id, code, internal_code)')
                    .gte('expense_date', startStr)
                    .lte('expense_date', endStr);
                    
                if (resExp.data) {
                    resExp.data.forEach(x => {
                        list.push({
                            id: `exp-${x.id}`,
                            category: 'Chi phí chung',
                            request_date: x.expense_date,
                            vendor_name: 'Phòng ban nội bộ', 
                            project_code: x.projects?.internal_code || x.projects?.code || 'Khác',
                            description: x.expense_type + (x.description ? ` (${x.description})` : ''),
                            priority: 'Bình thường', // Expenses usually standard priority
                            requested_amount: Number(x.amount) || 0,
                            actual_amount: Number(x.paid_amount) || 0,
                            actual_payment_date: x.paid_date,
                            notes: x.description
                        });
                    });
                }

                // 2. Fetch Labor Expenses (Nhân công)
                const resLab = await supabase.from('expense_labor')
                    .select('*, projects(id, code, internal_code)')
                    .gte('request_date', startStr)
                    .lte('request_date', endStr);
                    
                if (resLab.data) {
                    resLab.data.forEach(x => {
                        list.push({
                            id: `lab-${x.id}`,
                            category: 'Nhân công',
                            request_date: x.request_date,
                            vendor_name: x.team_name,
                            project_code: x.projects?.internal_code || x.projects?.code || 'Khác',
                            description: x.payment_stage + (x.notes ? ` - ${x.notes}` : ''),
                            priority: x.priority || 'Bình thường',
                            requested_amount: Number(x.requested_amount) || 0,
                            actual_amount: Number(x.paid_amount) || 0,
                            actual_payment_date: x.payment_date,
                            notes: x.notes
                        });
                    });
                }

                // 3. Fetch Material Expenses (Vật tư)
                const resMat = await supabase.from('expense_materials')
                    .select('*, projects(id, code, internal_code)')
                    .gte('expense_date', startStr)
                    .lte('expense_date', endStr);
                    
                if (resMat.data) {
                    resMat.data.forEach(x => {
                        list.push({
                            id: `mat-${x.id}`,
                            category: 'Vật tư',
                            request_date: x.expense_date,
                            vendor_name: x.supplier_name,
                            project_code: x.projects?.internal_code || x.projects?.code || 'Khác',
                            description: `${x.item_group || ''} - ${x.product_name || ''}`.trim(),
                            priority: 'Bình thường',
                            requested_amount: Number(x.total_amount) || 0,
                            actual_amount: Number(x.paid_amount) || 0,
                            actual_payment_date: null,
                            notes: x.notes
                        });
                    });
                }

                return list.sort((a,b) => new Date(b.request_date) - new Date(a.request_date));
            } catch (err) {
                console.error("Aggregation Error", err);
                toast.error("Không thể tải báo cáo từ các hệ thống nhánh.");
                return [];
            }
        }
    });

    const fmt = (val) => {
        if (!val || val == 0) return '';
        return new Intl.NumberFormat('vi-VN').format(val);
    };

    const changeWeek = (offset) => {
        const d = new Date(currentDate);
        d.setDate(d.getDate() + offset * 7);
        setCurrentDate(d);
    };

    // Calculate Totals & Dashboards
    const totalRequested = plans.reduce((a, c) => a + (Number(c.requested_amount) || 0), 0);
    const totalActual = plans.reduce((a, c) => a + (Number(c.actual_amount) || 0), 0);

    const categoryStats = { 'Vật tư': { r:0, a:0 }, 'Nhân công': { r:0, a:0 }, 'Chi phí chung': { r:0, a:0 } };
    const priorityStats = { 'Rất gấp': 0, 'Gấp': 0, 'Bình thường': 0 };
    const vendorMap = {};

    plans.forEach(r => {
        const cat = r.category || 'Vật tư';
        if (categoryStats[cat]) { 
            categoryStats[cat].r += Number(r.requested_amount) || 0; 
            categoryStats[cat].a += Number(r.actual_amount) || 0; 
        } else {
            categoryStats[cat] = { r: Number(r.requested_amount) || 0, a: Number(r.actual_amount) || 0 };
        }
        
        let p = (r.priority || 'Bình thường').includes('Rất gấp') ? 'Rất gấp' : r.priority || 'Bình thường';
        if (priorityStats[p] !== undefined) priorityStats[p] += Number(r.requested_amount) || 0;
        else priorityStats[p] = Number(r.requested_amount) || 0;

        const vendor = r.vendor_name || 'Hệ thống';
        if (!vendorMap[vendor]) vendorMap[vendor] = { r: 0, a: 0 };
        vendorMap[vendor].r += Number(r.requested_amount) || 0;
        vendorMap[vendor].a += Number(r.actual_amount) || 0;
    });

    const vendorList = Object.entries(vendorMap).map(([n, s]) => ({ n, ...s })).sort((a,b) => b.r - a.r);

    return (
        <div className="bg-slate-50 min-h-[calc(100vh-100px)] animate-fade-in flex flex-col items-center pb-20">
            <div className="w-full max-w-[1600px] flex flex-col gap-5 pt-6 px-4">
                
                {/* Header & Week Controls */}
                <div className="flex flex-col md:flex-row justify-between items-center bg-white p-5 rounded-[20px] shadow-sm border border-slate-200 gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center border border-indigo-200"><span className="material-symbols-outlined text-2xl">monitoring</span></div>
                        <div>
                            <h2 className="text-xl font-black text-slate-800 tracking-tight uppercase">SATECO - Kế hoạch Chi Tuần</h2>
                            <p className="text-sm font-semibold text-slate-500 mt-0.5 tracking-widest">Dashboard Tổng hợp Thanh Toán ({startStr.split('-').reverse().join('/')} - {endStr.split('-').reverse().join('/')})</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-6">
                        <div className="text-right hidden md:block">
                            <div className="text-[10px] font-black text-blue-500 uppercase tracking-widest leading-tight">Mã Quỹ Tuần</div>
                            <div className="font-black text-2xl text-slate-800 tabular-nums">{fmt(totalRequested)}</div>
                        </div>
                        <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-inner">
                            <button onClick={() => changeWeek(-1)} className="px-3 py-1.5 rounded-xl hover:bg-white text-slate-500 hover:text-indigo-600 transition-all font-bold text-xs"><span className="material-symbols-outlined text-[18px]">chevron_left</span></button>
                            <div className="px-6 py-1.5 bg-white rounded-xl shadow-sm border border-slate-200/60 text-sm font-black text-indigo-700 tracking-wider">Tuần {activeWeek} - {activeYear}</div>
                            <button onClick={() => changeWeek(1)} className="px-3 py-1.5 rounded-xl hover:bg-white text-slate-500 hover:text-indigo-600 transition-all font-bold text-xs"><span className="material-symbols-outlined text-[18px]">chevron_right</span></button>
                        </div>
                    </div>
                </div>

                {/* DASHBOARD GRIDS */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    {/* KHỐI 1: Phân loại */}
                    <div className="bg-white rounded-[20px] border border-slate-200 shadow-sm p-4 relative overflow-hidden flex flex-col h-56">
                        <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 shrink-0">Tổng hợp theo Bộ phận Phụ trách</div>
                        <div className="flex-1 overflow-auto pointer-events-none custom-scrollbar pr-1">
                            <table className="w-full text-[11px] text-left mb-2">
                                <thead className="text-slate-500 border-b border-slate-200">
                                    <tr><th className="pb-2 font-medium">BỘ PHẬN</th><th className="pb-2 text-right font-medium">ĐNTT KỲ NÀY</th><th className="pb-2 text-right font-medium text-emerald-600">THỰC TẾ ĐI TIỀN</th></tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {Object.keys(categoryStats).map(c => (
                                        <tr key={c}><td className="py-2.5 font-bold text-slate-700">{c}</td><td className="py-2.5 text-right font-bold text-blue-700">{fmt(categoryStats[c].r)}</td><td className="py-2.5 text-right font-black text-emerald-600 bg-emerald-50/20">{fmt(categoryStats[c].a)}</td></tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="pt-2 border-t-2 border-slate-200 flex justify-between items-center px-1 shrink-0">
                            <span className="font-black text-slate-800 text-xs text-left w-[80px]">Total</span>
                            <span className="font-black text-blue-700 text-xs text-right w-1/3">{fmt(totalRequested)}</span>
                            <span className="font-black text-emerald-600 text-xs text-right w-1/3">{fmt(totalActual)}</span>
                        </div>
                    </div>

                    {/* KHỐI 2: Mức độ ưu tiên */}
                    <div className="bg-white rounded-[20px] border border-slate-200 shadow-sm p-4 flex flex-col h-56">
                        <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4 shrink-0">Tổng cộng chia theo Ưu tiên</div>
                        <div className="space-y-4 mt-2 flex-1 overflow-auto custom-scrollbar pr-2">
                            {Object.keys(priorityStats).map(p => {
                                const val = priorityStats[p];
                                const ratio = totalRequested > 0 ? (val / totalRequested) * 100 : 0;
                                const barColor = p === 'Rất gấp' ? 'bg-rose-500' : p === 'Gấp' ? 'bg-orange-500' : 'bg-slate-300';
                                return (
                                    <div key={p}>
                                        <div className="flex justify-between items-center text-xs mb-1">
                                            <span className="font-bold text-slate-700 flex items-center gap-1.5">
                                                <div className={`w-2 h-2 rounded-full ${barColor}`}></div> {p}
                                            </span>
                                            <span className="font-bold text-slate-600 tabular-nums">{fmt(val)}</span>
                                        </div>
                                        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                                            <div className={`${barColor} h-2.5 rounded-full`} style={{ width: `${ratio}%` }}></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* KHỐI 3: THEO ĐƠN VỊ */}
                    <div className="bg-white rounded-[20px] border border-slate-200 shadow-sm p-4 flex flex-col h-56">
                        <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 shrink-0">Chi tiết đối tượng thụ hưởng ({vendorList.length})</div>
                        <div className="overflow-y-auto flex-1 pr-2 space-y-2 custom-scrollbar">
                            {vendorList.map((v, i) => (
                                <div key={i} className="flex justify-between items-center bg-slate-50 p-2 rounded-lg border border-slate-100">
                                    <div className="truncate font-bold text-xs text-slate-700 w-1/2" title={v.n}>{v.n}</div>
                                    <div className="text-right w-1/2">
                                        <div className="font-black text-[12px] text-blue-700 leading-tight tabular-nums">{fmt(v.r)}</div>
                                        <div className="font-bold text-[9px] text-emerald-600 mt-0.5 tabular-nums">Đã đi: {fmt(v.a)}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* MAIN TABLE */}
                <div className="bg-white rounded-[20px] shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center"><span className="material-symbols-outlined text-[18px]">table_rows</span></div>
                            <span className="font-black text-slate-700 text-sm tracking-tight uppercase">Chi Tiết Bảng Tổng Kê (Read-only System)</span>
                        </div>
                        <span className="text-xs font-semibold text-slate-400">Tự động tổng hợp từ Vật tư, Nhân công và Chi phí chung</span>
                    </div>

                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-xs text-left whitespace-nowrap table-fixed">
                            <thead className="bg-[#f8f9fa] border-b-2 border-slate-200 text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                                <tr>
                                    <th className="w-[100px] px-3 py-2.5 border-r border-slate-200 text-center">Ngày ghi nhận</th>
                                    <th className="w-[120px] px-3 py-2.5 border-r border-slate-200 text-center">Phân loại (Auto)</th>
                                    <th className="w-[160px] px-3 py-2.5 border-r border-slate-200">Đơn vị Thụ Hưởng</th>
                                    <th className="w-[100px] px-3 py-2.5 border-r border-slate-200">Mã Dự Án</th>
                                    <th className="w-[280px] px-3 py-2.5 border-r border-slate-200">Nội dung Diễn giải</th>
                                    <th className="w-[100px] px-3 py-2.5 border-r border-slate-200 text-center">Mức Ưu tiên</th>
                                    <th className="w-[120px] px-3 py-2.5 border-r border-slate-200 text-right text-indigo-600">Đề nghị / Yêu cầu</th>
                                    <th className="w-[120px] px-3 py-2.5 border-r border-slate-200 text-right text-emerald-600">Thực tế đi tiền</th>
                                    <th className="w-[100px] px-3 py-2.5 border-r border-slate-200 text-center">TG Thanh toán</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {isLoading ? (
                                    <tr><td colSpan={9} className="py-10 text-center text-slate-400 font-medium">Đang đồng bộ dữ liệu từ các phân hệ...</td></tr>
                                ) : plans.length === 0 ? (
                                    <tr><td colSpan={9} className="py-16 text-center text-slate-400 bg-slate-50/50">Không có phát sinh chi phí nào trong {startStr.split('-').reverse().join('/')} đến {endStr.split('-').reverse().join('/')}.</td></tr>
                                ) : (
                                    plans.map(row => (
                                        <tr key={row.id} className="hover:bg-indigo-50/10 cursor-default transition-colors">
                                            <td className="px-3 py-2 border-r border-slate-100/50 text-center text-slate-500 font-mono text-[10px]">{row.request_date ? new Date(row.request_date).toLocaleDateString('vi-VN') : '—'}</td>
                                            <td className="px-3 py-2 border-r border-slate-100/50 text-center">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${row.category==='Vật tư' ? 'bg-amber-50 text-amber-700 border-amber-200' : row.category==='Nhân công' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                                                    {row.category}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 border-r border-slate-100/50 font-bold text-slate-800 truncate" title={row.vendor_name}>{row.vendor_name || '—'}</td>
                                            <td className="px-3 py-2 border-r border-slate-100/50 font-bold text-indigo-700 bg-indigo-50/20 truncate">{row.project_code || '—'}</td>
                                            <td className="px-3 py-2 border-r border-slate-100/50 text-slate-700 truncate" title={row.description}>{row.description || '—'}</td>
                                            <td className="px-3 py-2 border-r border-slate-100/50 text-center">
                                                <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${
                                                    row.priority === 'Khẩn cấp' || row.priority === 'Rất gấp' ? 'bg-rose-50 border-rose-200 text-rose-700' :
                                                    row.priority === 'Gấp' ? 'bg-orange-50 border-orange-200 text-orange-700' :
                                                    'bg-slate-50 border-slate-200 text-slate-400'
                                                }`}>{row.priority}</span>
                                            </td>
                                            <td className="px-3 py-2 border-r border-slate-100/50 text-right font-bold text-indigo-800 tabular-nums bg-indigo-50/10">{fmt(row.requested_amount)}</td>
                                            <td className="px-3 py-2 border-r border-slate-100/50 text-right font-black text-emerald-600 tabular-nums bg-emerald-50/30 border-l border-emerald-100">{fmt(row.actual_amount)}</td>
                                            <td className="px-3 py-2 border-r border-slate-100/50 text-center text-emerald-700 font-mono text-[10px] bg-emerald-50/10">{row.actual_payment_date ? new Date(row.actual_payment_date).toLocaleDateString('vi-VN') : '—'}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
            `}</style>
        </div>
    );
}
