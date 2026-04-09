import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { fmt } from '../../utils/formatters';
import { createAutoJournalEntry } from '../../lib/accountingService';

// ─── Constants ────────────────────────────────────────────
const FREQUENCY_MAP = {
  daily:     { label: 'Hàng ngày', icon: 'today', color: 'bg-slate-100 text-slate-600' },
  weekly:    { label: 'Hàng tuần', icon: 'date_range', color: 'bg-blue-100 text-blue-700' },
  monthly:   { label: 'Hàng tháng', icon: 'calendar_month', color: 'bg-indigo-100 text-indigo-700' },
  quarterly: { label: 'Hàng quý', icon: 'calendar_today', color: 'bg-violet-100 text-violet-700' },
  yearly:    { label: 'Hàng năm', icon: 'event', color: 'bg-amber-100 text-amber-700' },
};

const JOURNAL_TYPES = [
  { value: 'general', label: 'Tổng hợp' },
  { value: 'payroll', label: 'Lương' },
  { value: 'depreciation', label: 'Khấu hao' },
  { value: 'accrual', label: 'Trích trước' },
  { value: 'allocation', label: 'Phân bổ' },
];

export default function RecurringTemplates() {
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const queryClient = useQueryClient();

  // ── Queries ──
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['recurring_templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('acc_recurring_templates')
        .select('*, lines:acc_recurring_template_lines(*, account:acc_accounts(account_number, name))')
        .order('is_active', { ascending: false })
        .order('next_run_date', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    staleTime: 2 * 60 * 1000,
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['recurringAccounts'],
    queryFn: async () => {
      const { data } = await supabase
        .from('acc_accounts')
        .select('id, account_number, name')
        .eq('is_active', true)
        .order('account_number');
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // ── Run template (generate journal) ──
  const handleRun = async (template) => {
    if (!confirm(`Tạo bút toán từ template "${template.name}"?`)) return;
    const today = new Date().toISOString().split('T')[0];
    const lines = (template.lines || []).map(l => ({
      accountNumber: l.account?.account_number,
      debit: Number(l.debit_amount || 0),
      credit: Number(l.credit_amount || 0),
      description: l.description || template.description || '',
    }));

    const result = await createAutoJournalEntry({
      journalType: template.journal_type || 'general',
      entryDate: today,
      description: `[Định kỳ] ${template.name}`,
      sourceModule: 'recurring',
      sourceId: template.id,
      lines,
    });

    if (result.success) {
      // Update last_run_date and next_run_date
      const nextDate = calculateNextDate(today, template.frequency, template.day_of_month);
      await supabase.from('acc_recurring_templates').update({
        last_run_date: today,
        next_run_date: nextDate,
      }).eq('id', template.id);
      alert('✅ Đã tạo bút toán thành công!');
      queryClient.invalidateQueries({ queryKey: ['recurring_templates'] });
    } else {
      alert('❌ Lỗi: ' + (result.error || 'Unknown'));
    }
  };

  const activeCount = templates.filter(t => t.is_active).length;
  const overdueCount = templates.filter(t => t.is_active && t.next_run_date && new Date(t.next_run_date) < new Date()).length;

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            <span className="material-symbols-outlined text-violet-500">repeat</span>
            Bút toán Định kỳ
          </h2>
          <p className="text-sm text-slate-500">Template bút toán lặp lại tự động (khấu hao, lương, phân bổ...)</p>
        </div>
        <button onClick={() => { setEditingTemplate(null); setShowModal(true); }}
          className="flex items-center gap-1.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg shadow-violet-200 hover:shadow-xl hover:-translate-y-0.5 transition-all">
          <span className="material-symbols-outlined text-[16px]">add</span>
          Tạo template
        </button>
      </div>

      {/* Stats row */}
      <div className="flex gap-4">
        <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 rounded-xl border border-emerald-200">
          <span className="material-symbols-outlined text-emerald-600 text-[16px]">check_circle</span>
          <span className="text-xs font-bold text-emerald-700">{activeCount} đang hoạt động</span>
        </div>
        {overdueCount > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 bg-rose-50 rounded-xl border border-rose-200 animate-pulse">
            <span className="material-symbols-outlined text-rose-600 text-[16px]">schedule</span>
            <span className="text-xs font-bold text-rose-700">{overdueCount} quá hạn chạy</span>
          </div>
        )}
      </div>

      {/* Template cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {isLoading ? (
          <div className="col-span-2 text-center py-16 text-slate-400">
            <span className="material-symbols-outlined text-3xl animate-spin">progress_activity</span>
          </div>
        ) : templates.length === 0 ? (
          <div className="col-span-2 text-center py-16 bg-white rounded-2xl border border-slate-200">
            <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">repeat</span>
            <p className="text-sm text-slate-400">Chưa có template nào</p>
          </div>
        ) : templates.map(tmpl => {
          const freq = FREQUENCY_MAP[tmpl.frequency] || FREQUENCY_MAP.monthly;
          const isOverdue = tmpl.is_active && tmpl.next_run_date && new Date(tmpl.next_run_date) < new Date();
          const lines = tmpl.lines || [];
          
          return (
            <div key={tmpl.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all hover:shadow-md ${tmpl.is_active ? 'border-slate-200' : 'border-slate-100 opacity-60'}`}>
              {/* Card header */}
              <div className="px-5 py-4 flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${tmpl.is_active ? 'bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg' : 'bg-slate-200'}`}>
                    <span className="material-symbols-outlined text-white text-[18px]">repeat</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">{tmpl.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold ${freq.color}`}>
                        <span className="material-symbols-outlined text-[10px]">{freq.icon}</span>
                        {freq.label}
                      </span>
                      {isOverdue && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-100 text-rose-700 animate-pulse">
                          <span className="material-symbols-outlined text-[10px]">warning</span>
                          Quá hạn
                        </span>
                      )}
                    </div>
                    {tmpl.description && <p className="text-[10px] text-slate-400 mt-1 line-clamp-1">{tmpl.description}</p>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-black text-slate-800 tabular-nums">{fmt(tmpl.total_amount)}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {tmpl.next_run_date ? `Tiếp: ${new Date(tmpl.next_run_date).toLocaleDateString('vi-VN')}` : '—'}
                  </div>
                </div>
              </div>

              {/* Lines preview */}
              {lines.length > 0 && (
                <div className="px-5 pb-3">
                  <div className="bg-slate-50 rounded-xl p-2.5 space-y-1">
                    {lines.map(l => (
                      <div key={l.id} className="flex items-center justify-between text-[10px]">
                        <span className="text-slate-500 font-mono">{l.account?.account_number || '???'} — {l.account?.name || ''}</span>
                        <span className="font-bold tabular-nums">
                          {Number(l.debit_amount) > 0 && <span className="text-blue-600">Nợ {fmt(l.debit_amount)}</span>}
                          {Number(l.credit_amount) > 0 && <span className="text-rose-600">Có {fmt(l.credit_amount)}</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between">
                <div className="text-[10px] text-slate-400">
                  {tmpl.last_run_date ? `Lần cuối: ${new Date(tmpl.last_run_date).toLocaleDateString('vi-VN')}` : 'Chưa chạy'}
                </div>
                <div className="flex items-center gap-1">
                  {tmpl.is_active && (
                    <button onClick={() => handleRun(tmpl)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-[10px] font-bold transition-colors border border-emerald-200">
                      <span className="material-symbols-outlined text-[14px]">play_arrow</span>
                      Chạy ngay
                    </button>
                  )}
                  <button onClick={() => { setEditingTemplate(tmpl); setShowModal(true); }}
                    className="p-1.5 text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors">
                    <span className="material-symbols-outlined text-[16px]">edit</span>
                  </button>
                  <button onClick={async () => {
                    if (!confirm('Xóa template này?')) return;
                    await supabase.from('acc_recurring_templates').delete().eq('id', tmpl.id);
                    queryClient.invalidateQueries({ queryKey: ['recurring_templates'] });
                  }} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal */}
      {showModal && (
        <TemplateModal
          template={editingTemplate}
          accounts={accounts}
          onClose={() => { setShowModal(false); setEditingTemplate(null); }}
          onSaved={() => { queryClient.invalidateQueries({ queryKey: ['recurring_templates'] }); setShowModal(false); setEditingTemplate(null); }}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Template Modal — Create / Edit
// ═══════════════════════════════════════════════════════════
function TemplateModal({ template, accounts, onClose, onSaved }) {
  const isEdit = !!template;
  const [form, setForm] = useState({
    name: template?.name || '',
    description: template?.description || '',
    journal_type: template?.journal_type || 'general',
    frequency: template?.frequency || 'monthly',
    day_of_month: template?.day_of_month || 1,
    next_run_date: template?.next_run_date || new Date().toISOString().split('T')[0],
    end_date: template?.end_date || '',
    is_active: template?.is_active ?? true,
    auto_post: template?.auto_post ?? false,
  });

  const [lines, setLines] = useState(
    template?.lines?.map(l => ({
      account_id: l.account_id,
      debit_amount: String(l.debit_amount || ''),
      credit_amount: String(l.credit_amount || ''),
      description: l.description || '',
    })) || [
      { account_id: '', debit_amount: '', credit_amount: '', description: '' },
      { account_id: '', debit_amount: '', credit_amount: '', description: '' },
    ]
  );
  const [saving, setSaving] = useState(false);

  const addLine = () => setLines(prev => [...prev, { account_id: '', debit_amount: '', credit_amount: '', description: '' }]);
  const removeLine = (idx) => setLines(prev => prev.filter((_, i) => i !== idx));
  const updateLine = (idx, field, val) => setLines(prev => prev.map((l, i) => i === idx ? { ...l, [field]: val } : l));

  const totalDebit = lines.reduce((s, l) => s + (Number(String(l.debit_amount).replace(/[^0-9]/g, '')) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (Number(String(l.credit_amount).replace(/[^0-9]/g, '')) || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 1;

  const handleSave = async () => {
    if (!form.name) return alert('Vui lòng nhập tên');
    if (!isBalanced) return alert('Nợ và Có chưa cân');
    const validLines = lines.filter(l => l.account_id && (Number(String(l.debit_amount).replace(/[^0-9]/g, '')) > 0 || Number(String(l.credit_amount).replace(/[^0-9]/g, '')) > 0));
    if (validLines.length < 2) return alert('Cần ít nhất 2 dòng');
    setSaving(true);

    const payload = {
      name: form.name,
      description: form.description || null,
      journal_type: form.journal_type,
      frequency: form.frequency,
      day_of_month: Number(form.day_of_month) || 1,
      next_run_date: form.next_run_date || null,
      end_date: form.end_date || null,
      is_active: form.is_active,
      auto_post: form.auto_post,
      total_amount: totalDebit,
    };

    let templateId;
    if (isEdit) {
      const { error } = await supabase.from('acc_recurring_templates').update(payload).eq('id', template.id);
      if (error) { alert('Lỗi: ' + error.message); setSaving(false); return; }
      templateId = template.id;
      await supabase.from('acc_recurring_template_lines').delete().eq('template_id', template.id);
    } else {
      const { data, error } = await supabase.from('acc_recurring_templates').insert([payload]).select('id').single();
      if (error) { alert('Lỗi: ' + error.message); setSaving(false); return; }
      templateId = data.id;
    }

    const linePayloads = validLines.map((l, idx) => ({
      template_id: templateId,
      line_number: idx + 1,
      account_id: l.account_id,
      debit_amount: Number(String(l.debit_amount).replace(/[^0-9]/g, '')) || 0,
      credit_amount: Number(String(l.credit_amount).replace(/[^0-9]/g, '')) || 0,
      description: l.description || null,
    }));

    const { error: lineErr } = await supabase.from('acc_recurring_template_lines').insert(linePayloads);
    if (lineErr) alert('Lỗi dòng: ' + lineErr.message);
    else onSaved();
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-slide-up max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
            <span className="material-symbols-outlined text-violet-500">repeat</span>
            {isEdit ? 'Sửa template' : 'Tạo template mới'}
          </h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
          {/* Name + type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Tên template *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Khấu hao TSCĐ tháng" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-violet-400 outline-none" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Loại bút toán</label>
              <select value={form.journal_type} onChange={e => setForm(f => ({ ...f, journal_type: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-violet-400 outline-none">
                {JOURNAL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>

          {/* Schedule */}
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Tần suất</label>
              <select value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-violet-400 outline-none">
                {Object.entries(FREQUENCY_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Ngày trong tháng</label>
              <input type="number" min={1} max={31} value={form.day_of_month} onChange={e => setForm(f => ({ ...f, day_of_month: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-violet-400 outline-none" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Chạy tiếp theo</label>
              <input type="date" value={form.next_run_date} onChange={e => setForm(f => ({ ...f, next_run_date: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-violet-400 outline-none" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Kết thúc</label>
              <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-violet-400 outline-none" />
            </div>
          </div>

          {/* Toggles */}
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                className="w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-400" />
              <span className="text-xs font-bold text-slate-600">Đang hoạt động</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.auto_post} onChange={e => setForm(f => ({ ...f, auto_post: e.target.checked }))}
                className="w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-400" />
              <span className="text-xs font-bold text-slate-600">Tự động ghi sổ</span>
            </label>
          </div>

          {/* Journal lines */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Định khoản</label>
              <button onClick={addLine} className="text-violet-600 hover:text-violet-800 text-[10px] font-bold flex items-center gap-0.5">
                <span className="material-symbols-outlined text-[14px]">add</span> Thêm dòng
              </button>
            </div>
            <div className="space-y-2">
              {lines.map((line, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <select value={line.account_id} onChange={e => updateLine(idx, 'account_id', e.target.value)}
                    className="flex-1 border border-slate-200 rounded-lg px-2 py-2 text-[11px] focus:ring-2 focus:ring-violet-400 outline-none">
                    <option value="">Chọn TK...</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.account_number} — {a.name}</option>)}
                  </select>
                  <input value={fmt(line.debit_amount)} onChange={e => updateLine(idx, 'debit_amount', e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="Nợ" className="w-28 border border-slate-200 rounded-lg px-2 py-2 text-[11px] text-right font-bold tabular-nums focus:ring-2 focus:ring-blue-400 outline-none" />
                  <input value={fmt(line.credit_amount)} onChange={e => updateLine(idx, 'credit_amount', e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="Có" className="w-28 border border-slate-200 rounded-lg px-2 py-2 text-[11px] text-right font-bold tabular-nums focus:ring-2 focus:ring-rose-400 outline-none" />
                  <button onClick={() => removeLine(idx)} className="p-1 text-slate-300 hover:text-rose-500">
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                </div>
              ))}
            </div>
            {/* Balance check */}
            <div className={`mt-2 flex items-center justify-end gap-4 text-[10px] font-bold ${isBalanced ? 'text-emerald-600' : 'text-rose-600'}`}>
              <span>Nợ: {fmt(totalDebit)}</span>
              <span>Có: {fmt(totalCredit)}</span>
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px]">{isBalanced ? 'check_circle' : 'error'}</span>
                {isBalanced ? 'Cân' : 'Chưa cân!'}
              </span>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Mô tả</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-violet-400 outline-none resize-none" rows={2} />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">Hủy</button>
          <button onClick={handleSave} disabled={saving || !isBalanced}
            className="px-5 py-2 bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm font-bold rounded-xl shadow-lg shadow-violet-200 hover:shadow-xl disabled:opacity-50 flex items-center gap-1.5 transition-all">
            <span className="material-symbols-outlined text-[16px]">{saving ? 'progress_activity' : 'save'}</span>
            {saving ? 'Đang lưu...' : isEdit ? 'Cập nhật' : 'Tạo'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Helper: Calculate next run date
// ═══════════════════════════════════════════════════════════
function calculateNextDate(fromDate, frequency, dayOfMonth) {
  const d = new Date(fromDate);
  switch (frequency) {
    case 'daily': d.setDate(d.getDate() + 1); break;
    case 'weekly': d.setDate(d.getDate() + 7); break;
    case 'monthly': d.setMonth(d.getMonth() + 1); if (dayOfMonth) d.setDate(Math.min(dayOfMonth, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate())); break;
    case 'quarterly': d.setMonth(d.getMonth() + 3); break;
    case 'yearly': d.setFullYear(d.getFullYear() + 1); break;
  }
  return d.toISOString().split('T')[0];
}
