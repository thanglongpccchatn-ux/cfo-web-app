import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { fmt } from '../../utils/formatters';
import { autoJournal, createAutoJournalEntry } from '../../lib/accountingService';

// ─── Constants ────────────────────────────────────────────
const INVOICE_TYPES = [
  { value: 'output', label: 'HĐ Đầu ra', icon: 'send', color: 'emerald' },
  { value: 'input', label: 'HĐ Đầu vào', icon: 'call_received', color: 'blue' },
];

const STATUS_MAP = {
  draft:         { label: 'Nháp', color: 'bg-slate-100 text-slate-600', icon: 'edit_note' },
  issued:        { label: 'Đã phát hành', color: 'bg-emerald-100 text-emerald-700', icon: 'check_circle' },
  received:      { label: 'Đã nhận', color: 'bg-blue-100 text-blue-700', icon: 'inbox' },
  sent_to_buyer: { label: 'Đã gửi KH', color: 'bg-violet-100 text-violet-700', icon: 'forward_to_inbox' },
  cancelled:     { label: 'Đã hủy', color: 'bg-rose-100 text-rose-700', icon: 'cancel' },
  replaced:      { label: 'Đã thay thế', color: 'bg-amber-100 text-amber-700', icon: 'swap_horiz' },
  adjusted:      { label: 'Điều chỉnh', color: 'bg-orange-100 text-orange-700', icon: 'tune' },
};

const VAT_RATES = [
  { value: 0, label: '0%' },
  { value: 5, label: '5%' },
  { value: 8, label: '8%' },
  { value: 10, label: '10%' },
];

const TAX_TYPES = [
  { value: 'GTGT', label: 'Thuế GTGT', icon: 'percent', color: 'indigo' },
  { value: 'TNDN', label: 'Thuế TNDN', icon: 'business', color: 'violet' },
  { value: 'TNCN', label: 'Thuế TNCN', icon: 'person', color: 'cyan' },
];

const TAX_STATUS_MAP = {
  draft:     { label: 'Nháp', color: 'bg-slate-100 text-slate-600' },
  submitted: { label: 'Đã nộp', color: 'bg-blue-100 text-blue-700' },
  accepted:  { label: 'Đã chấp nhận', color: 'bg-emerald-100 text-emerald-700' },
  rejected:  { label: 'Từ chối', color: 'bg-rose-100 text-rose-700' },
  amended:   { label: 'Đã sửa', color: 'bg-amber-100 text-amber-700' },
};

// ─── Main Component ───────────────────────────────────────
export default function EInvoiceManagement() {
  const [activeTab, setActiveTab] = useState('invoices'); // 'invoices' | 'tax'
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [showTaxModal, setShowTaxModal] = useState(false);
  const [editingTax, setEditingTax] = useState(null);
  const queryClient = useQueryClient();

  // ── Queries ──
  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['einvoices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('acc_einvoices')
        .select('*, projects(name, code)')
        .order('invoice_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    staleTime: 2 * 60 * 1000,
  });

  const { data: taxDeclarations = [] } = useQuery({
    queryKey: ['tax_declarations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('acc_tax_declarations')
        .select('*')
        .order('period_year', { ascending: false })
        .order('period_month', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    staleTime: 2 * 60 * 1000,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['einvoiceProjects'],
    queryFn: async () => {
      const { data } = await supabase.from('projects').select('id, name, code');
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // ── Filtered data ──
  const filtered = useMemo(() => {
    return invoices.filter(inv => {
      if (filterType !== 'all' && inv.invoice_type !== filterType) return false;
      if (filterStatus !== 'all' && inv.status !== filterStatus) return false;
      return true;
    });
  }, [invoices, filterType, filterStatus]);

  // ── Summary stats ──
  const stats = useMemo(() => {
    const output = invoices.filter(i => i.invoice_type === 'output');
    const input = invoices.filter(i => i.invoice_type === 'input');
    return {
      outputCount: output.length,
      outputTotal: output.reduce((s, i) => s + Number(i.total_amount || 0), 0),
      outputVAT: output.reduce((s, i) => s + Number(i.vat_amount || 0), 0),
      inputCount: input.length,
      inputTotal: input.reduce((s, i) => s + Number(i.total_amount || 0), 0),
      inputVAT: input.reduce((s, i) => s + Number(i.vat_amount || 0), 0),
    };
  }, [invoices]);

  const vatPayable = stats.outputVAT - stats.inputVAT;

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            <span className="material-symbols-outlined text-indigo-500">receipt</span>
            Hóa đơn & Thuế
          </h2>
          <p className="text-sm text-slate-500">Quản lý HĐĐT theo NĐ123 và Tờ khai thuế</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard icon="north_east" label="HĐ Đầu ra" value={fmt(stats.outputTotal)} sub={`${stats.outputCount} hóa đơn`} color="emerald" />
        <KPICard icon="south_west" label="HĐ Đầu vào" value={fmt(stats.inputTotal)} sub={`${stats.inputCount} hóa đơn`} color="blue" />
        <KPICard icon="trending_up" label="VAT Đầu ra" value={fmt(stats.outputVAT)} sub="Thuế thu hộ" color="violet" />
        <KPICard 
          icon={vatPayable >= 0 ? 'payments' : 'savings'} 
          label={vatPayable >= 0 ? 'VAT Phải nộp' : 'VAT Được khấu trừ'} 
          value={fmt(Math.abs(vatPayable))} 
          sub={vatPayable >= 0 ? 'Nộp ngân sách' : 'Còn được trừ'} 
          color={vatPayable >= 0 ? 'rose' : 'emerald'} 
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {[
          { key: 'invoices', label: 'Hóa đơn', icon: 'receipt' },
          { key: 'tax', label: 'Tờ khai thuế', icon: 'description' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === tab.key
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'invoices' ? (
        <InvoiceTab
          invoices={filtered}
          isLoading={isLoading}
          filterType={filterType}
          setFilterType={setFilterType}
          filterStatus={filterStatus}
          setFilterStatus={setFilterStatus}
          onAdd={() => { setEditingInvoice(null); setShowModal(true); }}
          onEdit={(inv) => { setEditingInvoice(inv); setShowModal(true); }}
          queryClient={queryClient}
        />
      ) : (
        <TaxTab
          declarations={taxDeclarations}
          stats={stats}
          vatPayable={vatPayable}
          onAdd={() => { setEditingTax(null); setShowTaxModal(true); }}
          onEdit={(t) => { setEditingTax(t); setShowTaxModal(true); }}
          queryClient={queryClient}
        />
      )}

      {/* Invoice Modal */}
      {showModal && (
        <InvoiceModal
          invoice={editingInvoice}
          projects={projects}
          onClose={() => { setShowModal(false); setEditingInvoice(null); }}
          onSaved={() => { queryClient.invalidateQueries({ queryKey: ['einvoices'] }); setShowModal(false); setEditingInvoice(null); }}
        />
      )}

      {/* Tax Declaration Modal */}
      {showTaxModal && (
        <TaxModal
          declaration={editingTax}
          stats={stats}
          vatPayable={vatPayable}
          onClose={() => { setShowTaxModal(false); setEditingTax(null); }}
          onSaved={() => { queryClient.invalidateQueries({ queryKey: ['tax_declarations'] }); setShowTaxModal(false); setEditingTax(null); }}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// KPI Card
// ═══════════════════════════════════════════════════════════
function KPICard({ icon, label, value, sub, color }) {
  const colors = {
    emerald: 'from-emerald-500 to-teal-600',
    blue: 'from-blue-500 to-cyan-600',
    violet: 'from-violet-500 to-purple-600',
    rose: 'from-rose-500 to-pink-600',
    indigo: 'from-indigo-500 to-blue-600',
  };
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${colors[color]} flex items-center justify-center shadow-lg`}>
          <span className="material-symbols-outlined text-white text-[16px]">{icon}</span>
        </div>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-lg font-black text-slate-800 tabular-nums">{value}</div>
      <div className="text-[10px] text-slate-400 mt-1">{sub}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Invoice Tab
// ═══════════════════════════════════════════════════════════
function InvoiceTab({ invoices, isLoading, filterType, setFilterType, filterStatus, setFilterStatus, onAdd, onEdit, queryClient }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Toolbar */}
      <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
        <div className="flex items-center gap-2 flex-wrap">
          <select value={filterType} onChange={e => setFilterType(e.target.value)}
            className="bg-indigo-50 border border-indigo-200 text-indigo-700 px-3 py-1.5 rounded-full text-[11px] font-bold focus:ring-2 focus:ring-indigo-400 outline-none cursor-pointer">
            <option value="all">Tất cả loại</option>
            <option value="output">HĐ Đầu ra</option>
            <option value="input">HĐ Đầu vào</option>
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-600 px-3 py-1.5 rounded-full text-[11px] font-bold focus:ring-2 focus:ring-slate-400 outline-none cursor-pointer">
            <option value="all">Tất cả TT</option>
            {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <button onClick={onAdd}
          className="flex items-center gap-1.5 bg-gradient-to-r from-indigo-600 to-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg shadow-indigo-200 hover:shadow-xl hover:-translate-y-0.5 transition-all">
          <span className="material-symbols-outlined text-[16px]">add</span>
          Tạo hóa đơn
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-400 font-bold text-[10px] uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 text-left">Loại</th>
              <th className="px-4 py-3 text-left">Số HĐ</th>
              <th className="px-4 py-3 text-left">Ngày</th>
              <th className="px-4 py-3 text-left">Đối tác</th>
              <th className="px-4 py-3 text-left">MST</th>
              <th className="px-4 py-3 text-right">Tiền hàng</th>
              <th className="px-4 py-3 text-right">VAT</th>
              <th className="px-4 py-3 text-right">Tổng TT</th>
              <th className="px-4 py-3 text-center">Trạng thái</th>
              <th className="px-4 py-3 text-center w-20">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr><td colSpan={10} className="py-16 text-center text-slate-400">
                <span className="material-symbols-outlined text-3xl animate-spin">progress_activity</span>
                <p className="mt-2 text-xs">Đang tải...</p>
              </td></tr>
            ) : invoices.length === 0 ? (
              <tr><td colSpan={10} className="py-16 text-center text-slate-400">
                <span className="material-symbols-outlined text-4xl mb-2 text-slate-300">receipt_long</span>
                <p className="text-xs font-medium">Chưa có hóa đơn nào</p>
              </td></tr>
            ) : invoices.map(inv => {
              const st = STATUS_MAP[inv.status] || STATUS_MAP.draft;
              const isOutput = inv.invoice_type === 'output';
              return (
                <tr key={inv.id} className="hover:bg-slate-50/50 group transition-colors">
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${isOutput ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}>
                      <span className="material-symbols-outlined text-[12px]">{isOutput ? 'north_east' : 'south_west'}</span>
                      {isOutput ? 'Đầu ra' : 'Đầu vào'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-bold text-slate-800 text-xs">{inv.invoice_series || ''}</span>
                    <span className="text-slate-400 mx-1">—</span>
                    <span className="font-mono text-indigo-600 font-bold text-xs">{inv.invoice_number || '—'}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 font-mono">
                    {inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString('vi-VN') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs font-bold text-slate-700 truncate max-w-[160px]">{inv.partner_name}</p>
                    {inv.projects?.code && <p className="text-[10px] text-slate-400">DA: {inv.projects.code}</p>}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 font-mono">{inv.partner_tax_code || '—'}</td>
                  <td className="px-4 py-3 text-right text-xs font-bold text-slate-600 tabular-nums">{fmt(inv.subtotal)}</td>
                  <td className="px-4 py-3 text-right text-xs font-bold text-violet-600 tabular-nums">{fmt(inv.vat_amount)}</td>
                  <td className="px-4 py-3 text-right text-xs font-black text-slate-800 tabular-nums">{fmt(inv.total_amount)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold ${st.color}`}>
                      <span className="material-symbols-outlined text-[12px]">{st.icon}</span>
                      {st.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => onEdit(inv)} className="p-1 text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors">
                        <span className="material-symbols-outlined text-[16px]">edit</span>
                      </button>
                      <button onClick={async () => {
                        if (!confirm('Xóa hóa đơn này?')) return;
                        await supabase.from('acc_einvoices').delete().eq('id', inv.id);
                        queryClient.invalidateQueries({ queryKey: ['einvoices'] });
                      }} className="p-1 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Tax Tab
// ═══════════════════════════════════════════════════════════
function TaxTab({ declarations, stats, vatPayable, onAdd, onEdit, queryClient }) {
  return (
    <div className="space-y-4">
      {/* VAT Summary Card */}
      <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex items-center gap-2 mb-4">
          <span className="material-symbols-outlined text-white/80">calculate</span>
          <h3 className="font-bold text-sm">Tổng hợp Thuế GTGT</h3>
        </div>
        <div className="grid grid-cols-3 gap-6">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-white/60 mb-1">VAT Đầu ra (33xx)</div>
            <div className="text-xl font-black tabular-nums">{fmt(stats.outputVAT)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-white/60 mb-1">VAT Đầu vào (133x)</div>
            <div className="text-xl font-black tabular-nums">{fmt(stats.inputVAT)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-white/60 mb-1">
              {vatPayable >= 0 ? 'Phải nộp NSNN' : 'Còn được khấu trừ'}
            </div>
            <div className={`text-xl font-black tabular-nums ${vatPayable >= 0 ? 'text-rose-300' : 'text-emerald-300'}`}>
              {fmt(Math.abs(vatPayable))}
            </div>
          </div>
        </div>
      </div>

      {/* Tax declarations table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px] text-violet-500">description</span>
            Tờ khai thuế
          </h3>
          <button onClick={onAdd}
            className="flex items-center gap-1.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg shadow-violet-200 hover:shadow-xl hover:-translate-y-0.5 transition-all">
            <span className="material-symbols-outlined text-[16px]">add</span>
            Tạo tờ khai
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-400 font-bold text-[10px] uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 text-left">Loại thuế</th>
                <th className="px-4 py-3 text-left">Kỳ</th>
                <th className="px-4 py-3 text-right">DT chịu thuế</th>
                <th className="px-4 py-3 text-right">VAT ĐR</th>
                <th className="px-4 py-3 text-right">VAT ĐV</th>
                <th className="px-4 py-3 text-right">Thuế phải nộp</th>
                <th className="px-4 py-3 text-center">Trạng thái</th>
                <th className="px-4 py-3 text-center w-20">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {declarations.length === 0 ? (
                <tr><td colSpan={8} className="py-12 text-center text-slate-400">
                  <span className="material-symbols-outlined text-3xl mb-2 text-slate-300">description</span>
                  <p className="text-xs">Chưa có tờ khai</p>
                </td></tr>
              ) : declarations.map(d => {
                const tType = TAX_TYPES.find(t => t.value === d.tax_type) || TAX_TYPES[0];
                const st = TAX_STATUS_MAP[d.status] || TAX_STATUS_MAP.draft;
                const periodLabel = d.period_month
                  ? `T${d.period_month}/${d.period_year}`
                  : d.period_quarter ? `Q${d.period_quarter}/${d.period_year}` : d.period_year;
                const payable = d.tax_type === 'GTGT' ? Number(d.vat_payable || 0)
                  : d.tax_type === 'TNDN' ? Number(d.cit_amount || 0)
                  : Number(d.pit_amount || 0);
                return (
                  <tr key={d.id} className="hover:bg-slate-50/50 group transition-colors">
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-${tType.color}-50 text-${tType.color}-700`}>
                        <span className="material-symbols-outlined text-[12px]">{tType.icon}</span>
                        {tType.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs font-bold text-slate-700">{periodLabel}</td>
                    <td className="px-4 py-3 text-right text-xs font-bold text-slate-600 tabular-nums">{fmt(d.taxable_revenue)}</td>
                    <td className="px-4 py-3 text-right text-xs font-bold text-emerald-600 tabular-nums">{fmt(d.output_vat)}</td>
                    <td className="px-4 py-3 text-right text-xs font-bold text-blue-600 tabular-nums">{fmt(d.input_vat)}</td>
                    <td className="px-4 py-3 text-right text-xs font-black text-rose-600 tabular-nums">{fmt(payable)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold ${st.color}`}>
                        {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => onEdit(d)} className="p-1 text-indigo-500 hover:bg-indigo-50 rounded-lg">
                          <span className="material-symbols-outlined text-[16px]">edit</span>
                        </button>
                        <button onClick={async () => {
                          if (!confirm('Xóa tờ khai thuế này?')) return;
                          await supabase.from('acc_tax_declarations').delete().eq('id', d.id);
                          queryClient.invalidateQueries({ queryKey: ['tax_declarations'] });
                        }} className="p-1 text-rose-500 hover:bg-rose-50 rounded-lg">
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Invoice Modal — Create / Edit
// ═══════════════════════════════════════════════════════════
function InvoiceModal({ invoice, projects, onClose, onSaved }) {
  const isEdit = !!invoice;
  const [form, setForm] = useState({
    invoice_type: invoice?.invoice_type || 'output',
    invoice_series: invoice?.invoice_series || '',
    invoice_number: invoice?.invoice_number || '',
    invoice_date: invoice?.invoice_date || new Date().toISOString().split('T')[0],
    partner_name: invoice?.partner_name || '',
    partner_tax_code: invoice?.partner_tax_code || '',
    partner_address: invoice?.partner_address || '',
    project_id: invoice?.project_id || '',
    subtotal: invoice?.subtotal || '',
    vat_rate: invoice?.vat_rate ?? 10,
    description: invoice?.description || '',
    status: invoice?.status || 'draft',
    lookup_code: invoice?.lookup_code || '',
  });
  const [saving, setSaving] = useState(false);

  const subtotalNum = Number(String(form.subtotal).replace(/[^0-9]/g, '')) || 0;
  const vatAmount = Math.round(subtotalNum * (Number(form.vat_rate) || 0) / 100);
  const totalAmount = subtotalNum + vatAmount;

  const handleSave = async () => {
    if (!form.partner_name) return alert('Vui lòng nhập tên đối tác');
    if (!form.invoice_date) return alert('Vui lòng chọn ngày hóa đơn');
    setSaving(true);

    const payload = {
      invoice_type: form.invoice_type,
      invoice_series: form.invoice_series || null,
      invoice_number: form.invoice_number || null,
      invoice_date: form.invoice_date,
      partner_type: form.invoice_type === 'output' ? 'customer' : 'supplier',
      partner_name: form.partner_name,
      partner_tax_code: form.partner_tax_code || null,
      partner_address: form.partner_address || null,
      project_id: form.project_id || null,
      subtotal: subtotalNum,
      vat_rate: Number(form.vat_rate) || 0,
      vat_amount: vatAmount,
      total_amount: totalAmount,
      description: form.description || null,
      status: form.status,
      lookup_code: form.lookup_code || null,
    };

    let error;
    if (isEdit) {
      ({ error } = await supabase.from('acc_einvoices').update(payload).eq('id', invoice.id));
    } else {
      ({ error } = await supabase.from('acc_einvoices').insert([payload]));
    }

    if (error) {
      alert('Lỗi: ' + error.message);
    } else {
      onSaved();
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-slide-up max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
            <span className="material-symbols-outlined text-indigo-500">receipt</span>
            {isEdit ? 'Sửa hóa đơn' : 'Tạo hóa đơn mới'}
          </h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Form */}
        <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
          {/* Type selector */}
          <div className="flex gap-2">
            {INVOICE_TYPES.map(t => (
              <button key={t.value} onClick={() => setForm(f => ({ ...f, invoice_type: t.value }))}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold border-2 transition-all ${
                  form.invoice_type === t.value 
                    ? `border-${t.color}-500 bg-${t.color}-50 text-${t.color}-700 shadow-sm` 
                    : 'border-slate-200 text-slate-400 hover:border-slate-300'
                }`}>
                <span className="material-symbols-outlined text-[16px]">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>

          {/* Invoice info */}
          <div className="grid grid-cols-3 gap-3">
            <FormField label="Ký hiệu HĐ" value={form.invoice_series} onChange={v => setForm(f => ({ ...f, invoice_series: v }))} placeholder="1C24TAA" />
            <FormField label="Số HĐ" value={form.invoice_number} onChange={v => setForm(f => ({ ...f, invoice_number: v }))} placeholder="0000001" />
            <FormField label="Ngày HĐ" type="date" value={form.invoice_date} onChange={v => setForm(f => ({ ...f, invoice_date: v }))} />
          </div>

          {/* Partner info */}
          <FormField label={form.invoice_type === 'output' ? 'Tên khách hàng' : 'Tên NCC'} value={form.partner_name} onChange={v => setForm(f => ({ ...f, partner_name: v }))} required />
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Mã số thuế" value={form.partner_tax_code} onChange={v => setForm(f => ({ ...f, partner_tax_code: v }))} placeholder="0100123456" />
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Dự án</label>
              <select value={form.project_id} onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-400 outline-none">
                <option value="">— Không chọn —</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
              </select>
            </div>
          </div>

          {/* Amounts */}
          <div className="grid grid-cols-3 gap-3">
            <FormField label="Tiền hàng" value={fmt(form.subtotal)} onChange={v => setForm(f => ({ ...f, subtotal: v.replace(/[^0-9]/g, '') }))} align="right" />
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Thuế suất</label>
              <select value={form.vat_rate} onChange={e => setForm(f => ({ ...f, vat_rate: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-400 outline-none">
                {VAT_RATES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Tiền thuế</label>
              <div className="border border-slate-100 rounded-lg px-3 py-2 text-xs font-bold text-violet-600 bg-slate-50 tabular-nums">{fmt(vatAmount)}</div>
            </div>
          </div>

          {/* Total */}
          <div className="bg-gradient-to-r from-indigo-50 to-violet-50 rounded-xl p-4 border border-indigo-100">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-600">Tổng thanh toán</span>
              <span className="text-lg font-black text-indigo-700 tabular-nums">{fmt(totalAmount)}</span>
            </div>
          </div>

          {/* Status + Lookup code */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Trạng thái</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-400 outline-none">
                {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <FormField label="Mã tra cứu CQT" value={form.lookup_code} onChange={v => setForm(f => ({ ...f, lookup_code: v }))} placeholder="AB12CD..." />
          </div>

          <FormField label="Mô tả" value={form.description} onChange={v => setForm(f => ({ ...f, description: v }))} multiline />
        </div>

        {/* Footer */}
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

// ═══════════════════════════════════════════════════════════
// Tax Declaration Modal — Create / Edit
// ═══════════════════════════════════════════════════════════
function TaxModal({ declaration, stats, vatPayable, onClose, onSaved }) {
  const isEdit = !!declaration;
  const now = new Date();
  const [form, setForm] = useState({
    tax_type: declaration?.tax_type || 'GTGT',
    period_type: declaration?.period_type || 'monthly',
    period_month: declaration?.period_month || now.getMonth() + 1,
    period_quarter: declaration?.period_quarter || Math.ceil((now.getMonth() + 1) / 3),
    period_year: declaration?.period_year || now.getFullYear(),
    taxable_revenue: declaration?.taxable_revenue || '',
    output_vat: declaration?.output_vat ?? stats.outputVAT ?? '',
    input_vat: declaration?.input_vat ?? stats.inputVAT ?? '',
    vat_payable: declaration?.vat_payable ?? vatPayable ?? '',
    cit_taxable_income: declaration?.cit_taxable_income || '',
    cit_amount: declaration?.cit_amount || '',
    pit_amount: declaration?.pit_amount || '',
    status: declaration?.status || 'draft',
    notes: declaration?.notes || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      tax_type: form.tax_type,
      period_type: form.period_type,
      period_month: form.period_type === 'monthly' ? Number(form.period_month) : null,
      period_quarter: form.period_type === 'quarterly' ? Number(form.period_quarter) : null,
      period_year: Number(form.period_year),
      taxable_revenue: Number(String(form.taxable_revenue).replace(/[^0-9]/g, '')) || 0,
      output_vat: Number(String(form.output_vat).replace(/[^0-9]/g, '')) || 0,
      input_vat: Number(String(form.input_vat).replace(/[^0-9]/g, '')) || 0,
      vat_payable: Number(String(form.vat_payable).replace(/[^-0-9]/g, '')) || 0,
      cit_taxable_income: Number(String(form.cit_taxable_income).replace(/[^0-9]/g, '')) || 0,
      cit_amount: Number(String(form.cit_amount).replace(/[^0-9]/g, '')) || 0,
      pit_amount: Number(String(form.pit_amount).replace(/[^0-9]/g, '')) || 0,
      status: form.status,
      notes: form.notes || null,
      submission_date: form.status === 'submitted' ? new Date().toISOString().split('T')[0] : declaration?.submission_date || null,
    };

    let error;
    if (isEdit) {
      ({ error } = await supabase.from('acc_tax_declarations').update(payload).eq('id', declaration.id));
    } else {
      ({ error } = await supabase.from('acc_tax_declarations').insert([payload]));
    }

    if (error) alert('Lỗi: ' + error.message);
    else onSaved();
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-slide-up max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
            <span className="material-symbols-outlined text-violet-500">description</span>
            {isEdit ? 'Sửa tờ khai' : 'Tạo tờ khai thuế'}
          </h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
          {/* Tax type */}
          <div className="flex gap-2">
            {TAX_TYPES.map(t => (
              <button key={t.value} onClick={() => setForm(f => ({ ...f, tax_type: t.value }))}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-[11px] font-bold border-2 transition-all ${
                  form.tax_type === t.value ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-400'
                }`}>
                <span className="material-symbols-outlined text-[14px]">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>

          {/* Period */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Loại kỳ</label>
              <select value={form.period_type} onChange={e => setForm(f => ({ ...f, period_type: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-400 outline-none">
                <option value="monthly">Tháng</option>
                <option value="quarterly">Quý</option>
                <option value="yearly">Năm</option>
              </select>
            </div>
            {form.period_type === 'monthly' && (
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Tháng</label>
                <select value={form.period_month} onChange={e => setForm(f => ({ ...f, period_month: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-400 outline-none">
                  {[...Array(12)].map((_, i) => <option key={i + 1} value={i + 1}>T{i + 1}</option>)}
                </select>
              </div>
            )}
            {form.period_type === 'quarterly' && (
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Quý</label>
                <select value={form.period_quarter} onChange={e => setForm(f => ({ ...f, period_quarter: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-400 outline-none">
                  {[1, 2, 3, 4].map(q => <option key={q} value={q}>Q{q}</option>)}
                </select>
              </div>
            )}
            <FormField label="Năm" type="number" value={form.period_year} onChange={v => setForm(f => ({ ...f, period_year: v }))} />
          </div>

          {/* GTGT fields */}
          {form.tax_type === 'GTGT' && (
            <div className="space-y-3 p-3 bg-indigo-50/50 rounded-xl border border-indigo-100">
              <FormField label="DT chịu thuế" value={fmt(form.taxable_revenue)} onChange={v => setForm(f => ({ ...f, taxable_revenue: v.replace(/[^0-9]/g, '') }))} align="right" />
              <div className="grid grid-cols-2 gap-3">
                <FormField label="VAT Đầu ra" value={fmt(form.output_vat)} onChange={v => setForm(f => ({ ...f, output_vat: v.replace(/[^0-9]/g, '') }))} align="right" />
                <FormField label="VAT Đầu vào" value={fmt(form.input_vat)} onChange={v => setForm(f => ({ ...f, input_vat: v.replace(/[^0-9]/g, '') }))} align="right" />
              </div>
              <FormField label="Thuế phải nộp" value={fmt(form.vat_payable)} onChange={v => setForm(f => ({ ...f, vat_payable: v.replace(/[^0-9-]/g, '') }))} align="right" />
            </div>
          )}

          {/* TNDN fields */}
          {form.tax_type === 'TNDN' && (
            <div className="space-y-3 p-3 bg-violet-50/50 rounded-xl border border-violet-100">
              <FormField label="TN chịu thuế TNDN" value={fmt(form.cit_taxable_income)} onChange={v => setForm(f => ({ ...f, cit_taxable_income: v.replace(/[^0-9]/g, '') }))} align="right" />
              <FormField label="Thuế TNDN phải nộp" value={fmt(form.cit_amount)} onChange={v => setForm(f => ({ ...f, cit_amount: v.replace(/[^0-9]/g, '') }))} align="right" />
            </div>
          )}

          {/* TNCN fields */}
          {form.tax_type === 'TNCN' && (
            <div className="space-y-3 p-3 bg-cyan-50/50 rounded-xl border border-cyan-100">
              <FormField label="Thuế TNCN phải nộp" value={fmt(form.pit_amount)} onChange={v => setForm(f => ({ ...f, pit_amount: v.replace(/[^0-9]/g, '') }))} align="right" />
            </div>
          )}

          {/* Status */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Trạng thái</label>
            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-400 outline-none">
              {Object.entries(TAX_STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>

          <FormField label="Ghi chú" value={form.notes} onChange={v => setForm(f => ({ ...f, notes: v }))} multiline />
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">Hủy</button>
          <button onClick={handleSave} disabled={saving}
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
// Form Field helper
// ═══════════════════════════════════════════════════════════
function FormField({ label, value, onChange, type = 'text', placeholder, required, align, multiline }) {
  return (
    <div>
      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      {multiline ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-400 outline-none resize-none" rows={2} />
      ) : (
        <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          className={`w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-400 outline-none ${align === 'right' ? 'text-right font-bold tabular-nums' : ''}`} />
      )}
    </div>
  );
}
