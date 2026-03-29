import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import ExcelImportModal from './ExcelImportModal';
import { smartToast } from '../utils/globalToast';

const EMPTY_MATERIAL = {
    code: '',
    name: '',
    category_code: '',
    brand: '',
    model: '',
    unit: 'Cái',
    base_price: 0,
    discount_percentage: 0,
    weight_per_unit: '',
    min_inventory: 0,
    import_unit: '',
    import_conversion_rate: 1,
    export_unit: '',
    export_conversion_rate: 1,
    notes: ''
};

export default function MaterialsMaster() {
    const [materials, setMaterials] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isBulkUpdateModalOpen, setIsBulkUpdateModalOpen] = useState(false);
    const [isManualModalOpen, setIsManualModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [newMaterial, setNewMaterial] = useState(EMPTY_MATERIAL);

    // Categories & Brands options
    const [categories, setCategories] = useState([]);
    const [brands, setBrands] = useState([]);
    const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
    const [quickAddType, setQuickAddType] = useState('BRAND'); // 'BRAND' or 'CATEGORY'
    const [quickAddValue, setQuickAddValue] = useState({ name: '', code: '' });
    
    // Bulk Update Form State
    const [bulkUpdateForm, setBulkUpdateForm] = useState({
        type: 'PERCENT_DISCOUNT', // PERCENT_DISCOUNT, PERCENT_PRICE, FIXED_PRICE_PER_KG
        value: ''
    });

    const fmt = (v) => v ? Number(v).toLocaleString('vi-VN') : '0';

    const materialMapping = {
        code: "Mã VT",
        name: "Tên vật tư",
        category_code: "Danh mục",
        brand: "Hãng",
        model: "Model",
        unit: "ĐVT",
        base_price: "Đơn giá niêm yết",
        discount_percentage: "Chiết khấu (%)",
        weight_per_unit: "Trọng lượng (kg/ĐVT)",
        min_inventory: "Tồn tối thiểu",
        import_unit: "ĐVT Nhập",
        import_conversion_rate: "Hệ số quy đổi nhập",
        export_unit: "ĐVT Xuất",
        export_conversion_rate: "Hệ số quy đổi xuất",
        notes: "Mô tả"
    };

    useEffect(() => {
        fetchData();
        fetchOptions();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('materials')
            .select('*')
            .order('name', { ascending: true });

        if (error) {
            console.error("Lỗi tải vật tư:", error);
        } else {
            setMaterials(data || []);
        }
        setLoading(false);
    };

    const fetchOptions = async () => {
        // Fetch Categories
        const { data: catData } = await supabase.from('material_categories').select('*').order('name');
        setCategories(catData || []);

        // Fetch Brands
        // We use material_brands table (to be created)
        const { data: brandData } = await supabase.from('material_brands').select('*').order('name');
        setBrands(brandData || []);
    };

    const handleImportSuccess = (count) => {
        smartToast(`Đã import thành công ${count} vật tư!`);
        fetchData();
    };

    const handleSaveManual = async (e) => {
        e.preventDefault();
        if (!newMaterial.name || !newMaterial.code) {
            smartToast('Vui lòng nhập Mã và Tên vật tư');
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = { ...newMaterial };
            // Convert numbers
            payload.base_price = Number(payload.base_price) || 0;
            payload.discount_percentage = Number(payload.discount_percentage) || 0;
            payload.min_inventory = Number(payload.min_inventory) || 0;
            payload.import_conversion_rate = Number(payload.import_conversion_rate) || 1;
            payload.export_conversion_rate = Number(payload.export_conversion_rate) || 1;
            payload.weight_per_unit = payload.weight_per_unit ? Number(payload.weight_per_unit) : null;

            let error;
            if (editingId) {
                const { error: err } = await supabase.from('materials').update(payload).eq('id', editingId);
                error = err;
            } else {
                const { error: err } = await supabase.from('materials').insert([payload]);
                error = err;
            }

            if (error) throw error;

            setIsManualModalOpen(false);
            setEditingId(null);
            setNewMaterial(EMPTY_MATERIAL);
            fetchData();
        } catch (err) {
            console.error("Lỗi lưu vật tư:", err);
            smartToast("Đã xảy ra lỗi: " + err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleQuickAdd = async () => {
      if (!quickAddValue.name) return;
      
      try {
        if (quickAddType === 'CATEGORY') {
          if (!quickAddValue.code) { smartToast('Mã danh mục là bắt buộc'); return; }
          const { error } = await supabase.from('material_categories').insert([{ name: quickAddValue.name, code: quickAddValue.code.toUpperCase() }]);
          if (error) throw error;
          setNewMaterial({ ...newMaterial, category_code: quickAddValue.code.toUpperCase() });
        } else {
          const { error } = await supabase.from('material_brands').insert([{ name: quickAddValue.name }]);
          if (error) throw error;
          setNewMaterial({ ...newMaterial, brand: quickAddValue.name });
        }
        
        await fetchOptions();
        setIsQuickAddOpen(false);
        setQuickAddValue({ name: '', code: '' });
      } catch (err) {
        smartToast("Lỗi khi thêm nhanh: " + err.message);
      }
    };

    const handleEditManual = (m) => {
        setNewMaterial({
            code: m.code || '',
            name: m.name || '',
            category_code: m.category_code || '',
            brand: m.brand || '',
            model: m.model || '',
            unit: m.unit || 'Cái',
            base_price: m.base_price || 0,
            discount_percentage: m.discount_percentage || 0,
            weight_per_unit: m.weight_per_unit || '',
            min_inventory: m.min_inventory || 0,
            import_unit: m.import_unit || '',
            import_conversion_rate: m.import_conversion_rate || 1,
            export_unit: m.export_unit || '',
            export_conversion_rate: m.export_conversion_rate || 1,
            notes: m.notes || ''
        });
        setEditingId(m.id);
        setIsManualModalOpen(true);
    };

    const handleDelete = async (id, name) => {
        if (!window.confirm(`Bạn có chắc muốn xóa vật tư "${name}"?`)) return;
        const { error } = await supabase.from('materials').delete().eq('id', id);
        if (error) {
            smartToast("Không thể xóa. Vật tư này có thể đang được sử dụng.");
        } else {
            fetchData();
        }
    };

    const filteredList = materials.filter(m => 
        (m.name && m.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (m.code && m.code.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const toggleSelect = (id) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === filteredList.length) {
            setSelectedIds(new Set());
        } else {
            const newSet = new Set(filteredList.map(m => m.id));
            setSelectedIds(newSet);
        }
    };

    const handleBulkUpdate = async () => {
        if (selectedIds.size === 0) return;
        if (!bulkUpdateForm.value) {
            smartToast("Vui lòng nhập giá trị!");
            return;
        }

        const val = Number(bulkUpdateForm.value);
        if (isNaN(val)) {
            smartToast("Giá trị không hợp lệ!");
            return;
        }

        const selectedMats = materials.filter(m => selectedIds.has(m.id));
        const updates = selectedMats.map(m => {
            let updateObj = { id: m.id };
            if (bulkUpdateForm.type === 'PERCENT_DISCOUNT') {
                updateObj.discount_percentage = val;
            } else if (bulkUpdateForm.type === 'PERCENT_PRICE') {
                updateObj.base_price = Math.round(m.base_price * (1 + val/100));
            } else if (bulkUpdateForm.type === 'FIXED_PRICE_PER_KG') {
                if (m.weight_per_unit && m.weight_per_unit > 0) {
                    updateObj.base_price = Math.round(val * m.weight_per_unit);
                }
            }
            return updateObj;
        });

        const { error } = await supabase.from('materials').upsert(updates);

        if (error) {
            console.error("Lỗi cập nhật:", error);
            smartToast("Lỗi khi cập nhật giá hàng loạt!");
        } else {
            smartToast(`Cập nhật thành công ${updates.length} vật tư!`);
            setIsBulkUpdateModalOpen(false);
            setSelectedIds(new Set());
            fetchData();
        }
    };

    const inp = "w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition";

    if (loading) {
        return (
            <div className="p-12 text-center text-slate-500 flex flex-col items-center gap-4">
                <span className="material-symbols-outlined notranslate animate-spin text-4xl text-blue-500" translate="no">progress_activity</span>
                <p className="font-medium">Đang tải Danh mục Vật tư...</p>
            </div>
        );
    }

    return (
        <div className="pb-10 animate-fade-in text-slate-900 dark:text-slate-100">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                    <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2 tracking-tight">
                        <span className="material-symbols-outlined notranslate text-blue-500 text-[28px]" translate="no">inventory_2</span>
                        Danh Mục Vật Tư & Giá Bán
                    </h2>
                    <p className="text-slate-500 text-sm mt-1 uppercase font-semibold tracking-wider">Quản lý định mức, hệ số quy đổi và cập nhật giá hàng loạt</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {selectedIds.size > 0 && (
                        <button 
                            onClick={() => setIsBulkUpdateModalOpen(true)}
                            className="h-10 px-4 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl hover:bg-amber-100 font-bold border border-amber-200 dark:border-amber-500/20 flex items-center gap-2 transition-all shadow-sm animate-pulse"
                        >
                            <span className="material-symbols-outlined notranslate text-[18px]" translate="no">edit_square</span>
                            Cập nhật giá ({selectedIds.size})
                        </button>
                    )}
                    <button 
                        onClick={() => setIsManualModalOpen(true)}
                        className="h-10 px-4 bg-primary text-white rounded-xl hover:bg-primary-hover font-bold flex items-center gap-2 transition-all shadow-md active:scale-95"
                    >
                        <span className="material-symbols-outlined notranslate text-[18px]" translate="no">add</span>
                        Thêm Vật tư
                    </button>
                    <button 
                        onClick={() => setIsImportModalOpen(true)}
                        className="h-10 px-4 bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 rounded-xl hover:bg-emerald-50 border border-emerald-200 dark:border-emerald-500/30 font-bold flex items-center gap-2 transition-all shadow-sm"
                    >
                        <span className="material-symbols-outlined notranslate text-[18px]" translate="no">upload_file</span>
                        Import Excel
                    </button>
                    <button onClick={fetchData} className="h-10 w-10 flex items-center justify-center bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-50 border border-slate-200 dark:border-slate-700 transition-all shadow-sm">
                        <span className="material-symbols-outlined notranslate" translate="no">refresh</span>
                    </button>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex flex-col md:flex-row md:justify-between items-center gap-4 bg-slate-50/50 dark:bg-slate-800/50">
                    <h3 className="font-bold text-slate-700 dark:text-slate-300">Danh sách Vật tư ({materials.length})</h3>
                    <div className="relative w-full md:w-80">
                        <span className="material-symbols-outlined notranslate absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]" translate="no">search</span>
                        <input
                            type="text"
                            placeholder="Tìm mã hoặc tên Vật tư..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 pr-4 py-2 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-primary focus:border-transparent transition-all shadow-sm outline-none"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    {filteredList.length === 0 ? (
                        <div className="text-center py-20 text-slate-400">
                            <span className="material-symbols-outlined notranslate text-6xl block mb-4 opacity-20" translate="no">inventory</span>
                            <p className="text-lg font-medium">Chưa có dữ liệu vật tư.</p>
                            <p className="text-sm mt-1">Sử dụng nút "Thêm Vật tư" hoặc "Import Excel" để bắt đầu.</p>
                        </div>
                    ) : (
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 uppercase tracking-wider text-[11px] font-bold border-b border-slate-100 dark:border-slate-700 whitespace-nowrap">
                                <tr>
                                    <th className="px-4 py-4 text-center w-12">
                                        <input 
                                            type="checkbox" 
                                            className="rounded border-slate-300 dark:border-slate-600 text-primary focus:ring-primary"
                                            checked={selectedIds.size === filteredList.length && filteredList.length > 0}
                                            onChange={toggleSelectAll}
                                        />
                                    </th>
                                    <th className="px-4 py-4">Mã VT</th>
                                    <th className="px-4 py-4 min-w-[250px]">Tên Vật tư & Thông số</th>
                                    <th className="px-4 py-4 text-center">ĐVT Base</th>
                                    <th className="px-4 py-4 text-right">Trọng lượng<br/><span className="text-[9px] text-slate-400">(kg/ĐVT)</span></th>
                                    <th className="px-4 py-4 text-right">Giá gốc</th>
                                    <th className="px-4 py-4 text-right text-emerald-600">CK %</th>
                                    <th className="px-4 py-4 text-right text-primary font-bold">Giá Thực Tế</th>
                                    <th className="px-4 py-4 text-right">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                {filteredList.map((m) => (
                                    <tr key={m.id} className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/80 group transition-colors ${selectedIds.has(m.id) ? 'bg-primary/5 dark:bg-primary/10' : ''}`}>
                                        <td className="px-4 py-4 text-center">
                                            <input 
                                                type="checkbox" 
                                                className="rounded border-slate-300 dark:border-slate-600 text-primary focus:ring-primary"
                                                checked={selectedIds.has(m.id)}
                                                onChange={() => toggleSelect(m.id)}
                                            />
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-md text-[11px] font-bold font-mono">
                                                {m.code}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="font-bold text-slate-900 dark:text-white mb-0.5">{m.name}</div>
                                            <div className="flex flex-wrap gap-x-3 gap-y-1">
                                                {m.brand && <span className="text-[10px] text-slate-500 font-medium tracking-wide">Hãng: {m.brand}</span>}
                                                {m.model && <span className="text-[10px] text-slate-500 font-medium tracking-wide">Model: {m.model}</span>}
                                                {m.category_code && <span className="text-[10px] text-blue-500 font-bold uppercase tracking-tight bg-blue-50 dark:bg-blue-900/30 px-1.5 rounded">{m.category_code}</span>}
                                            </div>
                                            {(m.import_unit || m.export_unit) && (
                                              <div className="mt-1 text-[10px] text-orange-600 flex items-center gap-2 border-t border-slate-100 dark:border-slate-700 pt-1 w-fit">
                                                {m.import_unit && <span>QĐ Nhập: 1 {m.import_unit} = {m.import_conversion_rate} {m.unit}</span>}
                                                {m.export_unit && <span>| QĐ Xuất: 1 {m.export_unit} = {m.export_conversion_rate} {m.unit}</span>}
                                              </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-4 text-center font-medium">
                                            {m.unit}
                                        </td>
                                        <td className="px-4 py-4 text-right font-medium text-slate-500">
                                            {m.weight_per_unit ? m.weight_per_unit.toFixed(3) : '-'}
                                        </td>
                                        <td className="px-4 py-4 text-right text-slate-400 line-through text-xs italic">
                                            {fmt(m.base_price)}
                                        </td>
                                        <td className="px-4 py-4 text-right font-bold text-emerald-600">
                                            {m.discount_percentage ? `${m.discount_percentage}%` : '-'}
                                        </td>
                                        <td className="px-4 py-4 text-right font-black text-primary text-base">
                                            {fmt(m.actual_price)}
                                        </td>
                                        <td className="px-4 py-4 text-right whitespace-nowrap">
                                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                              <button onClick={() => handleEditManual(m)} className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors">
                                                  <span className="material-symbols-outlined notranslate text-[18px]" translate="no">edit</span>
                                              </button>
                                              <button onClick={() => handleDelete(m.id, m.name)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors">
                                                  <span className="material-symbols-outlined notranslate text-[18px]" translate="no">delete</span>
                                              </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Manual Add/Edit Modal */}
            {isManualModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-fade-in flex flex-col max-h-[90vh]">
                        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <span className="material-symbols-outlined notranslate text-primary" translate="no">{editingId ? 'edit_square' : 'add_box'}</span>
                                {editingId ? 'Chỉnh sửa Vật tư' : 'Thêm Vật tư Mới'}
                            </h3>
                            <div className="flex gap-3 items-center">
                                {!editingId && (
                                    <button 
                                        type="button" 
                                        onClick={() => { setIsManualModalOpen(false); setIsImportModalOpen(true); }} 
                                        className="text-sm font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 px-4 py-2 rounded-xl border border-emerald-200 transition-colors shadow-sm"
                                        title="Chuyển sang chế độ nhập hàng loạt bằng Excel"
                                    >
                                        <span className="material-symbols-outlined notranslate text-[18px]" translate="no">upload_file</span>
                                        Tải / Nhập bằng File Excel
                                    </button>
                                )}
                                <button type="button" onClick={() => setIsManualModalOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 dark:hover:text-slate-300 transition-colors">
                                    <span className="material-symbols-outlined notranslate" translate="no">close</span>
                                </button>
                            </div>
                        </div>
                        <form onSubmit={handleSaveManual} className="p-6 overflow-y-auto space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Mã Vật tư <span className="text-red-500">*</span></label>
                                    <input type="text" value={newMaterial.code} onChange={e => setNewMaterial({...newMaterial, code: e.target.value})} className={inp} placeholder="VD: VT001, ONGD20" required />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tên Vật tư <span className="text-red-500">*</span></label>
                                    <input type="text" value={newMaterial.name} onChange={e => setNewMaterial({...newMaterial, name: e.target.value})} className={inp} placeholder="Tên đầy đủ vật tư" required />
                                </div>

                                {/* Category Searchable Dropdown */}
                                <div>
                                    <div className="flex justify-between items-center mb-1">
                                      <label className="block text-xs font-bold text-slate-500 uppercase">Danh mục</label>
                                      <button type="button" onClick={() => { setQuickAddType('CATEGORY'); setIsQuickAddOpen(true); }} className="text-[10px] text-blue-500 font-bold hover:underline flex items-center gap-0.5">
                                        <span className="material-symbols-outlined notranslate text-[12px]" translate="no">add_circle</span> Thêm mới
                                      </button>
                                    </div>
                                    <select value={newMaterial.category_code} onChange={e => setNewMaterial({...newMaterial, category_code: e.target.value})} className={inp}>
                                        <option value="">-- Chọn danh mục --</option>
                                        {categories.map(c => <option key={c.id} value={c.code}>{c.name}</option>)}
                                    </select>
                                </div>

                                {/* Brand Searchable Dropdown */}
                                <div>
                                    <div className="flex justify-between items-center mb-1">
                                      <label className="block text-xs font-bold text-slate-500 uppercase">Hãng sản xuất</label>
                                      <button type="button" onClick={() => { setQuickAddType('BRAND'); setIsQuickAddOpen(true); }} className="text-[10px] text-blue-500 font-bold hover:underline flex items-center gap-0.5">
                                        <span className="material-symbols-outlined notranslate text-[12px]" translate="no">add_circle</span> Thêm mới
                                      </button>
                                    </div>
                                    <select value={newMaterial.brand} onChange={e => setNewMaterial({...newMaterial, brand: e.target.value})} className={inp}>
                                        <option value="">-- Chọn hãng --</option>
                                        {brands.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">ĐVT Chuẩn (Base) <span className="text-red-500">*</span></label>
                                    <input type="text" value={newMaterial.unit} onChange={e => setNewMaterial({...newMaterial, unit: e.target.value})} className={inp} required />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Trọng lượng (kg/ĐVT)</label>
                                    <input type="number" step="0.001" value={newMaterial.weight_per_unit} onChange={e => setNewMaterial({...newMaterial, weight_per_unit: e.target.value})} className={inp} placeholder="VD: 2.5" />
                                </div>
                                <div>
                                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Đơn giá niêm yết</label>
                                  <input type="number" value={newMaterial.base_price} onChange={e => setNewMaterial({...newMaterial, base_price: e.target.value})} className={inp} />
                                </div>
                                <div>
                                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Chiết khấu (%)</label>
                                  <input type="number" value={newMaterial.discount_percentage} onChange={e => setNewMaterial({...newMaterial, discount_percentage: e.target.value})} className={inp} />
                                </div>
                            </div>
                            
                            <div className="p-4 bg-orange-50 dark:bg-orange-950/20 border border-orange-100 dark:border-orange-900 rounded-xl">
                              <h4 className="text-xs font-bold text-orange-700 dark:text-orange-400 uppercase mb-3 flex items-center gap-2">
                                <span className="material-symbols-outlined notranslate text-[16px]" translate="no">swap_horiz</span>
                                Thông số quy đổi (Dùng cho Nhập xuất kho)
                              </h4>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <label className="block text-[10px] font-bold text-slate-500 uppercase">Đơn vị Nhập</label>
                                  <input type="text" value={newMaterial.import_unit} onChange={e => setNewMaterial({...newMaterial, import_unit: e.target.value})} className={inp} placeholder="VD: Kiện, Bó" />
                                  <label className="block text-[10px] font-bold text-slate-500 uppercase">Hệ số quy đổi (Nhập → Base)</label>
                                  <input type="number" value={newMaterial.import_conversion_rate} onChange={e => setNewMaterial({...newMaterial, import_conversion_rate: e.target.value})} className={inp} />
                                </div>
                                <div className="space-y-2">
                                  <label className="block text-[10px] font-bold text-slate-500 uppercase">Đơn vị Xuất</label>
                                  <input type="text" value={newMaterial.export_unit} onChange={e => setNewMaterial({...newMaterial, export_unit: e.target.value})} className={inp} placeholder="VD: Thanh, Cuộn" />
                                  <label className="block text-[10px] font-bold text-slate-500 uppercase">Hệ số quy đổi (Xuất → Base)</label>
                                  <input type="number" value={newMaterial.export_conversion_rate} onChange={e => setNewMaterial({...newMaterial, export_conversion_rate: e.target.value})} className={inp} />
                                </div>
                              </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Ghi chú / Mô tả</label>
                                <textarea value={newMaterial.notes} onChange={e => setNewMaterial({...newMaterial, notes: e.target.value})} className={inp} rows="2"></textarea>
                            </div>

                            <div className="pt-4 flex justify-end gap-3 sticky bottom-0 bg-white dark:bg-slate-800">
                                <button type="button" onClick={() => setIsManualModalOpen(false)} className="px-5 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors">Hủy</button>
                                <button type="submit" disabled={isSubmitting} className="px-8 py-2 text-sm font-bold text-white bg-primary rounded-xl hover:bg-primary-hover shadow-lg active:scale-95 transition-all disabled:opacity-50">
                                    {isSubmitting ? 'Đang lưu...' : 'Xác nhận Lưu'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Quick Add Modal */}
            {isQuickAddOpen && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-[2px]">
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in duration-200">
                  <h4 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined notranslate text-blue-500" translate="no">add_circle</span>
                    Thêm {quickAddType === 'CATEGORY' ? 'Danh mục' : 'Hãng sản xuất'}
                  </h4>
                  <div className="space-y-4">
                    {quickAddType === 'CATEGORY' && (
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Mã Danh mục (Duy nhất)</label>
                        <input type="text" value={quickAddValue.code} onChange={e => setQuickAddValue({ ...quickAddValue, code: e.target.value })} className={inp} placeholder="VD: ONG, DAY, DEN" />
                      </div>
                    )}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tên {quickAddType === 'CATEGORY' ? 'Danh mục' : 'Hãng'}</label>
                      <input type="text" value={quickAddValue.name} onChange={e => setQuickAddValue({ ...quickAddValue, name: e.target.value })} className={inp} placeholder="Nhập tên..." />
                    </div>
                  </div>
                  <div className="mt-6 flex justify-end gap-2">
                    <button onClick={() => setIsQuickAddOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">Hủy</button>
                    <button onClick={handleQuickAdd} className="px-6 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-md active:scale-95 shadow-blue-500/20">Lưu nhanh</button>
                  </div>
                </div>
              </div>
            )}

                <ExcelImportModal 
                    isOpen={isImportModalOpen}
                    onClose={() => setIsImportModalOpen(false)}
                    title="Nhập Danh Mục Vật Tư"
                    tableName="materials"
                    columnMapping={materialMapping}
                    onSuccess={handleImportSuccess}
                    templateFilename="mau_danh_muc_vat_tu.xlsx"
                    templateSampleRows={[
                        ['TC-P20', 'Ống nhựa uPVC Class 2 D21', 'ONG', 'Tiền Phong', 'D21x1.6', 'Thanh', 28500, 30, 15, 0.45, 'Bó', 50, 'Thanh', 1, 'Ống thoát nước dân dụng'],
                        ['W-PN1.5', 'Dây điện đơn 1.5mm2', 'DAY', 'Trần Phú', 'Cu/PVC 1.5', 'Mét', 8200, 25, 20, 0.05, 'Cuộn', 100, 'Mét', 1, 'Dây cáp điện hạ thế']
                    ]}
                />

            {/* Bulk Update Modal */}
            {isBulkUpdateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-200 dark:border-slate-800">
                        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                            <span className="material-symbols-outlined notranslate text-amber-500" translate="no">edit_square</span>
                            Cập nhật giá hàng loạt
                        </h3>
                        <p className="text-sm text-slate-500 mb-6">Đang áp dụng cho <span className="font-bold text-amber-600">{selectedIds.size}</span> vật tư đã chọn.</p>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold mb-2">Loại cập nhật</label>
                                <select 
                                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-amber-500 font-medium outline-none"
                                    value={bulkUpdateForm.type}
                                    onChange={(e) => setBulkUpdateForm({...bulkUpdateForm, type: e.target.value})}
                                >
                                    <option value="PERCENT_DISCOUNT">Cài đặt Chiết khấu (%)</option>
                                    <option value="PERCENT_PRICE">Tăng/Giảm Giá gốc (%)</option>
                                    <option value="FIXED_PRICE_PER_KG">Áp Giá mới theo Kg (vnđ/kg)</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold mb-2">Giá trị nhập</label>
                                <div className="relative">
                                    <input 
                                        type="number" 
                                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 p-3 pl-4 pr-10 bg-white dark:bg-slate-950 font-bold text-lg focus:ring-2 focus:ring-amber-500 outline-none"
                                        placeholder="Nhập con số..."
                                        value={bulkUpdateForm.value}
                                        onChange={(e) => setBulkUpdateForm({...bulkUpdateForm, value: e.target.value})}
                                    />
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                                        {bulkUpdateForm.type === 'FIXED_PRICE_PER_KG' ? '₫' : '%'}
                                    </div>
                                </div>
                                {bulkUpdateForm.type === 'PERCENT_PRICE' && (
                                    <p className="text-xs text-slate-500 mt-2 italic">* Nhập số âm (VD: -5) để giảm giá gốc.</p>
                                )}
                                {bulkUpdateForm.type === 'FIXED_PRICE_PER_KG' && (
                                    <p className="text-xs text-amber-600 mt-3 font-medium bg-amber-50 dark:bg-amber-950/30 p-3 rounded-xl border border-amber-200 dark:border-amber-900 leading-relaxed">
                                        * Hệ thống sẽ tính lại Giá gốc (ĐVT chuẩn) = Giá Kg nhập x Trọng lượng (kg) đang lưu. Vật tư nào trống trọng lượng sẽ KHÔNG nhảy số.
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="mt-8 flex justify-end gap-3">
                            <button 
                                onClick={() => setIsBulkUpdateModalOpen(false)}
                                className="px-5 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                                Hủy bỏ
                            </button>
                            <button 
                                onClick={handleBulkUpdate}
                                className="px-8 py-2.5 rounded-xl font-bold text-white bg-amber-500 hover:bg-amber-600 shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
                            >
                                Xác nhận Lưu
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
