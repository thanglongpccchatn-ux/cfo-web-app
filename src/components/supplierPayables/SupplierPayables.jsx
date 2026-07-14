import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import PayablesSummary from './PayablesSummary';
import PurchaseTimeline from './PurchaseTimeline';
import SupplierPaymentForm from './SupplierPaymentForm';
import PayablesExcelImport from './PayablesExcelImport';
import { calcPayablesSummary, formatCurrency, projectOption } from './payablesUtils';

const TABS = [
  { key: 'summary', label: 'Tổng quan Công nợ', icon: 'account_balance' },
  { key: 'timeline', label: 'Chi tiết Mua hàng', icon: 'timeline' },
  { key: 'payment', label: 'Thanh toán NCC', icon: 'payments' },
];

export default function SupplierPayables() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('summary');
  const [purchases, setPurchases] = useState([]);
  const [payments, setPayments] = useState([]);
  const [projects, setProjects] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);

  // Filters
  const [filterProject, setFilterProject] = useState('');
  const [filterSupplier, setFilterSupplier] = useState('');
  const [filterGroup, setFilterGroup] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  // Fetch all data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Supabase mặc định trả tối đa 1000 dòng/lần -> lặp phân trang để lấy HẾT bản ghi.
      const fetchAll = async (table, select, orderCol) => {
        const CHUNK = 1000; const all = [];
        for (let from = 0; ; from += CHUNK) {
          const { data, error } = await supabase.from(table).select(select)
            .order(orderCol, { ascending: false }).range(from, from + CHUNK - 1);
          if (error) throw error;
          all.push(...(data || []));
          if (!data || data.length < CHUNK) break;
        }
        return all;
      };
      const [purchAll, payAll, projRes, suppRes] = await Promise.all([
        fetchAll('supplier_purchases', '*, partners:supplier_id(name, code), projects:project_id(name, code, internal_code)', 'purchase_date'),
        fetchAll('supplier_payments', '*, partners:supplier_id(name, code), projects:project_id(name, code, internal_code)', 'payment_date'),
        supabase.from('projects').select('id, name, code, internal_code').order('name'),
        // NCC lấy từ bảng `suppliers` (danh mục Nhà cung cấp, CÓ mã) — cũng là bảng mà
        // supplier_purchases.supplier_id tham chiếu (split_partners_and_materials.sql).
        supabase.from('suppliers').select('id, name, code').order('name'),
      ]);

      setPurchases(purchAll);
      setPayments(payAll);
      setProjects(projRes.data || []);
      setSuppliers(suppRes.data || []);
    } catch (err) {
      console.error('Error fetching payables data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Filtered data
  const filteredPurchases = useMemo(() => {
    let data = purchases;
    if (filterProject) data = data.filter(d => d.project_id === filterProject);
    if (filterSupplier) data = data.filter(d => d.supplier_id === filterSupplier);
    if (filterGroup) data = data.filter(d => d.material_group === filterGroup);
    if (filterDateFrom) data = data.filter(d => d.purchase_date >= filterDateFrom);
    if (filterDateTo) data = data.filter(d => d.purchase_date <= filterDateTo);
    return data;
  }, [purchases, filterProject, filterSupplier, filterGroup, filterDateFrom, filterDateTo]);

  const filteredPayments = useMemo(() => {
    let data = payments;
    if (filterProject) data = data.filter(d => d.project_id === filterProject);
    if (filterSupplier) data = data.filter(d => d.supplier_id === filterSupplier);
    if (filterGroup) data = data.filter(d => d.material_group === filterGroup);
    if (filterDateFrom) data = data.filter(d => d.payment_date >= filterDateFrom);
    if (filterDateTo) data = data.filter(d => d.payment_date <= filterDateTo);
    return data;
  }, [payments, filterProject, filterSupplier, filterGroup, filterDateFrom, filterDateTo]);

  const summary = useMemo(() => calcPayablesSummary(filteredPurchases, filteredPayments), [filteredPurchases, filteredPayments]);

  // Unique material groups from data
  const materialGroups = useMemo(() => {
    const groups = new Set(purchases.map(p => p.material_group).filter(Boolean));
    return [...groups].sort();
  }, [purchases]);

  const clearFilters = () => {
    setFilterProject('');
    setFilterSupplier('');
    setFilterGroup('');
    setFilterDateFrom('');
    setFilterDateTo('');
  };

  const hasFilters = filterProject || filterSupplier || filterGroup || filterDateFrom || filterDateTo;

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6 max-w-[1600px] mx-auto">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <KPICard icon="shopping_cart" label="Tổng mua hàng" value={formatCurrency(summary.totalPurchased)} color="blue" />
        <KPICard icon="paid" label="Đã thanh toán" value={formatCurrency(summary.totalPaid)} color="emerald" />
        <KPICard icon="account_balance_wallet" label="Còn nợ" value={formatCurrency(summary.balanceDue)} color={summary.balanceDue > 0 ? 'rose' : 'emerald'} />
        <KPICard icon="percent" label="Tỉ lệ TT" value={`${summary.paidPercent.toFixed(1)}%`} color="amber" />
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[140px]">
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Công trình</label>
            <select value={filterProject} onChange={e => setFilterProject(e.target.value)}
              className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700 text-slate-800 dark:text-white">
              <option value="">Tất cả</option>
              {projects.map(p => <option key={p.id} value={p.id}>{projectOption(p)}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Nhà cung cấp</label>
            <select value={filterSupplier} onChange={e => setFilterSupplier(e.target.value)}
              className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700 text-slate-800 dark:text-white">
              <option value="">Tất cả</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[120px]">
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Nhóm VT</label>
            <select value={filterGroup} onChange={e => setFilterGroup(e.target.value)}
              className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700 text-slate-800 dark:text-white">
              <option value="">Tất cả</option>
              {materialGroups.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div className="min-w-[120px]">
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Từ ngày</label>
            <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)}
              className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700 text-slate-800 dark:text-white" />
          </div>
          <div className="min-w-[120px]">
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Đến ngày</label>
            <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)}
              className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700 text-slate-800 dark:text-white" />
          </div>
          <div className="flex items-center gap-2">
            {hasFilters && (
              <button onClick={clearFilters} className="text-sm text-slate-500 hover:text-rose-500 flex items-center gap-1 px-3 py-2 transition-colors">
                <span className="material-symbols-outlined text-[16px]">filter_alt_off</span>Xóa lọc
              </button>
            )}
            <button onClick={() => setShowImport(true)} className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold shadow-sm transition-colors">
              <span className="material-symbols-outlined text-[16px]">upload_file</span>Import Excel
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="flex border-b border-slate-200 dark:border-slate-700">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-bold transition-all border-b-2 ${
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-600 bg-blue-50/50 dark:bg-blue-900/10'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-700/30'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="p-4 md:p-6">
          {activeTab === 'summary' && (
            <PayablesSummary
              purchases={filteredPurchases}
              payments={filteredPayments}
              onViewSupplier={(supplierId) => { setFilterSupplier(supplierId); setActiveTab('timeline'); }}
            />
          )}
          {activeTab === 'timeline' && (
            <PurchaseTimeline
              purchases={filteredPurchases}
              payments={filteredPayments}
              projects={projects}
              suppliers={suppliers}
              onRefresh={fetchData}
            />
          )}
          {activeTab === 'payment' && (
            <SupplierPaymentForm
              projects={projects}
              suppliers={suppliers}
              purchases={filteredPurchases}
              payments={filteredPayments}
              materialGroups={materialGroups}
              onSaved={fetchData}
            />
          )}
        </div>
      </div>

      {/* Excel Import Modal */}
      {showImport && (
        <PayablesExcelImport
          projects={projects}
          suppliers={suppliers}
          onClose={() => setShowImport(false)}
          onImported={fetchData}
        />
      )}
    </div>
  );
}

function KPICard({ icon, label, value, color = 'blue' }) {
  const colorMap = {
    blue: 'from-blue-500/10 to-blue-600/5 text-blue-600 dark:text-blue-400',
    emerald: 'from-emerald-500/10 to-emerald-600/5 text-emerald-600 dark:text-emerald-400',
    rose: 'from-rose-500/10 to-rose-600/5 text-rose-600 dark:text-rose-400',
    amber: 'from-amber-500/10 to-amber-600/5 text-amber-600 dark:text-amber-400',
  };
  const iconBg = {
    blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600',
    emerald: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600',
    rose: 'bg-rose-100 dark:bg-rose-900/30 text-rose-600',
    amber: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600',
  };

  return (
    <div className={`bg-gradient-to-br ${colorMap[color]} rounded-2xl p-4 border border-white/60 dark:border-slate-700/50`}>
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${iconBg[color]}`}>
          <span className="material-symbols-outlined text-[20px]">{icon}</span>
        </div>
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</span>
      </div>
      <p className={`text-xl md:text-2xl font-black tracking-tight ${colorMap[color].split(' ').slice(2).join(' ')}`}>{value}</p>
    </div>
  );
}
