import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import LaborTracking from './LaborTracking';
import SubcontractorsMaster from './SubcontractorsMaster';
import SubcontractorContracts from './SubcontractorContracts';

export default function LaborSubcontractorHub() {
    const location = useLocation();
    const navigate = useNavigate();
    
    // Check if we arrived via a specific route intention (optional)
    const [activeTab, setActiveTab] = useState('labor_tracking');

    useEffect(() => {
        // Simple mechanism to support deep linking if needed
        const urlParams = new URLSearchParams(location.search);
        const tab = urlParams.get('tab');
        if (tab === 'master') setActiveTab('master');
        else if (tab === 'contracts') setActiveTab('contracts');
        else if (tab === 'labor' || tab === 'labor_tracking') setActiveTab('labor_tracking');
    }, [location]);

    const setTab = (tab) => {
        setActiveTab(tab);
        navigate(`/labor_subcontractors?tab=${tab}`, { replace: true });
    };

    return (
        <div className="flex flex-col h-[calc(100vh-100px)] bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm animate-fade-in relative z-10">
            <div className="flex flex-col px-6 pt-5 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-800 shadow-sm shrink-0">
                <div className="mb-3">
                    <h1 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                        <span className="material-symbols-outlined text-purple-600 text-[28px]">engineering</span>
                        Quản lý Tổ Đội & Thầu Phụ
                    </h1>
                    <p className="text-slate-500 font-semibold text-xs tracking-widest uppercase mt-0.5">Trung tâm thanh toán và Theo dõi công nợ</p>
                </div>

                <div className="flex gap-2 -mb-px">
                    <button 
                        onClick={() => setTab('contracts')}
                        className={`px-5 py-3 text-sm font-bold border-b-[3px] transition-all flex items-center gap-2 ${activeTab === 'contracts' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-t-lg' : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
                    >
                        <span className="material-symbols-outlined text-[18px]">description</span>
                        Hợp đồng Thầu phụ
                    </button>
                    <button 
                        onClick={() => setTab('labor_tracking')}
                        className={`px-5 py-3 text-sm font-bold border-b-[3px] transition-all flex items-center gap-2 ${activeTab === 'labor_tracking' ? 'border-purple-600 text-purple-600 bg-purple-50/50 dark:bg-purple-900/10 rounded-t-lg' : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
                    >
                        <span className="material-symbols-outlined text-[18px]">list_alt</span>
                        Sổ Thanh Toán
                    </button>
                    <button 
                        onClick={() => setTab('master')}
                        className={`px-5 py-3 text-sm font-bold border-b-[3px] transition-all flex items-center gap-2 ${activeTab === 'master' ? 'border-purple-600 text-purple-600 bg-purple-50/50 dark:bg-purple-900/10 rounded-t-lg' : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
                    >
                        <span className="material-symbols-outlined text-[18px]">groups</span>
                        Công Nợ & Hồ Sơ
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden relative bg-slate-50">
                {activeTab === 'labor_tracking' && (
                    <div className="absolute inset-0 flex flex-col p-4 md:p-6 pb-20 overflow-hidden">
                        <LaborTracking embedded={true} />
                    </div>
                )}
                {activeTab === 'contracts' && (
                    <div className="absolute inset-0 flex flex-col p-4 md:p-6 pb-20 overflow-hidden">
                        <div className="h-full overflow-y-auto custom-scrollbar">
                            <SubcontractorContracts />
                        </div>
                    </div>
                )}
                {activeTab === 'master' && (
                    <div className="absolute inset-0 flex flex-col p-4 md:p-6 pb-20 overflow-hidden">
                        <div className="h-full overflow-y-auto custom-scrollbar">
                            <SubcontractorsMaster isModule={true} />
                        </div>
                    </div>
                )}
            </div>
            
            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 6px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
            `}</style>
        </div>
    );
}
