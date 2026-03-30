import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useInventory } from '../../context/InventoryContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { logAudit } from '../../lib/auditLog';
import { useNotification } from '../../context/NotificationContext';
import { fmt } from '../../utils/formatters';

export default function PurchaseOrderCreate({ requestId, onBack }) {
    const { partners, materials, refreshData } = useInventory();
    const { user } = useAuth();
    const { success, error: toastError } = useToast();
    const { sendNotification } = useNotification();
    const [loading, setLoading] = useState(false);
    const [request, setRequest] = useState(null);
    const [projects, setProjects] = useState([]);

    const genCode = () => {
        const d = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        return `PO-${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${String(Date.now()).slice(-3)}`;
    };

    const [header, setHeader] = useState({
        code: genCode(),
        supplier_id: '',
        project_id: '',
        expected_delivery: '',
        notes: '',
    });

    const [items, setItems] = useState([
        { material_id: '', material_name: '', quantity_ordered: 0, unit_price: 0, unit: '', request_item_id: null }
    ]);

    // Load request data if creating from approved request
    useEffect(() => {
        const load = async () => {
            const { data: pData } = await supabase.from('projects').select('id, name, code, internal_code').order('name');
            setProjects(pData || []);

            if (requestId) {
                const { data } = await supabase
                    .from('inventory_requests')
                    .select('*, inventory_request_items(*, materials(name, unit, actual_price, base_price))')
                    .eq('id', requestId)
                    .single();
                if (data) {
                    setRequest(data);
                    setHeader(h => ({ ...h, project_id: data.project_id || '' }));
                    const reqItems = (data.inventory_request_items || []).map(ri => ({
                        material_id: ri.material_id || '',
                        material_name: ri.materials?.name || ri.product_name || ri.material_name_manual || '',
                        quantity_ordered: Number(ri.quantity) || 0,
                        unit_price: Number(ri.materials?.actual_price || ri.materials?.base_price || 0),
                        unit: ri.unit || ri.uom || ri.materials?.unit || '',
                        request_item_id: ri.id,
                    }));
                    if (reqItems.length > 0) setItems(reqItems);
                }
            }
        };
        load();
    }, [requestId]);

    const suppliers = partners.filter(p => p.type === 'Supplier');

    const handleItemChange = (index, field, value) => {
        const newItems = [...items];
        newItems[index][field] = value;
        if (field === 'material_id') {
            const mat = materials.find(m => m.id === value);
            if (mat) {
                newItems[index].material_name = mat.name;
                newItems[index].unit = mat.unit || '';
                newItems[index].unit_price = Number(mat.actual_price || mat.base_price || 0);
            }
        }
        setItems(newItems);
    };

    const addItem = () => setItems([...items, { material_id: '', material_name: '', quantity_ordered: 0, unit_price: 0, unit: '', request_item_id: null }]);
    const removeItem = (i) => items.length > 1 && setItems(items.filter((_, idx) => idx !== i));

    const totalAmount = items.reduce((s, i) => s + (Number(i.quantity_ordered) * Number(i.unit_price)), 0);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!header.supplier_id) { toastError('Vui lòng chọn nhà cung cấp'); return; }
        if (items.some(i => !i.material_name || !i.quantity_ordered)) { toastError('Vui lòng nhập đầy đủ vật tư và số lượng'); return; }

        setLoading(true);
        try {
            const po = {
                code: header.code,
                request_id: requestId || null,
                supplier_id: header.supplier_id,
                project_id: header.project_id || null,
                expected_delivery: header.expected_delivery || null,
                status: 'ORDERED',
                payment_status: 'UNPAID',
                total_amount: totalAmount,
                notes: header.notes,
                created_by: user?.id,
            };

            const { data: poData, error: poErr } = await supabase.from('purchase_orders').insert([po]).select().single();
            if (poErr) throw poErr;

            const poItems = items.map(i => ({
                po_id: poData.id,
                material_id: i.material_id || null,
                request_item_id: i.request_item_id || null,
                material_name: i.material_name,
                quantity_ordered: i.quantity_ordered,
                unit_price: i.unit_price,
                unit: i.unit,
            }));

            const { error: itemErr } = await supabase.from('purchase_order_items').insert(poItems);
            if (itemErr) throw itemErr;

            logAudit({ action: 'CREATE', tableName: 'purchase_orders', recordId: poData.id, recordName: poData.code, metadata: { supplier_id: header.supplier_id, total: totalAmount } });
            sendNotification('receive_goods', 'Đơn đặt hàng mới', `PO ${poData.code} đã được tạo, trị giá ${fmt(totalAmount)}đ. Kho chuẩn bị nhận hàng.`, 'INFO', '#inventory');

            success('Tạo đơn đặt hàng thành công!');
            await refreshData();
            onBack();
        } catch (err) {
            toastError('Lỗi tạo PO: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white rounded-[32px] shadow-xl border border-slate-200 overflow-hidden animate-slide-up">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-blue-50/30">
                <div>
                    <h3 className="text-xl font-black text-slate-800 flex items-center gap-3">
                        <span className="material-symbols-outlined text-blue-500">shopping_cart</span>
                        Tạo đơn đặt hàng (PO)
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">
                        {request ? `Từ đề nghị ${request.code}` : 'Tạo đơn đặt hàng mới'}
                    </p>
                </div>
                <button onClick={onBack} className="w-10 h-10 rounded-full hover:bg-slate-200 flex items-center justify-center transition-colors">
                    <span className="material-symbols-outlined text-slate-500">close</span>
                </button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-6">
                {/* Header */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Mã PO</label>
                        <input type="text" readOnly value={header.code} className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-sm font-mono" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nhà cung cấp *</label>
                        <select value={header.supplier_id} onChange={e => setHeader({...header, supplier_id: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-blue-500">
                            <option value="">-- Chọn NCC --</option>
                            {suppliers.map(s => <option key={s.id} value={s.id}>{s.code ? `${s.code} - ` : ''}{s.name}</option>)}
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Dự án</label>
                        <select value={header.project_id} onChange={e => setHeader({...header, project_id: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-blue-500">
                            <option value="">-- Tất cả --</option>
                            {projects.map(p => <option key={p.id} value={p.id}>{p.internal_code || p.code} - {p.name}</option>)}
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ngày giao dự kiến</label>
                        <input type="date" value={header.expected_delivery} onChange={e => setHeader({...header, expected_delivery: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-blue-500" />
                    </div>
                </div>

                {/* Items */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h4 className="text-sm font-black text-slate-700 uppercase tracking-tight">Danh sách vật tư</h4>
                        <button type="button" onClick={addItem} className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700">
                            <span className="material-symbols-outlined text-sm">add_circle</span>Thêm dòng
                        </button>
                    </div>
                    <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-inner">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                <tr>
                                    <th className="px-3 py-2.5 w-[35%]">Vật tư</th>
                                    <th className="px-3 py-2.5 text-center">SL đặt</th>
                                    <th className="px-3 py-2.5">ĐVT</th>
                                    <th className="px-3 py-2.5 text-right">Đơn giá</th>
                                    <th className="px-3 py-2.5 text-right">Thành tiền</th>
                                    <th className="px-3 py-2.5 w-10"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {items.map((item, idx) => (
                                    <tr key={idx} className="group hover:bg-slate-50/50">
                                        <td className="px-3 py-2">
                                            {item.request_item_id ? (
                                                <span className="text-sm font-bold text-slate-700">{item.material_name}</span>
                                            ) : (
                                                <select value={item.material_id} onChange={e => handleItemChange(idx, 'material_id', e.target.value)} className="w-full bg-transparent border-none text-sm focus:ring-1 focus:ring-blue-500 rounded-lg py-1">
                                                    <option value="">Chọn vật tư...</option>
                                                    {materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                                </select>
                                            )}
                                        </td>
                                        <td className="px-3 py-2">
                                            <input type="number" min="0" step="0.01" value={item.quantity_ordered} onChange={e => handleItemChange(idx, 'quantity_ordered', parseFloat(e.target.value) || 0)} className="w-20 bg-slate-50 border-none rounded-lg text-sm text-center font-bold py-1 focus:ring-1 focus:ring-blue-500" />
                                        </td>
                                        <td className="px-3 py-2 text-xs text-slate-500">{item.unit || '-'}</td>
                                        <td className="px-3 py-2">
                                            <input type="number" min="0" value={item.unit_price} onChange={e => handleItemChange(idx, 'unit_price', parseFloat(e.target.value) || 0)} className="w-28 bg-slate-50 border-none rounded-lg text-sm text-right font-bold py-1 focus:ring-1 focus:ring-blue-500 tabular-nums" />
                                        </td>
                                        <td className="px-3 py-2 text-right font-bold text-sm tabular-nums text-slate-700">{fmt(item.quantity_ordered * item.unit_price)}</td>
                                        <td className="px-3 py-2">
                                            {!item.request_item_id && (
                                                <button type="button" onClick={() => removeItem(idx)} className="material-symbols-outlined text-slate-300 hover:text-red-500 transition-colors text-[18px]">delete</button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                                <tr>
                                    <td colSpan="4" className="px-3 py-3 text-right text-sm font-black uppercase tracking-wider text-slate-500">Tổng cộng:</td>
                                    <td className="px-3 py-3 text-right text-base font-black text-blue-700 tabular-nums">{fmt(totalAmount)}đ</td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                {/* Notes */}
                <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ghi chú</label>
                    <textarea value={header.notes} onChange={e => setHeader({...header, notes: e.target.value})} placeholder="Ghi chú cho đơn đặt hàng..." className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 min-h-[80px]" />
                </div>

                {/* Actions */}
                <div className="pt-6 border-t border-slate-100 flex justify-end gap-4">
                    <button type="button" onClick={onBack} className="px-8 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-2xl text-sm transition-all">Hủy bỏ</button>
                    <button type="submit" disabled={loading} className="px-12 py-3 bg-blue-500 hover:bg-blue-600 text-white font-black rounded-2xl text-sm shadow-xl shadow-blue-500/20 transition-all flex items-center gap-2 disabled:opacity-50">
                        {loading ? 'Đang tạo...' : <><span className="material-symbols-outlined text-[20px]">send</span>Tạo đơn đặt hàng</>}
                    </button>
                </div>
            </form>
        </div>
    );
}
