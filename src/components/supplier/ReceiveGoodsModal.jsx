import React from 'react';
import { fmt } from '../../utils/formatters';

export default function ReceiveGoodsModal({ receivePO, receiveLines, setReceiveLines, submitting, onSubmit, onClose }) {
    if (!receivePO) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-200/50 flex flex-col max-h-[85vh]">
                <div className="px-8 py-5 bg-gradient-to-r from-emerald-50 to-green-50/30 border-b border-slate-100 flex justify-between items-start shrink-0">
                    <div>
                        <div className="flex items-center gap-2 text-slate-400 text-[10px] mb-1.5 uppercase tracking-widest font-bold">
                            <span>Nhận hàng</span>
                            <span className="material-symbols-outlined text-[12px]">chevron_right</span>
                            <span className="text-emerald-700">{receivePO.po_number}</span>
                        </div>
                        <h3 className="text-xl font-extrabold text-slate-800 tracking-tight">Ghi nhận hàng nhận từ NCC</h3>
                        <p className="text-xs text-slate-500 mt-1">Nhập số lượng thực tế nhận được cho mỗi dòng vật tư</p>
                    </div>
                    <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                        <span className="material-symbols-outlined notranslate text-[20px]" translate="no">close</span>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-8 py-6">
                    <div className="rounded-xl border border-slate-200 overflow-hidden">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                                <tr>
                                    <th className="px-4 py-3">Vật tư</th>
                                    <th className="px-4 py-3 text-center w-20">ĐVT</th>
                                    <th className="px-4 py-3 text-center w-24">Đã đặt</th>
                                    <th className="px-4 py-3 text-center w-24">Đã nhận</th>
                                    <th className="px-4 py-3 text-center w-24">Còn nợ</th>
                                    <th className="px-4 py-3 text-center w-28">Nhận lần này</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {receiveLines.map((line, idx) => {
                                    const remaining = Number(line.ordered_qty) - Number(line.received_qty);
                                    return (
                                        <tr key={line.id} className="hover:bg-emerald-50/30">
                                            <td className="px-4 py-3 font-semibold text-slate-800">{line.product_name}</td>
                                            <td className="px-4 py-3 text-center text-xs text-slate-500">{line.unit}</td>
                                            <td className="px-4 py-3 text-center font-bold">{fmt(line.ordered_qty)}</td>
                                            <td className="px-4 py-3 text-center text-emerald-600 font-bold">{fmt(line.received_qty)}</td>
                                            <td className="px-4 py-3 text-center text-amber-600 font-bold">{fmt(remaining)}</td>
                                            <td className="px-4 py-3">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max={remaining}
                                                    value={line.receiveQty}
                                                    onChange={(e) => {
                                                        const val = Math.min(Number(e.target.value), remaining);
                                                        setReceiveLines(prev => prev.map((l, i) => i === idx ? { ...l, receiveQty: val } : l));
                                                    }}
                                                    className="w-full bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-center font-bold text-emerald-700 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                                />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="px-8 py-4 border-t border-slate-200 bg-slate-50/60 flex justify-between items-center shrink-0">
                    <div className="text-xs text-slate-500">
                        Tổng nhận: <span className="font-bold text-emerald-700">{receiveLines.reduce((s, l) => s + Number(l.receiveQty || 0), 0)}</span> đơn vị
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-6 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Hủy</button>
                        <button
                            onClick={onSubmit}
                            disabled={submitting}
                            className={`px-8 py-2.5 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white text-sm font-bold rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-2 ${submitting ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}`}
                        >
                            <span className="material-symbols-outlined notranslate text-[18px]" translate="no">{submitting ? 'hourglass_top' : 'check_circle'}</span>
                            {submitting ? 'Đang xử lý...' : 'Xác nhận nhận hàng'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
