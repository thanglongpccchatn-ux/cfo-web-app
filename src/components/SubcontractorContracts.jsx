import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { fmt, formatInputNumber } from '../utils/formatters';
import SearchableSelect from './SearchableSelect';

// ─── STATUS CONFIG ─────────────────────────────────────────────────────────
const STATUS_MAP = {
    'Đang thực hiện': { bg: 'bg-blue-100', text: 'text-blue-700', icon: 'engineering', dot: 'bg-blue-500' },
    'Hoàn thành': { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: 'check_circle', dot: 'bg-emerald-500' },
    'Thanh lý': { bg: 'bg-slate-200', text: 'text-slate-600', icon: 'cancel', dot: 'bg-slate-400' },
    'Tạm dừng': { bg: 'bg-amber-100', text: 'text-amber-700', icon: 'pause_circle', dot: 'bg-amber-500' },
};

const TYPE_STYLES = {
    'Tổ đội': { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-200' },
    'Thầu phụ': { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200' },
};

const SYSTEM_CODES = [
    { value: 'CT', label: 'CT — Cải tạo' },
    { value: 'FA', label: 'FA — HT báo cháy, exit, âm thanh' },
    { value: 'PAINT', label: 'PAINT — Sơn chống cháy' },
    { value: 'FF', label: 'FF — HT chữa cháy' },
    { value: 'PCCC', label: 'PCCC — HT PCCC' },
    { value: 'TAHK', label: 'TAHK — HT tăng áp hút khói' },
    { value: 'E', label: 'E — HT điện' },
    { value: 'XD', label: 'XD — Xây dựng' },
];

// ─── AUTO-DETECT: tên bắt đầu "Công ty" → Thầu phụ (VAT 8%), còn lại → Tổ đội (0%)
function detectContractType(partnerName) {
    if (!partnerName) return { type: 'Tổ đội', vat: '0' };
    const normalized = partnerName.toLowerCase().trim();
    if (normalized.startsWith('công ty') || normalized.startsWith('cong ty')) {
        return { type: 'Thầu phụ', vat: '8' };
    }
    return { type: 'Tổ đội', vat: '0' };
}

// ─── AUTO-GEN CONTRACT CODE ────────────────────────────────────────────────
// Format: ddMM/yyyy/HĐTC/STC-[MÃ NHÀ THẦU]/[MÃ DỰ ÁN NỘI BỘ]/[HỆ THỐNG]
function generateContractCode({ partner, project, systemCode, date }) {
    if (!partner || !project || !systemCode) return '';
    const d = date ? new Date(date) : new Date();
    const dd = String(d.getDate()).padStart(2, '0');
    const MM = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const partnerCode = partner.code || partner.short_name || '';
    const projectCode = project.internal_code || project.code || '';
    return `${dd}${MM}/${yyyy}/HĐTC/STC-${partnerCode}/${projectCode}/${systemCode}`;
}

// ─── CREATE/EDIT MODAL ─────────────────────────────────────────────────────
function ContractModal({ isOpen, onClose, onSuccess, editData, partners, projects }) {
    const [form, setForm] = useState(() => editData ? {
        partnerId: editData.partner_id,
        projectId: editData.project_id,
        contractCode: editData.contract_code || '',
        contractName: editData.contract_name || '',
        contractType: editData.contract_type || 'Tổ đội',
        contractValue: String(editData.contract_value || ''),
        vatRate: String(editData.vat_rate || 0),
        invoicedAmount: String(editData.invoiced_amount || 0),
        scopeOfWork: editData.scope_of_work || '',
        systemCode: editData.system_code || '',
        startDate: editData.start_date || '',
        endDate: editData.end_date || '',
        warrantyMonths: String(editData.warranty_months || 0),
        status: editData.status || 'Đang thực hiện',
        notes: editData.notes || '',
    } : {
        partnerId: '',
        projectId: '',
        contractCode: '',
        contractName: '',
        contractType: 'Tổ đội',
        contractValue: '',
        vatRate: '0',
        invoicedAmount: '0',
        scopeOfWork: '',
        systemCode: '',
        startDate: new Date().toISOString().split('T')[0],
        endDate: '',
        warrantyMonths: '12',
        status: 'Đang thực hiện',
        notes: '',
    });
    const [submitting, setSubmitting] = useState(false);

    // Helper: rebuild contract code whenever partner/project/system/date changes
    const rebuildCode = (overrides = {}) => {
        const merged = { ...form, ...overrides };
        const partner = partners.find(p => p.id === merged.partnerId);
        const project = projects.find(p => p.id === merged.projectId);
        return generateContractCode({ partner, project, systemCode: merged.systemCode, date: merged.startDate });
    };

    // Auto-detect type when partner changes
    const handlePartnerChange = (partnerId) => {
        const partner = partners.find(p => p.id === partnerId);
        const partnerName = partner?.name || '';
        const { type, vat } = detectContractType(partnerName);
        const code = rebuildCode({ partnerId });
        setForm(prev => ({ ...prev, partnerId, contractType: type, vatRate: vat, contractCode: code }));
    };

    const handleProjectChange = (projectId) => {
        const code = rebuildCode({ projectId });
        setForm(prev => ({ ...prev, projectId, contractCode: code }));
    };

    const handleSystemChange = (systemCode) => {
        const code = rebuildCode({ systemCode });
        setForm(prev => ({ ...prev, systemCode, contractCode: code }));
    };

    const handleDateChange = (startDate) => {
        const code = rebuildCode({ startDate });
        setForm(prev => ({ ...prev, startDate, contractCode: code }));
    };

    const handleNumChange = (field, value) => {
        const clean = value.replace(/[^0-9.]/g, '');
        setForm(prev => ({ ...prev, [field]: clean }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.partnerId || !form.projectId || !form.contractName) {
            alert('Vui lòng điền đầy đủ: Thầu phụ, Dự án, Nội dung HĐ.');
            return;
        }
        setSubmitting(true);

        const payload = {
            partner_id: form.partnerId,
            project_id: form.projectId,
            contract_code: form.contractCode || null,
            contract_name: form.contractName,
            contract_type: form.contractType,
            contract_value: Number(form.contractValue) || 0,
            vat_rate: Number(form.vatRate) || 0,
            invoiced_amount: Number(form.invoicedAmount) || 0,
            scope_of_work: form.scopeOfWork || null,
            system_code: form.systemCode || null,
            start_date: form.startDate || null,
            end_date: form.endDate || null,
            warranty_months: Number(form.warrantyMonths) || 0,
            status: form.status,
            notes: form.notes || null,
        };

        let error;
        if (editData) {
            ({ error } = await supabase.from('subcontractor_contracts').update(payload).eq('id', editData.id));
        } else {
            ({ error } = await supabase.from('subcontractor_contracts').insert([payload]));
        }
        setSubmitting(false);

        if (error) {
            alert('Lỗi: ' + error.message);
        } else {
            onSuccess?.();
            onClose();
        }
    };

    if (!isOpen) return null;

    const vatAmount = (Number(form.contractValue) || 0) * (Number(form.vatRate) || 0) / 100;
    const totalWithVat = (Number(form.contractValue) || 0) + vatAmount;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-200/50 animate-slide-up">
                {/* Header */}
                <div className="px-8 py-5 bg-gradient-to-r from-indigo-50 via-white to-purple-50 border-b border-slate-100 relative overflow-hidden">
                    <div className="absolute -right-8 -top-8 w-32 h-32 bg-indigo-100 rounded-full opacity-30 blur-2xl"></div>
                    <div className="relative z-10">
                        <h3 className="text-xl font-extrabold text-slate-800 flex items-center gap-3">
                            <span className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600 border border-indigo-200 shadow-sm">
                                <span className="material-symbols-outlined text-[22px]">{editData ? 'edit_note' : 'add_circle'}</span>
                            </span>
                            {editData ? 'Chỉnh sửa Hợp đồng' : 'Tạo Hợp đồng mới'}
                        </h3>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="px-8 py-6 space-y-5 max-h-[65vh] overflow-y-auto custom-scrollbar">
                    {/* Row 1: Thầu phụ + Dự án */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-2">
                            <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                                <span className="material-symbols-outlined text-[13px] align-middle mr-1 text-purple-500">group</span>
                                Nhà thầu / Tổ đội <span className="text-rose-500">*</span>
                            </label>
                            <SearchableSelect
                                value={form.partnerId}
                                onChange={handlePartnerChange}
                                placeholder="Gõ tên thầu phụ..."
                                options={partners.map(s => ({
                                    value: s.id,
                                    label: s.short_name || s.code || s.name,
                                    sub: s.name !== (s.short_name || s.code) ? s.name : undefined
                                }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                                <span className="material-symbols-outlined text-[13px] align-middle mr-1 text-indigo-500">domain</span>
                                Dự án <span className="text-rose-500">*</span>
                            </label>
                            <SearchableSelect
                                value={form.projectId}
                                onChange={handleProjectChange}
                                placeholder="Gõ mã dự án..."
                                options={projects.map(p => ({
                                    value: p.id,
                                    label: p.internal_code || p.code,
                                    sub: p.name
                                }))}
                            />
                        </div>
                    </div>

                    {/* Row 2: Phân loại (auto) + Hệ thống */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        <div className="space-y-2">
                            <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Phân loại (tự động)</label>
                            <div className={`w-full rounded-xl px-4 py-3 text-sm font-bold flex items-center gap-2 border ${
                                form.contractType === 'Thầu phụ'
                                    ? 'bg-purple-50 border-purple-200 text-purple-700'
                                    : 'bg-amber-50 border-amber-200 text-amber-700'
                            }`}>
                                <span>{form.contractType === 'Thầu phụ' ? '🏗️' : '👷'}</span>
                                {form.contractType}
                                <span className="ml-auto text-[10px] font-medium opacity-60">
                                    {form.contractType === 'Thầu phụ' ? `VAT ${form.vatRate}%` : 'Không thuế'}
                                </span>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                                <span className="material-symbols-outlined text-[13px] align-middle mr-1 text-blue-500">category</span>
                                Hệ thống <span className="text-rose-500">*</span>
                            </label>
                            <SearchableSelect
                                value={form.systemCode}
                                onChange={handleSystemChange}
                                placeholder="Chọn hệ thống..."
                                options={SYSTEM_CODES}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                                Nội dung HĐ <span className="text-rose-500">*</span>
                            </label>
                            <input
                                required
                                placeholder="VD: TC phần điện Block A"
                                value={form.contractName}
                                onChange={(e) => setForm({ ...form, contractName: e.target.value })}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            />
                        </div>
                    </div>

                    {/* Row 2b: Số HĐ (auto-generated) */}
                    <div className="space-y-2">
                        <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                            Số HĐ (tự động)
                        </label>
                        <div className={`w-full rounded-xl px-4 py-3 text-sm font-mono font-bold border ${
                            form.contractCode
                                ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                                : 'bg-slate-100 border-slate-200 text-slate-400 italic'
                        }`}>
                            {form.contractCode || 'Chọn Nhà thầu + Dự án + Hệ thống để tạo số HĐ'}
                        </div>
                    </div>

                    {/* Row 3: GT HĐ + VAT + Tổng (và Tiền hóa đơn nếu là Thầu phụ) */}
                    <div className="p-5 bg-gradient-to-r from-indigo-50/70 to-purple-50/70 rounded-xl border border-indigo-200/60">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                            <div className="space-y-2">
                                <label className="block text-[11px] font-extrabold text-indigo-600 uppercase tracking-wider">
                                    GT Trước thuế <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    required
                                    placeholder="Nhập số tiền..."
                                    value={form.contractValue ? formatInputNumber(form.contractValue) : ''}
                                    onChange={(e) => handleNumChange('contractValue', e.target.value)}
                                    className="w-full bg-white border border-indigo-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:font-normal"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="block text-[11px] font-extrabold text-indigo-600 uppercase tracking-wider">
                                    % VAT <span className="text-indigo-400 normal-case font-medium">(= {fmt(vatAmount)})</span>
                                </label>
                                <input
                                    disabled={form.contractType === 'Tổ đội'}
                                    value={form.vatRate}
                                    onChange={(e) => handleNumChange('vatRate', e.target.value)}
                                    className={`w-full border rounded-xl px-4 py-3 text-sm font-bold text-right outline-none transition-all ${
                                        form.contractType === 'Tổ đội' ? 'bg-amber-50 border-amber-200 text-amber-600' : 'bg-white border-indigo-200 text-indigo-700 focus:ring-2 focus:ring-indigo-500'
                                    }`}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="block text-[11px] font-extrabold text-emerald-600 uppercase tracking-wider">
                                    GT Sau thuế
                                </label>
                                <div className="w-full bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm font-black text-emerald-700 text-right">
                                    {fmt(totalWithVat)}
                                </div>
                            </div>
                            {form.contractType === 'Thầu phụ' ? (
                                <div className="space-y-2">
                                    <label className="block text-[11px] font-extrabold text-amber-600 uppercase tracking-wider" title="Chỉ nhập khi đã có hóa đơn từ Thầu phụ">
                                        Tiền xuất hóa đơn
                                    </label>
                                    <input
                                        placeholder="Nhập số tiền HĐ..."
                                        value={form.invoicedAmount ? formatInputNumber(form.invoicedAmount) : ''}
                                        onChange={(e) => handleNumChange('invoicedAmount', e.target.value)}
                                        className="w-full bg-white border border-amber-300 rounded-xl px-4 py-3 text-sm font-bold text-amber-700 focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                                    />
                                </div>
                            ) : (
                                <div></div>
                            )}
                        </div>
                    </div>

                    {/* Row 4: Ngày + Bảo hành + Trạng thái */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                        <div className="space-y-2">
                            <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Ngày HĐ</label>
                            <input type="date" value={form.startDate} onChange={(e) => handleDateChange(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
                        </div>
                        <div className="space-y-2">
                            <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Ngày kết thúc</label>
                            <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
                        </div>
                        <div className="space-y-2">
                            <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Bảo hành (tháng)</label>
                            <input
                                type="number" min="0" placeholder="12"
                                value={form.warrantyMonths}
                                onChange={(e) => setForm({ ...form, warrantyMonths: e.target.value })}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-center font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Tình trạng</label>
                            <SearchableSelect
                                value={form.status}
                                onChange={(val) => setForm({ ...form, status: val })}
                                direction="up"
                                options={[
                                    { value: 'Đang thực hiện', label: '🔵 Đang thực hiện' },
                                    { value: 'Hoàn thành', label: '🟢 Hoàn thành' },
                                    { value: 'Tạm dừng', label: '🟡 Tạm dừng' },
                                    { value: 'Thanh lý', label: '⚪ Thanh lý' },
                                ]}
                            />
                        </div>
                    </div>

                    {/* Row 5: Phạm vi + Ghi chú */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-2">
                            <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Phạm vi công việc</label>
                            <input
                                placeholder="VD: Thi công hệ thống M&E Block A"
                                value={form.scopeOfWork}
                                onChange={(e) => setForm({ ...form, scopeOfWork: e.target.value })}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Ghi chú</label>
                            <input
                                placeholder="Ghi chú hợp đồng..."
                                value={form.notes}
                                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            />
                        </div>
                    </div>
                </form>

                {/* Footer */}
                <div className="px-8 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
                    <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors">
                        Hủy bỏ
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-lg flex items-center gap-2 transition-all disabled:opacity-50"
                    >
                        <span className="material-symbols-outlined text-[18px]">{editData ? 'save' : 'add'}</span>
                        {submitting ? 'Đang lưu...' : (editData ? 'Cập nhật' : 'Tạo hợp đồng')}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── PAYMENT PROGRESS CELL ────────────────────────────────────────────────
// Shows a colored progress dot for a payment stage
function StageCell({ amount, total }) {
    if (!total || total <= 0) return <td className="px-2 py-3 text-center text-slate-300 text-xs">—</td>;
    const pct = total > 0 ? Math.min((amount / total) * 100, 100) : 0;
    const color = pct >= 100 ? 'text-emerald-600 bg-emerald-50' : pct > 0 ? 'text-blue-600 bg-blue-50' : 'text-slate-400';
    return (
        <td className="px-2 py-3 text-center">
            {amount > 0 ? (
                <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${color}`}>
                    {fmt(amount)}
                </div>
            ) : (
                <span className="text-slate-300 text-xs">—</span>
            )}
        </td>
    );
}

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────
export default function SubcontractorContracts() {
    const queryClient = useQueryClient();
    const [modalOpen, setModalOpen] = useState(false);
    const [editData, setEditData] = useState(null);
    const [filterStatus, setFilterStatus] = useState('all');
    const [searchText, setSearchText] = useState('');
    const [expandedContract, setExpandedContract] = useState(null);
    const [variationForm, setVariationForm] = useState({ description: '', value: '', notes: '' });
    const [addingVariation, setAddingVariation] = useState(false);

    // Fetch contracts with partner + project info
    const { data: contracts = [], isLoading } = useQuery({
        queryKey: ['subcontractor-contracts'],
        queryFn: async () => {
            const { data } = await supabase
                .from('subcontractor_contracts')
                .select('*, partners:partner_id(id, code, name, short_name), projects:project_id(id, code, name, internal_code)')
                .order('created_at', { ascending: false });
            return data || [];
        },
    });

    // Fetch payment summary per contract (aggregate from expense_labor)
    const { data: paymentSummary = {} } = useQuery({
        queryKey: ['contract-payment-summary'],
        queryFn: async () => {
            const { data } = await supabase
                .from('expense_labor')
                .select('project_id, team_name, requested_amount, paid_amount, status');
            if (!data) return {};
            // Group by project+team
            const map = {};
            data.forEach(r => {
                if (r.status === 'REJECTED') return;
                const key = `${r.project_id}|${r.team_name}`;
                if (!map[key]) map[key] = { requested: 0, paid: 0 };
                map[key].requested += (r.requested_amount || 0);
                map[key].paid += (r.paid_amount || 0);
            });
            return map;
        },
    });

    // Fetch variations for all contracts
    const { data: allVariations = [] } = useQuery({
        queryKey: ['subcontractor-variations'],
        queryFn: async () => {
            const { data } = await supabase
                .from('subcontractor_variations')
                .select('*')
                .order('created_at', { ascending: false });
            return data || [];
        },
    });

    // Group variations by contract_id
    const variationsByContract = allVariations.reduce((acc, v) => {
        if (!acc[v.contract_id]) acc[v.contract_id] = [];
        acc[v.contract_id].push(v);
        return acc;
    }, {});

    // Fetch partners & projects for modal
    const { data: partners = [] } = useQuery({
        queryKey: ['partners-subcontractor-dropdown'],
        queryFn: async () => {
            const { data } = await supabase.from('partners').select('id, code, name, short_name').eq('type', 'Subcontractor').order('name');
            return data || [];
        },
    });
    const { data: projects = [] } = useQuery({
        queryKey: ['projects-dropdown-contracts'],
        queryFn: async () => {
            const { data } = await supabase.from('projects').select('id, code, name, internal_code').order('internal_code');
            return data || [];
        },
    });

    const handleRefresh = () => {
        queryClient.invalidateQueries({ queryKey: ['subcontractor-contracts'] });
        queryClient.invalidateQueries({ queryKey: ['contract-payment-summary'] });
        queryClient.invalidateQueries({ queryKey: ['subcontractor-variations'] });
    };
    const handleEdit = (c) => { setEditData(c); setModalOpen(true); };
    const handleDelete = async (id) => {
        if (!confirm('Xóa hợp đồng này?')) return;
        await supabase.from('subcontractor_contracts').delete().eq('id', id);
        handleRefresh();
    };

    // Add variation to a contract
    const handleAddVariation = async (contractId) => {
        if (!variationForm.description || !variationForm.value) {
            alert('Vui lòng nhập nội dung và giá trị phát sinh.');
            return;
        }
        setAddingVariation(true);
        const count = (variationsByContract[contractId] || []).length + 1;
        const { error } = await supabase.from('subcontractor_variations').insert([{
            contract_id: contractId,
            variation_code: `PS-${String(count).padStart(3, '0')}`,
            description: variationForm.description,
            variation_value: Number(variationForm.value.replace(/[^0-9]/g, '')) || 0,
            notes: variationForm.notes,
            status: 'Chờ duyệt'
        }]);
        setAddingVariation(false);
        if (error) { alert('Lỗi: ' + error.message); return; }
        setVariationForm({ description: '', value: '', notes: '' });
        handleRefresh();
    };

    // Approve/reject variation
    const handleVariationAction = async (variationId, action) => {
        await supabase.from('subcontractor_variations')
            .update({ status: action, approved_date: action === 'Đã duyệt' ? new Date().toISOString().split('T')[0] : null })
            .eq('id', variationId);
        handleRefresh();
    };

    const handleDeleteVariation = async (id) => {
        if (!confirm('Xóa phát sinh này?')) return;
        await supabase.from('subcontractor_variations').delete().eq('id', id);
        handleRefresh();
    };

    // Get payment data for a contract
    const getPayments = (c) => {
        const teamName = c.partners?.short_name || c.partners?.code || c.partners?.name;
        const key = `${c.project_id}|${teamName}`;
        return paymentSummary[key] || { requested: 0, paid: 0 };
    };

    // Filter
    const filtered = contracts.filter(c => {
        if (filterStatus !== 'all' && c.status !== filterStatus) return false;
        if (searchText) {
            const q = searchText.toLowerCase();
            const match = [c.contract_code, c.contract_name, c.partners?.name, c.partners?.code, c.partners?.short_name, c.projects?.internal_code, c.projects?.name]
                .some(f => f?.toLowerCase().includes(q));
            if (!match) return false;
        }
        return true;
    });

    // KPIs
    const totalValue = contracts.reduce((s, c) => s + (c.contract_value || 0), 0);
    const totalWithVat = contracts.reduce((s, c) => s + ((c.contract_value || 0) * (1 + (c.vat_rate || 0) / 100)), 0);
    const activeCount = contracts.filter(c => c.status === 'Đang thực hiện').length;
    const totalPaid = contracts.reduce((s, c) => s + (getPayments(c).paid || 0), 0);

    return (
        <div className="flex flex-col h-full">
            {/* KPIs */}
            <div className="flex flex-wrap gap-3 mb-4">
                {[
                    { label: 'Tổng HĐ', value: contracts.length, color: 'slate', isMoney: false },
                    { label: 'Đang thực hiện', value: activeCount, color: 'blue', isMoney: false },
                    { label: 'GT trước thuế', value: totalValue, color: 'indigo', isMoney: true },
                    { label: 'GT sau thuế', value: totalWithVat, color: 'purple', isMoney: true },
                    { label: 'Đã thanh toán', value: totalPaid, color: 'emerald', isMoney: true },
                ].map(kpi => (
                    <div key={kpi.label} className={`flex-1 min-w-[130px] bg-white rounded-xl p-3.5 border border-${kpi.color}-200 shadow-sm`}>
                        <div className={`text-[10px] font-bold text-${kpi.color}-400 uppercase tracking-wider`}>{kpi.label}</div>
                        <div className={`text-${kpi.isMoney ? 'base' : '2xl'} font-black text-${kpi.color}-700 mt-1`}>
                            {kpi.isMoney ? fmt(kpi.value) : kpi.value}
                        </div>
                    </div>
                ))}
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="relative">
                        <span className="material-symbols-outlined text-[16px] text-slate-400 absolute left-3 top-1/2 -translate-y-1/2">search</span>
                        <input
                            placeholder="Tìm HĐ, nhà thầu, dự án..."
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm w-64 focus:ring-2 focus:ring-indigo-400 outline-none transition-all"
                        />
                    </div>
                    <div className="flex gap-0.5 bg-white border border-slate-200 rounded-lg p-0.5">
                        {[
                            { k: 'all', l: 'Tất cả' },
                            { k: 'Đang thực hiện', l: 'Đang TH' },
                            { k: 'Hoàn thành', l: 'Xong' },
                            { k: 'Tạm dừng', l: 'Tạm dừng' },
                            { k: 'Thanh lý', l: 'Thanh lý' },
                        ].map(f => (
                            <button key={f.k} onClick={() => setFilterStatus(f.k)}
                                className={`px-3 py-1.5 text-[11px] font-bold rounded-md transition-all ${filterStatus === f.k ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>
                                {f.l}
                            </button>
                        ))}
                    </div>
                </div>
                <button onClick={() => { setEditData(null); setModalOpen(true); }}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-lg flex items-center gap-2 transition-all">
                    <span className="material-symbols-outlined text-[18px]">add</span>
                    Tạo HĐ mới
                </button>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto bg-white rounded-xl border border-slate-200 shadow-sm">
                {isLoading ? (
                    <div className="flex items-center justify-center h-40 text-slate-400">
                        <span className="material-symbols-outlined animate-spin mr-2">progress_activity</span> Đang tải...
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 text-slate-400">
                        <span className="material-symbols-outlined text-[40px] opacity-30 mb-2">description</span>
                        <span className="text-sm">Chưa có hợp đồng nào</span>
                    </div>
                ) : (
                    <table className="w-full text-[12px]">
                        <thead className="sticky top-0 z-10">
                            <tr className="bg-slate-700 text-white text-[10px] font-extrabold uppercase tracking-wider">
                                <th className="px-3 py-2.5 text-left">Mã DA</th>
                                <th className="px-3 py-2.5 text-left">Mã HĐ</th>
                                <th className="px-3 py-2.5 text-left">Nhà thầu</th>
                                <th className="px-3 py-2.5 text-center">Phân loại</th>
                                <th className="px-3 py-2.5 text-left">Số HĐ</th>
                                <th className="px-3 py-2.5 text-center">Ngày</th>
                                <th className="px-3 py-2.5 text-left max-w-[180px]">Nội dung HĐ</th>
                                <th className="px-3 py-2.5 text-right">GT trước thuế</th>
                                <th className="px-3 py-2.5 text-center">VAT</th>
                                <th className="px-3 py-2.5 text-right">GT sau thuế</th>
                                <th className="px-3 py-2.5 text-right text-amber-200 bg-blue-800">Tiền HĐ</th>
                                <th className="px-3 py-2.5 text-right text-sky-200 bg-blue-800">Đã ĐNTT</th>
                                <th className="px-3 py-2.5 text-right text-emerald-200 bg-blue-800">Thực trả</th>
                                <th className="px-3 py-2.5 text-right text-rose-200 bg-blue-800">Công nợ</th>
                                <th className="px-2 py-2.5 text-center">BH (th)</th>
                                <th className="px-3 py-2.5 text-center">Tình trạng</th>
                                <th className="px-2 py-2.5 text-center w-16"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filtered.map((c, idx) => {
                                const typeStyle = TYPE_STYLES[c.contract_type] || TYPE_STYLES['Tổ đội'];
                                const statusStyle = STATUS_MAP[c.status] || STATUS_MAP['Đang thực hiện'];
                                const payments = getPayments(c);
                                const totalContract = c.contract_value_with_vat || c.contract_value || 0;
                                return (
                                <React.Fragment key={c.id}>
                                    <tr className={`hover:bg-indigo-50/40 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                                        {/* Mã DA */}
                                        <td className="px-3 py-2.5">
                                            <span className="font-mono font-black text-purple-700 text-[11px]">
                                                {c.projects?.internal_code || c.projects?.code || '—'}
                                            </span>
                                        </td>
                                        {/* Mã HĐ auto */}
                                        <td className="px-3 py-2.5 font-mono text-[10px] text-slate-400">HĐ-{String(idx + 1).padStart(3, '0')}</td>
                                        {/* Nhà thầu */}
                                        <td className="px-3 py-2.5">
                                            <div className="font-bold text-slate-800 text-[11px]">{c.partners?.short_name || c.partners?.code || '—'}</div>
                                            {c.partners?.name && c.partners?.name !== c.partners?.short_name && (
                                                <div className="text-[9px] text-slate-400 truncate max-w-[140px]">{c.partners?.name}</div>
                                            )}
                                        </td>
                                        {/* Phân loại */}
                                        <td className="px-3 py-2.5 text-center">
                                            <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${typeStyle.bg} ${typeStyle.text} ${typeStyle.border} border`}>
                                                {c.contract_type}
                                            </span>
                                        </td>
                                        {/* Số HĐ */}
                                        <td className="px-3 py-2.5 text-[10px] font-medium text-slate-600 max-w-[100px] truncate">{c.contract_code || '—'}</td>
                                        {/* Ngày */}
                                        <td className="px-3 py-2.5 text-center text-[10px] text-slate-500">
                                            {c.start_date ? new Date(c.start_date).toLocaleDateString('vi-VN') : '—'}
                                        </td>
                                        {/* Nội dung HĐ */}
                                        <td className="px-3 py-2.5 font-semibold text-slate-800 max-w-[180px] truncate" title={c.contract_name}>
                                            {c.contract_name}
                                        </td>
                                        {/* GT trước thuế */}
                                        <td className="px-3 py-2.5 text-right font-bold text-slate-700">{fmt(c.contract_value)}</td>
                                        {/* VAT */}
                                        <td className="px-3 py-2.5 text-center text-[10px] text-slate-500">
                                            {c.vat_rate > 0 ? `${c.vat_rate}%` : '—'}
                                        </td>
                                        {/* GT sau thuế */}
                                        <td className="px-3 py-2.5 text-right font-black text-indigo-700">{fmt(totalContract)}</td>
                                        
                                        {/* Tiền Hóa đơn */}
                                        <td className="px-3 py-2.5 text-right font-bold text-amber-700">
                                            {c.contract_type === 'Thầu phụ' ? fmt(c.invoiced_amount || 0) : <span className="text-slate-300 font-normal">—</span>}
                                        </td>
                                        {/* Đã ĐNTT */}
                                        <td className="px-3 py-2.5 text-right font-bold text-sky-600">
                                            {fmt(payments.requested || 0) || <span className="text-slate-300 font-normal">—</span>}
                                        </td>
                                        {/* Thực trả */}
                                        <td className="px-3 py-2.5 text-right font-bold text-emerald-600">
                                            {fmt(payments.paid || 0) || <span className="text-slate-300 font-normal">—</span>}
                                        </td>
                                        {/* Công nợ */}
                                        <td className="px-3 py-2.5 text-right font-bold text-rose-600">
                                            {fmt(((c.contract_type === 'Thầu phụ' && (c.invoiced_amount > 0 || payments.requested === 0)) ? c.invoiced_amount : payments.requested) - payments.paid) || <span className="text-slate-300 font-normal">—</span>}
                                        </td>

                                        {/* Bảo hành */}
                                        <td className="px-2 py-2.5 text-center text-[11px] font-bold text-slate-600">
                                            {c.warranty_months > 0 ? `${c.warranty_months}` : '—'}
                                        </td>
                                        {/* Tình trạng */}
                                        <td className="px-3 py-2.5 text-center">
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${statusStyle.bg} ${statusStyle.text}`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`}></span>
                                                {c.status}
                                            </span>
                                        </td>
                                        {/* Actions */}
                                        <td className="px-2 py-2.5 text-center">
                                            <div className="flex items-center gap-0.5 justify-center">
                                                <button onClick={() => setExpandedContract(expandedContract === c.id ? null : c.id)}
                                                    className={`p-1 rounded transition-colors ${expandedContract === c.id ? 'bg-orange-100 text-orange-600' : 'text-slate-400 hover:bg-orange-50 hover:text-orange-600'}`} title="Phát sinh">
                                                    <span className="material-symbols-outlined text-[14px]">{expandedContract === c.id ? 'expand_less' : 'add_circle'}</span>
                                                </button>
                                                <button onClick={() => handleEdit(c)} className="p-1 hover:bg-indigo-50 rounded transition-colors text-slate-400 hover:text-indigo-600" title="Sửa">
                                                    <span className="material-symbols-outlined text-[14px]">edit</span>
                                                </button>
                                                <button onClick={() => handleDelete(c.id)} className="p-1 hover:bg-rose-50 rounded transition-colors text-slate-400 hover:text-rose-600" title="Xóa">
                                                    <span className="material-symbols-outlined text-[14px]">delete</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                    {/* Expandable Variation Panel */}
                                    {expandedContract === c.id && (
                                        <tr>
                                            <td colSpan="17" className="px-0 py-0 bg-orange-50/50">
                                                <div className="px-6 py-4 border-t-2 border-orange-200 animate-slide-up">
                                                    <div className="flex items-center justify-between mb-3">
                                                        <h4 className="text-sm font-black text-orange-800 flex items-center gap-2">
                                                            <span className="material-symbols-outlined text-[18px]">difference</span>
                                                            Phát sinh — {c.partners?.short_name || c.partners?.name}
                                                            {(variationsByContract[c.id] || []).length > 0 && (
                                                                <span className="px-2 py-0.5 bg-orange-200 text-orange-800 rounded-full text-[10px] font-black">
                                                                    {(variationsByContract[c.id] || []).length} mục
                                                                </span>
                                                            )}
                                                        </h4>
                                                        <div className="text-xs font-bold text-orange-600">
                                                            Tổng PS: <span className="text-orange-800 font-black">{fmt((variationsByContract[c.id] || []).filter(v => v.status === 'Đã duyệt').reduce((s, v) => s + (v.variation_value || 0), 0))}</span>
                                                        </div>
                                                    </div>

                                                    {/* Variation list */}
                                                    {(variationsByContract[c.id] || []).length > 0 && (
                                                        <div className="mb-4 space-y-2">
                                                            {(variationsByContract[c.id] || []).map(v => (
                                                                <div key={v.id} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border text-xs ${
                                                                    v.status === 'Đã duyệt' ? 'bg-emerald-50 border-emerald-200' :
                                                                    v.status === 'Từ chối' ? 'bg-slate-50 border-slate-200 opacity-60' :
                                                                    'bg-white border-orange-200'
                                                                }`}>
                                                                    <span className="font-mono font-bold text-orange-600 text-[10px] w-16">{v.variation_code}</span>
                                                                    <span className="flex-1 font-bold text-slate-800">{v.description}</span>
                                                                    <span className="font-black text-orange-700 tabular-nums">{fmt(v.variation_value)}</span>
                                                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${
                                                                        v.status === 'Đã duyệt' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                                                                        v.status === 'Từ chối' ? 'bg-slate-100 text-slate-500 border-slate-200' :
                                                                        'bg-amber-100 text-amber-700 border-amber-200 animate-pulse'
                                                                    }`}>
                                                                        {v.status}
                                                                    </span>
                                                                    {v.status === 'Chờ duyệt' && (
                                                                        <div className="flex gap-1">
                                                                            <button onClick={() => handleVariationAction(v.id, 'Đã duyệt')}
                                                                                className="p-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded transition-colors" title="Duyệt">
                                                                                <span className="material-symbols-outlined text-[14px]">check</span>
                                                                            </button>
                                                                            <button onClick={() => handleVariationAction(v.id, 'Từ chối')}
                                                                                className="p-1 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded transition-colors" title="Từ chối">
                                                                                <span className="material-symbols-outlined text-[14px]">close</span>
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                    <button onClick={() => handleDeleteVariation(v.id)}
                                                                        className="p-1 hover:bg-rose-100 text-slate-400 hover:text-rose-600 rounded transition-colors" title="Xóa">
                                                                        <span className="material-symbols-outlined text-[12px]">delete</span>
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {/* Add new variation inline */}
                                                    <div className="flex items-end gap-3 bg-white px-4 py-3 rounded-xl border border-orange-200 shadow-sm">
                                                        <div className="flex-1 space-y-1">
                                                            <label className="block text-[9px] font-bold text-orange-500 uppercase">Nội dung phát sinh</label>
                                                            <input placeholder="VD: Bổ sung hạng mục sơn tầng 5..."
                                                                value={variationForm.description}
                                                                onChange={(e) => setVariationForm({ ...variationForm, description: e.target.value })}
                                                                className="w-full bg-orange-50/30 border border-orange-200 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-orange-400 outline-none" />
                                                        </div>
                                                        <div className="w-40 space-y-1">
                                                            <label className="block text-[9px] font-bold text-orange-500 uppercase">Giá trị (VNĐ)</label>
                                                            <input placeholder="150,000,000"
                                                                value={variationForm.value ? formatInputNumber(variationForm.value) : ''}
                                                                onChange={(e) => setVariationForm({ ...variationForm, value: e.target.value.replace(/[^0-9]/g, '') })}
                                                                className="w-full bg-orange-50/30 border border-orange-200 rounded-lg px-3 py-2 text-xs text-right font-bold focus:ring-2 focus:ring-orange-400 outline-none" />
                                                        </div>
                                                        <button
                                                            onClick={() => handleAddVariation(c.id)}
                                                            disabled={addingVariation}
                                                            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all disabled:opacity-50 flex items-center gap-1 whitespace-nowrap"
                                                        >
                                                            <span className="material-symbols-outlined text-[14px]">add</span>
                                                            Thêm PS
                                                        </button>
                                                    </div>
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

            {/* Modal */}
            {modalOpen && (
                <ContractModal
                    isOpen={modalOpen}
                    onClose={() => { setModalOpen(false); setEditData(null); }}
                    onSuccess={handleRefresh}
                    editData={editData}
                    partners={partners}
                    projects={projects}
                />
            )}

            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 6px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
            `}</style>
        </div>
    );
}
