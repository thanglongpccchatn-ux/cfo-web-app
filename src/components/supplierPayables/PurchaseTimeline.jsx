import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { formatCurrency, projectLabel } from './payablesUtils';
import PurchaseModal from './PurchaseModal';

/* ── Remove Vietnamese diacritics for fuzzy search ── */
const removeDiacritics = (str) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');

/* ── Main Component ── */
export default function PurchaseTimeline({ purchases = [], payments = [], projects = [], suppliers = [], onRefresh }) {
  const [showModal, setShowModal] = useState(false);
  const [editData, setEditData] = useState(null);

  const timeline = useMemo(() => {
    const items = [
      ...purchases.map(p => ({ ...p, _type: 'purchase', _date: p.purchase_date, _amount: Number(p.total_amount || 0) })),
      ...payments.map(p => ({ ...p, _type: 'payment', _date: p.payment_date, _amount: Number(p.amount || 0) })),
    ];
    return items.sort((a, b) => new Date(b._date) - new Date(a._date));
  }, [purchases, payments]);

  // Khoá gom "1 đơn": cùng NCC + dự án + ngày + số hóa đơn
  const orderKey = (p) => `${p.supplier_id || ''}|${p.project_id || ''}|${p.purchase_date || ''}|${p.reference_no || ''}`;
  const handleEdit = (item) => {
    // Mở CẢ ĐƠN: gom mọi dòng mua cùng đơn để sửa/thêm/xoá rồi lưu 1 lần
    const orderLines = purchases.filter(p => orderKey(p) === orderKey(item));
    setEditData(orderLines.length ? orderLines : [item]);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Xóa bản ghi mua hàng này?')) return;
    await supabase.from('supplier_purchases').delete().eq('id', id);
    onRefresh?.();
  };

  const openNew = () => {
    setEditData(null);
    setShowModal(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-500">{timeline.length} bản ghi</p>
        <button onClick={openNew}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow-sm transition-colors">
          <span className="material-symbols-outlined text-[16px]">add</span>
          Thêm mua hàng
        </button>
      </div>

      {/* Modal */}
      <PurchaseModal
        open={showModal}
        onClose={() => { setShowModal(false); setEditData(null); }}
        editData={editData}
        projects={projects}
        suppliers={suppliers}
        onSaved={onRefresh}
      />

      {/* Timeline Table */}
      {timeline.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <span className="material-symbols-outlined text-5xl mb-3 block">receipt_long</span>
          <p>Chưa có bản ghi nào</p>
          <p className="text-[12px] mt-1">Bấm "Thêm mua hàng" hoặc "Import Excel" để bắt đầu</p>
        </div>
      ) : (
        <TimelineTable timeline={timeline} onEdit={handleEdit} onDelete={handleDelete} suppliers={suppliers} />
      )}
    </div>
  );
}

/* ── Timeline Table with pagination, search, totals ── */
function TimelineTable({ timeline, onEdit, onDelete, suppliers = [] }) {
  const PAGE_SIZE = 25;
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  // Mã NCC lấy từ danh mục `suppliers` (đã có mã) thay vì join partners (có thể rỗng).
  const supMap = useMemo(() => Object.fromEntries(suppliers.map(s => [s.id, s])), [suppliers]);
  const nccCode = (item) => supMap[item.supplier_id]?.code || item.partners?.code || item.partners?.name || '—';

  const filtered = useMemo(() => {
    if (!search) return timeline;
    const q = removeDiacritics(search.toLowerCase());
    return timeline.filter(item => {
      const texts = [item.partners?.code, item.partners?.name, item.product_name, item.material_group, item.notes, item.reference_no].filter(Boolean).join(' ');
      return removeDiacritics(texts.toLowerCase()).includes(q);
    });
  }, [timeline, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const totals = useMemo(() => {
    const purch = filtered.filter(i => i._type === 'purchase');
    const pay = filtered.filter(i => i._type === 'payment');
    return {
      purchaseCount: purch.length,
      purchaseTotal: purch.reduce((s, i) => s + Number(i.total_amount || 0), 0),
      paymentCount: pay.length,
      paymentTotal: pay.reduce((s, i) => s + Number(i.amount || 0), 0),
    };
  }, [filtered]);

  useEffect(() => { setPage(0); }, [search]);

  return (
    <div className="space-y-3">
      {/* Search + Stats */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-[320px]">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[16px] text-slate-400">search</span>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Tìm NCC, sản phẩm, ghi chú..."
            className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg pl-9 pr-3 py-2.5 md:py-2 bg-white dark:bg-slate-700 text-slate-800 dark:text-white" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <span className="material-symbols-outlined text-[14px]">close</span>
            </button>
          )}
        </div>
        <div className="flex items-center gap-4 text-[12px] text-slate-500">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            {totals.purchaseCount} mua · <span className="font-mono font-bold text-slate-700 dark:text-white">{formatCurrency(totals.purchaseTotal)}</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            {totals.paymentCount} TT · <span className="font-mono font-bold text-emerald-600">{formatCurrency(totals.paymentTotal)}</span>
          </span>
        </div>
      </div>

      {/* ── MOBILE: card list ── */}
      <div className="md:hidden space-y-2">
        {paged.map((item) => {
          const isPurchase = item._type === 'purchase';
          return (
            <div key={`${item._type}-${item.id}`}
              className={`rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2.5 ${isPurchase ? 'bg-white dark:bg-slate-800' : 'bg-emerald-50/40 dark:bg-emerald-900/10'}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${isPurchase ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'}`}>
                    <span className="material-symbols-outlined text-[11px]">{isPurchase ? 'shopping_cart' : 'paid'}</span>
                    {isPurchase ? 'Mua' : 'TT'}
                  </span>
                  <span className="font-bold uppercase text-slate-800 dark:text-white text-[12px] truncate" title={item.partners?.name || ''}>{nccCode(item)}</span>
                </div>
                <span className="text-[11px] text-slate-500 shrink-0">{new Date(item._date).toLocaleDateString('vi-VN')}</span>
              </div>
              <p className="text-[12px] text-slate-700 dark:text-slate-300 mt-1 break-words line-clamp-2">
                {isPurchase ? item.product_name : (item.notes || 'Thanh toán')}
              </p>
              <div className="flex items-end justify-between gap-2 mt-1">
                <div className="text-[11px] text-slate-400 min-w-0">
                  {isPurchase && <p className="font-mono">{formatCurrency(item.quantity)} {item.unit || ''} × {formatCurrency(item.unit_price)} · VAT {Number(item.vat_rate) || 0}%</p>}
                  <p className="truncate">{item.material_group ? `${item.material_group} · ` : ''}{projectLabel(item.projects) || '—'}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className={`font-mono font-bold text-[13px] ${isPurchase ? 'text-slate-800 dark:text-white' : 'text-emerald-600'}`}>
                    {isPurchase ? formatCurrency(item.total_amount) : formatCurrency(item.amount)}
                  </span>
                  {isPurchase && (
                    <>
                      <button onClick={() => onEdit(item)} className="w-11 h-11 -my-1 flex items-center justify-center text-slate-400 active:text-blue-600" title="Sửa">
                        <span className="material-symbols-outlined text-[18px]">edit</span>
                      </button>
                      <button onClick={() => onDelete(item.id)} className="w-11 h-11 -my-1 -mr-2 flex items-center justify-center text-slate-400 active:text-rose-600" title="Xóa">
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {/* Tổng mobile */}
        <div className="rounded-xl border-2 border-slate-300 dark:border-slate-500 bg-slate-50 dark:bg-slate-800/50 px-3 py-2.5 text-[11px]">
          <p className="font-black uppercase text-slate-700 dark:text-white mb-1">Tổng ({filtered.length} bản ghi)</p>
          <div className="flex flex-wrap justify-between gap-x-3 gap-y-0.5">
            <span>Mua: <span className="font-mono font-bold text-slate-800 dark:text-white">{formatCurrency(totals.purchaseTotal)}</span></span>
            <span>TT: <span className="font-mono font-bold text-emerald-600">{formatCurrency(totals.paymentTotal)}</span></span>
            <span>Còn nợ: <span className={`font-mono font-bold ${totals.purchaseTotal - totals.paymentTotal > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{formatCurrency(totals.purchaseTotal - totals.paymentTotal)}</span></span>
          </div>
        </div>
      </div>

      {/* ── DESKTOP: bảng đầy đủ ── */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-slate-200 dark:border-slate-600">
              <th className="text-left py-2.5 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Ngày</th>
              <th className="text-left py-2.5 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Loại</th>
              <th className="text-center py-2.5 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">NCC</th>
              <th className="text-left py-2.5 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Nhóm VT</th>
              <th className="text-left py-2.5 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Sản phẩm</th>
              <th className="text-right py-2.5 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">SL</th>
              <th className="text-right py-2.5 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Đơn giá</th>
              <th className="text-right py-2.5 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">VAT</th>
              <th className="text-right py-2.5 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Thành tiền</th>
              <th className="text-left py-2.5 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Công trình</th>
              <th className="w-20"></th>
            </tr>
          </thead>
          <tbody>
            {paged.map((item) => {
              const isPurchase = item._type === 'purchase';
              return (
                <tr key={`${item._type}-${item.id}`} className={`border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors ${!isPurchase ? 'bg-emerald-50/30 dark:bg-emerald-900/5' : ''}`}>
                  <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">{new Date(item._date).toLocaleDateString('vi-VN')}</td>
                  <td className="py-2.5 px-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${isPurchase ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'}`}>
                      <span className="material-symbols-outlined text-[12px]">{isPurchase ? 'shopping_cart' : 'paid'}</span>
                      {isPurchase ? 'Mua' : 'TT'}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center font-bold uppercase text-slate-800 dark:text-white whitespace-nowrap" title={item.partners?.name || ''}>{nccCode(item)}</td>
                  <td className="py-2.5 px-3 text-slate-500">{item.material_group || '—'}</td>
                  <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 max-w-[200px] truncate">{isPurchase ? item.product_name : (item.notes || 'Thanh toán')}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-600">{isPurchase ? `${formatCurrency(item.quantity)} ${item.unit || ''}` : '—'}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-600">{isPurchase ? formatCurrency(item.unit_price) : '—'}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-500 text-[12px]">{isPurchase ? `${Number(item.vat_rate) || 0}%` : '—'}</td>
                  <td className={`py-2.5 px-3 text-right font-mono font-bold ${isPurchase ? 'text-slate-800 dark:text-white' : 'text-emerald-600'}`}>
                    {isPurchase ? formatCurrency(item.total_amount) : formatCurrency(item.amount)}
                  </td>
                  <td className="py-2.5 px-3 text-slate-500 text-[12px] max-w-[120px] truncate">{projectLabel(item.projects) || '—'}</td>
                  <td className="py-2.5 px-3">
                    {isPurchase && (
                      <div className="flex items-center gap-1">
                        <button onClick={() => onEdit(item)} className="text-slate-400 hover:text-blue-600 transition-colors" title="Sửa">
                          <span className="material-symbols-outlined text-[16px]">edit</span>
                        </button>
                        <button onClick={() => onDelete(item.id)} className="text-slate-400 hover:text-rose-600 transition-colors" title="Xóa">
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-300 dark:border-slate-500 bg-slate-50 dark:bg-slate-800/50">
              <td colSpan={8} className="py-3 px-3 font-black text-slate-700 dark:text-white text-[11px] uppercase">
                Tổng ({filtered.length} bản ghi) · TT: <span className="font-mono text-emerald-600">{formatCurrency(totals.paymentTotal)}</span>
              </td>
              <td className="py-3 px-3 text-right font-mono font-bold text-slate-800 dark:text-white">{formatCurrency(totals.purchaseTotal)}</td>
              <td colSpan={2} className="py-3 px-3 text-right text-[11px]">
                Còn nợ: <span className={`font-mono font-bold ${totals.purchaseTotal - totals.paymentTotal > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {formatCurrency(totals.purchaseTotal - totals.paymentTotal)}
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Pagination — mobile: chỉ Trước/Sau + "Trang X/Y" (bộ 7 nút sẽ tràn ở 320px) */}
      {totalPages > 1 && (
        <div className="flex md:hidden items-center justify-between gap-2 pt-2">
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
            className="min-h-[44px] flex-1 flex items-center justify-center gap-1 rounded-lg border border-slate-200 dark:border-slate-600 text-sm font-bold text-slate-600 dark:text-slate-300 disabled:opacity-30">
            <span className="material-symbols-outlined text-[18px]">chevron_left</span>Trước
          </button>
          <span className="text-[12px] font-bold text-slate-500 whitespace-nowrap px-1">Trang {page + 1} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
            className="min-h-[44px] flex-1 flex items-center justify-center gap-1 rounded-lg border border-slate-200 dark:border-slate-600 text-sm font-bold text-slate-600 dark:text-slate-300 disabled:opacity-30">
            Sau<span className="material-symbols-outlined text-[18px]">chevron_right</span>
          </button>
        </div>
      )}
      {totalPages > 1 && (
        <div className="hidden md:flex items-center justify-between pt-2">
          <span className="text-[12px] text-slate-500">Trang {page + 1}/{totalPages} · {paged.length}/{filtered.length} bản ghi</span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(0)} disabled={page === 0} className="px-2 py-1 text-[12px] rounded hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30"><span className="material-symbols-outlined text-[14px]">first_page</span></button>
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="px-2 py-1 text-[12px] rounded hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30"><span className="material-symbols-outlined text-[14px]">chevron_left</span></button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const start = Math.max(0, Math.min(page - 2, totalPages - 5));
              const p = start + i;
              if (p >= totalPages) return null;
              return <button key={p} onClick={() => setPage(p)} className={`px-2.5 py-1 text-[12px] rounded font-bold ${p === page ? 'bg-blue-600 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600'}`}>{p + 1}</button>;
            })}
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="px-2 py-1 text-[12px] rounded hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30"><span className="material-symbols-outlined text-[14px]">chevron_right</span></button>
            <button onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1} className="px-2 py-1 text-[12px] rounded hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30"><span className="material-symbols-outlined text-[14px]">last_page</span></button>
          </div>
        </div>
      )}
    </div>
  );
}
