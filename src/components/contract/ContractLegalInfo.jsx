import React from 'react';
import { inputBase, labelBase, companyEntities } from './contractHelpers';

export default function ContractLegalInfo({
    name, setName,
    code, setCode,
    internalCode, setInternalCode,
    contractType, setContractType,
    contractForm, setContractForm,
    location, setLocation,
    description, setDescription,
    actingEntityKey, setActingEntityKey,
}) {
    return (
        <section id="general" className="glass-panel p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-100 rounded-full blur-[80px] -z-10"></div>
            <h2 className="text-lg font-bold mb-6 flex items-center gap-3 pb-4 border-b border-slate-100/50">
                <span className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center shadow-sm">
                    <span className="material-symbols-outlined notranslate text-[22px]" translate="no">description</span>
                </span>
                1. Thông tin pháp lý Hợp đồng
            </h2>

            <div className="mb-8 p-5 bg-gradient-to-br from-blue-50 to-white border border-blue-100 rounded-3xl shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-100/30 rounded-full -mr-16 -mt-16 blur-2xl group-hover:scale-110 transition-transform duration-700"></div>
                <label className="text-[11px] font-black text-blue-600 uppercase tracking-widest mb-4 block flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-blue-600 text-white flex items-center justify-center text-[12px] shadow-sm">
                        <span className="material-symbols-outlined text-[14px]">shield</span>
                    </span>
                    Pháp nhân ký kết (Nội bộ Sateco Group) *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {companyEntities.map(company => (
                        <button
                            key={company.key}
                            type="button"
                            onClick={() => setActingEntityKey(company.key)}
                            className={`relative flex flex-col items-start px-5 py-4 rounded-2xl border-2 transition-all duration-300 ${
                                actingEntityKey === company.key 
                                    ? `border-${company.color}-500 bg-${company.color}-50/50 shadow-md ring-4 ring-${company.color}-500/5` 
                                    : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200 hover:shadow-sm'
                            }`}
                        >
                            <div className="flex items-center justify-between w-full mb-1">
                                <span className={`text-[12px] font-black uppercase ${actingEntityKey === company.key ? `text-${company.color}-700` : 'text-slate-600'}`}>
                                    {company.name}
                                </span>
                                {actingEntityKey === company.key && (
                                    <span className={`material-symbols-outlined text-[20px] text-${company.color}-600 animate-in zoom-in duration-300`}>check_circle</span>
                                )}
                            </div>
                            <span className="text-[10px] opacity-70 font-medium">{company.desc}</span>
                        </button>
                    ))}
                </div>
                <p className="text-[10px] text-slate-400 mt-4 italic flex items-center gap-1.5 opacity-80">
                    <span className="material-symbols-outlined text-[14px]">info</span>
                    * Lựa chọn này sẽ thay đổi các chỉ số KPI và luồng ngân hàng thụ hưởng bên dưới.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                    <label className={labelBase}>Tên dự án / Hợp đồng *</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} className={inputBase} placeholder="VD: Gói thầu thi công PCCC KCN Intco..." />
                </div>
                <div>
                    <label className="block text-[11px] font-bold text-blue-600 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                        <span className="material-symbols-outlined notranslate text-[14px]" translate="no">tag</span>
                        Mã HĐ Nội bộ (Quản lý)
                    </label>
                    <input type="text" value={internalCode} onChange={e => setInternalCode(e.target.value)} className="w-full rounded-xl border border-blue-200 bg-blue-50/40 p-3.5 text-sm font-bold text-blue-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm" placeholder="VD: TL-2024-01 (tự đặt)" />
                    <p className="text-[10px] text-slate-400 mt-1">Mã tự đặt để tìm kiếm nhanh trên hệ thống</p>
                </div>
                <div>
                    <label className={labelBase}>Số / Mã hợp đồng *</label>
                    <input type="text" value={code} onChange={e => setCode(e.target.value)} className={inputBase} placeholder="VD: 2024/INTCO-TL/HD-TC" />
                    <p className="text-[10px] text-slate-400 mt-1">Số HĐ chính thức theo Chủ Đầu Tư</p>
                </div>
                <div>
                    <label className={labelBase}>Loại hợp đồng</label>
                    <select value={contractType} onChange={e => setContractType(e.target.value)} className={`${inputBase} appearance-none`}>
                        <option>Thi công</option>
                        <option>Cung cấp vật tư</option>
                        <option>Tư vấn thiết kế</option>
                        <option>Bảo trì / Bảo dưỡng</option>
                        <option>Phát sinh / Phụ lục</option>
                    </select>
                </div>
                <div>
                    <label className="block text-[11px] font-bold text-purple-600 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                        <span className="material-symbols-outlined notranslate text-[14px]" translate="no">category</span>
                        Hình thức hợp đồng
                    </label>
                    <select value={contractForm} onChange={e => setContractForm(e.target.value)} className="w-full rounded-xl border border-purple-200 bg-purple-50/40 p-3.5 text-sm font-bold text-purple-700 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all shadow-sm appearance-none">
                        <option>Trọn gói</option>
                        <option>Theo khối lượng</option>
                        <option>Theo đơn giá</option>
                        <option>Hỗn hợp</option>
                        <option>EPC (Thiết kế - Mua sắm - Thi công)</option>
                        <option>BOT / PPP</option>
                        <option>Khác</option>
                    </select>
                </div>
                <div className="md:col-span-2">
                    <label className={labelBase}>Địa điểm triển khai</label>
                    <input type="text" value={location} onChange={e => setLocation(e.target.value)} className={inputBase} placeholder="VD: KCN Hữu Nghị, Lạng Sơn" />
                </div>
                <div className="md:col-span-2">
                    <label className={labelBase}>Mô tả / Ghi chú</label>
                    <textarea value={description} onChange={e => setDescription(e.target.value)} className={`${inputBase} h-24 resize-none`} placeholder="Thông tin tóm tắt nội dung gói thầu..." />
                </div>
            </div>
        </section>
    );
}
