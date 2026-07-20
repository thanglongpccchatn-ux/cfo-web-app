import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import PayablesSummary from './PayablesSummary';
import PurchaseTimeline from './PurchaseTimeline';
import SupplierPaymentForm from './SupplierPaymentForm';
import PayablesExcelImport from './PayablesExcelImport';
import PurchaseOrders from './PurchaseOrders';
import { calcPayablesSummary, formatCurrency, projectOption } from './payablesUtils';
import SearchableSelect from '../common/SearchableSelect';

const TABS = [
  { key: 'summary', label: 'Tổng quan Công nợ', icon: 'account_balance' },
  { key: 'orders', label: 'Đơn mua hàng', icon: 'receipt_long' },
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
  const [deleting, setDeleting] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);   // mobile: thu gọn bộ lọc

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
        const CHUNK = 1000; const map = new Map();
        for (let from = 0; ; from += CHUNK) {
          // Khóa phụ 'id' để phân trang ỔN ĐỊNH (orderCol chỉ theo ngày -> trùng giá trị,
          // không có tiebreaker sẽ sót/nhân đôi ở mốc 1000). Dedup theo id cho chắc.
          const { data, error } = await supabase.from(table).select(select)
            .order(orderCol, { ascending: false }).order('id', { ascending: false })
            .range(from, from + CHUNK - 1);
          if (error) throw error;
          (data || []).forEach(r => { if (r?.id != null) map.set(r.id, r); });
          if (!data || data.length < CHUNK) break;
        }
        return [...map.values()];
      };
      const [purchAll, payAll, projRes, suppRes] = await Promise.all([
        fetchAll('supplier_purchases_v', '*, partners:supplier_id(name, code), projects:project_id(name, code, internal_code)', 'purchase_date'),
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

  // Options cho ô tìm kiếm thông minh (kèm "Tất cả")
  const projectSelectOptions = useMemo(() => [{ id: '', label: 'Tất cả' }, ...projects.map(p => ({ id: p.id, label: projectOption(p) }))], [projects]);
  const supplierSelectOptions = useMemo(() => [{ id: '', label: 'Tất cả' }, ...suppliers.map(s => ({ id: s.id, label: s.name }))], [suppliers]);
  const groupSelectOptions = useMemo(() => [{ id: '', label: 'Tất cả' }, ...materialGroups.map(g => ({ id: g, label: g }))], [materialGroups]);

  const clearFilters = () => {
    setFilterProject('');
    setFilterSupplier('');
    setFilterGroup('');
    setFilterDateFrom('');
    setFilterDateTo('');
  };

  const hasFilters = filterProject || filterSupplier || filterGroup || filterDateFrom || filterDateTo;
  const activeFilterCount = [filterProject, filterSupplier, filterGroup, filterDateFrom, filterDateTo].filter(Boolean).length;

  // Xóa hàng loạt các dòng MUA HÀNG đang lọc (vd: lọc NCC = Hồng Dương rồi xóa hết bản ghi trùng).
  const deleteFilteredPurchases = async () => {
    const rows = filteredPurchases;
    if (!rows.length) return;
    const suppName = filterSupplier ? (suppliers.find(s => s.id === filterSupplier)?.name || '') : '';
    if (!window.confirm(`Xóa ${rows.length} dòng MUA HÀNG đang lọc${suppName ? ` của NCC "${suppName}"` : ''}?\n\nKhông thể hoàn tác.`)) return;
    setDeleting(true);
    try {
      const ids = rows.map(r => r.id).filter(Boolean);
      for (let i = 0; i < ids.length; i += 500) {
        const { error } = await supabase.from('supplier_purchases').delete().in('id', ids.slice(i, i + 500));
        if (error) throw error;
      }
      await fetchData();
    } catch (err) {
      alert('Lỗi xóa: ' + (err.message || err));
    } finally {
      setDeleting(false);
    }
  };

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

      {/* Filters — mobile: thu gọn sau nút "Bộ lọc" (1 instance duy nhất, live-apply như cũ); desktop: hiển thị trực tiếp */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-3 md:p-4">
        {/* Hàng nút mobile: toggle bộ lọc + Import luôn hiển thị (không giấu vào khối thu gọn) */}
        <div className="flex md:hidden items-center gap-2">
          <button onClick={() => setFiltersOpen(o => !o)} aria-expanded={filtersOpen}
            className="flex-1 min-h-[44px] flex items-center justify-center gap-1.5 px-3 rounded-lg border border-slate-200 dark:border-slate-600 text-sm font-bold text-slate-600 dark:text-slate-300 active:bg-slate-50 dark:active:bg-slate-700/40">
            <span className="material-symbols-outlined text-[18px]">filter_list</span>Bộ lọc
            {activeFilterCount > 0 && (
              <span className="min-w-[20px] h-5 px-1 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center">{activeFilterCount}</span>
            )}
            <span className="material-symbols-outlined text-[18px]">{filtersOpen ? 'expand_less' : 'expand_more'}</span>
          </button>
          <button onClick={() => setShowImport(true)} className="min-h-[44px] flex items-center gap-1.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold shadow-sm transition-colors">
            <span className="material-symbols-outlined text-[16px]">upload_file</span>Import
          </button>
        </div>
        {/* Nút xóa hàng loạt (nguy hiểm): luôn hiển thị rõ trên mobile khi active, không giấu trong bộ lọc */}
        {hasFilters && activeTab === 'timeline' && filteredPurchases.length > 0 && (
          <button onClick={deleteFilteredPurchases} disabled={deleting}
            className="md:hidden mt-2 w-full min-h-[44px] flex items-center justify-center gap-1.5 px-4 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg text-sm font-bold shadow-sm transition-colors">
            <span className="material-symbols-outlined text-[16px]">delete_sweep</span>{deleting ? 'Đang xóa...' : `Xóa ${filteredPurchases.length} dòng lọc`}
          </button>
        )}
        <div className={`${filtersOpen ? 'flex' : 'hidden'} md:flex flex-wrap items-end gap-3 mt-3 md:mt-0`}>
          <div className="w-full md:flex-1 md:min-w-[140px]">
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Công trình</label>
            <SearchableSelect options={projectSelectOptions} value={filterProject} onChange={setFilterProject} placeholder="Tất cả" />
          </div>
          <div className="w-full md:flex-1 md:min-w-[140px]">
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Nhà cung cấp</label>
            <SearchableSelect options={supplierSelectOptions} value={filterSupplier} onChange={setFilterSupplier} placeholder="Tất cả" />
          </div>
          <div className="w-full md:flex-1 md:min-w-[120px]">
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Nhóm VT</label>
            <SearchableSelect options={groupSelectOptions} value={filterGroup} onChange={setFilterGroup} placeholder="Tất cả" />
          </div>
          <div className="flex-1 min-w-[45%] md:flex-none md:min-w-[120px]">
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Từ ngày</label>
            <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)}
              className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2.5 md:py-2 bg-white dark:bg-slate-700 text-slate-800 dark:text-white" />
          </div>
          <div className="flex-1 min-w-[45%] md:flex-none md:min-w-[120px]">
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Đến ngày</label>
            <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)}
              className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2.5 md:py-2 bg-white dark:bg-slate-700 text-slate-800 dark:text-white" />
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            {hasFilters && (
              <button onClick={clearFilters} className="flex-1 md:flex-none min-h-[44px] md:min-h-0 justify-center text-sm text-slate-500 hover:text-rose-500 flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 md:border-0 transition-colors">
                <span className="material-symbols-outlined text-[16px]">filter_alt_off</span>Xóa lọc
              </button>
            )}
            {hasFilters && activeTab === 'timeline' && filteredPurchases.length > 0 && (
              <button onClick={deleteFilteredPurchases} disabled={deleting} title="Xóa toàn bộ mua hàng đang lọc" className="hidden md:flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg text-sm font-bold shadow-sm transition-colors">
                <span className="material-symbols-outlined text-[16px]">delete_sweep</span>{deleting ? 'Đang xóa...' : `Xóa ${filteredPurchases.length} dòng lọc`}
              </button>
            )}
            <button onClick={() => setShowImport(true)} className="hidden md:flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold shadow-sm transition-colors">
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
              aria-label={tab.label}
              className={`flex-1 sm:flex-none justify-center sm:justify-start min-h-[44px] flex items-center gap-2 px-2 sm:px-5 py-3 text-sm font-bold transition-all border-b-2 ${
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
          {activeTab === 'orders' && (
            <PurchaseOrders
              purchases={filteredPurchases}
              payments={filteredPayments}
              projects={projects}
              suppliers={suppliers}
              onRefresh={fetchData}
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
    <div className={`bg-gradient-to-br ${colorMap[color]} rounded-2xl p-3 md:p-4 border border-white/60 dark:border-slate-700/50`}>
      <div className="flex items-center gap-2 md:gap-3 mb-1.5 md:mb-2">
        <div className={`w-7 h-7 md:w-9 md:h-9 rounded-lg md:rounded-xl flex items-center justify-center shrink-0 ${iconBg[color]}`}>
          <span className="material-symbols-outlined text-[16px] md:text-[20px]">{icon}</span>
        </div>
        <span className="text-[10px] md:text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 leading-tight">{label}</span>
      </div>
      <p className={`text-base sm:text-xl md:text-2xl font-black tracking-tight break-words ${colorMap[color].split(' ').slice(2).join(' ')}`}>{value}</p>
    </div>
  );
}
