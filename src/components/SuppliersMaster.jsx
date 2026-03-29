import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import ExcelImportModal from './ExcelImportModal';
import { useToast } from '../context/ToastContext';
import MaterialTracking from './MaterialTracking';
import { smartToast } from '../utils/globalToast';

const EMPTY_LINE = () => ({ _key: Date.now() + Math.random(), materialId: '', productName: '', unit: 'Cái', quantity: '', unitPrice: '', vatRate: '8', notes: '', _showSuggestions: false });

export default function SuppliersMaster() {
    const [activeSubTab, setActiveSubTab] = useState('suppliers');
    const [suppliersData, setSuppliersData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [showPurchaseModal, setShowPurchaseModal] = useState(false);
    const [showAddSupplierInline, setShowAddSupplierInline] = useState(false);
    const [newSupplier, setNewSupplier] = useState({ code: '', name: '', phone: '' });
    const [projects, setProjects] = useState([]);
    const [materialsCatalog, setMaterialsCatalog] = useState([]);
    const toast = useToast();

    // --- Open PO states ---
    const [expandedSupplierId, setExpandedSupplierId] = useState(null);
    const [supplierPOs, setSupplierPOs] = useState([]);
    const [loadingPOs, setLoadingPOs] = useState(false);
    const [showReceiveModal, setShowReceiveModal] = useState(false);
    const [receivePO, setReceivePO] = useState(null);
    const [receiveLines, setReceiveLines] = useState([]);
    const [submitting, setSubmitting] = useState(false);

    const [purchaseHeader, setPurchaseHeader] = useState({
        supplierId: '', projectId: '', expenseDate: new Date().toISOString().split('T')[0]
    });
    const [purchaseLines, setPurchaseLines] = useState([EMPTY_LINE()]);

    const fmt = (v) => v ? Number(v).toLocaleString('vi-VN') : '0';
    const formatBillion = (val) => (val / 1000000000).toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' Tỷ';

    // Định nghĩa cấu hình Import cho Nhà cung cấp
    const supplierMapping = {
        code: "Mã NCC",
        name: "Tên nhà cung cấp",
        tax_code: "Mã số thuế",
        contact_person: "Người liên hệ",
        phone: "Số điện thoại",
        email: "Email",
        address: "Địa chỉ",
        bank_account: "Số tài khoản",
        bank_name: "Ngân hàng",
        bank_branch: "Chi nhánh",
        account_holder: "Chủ tài khoản"
    };

    useEffect(() => {
        fetchSuppliersData();
        fetchProjects();
        fetchMaterialsCatalog();
    }, []);

    async function fetchProjects() {
        const { data } = await supabase.from('projects').select('id, name, code, internal_code').order('created_at', { ascending: false });
        setProjects(data || []);
    };

    async function fetchMaterialsCatalog() {
        const { data } = await supabase.from('materials').select('id, code, name, unit, base_price, category_code, brand').order('name');
        setMaterialsCatalog(data || []);
    };

    async function fetchSuppliersData() {
        setLoading(true);
        // 1. Tải danh mục NCC
        const { data: suppliers, error: supError } = await supabase
            .from('suppliers')
            .select('*')
            .order('name', { ascending: true });

        if (supError) {
            console.error("Lỗi tải NCC:", supError);
            setLoading(false);
            return;
        }

        // 2. Tải tất cả PO để tính "Tổng Mua (Kế hoạch/Đặt hàng)"
        const { data: pos, error: _poError } = await supabase
            .from('purchase_orders')
            .select('supplier_id, total_amount, project_id');
        
        // 3. Tải tất cả Thực nhận & Thanh toán (expense_materials)
        const { data: materials, error: _matError } = await supabase
            .from('expense_materials')
            .select('supplier_id, total_amount, paid_amount, project_id');

        // Aggregate
        const supplierAgg = {};
        (suppliers || []).forEach(s => {
            supplierAgg[s.id] = { 
                ...s, 
                totalOrdered: 0,   // Tổng tiền đã đặt (PO)
                totalValue: 0,     // Tổng tiền thực nhận (Bản chất là Received)
                totalPaid: 0,      // Tổng tiền đã trả
                projectIds: new Set() 
            };
        });

        // Tính tổng Đặt hàng
        (pos || []).forEach(po => {
            if (po.supplier_id && supplierAgg[po.supplier_id]) {
                supplierAgg[po.supplier_id].totalOrdered += Number(po.total_amount || 0);
                if (po.project_id) supplierAgg[po.supplier_id].projectIds.add(po.project_id);
            }
        });

        // Tính tổng Thực nhận & Thanh toán
        (materials || []).forEach(mat => {
            if (mat.supplier_id && supplierAgg[mat.supplier_id]) {
                supplierAgg[mat.supplier_id].totalValue += Number(mat.total_amount || 0);
                supplierAgg[mat.supplier_id].totalPaid += Number(mat.paid_amount || 0);
                if (mat.project_id) supplierAgg[mat.supplier_id].projectIds.add(mat.project_id);
            }
        });

        const sArray = Object.values(supplierAgg).map(s => ({
            ...s,
            totalDebt: s.totalValue - s.totalPaid,
            projectCount: s.projectIds ? s.projectIds.size : 0
        }));

        setSuppliersData(sArray);
        setLoading(false);
    };

    const handleImportSuccess = (count) => {
        smartToast(`Đã import thành công ${count} nhà cung cấp!`);
        fetchSuppliersData();
    };

    // --- Line item helpers ---
    const updateLine = (key, field, value) => {
        setPurchaseLines(prev => prev.map(l => l._key === key ? { ...l, [field]: field === 'quantity' || field === 'unitPrice' ? value.replace(/[^0-9]/g, '') : value } : l));
    };

    const handleSelectMaterial = (key, mat) => {
        setPurchaseLines(prev => prev.map(l => l._key === key ? { ...l, materialId: mat.id, productName: mat.name, unit: mat.unit || 'Cái', unitPrice: String(mat.base_price || ''), _showSuggestions: false } : l));
    };

    const handleProductNameChange = (key, value) => {
        setPurchaseLines(prev => prev.map(l => l._key === key ? { ...l, productName: value, materialId: '', _showSuggestions: value.length > 0 } : l));
    };

    const hideSuggestions = (key) => {
        setTimeout(() => setPurchaseLines(prev => prev.map(l => l._key === key ? { ...l, _showSuggestions: false } : l)), 150);
    };

    const addLine = () => setPurchaseLines(prev => [...prev, EMPTY_LINE()]);
    const removeLine = (key) => setPurchaseLines(prev => prev.length > 1 ? prev.filter(l => l._key !== key) : prev);

    const calcLineTotal = (l) => { const q = Number(l.quantity)||0, p = Number(l.unitPrice)||0, v = Number(l.vatRate)||0; const b = q*p; return b + b*v/100; };
    const orderTotal = purchaseLines.reduce((s, l) => s + calcLineTotal(l), 0);

    // --- Add NCC inline ---
    async function handleAddSupplierInline() {
        if (!newSupplier.name) { toast.error('Nhập tên NCC'); return; }
        const code = newSupplier.code || newSupplier.name.split(' ').map(w => w[0]).join('').toUpperCase();
        const { data, error } = await supabase.from('suppliers').insert([{ code, name: newSupplier.name, phone: newSupplier.phone }]).select().single();
        if (error) { toast.error('Lỗi: ' + error.message); return; }
        toast.success('Đã thêm NCC: ' + data.name);
        setShowAddSupplierInline(false);
        setNewSupplier({ code: '', name: '', phone: '' });
        await fetchSuppliersData();
        setPurchaseHeader(prev => ({ ...prev, supplierId: data.id }));
    };

    // --- Submit PO (Open PO — Cách 1) ---
    const handlePurchaseSubmit = async (e) => {
        e.preventDefault();
        const validLines = purchaseLines.filter(l => l.productName && Number(l.quantity) > 0);
        if (!validLines.length) { toast.error('Thêm ít nhất 1 vật tư với SL > 0'); return; }
        if (!purchaseHeader.supplierId) { toast.error('Chọn nhà cung cấp'); return; }
        setSubmitting(true);
        try {
            const poNum = `PO-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Date.now().toString().slice(-4)}`;
            const { data: po, error: poErr } = await supabase.from('purchase_orders').insert([{
                po_number: poNum,
                supplier_id: purchaseHeader.supplierId,
                project_id: purchaseHeader.projectId || null,
                order_date: purchaseHeader.expenseDate,
                status: 'ordered',
                total_amount: orderTotal,
                notes: ''
            }]).select().single();
            if (poErr) throw poErr;

            const linePayloads = validLines.map(l => ({
                po_id: po.id,
                material_id: l.materialId || null,
                product_name: l.productName,
                unit: l.unit,
                ordered_qty: Number(l.quantity) || 0,
                received_qty: 0,
                unit_price: Number(l.unitPrice) || 0,
                vat_rate: Number(l.vatRate) || 0,
                notes: l.notes || ''
            }));
            const { error: lineErr } = await supabase.from('purchase_order_lines').insert(linePayloads);
            if (lineErr) { await supabase.from('purchase_orders').delete().eq('id', po.id); throw lineErr; }

            toast.success(`Đã tạo đơn ${poNum} — ${validLines.length} dòng vật tư`);
            setShowPurchaseModal(false);
            setPurchaseHeader({ supplierId: '', projectId: '', expenseDate: new Date().toISOString().split('T')[0] });
            setPurchaseLines([EMPTY_LINE()]);
            fetchSuppliersData();
        } catch (err) {
            toast.error('Lỗi: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    // --- Fetch POs for a supplier (expandable row) ---
    const toggleSupplierPOs = async (supplierId) => {
        if (expandedSupplierId === supplierId) { setExpandedSupplierId(null); return; }
        setExpandedSupplierId(supplierId);
        setLoadingPOs(true);
        const { data } = await supabase
            .from('purchase_orders')
            .select('*, purchase_order_lines(*)')
            .eq('supplier_id', supplierId)
            .order('created_at', { ascending: false });
        setSupplierPOs(data || []);
        setLoadingPOs(false);
    };

    // --- Open Receive Modal ---
    const openReceiveModal = (po) => {
        const lines = (po.purchase_order_lines || []).filter(l => l.ordered_qty > l.received_qty).map(l => ({
            ...l, receiveQty: l.ordered_qty - l.received_qty
        }));
        if (!lines.length) { toast.error('PO này đã nhận đủ hàng'); return; }
        setReceivePO(po);
        setReceiveLines(lines);
        setShowReceiveModal(true);
    };

    // --- Submit Receive Goods ---
    async function handleReceiveSubmit() {
        const toReceive = receiveLines.filter(l => Number(l.receiveQty) > 0);
        if (!toReceive.length) { toast.error('Nhập SL nhận > 0'); return; }
        setSubmitting(true);
        try {
            const supplier = suppliersData.find(s => s.id === receivePO.supplier_id);
            for (const line of toReceive) {
                const qty = Number(line.receiveQty);
                const newReceived = Number(line.received_qty) + qty;
                await supabase.from('purchase_order_lines').update({ received_qty: newReceived }).eq('id', line.id);
                // Insert expense_materials for cost tracking
                const lineTotal = qty * Number(line.unit_price) * (1 + Number(line.vat_rate) / 100);
                await supabase.from('expense_materials').insert([{
                    project_id: receivePO.project_id,
                    supplier_id: receivePO.supplier_id,
                    supplier_name: supplier?.name || '',
                    item_group: 'Vật tư chính',
                    product_name: line.product_name,
                    unit: line.unit,
                    quantity: qty,
                    unit_price: Number(line.unit_price),
                    vat_rate: Number(line.vat_rate),
                    total_amount: lineTotal,
                    paid_amount: 0,
                    expense_date: new Date().toISOString().split('T')[0],
                    notes: `Nhận từ ${receivePO.po_number}`
                }]);
            }
            // Update PO status
            const { data: updatedLines } = await supabase.from('purchase_order_lines').select('*').eq('po_id', receivePO.id);
            const allDone = (updatedLines || []).every(l => Number(l.received_qty) >= Number(l.ordered_qty));
            await supabase.from('purchase_orders').update({ status: allDone ? 'completed' : 'partial' }).eq('id', receivePO.id);

            toast.success(`Đã nhận hàng ${toReceive.length} dòng — PO ${allDone ? 'hoàn tất ✅' : 'giao một phần'}`);
            setShowReceiveModal(false);
            toggleSupplierPOs(receivePO.supplier_id);
            fetchSuppliersData();
        } catch (err) {
            toast.error('Lỗi nhận hàng: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const PO_STATUS = { draft: 'Nháp', ordered: 'Đã đặt', partial: 'Giao 1 phần', completed: 'Hoàn tất', cancelled: 'Đã hủy' };
    const PO_STATUS_COLOR = { draft: 'bg-slate-100 text-slate-600', ordered: 'bg-blue-100 text-blue-700', partial: 'bg-amber-100 text-amber-700', completed: 'bg-emerald-100 text-emerald-700', cancelled: 'bg-red-100 text-red-600' };

    const filteredSuppliers = suppliersData.filter(s => 
        (s.name && s.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (s.code && s.code.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const globalTotalOrdered = suppliersData.reduce((acc, s) => acc + (s.totalOrdered || 0), 0);
    const globalTotalValue = suppliersData.reduce((acc, s) => acc + (s.totalValue || 0), 0);
    const globalTotalPaid = suppliersData.reduce((acc, s) => acc + (s.totalPaid || 0), 0);
    const globalTotalDebt = globalTotalValue - globalTotalPaid;

    if (loading) {
        return <div className="p-12 text-center text-slate-500 animate-pulse">Đang tải dữ liệu Sổ cái Nhà cung cấp...</div>;
    }

    return (
        <div className="pb-10 animate-fade-in text-slate-900 dark:text-slate-100">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2 tracking-tight">
                        <span className="material-symbols-outlined notranslate text-orange-500 text-[28px]" translate="no">local_shipping</span>
                        Nhà Cung Cấp & Vật Tư
                    </h2>
                    <p className="text-slate-500 text-sm mt-1 uppercase font-semibold tracking-wider">Quản lý đối tác và nhật ký nhập vật tư hiện trường</p>
                </div>
                {activeSubTab === 'suppliers' && (
                    <div className="flex gap-3">
                        <button 
                            onClick={() => setShowPurchaseModal(true)}
                            className="p-2.5 px-4 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-bold flex items-center gap-2 transition-all shadow-md shadow-orange-200"
                        >
                            <span className="material-symbols-outlined notranslate" translate="no">add_shopping_cart</span>
                            Nhập đơn mua hàng
                        </button>
                        <button 
                            onClick={() => setIsImportModalOpen(true)}
                            className="p-2.5 px-4 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-500/20 font-semibold border border-emerald-200 dark:border-emerald-500/20 flex items-center gap-2 transition-all shadow-sm"
                        >
                            <span className="material-symbols-outlined notranslate" translate="no">upload_file</span>
                            Import Excel
                        </button>
                        <button onClick={fetchSuppliersData} className="p-2.5 bg-white dark:bg-[#1e293b] text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm border border-slate-200 dark:border-slate-700 flex items-center">
                            <span className="material-symbols-outlined notranslate" translate="no">refresh</span>
                        </button>
                    </div>
                )}
            </div>

            {/* Sub-tabs Navigation */}
            <div className="flex space-x-1 border-b border-slate-200 dark:border-slate-700 mb-6">
                <button
                    onClick={() => setActiveSubTab('suppliers')}
                    className={`px-5 py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeSubTab === 'suppliers' ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
                >
                    <span className="material-symbols-outlined notranslate text-[18px]" translate="no">local_shipping</span>
                    Sổ cái Công nợ NCC
                </button>
                <button
                    onClick={() => setActiveSubTab('materials')}
                    className={`px-5 py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeSubTab === 'materials' ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
                >
                    <span className="material-symbols-outlined notranslate text-[18px]" translate="no">inventory_2</span>
                    Nhật ký Nhập Vật tư
                </button>
            </div>

            {activeSubTab === 'materials' ? (
                <div className="h-[calc(100vh-220px)] relative">
                    <MaterialTracking embedded={true} />
                </div>
            ) : (
                <>

            {/* Global KPIs */}
            <div className="flex flex-col lg:flex-row gap-6 mb-8">
                <div className="flex-1 bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 border border-slate-700 shadow-lg relative overflow-hidden">
                    <div className="absolute -right-4 -top-4 opacity-10">
                        <span className="material-symbols-outlined notranslate text-[120px] text-white" translate="no">warehouse</span>
                    </div>
                    <div className="relative z-10 flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center shrink-0 border border-white/20">
                            <span className="material-symbols-outlined notranslate text-white text-[32px]" translate="no">dataset</span>
                        </div>
                        <div>
                            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Tổng Số lượng NCC</p>
                            <p className="text-4xl font-black text-white">{suppliersData.length}</p>
                        </div>
                    </div>
                </div>

                <div className="flex-[3] bg-white dark:bg-[#1e293b] rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-around divide-x divide-slate-100 dark:divide-slate-800">
                    <div className="px-6 text-center">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Tổng đặt hàng (PO)</p>
                        <p className="text-2xl font-black text-slate-700 dark:text-white">{formatBillion(globalTotalOrdered)}</p>
                    </div>
                    <div className="px-6 text-center">
                        <p className="text-[11px] font-bold text-blue-600 uppercase tracking-widest mb-2">Thực nhận (Vật tư)</p>
                        <p className="text-2xl font-black text-blue-600">{formatBillion(globalTotalValue)}</p>
                    </div>
                    <div className="px-6 text-center">
                        <p className="text-[11px] font-bold text-green-600 uppercase tracking-widest mb-2">Đã thanh toán</p>
                        <p className="text-2xl font-black text-green-600">{formatBillion(globalTotalPaid)}</p>
                    </div>
                    <div className="px-6 text-center">
                        <p className="text-[11px] font-bold text-red-500 uppercase tracking-widest mb-2">Còn nợ NCC</p>
                        <p className="text-2xl font-black text-red-500">{formatBillion(globalTotalDebt)}</p>
                    </div>
                </div>
            </div>

            {/* Supplier List */}
            <div className="bg-white dark:bg-[#1e293b] rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/30">
                    <h3 className="font-bold text-sm text-slate-700 dark:text-slate-300">Danh sách Nhà cung cấp</h3>
                    <div className="relative w-80">
                        <span className="material-symbols-outlined notranslate absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]" translate="no">search</span>
                        <input
                            type="text"
                            placeholder="Tìm mã hoặc tên Nhà cung cấp..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 pr-4 py-2 w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    {filteredSuppliers.length === 0 ? (
                        <div className="text-center py-16 text-slate-400">
                            <span className="material-symbols-outlined notranslate text-4xl block mb-2 opacity-50" translate="no">search_off</span>
                            <p>Chưa có dữ liệu, vui lòng Import Excel.</p>
                        </div>
                    ) : (
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 dark:bg-slate-900/80 text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                                <tr>
                                    <th className="px-6 py-4 rounded-tl-xl w-16 text-center">Mã NCC</th>
                                    <th className="px-6 py-4 min-w-[200px]">Tên Nhà cung cấp</th>
                                    <th className="px-6 py-4">Liên hệ</th>
                                    <th className="px-6 py-4 text-center">Tham gia (Dự án)</th>
                                    <th className="px-6 py-4 text-right">Tổng Đặt Hàng</th>
                                    <th className="px-6 py-4 text-right">Thực Nhận</th>
                                    <th className="px-6 py-4 text-right">Đã Thanh Toán</th>
                                    <th className="px-6 py-4 text-right">Còn Nợ</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                {filteredSuppliers.map((supplier) => {
                                    const isExpanded = expandedSupplierId === supplier.id;
                                    return (
                                        <React.Fragment key={supplier.id}>
                                        <tr onClick={() => toggleSupplierPOs(supplier.id)} className={`cursor-pointer group transition-colors ${isExpanded ? 'bg-orange-50/50 dark:bg-orange-500/5' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                                            <td className="px-6 py-4 text-center">
                                                <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded text-xs font-mono font-bold">
                                                    {supplier.code}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200">
                                                <div className="flex items-center gap-2">
                                                    <span className={`material-symbols-outlined notranslate text-[16px] text-orange-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} translate="no">chevron_right</span>
                                                    <div>
                                                        <div>{supplier.name}</div>
                                                        {supplier.tax_code && <div className="text-[10px] text-slate-400 font-normal mt-0.5">MST: {supplier.tax_code}</div>}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-[12px] text-slate-600 dark:text-slate-400">
                                                <div>{supplier.contact_person} {supplier.phone && `- ${supplier.phone}`}</div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-bold">
                                                    {supplier.projectCount}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right font-medium text-slate-500 dark:text-slate-400">
                                                {fmt(supplier.totalOrdered)} ₫
                                            </td>
                                            <td className="px-6 py-4 text-right font-bold text-blue-600">
                                                {fmt(supplier.totalValue)} ₫
                                            </td>
                                            <td className="px-6 py-4 text-right text-green-600 font-semibold">
                                                {fmt(supplier.totalPaid)} ₫
                                            </td>
                                            <td className="px-6 py-4 text-right font-black text-red-500">
                                                {fmt(supplier.totalDebt)} ₫
                                            </td>
                                        </tr>
                                        {/* Expandable PO History */}
                                        {isExpanded && (
                                            <tr>
                                                <td colSpan="7" className="p-0">
                                                    <div className="bg-orange-50/30 dark:bg-slate-900/50 px-8 py-5 border-y border-orange-200/40 dark:border-slate-700">
                                                        <div className="flex items-center justify-between mb-3">
                                                            <h4 className="text-xs font-extrabold text-orange-700 dark:text-orange-400 uppercase tracking-wider flex items-center gap-2">
                                                                <span className="material-symbols-outlined notranslate text-[16px]" translate="no">receipt_long</span>
                                                                Đơn mua hàng — {supplier.name}
                                                            </h4>
                                                        </div>
                                                        {loadingPOs ? (
                                                            <div className="text-center py-4 text-slate-400 text-xs animate-pulse">Đang tải...</div>
                                                        ) : supplierPOs.length === 0 ? (
                                                            <div className="text-center py-4 text-slate-400 text-xs italic">Chưa có đơn mua nào</div>
                                                        ) : (
                                                            <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-800">
                                                                <table className="w-full text-xs text-left">
                                                                    <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                                                                        <tr>
                                                                            <th className="px-4 py-2.5">Mã PO</th>
                                                                            <th className="px-4 py-2.5">Ngày đặt</th>
                                                                            <th className="px-4 py-2.5">Dự án</th>
                                                                            <th className="px-4 py-2.5 text-right">Tổng PO</th>
                                                                            <th className="px-4 py-2.5 text-center">Vật tư</th>
                                                                            <th className="px-4 py-2.5 text-center">Trạng thái</th>
                                                                            <th className="px-4 py-2.5 text-center">Thao tác</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                                                        {supplierPOs.map(po => {
                                                                            const proj = projects.find(p => p.id === po.project_id);
                                                                            const lines = po.purchase_order_lines || [];
                                                                            const totalOrdered = lines.reduce((s, l) => s + Number(l.ordered_qty), 0);
                                                                            const totalReceived = lines.reduce((s, l) => s + Number(l.received_qty), 0);
                                                                            return (
                                                                                <React.Fragment key={po.id}>
                                                                                <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                                                                    <td className="px-4 py-2.5 font-mono font-bold text-blue-600">{po.po_number}</td>
                                                                                    <td className="px-4 py-2.5 text-slate-500">{po.order_date}</td>
                                                                                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">{proj?.name || proj?.code || '-'}</td>
                                                                                    <td className="px-4 py-2.5 text-right font-bold">{fmt(po.total_amount)} ₫</td>
                                                                                    <td className="px-4 py-2.5 text-center">
                                                                                        <span className="text-[10px] font-bold">{totalReceived}/{totalOrdered}</span>
                                                                                    </td>
                                                                                    <td className="px-4 py-2.5 text-center">
                                                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${PO_STATUS_COLOR[po.status] || ''}`}>
                                                                                            {PO_STATUS[po.status] || po.status}
                                                                                        </span>
                                                                                    </td>
                                                                                    <td className="px-4 py-2.5 text-center">
                                                                                        {po.status !== 'completed' && po.status !== 'cancelled' && (
                                                                                            <button onClick={(e) => { e.stopPropagation(); openReceiveModal(po); }} className="px-3 py-1 bg-emerald-500 text-white text-[10px] font-bold rounded-lg hover:bg-emerald-600 transition-colors">
                                                                                                Nhận hàng
                                                                                            </button>
                                                                                        )}
                                                                                    </td>
                                                                                </tr>
                                                                                {/* PO Line details */}
                                                                                <tr>
                                                                                    <td colSpan="7" className="px-4 pb-2 pt-0">
                                                                                        <div className="flex flex-wrap gap-x-6 gap-y-1 pl-4 border-l-2 border-orange-200 dark:border-orange-500/30">
                                                                                            {lines.map(l => (
                                                                                                <div key={l.id} className="text-[10px] text-slate-500 flex items-center gap-1.5">
                                                                                                    <span className="font-semibold text-slate-700 dark:text-slate-300">{l.product_name}</span>
                                                                                                    <span>•</span>
                                                                                                    <span className={Number(l.received_qty) >= Number(l.ordered_qty) ? 'text-emerald-600 font-bold' : 'text-amber-600 font-bold'}>
                                                                                                        {l.received_qty}/{l.ordered_qty} {l.unit}
                                                                                                    </span>
                                                                                                </div>
                                                                                            ))}
                                                                                        </div>
                                                                                    </td>
                                                                                </tr>
                                                                                </React.Fragment>
                                                                            );
                                                                        })}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
            </>
            )}

            <ExcelImportModal 
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                title="Nhập Dữ Liệu Nhà Cung Cấp"
                tableName="suppliers"
                columnMapping={supplierMapping}
                onSuccess={handleImportSuccess}
            />

            {/* Modal Nhập đơn mua hàng — Smart Version */}
            {showPurchaseModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && setShowPurchaseModal(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden border border-slate-200/50 flex flex-col max-h-[92vh]">
                        {/* Header */}
                        <div className="px-8 py-5 bg-gradient-to-r from-orange-50 to-amber-50/30 border-b border-slate-100 flex justify-between items-start shrink-0">
                            <div>
                                <div className="flex items-center gap-2 text-slate-400 text-[10px] mb-1.5 uppercase tracking-widest font-bold">
                                    <span>Nhà cung cấp</span>
                                    <span className="material-symbols-outlined text-[12px]">chevron_right</span>
                                    <span className="text-orange-700">Nhập đơn mua hàng</span>
                                </div>
                                <h3 className="text-2xl font-extrabold text-slate-800 tracking-tight">Ghi nhận đơn mua hàng</h3>
                            </div>
                            <button onClick={() => setShowPurchaseModal(false)} className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                                <span className="material-symbols-outlined notranslate text-[20px]" translate="no">close</span>
                            </button>
                        </div>

                        <form onSubmit={handlePurchaseSubmit} className="flex flex-col flex-1 overflow-hidden">
                            {/* Top: NCC + Dự án + Ngày */}
                            <div className="px-8 py-5 grid grid-cols-3 gap-5 shrink-0 border-b border-slate-100 bg-white">
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <label className="block text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Nhà cung cấp</label>
                                        <button type="button" onClick={() => setShowAddSupplierInline(true)} className="text-[10px] text-orange-600 font-bold hover:underline flex items-center gap-0.5">
                                            <span className="material-symbols-outlined notranslate text-[12px]" translate="no">add_circle</span> Thêm mới
                                        </button>
                                    </div>
                                    <select required value={purchaseHeader.supplierId} onChange={(e) => setPurchaseHeader({...purchaseHeader, supplierId: e.target.value})} className="w-full bg-slate-50 border-none rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-orange-500 font-semibold">
                                        <option value="">Chọn NCC...</option>
                                        {suppliersData.map(s => <option key={s.id} value={s.id}>[{s.code}] {s.name}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Dự án</label>
                                    <select required value={purchaseHeader.projectId} onChange={(e) => setPurchaseHeader({...purchaseHeader, projectId: e.target.value})} className="w-full bg-slate-50 border-none rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-orange-500">
                                        <option value="">Chọn dự án...</option>
                                        {projects.map(p => <option key={p.id} value={p.id}>{p.internal_code || p.code} — {p.name}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Ngày mua</label>
                                    <input type="date" required value={purchaseHeader.expenseDate} onChange={(e) => setPurchaseHeader({...purchaseHeader, expenseDate: e.target.value})} className="w-full bg-slate-50 border-none rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-orange-500" />
                                </div>
                            </div>

                            {/* Line items table */}
                            <div className="flex-1 overflow-y-auto px-8 py-4">
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                        <span className="material-symbols-outlined notranslate text-[16px] text-orange-500" translate="no">list_alt</span>
                                        Danh sách vật tư ({purchaseLines.length} dòng)
                                    </h4>
                                    <button type="button" onClick={addLine} className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1 bg-orange-50 hover:bg-orange-100 px-3 py-1.5 rounded-lg transition-colors">
                                        <span className="material-symbols-outlined notranslate text-[16px]" translate="no">add</span> Thêm dòng
                                    </button>
                                </div>
                                <div className="rounded-xl border border-slate-200 overflow-hidden">
                                    <table className="w-full text-xs text-left">
                                        <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                                            <tr>
                                                <th className="px-2 py-2.5 w-8 text-center">#</th>
                                                <th className="px-2 py-2.5 min-w-[250px]">Tên vật tư</th>
                                                <th className="px-2 py-2.5 w-16 text-center">ĐVT</th>
                                                <th className="px-2 py-2.5 w-24 text-right">Số lượng</th>
                                                <th className="px-2 py-2.5 w-28 text-right">Đơn giá</th>
                                                <th className="px-2 py-2.5 w-14 text-center">VAT%</th>
                                                <th className="px-2 py-2.5 w-28 text-right text-blue-600">Thành tiền</th>
                                                <th className="px-2 py-2.5 w-36">Ghi chú</th>
                                                <th className="px-2 py-2.5 w-10"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {purchaseLines.map((line, idx) => (
                                                <tr key={line._key} className="hover:bg-orange-50/30 group transition-colors">
                                                    <td className="px-2 py-2 text-center text-slate-400 font-bold">{idx + 1}</td>
                                                    <td className="px-2 py-2 relative">
                                                        <input
                                                            placeholder="Gõ tìm vật tư..."
                                                            value={line.productName}
                                                            onChange={(e) => handleProductNameChange(line._key, e.target.value)}
                                                            onFocus={() => setPurchaseLines(prev => prev.map(l => l._key === line._key ? { ...l, _showSuggestions: l.productName.length > 0 } : l))}
                                                            onBlur={() => hideSuggestions(line._key)}
                                                            className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-orange-400 focus:border-orange-400 outline-none font-semibold"
                                                        />
                                                        {line._showSuggestions && (() => {
                                                            const q = line.productName.toLowerCase();
                                                            const matches = materialsCatalog.filter(m => m.name.toLowerCase().includes(q) || (m.code && m.code.toLowerCase().includes(q)));
                                                            return matches.length > 0 ? (
                                                                <div className="absolute left-2 right-2 top-full z-30 bg-white border border-slate-200 rounded-lg shadow-xl max-h-48 overflow-y-auto mt-0.5">
                                                                    {matches.slice(0, 12).map(m => (
                                                                        <button key={m.id} type="button" onMouseDown={() => handleSelectMaterial(line._key, m)} className="w-full text-left px-3 py-2 text-xs hover:bg-orange-50 flex items-center gap-2 border-b border-slate-50 last:border-0 transition-colors">
                                                                            <span className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px] font-mono font-bold text-slate-500 shrink-0">{m.code}</span>
                                                                            <span className="font-semibold text-slate-800 truncate">{m.name}</span>
                                                                            {m.brand && <span className="text-[10px] text-slate-400 shrink-0">{m.brand}</span>}
                                                                            <span className="ml-auto text-[10px] text-orange-500 font-bold shrink-0">{m.unit} • {fmt(m.base_price)}₫</span>
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            ) : null;
                                                        })()}
                                                    </td>
                                                    <td className="px-2 py-2">
                                                        <input value={line.unit} onChange={(e) => updateLine(line._key, 'unit', e.target.value)} className="w-full bg-white border border-slate-200 rounded px-1.5 py-1.5 text-center text-xs focus:ring-1 focus:ring-orange-400 outline-none" />
                                                    </td>
                                                    <td className="px-2 py-2">
                                                        <input placeholder="0" value={line.quantity ? fmt(line.quantity) : ''} onChange={(e) => updateLine(line._key, 'quantity', e.target.value)} className="w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-right font-bold text-xs focus:ring-1 focus:ring-orange-400 outline-none" />
                                                    </td>
                                                    <td className="px-2 py-2">
                                                        <input placeholder="0" value={line.unitPrice ? fmt(line.unitPrice) : ''} onChange={(e) => updateLine(line._key, 'unitPrice', e.target.value)} className="w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-right font-bold text-xs focus:ring-1 focus:ring-orange-400 outline-none" />
                                                    </td>
                                                    <td className="px-2 py-2">
                                                        <input value={line.vatRate} onChange={(e) => updateLine(line._key, 'vatRate', e.target.value)} className="w-full bg-yellow-50 border border-yellow-200 rounded px-1.5 py-1.5 text-center font-bold text-yellow-700 text-xs focus:ring-1 focus:ring-yellow-400 outline-none" />
                                                    </td>
                                                    <td className="px-2 py-2 text-right font-black text-blue-700 text-xs tabular-nums">{fmt(calcLineTotal(line))}</td>
                                                    <td className="px-2 py-2">
                                                        <input placeholder="Ghi chú..." value={line.notes || ''} onChange={(e) => updateLine(line._key, 'notes', e.target.value)} className="w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-orange-400 outline-none" />
                                                    </td>
                                                    <td className="px-1 py-2 text-center">
                                                        {purchaseLines.length > 1 && (
                                                            <button type="button" onClick={() => removeLine(line._key)} className="w-6 h-6 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100">
                                                                <span className="material-symbols-outlined notranslate text-[16px]" translate="no">close</span>
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Footer: Total + Buttons */}
                            <div className="px-8 py-4 border-t border-slate-200 bg-slate-50/60 flex justify-between items-center shrink-0">
                                <div className="flex items-center gap-6">
                                    <div className="text-xs text-slate-500 uppercase font-bold tracking-wider">Tổng đơn hàng</div>
                                    <div className="text-2xl font-black text-orange-700 tabular-nums">{fmt(orderTotal)} ₫</div>
                                </div>
                                <div className="flex gap-3">
                                    <button type="button" onClick={() => setShowPurchaseModal(false)} className="px-6 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Hủy bỏ</button>
                                    <button type="submit" disabled={submitting} className={`px-8 py-2.5 bg-gradient-to-br from-orange-600 to-orange-700 text-white text-sm font-bold rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-2 ${submitting ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}`}>
                                        <span className="material-symbols-outlined notranslate text-[18px]" translate="no">{submitting ? 'hourglass_top' : 'save'}</span>
                                        {submitting ? 'Đang tạo PO...' : `Tạo đơn (${purchaseLines.filter(l => l.productName).length} dòng)`}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Inline Add Supplier Mini-Modal */}
            {showAddSupplierInline && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50 backdrop-blur-[2px]">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-fade-in">
                        <h4 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800">
                            <span className="material-symbols-outlined notranslate text-orange-500" translate="no">person_add</span>
                            Thêm Nhà cung cấp mới
                        </h4>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Tên NCC <span className="text-red-500">*</span></label>
                                <input value={newSupplier.name} onChange={(e) => setNewSupplier({...newSupplier, name: e.target.value})} className="w-full bg-slate-50 border-none rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-orange-500 font-semibold" placeholder="VD: Công ty TNHH ABC" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Mã NCC</label>
                                    <input value={newSupplier.code} onChange={(e) => setNewSupplier({...newSupplier, code: e.target.value})} className="w-full bg-slate-50 border-none rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-orange-500 font-mono" placeholder="Tự tạo" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">SĐT</label>
                                    <input value={newSupplier.phone} onChange={(e) => setNewSupplier({...newSupplier, phone: e.target.value})} className="w-full bg-slate-50 border-none rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-orange-500" placeholder="09..." />
                                </div>
                            </div>
                        </div>
                        <div className="mt-5 flex justify-end gap-2">
                            <button onClick={() => setShowAddSupplierInline(false)} className="px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 rounded-lg">Hủy</button>
                            <button onClick={handleAddSupplierInline} className="px-6 py-2 text-sm font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-lg shadow-md active:scale-95 transition-all">Lưu NCC</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Nhận hàng */}
            {showReceiveModal && receivePO && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && setShowReceiveModal(false)}>
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
                            <button onClick={() => setShowReceiveModal(false)} className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
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
                                <button onClick={() => setShowReceiveModal(false)} className="px-6 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Hủy</button>
                                <button
                                    onClick={handleReceiveSubmit}
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
            )}
        </div>
    );
}
