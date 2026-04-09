import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

const JOURNAL_TYPES = {
  general: { label: 'Tổng hợp', prefix: 'TH', color: 'bg-slate-100 text-slate-700' },
  cash_receipt: { label: 'Phiếu thu', prefix: 'PT', color: 'bg-green-100 text-green-700' },
  cash_payment: { label: 'Phiếu chi', prefix: 'PC', color: 'bg-red-100 text-red-700' },
  bank_receipt: { label: 'Báo có NH', prefix: 'BC', color: 'bg-emerald-100 text-emerald-700' },
  bank_payment: { label: 'Báo nợ NH', prefix: 'BN', color: 'bg-orange-100 text-orange-700' },
  sales: { label: 'Bán hàng', prefix: 'BH', color: 'bg-blue-100 text-blue-700' },
  purchase: { label: 'Mua hàng', prefix: 'MH', color: 'bg-amber-100 text-amber-700' },
  payroll: { label: 'Lương', prefix: 'LG', color: 'bg-purple-100 text-purple-700' },
  depreciation: { label: 'Khấu hao', prefix: 'KH', color: 'bg-pink-100 text-pink-700' },
  adjustment: { label: 'Điều chỉnh', prefix: 'DC', color: 'bg-yellow-100 text-yellow-700' },
  closing: { label: 'Kết chuyển', prefix: 'KC', color: 'bg-indigo-100 text-indigo-700' },
  opening: { label: 'Số dư ĐK', prefix: 'MS', color: 'bg-cyan-100 text-cyan-700' },
  reversal: { label: 'Đảo ngược', prefix: 'DN', color: 'bg-rose-100 text-rose-700' },
};

const STATUS_MAP = {
  draft: { label: 'Nháp', color: 'bg-slate-100 text-slate-600 border-slate-200', icon: 'edit_note' },
  pending: { label: 'Chờ duyệt', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: 'pending' },
  approved: { label: 'Đã duyệt', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: 'task_alt' },
  posted: { label: 'Đã ghi sổ', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: 'check_circle' },
  reversed: { label: 'Đã đảo', color: 'bg-rose-100 text-rose-700 border-rose-200', icon: 'undo' },
  rejected: { label: 'Từ chối', color: 'bg-red-100 text-red-700 border-red-200', icon: 'cancel' },
};

function fmt(v) { return v ? Number(v).toLocaleString('vi-VN') : '—'; }
function fmtDate(d) { if (!d) return '—'; const dt = new Date(d); return dt.toLocaleDateString('vi-VN'); }

export default function JournalEntries() {
  const [entries, setEntries] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterPeriod, setFilterPeriod] = useState('all');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    journal_type: 'general', entry_date: new Date().toISOString().split('T')[0],
    description: '', reference_number: '', status: 'draft',
  });
  const [lines, setLines] = useState([
    { account_id: '', debit_amount: '', credit_amount: '', description: '' },
    { account_id: '', debit_amount: '', credit_amount: '', description: '' },
  ]);

  // Detail modal
  const [showDetail, setShowDetail] = useState(null);
  const [detailLines, setDetailLines] = useState([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [entriesRes, accountsRes, periodsRes] = await Promise.all([
      supabase.from('acc_journal_entries').select('*').order('entry_date', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('acc_accounts').select('id, account_number, name, normal_balance').eq('is_active', true).order('account_number'),
      supabase.from('acc_fiscal_periods').select('id, name, start_date, end_date, status, fiscal_year_id').order('start_date', { ascending: false }),
    ]);
    if (!entriesRes.error) setEntries(entriesRes.data || []);
    if (!accountsRes.error) setAccounts(accountsRes.data || []);
    if (!periodsRes.error) setPeriods(periodsRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Stats
  const stats = useMemo(() => ({
    total: entries.length,
    pending: entries.filter(e => e.status === 'pending').length,
    posted: entries.filter(e => e.status === 'posted').length,
    totalDebit: entries.filter(e => e.status === 'posted').reduce((s, e) => s + (parseFloat(e.total_debit) || 0), 0),
  }), [entries]);

  // Filtered
  const filtered = useMemo(() => entries.filter(e => {
    if (filterStatus !== 'all' && e.status !== filterStatus) return false;
    if (filterType !== 'all' && e.journal_type !== filterType) return false;
    if (filterPeriod !== 'all' && e.fiscal_period_id !== filterPeriod) return false;
    if (search) {
      const q = search.toLowerCase();
      return (e.entry_number || '').toLowerCase().includes(q) ||
        (e.description || '').toLowerCase().includes(q) ||
        (e.reference_number || '').toLowerCase().includes(q);
    }
    return true;
  }), [entries, filterStatus, filterType, filterPeriod, search]);

  // Auto-detect fiscal period from entry_date
  const detectPeriod = (date) => {
    const d = new Date(date);
    return periods.find(p => {
      const s = new Date(p.start_date); const e = new Date(p.end_date);
      return d >= s && d <= e;
    });
  };

  // Generate entry number
  const generateEntryNumber = async (type, date) => {
    const { data, error } = await supabase.rpc('generate_entry_number', { p_type: type, p_date: date });
    if (error) {
      // Fallback: client-side generation
      const prefix = JOURNAL_TYPES[type]?.prefix || 'TH';
      const year = new Date(date).getFullYear();
      const existing = entries.filter(e => e.entry_number?.startsWith(`${prefix}-${year}-`));
      const maxSeq = existing.reduce((max, e) => {
        const seq = parseInt(e.entry_number.split('-')[2]) || 0;
        return Math.max(max, seq);
      }, 0);
      return `${prefix}-${year}-${String(maxSeq + 1).padStart(6, '0')}`;
    }
    return data;
  };

  // Open create modal
  const openCreate = () => {
    setEditingEntry(null);
    setForm({
      journal_type: 'general', entry_date: new Date().toISOString().split('T')[0],
      description: '', reference_number: '', status: 'draft',
    });
    setLines([
      { account_id: '', debit_amount: '', credit_amount: '', description: '' },
      { account_id: '', debit_amount: '', credit_amount: '', description: '' },
    ]);
    setShowModal(true);
  };

  // Open edit modal
  const openEdit = async (entry) => {
    setEditingEntry(entry);
    setForm({
      journal_type: entry.journal_type, entry_date: entry.entry_date,
      description: entry.description || '', reference_number: entry.reference_number || '',
      status: entry.status,
    });
    // Fetch lines
    const { data } = await supabase.from('acc_journal_lines')
      .select('*').eq('journal_entry_id', entry.id).order('line_order');
    setLines(data?.length ? data.map(l => ({
      id: l.id, account_id: l.account_id,
      debit_amount: l.debit_amount > 0 ? String(l.debit_amount) : '',
      credit_amount: l.credit_amount > 0 ? String(l.credit_amount) : '',
      description: l.description || '',
    })) : [
      { account_id: '', debit_amount: '', credit_amount: '', description: '' },
      { account_id: '', debit_amount: '', credit_amount: '', description: '' },
    ]);
    setShowModal(true);
  };

  // View detail
  const openDetail = async (entry) => {
    setShowDetail(entry);
    const { data } = await supabase.from('acc_journal_lines')
      .select('*, acc_accounts(account_number, name)')
      .eq('journal_entry_id', entry.id).order('line_order');
    setDetailLines(data || []);
  };

  // Add line
  const addLine = () => setLines(prev => [...prev, { account_id: '', debit_amount: '', credit_amount: '', description: '' }]);
  const removeLine = (idx) => { if (lines.length > 2) setLines(prev => prev.filter((_, i) => i !== idx)); };

  // Update line
  const updateLine = (idx, field, value) => {
    setLines(prev => prev.map((l, i) => {
      if (i !== idx) return l;
      const updated = { ...l, [field]: value };
      // If entering debit, clear credit and vice versa
      if (field === 'debit_amount' && value) updated.credit_amount = '';
      if (field === 'credit_amount' && value) updated.debit_amount = '';
      return updated;
    }));
  };

  // Totals
  const totals = useMemo(() => {
    const d = lines.reduce((s, l) => s + (parseFloat(l.debit_amount) || 0), 0);
    const c = lines.reduce((s, l) => s + (parseFloat(l.credit_amount) || 0), 0);
    return { debit: d, credit: c, diff: d - c, balanced: Math.abs(d - c) < 0.01 };
  }, [lines]);

  // Save
  const handleSave = async (postStatus = 'draft') => {
    // Validate
    const validLines = lines.filter(l => l.account_id && (parseFloat(l.debit_amount) > 0 || parseFloat(l.credit_amount) > 0));
    if (validLines.length < 2) return alert('Bút toán cần ít nhất 2 dòng hợp lệ!');
    if (!totals.balanced) return alert('Bút toán chưa cân bằng! Chênh lệch: ' + fmt(totals.diff));

    const period = detectPeriod(form.entry_date);
    if (period?.status === 'hard_close') return alert('Kỳ kế toán đã khóa! Không thể tạo bút toán.');

    setSaving(true);
    try {
      let entryId;
      if (editingEntry) {
        // Update existing
        const { error } = await supabase.from('acc_journal_entries').update({
          journal_type: form.journal_type, entry_date: form.entry_date,
          description: form.description, reference_number: form.reference_number || null,
          fiscal_period_id: period?.id || null,
          total_debit: totals.debit, total_credit: totals.credit,
          status: postStatus, updated_at: new Date().toISOString(),
        }).eq('id', editingEntry.id);
        if (error) throw error;
        entryId = editingEntry.id;
        // Delete old lines
        await supabase.from('acc_journal_lines').delete().eq('journal_entry_id', entryId);
      } else {
        // Create new
        const entryNumber = await generateEntryNumber(form.journal_type, form.entry_date);
        const { data, error } = await supabase.from('acc_journal_entries').insert({
          entry_number: entryNumber,
          journal_type: form.journal_type, entry_date: form.entry_date,
          journal_source: 'manual', status: postStatus,
          description: form.description, reference_number: form.reference_number || null,
          fiscal_period_id: period?.id || null,
          total_debit: totals.debit, total_credit: totals.credit,
          created_by: (await supabase.auth.getUser()).data?.user?.email || 'system',
        }).select().single();
        if (error) throw error;
        entryId = data.id;
      }

      // Insert lines
      const linePayloads = validLines.map((l, i) => ({
        journal_entry_id: entryId, account_id: l.account_id,
        debit_amount: parseFloat(l.debit_amount) || 0,
        credit_amount: parseFloat(l.credit_amount) || 0,
        description: l.description || null, line_order: i + 1,
      }));
      const { error: lineError } = await supabase.from('acc_journal_lines').insert(linePayloads);
      if (lineError) throw lineError;

      setShowModal(false);
      fetchData();
    } catch (e) {
      alert('Lỗi: ' + (e.message || e));
    }
    setSaving(false);
  };

  // Status actions
  const updateStatus = async (entry, newStatus, extraFields = {}) => {
    const user = (await supabase.auth.getUser()).data?.user?.email || 'system';
    const updates = { status: newStatus, updated_at: new Date().toISOString(), ...extraFields };
    if (newStatus === 'approved') { updates.approved_by = user; updates.approved_at = new Date().toISOString(); }
    if (newStatus === 'posted') { updates.posted_by = user; updates.posted_at = new Date().toISOString(); }
    if (newStatus === 'reversed') { updates.reversed_by = user; updates.reversed_at = new Date().toISOString(); }

    const { error } = await supabase.from('acc_journal_entries').update(updates).eq('id', entry.id);
    if (error) { alert('Lỗi: ' + error.message); return; }
    fetchData();
    if (showDetail?.id === entry.id) setShowDetail({ ...entry, ...updates });
  };

  // Account search helper
  const AccountSelect = ({ value, onChange }) => (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="w-full px-2 py-2 text-sm bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer">
      <option value="">— Chọn TK —</option>
      {accounts.map(a => <option key={a.id} value={a.id}>{a.account_number} - {a.name}</option>)}
    </select>
  );

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Tổng bút toán', value: stats.total, icon: 'receipt_long', color: 'from-blue-500 to-indigo-600' },
          { label: 'Chờ duyệt', value: stats.pending, icon: 'pending', color: 'from-amber-500 to-orange-600' },
          { label: 'Đã ghi sổ', value: stats.posted, icon: 'check_circle', color: 'from-emerald-500 to-green-600' },
          { label: 'Tổng PS Nợ (đã ghi)', value: fmt(stats.totalDebit), icon: 'account_balance', color: 'from-purple-500 to-pink-600', small: true },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-200/50 dark:border-slate-700/50 p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center shadow-lg`}>
                <span className="material-symbols-outlined text-white text-[20px]">{s.icon}</span>
              </div>
              <div>
                <p className={`${s.small ? 'text-lg' : 'text-2xl'} font-black text-slate-900 dark:text-white`}>{s.value}</p>
                <p className="text-[11px] text-slate-500 font-medium">{s.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="bg-white dark:bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-200/50 dark:border-slate-700/50 p-4 shadow-sm">
        <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
          <div className="flex flex-1 gap-3 items-center flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
              <input type="text" placeholder="Tìm số CT, diễn giải..." value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500/30 outline-none" />
            </div>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none cursor-pointer">
              <option value="all">Tất cả TT</option>
              {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <select value={filterType} onChange={e => setFilterType(e.target.value)}
              className="px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none cursor-pointer">
              <option value="all">Tất cả loại</option>
              {Object.entries(JOURNAL_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <button onClick={openCreate}
            className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-bold rounded-xl shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 transition-all flex items-center gap-2 cursor-pointer">
            <span className="material-symbols-outlined text-[18px]">add</span> Tạo bút toán
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <span className="material-symbols-outlined text-5xl mb-3 block text-slate-200">receipt_long</span>
            <p className="font-bold">Chưa có bút toán nào</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Số chứng từ</th>
                  <th className="py-3 px-4">Ngày</th>
                  <th className="py-3 px-4">Loại</th>
                  <th className="py-3 px-4">Diễn giải</th>
                  <th className="py-3 px-4 text-right">Nợ</th>
                  <th className="py-3 px-4 text-right">Có</th>
                  <th className="py-3 px-4 text-center">Trạng thái</th>
                  <th className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(e => {
                  const typeInfo = JOURNAL_TYPES[e.journal_type] || JOURNAL_TYPES.general;
                  const statusInfo = STATUS_MAP[e.status] || STATUS_MAP.draft;
                  return (
                    <tr key={e.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors cursor-pointer" onClick={() => openDetail(e)}>
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-sm text-slate-800">{e.entry_number}</span>
                        {e.reference_number && <span className="block text-[10px] text-slate-400 mt-0.5">Ref: {e.reference_number}</span>}
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-600">{fmtDate(e.entry_date)}</td>
                      <td className="py-3 px-4">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${typeInfo.color}`}>{typeInfo.label}</span>
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-700 max-w-[300px] truncate">{e.description || '—'}</td>
                      <td className="py-3 px-4 text-right font-mono text-sm font-bold text-blue-700">{fmt(e.total_debit)}</td>
                      <td className="py-3 px-4 text-right font-mono text-sm font-bold text-orange-600">{fmt(e.total_credit)}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusInfo.color}`}>
                          <span className="material-symbols-outlined text-[12px]">{statusInfo.icon}</span>
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right" onClick={ev => ev.stopPropagation()}>
                        <div className="flex items-center gap-1 justify-end">
                          {e.status === 'draft' && (
                            <>
                              <button onClick={() => openEdit(e)} title="Sửa" className="p-1 text-slate-400 hover:text-blue-600 transition-colors cursor-pointer">
                                <span className="material-symbols-outlined text-[18px]">edit</span>
                              </button>
                              <button onClick={() => updateStatus(e, 'pending')} title="Gửi duyệt" className="p-1 text-slate-400 hover:text-amber-600 transition-colors cursor-pointer">
                                <span className="material-symbols-outlined text-[18px]">send</span>
                              </button>
                            </>
                          )}
                          {e.status === 'pending' && (
                            <>
                              <button onClick={() => updateStatus(e, 'approved')} title="Duyệt" className="p-1 text-slate-400 hover:text-green-600 transition-colors cursor-pointer">
                                <span className="material-symbols-outlined text-[18px]">task_alt</span>
                              </button>
                              <button onClick={() => updateStatus(e, 'rejected')} title="Từ chối" className="p-1 text-slate-400 hover:text-red-600 transition-colors cursor-pointer">
                                <span className="material-symbols-outlined text-[18px]">cancel</span>
                              </button>
                            </>
                          )}
                          {e.status === 'approved' && (
                            <button onClick={() => updateStatus(e, 'posted')} title="Ghi sổ" className="p-1 text-slate-400 hover:text-emerald-600 transition-colors cursor-pointer">
                              <span className="material-symbols-outlined text-[18px]">check_circle</span>
                            </button>
                          )}
                          {e.status === 'posted' && (
                            <button onClick={() => { if (window.confirm('Đảo ngược bút toán này?')) updateStatus(e, 'reversed'); }} title="Đảo ngược" className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer">
                              <span className="material-symbols-outlined text-[18px]">undo</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ===== MODAL: Create / Edit Entry ===== */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col border border-slate-200">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600">receipt_long</span>
                {editingEntry ? `Sửa bút toán: ${editingEntry.entry_number}` : 'Tạo bút toán mới'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-red-500 transition-colors cursor-pointer">
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-5">
              {/* Header fields */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Loại phiếu</label>
                  <select value={form.journal_type} onChange={e => setForm(p => ({ ...p, journal_type: e.target.value }))}
                    disabled={!!editingEntry}
                    className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none cursor-pointer disabled:opacity-50">
                    {Object.entries(JOURNAL_TYPES).map(([k, v]) => <option key={k} value={k}>{v.prefix} — {v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Ngày chứng từ</label>
                  <input type="date" value={form.entry_date} onChange={e => setForm(p => ({ ...p, entry_date: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Số tham chiếu</label>
                  <input type="text" value={form.reference_number} onChange={e => setForm(p => ({ ...p, reference_number: e.target.value }))}
                    placeholder="Số HĐ, phiếu gốc..." className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Kỳ kế toán</label>
                  <div className="px-3 py-2.5 text-sm bg-slate-100 border border-slate-200 rounded-xl text-slate-600 font-medium">
                    {detectPeriod(form.entry_date)?.name || <span className="text-amber-500">Không xác định</span>}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Diễn giải</label>
                <input type="text" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="VD: Thu tiền KH theo HĐ 001..." className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none" />
              </div>

              {/* Journal Lines */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-50 px-4 py-2.5 flex justify-between items-center border-b border-slate-200">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px]">table_rows</span> Chi tiết định khoản
                  </span>
                  <button onClick={addLine} className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer">
                    <span className="material-symbols-outlined text-[16px]">add_circle</span> Thêm dòng
                  </button>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                      <th className="py-2 px-3 text-left w-8">#</th>
                      <th className="py-2 px-3 text-left">Tài khoản</th>
                      <th className="py-2 px-3 text-right w-[160px]">Nợ</th>
                      <th className="py-2 px-3 text-right w-[160px]">Có</th>
                      <th className="py-2 px-3 text-left">Diễn giải dòng</th>
                      <th className="py-2 px-3 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, idx) => (
                      <tr key={idx} className="border-b border-slate-50 hover:bg-blue-50/30">
                        <td className="py-2 px-3 text-xs text-slate-400 font-bold">{idx + 1}</td>
                        <td className="py-2 px-3">
                          <AccountSelect value={line.account_id} onChange={v => updateLine(idx, 'account_id', v)} />
                        </td>
                        <td className="py-2 px-3">
                          <input type="number" min="0" value={line.debit_amount} onChange={e => updateLine(idx, 'debit_amount', e.target.value)}
                            placeholder="0" className="w-full px-2 py-2 text-sm font-mono text-right bg-blue-50/50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20" />
                        </td>
                        <td className="py-2 px-3">
                          <input type="number" min="0" value={line.credit_amount} onChange={e => updateLine(idx, 'credit_amount', e.target.value)}
                            placeholder="0" className="w-full px-2 py-2 text-sm font-mono text-right bg-orange-50/50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-500/20" />
                        </td>
                        <td className="py-2 px-3">
                          <input type="text" value={line.description} onChange={e => updateLine(idx, 'description', e.target.value)}
                            placeholder="..." className="w-full px-2 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg outline-none" />
                        </td>
                        <td className="py-2 px-3">
                          {lines.length > 2 && (
                            <button onClick={() => removeLine(idx)} className="text-slate-300 hover:text-red-500 transition-colors cursor-pointer">
                              <span className="material-symbols-outlined text-[16px]">delete</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 font-bold border-t-2 border-slate-200">
                      <td className="py-3 px-3" colSpan={2}>
                        <span className="text-xs text-slate-500 uppercase">Tổng cộng</span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-sm text-blue-700">{fmt(totals.debit)}</td>
                      <td className="py-3 px-3 text-right font-mono text-sm text-orange-600">{fmt(totals.credit)}</td>
                      <td className="py-3 px-3" colSpan={2}>
                        {totals.debit > 0 || totals.credit > 0 ? (
                          totals.balanced ? (
                            <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                              <span className="material-symbols-outlined text-[14px]">check_circle</span> Cân bằng
                            </span>
                          ) : (
                            <span className="text-xs font-bold text-rose-600 flex items-center gap-1">
                              <span className="material-symbols-outlined text-[14px]">error</span> Lệch: {fmt(Math.abs(totals.diff))}
                            </span>
                          )
                        ) : null}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
              <div className="text-xs text-slate-400">
                {detectPeriod(form.entry_date)?.status === 'hard_close' && (
                  <span className="text-rose-500 font-bold flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">lock</span> Kỳ kế toán đã khóa!
                  </span>
                )}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowModal(false)} className="px-4 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer">Hủy</button>
                <button onClick={() => handleSave('draft')} disabled={saving || !totals.balanced}
                  className="px-5 py-2.5 text-sm font-bold text-white bg-slate-600 rounded-xl hover:bg-slate-700 transition-all disabled:opacity-50 cursor-pointer flex items-center gap-2">
                  {saving && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />}
                  <span className="material-symbols-outlined text-[16px]">save</span> Lưu nháp
                </button>
                <button onClick={() => handleSave('pending')} disabled={saving || !totals.balanced}
                  className="px-5 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 transition-all disabled:opacity-50 cursor-pointer flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px]">send</span> Lưu & Gửi duyệt
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL: Detail View ===== */}
      {showDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowDetail(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col border border-slate-200" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-600">receipt_long</span>
                  {showDetail.entry_number}
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ml-2 ${STATUS_MAP[showDetail.status]?.color}`}>
                    {STATUS_MAP[showDetail.status]?.label}
                  </span>
                </h3>
                <p className="text-sm text-slate-500 mt-1 ml-7">{showDetail.description || 'Không có diễn giải'}</p>
              </div>
              <button onClick={() => setShowDetail(null)} className="text-slate-400 hover:text-red-500 cursor-pointer">
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {/* Info grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="bg-slate-50 rounded-xl p-3">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Loại phiếu</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full mt-1 inline-block ${JOURNAL_TYPES[showDetail.journal_type]?.color}`}>
                    {JOURNAL_TYPES[showDetail.journal_type]?.label}
                  </span>
                </div>
                <div className="bg-slate-50 rounded-xl p-3">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Ngày CT</span>
                  <span className="font-bold text-slate-800 mt-1 block">{fmtDate(showDetail.entry_date)}</span>
                </div>
                <div className="bg-slate-50 rounded-xl p-3">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Số tham chiếu</span>
                  <span className="font-bold text-slate-800 mt-1 block">{showDetail.reference_number || '—'}</span>
                </div>
                <div className="bg-slate-50 rounded-xl p-3">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Người tạo</span>
                  <span className="font-bold text-slate-800 mt-1 block">{showDetail.created_by || '—'}</span>
                </div>
              </div>

              {/* Lines table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200">
                      <th className="py-2.5 px-4 text-left">#</th>
                      <th className="py-2.5 px-4 text-left">Mã TK</th>
                      <th className="py-2.5 px-4 text-left">Tên tài khoản</th>
                      <th className="py-2.5 px-4 text-left">Diễn giải</th>
                      <th className="py-2.5 px-4 text-right">Nợ</th>
                      <th className="py-2.5 px-4 text-right">Có</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailLines.map((l, i) => (
                      <tr key={l.id} className="border-b border-slate-50">
                        <td className="py-2.5 px-4 text-xs text-slate-400">{i + 1}</td>
                        <td className="py-2.5 px-4 font-mono font-bold text-sm text-slate-800">{l.acc_accounts?.account_number}</td>
                        <td className="py-2.5 px-4 text-sm text-slate-600">{l.acc_accounts?.name}</td>
                        <td className="py-2.5 px-4 text-sm text-slate-500 italic">{l.description || '—'}</td>
                        <td className="py-2.5 px-4 text-right font-mono text-sm font-bold text-blue-700">{l.debit_amount > 0 ? fmt(l.debit_amount) : ''}</td>
                        <td className="py-2.5 px-4 text-right font-mono text-sm font-bold text-orange-600">{l.credit_amount > 0 ? fmt(l.credit_amount) : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 font-bold border-t-2 border-slate-200">
                      <td className="py-3 px-4" colSpan={4}><span className="text-xs text-slate-500 uppercase">Tổng cộng</span></td>
                      <td className="py-3 px-4 text-right font-mono text-sm text-blue-700">{fmt(showDetail.total_debit)}</td>
                      <td className="py-3 px-4 text-right font-mono text-sm text-orange-600">{fmt(showDetail.total_credit)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Audit info */}
              {(showDetail.approved_by || showDetail.posted_by) && (
                <div className="flex gap-4 text-[11px] text-slate-500">
                  {showDetail.approved_by && <span>✅ Duyệt: {showDetail.approved_by} ({fmtDate(showDetail.approved_at)})</span>}
                  {showDetail.posted_by && <span>📗 Ghi sổ: {showDetail.posted_by} ({fmtDate(showDetail.posted_at)})</span>}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              {showDetail.status === 'draft' && (
                <button onClick={() => { openEdit(showDetail); setShowDetail(null); }}
                  className="px-4 py-2 text-sm font-bold text-blue-600 bg-blue-50 rounded-xl hover:bg-blue-100 cursor-pointer flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">edit</span> Sửa
                </button>
              )}
              {showDetail.status === 'draft' && (
                <button onClick={() => { updateStatus(showDetail, 'pending'); }}
                  className="px-4 py-2 text-sm font-bold text-amber-700 bg-amber-50 rounded-xl hover:bg-amber-100 cursor-pointer flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">send</span> Gửi duyệt
                </button>
              )}
              {showDetail.status === 'pending' && (
                <>
                  <button onClick={() => updateStatus(showDetail, 'approved')}
                    className="px-4 py-2 text-sm font-bold text-green-700 bg-green-50 rounded-xl hover:bg-green-100 cursor-pointer flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px]">task_alt</span> Duyệt
                  </button>
                  <button onClick={() => updateStatus(showDetail, 'rejected')}
                    className="px-4 py-2 text-sm font-bold text-red-700 bg-red-50 rounded-xl hover:bg-red-100 cursor-pointer flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px]">cancel</span> Từ chối
                  </button>
                </>
              )}
              {showDetail.status === 'approved' && (
                <button onClick={() => updateStatus(showDetail, 'posted')}
                  className="px-4 py-2 text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-green-600 rounded-xl shadow-lg cursor-pointer flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">check_circle</span> Ghi sổ
                </button>
              )}
              <button onClick={() => setShowDetail(null)} className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 cursor-pointer">Đóng</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
