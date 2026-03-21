import React, { useState } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { useToast } from '../../context/ToastContext';
import SearchableSelect from '../common/SearchableSelect';

export default function InventoryRequestForm({ onBack }) {
    const { materials, warehouses, createRequest } = useInventory();
    const { success, error } = useToast();
    const [loading, setLoading] = useState(false);
    
    const [header, setHeader] = useState({
        project_id: '', // Will be linked to warehouse/project
        number: `REQ-${Date.now().toString().slice(-6)}`,
        notes: ''
    });

    const [items, setItems] = useState([
        { material_id: '', quantity: 1, uom: '', notes: '' }
    ]);

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

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!header.project_id || items.some(i => !i.material_id)) {
            error("Vui lòng chọn dự án và vật tư!");
            return;
        }

        setLoading(true);
        try {
            const request = {
                project_id: header.project_id,
                number: header.number,
                notes: header.notes,
                status: 'PENDING'
            };

            await createRequest(request, items);
            success("Yêu cầu vật tư đã được gửi thành công!");
            if (onBack) onBack();
        } catch (err) {
            console.error("Lỗi gửi yêu cầu:", err);
            error("Có lỗi xảy ra khi gửi yêu cầu!");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-[32px] shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-slide-up">
            <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-amber-50/30 dark:bg-amber-500/5">
                <div>
                    <h3 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-3">
                        <span className="material-symbols-outlined notranslate text-amber-500" translate="no">assignment</span>
                        Tạo yêu cầu cấp vật tư
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">Gửi đề xuất nhu cầu vật tư từ công trường về bộ phận kho</p>
                </div>
                <button 
                    onClick={onBack}
                    className="w-10 h-10 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center transition-colors"
                >
                    <span className="material-symbols-outlined notranslate text-slate-500" translate="no">close</span>
                </button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-8">
                {/* Header Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Dự án yêu cầu *</label>
                        <SearchableSelect 
                            placeholder="-- Chọn dự án/kho --"
                            options={warehouses}
                            value={header.project_id}
                            onChange={(val) => setHeader({ ...header, project_id: val })}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Mã số yêu cầu</label>
                        <input 
                            type="text"
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl text-sm focus:ring-2 focus:ring-amber-500 font-mono"
                            value={header.number}
                            readOnly
                        />
                    </div>
                </div>

                {/* Items Table */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h4 className="text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-tight">Danh sách vật tư đề xuất</h4>
                        <button 
                            type="button"
                            onClick={handleAddItem}
                            className="flex items-center gap-2 text-xs font-bold text-amber-600 hover:text-amber-700"
                        >
                            <span className="material-symbols-outlined notranslate text-sm" translate="no">add_circle</span>
                            Thêm vật tư
                        </button>
                    </div>

                    <div className="border border-slate-100 dark:border-slate-700 rounded-2xl overflow-hidden shadow-inner">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50 dark:bg-slate-900/50 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                <tr>
                                    <th className="px-4 py-3 w-[50%]">Tên vật tư *</th>
                                    <th className="px-4 py-3 text-center w-[20%]">Số lượng yêu cầu</th>
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
                                        <td className="px-4 py-3">
                                            <input 
                                                type="number"
                                                min="0.01"
                                                step="0.01"
                                                className="w-full bg-slate-50 dark:bg-slate-900 rounded-lg border-none text-sm text-center font-bold py-1 px-2 focus:ring-1 focus:ring-amber-500"
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
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Mục đích sử dụng / Ghi chú</label>
                    <textarea 
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl text-sm focus:ring-2 focus:ring-amber-500 min-h-[100px]"
                        placeholder="Ví dụ: Cần 100m ống nhựa PVC cho hạng mục thoát nước tầng 3..."
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
                        type="submit"
                        disabled={loading}
                        className={`
                            px-12 py-3 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-2xl text-sm shadow-xl shadow-amber-500/20 transition-all flex items-center gap-2
                            ${loading ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}
                        `}
                    >
                        {loading ? 'Đang gửi...' : (
                            <>
                                <span className="material-symbols-outlined notranslate text-[20px]" translate="no">send</span>
                                Gửi yêu cầu
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}
