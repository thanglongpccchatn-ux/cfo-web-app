import React, { useState, useMemo } from 'react';
import { formatCurrency, projectLabel, groupByOrder, orderKeyOf } from './payablesUtils';
import PurchaseModal from './PurchaseModal';

/* Tab "Đơn mua hàng": gom các dòng chi tiết thành TỪNG ĐƠN (cùng NCC + dự án + ngày + số hóa đơn).
   Desktop: bảng đầy đủ. Mobile (<md): danh sách thẻ gọn, bấm để xem dòng chi tiết. */
export default function PurchaseOrders({ purchases = [], payments = [], projects = [], suppliers = [], onRefresh }) {
  const [showModal, setShowModal] = useState(false);
  const [editData, setEditData] = useState(null);
  const [expanded, setExpanded] = useState(null);   // order key đang mở dòng chi tiết
  const [q, setQ] = useState('');

  const orders = useMemo(() => groupByOrder(purchases, payments), [purchases, payments]);
  const linesByKey = useMemo(() => {
    const m = {};
    for (const p of purchases) (m[orderKeyOf(p)] || (m[orderKeyOf(p)] = [])).push(p);
    return m;
  }, [purchases]);

  const norm = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').toLowerCase();
  const filtered = useMemo(() => {
    const kw = norm(q.trim());
    if (!kw) return orders;
    return orders.filter(o => norm(`${o.reference_no} ${o.supplier_name} ${projectLabel(o.projects)}`).includes(kw));
  }, [orders, q]);

  const totals = useMemo(() => filtered.reduce((a, o) => {
    a.total += o.total; a.paid += o.paid; a.remaining += o.remaining; return a;
  }, { total: 0, paid: 0, remaining: 0 }), [filtered]);

  const openEdit = (o) => { setEditData(linesByKey[o.key] || []); setShowModal(true); };
  const openNew = () => { setEditData(null); setShowModal(true); };

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('vi-VN') : '';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <p className="text-sm text-slate-500 shrink-0">{filtered.length} đơn</p>
          <div className="relative flex-1 sm:flex-initial min-w-0">
            <span className="material-symbols-outlined text-[16px] text-slate-400 absolute left-2 top-1/2 -translate-y-1/2">search</span>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Tìm số HĐ, NCC, dự án..."
              className="text-sm border border-slate-200 dark:border-slate-600 rounded-lg pl-7 pr-3 py-1.5 bg-white dark:bg-slate-700 w-full sm:w-[240px]" />
          </div>
        </div>
        <button onClick={openNew} className="flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow-sm w-full sm:w-auto">
          <span className="material-symbols-outlined text-[16px]">add</span>Thêm mua hàng
        </button>
      </div>

      {/* ── MOBILE: danh sách thẻ ── */}
      <div className="md:hidden space-y-3">
        {filtered.length === 0 ? (
          <p className="py-10 text-center text-slate-400 text-sm">Chưa có đơn mua hàng nào.</p>
        ) : filtered.map(o => {
          const isOpen = expanded === o.key;
          const lines = linesByKey[o.key] || [];
          return (
            <div key={o.key} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
              <button onClick={() => setExpanded(isOpen ? null : o.key)} className="w-full text-left px-3 py-2.5 active:bg-slate-50 dark:active:bg-slate-700/30">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-bold text-[13px] text-slate-800 dark:text-white truncate">{o.reference_no || '—'}</span>
                  <span className="text-[11px] text-slate-500 shrink-0">{fmtDate(o.purchase_date)}</span>
                </div>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <span className="text-[12px] font-bold uppercase text-slate-700 dark:text-slate-200 truncate">{o.supplier_code || o.supplier_name}</span>
                  <span className="text-[11px] text-slate-400 shrink-0">{o.lineCount} dòng</span>
                </div>
                {projectLabel(o.projects) && <p className="text-[11px] text-slate-400 truncate mt-0.5">{projectLabel(o.projects)}</p>}
                <div className="grid grid-cols-3 gap-1 mt-2 text-[11px]">
                  <div>
                    <p className="text-slate-400">Tổng tiền</p>
                    <p className="font-mono font-bold text-slate-800 dark:text-white">{formatCurrency(o.total)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Đã trả</p>
                    <p className="font-mono text-emerald-600">{formatCurrency(o.paid)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-slate-400">Còn nợ</p>
                    <p className={`font-mono font-bold ${o.remaining > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{formatCurrency(o.remaining)}</p>
                  </div>
                </div>
              </button>
              {isOpen && (
                <div className="border-t border-slate-100 dark:border-slate-700/50 bg-slate-50/60 dark:bg-slate-900/20 px-3 py-2">
                  <div className="divide-y divide-slate-100 dark:divide-slate-700/30">
                    {lines.map(l => (
                      <div key={l.id} className="py-1.5 text-[12px]">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-slate-700 dark:text-slate-200 flex-1">{l.product_name}</span>
                          <span className="font-mono font-semibold shrink-0">{l.total_amount == null ? '—' : formatCurrency(l.total_amount)}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 font-mono">
                          {formatCurrency(l.quantity)} {l.unit}
                          {l.unit_price != null && <> × {formatCurrency(l.unit_price)}</>}
                          {l.vat_rate != null && <> · VAT {Number(l.vat_rate) || 0}%</>}
                        </p>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => openEdit(o)} className="mt-2 w-full flex items-center justify-center gap-1.5 py-2 text-[12px] font-bold text-blue-600 border border-blue-200 dark:border-blue-800 rounded-lg active:bg-blue-50 dark:active:bg-blue-900/20">
                    <span className="material-symbols-outlined text-[15px]">edit</span>Sửa đơn
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {filtered.length > 0 && (
          <div className="rounded-xl border-2 border-slate-300 dark:border-slate-500 bg-slate-50 dark:bg-slate-800/50 px-3 py-2.5">
            <p className="text-[11px] font-black uppercase text-slate-700 dark:text-white mb-1.5">Tổng {filtered.length} đơn</p>
            <div className="grid grid-cols-3 gap-1 text-[11px]">
              <div>
                <p className="text-slate-400">Tổng tiền</p>
                <p className="font-mono font-bold text-slate-800 dark:text-white">{formatCurrency(totals.total)}</p>
              </div>
              <div>
                <p className="text-slate-400">Đã trả</p>
                <p className="font-mono font-bold text-emerald-600">{formatCurrency(totals.paid)}</p>
              </div>
              <div className="text-right">
                <p className="text-slate-400">Còn nợ</p>
                <p className="font-mono font-bold text-rose-600">{formatCurrency(totals.remaining)}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── DESKTOP: bảng đầy đủ ── */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-slate-200 dark:border-slate-600 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <th className="w-8 py-2.5 px-2"></th>
              <th className="text-left py-2.5 px-3">Ngày</th>
              <th className="text-left py-2.5 px-3">Số hóa đơn</th>
              <th className="text-left py-2.5 px-3">Dự án</th>
              <th className="text-left py-2.5 px-3">Nhà cung cấp</th>
              <th className="text-center py-2.5 px-3">Số dòng</th>
              <th className="text-right py-2.5 px-3">Tổng tiền</th>
              <th className="text-right py-2.5 px-3">Đã trả</th>
              <th className="text-right py-2.5 px-3">Còn nợ</th>
              <th className="w-20 py-2.5 px-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={10} className="py-10 text-center text-slate-400">Chưa có đơn mua hàng nào.</td></tr>
            ) : filtered.map(o => {
              const isOpen = expanded === o.key;
              const lines = linesByKey[o.key] || [];
              return (
                <React.Fragment key={o.key}>
                  <tr className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/20">
                    <td className="py-2.5 px-2 text-center">
                      <button onClick={() => setExpanded(isOpen ? null : o.key)} className="text-slate-400 hover:text-blue-600">
                        <span className="material-symbols-outlined text-[18px]">{isOpen ? 'expand_less' : 'expand_more'}</span>
                      </button>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">{fmtDate(o.purchase_date)}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-800 dark:text-white">{o.reference_no || '—'}</td>
                    <td className="py-2.5 px-3 text-slate-500 text-[12px] max-w-[140px] truncate">{projectLabel(o.projects) || '—'}</td>
                    <td className="py-2.5 px-3 font-bold uppercase text-slate-800 dark:text-white whitespace-nowrap">{o.supplier_code || o.supplier_name}</td>
                    <td className="py-2.5 px-3 text-center text-slate-500">{o.lineCount}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800 dark:text-white">{formatCurrency(o.total)}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-emerald-600">{formatCurrency(o.paid)}</td>
                    <td className={`py-2.5 px-3 text-right font-mono font-bold ${o.remaining > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{formatCurrency(o.remaining)}</td>
                    <td className="py-2.5 px-3 text-center">
                      <button onClick={() => openEdit(o)} className="text-slate-400 hover:text-blue-600" title="Sửa đơn">
                        <span className="material-symbols-outlined text-[16px]">edit</span>
                      </button>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="bg-slate-50/60 dark:bg-slate-900/20">
                      <td></td>
                      <td colSpan={9} className="py-2 px-3">
                        <table className="w-full text-[12px]">
                          <thead><tr className="text-[10px] font-bold uppercase text-slate-400 border-b border-slate-200 dark:border-slate-700">
                            <th className="text-left py-1">Sản phẩm</th><th className="text-left py-1">Nhóm</th>
                            <th className="text-center py-1">ĐVT</th><th className="text-right py-1">SL</th>
                            <th className="text-right py-1">Đơn giá</th><th className="text-right py-1">VAT</th><th className="text-right py-1">Thành tiền</th>
                          </tr></thead>
                          <tbody>
                            {lines.map(l => (
                              <tr key={l.id} className="border-b border-slate-100 dark:border-slate-700/30">
                                <td className="py-1 text-slate-700 dark:text-slate-200">{l.product_name}</td>
                                <td className="py-1 text-slate-500">{l.material_group || '—'}</td>
                                <td className="py-1 text-center text-slate-500">{l.unit}</td>
                                <td className="py-1 text-right font-mono">{formatCurrency(l.quantity)}</td>
                                <td className="py-1 text-right font-mono text-slate-500">{l.unit_price == null ? '—' : formatCurrency(l.unit_price)}</td>
                                <td className="py-1 text-right font-mono text-slate-400">{l.vat_rate == null ? '—' : `${Number(l.vat_rate) || 0}%`}</td>
                                <td className="py-1 text-right font-mono font-semibold">{l.total_amount == null ? '—' : formatCurrency(l.total_amount)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
          {filtered.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-300 dark:border-slate-500 bg-slate-50 dark:bg-slate-800/50 text-[12px]">
                <td colSpan={6} className="py-3 px-3 font-black uppercase text-slate-700 dark:text-white">Tổng {filtered.length} đơn</td>
                <td className="py-3 px-3 text-right font-mono font-bold text-slate-800 dark:text-white">{formatCurrency(totals.total)}</td>
                <td className="py-3 px-3 text-right font-mono font-bold text-emerald-600">{formatCurrency(totals.paid)}</td>
                <td className="py-3 px-3 text-right font-mono font-bold text-rose-600">{formatCurrency(totals.remaining)}</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {showModal && (
        <PurchaseModal open={showModal} onClose={() => setShowModal(false)}
          editData={editData} projects={projects} suppliers={suppliers}
          onSaved={() => { setShowModal(false); onRefresh?.(); }} />
      )}
    </div>
  );
}
