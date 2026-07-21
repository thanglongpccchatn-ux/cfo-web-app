import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { fmt, fmtB } from '../utils/formatters';

/**
 * Công nợ thầu phụ / tổ đội — 2 TẦNG (đọc view v_subcontractor_debt_by_partner):
 *  - Đến kỳ    = đã duyệt   − đã trả  (phải trả ngay theo tỷ lệ điều khoản)
 *  - Khối lượng = đã nghiệm thu − đã trả (tổng còn phải trả cả HĐ)
 *  - Hóa đơn   = đã xuất HĐ  − đã trả  (chỉ Nhà thầu)
 * Bấm 1 nhà thầu để xem chi tiết từng hợp đồng.
 */
export default function SubcontractorDebtSummary() {
    const [filterType, setFilterType] = useState('all'); // all | contractor | team
    const [expanded, setExpanded] = useState(null);       // partner_id đang mở

    const { data: rows = [], isLoading } = useQuery({
        queryKey: ['subcontractor-debt-by-partner'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('v_subcontractor_debt_by_partner')
                .select('*')
                .order('cong_no_den_ky', { ascending: false });
            if (error) throw error;
            return data || [];
        },
        staleTime: 2 * 60 * 1000,
    });

    const { data: contracts = [] } = useQuery({
        queryKey: ['subcontractor-debt-by-contract'],
        queryFn: async () => {
            const { data } = await supabase.from('v_subcontractor_contract_debt').select('*');
            return data || [];
        },
        staleTime: 2 * 60 * 1000,
    });

    const filtered = useMemo(
        () => rows.filter(r => filterType === 'all' || r.entity_type === filterType),
        [rows, filterType]
    );

    const totals = useMemo(() => filtered.reduce((a, r) => ({
        denKy: a.denKy + Number(r.cong_no_den_ky || 0),
        khoiLuong: a.khoiLuong + Number(r.cong_no_khoi_luong || 0),
        hoaDon: a.hoaDon + Number(r.cong_no_hoa_don || 0),
        traRoi: a.traRoi + Number(r.gt_thuc_tra || 0),
    }), { denKy: 0, khoiLuong: 0, hoaDon: 0, traRoi: 0 }), [filtered]);

    const KPI = ({ label, value, tone, hint }) => (
        <div className={`rounded-xl border p-3 bg-white dark:bg-slate-800 border-${tone}-100 dark:border-${tone}-500/20`}>
            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</div>
            <div className={`text-lg font-black text-${tone}-700 dark:text-${tone}-400 tabular-nums mt-0.5`}>{fmtB(value)}</div>
            {hint && <div className="text-[9px] text-slate-400 mt-0.5">{hint}</div>}
        </div>
    );

    return (
        <div className="space-y-4">
            {/* Bộ lọc loại */}
            <div className="flex items-center gap-2">
                {[
                    { v: 'all', label: 'Tất cả' },
                    { v: 'contractor', label: 'Nhà thầu (xuất HĐ)' },
                    { v: 'team', label: 'Tổ đội' },
                ].map(t => (
                    <button key={t.v} onClick={() => setFilterType(t.v)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all min-h-[40px] ${filterType === t.v
                            ? 'bg-primary text-white border-primary'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-primary/40'}`}>
                        {t.label}
                    </button>
                ))}
            </div>

            {/* KPI tổng 2 tầng */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <KPI label="Công nợ đến kỳ" value={totals.denKy} tone="rose" hint="Duyệt − đã trả" />
                <KPI label="Công nợ khối lượng" value={totals.khoiLuong} tone="amber" hint="Nghiệm thu − đã trả" />
                <KPI label="Công nợ hóa đơn" value={totals.hoaDon} tone="indigo" hint="Xuất HĐ − đã trả" />
                <KPI label="Đã thanh toán" value={totals.traRoi} tone="emerald" hint="Lũy kế đã chi" />
            </div>

            {/* Bảng theo nhà thầu/tổ đội */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
                {isLoading ? (
                    <div className="p-8 text-center text-slate-400 text-sm">Đang tải công nợ...</div>
                ) : filtered.length === 0 ? (
                    <div className="p-10 text-center text-slate-400">
                        <span className="material-symbols-outlined text-4xl block mb-2 opacity-50">receipt_long</span>
                        Chưa có công nợ thầu phụ / tổ đội.
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-700">
                        {filtered.map(r => {
                            const isOpen = expanded === r.partner_id;
                            const isContractor = r.entity_type === 'contractor';
                            const myContracts = contracts.filter(c => c.partner_id === r.partner_id);
                            return (
                                <div key={r.partner_id}>
                                    <button onClick={() => setExpanded(isOpen ? null : r.partner_id)}
                                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors text-left">
                                        <span className={`material-symbols-outlined text-[18px] text-slate-400 transition-transform ${isOpen ? 'rotate-90' : ''}`}>chevron_right</span>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-slate-800 dark:text-white text-sm truncate">{r.partner_short_name || r.partner_name}</span>
                                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold border ${isContractor
                                                    ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300'
                                                    : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300'}`}>
                                                    {isContractor ? 'Nhà thầu' : 'Tổ đội'}
                                                </span>
                                            </div>
                                            <div className="text-[10px] text-slate-400 mt-0.5">{r.so_hop_dong} hợp đồng · đã trả {fmtB(r.gt_thuc_tra)}</div>
                                        </div>
                                        <div className="hidden sm:flex items-center gap-4 shrink-0 text-right">
                                            <div><div className="text-[9px] text-rose-400 font-bold uppercase">Đến kỳ</div><div className="text-sm font-black text-rose-600 tabular-nums">{fmtB(r.cong_no_den_ky)}</div></div>
                                            <div><div className="text-[9px] text-amber-400 font-bold uppercase">Khối lượng</div><div className="text-sm font-black text-amber-600 tabular-nums">{fmtB(r.cong_no_khoi_luong)}</div></div>
                                            {isContractor && <div><div className="text-[9px] text-indigo-400 font-bold uppercase">Hóa đơn</div><div className="text-sm font-black text-indigo-600 tabular-nums">{fmtB(r.cong_no_hoa_don)}</div></div>}
                                        </div>
                                    </button>
                                    {/* Mobile: 2 tầng công nợ */}
                                    <div className="sm:hidden px-4 pb-3 grid grid-cols-3 gap-2 text-center -mt-1">
                                        <div className="bg-rose-50 dark:bg-rose-500/10 rounded-lg py-1.5"><div className="text-[8px] text-rose-400 font-bold uppercase">Đến kỳ</div><div className="text-xs font-black text-rose-600 tabular-nums">{fmtB(r.cong_no_den_ky)}</div></div>
                                        <div className="bg-amber-50 dark:bg-amber-500/10 rounded-lg py-1.5"><div className="text-[8px] text-amber-400 font-bold uppercase">Khối lượng</div><div className="text-xs font-black text-amber-600 tabular-nums">{fmtB(r.cong_no_khoi_luong)}</div></div>
                                        <div className="bg-indigo-50 dark:bg-indigo-500/10 rounded-lg py-1.5"><div className="text-[8px] text-indigo-400 font-bold uppercase">Hóa đơn</div><div className="text-xs font-black text-indigo-600 tabular-nums">{isContractor ? fmtB(r.cong_no_hoa_don) : '—'}</div></div>
                                    </div>

                                    {/* Chi tiết hợp đồng */}
                                    {isOpen && (
                                        <div className="bg-slate-50/60 dark:bg-slate-900/40 border-t border-slate-100 dark:border-slate-700 px-4 py-3 space-y-2">
                                            {myContracts.length === 0 ? (
                                                <div className="text-xs text-slate-400 italic">Chưa có hợp đồng.</div>
                                            ) : myContracts.map(c => (
                                                <div key={c.contract_id} className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{c.contract_code || c.contract_name || 'HĐ'}</span>
                                                        <span className="text-[10px] text-slate-400">{c.contract_status}</span>
                                                    </div>
                                                    <div className="grid grid-cols-4 gap-2 mt-2 text-center text-[10px]">
                                                        <div><div className="text-slate-400 font-bold uppercase">GT HĐ</div><div className="font-bold text-slate-700 dark:text-slate-300 tabular-nums">{fmtB(c.gt_hop_dong)}</div></div>
                                                        <div><div className="text-slate-400 font-bold uppercase">Đã trả</div><div className="font-bold text-emerald-600 tabular-nums">{fmtB(c.gt_thuc_tra)}</div></div>
                                                        <div><div className="text-rose-400 font-bold uppercase">Đến kỳ</div><div className="font-bold text-rose-600 tabular-nums">{fmtB(c.cong_no_den_ky)}</div></div>
                                                        <div><div className="text-amber-400 font-bold uppercase">Khối lượng</div><div className="font-bold text-amber-600 tabular-nums">{fmtB(c.cong_no_khoi_luong)}</div></div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
