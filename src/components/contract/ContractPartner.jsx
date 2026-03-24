import React from 'react';
import { labelBase } from './contractHelpers';
import SearchableSelect from '../common/SearchableSelect';

export default function ContractPartner({
    partners,
    partnerId, setPartnerId,
    isLoadingPartners,
    setShowPartnerModal
}) {
    return (
        <section id="partner" className="glass-panel p-8 relative z-20">
            <div className="absolute top-0 right-0 w-64 h-64 bg-orange-100 rounded-full blur-[80px] -z-10"></div>
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100/50">
                <h2 className="text-lg font-bold flex items-center gap-3">
                    <span className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 text-orange-600 flex items-center justify-center shadow-sm">
                        <span className="material-symbols-outlined notranslate text-[22px]" translate="no">corporate_fare</span>
                    </span>
                    2. Đối tác (Chủ đầu tư / Tổng thầu)
                </h2>
                <button onClick={() => setShowPartnerModal(true)} className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-orange-600 text-sm font-bold flex items-center gap-2 hover:bg-orange-50 hover:border-orange-200 transition-all shadow-sm">
                    <span className="material-symbols-outlined notranslate text-[18px]" translate="no">add</span>
                    Pháp nhân mới
                </button>
            </div>
            <div className="space-y-6">
                <div className="relative">
                    <label className={labelBase}>Chọn pháp nhân đối tác *</label>
                    <SearchableSelect
                        options={partners.map(p => ({ 
                            id: p.id, 
                            label: p.name, 
                            subLabel: `${p.code ? `[${p.code}] ` : ''}${p.short_name ? `${p.short_name} ` : ''}${p.tax_code ? `• MST: ${p.tax_code}` : ''}`.trim() 
                        }))}
                        value={partnerId}
                        onChange={(val) => setPartnerId(val)}
                        placeholder="-- Tìm kiếm trong danh bạ hệ thống --"
                        loading={isLoadingPartners}
                    />
                </div>
                {partnerId && partners.find(p => p.id === partnerId) && (() => {
                    const p = partners.find(p2 => p2.id === partnerId);
                    return (
                        <div className="bg-orange-50/50 rounded-xl p-5 border border-dashed border-orange-200 grid grid-cols-2 gap-5 animate-fade-in relative">
                            <div className="absolute -left-[1px] top-4 bottom-4 w-[3px] bg-orange-400 rounded-r-md"></div>
                            <div><p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Mã số thuế</p><p className="font-bold text-slate-700">{p.tax_code || '—'}</p></div>
                            <div><p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Đại diện</p><p className="font-bold text-slate-700">{p.representative || '—'}</p></div>
                            <div className="col-span-2"><p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Địa chỉ</p><p className="font-medium text-slate-600 line-clamp-2">{p.address || '—'}</p></div>
                        </div>
                    );
                })()}
            </div>
        </section>
    );
}
