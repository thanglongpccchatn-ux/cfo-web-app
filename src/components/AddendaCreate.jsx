import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { smartToast } from '../utils/globalToast';

export default function AddendaCreate({ project, onBack }) {
    const [name, setName] = useState('Phụ lục 01: Bổ sung phần cọc nhồi bổ sung');
    const [addendaValue, setAddendaValue] = useState(1500000000);
    const [isSaving, setIsSaving] = useState(false);

    // An toàn kiểm tra project
    if (!project) return null;

    const SATECO_RATIO = parseFloat(project.sateco_ratio) / 100;
    const vat = 8;

    const totalValue = Number(project.original_value);
    const targetValueAfterAddenda = totalValue + addendaValue;
    const satecoAddendaValue = addendaValue * SATECO_RATIO;

    const formatCurrency = (val) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);

    const handleSave = async () => {
        if (!name || addendaValue <= 0) {
            smartToast('Vui lòng nhập tên và giá trị hợp lệ!');
            return;
        }

        setIsSaving(true);
        const { error } = await supabase.from('addendas').insert([{
            project_id: project.id,
            name: name,
            requested_value: addendaValue,
            sateco_value: satecoAddendaValue,
            status: 'Đã duyệt' // Hardcode thành Đã duyệt để demo việc auto-cộng dồn
        }]);
        setIsSaving(false);

        if (error) {
            console.error('Save addenda error:', error);
            smartToast('Có lỗi khi lưu Phụ lục!');
        } else {
            smartToast('Đã tạo và duyệt Phụ lục thành công!');
            onBack();
        }
    };

    return (
        <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 min-h-screen p-6">
            <div className="flex items-center gap-4 mb-8">
                <button onClick={onBack} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200"><span className="material-symbols-outlined notranslate" translate="no">arrow_back</span></button>
                <div>
                    <h1 className="text-2xl font-bold">Thêm mới Phụ lục / Phát sinh</h1>
                    <p className="text-sm text-slate-500">Dự án: {project.name}</p>
                </div>
            </div>

            <div className="bg-white dark:bg-[#1e293b] rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 max-w-4xl mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Left Column: Thăng Long's view */}
                    <div className="space-y-6">
                        <h2 className="text-lg font-bold text-blue-600 flex items-center gap-2 pb-2 border-b border-blue-100">
                            <span className="material-symbols-outlined notranslate" translate="no">domain</span>
                            Dữ liệu Thăng Long
                        </h2>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Tên phụ lục <span className="text-red-500">*</span></label>
                            <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:ring-primary py-2.5 px-3" placeholder="Ví dụ: Bổ sung ốp lát cầu thang..." />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Giá trị Phát sinh trước VAT (VNĐ) <span className="text-red-500">*</span></label>
                            <input
                                type="number"
                                value={addendaValue}
                                onChange={(e) => setAddendaValue(Number(e.target.value))}
                                className="w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:ring-primary py-2.5 px-3 font-bold text-blue-600 text-lg"
                            />
                        </div>

                        <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-lg flex justify-between items-center text-sm border border-blue-100">
                            <span className="font-semibold text-slate-700 dark:text-slate-300">Tổng giá trị HĐ sau phát sinh:</span>
                            <span className="font-bold text-blue-700">{formatCurrency(targetValueAfterAddenda)}</span>
                        </div>
                    </div>

                    {/* Right Column: Sateco's view (Auto-calculated) */}
                    <div className="space-y-6 relative">
                        {/* Connecting line visualization */}
                        <div className="hidden md:block absolute top-1/2 -left-8 w-8 border-t-2 border-dashed border-red-300"></div>
                        <div className="hidden md:flex absolute top-1/2 -left-4 w-4 h-4 bg-red-100 rounded-full items-center justify-center transform -translate-y-1/2 text-[8px] font-bold text-red-600 group cursor-help" title={`Áp dụng tỷ lệ bóng-hình ${project.sateco_ratio}%`}>
                            %
                        </div>

                        <h2 className="text-lg font-bold text-red-600 flex items-center gap-2 pb-2 border-b border-red-100">
                            <span className="material-symbols-outlined notranslate" translate="no">account_tree</span>
                            Dữ liệu Sateco (Tự động)
                        </h2>

                        <div className="p-4 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-100 dark:border-red-900/20 text-sm">
                            <p className="font-bold mb-2">Tỷ lệ Sateco áp dụng từ HĐ Gốc: {project.sateco_ratio}%</p>
                            <div className="space-y-2 text-slate-600 dark:text-slate-300">
                                <div className="flex justify-between">
                                    <span>Giá trị phát sinh đẩy về Sateco:</span>
                                    <span className="font-bold text-red-600">{formatCurrency(satecoAddendaValue)}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span>Tiền VAT Sateco ({vat}%):</span>
                                    <span>{formatCurrency(satecoAddendaValue * (vat / 100))}</span>
                                </div>
                                <div className="flex justify-between pt-2 border-t border-red-200 mt-2 font-bold text-md text-red-700">
                                    <span>Tổng phát sinh Sateco ghi nhận:</span>
                                    <span>{formatCurrency(satecoAddendaValue * (1 + vat / 100))}</span>
                                </div>
                            </div>
                        </div>

                        <div className="mt-4 text-xs text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-100">
                            <p><strong>Lưu ý:</strong> Phụ lục của Sateco sẽ tự động được tạo và liên kết với Dự án <strong>{project.code}</strong> trên cơ sở dữ liệu Supabase.</p>
                        </div>
                    </div>
                </div>

                <div className="mt-8 flex justify-end gap-3 pt-4 border-t border-slate-100">
                    <button onClick={onBack} disabled={isSaving} className="px-6 py-2 rounded-lg border border-slate-200 font-medium hover:bg-slate-50">Hủy</button>
                    <button onClick={handleSave} disabled={isSaving} className="px-6 py-2 rounded-lg bg-primary text-white font-bold hover:bg-blue-600 shadow-md disabled:opacity-50">
                        {isSaving ? 'Đang lưu...' : 'Lưu Phụ lục'}
                    </button>
                </div>
            </div>
        </div>
    );
}
