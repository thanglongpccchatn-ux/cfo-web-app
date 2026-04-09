import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

function fmt(v) { return v ? Number(v).toLocaleString('vi-VN') : '—'; }
function fmtDate(d) { if (!d) return '—'; return new Date(d).toLocaleDateString('vi-VN'); }

export default function GeneralLedger() {
  const [accounts, setAccounts] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [ledgerData, setLedgerData] = useState([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [selectedAccount, setSelectedAccount] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [onlyPosted, setOnlyPosted] = useState(true);

  // Init: fetch accounts & periods
  useEffect(() => {
    (async () => {
      const [accRes, perRes] = await Promise.all([
        supabase.from('acc_accounts').select('id, account_number, name, normal_balance, opening_balance, current_balance')
          .eq('is_active', true).order('account_number'),
        supabase.from('acc_fiscal_periods').select('id, name, start_date, end_date')
          .order('start_date', { ascending: false }),
      ]);
      if (!accRes.error) setAccounts(accRes.data || []);
      if (!perRes.error) setPeriods(perRes.data || []);
    })();
  }, []);

  // Fetch ledger when filters change
  const fetchLedger = useCallback(async () => {
    if (!selectedAccount) { setLedgerData([]); return; }
    setLoading(true);

    let query = supabase
      .from('acc_journal_lines')
      .select(`
        id, debit_amount, credit_amount, description, line_order,
        acc_journal_entries!inner (
          id, entry_number, entry_date, journal_type, status, description
        )
      `)
      .eq('account_id', selectedAccount)
      .order('line_order', { ascending: true });

    if (onlyPosted) query = query.eq('acc_journal_entries.status', 'posted');
    if (dateFrom) query = query.gte('acc_journal_entries.entry_date', dateFrom);
    if (dateTo) query = query.lte('acc_journal_entries.entry_date', dateTo);

    const { data, error } = await query;
    if (error) {
      console.error('Ledger fetch error:', error);
      setLedgerData([]);
    } else {
      // Sort by entry_date then entry_number
      const sorted = (data || []).sort((a, b) => {
        const dateA = a.acc_journal_entries?.entry_date || '';
        const dateB = b.acc_journal_entries?.entry_date || '';
        if (dateA !== dateB) return dateA.localeCompare(dateB);
        return (a.acc_journal_entries?.entry_number || '').localeCompare(b.acc_journal_entries?.entry_number || '');
      });
      setLedgerData(sorted);
    }
    setLoading(false);
  }, [selectedAccount, dateFrom, dateTo, onlyPosted]);

  useEffect(() => { fetchLedger(); }, [fetchLedger]);

  // Selected account info
  const accountInfo = useMemo(() => accounts.find(a => a.id === selectedAccount), [accounts, selectedAccount]);

  // Calculate running balance
  const ledgerWithBalance = useMemo(() => {
    const openingBalance = parseFloat(accountInfo?.opening_balance) || 0;
    const isDebitNormal = accountInfo?.normal_balance === 'debit';
    let runningBalance = openingBalance;

    return ledgerData.map(row => {
      const debit = parseFloat(row.debit_amount) || 0;
      const credit = parseFloat(row.credit_amount) || 0;
      // For debit-normal accounts: balance increases with debit, decreases with credit
      // For credit-normal accounts: balance increases with credit, decreases with debit
      if (isDebitNormal) {
        runningBalance += debit - credit;
      } else {
        runningBalance += credit - debit;
      }
      return { ...row, runningBalance };
    });
  }, [ledgerData, accountInfo]);

  // Summary
  const summary = useMemo(() => {
    const totalDebit = ledgerData.reduce((s, r) => s + (parseFloat(r.debit_amount) || 0), 0);
    const totalCredit = ledgerData.reduce((s, r) => s + (parseFloat(r.credit_amount) || 0), 0);
    const opening = parseFloat(accountInfo?.opening_balance) || 0;
    const isDebitNormal = accountInfo?.normal_balance === 'debit';
    const closing = isDebitNormal
      ? opening + totalDebit - totalCredit
      : opening + totalCredit - totalDebit;
    return { totalDebit, totalCredit, opening, closing };
  }, [ledgerData, accountInfo]);

  // Quick period select
  const selectPeriod = (period) => {
    setDateFrom(period.start_date);
    setDateTo(period.end_date);
  };

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <div className="bg-white dark:bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-200/50 dark:border-slate-700/50 p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="material-symbols-outlined text-blue-600 text-[22px]">menu_book</span>
          <h2 className="text-base font-black text-slate-800 uppercase tracking-wide">Sổ Cái — General Ledger</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Account select */}
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Tài khoản</label>
            <select value={selectedAccount} onChange={e => setSelectedAccount(e.target.value)}
              className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none cursor-pointer focus:ring-2 focus:ring-blue-500/20">
              <option value="">— Chọn tài khoản —</option>
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.account_number} — {a.name}</option>
              ))}
            </select>
          </div>
          {/* Date range */}
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Từ ngày</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Đến ngày</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none" />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Quick period buttons */}
          <span className="text-xs font-bold text-slate-400 uppercase">Kỳ nhanh:</span>
          {periods.slice(0, 6).map(p => (
            <button key={p.id} onClick={() => selectPeriod(p)}
              className={`text-[11px] font-bold px-3 py-1 rounded-lg border transition-colors cursor-pointer ${
                dateFrom === p.start_date && dateTo === p.end_date
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600'
              }`}>
              {p.name}
            </button>
          ))}
          <label className="flex items-center gap-1.5 text-xs text-slate-500 ml-auto cursor-pointer">
            <input type="checkbox" checked={onlyPosted} onChange={e => setOnlyPosted(e.target.checked)} className="rounded cursor-pointer" />
            Chỉ bút toán đã ghi sổ
          </label>
        </div>
      </div>

      {/* Account Info + Summary */}
      {accountInfo && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-4 shadow-lg text-white">
            <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">Tài khoản</p>
            <p className="text-2xl font-black mt-1">{accountInfo.account_number}</p>
            <p className="text-xs opacity-90 mt-0.5">{accountInfo.name}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200/50 p-4 shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase">Số dư đầu kỳ</p>
            <p className="text-xl font-black text-slate-800 mt-1 tabular-nums">{fmt(summary.opening)}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Dư {accountInfo.normal_balance === 'debit' ? 'Nợ' : 'Có'}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200/50 p-4 shadow-sm">
            <div className="flex justify-between">
              <div>
                <p className="text-[10px] font-bold text-blue-500 uppercase">PS Nợ</p>
                <p className="text-lg font-black text-blue-700 mt-1 tabular-nums">{fmt(summary.totalDebit)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-orange-500 uppercase">PS Có</p>
                <p className="text-lg font-black text-orange-600 mt-1 tabular-nums">{fmt(summary.totalCredit)}</p>
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl p-4 shadow-lg text-white">
            <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">Số dư cuối kỳ</p>
            <p className="text-2xl font-black mt-1 tabular-nums">{fmt(summary.closing)}</p>
            <p className="text-[10px] opacity-90 mt-0.5">Dư {accountInfo.normal_balance === 'debit' ? 'Nợ' : 'Có'}</p>
          </div>
        </div>
      )}

      {/* Ledger Table */}
      <div className="bg-white dark:bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-sm overflow-hidden">
        {!selectedAccount ? (
          <div className="text-center py-16 text-slate-400">
            <span className="material-symbols-outlined text-5xl mb-3 block text-slate-200">menu_book</span>
            <p className="font-bold">Chọn tài khoản để xem Sổ Cái</p>
          </div>
        ) : loading ? (
          <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
        ) : ledgerWithBalance.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <span className="material-symbols-outlined text-5xl mb-3 block text-slate-200">search_off</span>
            <p className="font-bold">Không có phát sinh trong khoảng thời gian này</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Ngày</th>
                  <th className="py-3 px-4">Số CT</th>
                  <th className="py-3 px-4">Loại</th>
                  <th className="py-3 px-4">Diễn giải</th>
                  <th className="py-3 px-4 text-right">Nợ</th>
                  <th className="py-3 px-4 text-right">Có</th>
                  <th className="py-3 px-4 text-right">Số dư</th>
                </tr>
              </thead>
              <tbody>
                {/* Opening balance row */}
                <tr className="bg-blue-50/50 border-b border-slate-100 font-bold">
                  <td className="py-2.5 px-4 text-sm text-slate-500" colSpan={4}>
                    <span className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[14px] text-blue-500">arrow_forward</span>
                      Số dư đầu kỳ
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono text-sm text-blue-600">—</td>
                  <td className="py-2.5 px-4 text-right font-mono text-sm text-orange-600">—</td>
                  <td className="py-2.5 px-4 text-right font-mono text-sm font-black text-slate-800">{fmt(summary.opening)}</td>
                </tr>
                {ledgerWithBalance.map((row, i) => {
                  const entry = row.acc_journal_entries;
                  const TYPES = {
                    general: 'TH', cash_receipt: 'PT', cash_payment: 'PC',
                    bank_receipt: 'BC', bank_payment: 'BN', sales: 'BH',
                    purchase: 'MH', payroll: 'LG', depreciation: 'KH',
                    adjustment: 'DC', closing: 'KC', opening: 'MS', reversal: 'DN',
                  };
                  return (
                    <tr key={row.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="py-2.5 px-4 text-sm text-slate-600">{fmtDate(entry?.entry_date)}</td>
                      <td className="py-2.5 px-4">
                        <span className="font-mono font-bold text-[13px] text-slate-800">{entry?.entry_number}</span>
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{TYPES[entry?.journal_type] || 'TH'}</span>
                      </td>
                      <td className="py-2.5 px-4 text-sm text-slate-600 max-w-[300px] truncate">
                        {row.description || entry?.description || '—'}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-sm text-blue-700 font-bold">
                        {row.debit_amount > 0 ? fmt(row.debit_amount) : ''}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-sm text-orange-600 font-bold">
                        {row.credit_amount > 0 ? fmt(row.credit_amount) : ''}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-sm font-black text-slate-800">
                        {fmt(row.runningBalance)}
                      </td>
                    </tr>
                  );
                })}
                {/* Closing balance row */}
                <tr className="bg-emerald-50/50 border-t-2 border-emerald-200 font-bold">
                  <td className="py-3 px-4 text-sm text-emerald-700" colSpan={4}>
                    <span className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[14px] text-emerald-600">check_circle</span>
                      Số dư cuối kỳ ({ledgerData.length} phát sinh)
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-sm text-blue-700">{fmt(summary.totalDebit)}</td>
                  <td className="py-3 px-4 text-right font-mono text-sm text-orange-600">{fmt(summary.totalCredit)}</td>
                  <td className="py-3 px-4 text-right font-mono text-sm font-black text-emerald-700">{fmt(summary.closing)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
