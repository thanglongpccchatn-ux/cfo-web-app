import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import ExcelImportModal from './ExcelImportModal';
import { useToast } from '../context/ToastContext';

export default function SubcontractorsMaster() {
    const [subcontractorsData, setSubcontractorsData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [projects, setProjects] = useState([]);
    const toast = useToast();

    const [paymentForm, setPaymentForm] = useState({
        subcontractorId: '', projectId: '', paymentStage: 'Tạm ứng', contractValue: '', requestDate: new Date().toISOString().split('T')[0],
        requestedAmount: '', approvedAmount: '', paymentDate: '', paidAmount: '', priority: 'Bình thường', notes: ''
    });

    const fmt = (v) => v ? Number(v).toLocaleString('vi-VN') : '0';
    const formatBillion = (val) => (val / 1000000000).toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' Tỷ';

    // Định nghĩa cấu hình Import cho Thầu Phụ
    const subMapping = {
        code: "Mã NT",
        name: "Tên nhà thầu",
        tax_code: "Mã số thuế",
        contact_person: "Người liên hệ",
        phone: "Số điện thoại",
        email: "Email",
        address: "Địa chỉ",
        bank_account: "Số tài khoản",
        bank_name: "Ngân hàng",
        bank_branch: "Chi nhánh",
        account_holder: "Chủ tài khoản",
        notes: "Loại hình"
    };

    useEffect(() => {
        fetchData();
        fetchProjects();
    }, []);

    async function fetchProjects() {
        const { data } = await supabase.from('projects').select('id, name, code, internal_code').order('created_at', { ascending: false });
        setProjects(data || []);
    };

    async function fetchData() {
        setLoading(true);

        // Lấy danh mục Thầu phụ gốc
        const { data: subs, error: supError } = await supabase
            .from('subcontractors')
            .select('*')
            .order('name', { ascending: true });

        if (supError) {
            console.error("Lỗi tải Thầu phụ:", supError);
            setLoading(false);
            return;
        }

        // Lấy dữ liệu labor expenses
        const { data: labors, error } = await supabase
            .from('expense_labor')
            .select('subcontractor_id, contract_value, approved_amount, paid_amount, project_id');

        if (error) {
            console.error("Lỗi tải chi phí nhân công:", error);
        }

        // Aggregate 
        const map = {};
        (subs || []).forEach(s => {
            map[s.id] = { ...s, totalContract: 0, totalApproved: 0, totalPaid: 0, projectIds: new Set() };
        });

        (labors || []).forEach(lab => {
            if (lab.subcontractor_id && map[lab.subcontractor_id]) {
                const subRef = map[lab.subcontractor_id];
                subRef.totalApproved += Number(lab.approved_amount || 0);
                subRef.totalPaid += Number(lab.paid_amount || 0);
                if (Number(lab.contract_value) > subRef.totalContract) {
                    subRef.totalContract = Number(lab.contract_value);
                }
                subRef.projectIds.add(lab.project_id);
            }
        });

        const arr = Object.values(map).map(s => ({
            ...s,
            totalDebt: s.totalApproved - s.totalPaid,
            projectCount: s.projectIds ? s.projectIds.size : 0
        }));

        // Sort by Debt descending
        arr.sort((a, b) => b.totalDebt - a.totalDebt);

        setSubcontractorsData(arr);
        setLoading(false);
    };

    const handleImportSuccess = (count) => {
        alert(`Đã import thành công ${count} thầu phụ/tổ đội!`);
        fetchData();
    };

    const handleNumChange = (field, value) => {
        const clean = value.replace(/[^0-9]/g, '');
        setPaymentForm(prev => ({ ...prev, [field]: clean }));
    };

    const handlePaymentSubmit = async (e) => {
        e.preventDefault();
        const sub = subcontractorsData.find(s => s.id === paymentForm.subcontractorId);

        const payload = {
            project_id: paymentForm.projectId || null,
            subcontractor_id: paymentForm.subcontractorId || null,
            team_name: sub?.name || '',
            payment_stage: paymentForm.paymentStage,
            contract_value: Number(paymentForm.contractValue) || 0,
            request_date: paymentForm.requestDate || null,
            requested_amount: Number(paymentForm.requestedAmount) || 0,
            approved_amount: Number(paymentForm.approvedAmount) || 0,
            payment_date: paymentForm.paymentDate || null,
            paid_amount: Number(paymentForm.paidAmount) || 0,
            priority: paymentForm.priority,
            notes: paymentForm.notes
        };

        const { error } = await supabase.from('expense_labor').insert([payload]);
        if (error) {
            toast.error('Lỗi: ' + error.message);
        } else {
            toast.success('Đã ghi nhận thanh toán nhân công');
            setShowPaymentModal(false);
            setPaymentForm({ subcontractorId: '', projectId: '', paymentStage: 'Tạm ứng', contractValue: '', requestDate: new Date().toISOString().split('T')[0], requestedAmount: '', approvedAmount: '', paymentDate: '', paidAmount: '', priority: 'Bình thường', notes: '' });
            fetchData();
        }
    };

    const filteredList = subcontractorsData.filter(s => 
        (s.name && s.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (s.code && s.code.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const globalTotalApproved = subcontractorsData.reduce((acc, s) => acc + s.totalApproved, 0);
    const globalTotalPaid = subcontractorsData.reduce((acc, s) => acc + s.totalPaid, 0);
    const globalTotalDebt = globalTotalApproved - globalTotalPaid;

    if (loading) {
        return <div className="p-12 text-center text-slate-500 animate-pulse">Đang tải dữ liệu Sổ cái Thầu phụ...</div>;
    }

    return (
        <div className="pb-10 animate-fade-in text-slate-900 dark:text-slate-100">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2 tracking-tight">
                        <span className="material-symbols-outlined notranslate text-purple-600 text-[28px]" translate="no">groups</span>
                        Danh Mục Thầu Phụ / Tổ đội
                    </h2>
                    <p className="text-slate-500 text-sm mt-1 uppercase font-semibold tracking-wider">Tổng hợp Đề nghị thanh toán & Công nợ nhân công</p>
                </div>
                <div className="flex gap-3">
                    <button 
                        onClick={() => setShowPaymentModal(true)}
                        className="p-2.5 px-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-bold flex items-center gap-2 transition-all shadow-md shadow-purple-200"
                    >
                        <span className="material-symbols-outlined notranslate" translate="no">add_task</span>
                        Nhập thanh toán nhân công
                    </button>
                    <button 
                        onClick={() => setIsImportModalOpen(true)}
                        className="p-2.5 px-4 bg-purple-50 dark:bg-purple-900/10 text-purple-600 dark:text-purple-400 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/20 font-semibold border border-purple-200 dark:border-purple-800/50 flex items-center gap-2 transition-all shadow-sm"
                    >
                        <span className="material-symbols-outlined notranslate" translate="no">upload_file</span>
                        Import Excel
                    </button>
                    <button onClick={fetchData} className="p-2.5 bg-white dark:bg-[#1e293b] text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm border border-slate-200 dark:border-slate-700 flex items-center">
                        <span className="material-symbols-outlined notranslate" translate="no">refresh</span>
                    </button>
                </div>
            </div>

            {/* Global KPIs */}
            <div className="flex flex-col lg:flex-row gap-6 mb-8">
                <div className="flex-1 bg-gradient-to-br from-purple-800 to-indigo-900 rounded-2xl p-6 border border-purple-700 shadow-lg relative overflow-hidden">
                    <div className="absolute -right-4 -top-4 opacity-10">
                        <span className="material-symbols-outlined notranslate text-[120px] text-white" translate="no">engineering</span>
                    </div>
                    <div className="relative z-10 flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center shrink-0 border border-white/20">
                            <span className="material-symbols-outlined notranslate text-white text-[32px]" translate="no">group</span>
                        </div>
                        <div>
                            <p className="text-purple-200 text-xs font-bold uppercase tracking-widest mb-1">Tổng Số Thầu phụ</p>
                            <p className="text-4xl font-black text-white">{subcontractorsData.length}</p>
                        </div>
                    </div>
                </div>

                <div className="flex-[2] bg-white dark:bg-[#1e293b] rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-around divide-x divide-slate-100 dark:divide-slate-800">
                    <div className="px-6 text-center">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Giá trị Tối Ưu (Duyệt chi)</p>
                        <p className="text-2xl font-black text-purple-700 dark:text-purple-400">{formatBillion(globalTotalApproved)}</p>
                    </div>
                    <div className="px-6 text-center">
                        <p className="text-[11px] font-bold text-green-600 uppercase tracking-widest mb-2">Đã thanh toán (Sateco)</p>
                        <p className="text-2xl font-black text-green-600">{formatBillion(globalTotalPaid)}</p>
                    </div>
                    <div className="px-6 text-center">
                        <p className="text-[11px] font-bold text-red-500 uppercase tracking-widest mb-2">Tổng dư nợ Thầu</p>
                        <p className="text-2xl font-black text-red-600">{formatBillion(globalTotalDebt)}</p>
                    </div>
                </div>
            </div>

            {/* Subcontractor List */}
            <div className="bg-white dark:bg-[#1e293b] rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/30">
                    <h3 className="font-bold text-sm text-slate-700 dark:text-slate-300">Danh sách Thầu phụ</h3>
                    <div className="relative w-80">
                        <span className="material-symbols-outlined notranslate absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]" translate="no">search</span>
                        <input
                            type="text"
                            placeholder="Tìm mã hoặc tên Thầu phụ..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 pr-4 py-2 w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    {filteredList.length === 0 ? (
                        <div className="text-center py-16 text-slate-400">
                            <span className="material-symbols-outlined notranslate text-4xl block mb-2 opacity-50" translate="no">search_off</span>
                            <p>Chưa có dữ liệu, vui lòng Import Excel.</p>
                        </div>
                    ) : (
                        <table className="w-full text-sm text-left">
                            <thead className="bg-[#2D4A86] text-white font-bold text-[10px] uppercase tracking-wider">
                                <tr>
                                    <th className="px-6 py-4 rounded-tl border-r border-[#1e3463] w-16 text-center">Mã NT</th>
                                    <th className="px-6 py-4 border-r border-[#1e3463] min-w-[200px]">Tên Thầu phụ / Tổ đội</th>
                                    <th className="px-6 py-4 border-r border-[#1e3463] text-center">Liên hệ</th>
                                    <th className="px-6 py-4 border-r border-[#1e3463] text-center" title="Số lượng dự án">D.Án</th>
                                    <th className="px-6 py-4 border-r border-[#1e3463] text-right bg-[#3B5B9E]">GT Được Duyệt</th>
                                    <th className="px-6 py-4 border-r border-[#1e3463] text-right text-green-300">Đã TT</th>
                                    <th className="px-6 py-4 border-r border-[#1e3463] text-right text-red-300">Còn Nợ</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                {filteredList.map((team) => {
                                    return (
                                        <tr key={team.id} className="hover:bg-purple-50/30 dark:hover:bg-slate-800/50 group transition-colors">
                                            <td className="px-6 py-4 text-center">
                                                <span className="px-2 py-1 bg-white dark:bg-slate-800 text-purple-700 dark:text-purple-400 rounded text-xs font-mono font-bold shadow-sm border border-slate-200 dark:border-slate-700">
                                                    {team.code}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200">
                                                <div>{team.name}</div>
                                                {team.tax_code && <div className="text-[10px] text-slate-400 font-normal mt-0.5">MST: {team.tax_code}</div>}
                                            </td>
                                            <td className="px-6 py-4 text-[12px] text-slate-600 dark:text-slate-400">
                                                <div>{team.contact_person} {team.phone && `- ${team.phone}`}</div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-bold border border-purple-200 dark:border-purple-800">
                                                    {team.projectCount}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right font-medium text-purple-700 dark:text-purple-400 bg-purple-50/10 dark:bg-purple-900/5">
                                                {fmt(team.totalApproved)} ₫
                                            </td>
                                            <td className="px-6 py-4 text-right text-green-600 font-semibold bg-green-50/10 dark:bg-green-900/5">
                                                {fmt(team.totalPaid)} ₫
                                            </td>
                                            <td className="px-6 py-4 text-right font-black text-red-500">
                                                {fmt(team.totalDebt)} ₫
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            <ExcelImportModal 
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                title="Nhập Dữ Liệu Thầu Phụ"
                tableName="subcontractors"
                columnMapping={subMapping}
                onSuccess={handleImportSuccess}
            />

            {/* Modal Nhập thanh toán nhân công */}
            {showPaymentModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200/50">
                        <div className="px-8 py-6 bg-gradient-to-r from-purple-50 to-white border-b border-slate-100">
                            <div className="flex items-center gap-2 text-slate-400 text-[10px] mb-2 uppercase tracking-widest font-bold">
                                <span>Thầu phụ / Tổ đội</span>
                                <span className="material-symbols-outlined text-[12px]">chevron_right</span>
                                <span className="text-purple-700">Nhập thanh toán</span>
                            </div>
                            <h3 className="text-2xl font-extrabold text-slate-800 tracking-tight">Ghi nhận thanh toán nhân công</h3>
                        </div>
                        <form onSubmit={handlePaymentSubmit} className="px-8 py-6 space-y-5">
                            <div className="grid grid-cols-2 gap-5">
                                <div className="space-y-2">
                                    <label className="block text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Thầu phụ / Tổ đội</label>
                                    <select required value={paymentForm.subcontractorId} onChange={(e) => setPaymentForm({...paymentForm, subcontractorId: e.target.value})} className="w-full bg-slate-50 border-none rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-purple-500">
                                        <option value="">Chọn thầu phụ...</option>
                                        {subcontractorsData.map(s => <option key={s.id} value={s.id}>[{s.code}] {s.name}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Dự án</label>
                                    <select required value={paymentForm.projectId} onChange={(e) => setPaymentForm({...paymentForm, projectId: e.target.value})} className="w-full bg-slate-50 border-none rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-purple-500">
                                        <option value="">Chọn dự án...</option>
                                        {projects.map(p => <option key={p.id} value={p.id}>{p.internal_code || p.code} — {p.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-5">
                                <div className="space-y-2">
                                    <label className="block text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Giai đoạn TT</label>
                                    <select value={paymentForm.paymentStage} onChange={(e) => setPaymentForm({...paymentForm, paymentStage: e.target.value})} className="w-full bg-slate-50 border-none rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-purple-500">
                                        <option value="Tạm ứng">Tạm ứng</option>
                                        <option value="Nghiệm thu">Nghiệm thu</option>
                                        <option value="Quyết toán">Quyết toán</option>
                                        <option value="Bảo lãnh">Bảo lãnh</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">GT Hợp đồng gốc</label>
                                    <input placeholder="0" value={fmt(paymentForm.contractValue)} onChange={(e) => handleNumChange('contractValue', e.target.value)} className="w-full bg-slate-50 border-none rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-purple-500 text-right font-bold" />
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Ngày đề nghị</label>
                                    <input type="date" value={paymentForm.requestDate} onChange={(e) => setPaymentForm({...paymentForm, requestDate: e.target.value})} className="w-full bg-slate-50 border-none rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-purple-500" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-5">
                                <div className="space-y-2">
                                    <label className="block text-[11px] font-extrabold text-indigo-600 uppercase tracking-wider">Số tiền đề nghị</label>
                                    <input placeholder="0" value={fmt(paymentForm.requestedAmount)} onChange={(e) => handleNumChange('requestedAmount', e.target.value)} className="w-full bg-indigo-50/50 border-none rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 text-right font-bold text-indigo-700" />
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-[11px] font-extrabold text-blue-600 uppercase tracking-wider">Duyệt chi (tối ưu)</label>
                                    <input placeholder="0" value={fmt(paymentForm.approvedAmount)} onChange={(e) => handleNumChange('approvedAmount', e.target.value)} className="w-full bg-blue-50 border-none rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 text-right font-black text-blue-700" />
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-5">
                                <div className="space-y-2">
                                    <label className="block text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Ngày thanh toán</label>
                                    <input type="date" value={paymentForm.paymentDate} onChange={(e) => setPaymentForm({...paymentForm, paymentDate: e.target.value})} className="w-full bg-slate-50 border-none rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-green-500" />
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-[11px] font-extrabold text-green-600 uppercase tracking-wider">Thực trả (Sateco)</label>
                                    <input placeholder="0" value={fmt(paymentForm.paidAmount)} onChange={(e) => handleNumChange('paidAmount', e.target.value)} className="w-full bg-green-50 border-none rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-green-500 text-right font-black text-green-700" />
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Mức độ</label>
                                    <select value={paymentForm.priority} onChange={(e) => setPaymentForm({...paymentForm, priority: e.target.value})} className="w-full bg-slate-50 border-none rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-purple-500">
                                        <option value="Bình thường">Bình thường</option>
                                        <option value="Cao">🔥 Cao</option>
                                        <option value="Khẩn cấp">🚨 Khẩn cấp</option>
                                        <option value="Thấp">Thấp</option>
                                    </select>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="block text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Ghi chú nội bộ</label>
                                <input placeholder="Ghi chú trình ký, xác nhận khối lượng..." value={paymentForm.notes} onChange={(e) => setPaymentForm({...paymentForm, notes: e.target.value})} className="w-full bg-slate-50 border-none rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-purple-500" />
                            </div>
                            <div className="pt-4 border-t border-slate-100 flex justify-end gap-4">
                                <button type="button" onClick={() => setShowPaymentModal(false)} className="px-6 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Hủy bỏ</button>
                                <button type="submit" className="px-8 py-2.5 bg-gradient-to-br from-purple-600 to-purple-700 text-white text-sm font-bold rounded-lg shadow-md hover:shadow-lg active:scale-95 transition-all">Lưu thanh toán</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
