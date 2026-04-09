import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

const ACCOUNT_GROUPS = {
  1: 'Tài sản ngắn hạn',
  2: 'Tài sản dài hạn',
  3: 'Nợ phải trả',
  4: 'Vốn chủ sở hữu',
  5: 'Doanh thu',
  6: 'Chi phí SXKD',
  7: 'Thu nhập khác',
  8: 'Chi phí khác',
  9: 'Xác định KQKD',
};

const ACCOUNT_TYPES = {
  asset: { label: 'Tài sản', color: 'text-blue-600 bg-blue-50' },
  liability: { label: 'Nợ phải trả', color: 'text-orange-600 bg-orange-50' },
  equity: { label: 'Vốn CSH', color: 'text-purple-600 bg-purple-50' },
  revenue: { label: 'Doanh thu', color: 'text-green-600 bg-green-50' },
  expense: { label: 'Chi phí', color: 'text-red-600 bg-red-50' },
  contra_asset: { label: 'Giảm TS', color: 'text-slate-600 bg-slate-100' },
  contra_revenue: { label: 'Giảm DT', color: 'text-yellow-700 bg-yellow-50' },
};

function formatVND(val) {
  if (!val || val === 0) return '—';
  return Number(val).toLocaleString('vi-VN');
}

export default function ChartOfAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterGroup, setFilterGroup] = useState('all');
  const [expandedGroups, setExpandedGroups] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    account_number: '', name: '', name_en: '', description: '',
    account_type: 'asset', account_group: 1, normal_balance: 'debit',
    parent_id: '', level: 1, is_bank_account: false, opening_balance: 0,
  });

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('acc_accounts')
      .select('*')
      .order('account_number', { ascending: true });
    if (!error) setAccounts(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  // Build tree structure
  const tree = useMemo(() => {
    const filtered = accounts.filter(a => {
      const matchSearch = !search || 
        a.account_number.includes(search) || 
        a.name.toLowerCase().includes(search.toLowerCase()) ||
        (a.name_en && a.name_en.toLowerCase().includes(search.toLowerCase()));
      const matchGroup = filterGroup === 'all' || a.account_group === parseInt(filterGroup);
      return matchSearch && matchGroup;
    });

    // Group by account_group
    const groups = {};
    filtered.forEach(a => {
      if (!groups[a.account_group]) groups[a.account_group] = [];
      groups[a.account_group].push(a);
    });

    // Build parent-child within each group
    Object.keys(groups).forEach(g => {
      const items = groups[g];
      const parents = items.filter(a => !a.parent_id || !items.find(p => p.id === a.parent_id));
      const childMap = {};
      items.forEach(a => {
        if (a.parent_id) {
          if (!childMap[a.parent_id]) childMap[a.parent_id] = [];
          childMap[a.parent_id].push(a);
        }
      });
      groups[g] = { parents, childMap };
    });

    return groups;
  }, [accounts, search, filterGroup]);

  const toggleGroup = (g) => setExpandedGroups(prev => ({ ...prev, [g]: !prev[g] }));

  const parentAccounts = useMemo(() => accounts.filter(a => a.level === 1), [accounts]);

  const openAdd = (parentAccount = null) => {
    setEditingAccount(null);
    setForm({
      account_number: '', name: '', name_en: '', description: '',
      account_type: parentAccount?.account_type || 'asset',
      account_group: parentAccount?.account_group || 1,
      normal_balance: parentAccount?.normal_balance || 'debit',
      parent_id: parentAccount?.id || '',
      level: parentAccount ? parentAccount.level + 1 : 1,
      is_bank_account: false, opening_balance: 0,
    });
    setShowModal(true);
  };

  const openEdit = (acc) => {
    setEditingAccount(acc);
    setForm({
      account_number: acc.account_number, name: acc.name, name_en: acc.name_en || '',
      description: acc.description || '', account_type: acc.account_type,
      account_group: acc.account_group, normal_balance: acc.normal_balance,
      parent_id: acc.parent_id || '', level: acc.level, is_bank_account: acc.is_bank_account,
      opening_balance: acc.opening_balance || 0,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.account_number || !form.name) return;
    setSaving(true);
    const payload = {
      ...form,
      parent_id: form.parent_id || null,
      opening_balance: parseFloat(form.opening_balance) || 0,
      updated_at: new Date().toISOString(),
    };
    
    let error;
    if (editingAccount) {
      ({ error } = await supabase.from('acc_accounts').update(payload).eq('id', editingAccount.id));
    } else {
      payload.is_system_account = false;
      ({ error } = await supabase.from('acc_accounts').insert(payload));
    }

    if (error) {
      alert('Lỗi: ' + error.message);
    } else {
      setShowModal(false);
      fetchAccounts();
    }
    setSaving(false);
  };

  const toggleActive = async (acc) => {
    if (acc.is_system_account) return alert('Không thể vô hiệu hóa tài khoản hệ thống!');
    await supabase.from('acc_accounts').update({ is_active: !acc.is_active, updated_at: new Date().toISOString() }).eq('id', acc.id);
    fetchAccounts();
  };

  const stats = useMemo(() => ({
    total: accounts.length,
    active: accounts.filter(a => a.is_active).length,
    level1: accounts.filter(a => a.level === 1).length,
    level2: accounts.filter(a => a.level >= 2).length,
  }), [accounts]);

  // ─── Render ────────────────────────────────────────────────
  const AccountRow = ({ acc, indent = 0, childMap }) => {
    const children = childMap[acc.id] || [];
    const [expanded, setExpanded] = useState(true);
    const typeInfo = ACCOUNT_TYPES[acc.account_type] || {};

    return (
      <>
        <tr className={`border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors ${!acc.is_active ? 'opacity-40' : ''}`}>
          <td className="py-2.5 px-3">
            <div className="flex items-center" style={{ paddingLeft: `${indent * 24}px` }}>
              {children.length > 0 ? (
                <button onClick={() => setExpanded(!expanded)} className="mr-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer">
                  <span className={`material-symbols-outlined text-[16px] transition-transform ${expanded ? '' : '-rotate-90'}`}>expand_more</span>
                </button>
              ) : <span className="w-[22px] inline-block" />}
              <span className={`font-mono font-bold text-[13px] ${acc.level === 1 ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'}`}>
                {acc.account_number}
              </span>
            </div>
          </td>
          <td className="py-2.5 px-3">
            <div className={`text-[13px] ${acc.level === 1 ? 'font-bold text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>
              {acc.name}
            </div>
            {acc.name_en && <div className="text-[11px] text-slate-400 italic">{acc.name_en}</div>}
          </td>
          <td className="py-2.5 px-3">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${typeInfo.color}`}>
              {typeInfo.label}
            </span>
          </td>
          <td className="py-2.5 px-3 text-center">
            <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${acc.normal_balance === 'debit' ? 'text-blue-600 bg-blue-50' : 'text-orange-600 bg-orange-50'}`}>
              {acc.normal_balance === 'debit' ? 'Nợ' : 'Có'}
            </span>
          </td>
          <td className="py-2.5 px-3 text-right font-mono text-[12px] text-slate-600 dark:text-slate-400">
            {formatVND(acc.opening_balance)}
          </td>
          <td className="py-2.5 px-3 text-right font-mono text-[12px] font-bold text-slate-800 dark:text-white">
            {formatVND(acc.current_balance)}
          </td>
          <td className="py-2.5 px-3">
            <div className="flex items-center gap-1 justify-end">
              {acc.level === 1 && (
                <button onClick={() => openAdd(acc)} title="Thêm TK con" className="p-1 text-slate-400 hover:text-blue-600 transition-colors cursor-pointer">
                  <span className="material-symbols-outlined text-[16px]">add_circle</span>
                </button>
              )}
              <button onClick={() => openEdit(acc)} title="Sửa" className="p-1 text-slate-400 hover:text-amber-600 transition-colors cursor-pointer">
                <span className="material-symbols-outlined text-[16px]">edit</span>
              </button>
              {!acc.is_system_account && (
                <button onClick={() => toggleActive(acc)} title={acc.is_active ? 'Vô hiệu hóa' : 'Kích hoạt lại'} className="p-1 text-slate-400 hover:text-red-500 transition-colors cursor-pointer">
                  <span className="material-symbols-outlined text-[16px]">{acc.is_active ? 'toggle_on' : 'toggle_off'}</span>
                </button>
              )}
            </div>
          </td>
        </tr>
        {expanded && children.map(child => (
          <AccountRow key={child.id} acc={child} indent={indent + 1} childMap={childMap} />
        ))}
      </>
    );
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Tổng tài khoản', value: stats.total, icon: 'account_tree', color: 'from-blue-500 to-indigo-600' },
          { label: 'Đang hoạt động', value: stats.active, icon: 'check_circle', color: 'from-emerald-500 to-green-600' },
          { label: 'TK cấp 1', value: stats.level1, icon: 'folder', color: 'from-amber-500 to-orange-600' },
          { label: 'TK chi tiết', value: stats.level2, icon: 'description', color: 'from-purple-500 to-pink-600' },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-200/50 dark:border-slate-700/50 p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center shadow-lg`}>
                <span className="material-symbols-outlined text-white text-[20px]">{s.icon}</span>
              </div>
              <div>
                <p className="text-2xl font-black text-slate-900 dark:text-white">{s.value}</p>
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
              <input type="text" placeholder="Tìm mã TK hoặc tên..." value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition-all" />
            </div>
            <select value={filterGroup} onChange={e => setFilterGroup(e.target.value)}
              className="px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500/30 outline-none cursor-pointer">
              <option value="all">Tất cả nhóm</option>
              {Object.entries(ACCOUNT_GROUPS).map(([k, v]) => (
                <option key={k} value={k}>Nhóm {k}: {v}</option>
              ))}
            </select>
          </div>
          <button onClick={() => openAdd()} className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-bold rounded-xl shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 transition-all flex items-center gap-2 cursor-pointer">
            <span className="material-symbols-outlined text-[18px]">add</span>
            Thêm tài khoản
          </button>
        </div>
      </div>

      {/* Account Tree Table */}
      <div className="bg-white dark:bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-3 w-[140px]">Mã TK</th>
                  <th className="py-3 px-3">Tên tài khoản</th>
                  <th className="py-3 px-3 w-[100px]">Loại</th>
                  <th className="py-3 px-3 w-[60px] text-center">Tính chất</th>
                  <th className="py-3 px-3 w-[130px] text-right">Số dư ĐK</th>
                  <th className="py-3 px-3 w-[130px] text-right">Số dư CK</th>
                  <th className="py-3 px-3 w-[110px] text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(tree).sort(([a], [b]) => a - b).map(([groupKey, { parents, childMap }]) => {
                  const isExpanded = expandedGroups[groupKey] !== false;
                  return (
                    <React.Fragment key={groupKey}>
                      <tr className="bg-gradient-to-r from-slate-100/80 to-slate-50/50 dark:from-slate-700/40 dark:to-slate-800/20 cursor-pointer hover:from-slate-200/80 transition-all"
                        onClick={() => toggleGroup(groupKey)}>
                        <td colSpan={7} className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <span className={`material-symbols-outlined text-[16px] text-slate-500 transition-transform ${isExpanded ? '' : '-rotate-90'}`}>expand_more</span>
                            <span className="text-[12px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                              Nhóm {groupKey} — {ACCOUNT_GROUPS[groupKey]}
                            </span>
                            <span className="text-[10px] text-slate-400 ml-1">({parents.length + Object.values(childMap).flat().length} TK)</span>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && parents.map(acc => (
                        <AccountRow key={acc.id} acc={acc} indent={0} childMap={childMap} />
                      ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Add/Edit */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-500">{editingAccount ? 'edit' : 'add_circle'}</span>
                {editingAccount ? 'Sửa tài khoản' : 'Thêm tài khoản mới'}
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Mã tài khoản *</label>
                  <input type="text" value={form.account_number} onChange={e => setForm(p => ({ ...p, account_number: e.target.value }))}
                    placeholder="VD: 1111" disabled={!!editingAccount}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/30 font-mono font-bold disabled:opacity-50" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Cấp TK</label>
                  <select value={form.level} onChange={e => setForm(p => ({ ...p, level: parseInt(e.target.value) }))}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl outline-none cursor-pointer">
                    <option value={1}>Cấp 1 (Nhóm)</option>
                    <option value={2}>Cấp 2 (Chi tiết)</option>
                    <option value={3}>Cấp 3 (Tiểu khoản)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Tên tài khoản (Tiếng Việt) *</label>
                <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="VD: Tiền Việt Nam"
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/30" />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Tên tiếng Anh</label>
                <input type="text" value={form.name_en} onChange={e => setForm(p => ({ ...p, name_en: e.target.value }))} placeholder="VD: VND cash"
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/30" />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Loại TK</label>
                  <select value={form.account_type} onChange={e => setForm(p => ({ ...p, account_type: e.target.value }))}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl outline-none cursor-pointer">
                    {Object.entries(ACCOUNT_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Nhóm</label>
                  <select value={form.account_group} onChange={e => setForm(p => ({ ...p, account_group: parseInt(e.target.value) }))}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl outline-none cursor-pointer">
                    {Object.entries(ACCOUNT_GROUPS).map(([k, v]) => <option key={k} value={k}>{k}. {v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Tính chất</label>
                  <select value={form.normal_balance} onChange={e => setForm(p => ({ ...p, normal_balance: e.target.value }))}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl outline-none cursor-pointer">
                    <option value="debit">Dư Nợ</option>
                    <option value="credit">Dư Có</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">TK cha</label>
                  <select value={form.parent_id} onChange={e => setForm(p => ({ ...p, parent_id: e.target.value }))}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl outline-none cursor-pointer">
                    <option value="">— Không (TK gốc) —</option>
                    {parentAccounts.map(a => <option key={a.id} value={a.id}>{a.account_number} - {a.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Số dư đầu kỳ (VNĐ)</label>
                  <input type="number" value={form.opening_balance} onChange={e => setForm(p => ({ ...p, opening_balance: e.target.value }))}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/30 font-mono" />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Ghi chú</label>
                <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} placeholder="Ghi chú..."
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/30 resize-none" />
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 cursor-pointer">
                <input type="checkbox" checked={form.is_bank_account} onChange={e => setForm(p => ({ ...p, is_bank_account: e.target.checked }))} className="rounded cursor-pointer" />
                Đây là tài khoản ngân hàng
              </label>
            </div>
            <div className="p-6 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 rounded-xl hover:bg-slate-200 transition-colors cursor-pointer">Hủy</button>
              <button onClick={handleSave} disabled={saving || !form.account_number || !form.name}
                className="px-5 py-2 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 transition-all disabled:opacity-50 cursor-pointer flex items-center gap-2">
                {saving && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />}
                {editingAccount ? 'Cập nhật' : 'Tạo mới'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
