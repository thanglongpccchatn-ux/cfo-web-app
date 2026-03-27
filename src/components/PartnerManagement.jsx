import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import ExcelImportModal from './ExcelImportModal';

const EMPTY_PARTNER = {
    code: '', name: '', short_name: '', tax_code: '',
    phone: '', email: '', address: '',
    representative: '', representative_title: '',
    bank_name: '', bank_account: '', bank_branch: '', account_holder: '',
    notes: ''
};

export default function PartnerManagement() {
    const [activeTab, setActiveTab] = useState('Client'); // Client, Supplier, Subcontractor
    const [partners, setPartners] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingPartnerId, setEditingPartnerId] = useState(null);
    const [newPartner, setNewPartner] = useState(EMPTY_PARTNER);

    // Excel Import State
    const [isExcelImportModalOpen, setIsExcelImportModalOpen] = useState(false);

    // Mapping cột Excel → cột Supabase (khớp 100% với file Excel mẫu thực tế)
    const partnerMapping = {
        code: "Mã NCC",
        name: "Tên nhà cung cấp",
        short_name: "Tên viết tắt",
        type: "Vai trò",
        tax_code: "Mã số thuế",
        phone: "Điện thoại",
        email: "Email",
        address: "Địa chỉ",
        representative: "Người đại diện",
        representative_title: "Chức vụ",
        bank_name: "Tên Ngân hàng",
        bank_account: "Số TK Ngân hàng",
        bank_branch: "Chi nhánh NH",
        account_holder: "Tên Chủ TK",
        notes: "Ghi chú"
    };

    const handleImportSuccess = (count) => {
        alert(`Đã import thành công ${count} nhà cung cấp (Tab: ${getTabLabel(activeTab)})!`);
        fetchPartners();
    };

    const handleSavePartner = async (e) => {
        e.preventDefault();
        if (!newPartner.name) {
            alert('Vui lòng nhập Tên nhà cung cấp');
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = { ...newPartner };

            // Tự động gán short_name cho code nếu code bị trống
            if (!payload.code && payload.short_name) {
                payload.code = payload.short_name;
            }

            let error;
            if (editingPartnerId) {
                const res = await supabase.from('partners').update(payload).eq('id', editingPartnerId);
                error = res.error;
            } else {
                const res = await supabase.from('partners').insert([{ ...payload, type: activeTab }]);
                error = res.error;
            }

            if (error) throw error;

            setIsModalOpen(false);
            setEditingPartnerId(null);
            setNewPartner(EMPTY_PARTNER);
            fetchPartners();
        } catch (error) {
            console.error('Error saving partner:', error);
            alert('Đã xảy ra lỗi khi lưu: ' + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEdit = (partner) => {
        setNewPartner({
            code: partner.code || '',
            name: partner.name || '',
            short_name: partner.short_name || '',
            tax_code: partner.tax_code || '',
            phone: partner.phone || '',
            email: partner.email || '',
            address: partner.address || '',
            representative: partner.representative || '',
            representative_title: partner.representative_title || '',
            bank_name: partner.bank_name || '',
            bank_account: partner.bank_account || '',
            bank_branch: partner.bank_branch || '',
            account_holder: partner.account_holder || '',
            notes: partner.notes || ''
        });
        setEditingPartnerId(partner.id);
        setIsModalOpen(true);
    };

    const handleDelete = async (id, name) => {
        if (window.confirm(`Bạn có chắc chắn muốn xóa "${name}" không?\nLưu ý: Thao tác này có thể bị từ chối nếu đã được gắn vào hợp đồng.`)) {
            try {
                const { error } = await supabase.from('partners').delete().eq('id', id);
                if (error) throw error;
                fetchPartners();
            } catch (error) {
                console.error('Lỗi khi xóa đối tác:', error);
                alert('Có lỗi xảy ra. Khả năng NCC này đang được sử dụng ở hợp đồng nào đó nên không thể xóa.');
            }
        }
    };

    async function fetchPartners() {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('partners')
                .select('*')
                .eq('type', activeTab)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setPartners(data || []);
        } catch (error) {
            console.error('Error fetching partners:', error);
            alert('Không thể tải danh sách nhà cung cấp.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchPartners();
    }, [activeTab]);

    const filteredPartners = partners.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.code && p.code.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.short_name && p.short_name.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const getTabLabel = (type) => {
        switch (type) {
            case 'Client': return 'Chủ Đầu Tư';
            case 'Supplier': return 'Nhà Cung Cấp';
            case 'Subcontractor': return 'Tổ Đội / Thầu Phụ';
            default: return type;
        }
    };

    const inp = "w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition";

    return (
        <div className="space-y-6">
            {/* Header section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Danh mục Nhà Cung Cấp</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Quản lý chủ đầu tư, nhà cung cấp và thầu phụ thi công
                    </p>
                </div>
                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 md:gap-3 w-full md:w-auto">
                    <div className="relative">
                        <span className="material-symbols-outlined notranslate absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]" translate="no">search</span>
                        <input
                            type="text"
                            placeholder="Tìm kiếm nhà cung cấp..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="h-10 pl-10 pr-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm w-full md:w-64"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setIsExcelImportModalOpen(true)}
                            className="h-10 flex-1 md:flex-none flex items-center justify-center gap-2 px-4 bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 text-xs md:text-sm font-semibold rounded-xl border border-emerald-200 dark:border-emerald-500/30 hover:bg-emerald-50 hover:border-emerald-300 dark:hover:bg-emerald-500/10 active:scale-95 transition-all shadow-sm"
                        >
                            <span className="material-symbols-outlined notranslate text-[18px]" translate="no">upload_file</span>
                            Import Excel
                        </button>
                        <button
                            onClick={() => {
                                setEditingPartnerId(null);
                                setNewPartner(EMPTY_PARTNER);
                                setIsModalOpen(true);
                            }}
                            className="h-10 flex-1 md:flex-none flex items-center justify-center gap-2 px-4 bg-primary text-white text-xs md:text-sm font-semibold rounded-xl hover:bg-primary-hover active:scale-95 transition-all shadow-sm"
                        >
                            <span className="material-symbols-outlined notranslate text-[18px]" translate="no">add</span>
                            Thêm NCC
                        </button>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700">
                {['Client', 'Supplier', 'Subcontractor'].map((type) => (
                    <button
                        key={type}
                        onClick={() => setActiveTab(type)}
                        className={`px-4 py-3 text-sm font-medium transition-colors relative ${activeTab === type
                            ? 'text-primary'
                            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
                            }`}
                    >
                        {getTabLabel(type)}
                        {activeTab === type && (
                            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary rounded-t-full"></div>
                        )}
                    </button>
                ))}
            </div>

            {/* Data Table */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="whitespace-nowrap">
                            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
                                <th className="p-4 w-28">Mã NCC</th>
                                <th className="p-4">Tên NCC / Người đại diện</th>
                                <th className="p-4">Mã số thuế</th>
                                <th className="p-4">Thông tin Ngân hàng</th>
                                <th className="p-4">Trạng thái</th>
                                <th className="p-4 w-24 text-right">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                            {isLoading ? (
                                <tr>
                                    <td colSpan="6" className="p-8 text-center text-slate-500">
                                        <div className="flex items-center justify-center gap-2">
                                            <span className="material-symbols-outlined notranslate animate-spin" translate="no">progress_activity</span>
                                            Đang tải dữ liệu...
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredPartners.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="p-8 text-center text-slate-500">
                                        Chưa có dữ liệu {getTabLabel(activeTab).toLowerCase()}.
                                    </td>
                                </tr>
                            ) : (
                                filteredPartners.map((partner) => (
                                    <tr key={partner.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                        <td className="p-4">
                                            <div className="text-sm font-bold text-slate-900 dark:text-white uppercase">{partner.code || partner.short_name || '-'}</div>
                                            {partner.short_name && partner.code && <div className="text-xs text-slate-400 mt-0.5">{partner.short_name}</div>}
                                        </td>
                                        <td className="p-4">
                                            <div className="font-semibold text-slate-900 dark:text-white">{partner.name}</div>
                                            {partner.representative && (
                                                <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                                                    <span className="material-symbols-outlined notranslate text-[12px]" translate="no">person</span>
                                                    {partner.representative}
                                                    {partner.representative_title && <span className="text-slate-400">• {partner.representative_title}</span>}
                                                </div>
                                            )}
                                            {partner.phone && <div className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400 mt-0.5"><span className="material-symbols-outlined notranslate text-[12px]" translate="no">call</span> {partner.phone}</div>}
                                            {partner.email && <div className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400 mt-0.5"><span className="material-symbols-outlined notranslate text-[12px]" translate="no">mail</span> {partner.email}</div>}
                                        </td>
                                        <td className="p-4 text-sm font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                            {partner.tax_code || '-'}
                                        </td>
                                        <td className="p-4 text-sm text-slate-600 dark:text-slate-300">
                                            {partner.bank_name || partner.bank_account ? (
                                                <div className="flex flex-col gap-0.5">
                                                    {partner.bank_name && <span className="font-semibold text-slate-800 dark:text-slate-200">{partner.bank_name}</span>}
                                                    {partner.bank_account && <span className="font-mono text-emerald-600 dark:text-emerald-400 font-medium">{partner.bank_account}</span>}
                                                    <div className="text-xs text-slate-500 mt-0.5 space-y-0.5">
                                                        {partner.account_holder && <div>CTK: {partner.account_holder}</div>}
                                                        {partner.bank_branch && <div>CN: {partner.bank_branch}</div>}
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="text-slate-400 italic">Chưa cập nhật</span>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                                {partner.status || 'Hoạt động'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right whitespace-nowrap">
                                            <div className="flex items-center justify-end gap-1">
                                                <button
                                                    onClick={() => handleEdit(partner)}
                                                    className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                                                    title="Chỉnh sửa"
                                                >
                                                    <span className="material-symbols-outlined notranslate text-[20px]" translate="no">edit</span>
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(partner.id, partner.name)}
                                                    className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                                                    title="Xóa"
                                                >
                                                    <span className="material-symbols-outlined notranslate text-[20px]" translate="no">delete</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add/Edit Partner Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-fade-in max-h-[90vh] flex flex-col">
                        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between shrink-0">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                {editingPartnerId ? `Cập nhật ${getTabLabel(activeTab)}` : `Thêm ${getTabLabel(activeTab)} Mới`}
                            </h3>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                            >
                                <span className="material-symbols-outlined notranslate" translate="no">close</span>
                            </button>
                        </div>
                        <form onSubmit={handleSavePartner} className="p-6 overflow-y-auto space-y-4">

                            {/* --- THÔNG TIN CƠ BẢN --- */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Mã NCC</label>
                                    <input type="text" value={newPartner.code}
                                        onChange={e => setNewPartner({ ...newPartner, code: e.target.value })}
                                        className={inp} placeholder="VD: KH001, NCC001" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tên viết tắt</label>
                                    <input type="text" value={newPartner.short_name}
                                        onChange={e => setNewPartner({ ...newPartner, short_name: e.target.value })}
                                        className={inp} placeholder="VD: HOANG VINH" />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tên nhà cung cấp <span className="text-red-500">*</span></label>
                                    <input type="text" value={newPartner.name}
                                        onChange={e => setNewPartner({ ...newPartner, name: e.target.value })}
                                        required className={inp} placeholder="Tên đầy đủ công ty hoặc cá nhân" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Mã số thuế</label>
                                    <input type="text" value={newPartner.tax_code}
                                        onChange={e => setNewPartner({ ...newPartner, tax_code: e.target.value })}
                                        className={inp} placeholder="VD: 0107020866" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Điện thoại</label>
                                    <input type="tel" value={newPartner.phone}
                                        onChange={e => setNewPartner({ ...newPartner, phone: e.target.value })}
                                        className={inp} placeholder="VD: 0915 503 570" />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
                                    <input type="email" value={newPartner.email}
                                        onChange={e => setNewPartner({ ...newPartner, email: e.target.value })}
                                        className={inp} placeholder="VD: contact@company.com" />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Địa chỉ</label>
                                    <input type="text" value={newPartner.address}
                                        onChange={e => setNewPartner({ ...newPartner, address: e.target.value })}
                                        className={inp} placeholder="Địa chỉ công ty hoặc văn phòng" />
                                </div>
                            </div>

                            {/* --- NGƯỜI ĐẠI DIỆN --- */}
                            <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
                                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">Người đại diện</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Họ và tên</label>
                                        <input type="text" value={newPartner.representative}
                                            onChange={e => setNewPartner({ ...newPartner, representative: e.target.value })}
                                            className={inp} placeholder="VD: Nguyễn Văn A" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Chức vụ</label>
                                        <input type="text" value={newPartner.representative_title}
                                            onChange={e => setNewPartner({ ...newPartner, representative_title: e.target.value })}
                                            className={inp} placeholder="VD: Tổng giám đốc, Giám đốc" />
                                    </div>
                                </div>
                            </div>

                            {/* --- TÀI KHOẢN NGÂN HÀNG --- */}
                            <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
                                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">Tài khoản Ngân hàng</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tên Ngân hàng</label>
                                        <input type="text" value={newPartner.bank_name}
                                            onChange={e => setNewPartner({ ...newPartner, bank_name: e.target.value })}
                                            className={inp} placeholder="VD: Vietcombank, Techcombank" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Số tài khoản</label>
                                        <input type="text" value={newPartner.bank_account}
                                            onChange={e => setNewPartner({ ...newPartner, bank_account: e.target.value })}
                                            className={inp} placeholder="VD: 1012345678" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Chi nhánh NH</label>
                                        <input type="text" value={newPartner.bank_branch}
                                            onChange={e => setNewPartner({ ...newPartner, bank_branch: e.target.value })}
                                            className={inp} placeholder="VD: Chi nhánh Hà Nội, CN Đống Đa" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tên Chủ tài khoản</label>
                                        <input type="text" value={newPartner.account_holder}
                                            onChange={e => setNewPartner({ ...newPartner, account_holder: e.target.value })}
                                            className={inp} placeholder="VD: NGUYEN VAN A" />
                                    </div>
                                </div>
                            </div>

                            {/* --- GHI CHÚ --- */}
                            <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Ghi chú thêm</label>
                                <input type="text" value={newPartner.notes}
                                    onChange={e => setNewPartner({ ...newPartner, notes: e.target.value })}
                                    className={inp} placeholder="Ghi chú bổ sung nếu cần..." />
                            </div>

                            <div className="pt-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="px-6 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-hover active:scale-95 transition-all shadow-sm disabled:opacity-50 flex items-center gap-2"
                                >
                                    {isSubmitting && <span className="material-symbols-outlined notranslate animate-spin text-[18px]" translate="no">progress_activity</span>}
                                    {editingPartnerId ? 'Cập nhật' : 'Lưu NCC'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <ExcelImportModal
                isOpen={isExcelImportModalOpen}
                onClose={() => setIsExcelImportModalOpen(false)}
                title={`Nhập Danh Sách ${getTabLabel(activeTab)}`}
                tableName="partners"
                columnMapping={partnerMapping}
                templateFilename={`mau_ncc_${activeTab.toLowerCase()}.xlsx`}
                templateSampleRows={[
                    ['ZYF', 'CÔNG TY TNHH XÂY DỰNG ZYF VIỆT NAM', 'ZYF', 'Client', '0105720857', '107572897', '', 'Tòa nhà 22, Lô 4D KCN 102 Hà Nội', 'CHEN JING BO', 'Tổng giám đốc', 'INDUSTRIAL AND CO', '1270001000011000', 'CN Hà Nội', 'CHEN JING BO', ''],
                    ['HOANGVINH', 'CÔNG TY CỔ PHẦN HOÀNG VINH', 'HOÀNG VINH', 'Supplier', '0104987600', '0380.937760', '', 'Số 5, Tổ 7, P. Trần Đức Hoàng, Nam Định', 'C HOÀNG VINH', 'Giám đốc', 'Ngân hàng Vietinbank', '114403713959', 'CN Nam Định', 'C HOÀNG VINH', ''],
                ]}
                onSuccess={handleImportSuccess}
                fixedData={{ type: activeTab }}
            />
        </div>
    );
}
