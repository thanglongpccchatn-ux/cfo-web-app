import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

const PERIOD_STATUS = {
  open: { label: 'Đang mở', color: 'text-green-600 bg-green-50 border-green-200', icon: 'lock_open' },
  soft_close: { label: 'Tạm khóa', color: 'text-amber-600 bg-amber-50 border-amber-200', icon: 'lock_clock' },
  hard_close: { label: 'Đã khóa', color: 'text-red-600 bg-red-50 border-red-200', icon: 'lock' },
  reopened: { label: 'Mở lại', color: 'text-blue-600 bg-blue-50 border-blue-200', icon: 'lock_reset' },
};

const YEAR_STATUS = {
  open: { label: 'Đang mở', color: 'text-green-600 bg-green-50' },
  closed: { label: 'Đã đóng', color: 'text-amber-600 bg-amber-50' },
  locked: { label: 'Đã khóa', color: 'text-red-600 bg-red-50' },
};

export default function FiscalPeriodManager() {
  const [years, setYears] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [selectedYear, setSelectedYear] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newYear, setNewYear] = useState(new Date().getFullYear() + 1);

  const fetchYears = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('acc_fiscal_years').select('*').order('year', { ascending: false });
    setYears(data || []);
    if (data?.length > 0 && !selectedYear) setSelectedYear(data[0]);
    setLoading(false);
  }, []);

  const fetchPeriods = useCallback(async (yearId) => {
    if (!yearId) return;
    const { data } = await supabase.from('acc_fiscal_periods').select('*').eq('fiscal_year_id', yearId).order('period');
    setPeriods(data || []);
  }, []);

  useEffect(() => { fetchYears(); }, [fetchYears]);
  useEffect(() => { if (selectedYear) fetchPeriods(selectedYear.id); }, [selectedYear, fetchPeriods]);

  const createYear = async () => {
    if (years.find(y => y.year === newYear)) return alert(`Năm ${newYear} đã tồn tại!`);
    setCreating(true);

    // Insert fiscal year
    const { data: fy, error } = await supabase.from('acc_fiscal_years').insert({
      year: newYear,
      start_date: `${newYear}-01-01`,
      end_date: `${newYear}-12-31`,
      is_current: false,
      status: 'open',
    }).select().single();

    if (error) { alert('Lỗi: ' + error.message); setCreating(false); return; }

    // Auto-generate 12 periods
    const periodsToInsert = [];
    for (let m = 1; m <= 12; m++) {
      const startDate = `${newYear}-${String(m).padStart(2, '0')}-01`;
      const endDate = new Date(newYear, m, 0).toISOString().split('T')[0]; // Last day of month
      periodsToInsert.push({
        fiscal_year_id: fy.id,
        period: m,
        name: `Tháng ${m}/${newYear}`,
        start_date: startDate,
        end_date: endDate,
        status: 'open',
      });
    }

    await supabase.from('acc_fiscal_periods').insert(periodsToInsert);
    await fetchYears();
    setSelectedYear(fy);
    setCreating(false);
  };

  const setCurrentYear = async (fy) => {
    // Unset all, then set this one
    await supabase.from('acc_fiscal_years').update({ is_current: false }).neq('id', '');
    await supabase.from('acc_fiscal_years').update({ is_current: true }).eq('id', fy.id);
    fetchYears();
  };

  const updatePeriodStatus = async (period, newStatus) => {
    await supabase.from('acc_fiscal_periods').update({
      status: newStatus,
      closed_at: ['soft_close', 'hard_close'].includes(newStatus) ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq('id', period.id);
    fetchPeriods(selectedYear.id);
  };

  const currentMonth = new Date().getMonth() + 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-500">calendar_month</span>
            Kỳ kế toán
          </h2>
          <p className="text-sm text-slate-500 mt-1">Quản lý năm tài chính và 12 kỳ kế toán theo tháng</p>
        </div>
        <div className="flex items-center gap-3">
          <input type="number" value={newYear} onChange={e => setNewYear(parseInt(e.target.value))} min={2020} max={2099}
            className="w-24 px-3 py-2 text-sm font-bold font-mono bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-center" />
          <button onClick={createYear} disabled={creating}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-bold rounded-xl shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50">
            {creating ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <span className="material-symbols-outlined text-[18px]">add</span>}
            Tạo năm mới
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Year Selector */}
          <div className="lg:col-span-3 space-y-2">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1 mb-3">Năm tài chính</p>
            {years.map(fy => (
              <button key={fy.id} onClick={() => setSelectedYear(fy)}
                className={`w-full text-left px-4 py-3 rounded-xl border transition-all cursor-pointer ${
                  selectedYear?.id === fy.id
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 ring-2 ring-blue-500/20'
                    : 'bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-blue-300'
                }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-lg font-black text-slate-900 dark:text-white">{fy.year}</span>
                    {fy.is_current && (
                      <span className="ml-2 text-[9px] font-bold text-white bg-blue-500 px-1.5 py-0.5 rounded-full">HIỆN TẠI</span>
                    )}
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${YEAR_STATUS[fy.status]?.color}`}>
                    {YEAR_STATUS[fy.status]?.label}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  {fy.start_date} → {fy.end_date}
                </div>
              </button>
            ))}
          </div>

          {/* Periods Grid */}
          <div className="lg:col-span-9">
            {selectedYear ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    12 Kỳ kế toán — Năm {selectedYear.year}
                  </p>
                  {!selectedYear.is_current && (
                    <button onClick={() => setCurrentYear(selectedYear)}
                      className="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors cursor-pointer flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">star</span>
                      Đặt làm năm hiện tại
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {periods.map(p => {
                    const statusInfo = PERIOD_STATUS[p.status] || PERIOD_STATUS.open;
                    const isCurrent = selectedYear.is_current && p.period === currentMonth;

                    return (
                      <div key={p.id} className={`bg-white dark:bg-slate-800/50 rounded-xl border ${isCurrent ? 'border-blue-400 dark:border-blue-600 ring-2 ring-blue-500/20' : 'border-slate-200 dark:border-slate-700'} p-4 transition-all hover:shadow-md`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-black text-slate-900 dark:text-white">{p.name}</span>
                          {isCurrent && <span className="text-[8px] font-bold text-white bg-blue-500 px-1.5 py-0.5 rounded-full animate-pulse">NOW</span>}
                        </div>
                        <div className="text-[10px] text-slate-400 mb-3">
                          {p.start_date} → {p.end_date}
                        </div>
                        <div className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg border ${statusInfo.color}`}>
                          <span className="material-symbols-outlined text-[12px]">{statusInfo.icon}</span>
                          {statusInfo.label}
                        </div>
                        {/* Actions */}
                        <div className="flex gap-1 mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/50">
                          {p.status === 'open' && (
                            <>
                              <button onClick={() => updatePeriodStatus(p, 'soft_close')} className="text-[10px] font-bold text-amber-600 hover:text-amber-800 px-2 py-1 rounded-lg hover:bg-amber-50 transition-colors cursor-pointer">
                                Tạm khóa
                              </button>
                              <button onClick={() => updatePeriodStatus(p, 'hard_close')} className="text-[10px] font-bold text-red-600 hover:text-red-800 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors cursor-pointer">
                                Khóa sổ
                              </button>
                            </>
                          )}
                          {p.status === 'soft_close' && (
                            <>
                              <button onClick={() => updatePeriodStatus(p, 'open')} className="text-[10px] font-bold text-green-600 hover:text-green-800 px-2 py-1 rounded-lg hover:bg-green-50 transition-colors cursor-pointer">
                                Mở lại
                              </button>
                              <button onClick={() => updatePeriodStatus(p, 'hard_close')} className="text-[10px] font-bold text-red-600 hover:text-red-800 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors cursor-pointer">
                                Khóa sổ
                              </button>
                            </>
                          )}
                          {p.status === 'hard_close' && (
                            <button onClick={() => updatePeriodStatus(p, 'reopened')} className="text-[10px] font-bold text-blue-600 hover:text-blue-800 px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer">
                              Mở lại (đặc biệt)
                            </button>
                          )}
                          {p.status === 'reopened' && (
                            <button onClick={() => updatePeriodStatus(p, 'hard_close')} className="text-[10px] font-bold text-red-600 hover:text-red-800 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors cursor-pointer">
                              Khóa lại
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <span className="material-symbols-outlined text-5xl mb-3">event_busy</span>
                <p className="text-sm font-bold">Chưa có năm tài chính nào</p>
                <p className="text-xs mt-1">Nhập năm và bấm "Tạo năm mới" để bắt đầu</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
