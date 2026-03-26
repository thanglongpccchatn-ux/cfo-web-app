import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import ExcelImportModal from './ExcelImportModal';

export default function MaterialTracking({ project, onBack, embedded }) {
    const [materials, setMaterials] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showSummary, setShowSummary] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);

    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({});

    const MATERIAL_COLUMN_MAPPING = {
        expense_date: 'Ngày Nhập',
        item_group: 'Nhóm Vật Tư',
        supplier_name: 'Nhà Cung Cấp',
        product_name: 'Tên Vật Tư / MMTB',
        unit: 'Đơn Vị',
        quantity: 'Số Lượng',
        unit_price: 'Đơn Giá (VNĐ)',
        vat_rate: 'VAT (%)',
        total_amount: 'Thành Tiền (VAT)',
        paid_amount: 'Đã Thanh Toán',
        notes: 'Ghi Chú'
    };

    const MATERIAL_SAMPLE_ROWS = [
        ['2025-01-15', 'Vật tư chính', 'Công ty Xi Măng ABC', 'Xi Măng PC50 Bút Sơn', 'Tấn', 50, 1500000, 8, 81000000, 50000000, 'Giao tại chân công trình'],
        ['2025-01-20', 'Vật tư phụ', 'Cửa hàng Sắt Thép Minh Hùng', 'Thép phi 12 CB240T', 'Kg', 2000, 18000, 8, 38880000, 0, '']
    ];

    const fetchMaterials = React.useCallback(async () => {
        if (!project) return;
        setLoading(true);
        const { data, error } = await supabase
            .from('expense_materials')
            .select('*')
            .eq('project_id', project.id)
            .order('expense_date', { ascending: false });

        if (!error && data) {
            setMaterials(data);
        }
        setLoading(false);
    }, [project]);

    useEffect(() => {
        fetchMaterials();
    }, [fetchMaterials]);

    function handleAddRow() {
        const newRow = {
            id: 'temp-' + Date.now(),
            isNew: true,
            item_group: 'Vật tư phụ',
            expense_date: new Date().toISOString().split('T')[0],
            supplier_name: '',
            product_name: '',
            unit: 'cái',
            quantity: 1,
            unit_price: 0,
            vat_rate: 0,
            total_amount: 0,
            paid_amount: 0,
            notes: '',
            project_id: project.id
        };
        setMaterials([newRow, ...materials]);
        setEditingId(newRow.id);
        setEditForm(newRow);
    };

    const handleEditClick = (mat) => {
        setEditingId(mat.id);
        setEditForm({ ...mat });
    };

    const handleCancelEdit = (id) => {
        setEditingId(null);
        if (id.toString().startsWith('temp-')) {
            setMaterials(materials.filter(m => m.id !== id));
        }
    };

    const handleEditChange = (field, value) => {
        setEditForm(prev => {
            const updated = { ...prev, [field]: value };

            // Auto-calculate Total Amount
            if (['quantity', 'unit_price', 'vat_rate'].includes(field)) {
                const qty = Number(updated.quantity) || 0;
                const price = Number(updated.unit_price) || 0;
                const vat = Number(updated.vat_rate) || 0;
                const beforeVat = qty * price;
                updated.total_amount = beforeVat + (beforeVat * vat / 100);
            }
            return updated;
        });
    };

    async function handleSaveEdit() {
        if (!editForm.product_name || !editForm.expense_date) {
            alert('Vui lòng nhập Tên sản phẩm và Ngày tháng.');
            return;
        }

        const payload = {
            project_id: project.id,
            item_group: editForm.item_group,
            expense_date: editForm.expense_date,
            supplier_name: editForm.supplier_name,
            product_name: editForm.product_name,
            unit: editForm.unit,
            quantity: Number(editForm.quantity),
            unit_price: Number(editForm.unit_price),
            vat_rate: Number(editForm.vat_rate),
            total_amount: Number(editForm.total_amount),
            paid_amount: Number(editForm.paid_amount),
            notes: editForm.notes
        };

        if (editForm.isNew) {
            const { error } = await supabase.from('expense_materials').insert([payload]);
            if (error) console.error(error);
        } else {
            const { error } = await supabase.from('expense_materials').update(payload).eq('id', editingId);
            if (error) console.error(error);
        }

        setEditingId(null);
        fetchMaterials();
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Xóa bản ghi vật tư này?')) return;
        const { error } = await supabase.from('expense_materials').delete().eq('id', id);
        if (!error) fetchMaterials();
    };

    const formatCurrency = (val) => new Intl.NumberFormat('vi-VN').format(Math.round(val || 0));
    const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString('vi-VN') : '-';

    // Summary Calculations
    const totalMaterialsValue = materials.filter(m => !m.isNew).reduce((sum, m) => sum + Number(m.total_amount), 0);
    const totalPaidValue = materials.filter(m => !m.isNew).reduce((sum, m) => sum + Number(m.paid_amount), 0);
    const totalDebtValue = totalMaterialsValue - totalPaidValue;

    if (loading && materials.length === 0) {
        return (
            <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center space-y-4">
                <div className="w-8 h-8 rounded-full border-4 border-orange-200 border-t-orange-500 animate-spin"></div>
                <p className="font-medium text-sm">Đang tải dữ liệu vật tư Sateco...</p>
            </div>
        );
    }

    return (
        <>
        <div className={`flex flex-col h-full bg-white border border-slate-200/60 rounded-xl overflow-hidden animate-fade-in shadow-sm ${embedded ? 'min-h-[600px] mb-8' : 'absolute inset-0 z-50'}`}>
            {/* Control Header */}
            <div className="flex justify-between items-center p-4 border-b border-slate-200/60 bg-white shadow-sm z-10 shrink-0 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-64 h-full bg-gradient-to-r from-orange-50 to-transparent -z-10"></div>
                
                <div className="flex items-center gap-4">
                    {!embedded && (
                        <button onClick={onBack} className="w-10 h-10 flex items-center justify-center bg-white hover:bg-slate-50 rounded-xl transition-all shadow-sm border border-slate-200 text-slate-500 hover:text-orange-600">
                             <span className="material-symbols-outlined notranslate text-[22px]" translate="no">arrow_back</span>
                        </button>
                    )}
                    <button
                        onClick={() => setShowSummary(!showSummary)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm border ${showSummary ? 'bg-orange-600 text-white border-orange-700 hover:bg-orange-700' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-orange-600'}`}
                    >
                        <span className="material-symbols-outlined notranslate text-[18px]" translate="no">{showSummary ? 'grid_on' : 'donut_large'}</span>
                        {showSummary ? 'Về Bảng kê (Excel)' : 'Xem Phân tích'}
                    </button>
                    <div>
                        <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                             <span className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center text-orange-600 shadow-sm border border-orange-200/50">
                                <span className="material-symbols-outlined notranslate text-[18px]" translate="no">inventory_2</span>
                            </span>
                             Sateco: Vật Tư Hiện Trường
                        </h2>
                        <div className="text-[11px] font-bold text-slate-500 tracking-widest uppercase mt-0.5 ml-10">
                            Chi phí thi công vận hành thuộc {project?.code}
                        </div>
                    </div>
                </div>

                <div className="flex gap-3 items-center">
                    {/* Import Button */}
                    <button
                        onClick={() => setShowImportModal(true)}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-emerald-300 text-emerald-700 font-bold text-sm hover:bg-emerald-50 transition-all shadow-sm"
                    >
                        <span className="material-symbols-outlined notranslate text-[18px]" translate="no">upload_file</span>
                        Import Excel
                    </button>
                    <div className="flex bg-slate-50 rounded-xl border border-slate-200 divide-x divide-slate-200 shadow-sm overflow-hidden">
                        <div className="px-5 py-2 hover:bg-white transition-colors">
                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-0.5">Giá trị Tổng (Gồm VAT)</div>
                            <div className="font-black text-slate-800 text-lg tabular-nums tracking-tight">{formatCurrency(totalMaterialsValue)}</div>
                        </div>
                        <div className="px-5 py-2 hover:bg-white transition-colors bg-green-50/30">
                            <div className="text-[10px] text-green-600 font-bold uppercase tracking-widest mb-0.5">Sateco Đã Chi Trả</div>
                            <div className="font-black text-green-700 text-lg tabular-nums tracking-tight">{formatCurrency(totalPaidValue)}</div>
                        </div>
                        <div className="px-5 py-2 hover:bg-white transition-colors bg-rose-50/30">
                            <div className="text-[10px] text-rose-500 font-bold uppercase tracking-widest mb-0.5">Sateco Nợ Nhà Cung Cấp</div>
                            <div className="font-black text-rose-600 text-lg tabular-nums tracking-tight">{formatCurrency(totalDebtValue)}</div>
                        </div>
                    </div>

                    <button onClick={handleAddRow} className="btn bg-orange-600 hover:bg-orange-700 text-white font-bold shadow-md shadow-orange-500/20 px-5 flex items-center gap-2 h-12">
                        <span className="material-symbols-outlined notranslate text-[20px]" translate="no">add_box</span> THÊM VẬT TƯ
                    </button>
                </div>
            </div>

            {/* Main Area: Grid Layout */}
            <div className={`flex-1 overflow-auto bg-slate-50/50 ${embedded ? 'p-0 relative' : 'p-6'}`}>
                {showSummary ? (
                    <div className="max-w-7xl mx-auto space-y-6 pt-6">
                        {/* Group-by Summary Table */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-200/60 bg-slate-50/50 flex items-center gap-3">
                                 <span className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
                                     <span className="material-symbols-outlined notranslate text-[18px]" translate="no">pie_chart</span>
                                 </span>
                                <h3 className="font-bold text-slate-800">Cơ cấu Chi phí Vật tư theo Nhóm</h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-black tracking-widest border-b border-slate-200">
                                        <tr>
                                            <th className="px-6 py-4">Nhóm vật tư / Hạng mục</th>
                                            <th className="px-6 py-4 text-right">Tổng giá trị (VAT)</th>
                                            <th className="px-6 py-4 text-right text-green-600">Đã thanh toán</th>
                                            <th className="px-6 py-4 text-right text-rose-500">Còn nợ NCC</th>
                                            <th className="px-6 py-4 text-center w-48">Tỷ trọng Sateco chi trả</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {Object.entries(
                                            materials.reduce((acc, m) => {
                                                if (m.isNew) return acc;
                                                const group = m.item_group || 'Chưa phân loại';
                                                if (!acc[group]) acc[group] = { total: 0, paid: 0 };
                                                acc[group].total += Number(m.total_amount);
                                                acc[group].paid += Number(m.paid_amount);
                                                return acc;
                                            }, {})
                                        ).sort((a, b) => b[1].total - a[1].total).map(([group, val]) => (
                                            <tr key={group} className="hover:bg-orange-50/30 transition-colors">
                                                <td className="px-6 py-4 font-bold text-slate-700">
                                                     <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 text-xs border border-slate-200/60">
                                                         {group}
                                                     </span>
                                                </td>
                                                <td className="px-6 py-4 text-right font-black text-slate-800 text-[15px]">{formatCurrency(val.total)}</td>
                                                <td className="px-6 py-4 text-right font-black text-green-600">{formatCurrency(val.paid)}</td>
                                                <td className="px-6 py-4 text-right font-black text-rose-500">{formatCurrency(val.total - val.paid)}</td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                         <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden shadow-inner">
                                                            <div className="bg-orange-500 h-full rounded-full" style={{ width: `${totalMaterialsValue > 0 ? (val.total / totalMaterialsValue) * 100 : 0}%` }}></div>
                                                        </div>
                                                        <span className="text-xs font-bold text-slate-500 w-8">{totalMaterialsValue > 0 ? ((val.total / totalMaterialsValue) * 100).toFixed(0) : 0}%</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Supplier Summary */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-200/60 bg-slate-50/50 flex items-center gap-3">
                                 <span className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">
                                     <span className="material-symbols-outlined notranslate text-[18px]" translate="no">local_shipping</span>
                                 </span>
                                <h3 className="font-bold text-slate-800">Công nợ Nhà Cung cấp Vật tư (Sateco phải trả)</h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-6 bg-slate-50/30">
                                {Object.entries(
                                    materials.reduce((acc, m) => {
                                        if (m.isNew) return acc;
                                        const supplier = m.supplier_name || 'Không xác định';
                                        if (!acc[supplier]) acc[supplier] = { total: 0, paid: 0 };
                                        acc[supplier].total += Number(m.total_amount);
                                        acc[supplier].paid += Number(m.paid_amount);
                                        return acc;
                                    }, {})
                                ).sort((a, b) => (b[1].total - b[1].paid) - (a[1].total - a[1].paid)).map(([supplier, val]) => {
                                    const debt = val.total - val.paid;
                                     return (
                                        <div key={supplier} className="p-5 rounded-xl bg-white border border-slate-200 shadow-sm hover:border-indigo-300 transition-colors group relative overflow-hidden">
                                            {debt > 0 && <div className="absolute top-0 right-0 w-16 h-16 bg-rose-100 rounded-full blur-[24px] opacity-50 group-hover:opacity-100 transition-opacity"></div>}
                                            <div className="flex justify-between items-start mb-3 relative z-10">
                                                <span className="text-xs font-black text-slate-700 uppercase tracking-wide truncate max-w-[120px]">{supplier}</span>
                                                <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-black tracking-widest border ${debt <= 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                                                    {debt <= 0 ? 'Hết nợ' : 'Còn nợ'}
                                                </span>
                                            </div>
                                            <div className={`text-xl font-black tabular-nums tracking-tight relative z-10 ${debt > 0 ? 'text-rose-600' : 'text-slate-800'}`}>{formatCurrency(debt)} <span className="text-xs font-bold opacity-50">₫</span></div>
                                            <div className="text-[11px] font-medium text-slate-400 mt-2 relative z-10 flex justify-between">
                                                 <span>Tổng mua:</span>
                                                 <span className="font-bold text-slate-600">{formatCurrency(val.total)}</span>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className={`bg-white ${embedded ? '' : 'rounded-xl shadow-sm border border-slate-200'} min-w-[max-content] pb-20 ring-1 ring-slate-200/50`}>
                        {/* Mobile Card View */}
                        <div className="block xl:hidden space-y-3 p-4 bg-slate-50/30">
                            {materials.length === 0 ? (
                                <div className="py-10 text-center text-slate-400 font-medium bg-white rounded-xl border border-slate-200 shadow-sm">
                                    Chưa có dữ liệu vật tư
                                </div>
                            ) : materials.map((mat) => {
                                if (editingId === mat.id) return null;
                                return (
                                    <div key={mat.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm relative group animate-slide-up">
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex-1 pr-2">
                                                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1 flex items-center gap-1">
                                                    <span className="material-symbols-outlined text-[12px]">calendar_today</span>
                                                    {formatDate(mat.expense_date)}
                                                </div>
                                                <div className="font-bold text-slate-800 leading-tight text-sm">{mat.product_name}</div>
                                                <div className="flex flex-wrap gap-1.5 mt-2">
                                                    <span className="px-2 py-0.5 rounded bg-orange-50 text-orange-700 text-[10px] font-bold border border-orange-100 uppercase">{mat.item_group}</span>
                                                    <span className="px-2 py-0.5 rounded bg-slate-50 text-slate-500 text-[10px] font-bold border border-slate-200 truncate max-w-[120px]">{mat.supplier_name}</span>
                                                </div>
                                            </div>
                                            <div className="flex gap-1 shrink-0">
                                                <button onClick={() => handleEditClick(mat)} className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center border border-orange-100 shadow-sm active:scale-95 transition-transform">
                                                    <span className="material-symbols-outlined text-[18px]">edit</span>
                                                </button>
                                                <button onClick={() => handleDelete(mat.id)} className="w-8 h-8 rounded-lg bg-slate-50 text-rose-500 flex items-center justify-center border border-slate-200 shadow-sm active:scale-95 transition-transform">
                                                    <span className="material-symbols-outlined text-[18px]">delete</span>
                                                </button>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 mb-3 border-t border-slate-50 pt-3">
                                            <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                                                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Số lượng</div>
                                                <div className="text-sm font-black text-slate-700">{mat.quantity} <span className="text-[10px] font-medium text-slate-400">{mat.unit}</span></div>
                                            </div>
                                            <div className="p-2 rounded-xl bg-orange-50/50 border border-orange-100">
                                                <div className="text-[9px] font-black text-orange-600 uppercase tracking-widest mb-0.5 text-right">Thành tiền</div>
                                                <div className="text-sm font-black text-orange-700 text-right tabular-nums">{formatCurrency(mat.total_amount)}</div>
                                            </div>
                                        </div>

                                        <div className="flex justify-between items-center text-[10px] bg-emerald-50/50 p-2 rounded-lg border border-emerald-100">
                                            <div className="font-bold text-emerald-800 flex items-center gap-1">
                                                <span className="material-symbols-outlined text-[14px]">payments</span>
                                                Sateco Chi: {formatCurrency(mat.paid_amount)}
                                            </div>
                                            <div className={`font-black ${mat.total_amount - mat.paid_amount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                Nợ: {formatCurrency(mat.total_amount - mat.paid_amount)}
                                            </div>
                                        </div>

                                        {mat.notes && (
                                            <p className="mt-3 text-[11px] text-slate-500 italic line-clamp-1 border-t border-slate-50 pt-2 pl-1">
                                                "{mat.notes}"
                                            </p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        <div className="hidden xl:block overflow-x-auto">
                            <table className="w-full text-xs text-left whitespace-nowrap border-collapse">
                                <thead className="bg-[#f8f9fa] text-slate-600 font-bold sticky top-0 z-10 shadow-sm border-b-2 border-slate-300 uppercase tracking-wider text-[10px]">
                                    <tr>
                                        <th className="px-3 py-2.5 w-10 text-center border-r border-slate-200">#</th>
                                        <th className="px-3 py-2.5 w-32 border-r border-slate-200">Phân Nhóm</th>
                                        <th className="px-3 py-2.5 w-28 border-r border-slate-200">Chứng từ (Ngày)</th>
                                        <th className="px-3 py-2.5 w-40 border-r border-slate-200">Nhà Cung Cấp</th>
                                        <th className="px-3 py-2.5 w-56 border-r border-slate-200">Tên SP / Quy Cách</th>
                                        <th className="px-3 py-2.5 w-16 text-center border-r border-slate-200">ĐVT</th>
                                        <th className="px-3 py-2.5 w-24 text-right border-r border-slate-200">SL</th>
                                        <th className="px-3 py-2.5 w-28 text-right border-r border-slate-200">Đơn Giá</th>
                                        <th className="px-3 py-2.5 w-16 text-center border-r border-slate-200 bg-yellow-50 text-yellow-700">VAT (%)</th>
                                        <th className="px-3 py-2.5 w-32 text-right border-r border-slate-200 bg-orange-50 text-orange-700">Thành Tiền (VAT)</th>
                                        <th className="px-3 py-2.5 w-32 text-right border-r border-slate-200 bg-green-50 text-green-700">Sateco Đã Chi</th>
                                        <th className="px-3 py-2.5 w-48 border-r border-slate-200">Diễn giải</th>
                                        <th className="px-3 py-2.5 w-20 text-center bg-slate-100">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {materials.map((mat, index) => {
                                        const isEditing = editingId === mat.id;

                                        if (isEditing) {
                                            return (
                                                <tr key={mat.id} className="bg-orange-50/40 relative z-20 shadow-[0_0_10px_rgba(249,115,22,0.1)] outline outline-1 outline-orange-300">
                                                    <td className="px-2 py-1 text-center border-r border-slate-200 font-bold text-orange-500">{mat.isNew ? '*' : index + 1}</td>
                                                    <td className="px-2 py-1 border-r border-slate-200">
                                                        <input type="text" value={editForm.item_group || ''} onChange={(e) => handleEditChange('item_group', e.target.value)} className="w-full bg-white border border-orange-300 rounded px-2 py-1.5 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all shadow-inner text-xs font-semibold" placeholder="Nhóm..." autoFocus />
                                                    </td>
                                                    <td className="px-2 py-1 border-r border-slate-200">
                                                        <input type="date" value={editForm.expense_date || ''} onChange={(e) => handleEditChange('expense_date', e.target.value)} className="w-full bg-white border border-slate-300 rounded px-1.5 py-1.5 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none text-xs" />
                                                    </td>
                                                    <td className="px-2 py-1 border-r border-slate-200">
                                                        <input type="text" value={editForm.supplier_name || ''} onChange={(e) => handleEditChange('supplier_name', e.target.value)} className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none text-xs" placeholder="Tên NCC..." />
                                                    </td>
                                                    <td className="px-2 py-1 border-r border-slate-200">
                                                        <input type="text" value={editForm.product_name || ''} onChange={(e) => handleEditChange('product_name', e.target.value)} className="w-full bg-white border border-orange-400 rounded px-2 py-1.5 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none font-bold text-orange-700 shadow-inner text-xs" placeholder="Quy cách vật tư..." />
                                                    </td>
                                                    <td className="px-2 py-1 border-r border-slate-200">
                                                        <input type="text" value={editForm.unit || ''} onChange={(e) => handleEditChange('unit', e.target.value)} className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 text-center focus:border-orange-500 outline-none text-xs" placeholder="Cái" />
                                                    </td>
                                                    <td className="px-2 py-1 border-r border-slate-200">
                                                        <input type="number" value={editForm.quantity === 0 ? '' : editForm.quantity} onChange={(e) => handleEditChange('quantity', e.target.value)} className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 text-right font-bold focus:border-orange-500 outline-none text-xs" placeholder="0" />
                                                    </td>
                                                    <td className="px-2 py-1 border-r border-slate-200">
                                                        <input type="number" value={editForm.unit_price === 0 ? '' : editForm.unit_price} onChange={(e) => handleEditChange('unit_price', e.target.value)} className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 text-right font-bold focus:border-orange-500 outline-none text-xs" placeholder="0" />
                                                    </td>
                                                    <td className="px-2 py-1 border-r border-slate-200 bg-yellow-50/50">
                                                        <input type="number" value={editForm.vat_rate === 0 ? '' : editForm.vat_rate} onChange={(e) => handleEditChange('vat_rate', e.target.value)} className="w-full bg-white border border-yellow-400 rounded px-2 py-1.5 text-center focus:border-yellow-500 outline-none text-xs" placeholder="0" />
                                                    </td>
                                                    <td className="px-2 py-1 border-r border-slate-200 bg-orange-50">
                                                        <input type="number" value={editForm.total_amount === 0 ? '' : editForm.total_amount} onChange={(e) => handleEditChange('total_amount', e.target.value)} className="w-full bg-white border border-orange-500 rounded px-2 py-1.5 text-right font-black text-orange-700 shadow-inner outline-none text-xs" placeholder="0" />
                                                    </td>
                                                    <td className="px-2 py-1 border-r border-slate-200 bg-green-50/50">
                                                        <input type="number" value={editForm.paid_amount === 0 ? '' : editForm.paid_amount} onChange={(e) => handleEditChange('paid_amount', e.target.value)} className="w-full bg-white border border-green-400 rounded px-2 py-1.5 text-right font-bold text-green-700 outline-none focus:border-green-500 text-xs" placeholder="0" />
                                                    </td>
                                                    <td className="px-2 py-1 border-r border-slate-200">
                                                        <input type="text" value={editForm.notes || ''} onChange={(e) => handleEditChange('notes', e.target.value)} className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 focus:border-orange-500 outline-none text-xs" placeholder="Ghi chú..." />
                                                    </td>
                                                    <td className="px-2 py-1 text-center bg-slate-50">
                                                        <div className="flex justify-center gap-1.5">
                                                            <button onClick={handleSaveEdit} className="w-7 h-7 flex items-center justify-center bg-orange-600 hover:bg-orange-700 text-white rounded shadow-sm transition-colors" title="Lưu">
                                                                <span className="material-symbols-outlined notranslate text-[16px]" translate="no">check</span>
                                                            </button>
                                                            <button onClick={() => handleCancelEdit(mat.id)} className="w-7 h-7 flex items-center justify-center bg-white border border-slate-300 hover:bg-slate-100 text-slate-600 rounded shadow-sm transition-colors" title="Hủy">
                                                                <span className="material-symbols-outlined notranslate text-[16px]" translate="no">close</span>
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        }

                                        return (
                                            <tr key={mat.id} className="hover:bg-orange-50/20 group transition-colors cursor-default">
                                                <td className="px-3 py-2.5 text-center border-r border-slate-200 text-slate-400 font-medium">{index + 1}</td>
                                                <td className="px-3 py-2.5 border-r border-slate-200">
                                                     <span className="inline-flex px-1.5 py-0.5 rounded bg-slate-100 text-[10px] font-bold text-slate-600 border border-slate-200/60 uppercase">{mat.item_group}</span>
                                                </td>
                                                <td className="px-3 py-2.5 border-r border-slate-200 text-slate-600 font-medium">{formatDate(mat.expense_date)}</td>
                                                <td className="px-3 py-2.5 border-r border-slate-200 font-semibold text-slate-700 truncate max-w-[160px]" title={mat.supplier_name}>{mat.supplier_name}</td>
                                                <td className="px-3 py-2.5 border-r border-slate-200 font-bold text-slate-800">{mat.product_name}</td>
                                                <td className="px-3 py-2.5 border-r border-slate-200 text-center text-slate-500">{mat.unit}</td>
                                                <td className="px-3 py-2.5 border-r border-slate-200 text-right font-medium text-slate-700 tabular-nums">{mat.quantity}</td>
                                                <td className="px-3 py-2.5 border-r border-slate-200 text-right font-medium text-slate-700 tabular-nums">{formatCurrency(mat.unit_price)}</td>
                                                <td className="px-3 py-2.5 border-r border-slate-200 text-center bg-yellow-50/30 text-yellow-700 font-bold">{mat.vat_rate}%</td>
                                                <td className="px-3 py-2.5 border-r border-slate-200 text-right font-black text-orange-600 tabular-nums bg-orange-50/20">{formatCurrency(mat.total_amount)}</td>
                                                <td className="px-3 py-2.5 border-r border-slate-200 text-right font-bold text-green-600 tabular-nums bg-green-50/20">{formatCurrency(mat.paid_amount)}</td>
                                                <td className="px-3 py-2.5 border-r border-slate-200 text-slate-500 truncate max-w-[200px] text-[11px]" title={mat.notes}>{mat.notes}</td>
                                                <td className="px-1.5 py-2.5 text-center border-l bg-slate-50/50">
                                                    <div className="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={() => handleEditClick(mat)} className="w-7 h-7 flex items-center justify-center bg-white border border-slate-200 hover:border-blue-400 text-blue-600 hover:bg-blue-50 rounded shadow-sm transition-all" title="Chỉnh sửa"><span className="material-symbols-outlined notranslate text-[16px]" translate="no">edit</span></button>
                                                        <button onClick={() => handleDelete(mat.id)} className="w-7 h-7 flex items-center justify-center bg-white border border-slate-200 hover:border-rose-400 text-rose-600 hover:bg-rose-50 rounded shadow-sm transition-all" title="Xóa"><span className="material-symbols-outlined notranslate text-[16px]" translate="no">delete</span></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>

        {/* Excel Import Modal */}
        <ExcelImportModal
            isOpen={showImportModal}
            onClose={() => setShowImportModal(false)}
            title="Import Vật Tư Sateco (Excel)"
            tableName="expense_materials"
            columnMapping={MATERIAL_COLUMN_MAPPING}
            templateFilename="mau_vat_tu_sateco.xlsx"
            templateSampleRows={MATERIAL_SAMPLE_ROWS}
            fixedData={{ project_id: project.id }}
            onSuccess={(count) => {
                alert(`Đã import thành công ${count} bản ghi Vật Tư!`);
                fetchMaterials();
            }}
        />
        </>
    );
}
