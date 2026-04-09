import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { fmt } from '../../utils/formatters';

// ─── Constants ────────────────────────────────────────────
const BUDGET_CATEGORIES = [
  'Nhân công', 'Vật liệu', 'Máy thi công', 'Chi phí chung',
  'Thầu phụ', 'Quản lý dự án', 'Tài chính', 'Dự phòng', 'Khác'
];

const STATUS_MAP = {
  draft:       { label: 'Nháp', color: 'bg-slate-100 text-slate-600', icon: 'edit_note' },
  approved:    { label: 'Đã duyệt', color: 'bg-blue-100 text-blue-700', icon: 'verified' },
  active:      { label: 'Đang thực hiện', color: 'bg-emerald-100 text-emerald-700', icon: 'play_circle' },
  closed:      { label: 'Đã đóng', color: 'bg-slate-200 text-slate-500', icon: 'lock' },
  over_budget: { label: 'Vượt NS', color: 'bg-rose-100 text-rose-700', icon: 'warning' },
};

export default function BudgetManagement() {
  const [showModal, setShowModal] = useState(false);
  const [editingBudget, setEditingBudget] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const queryClient = useQueryClient();

  // ── Queries ──
  const { data: budgets = [], isLoading } = useQuery({
    queryKey: ['budgets', filterYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('acc_budgets')
        .select('*, projects(name, code, internal_code), lines:acc_budget_lines(*)')
        .eq('fiscal_year', filterYear)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    staleTime: 2 * 60 * 1000,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['budgetProjects'],
    queryFn: async () => {
      const { data } = await supabase.from('projects').select('id, name, code, internal_code');
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['budgetAccounts'],
    queryFn: async () => {
      const { data } = await supabase
        .from('acc_accounts')
        .select('id, account_number, name')
        .eq('is_active', true)
        .in('account_type', ['expense', 'cost_of_goods'])
        .order('account_number');
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // ── Summary ──
  const summary = useMemo(() => {
    const totalBudget = budgets.reduce((s, b) => s + Number(b.total_budget || 0), 0);
    const totalActual = budgets.reduce((s, b) => s + Number(b.total_actual || 0), 0);
    const totalCommitted = budgets.reduce((s, b) => s + Number(b.total_committed || 0), 0);
    return { totalBudget, totalActual, totalCommitted, remaining: totalBudget - totalActual - totalCommitted };
  }, [budgets]);

  const utilizationPct = summary.totalBudget > 0 ? Math.round((summary.totalActual / summary.totalBudget) * 100) : 0;

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            <span className="material-symbols-outlined text-indigo-500">account_balance_wallet</span>
            Quản lý Ngân sách
          </h2>
          <p className="text-sm text-slate-500">Theo dõi ngân sách dự án theo hạng mục chi phí</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={filterYear} onChange={e => setFilterYear(Number(e.target.value))}
            className="bg-indigo-50 border border-indigo-200 text-indigo-700 px-3 py-1.5 rounded-full text-[11px] font-bold outline-none cursor-pointer">
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={() => { setEditingBudget(null); setShowModal(true); }}
            className="flex items-center gap-1.5 bg-gradient-to-r from-indigo-600 to-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg shadow-indigo-200 hover:shadow-xl hover:-translate-y-0.5 transition-all">
            <span className="material-symbols-outlined text-[16px]">add</span>
            Tạo ngân sách
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KPICard icon="savings" label="Tổng NS" value={fmt(summary.totalBudget)} color="indigo" />
        <KPICard icon="payments" label="Đã chi" value={fmt(summary.totalActual)} color="rose" />
        <KPICard icon="pending" label="Cam kết" value={fmt(summary.totalCommitted)} color="amber" />
        <KPICard icon="account_balance" label="Còn lại" value={fmt(summary.remaining)} color={summary.remaining >= 0 ? 'emerald' : 'rose'} />
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sử dụng</span>
          </div>
          <div className="text-2xl font-black text-slate-800">{utilizationPct}%</div>
          <div className="mt-2 w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div className={`h-full rounded-full transition-all ${utilizationPct > 90 ? 'bg-rose-500' : utilizationPct > 70 ? 'bg-amber-500' : 'bg-emerald-500'}`}
              style={{ width: `${Math.min(utilizationPct, 100)}%` }} />
          </div>
        </div>
      </div>

      {/* Budget Cards */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="text-center py-16 text-slate-400">
            <span className="material-symbols-outlined text-3xl animate-spin">progress_activity</span>
            <p className="mt-2 text-xs">Đang tải...</p>
          </div>
        ) : budgets.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
            <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">account_balance_wallet</span>
            <p className="text-sm text-slate-400 font-medium">Chưa có ngân sách cho năm {filterYear}</p>
          </div>
        ) : budgets.map(budget => (
          <BudgetCard 
            key={budget.id} 
            budget={budget} 
            expanded={expandedId === budget.id}
            onToggle={() => setExpandedId(expandedId === budget.id ? null : budget.id)}
            onEdit={() => { setEditingBudget(budget); setShowModal(true); }}
            onDelete={async () => {
              if (!confirm('Xóa ngân sách này?')) return;
              await supabase.from('acc_budgets').delete().eq('id', budget.id);
              queryClient.invalidateQueries({ queryKey: ['budgets'] });
            }}
            queryClient={queryClient}
          />
        ))}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <BudgetModal
          budget={editingBudget}
          projects={projects}
          accounts={accounts}
          filterYear={filterYear}
          onClose={() => { setShowModal(false); setEditingBudget(null); }}
          onSaved={() => { queryClient.invalidateQueries({ queryKey: ['budgets'] }); setShowModal(false); setEditingBudget(null); }}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// KPI Card
// ═══════════════════════════════════════════════════════════
function KPICard({ icon, label, value, color }) {
  const colors = {
    indigo: 'from-indigo-500 to-blue-600',
    rose: 'from-rose-500 to-pink-600',
    amber: 'from-amber-500 to-orange-600',
    emerald: 'from-emerald-500 to-teal-600',
  };
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${colors[color] || colors.indigo} flex items-center justify-center shadow-lg`}>
          <span className="material-symbols-outlined text-white text-[16px]">{icon}</span>
        </div>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-lg font-black text-slate-800 tabular-nums">{value}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Budget Card (expandable)
// ═══════════════════════════════════════════════════════════
function BudgetCard({ budget, expanded, onToggle, onEdit, onDelete, queryClient }) {
  const st = STATUS_MAP[budget.status] || STATUS_MAP.draft;
  const lines = budget.lines || [];
  const totalBudget = Number(budget.total_budget || 0);
  const totalActual = Number(budget.total_actual || 0);
  const pct = totalBudget > 0 ? Math.round((totalActual / totalBudget) * 100) : 0;
  const projectLabel = budget.projects?.internal_code || budget.projects?.code || budget.projects?.name || '';

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      {/* Header row */}
      <div className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-slate-50/50 transition-colors" onClick={onToggle}>
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${pct > 90 ? 'from-rose-500 to-pink-600' : 'from-indigo-500 to-blue-600'} flex items-center justify-center shadow-lg shrink-0`}>
            <span className="material-symbols-outlined text-white text-[18px]">account_balance_wallet</span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-800 text-sm truncate">{budget.name}</h3>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold ${st.color}`}>
                <span className="material-symbols-outlined text-[10px]">{st.icon}</span>
                {st.label}
              </span>
            </div>
            {projectLabel && <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">DA: {projectLabel}</p>}
          </div>
        </div>

        <div className="flex items-center gap-6 shrink-0">
          <div className="text-right">
            <div className="text-[10px] text-slate-400 font-bold uppercase">NS / Thực tế</div>
            <div className="text-sm font-black text-slate-700 tabular-nums">{fmt(totalBudget)} / <span className={pct > 100 ? 'text-rose-600' : 'text-emerald-600'}>{fmt(totalActual)}</span></div>
          </div>
          <div className="w-20">
            <div className="text-[10px] text-right font-bold text-slate-400 mb-1">{pct}%</div>
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div className={`h-full rounded-full transition-all ${pct > 90 ? 'bg-rose-500' : pct > 70 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={e => { e.stopPropagation(); onEdit(); }} className="p-1.5 text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors">
              <span className="material-symbols-outlined text-[16px]">edit</span>
            </button>
            <button onClick={e => { e.stopPropagation(); onDelete(); }} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
              <span className="material-symbols-outlined text-[16px]">delete</span>
            </button>
            <span className={`material-symbols-outlined text-slate-400 text-[18px] transition-transform ${expanded ? 'rotate-180' : ''}`}>expand_more</span>
          </div>
        </div>
      </div>

      {/* Expanded lines */}
      {expanded && (
        <div className="border-t border-slate-100">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-400 font-bold text-[10px] uppercase tracking-wider">
              <tr>
                <th className="px-6 py-2.5 text-left">Hạng mục</th>
                <th className="px-4 py-2.5 text-right">NS Dự kiến</th>
                <th className="px-4 py-2.5 text-right">Thực tế</th>
                <th className="px-4 py-2.5 text-right">Cam kết</th>
                <th className="px-4 py-2.5 text-right">Chênh lệch</th>
                <th className="px-4 py-2.5 text-right">%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {lines.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-6 text-center text-slate-400 text-xs">Chưa có hạng mục chi tiết</td></tr>
              ) : lines.map(line => {
                const variance = Number(line.budget_amount || 0) - Number(line.actual_amount || 0) - Number(line.committed_amount || 0);
                const vpct = Number(line.budget_amount) > 0 ? Math.round((Number(line.actual_amount || 0) / Number(line.budget_amount)) * 100) : 0;
                return (
                  <tr key={line.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-2.5">
                      <span className="text-xs font-bold text-slate-700">{line.category}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs font-bold text-slate-600 tabular-nums">{fmt(line.budget_amount)}</td>
                    <td className="px-4 py-2.5 text-right text-xs font-bold text-rose-600 tabular-nums">{fmt(line.actual_amount)}</td>
                    <td className="px-4 py-2.5 text-right text-xs font-bold text-amber-600 tabular-nums">{fmt(line.committed_amount)}</td>
                    <td className={`px-4 py-2.5 text-right text-xs font-black tabular-nums ${variance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {variance >= 0 ? '+' : ''}{fmt(variance)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${vpct > 100 ? 'bg-rose-100 text-rose-700' : vpct > 80 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {vpct}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Budget Modal — Create / Edit
// ═══════════════════════════════════════════════════════════
function BudgetModal({ budget, projects, accounts, filterYear, onClose, onSaved }) {
  const isEdit = !!budget;
  const [form, setForm] = useState({
    name: budget?.name || '',
    budget_type: budget?.budget_type || 'project',
    project_id: budget?.project_id || '',
    fiscal_year: budget?.fiscal_year || filterYear,
    status: budget?.status || 'draft',
    notes: budget?.notes || '',
  });
  const [lines, setLines] = useState(
    budget?.lines?.map(l => ({ ...l, budget_amount: String(l.budget_amount || 0) })) || 
    BUDGET_CATEGORIES.slice(0, 5).map(cat => ({ category: cat, budget_amount: '' }))
  );
  const [saving, setSaving] = useState(false);

  const addLine = () => setLines(prev => [...prev, { category: '', budget_amount: '' }]);
  const removeLine = (idx) => setLines(prev => prev.filter((_, i) => i !== idx));
  const updateLine = (idx, field, val) => setLines(prev => prev.map((l, i) => i === idx ? { ...l, [field]: val } : l));

  const totalBudget = lines.reduce((s, l) => s + (Number(String(l.budget_amount).replace(/[^0-9]/g, '')) || 0), 0);

  const handleSave = async () => {
    if (!form.name) return alert('Vui lòng nhập tên ngân sách');
    const validLines = lines.filter(l => l.category && Number(String(l.budget_amount).replace(/[^0-9]/g, '')) > 0);
    if (validLines.length === 0) return alert('Cần ít nhất 1 hạng mục có giá trị');
    setSaving(true);

    const payload = {
      name: form.name,
      budget_type: form.budget_type,
      project_id: form.project_id || null,
      fiscal_year: Number(form.fiscal_year),
      total_budget: totalBudget,
      status: form.status,
      notes: form.notes || null,
    };

    let budgetId;
    if (isEdit) {
      const { error } = await supabase.from('acc_budgets').update(payload).eq('id', budget.id);
      if (error) { alert('Lỗi: ' + error.message); setSaving(false); return; }
      budgetId = budget.id;
      // Delete old lines
      await supabase.from('acc_budget_lines').delete().eq('budget_id', budget.id);
    } else {
      const { data, error } = await supabase.from('acc_budgets').insert([payload]).select('id').single();
      if (error) { alert('Lỗi: ' + error.message); setSaving(false); return; }
      budgetId = data.id;
    }

    // Insert lines
    const linePayloads = validLines.map(l => ({
      budget_id: budgetId,
      category: l.category,
      budget_amount: Number(String(l.budget_amount).replace(/[^0-9]/g, '')) || 0,
      actual_amount: Number(l.actual_amount || 0),
      committed_amount: Number(l.committed_amount || 0),
    }));

    const { error: lineErr } = await supabase.from('acc_budget_lines').insert(linePayloads);
    if (lineErr) alert('Lỗi dòng: ' + lineErr.message);
    else onSaved();
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-slide-up max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
            <span className="material-symbols-outlined text-indigo-500">account_balance_wallet</span>
            {isEdit ? 'Sửa ngân sách' : 'Tạo ngân sách mới'}
          </h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
          {/* Basic info */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Tên ngân sách *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="NS Dự án ABC — 2026" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-400 outline-none" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Dự án</label>
              <select value={form.project_id} onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-400 outline-none">
                <option value="">— Toàn công ty —</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.internal_code || p.code} — {p.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Năm</label>
              <input type="number" value={form.fiscal_year} onChange={e => setForm(f => ({ ...f, fiscal_year: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-400 outline-none" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Trạng thái</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-400 outline-none">
                {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Tổng NS</label>
              <div className="border border-indigo-200 bg-indigo-50 rounded-lg px-3 py-2 text-xs font-black text-indigo-700 tabular-nums">{fmt(totalBudget)}</div>
            </div>
          </div>

          {/* Budget lines */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Hạng mục chi phí</label>
              <button onClick={addLine} className="text-indigo-600 hover:text-indigo-800 text-[10px] font-bold flex items-center gap-0.5">
                <span className="material-symbols-outlined text-[14px]">add</span> Thêm
              </button>
            </div>
            <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
              {lines.map((line, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <select value={line.category} onChange={e => updateLine(idx, 'category', e.target.value)}
                    className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-400 outline-none">
                    <option value="">Chọn hạng mục...</option>
                    {BUDGET_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input value={fmt(line.budget_amount)} onChange={e => updateLine(idx, 'budget_amount', e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="0" className="w-36 border border-slate-200 rounded-lg px-3 py-2 text-xs text-right font-bold tabular-nums focus:ring-2 focus:ring-indigo-400 outline-none" />
                  <button onClick={() => removeLine(idx)} className="p-1 text-slate-300 hover:text-rose-500 transition-colors">
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Ghi chú</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-400 outline-none resize-none" rows={2} />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">Hủy</button>
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 text-white text-sm font-bold rounded-xl shadow-lg shadow-indigo-200 hover:shadow-xl disabled:opacity-50 flex items-center gap-1.5 transition-all">
            <span className="material-symbols-outlined text-[16px]">{saving ? 'progress_activity' : 'save'}</span>
            {saving ? 'Đang lưu...' : isEdit ? 'Cập nhật' : 'Tạo'}
          </button>
        </div>
      </div>
    </div>
  );
}
