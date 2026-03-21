import React, { useState, useMemo } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { useToast } from '../../context/ToastContext';
import SearchableSelect from '../common/SearchableSelect';
import { exportReceiptToPDF } from './InventoryExportUtils';

export default function InventoryOutbound({ onBack }) {
    const { warehouses, materials, partners, stocks, createTransaction } = useInventory();
    const { success, error, warning } = useToast();
    const [loading, setLoading] = useState(false);
    
    const [header, setHeader] = useState({
        warehouse_id: '',
        partner_id: '',
        number: `XK-${Date.now().toString().slice(-6)}`,
        date: new Date().toISOString().split('T')[0],
        notes: '',
        sub_type: 'Thi công'
    });

    const subTypes = [
        { id: 'Thi công', name: 'Thi công' },
        { id: 'Luân chuyển', name: 'Luân chuyển' },
        { id: 'Trả hàng', name: 'Trả hàng' },
        { id: 'Khác', name: 'Khác' }
    ];

    const [items, setItems] = useState([
        { material_id: '', quantity: 1, uom: '', notes: '' }
    ]);

    // Recipient could be Subcontractors, Teams or Staff
    const recipients = partners.filter(p => 
        p.role === 'Nhà thầu phụ' || 
        p.role === 'Subcontractor' || 
        p.role === 'Staff' ||
        p.role === 'Tổ đội'
    );

    const handleAddItem = () => {
        setItems([...items, { material_id: '', quantity: 1, uom: '', notes: '' }]);
    };

    const handleRemoveItem = (index) => {
        if (items.length > 1) {
            setItems(items.filter((_, i) => i !== index));
        }
    };

    const handleItemChange = (index, field, value) => {
        const newItems = [...items];
        newItems[index][field] = value;
        
        if (field === 'material_id') {
            const mat = materials.find(m => m.id === value);
            if (mat) newItems[index].uom = mat.uom;
        }
        
        setItems(newItems);
    };

    // Helper to get current stock for a material at the selected warehouse
    const getStockAtWH = (materialId) => {
        if (!header.warehouse_id || !materialId) return 0;
        const stock = stocks.find(s => s.warehouse_id === header.warehouse_id && s.material_id === materialId);
        return stock ? stock.quantity : 0;
    };

    const handleSubmit = async (e, targetStatus) => {
        e.preventDefault();
        
        // Validation
        if (!header.warehouse_id || !header.partner_id || items.some(i => !i.material_id)) {
            error("Vui lòng điền đầy đủ thông tin bắt buộc!");
            return;
        }

        // Stock check only if confirmed
        if (targetStatus === 'CONFIRMED') {
            for (const item of items) {
                const available = getStockAtWH(item.material_id);
                if (item.quantity > available) {
                    const matName = materials.find(m => m.id === item.material_id)?.name;
                    warning(`Không đủ tồn kho cho [${matName}]. Hiện có: ${available}, Cần xuất: ${item.quantity}`);
                    return;
                }
            }
        }

        setLoading(true);
        try {
            const receipt = {
                warehouse_id: header.warehouse_id,
                partner_id: header.partner_id,
                number: header.number,
                type: 'OUT',
                sub_type: header.sub_type,
                notes: header.notes,
                status: targetStatus
            };

            await createTransaction(receipt, items);
            success(targetStatus === 'DRAFT' ? "Đã lưu nháp phiếu xuất kho!" : "Đã xác nhận phiếu xuất kho thành công!");
            
            if (targetStatus === 'CONFIRMED') {
                try {
                    exportReceiptToPDF(receipt, items, materials, partners, warehouses);
                } catch(e) { console.error("PDF Export Error:", e) }
            }

            if (onBack) onBack();
        } catch (err) {
            console.error("Lỗi xuất kho:", err);
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
                        <span className="material-symbols-outlined notranslate text-blue-500" translate="no">logout</span>
                        Lập phiếu Xuất kho
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">Xuất vật tư từ kho cho thầu phụ, tổ đội hoặc thi công</p>
                </div>
                <button 
                    onClick={onBack}
                    className="w-10 h-10 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center transition-colors"
                >
                    <span className="material-symbols-outlined notranslate text-slate-500" translate="no">close</span>
                </button>
            </div>

            <form className="p-8 space-y-8">
                {/* Header Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Kho xuất *</label>
                        <SearchableSelect 
                            placeholder="-- Chọn kho xuất --"
                            options={warehouses}
                            value={header.warehouse_id}
                            onChange={(val) => setHeader({ ...header, warehouse_id: val })}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Người nhận/Đơn vị *</label>
                        <SearchableSelect 
                            placeholder="-- Chọn người nhận --"
                            options={recipients}
                            value={header.partner_id}
                            onChange={(val) => setHeader({ ...header, partner_id: val })}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Lý do xuất *</label>
                        <SearchableSelect 
                            placeholder="-- Chọn lý do --"
                            options={subTypes}
                            value={header.sub_type}
                            onChange={(val) => setHeader({ ...header, sub_type: val })}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Số phiếu xuất</label>
                        <input 
                            type="text"
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 font-mono"
                            value={header.number}
                            onChange={(e) => setHeader({ ...header, number: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Ngày xuất</label>
                        <input 
                            type="date"
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl text-sm focus:ring-2 focus:ring-blue-500"
                            value={header.date}
                            onChange={(e) => setHeader({ ...header, date: e.target.value })}
                        />
                    </div>
                </div>

                {/* Items Table */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h4 className="text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-tight">Vật tư xuất kho</h4>
                        <button 
                            type="button"
                            onClick={handleAddItem}
                            className="flex items-center gap-2 text-xs font-bold text-blue-600 hover:text-blue-700"
                        >
                            <span className="material-symbols-outlined notranslate text-sm" translate="no">add_circle</span>
                            Thêm dòng
                        </button>
                    </div>

                    <div className="border border-slate-100 dark:border-slate-700 rounded-2xl overflow-hidden shadow-inner">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50 dark:bg-slate-900/50 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                <tr>
                                    <th className="px-4 py-3 w-[40%]">Vật tư *</th>
                                    <th className="px-4 py-3 text-center w-[15%]">Hiện có</th>
                                    <th className="px-4 py-3 text-center w-[15%]">Số lượng xuất</th>
                                    <th className="px-4 py-3 text-center">ĐVT</th>
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
                                        <td className="px-4 py-3 text-center text-xs font-mono font-bold text-slate-400 bg-slate-50/30 dark:bg-slate-900/30">
                                            {getStockAtWH(item.material_id).toLocaleString('vi-VN')}
                                        </td>
                                        <td className="px-4 py-3">
                                            <input 
                                                type="number"
                                                min="0.01"
                                                step="0.01"
                                                className={`
                                                    w-full bg-slate-50 dark:bg-slate-900 rounded-lg border-none text-sm text-center font-bold py-1 px-2 focus:ring-1 
                                                    ${item.quantity > getStockAtWH(item.material_id) ? 'text-red-500 focus:ring-red-500 ring-1 ring-red-200' : 'focus:ring-blue-500'}
                                                `}
                                                value={item.quantity}
                                                onChange={(e) => handleItemChange(index, 'quantity', parseFloat(e.target.value))}
                                            />
                                        </td>
                                        <td className="px-4 py-3 text-center italic text-xs text-slate-500">
                                            {item.uom || '-'}
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
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Lý do xuất / Ghi chú</label>
                    <textarea 
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 min-h-[100px]"
                        placeholder="Ví dụ: Xuất vật tư ống nhựa cho thầu phụ ABC thi công tầng 5..."
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
                            px-8 py-3 bg-blue-500 hover:bg-blue-600 text-white font-black rounded-2xl text-sm shadow-xl shadow-blue-500/20 transition-all flex items-center gap-2
                            ${loading ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}
                        `}
                    >
                        {loading ? 'Đang xử lý...' : (
                            <>
                                <span className="material-symbols-outlined notranslate text-[20px]" translate="no">send</span>
                                Lưu & Xác nhận
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}
