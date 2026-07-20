import React, { useMemo, useState } from 'react';
import { groupBySupplier, formatCurrency } from './payablesUtils';

export default function PayablesSummary({ purchases = [], payments = [], onViewSupplier }) {
  const [sortField, setSortField] = useState('totalPurchased');
  const [sortDir, setSortDir] = useState('desc');
  const [expandedSupplier, setExpandedSupplier] = useState(null);

  const grouped = useMemo(() => {
    const data = groupBySupplier(purchases, payments);
    return data.sort((a, b) => {
      const va = a[sortField] || 0;
      const vb = b[sortField] || 0;
      return sortDir === 'desc' ? vb - va : va - vb;
    });
  }, [purchases, payments, sortField, sortDir]);

  const toggleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const SortIcon = ({ field }) => (
    sortField === field
      ? <span className="material-symbols-outlined text-[14px] ml-0.5">{sortDir === 'desc' ? 'arrow_downward' : 'arrow_upward'}</span>
      : <span className="material-symbols-outlined text-[14px] ml-0.5 opacity-30">unfold_more</span>
  );

  if (grouped.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <span className="material-symbols-outlined text-6xl text-slate-300 dark:text-slate-600 mb-4">inventory_2</span>
        <p className="text-slate-500 dark:text-slate-400 font-medium">Chưa có dữ liệu mua hàng</p>
        <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">Sử dụng "Import Excel" hoặc thêm dữ liệu tại tab "Chi tiết Mua hàng"</p>
      </div>
    );
  }

  const totalPurchasedAll = grouped.reduce((s, g) => s + g.totalPurchased, 0);
  const totalPaidAll = grouped.reduce((s, g) => s + g.totalPaid, 0);

  return (
    <div className="space-y-4">
      {/* ── MOBILE: card list NCC (bấm card -> tab Chi tiết lọc theo NCC) ── */}
      <div className="md:hidden space-y-3">
        {grouped.map((supplier) => {
          const balance = supplier.totalPurchased - supplier.totalPaid;
          const paidPct = supplier.totalPurchased > 0 ? (supplier.totalPaid / supplier.totalPurchased) * 100 : 0;
          const groupCount = Object.keys(supplier.groups).length;
          return (
            <button key={supplier.supplier_id} onClick={() => onViewSupplier?.(supplier.supplier_id)}
              className="w-full text-left rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 active:bg-slate-50 dark:active:bg-slate-700/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold uppercase text-slate-800 dark:text-white text-[13px] break-words line-clamp-2">{supplier.supplier_code || supplier.supplier_name}</p>
                  {supplier.supplier_code && <p className="text-[11px] text-slate-400 uppercase break-words line-clamp-2">{supplier.supplier_name}</p>}
                </div>
                <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded-full text-slate-500 font-bold shrink-0">{groupCount} nhóm</span>
              </div>
              <div className="grid grid-cols-3 gap-1 mt-2 text-[11px]">
                <div>
                  <p className="text-slate-400">Tổng mua</p>
                  <p className="font-mono font-bold text-blue-600 dark:text-blue-400">{formatCurrency(supplier.totalPurchased)}</p>
                </div>
                <div>
                  <p className="text-slate-400">Đã trả</p>
                  <p className="font-mono font-bold text-emerald-600">{formatCurrency(supplier.totalPaid)}</p>
                </div>
                <div className="text-right">
                  <p className="text-slate-400">Còn nợ</p>
                  <p className={`font-mono font-bold ${balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{formatCurrency(balance)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${paidPct >= 100 ? 'bg-emerald-500' : paidPct >= 50 ? 'bg-blue-500' : 'bg-amber-500'}`}
                    style={{ width: `${Math.min(paidPct, 100)}%` }} />
                </div>
                <span className="text-[10px] font-bold text-slate-500 shrink-0">{paidPct.toFixed(0)}%</span>
              </div>
            </button>
          );
        })}
        <div className="rounded-xl border-2 border-slate-300 dark:border-slate-500 bg-slate-50 dark:bg-slate-800/50 px-3 py-2.5">
          <p className="text-[11px] font-black uppercase text-slate-700 dark:text-white mb-1.5">Tổng cộng ({grouped.length} NCC)</p>
          <div className="grid grid-cols-3 gap-1 text-[11px]">
            <div>
              <p className="text-slate-400">Tổng mua</p>
              <p className="font-mono font-black text-slate-800 dark:text-white">{formatCurrency(totalPurchasedAll)}</p>
            </div>
            <div>
              <p className="text-slate-400">Đã trả</p>
              <p className="font-mono font-black text-emerald-600">{formatCurrency(totalPaidAll)}</p>
            </div>
            <div className="text-right">
              <p className="text-slate-400">Còn nợ</p>
              <p className="font-mono font-black text-rose-600">{formatCurrency(totalPurchasedAll - totalPaidAll)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── DESKTOP: bảng đầy đủ ── */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-slate-200 dark:border-slate-600">
              <th className="text-left py-3 px-3 font-bold text-slate-600 dark:text-slate-300 uppercase text-[11px] tracking-wider">Nhà cung cấp</th>
              <th className="text-left py-3 px-3 font-bold text-slate-600 dark:text-slate-300 uppercase text-[11px] tracking-wider">Nhóm VT</th>
              <th className="text-right py-3 px-3 font-bold text-slate-600 dark:text-slate-300 uppercase text-[11px] tracking-wider cursor-pointer select-none hover:text-blue-600"
                onClick={() => toggleSort('totalPurchased')}>
                Tổng mua<SortIcon field="totalPurchased" />
              </th>
              <th className="text-right py-3 px-3 font-bold text-slate-600 dark:text-slate-300 uppercase text-[11px] tracking-wider cursor-pointer select-none hover:text-blue-600"
                onClick={() => toggleSort('totalPaid')}>
                Đã trả<SortIcon field="totalPaid" />
              </th>
              <th className="text-right py-3 px-3 font-bold text-slate-600 dark:text-slate-300 uppercase text-[11px] tracking-wider">Còn nợ</th>
              <th className="text-center py-3 px-3 font-bold text-slate-600 dark:text-slate-300 uppercase text-[11px] tracking-wider">Tiến độ TT</th>
              <th className="text-center py-3 px-3 font-bold text-slate-600 dark:text-slate-300 uppercase text-[11px] tracking-wider w-16"></th>
            </tr>
          </thead>
          <tbody>
            {grouped.map((supplier) => {
              const balance = supplier.totalPurchased - supplier.totalPaid;
              const paidPct = supplier.totalPurchased > 0 ? (supplier.totalPaid / supplier.totalPurchased) * 100 : 0;
              const isExpanded = expandedSupplier === supplier.supplier_id;
              const groupKeys = Object.keys(supplier.groups);

              return (
                <React.Fragment key={supplier.supplier_id}>
                  {/* Supplier Row */}
                  <tr
                    className={`border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer transition-colors ${isExpanded ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                    onClick={() => setExpandedSupplier(isExpanded ? null : supplier.supplier_id)}
                  >
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <span className={`material-symbols-outlined text-[16px] transition-transform ${isExpanded ? 'rotate-90' : ''}`}>chevron_right</span>
                        <span className="font-bold uppercase text-slate-800 dark:text-white">{supplier.supplier_code || supplier.supplier_name}</span>
                        {supplier.supplier_code && <span className="text-[11px] text-slate-400 font-medium uppercase truncate max-w-[320px]" title={supplier.supplier_name}>{supplier.supplier_name}</span>}
                        <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded-full text-slate-500 font-bold">{groupKeys.length} nhóm</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-slate-500">{groupKeys.length > 1 ? `${groupKeys.length} nhóm` : groupKeys[0]}</td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-800 dark:text-white">{formatCurrency(supplier.totalPurchased)}</td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-emerald-600">{formatCurrency(supplier.totalPaid)}</td>
                    <td className={`py-3 px-3 text-right font-mono font-bold ${balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {formatCurrency(balance)}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2 justify-center">
                        <div className="w-16 h-2 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${paidPct >= 100 ? 'bg-emerald-500' : paidPct >= 50 ? 'bg-blue-500' : 'bg-amber-500'}`}
                            style={{ width: `${Math.min(paidPct, 100)}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-bold text-slate-500 w-10 text-right">{paidPct.toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <button
                        onClick={(e) => { e.stopPropagation(); onViewSupplier?.(supplier.supplier_id); }}
                        className="text-blue-500 hover:text-blue-700 transition-colors"
                        title="Xem chi tiết"
                      >
                        <span className="material-symbols-outlined text-[18px]">visibility</span>
                      </button>
                    </td>
                  </tr>

                  {/* Expanded: Group breakdown */}
                  {isExpanded && groupKeys.map((grp) => {
                    const g = supplier.groups[grp];
                    const gBalance = g.totalPurchased - g.totalPaid;
                    const gPct = g.totalPurchased > 0 ? (g.totalPaid / g.totalPurchased) * 100 : 0;
                    return (
                      <tr key={`${supplier.supplier_id}-${grp}`} className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700/50">
                        <td className="py-2 px-3 pl-12 text-slate-500 text-[13px]">
                          <span className="material-symbols-outlined text-[14px] mr-1 align-text-bottom text-slate-400">subdirectory_arrow_right</span>
                          {grp}
                        </td>
                        <td className="py-2 px-3 text-[13px] text-slate-400">{g.purchases.length} lần mua</td>
                        <td className="py-2 px-3 text-right font-mono text-[13px] text-slate-600 dark:text-slate-300">{formatCurrency(g.totalPurchased)}</td>
                        <td className="py-2 px-3 text-right font-mono text-[13px] text-emerald-600">{formatCurrency(g.totalPaid)}</td>
                        <td className={`py-2 px-3 text-right font-mono text-[13px] ${gBalance > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>{formatCurrency(gBalance)}</td>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2 justify-center">
                            <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${gPct >= 100 ? 'bg-emerald-500' : 'bg-blue-400'}`} style={{ width: `${Math.min(gPct, 100)}%` }} />
                            </div>
                            <span className="text-[10px] text-slate-400">{gPct.toFixed(0)}%</span>
                          </div>
                        </td>
                        <td></td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-300 dark:border-slate-500 bg-slate-50 dark:bg-slate-800/50">
              <td colSpan={2} className="py-3 px-3 font-black text-slate-700 dark:text-white uppercase text-[11px]">Tổng cộng ({grouped.length} NCC)</td>
              <td className="py-3 px-3 text-right font-mono font-black text-slate-800 dark:text-white">{formatCurrency(grouped.reduce((s, g) => s + g.totalPurchased, 0))}</td>
              <td className="py-3 px-3 text-right font-mono font-black text-emerald-600">{formatCurrency(grouped.reduce((s, g) => s + g.totalPaid, 0))}</td>
              <td className="py-3 px-3 text-right font-mono font-black text-rose-600">{formatCurrency(grouped.reduce((s, g) => s + (g.totalPurchased - g.totalPaid), 0))}</td>
              <td colSpan={2}></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
