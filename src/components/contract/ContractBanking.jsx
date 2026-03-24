import React from 'react';
import { inputBase, labelBase } from './contractHelpers';

export default function ContractBanking({
    bankProfiles, selectedBankProfile, handleBankProfileSelect,
    editingBank, setEditingBank,
    actingEntityKey,
    tlBank, setTlBank,
    tpBank, setTpBank,
    stBank, setStBank
}) {
    return (
        <section id="banking" className="glass-panel p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-teal-100 rounded-full blur-[80px] -z-10"></div>
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100/50">
                <h2 className="text-lg font-bold flex items-center gap-3">
                    <span className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-100 text-teal-600 flex items-center justify-center shadow-sm">
                        <span className="material-symbols-outlined notranslate text-[22px]" translate="no">account_balance_wallet</span>
                    </span>
                    7. Tài khoản Ngân hàng Thụ hưởng
                </h2>
                <div className="flex items-center gap-4">
                     <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm">
                         <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Chọn nhanh:</span>
                         <select 
                            value={selectedBankProfile} 
                            onChange={(e) => handleBankProfileSelect(e.target.value)}
                            className="text-xs font-bold bg-transparent border-none focus:ring-0 text-teal-700 p-0"
                         >
                             <option value="">-- Chọn Ngân hàng --</option>
                             {bankProfiles.map(p => (
                                 <option key={p.id} value={p.id}>{p.label}</option>
                             ))}
                         </select>
                     </div>

                    <button onClick={() => setEditingBank(!editingBank)} className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-sm border ${editingBank ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-teal-600 border-slate-200 hover:bg-teal-50 hover:border-teal-200'}`}>
                        <span className="material-symbols-outlined notranslate text-[16px]" translate="no">{editingBank ? 'check' : 'edit'}</span>
                        {editingBank ? 'Xong' : 'Chỉnh sửa'}
                    </button>
                </div>
            </div>
            <p className="text-xs text-slate-500 mb-6 -mt-2">Sử dụng dropdown "Chọn nhanh" để tự động điền thông tin cho cả 2 phía.</p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Primary Entity Bank (TL/TP/ST) */}
                {(() => {
                    const entityInfo = {
                        thanglong: { name: 'Thăng Long', color: 'blue', state: tlBank, set: setTlBank },
                        thanhphat: { name: 'Thành Phát', color: 'amber', state: tpBank, set: setTpBank },
                        sateco: { name: 'Sateco', color: 'emerald', state: stBank, set: setStBank }
                    };
                    const current = entityInfo[actingEntityKey] || entityInfo.thanglong;
                    
                    return (
                        <div className={`glass-card bg-${current.color}-50/30 border-${current.color}-100 p-6 relative overflow-hidden transition-all duration-500`}>
                            <div className={`absolute top-0 left-0 w-1 h-full bg-${current.color}-500`}></div>
                            <h3 className={`text-sm font-black text-${current.color}-800 mb-4 flex items-center gap-2 uppercase tracking-tight`}>
                                <span className="material-symbols-outlined notranslate text-[18px]" translate="no">account_balance</span>
                                {current.name} — Nhận từ CĐT
                            </h3>
                            {editingBank ? (
                                <div className="space-y-4 animate-fade-in">
                                    <div><label className={labelBase}>Số tài khoản</label><input type="text" value={current.state.account} onChange={e => current.set({...current.state, account: e.target.value})} className={inputBase} placeholder="Số tài khoản..." /></div>
                                    <div><label className={labelBase}>Ngân hàng</label><input type="text" value={current.state.name} onChange={e => current.set({...current.state, name: e.target.value})} className={inputBase} placeholder="Tên ngân hàng..." /></div>
                                    <div><label className={labelBase}>Chi nhánh</label><input type="text" value={current.state.branch} onChange={e => current.set({...current.state, branch: e.target.value})} className={inputBase} placeholder="Chi nhánh..." /></div>
                                    <div><label className={labelBase}>Chủ tài khoản</label><input type="text" value={current.state.holder} onChange={e => current.set({...current.state, holder: e.target.value})} className={inputBase} placeholder="Tên công ty đứng tên..." /></div>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {[{l: 'Số TK', v: current.state.account}, {l: 'Ngân hàng', v: current.state.name}, {l: 'Chi nhánh', v: current.state.branch}, {l: 'Chủ TK', v: current.state.holder}].map((item, i) => (
                                        <div key={i} className="flex justify-between items-center text-sm border-b border-slate-100/50 pb-2 last:border-0">
                                            <span className="text-slate-500 text-xs">{item.l}</span>
                                            <span className={`font-bold ${item.v ? 'text-slate-800' : 'text-slate-300 italic'}`}>{item.v || 'Chưa cài đặt'}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })()}

                {/* Secondary Entity Bank (Sateco) */}
                {actingEntityKey !== 'sateco' && (
                    <div className="glass-card bg-emerald-50/30 border-emerald-100 p-6 relative overflow-hidden transition-all duration-500 animate-in slide-in-from-right">
                        <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                        <h3 className="text-sm font-black text-emerald-800 mb-4 flex items-center gap-2 uppercase tracking-tight">
                            <span className="material-symbols-outlined notranslate text-[18px]" translate="no">sync_alt</span>
                            Sateco — Nhận từ {actingEntityKey === 'thanglong' ? 'Thăng Long' : 'Thành Phát'}
                        </h3>
                        {editingBank ? (
                            <div className="space-y-4 animate-fade-in">
                                <div><label className={labelBase}>Số tài khoản</label><input type="text" value={stBank.account} onChange={e => setStBank({...stBank, account: e.target.value})} className={inputBase} placeholder="Số tài khoản Sateco..." /></div>
                                <div><label className={labelBase}>Ngân hàng</label><input type="text" value={stBank.name} onChange={e => setStBank({...stBank, name: e.target.value})} className={inputBase} placeholder="Ngân hàng Sateco..." /></div>
                                <div><label className={labelBase}>Chi nhánh</label><input type="text" value={stBank.branch} onChange={e => setStBank({...stBank, branch: e.target.value})} className={inputBase} placeholder="Chi nhánh Sateco..." /></div>
                                <div><label className={labelBase}>Chủ tài khoản</label><input type="text" value={stBank.holder} onChange={e => setStBank({...stBank, holder: e.target.value})} className={inputBase} placeholder="CÔNG TY CP SATECO" /></div>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {[{l: 'Số TK', v: stBank.account}, {l: 'Ngân hàng', v: stBank.name}, {l: 'Chi nhánh', v: stBank.branch}, {l: 'Chủ TK', v: stBank.holder}].map((item, i) => (
                                    <div key={i} className="flex justify-between items-center text-sm border-b border-slate-100/50 pb-2 last:border-0">
                                        <span className="text-slate-500 text-xs">{item.l}</span>
                                        <span className={`font-bold ${item.v ? 'text-slate-800' : 'text-slate-300 italic'}`}>{item.v || 'Chưa cài đặt'}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </section>
    );
}
