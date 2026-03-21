import React, { useState } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { useToast } from '../../context/ToastContext';
import SearchableSelect from '../common/SearchableSelect';
import { exportReceiptToPDF } from './InventoryExportUtils';

export default function InventoryInbound({ onBack }) {
    const { warehouses, materials, partners, purchaseOrders, createTransaction } = useInventory();
    const { success, error } = useToast();
    const [loading, setLoading] = useState(false);
    
    const [header, setHeader] = useState({
        warehouse_id: '',
        partner_id: '',
        number: `NK-${Date.now().toString().slice(-6)}`,
        date: new Date().toISOString().split('T')[0],
        notes: '',
        po_id: '',
        attachment_url: ''
    });

    const [items, setItems] = useState([
        { material_id: '', quantity: 1, uom: '', price: 0, notes: '' }
    ]);

    const suppliers = partners.filter(p => p.role === 'Nhà cung cấp' || p.role === 'Supplier');

    // Filter POs based on selected supplier if any
    const availablePOs = purchaseOrders.map(po => ({
        id: po.id,
        name: `${po.po_number} - ${po.purchase_order_lines?.length || 0} mục - ${new Date(po.order_date).toLocaleDateString('vi-VN')}`,
        supplier_id: po.supplier_id,
        lines: po.purchase_order_lines
    }));

    const handlePOSelect = (poId) => {
        const po = purchaseOrders.find(p => p.id === poId);
        if (!po) return;

        setHeader(prev => ({ 
            ...prev, 
            po_id: poId,
            partner_id: po.supplier_id,
            notes: `Nhập kho từ đơn hàng ${po.po_number}. ${prev.notes}`
        }));

        // Fill items from PO lines that have remaining quantity
        const poItems = (po.purchase_order_lines || [])
            .filter(l => (l.ordered_qty - l.received_qty) > 0)
            .map(l => ({
                material_id: l.material_id, // Note: This assumes material_id in PO lines matches materials table
                quantity: l.ordered_qty - l.received_qty,
                uom: l.unit || '',
                price: l.unit_price || 0,
                notes: `Từ PO ${po.po_number}`
            }));

        if (poItems.length > 0) {
            setItems(poItems);
        } else {
            success("Đơn hàng này đã được nhận đủ!");
        }
    };

    const handleAddItem = () => {
        setItems([...items, { material_id: '', quantity: 1, uom: '', price: 0, notes: '' }]);
    };

    const handleRemoveItem = (index) => {
        if (items.length > 1) {
            setItems(items.filter((_, i) => i !== index));
        }
    };

    const handleItemChange = (index, field, value) => {
        const newItems = [...items];
        newItems[index][field] = value;
        
        // Auto-fill UOM if material is selected
        if (field === 'material_id') {
            const mat = materials.find(m => m.id === value);
            if (mat) newItems[index].uom = mat.uom;
        }
        
        setItems(newItems);
    };

    const handleSubmit = async (e, targetStatus) => {
        e.preventDefault();
        if (!header.warehouse_id || !header.partner_id || items.some(i => !i.material_id)) {
            error("Vui lòng điền đầy đủ thông tin bắt buộc!");
            return;
        }

        setLoading(true);
        try {
            const receipt = {
                warehouse_id: header.warehouse_id,
                partner_id: header.partner_id,
                number: header.number,
                type: 'IN',
                notes: header.notes,
                status: targetStatus,
                po_id: header.po_id || null,
                attachment_url: header.attachment_url || null
            };

            await createTransaction(receipt, items);
            success(targetStatus === 'DRAFT' ? "Đã lưu nháp phiếu nhập kho!" : "Đã xác nhận phiếu nhập kho thành công!");
            
            if (targetStatus === 'CONFIRMED') {
                try {
                    exportReceiptToPDF(receipt, items, materials, partners, warehouses);
                } catch(e) { console.error("PDF Export Error:", e) }
            }
            
            if (onBack) onBack();
        } catch (err) {
            console.error("Lỗi nhập kho:", err);
            error("Có lỗi xảy ra khi xử lý phiếu!");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-[32px] shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-slide-up">
            <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
                <div>
                    <h3 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-3">
                        <span className="material-symbols-outlined notranslate text-emerald-500" translate="no">login</span>
                        Lập phiếu Nhập kho
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">Nhập vật tư từ nhà cung cấp vào kho dự án</p>
                </div>
                <button 
                    onClick={onBack}
                    className="w-10 h-10 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center transition-colors"
                >
                    <span className="material-symbols-outlined notranslate text-slate-500" translate="no">close</span>
                </button>
            </div>

            <form className="p-8 space-y-8">
                {/* PO Selection & Header Info */}
                <div className="bg-blue-50/50 dark:bg-blue-500/5 p-6 rounded-3xl border border-blue-100 dark:border-blue-500/10 mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-blue-500 ml-1 flex items-center gap-2">
                                <span className="material-symbols-outlined text-[14px]">shopping_cart</span>
                                Chọn từ Đơn hàng (PO)
                            </label>
                            <SearchableSelect 
                                placeholder="-- Chọn đơn hàng để tự động điền --"
                                options={availablePOs}
                                value={header.po_id}
                                onChange={handlePOSelect}
                                className="!bg-white dark:!bg-slate-900 border-blue-200 dark:border-blue-500/20 shadow-sm"
                            />
                        </div>
                        <p className="text-[11px] text-slate-500 italic pb-3">
                            * Khi chọn PO, hệ thống sẽ tự động lấy thông tin NCC và danh sách vật tư chưa giao đủ.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Kho nhận *</label>
                        <SearchableSelect 
                            placeholder="-- Chọn kho nhận --"
                            options={warehouses}
                            value={header.warehouse_id}
                            onChange={(val) => setHeader({ ...header, warehouse_id: val })}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Nhà cung cấp *</label>
                        <SearchableSelect 
                            placeholder="-- Chọn nhà cung cấp --"
                            options={suppliers}
                            value={header.partner_id}
                            onChange={(val) => setHeader({ ...header, partner_id: val })}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Số phiếu</label>
                        <input 
                            type="text"
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl text-sm focus:ring-2 focus:ring-emerald-500 font-mono"
                            value={header.number}
                            onChange={(e) => setHeader({ ...header, number: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Ngày nhập</label>
                        <input 
                            type="date"
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl text-sm focus:ring-2 focus:ring-emerald-500"
                            value={header.date}
                            onChange={(e) => setHeader({ ...header, date: e.target.value })}
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Đường dẫn đính kèm (Hình ảnh/PDF)</label>
                    <div className="flex bg-slate-50 dark:bg-slate-900 rounded-2xl overflow-hidden focus-within:ring-2 focus-within:ring-emerald-500">
                        <span className="material-symbols-outlined notranslate flex items-center justify-center px-4 text-slate-400" translate="no">link</span>
                        <input 
                            type="url"
                            className="w-full px-4 py-3 bg-transparent border-none text-sm focus:ring-0"
                            placeholder="https://drive.google.com/..."
                            value={header.attachment_url}
                            onChange={(e) => setHeader({ ...header, attachment_url: e.target.value })}
                        />
                    </div>
                </div>

                {/* Items Table */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h4 className="text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-tight">Chi tiết vật tư</h4>
                        <button 
                            type="button"
                            onClick={handleAddItem}
                            className="flex items-center gap-2 text-xs font-bold text-emerald-600 hover:text-emerald-700"
                        >
                            <span className="material-symbols-outlined notranslate text-sm" translate="no">add_circle</span>
                            Thêm dòng
                        </button>
                    </div>

                    <div className="border border-slate-100 dark:border-slate-700 rounded-2xl overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50 dark:bg-slate-900/50 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                <tr>
                                    <th className="px-4 py-3 w-[40%]">Vật tư *</th>
                                    <th className="px-4 py-3 text-center">ĐVT</th>
                                    <th className="px-4 py-3 text-center w-[15%]">Số lượng</th>
                                    <th className="px-4 py-3 text-right w-[20%]">Đơn giá</th>
                                    <th className="px-4 py-3 w-[5%]"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                {items.map((item, index) => (
                                    <tr key={index} className="group hover:bg-slate-50/50 transition-colors">
                                        <td className="px-4 py-3">
                                            <SearchableSelect 
                                                placeholder="Tìm vật tư..."
                                                options={materials}
                                                value={item.material_id}
                                                onChange={(val) => handleItemChange(index, 'material_id', val)}
                                                className="!bg-transparent"
                                            />
                                        </td>
                                        <td className="px-4 py-3 text-center italic text-xs text-slate-500">
                                            {item.uom || '-'}
                                        </td>
                                        <td className="px-4 py-3">
                                            <input 
                                                type="number"
                                                min="0.01"
                                                step="0.01"
                                                className="w-full bg-slate-50 dark:bg-slate-900 rounded-lg border-none text-sm text-center font-bold py-1 px-2 focus:ring-1 focus:ring-emerald-500"
                                                value={item.quantity}
                                                onChange={(e) => handleItemChange(index, 'quantity', parseFloat(e.target.value))}
                                            />
                                        </td>
                                        <td className="px-4 py-3">
                                            <input 
                                                type="number"
                                                min="0"
                                                className="w-full bg-slate-50 dark:bg-slate-900 rounded-lg border-none text-sm text-right font-mono py-1 px-2 focus:ring-1 focus:ring-emerald-500"
                                                value={item.price}
                                                onChange={(e) => handleItemChange(index, 'price', parseInt(e.target.value))}
                                            />
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <button 
                                                type="button"
                                                onClick={() => handleRemoveItem(index)}
                                                className="material-symbols-outlined notranslate text-slate-300 hover:text-red-500 transition-colors"
                                                translate="no"
                                            >
                                                delete
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Notes */}
                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Ghi chú phiếu nhập</label>
                    <textarea 
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl text-sm focus:ring-2 focus:ring-emerald-500 min-h-[100px]"
                        placeholder="Nhập ghi chú hoặc lý do nhập kho..."
                        value={header.notes}
                        onChange={(e) => setHeader({ ...header, notes: e.target.value })}
                    />
                </div>

                {/* Footer Actions */}
                <div className="pt-6 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-4">
                    <button 
                        type="button"
                        onClick={onBack}
                        className="px-8 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 font-bold rounded-2xl text-sm transition-all"
                    >
                        Hủy bỏ
                    </button>
                    <button 
                        type="button"
                        disabled={loading}
                        onClick={(e) => handleSubmit(e, 'DRAFT')}
                        className={`
                            px-8 py-3 bg-orange-100 border border-orange-200 hover:bg-orange-200 text-orange-700 font-bold rounded-2xl text-sm transition-all flex items-center gap-2
                            ${loading ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}
                        `}
                    >
                        {loading ? 'Đang xử lý...' : 'Lưu Nháp'}
                    </button>
                    <button 
                        type="button"
                        disabled={loading}
                        onClick={(e) => handleSubmit(e, 'CONFIRMED')}
                        className={`
                            px-8 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-2xl text-sm shadow-xl shadow-emerald-500/20 transition-all flex items-center gap-2
                            ${loading ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}
                        `}
                    >
                        {loading ? 'Đang xử lý...' : (
                            <>
                                <span className="material-symbols-outlined notranslate text-[20px]" translate="no">check_circle</span>
                                Lưu & Xác nhận
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}
