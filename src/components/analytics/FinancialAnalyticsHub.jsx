import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import BalanceSheetDashboard from './BalanceSheetDashboard';
import IncomeStatementDashboard from './IncomeStatementDashboard';
import CashFlowDashboard from './CashFlowDashboard';
import CapitalAssetAnalysis from './CapitalAssetAnalysis';
import CFOOverviewDashboard from './CFOOverviewDashboard';
import PerformanceAnalysis from './PerformanceAnalysis';
import FinancialMatrixTables from './FinancialMatrixTables';
import SkeletonLoader from '../common/SkeletonLoader';

const TABS = [
    { id: 'bs', label: '1. Bảng cân đối kế toán', icon: 'account_balance' },
    { id: 'is', label: '2. Báo cáo KQ HĐKD', icon: 'monitoring' },
    { id: 'cf', label: '3. Báo cáo dòng tiền', icon: 'currency_exchange' },
    { id: 'nvts', label: '4. Phân tích Nguồn vốn - TS', icon: 'pie_chart' },
    { id: 'cfo', label: '5. CFO Overview', icon: 'space_dashboard' },
    { id: 'dupont', label: '6. Hiệu suất DuPont', icon: 'hub' },
    { id: 'matrix', label: '7. Financial Matrix', icon: 'dataset' }
];

export default function FinancialAnalyticsHub() {
    const [activeTab, setActiveTab] = useState('cfo');
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
    const [selectedMonth, setSelectedMonth] = useState('all');

    // MOCK DATA FETCHING (to be expanded with real TT200 or Operational Data)
    const { data, isLoading } = useQuery({
        queryKey: ['financial-analytics-data', selectedYear, selectedMonth],
        queryFn: async () => {
            // For now, we simulate fetching massive data
            return {
                message: "Financial data loaded",
                year: selectedYear,
                month: selectedMonth
            };
        },
        staleTime: 5 * 60 * 1000
    });

    return (
        <div className="flex flex-col h-[calc(100vh-100px)] space-y-4">
            {/* Global Filter Bar */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                        <span className="material-symbols-outlined text-2xl">finance</span>
                    </div>
                    <div>
                        <h2 className="text-lg font-black text-slate-800 leading-tight">Financial Analytics Suite</h2>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Power BI Style Dashboards</p>
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-32">
                        <select 
                            value={selectedMonth}
                            onChange={e => setSelectedMonth(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 appearance-none focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                            <option value="all">Cả năm</option>
                            {Array.from({length: 12}, (_, i) => <option key={i+1} value={i+1}>Tháng {i+1}</option>)}
                        </select>
                        <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-lg">expand_more</span>
                    </div>
                    <div className="relative flex-1 md:w-32">
                        <select 
                            value={selectedYear}
                            onChange={e => setSelectedYear(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 appearance-none focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                            <option value="2023">Năm 2023</option>
                            <option value="2024">Năm 2024</option>
                            <option value="2025">Năm 2025</option>
                            <option value="2026">Năm 2026</option>
                        </select>
                        <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-lg">expand_more</span>
                    </div>
                </div>
            </div>

            {/* Dashboard Content */}
            <div className="flex-1 bg-slate-100 rounded-2xl border border-slate-200 overflow-hidden relative shadow-inner">
                {isLoading ? (
                    <div className="p-6"><SkeletonLoader rows={5} /></div>
                ) : (
                    <div className="h-full overflow-y-auto no-scrollbar p-4 md:p-6 bg-gradient-to-br from-slate-50 to-indigo-50/20">
                        {activeTab === 'bs' && <BalanceSheetDashboard filter={{year: selectedYear, month: selectedMonth}} data={data} />}
                        {activeTab === 'is' && <IncomeStatementDashboard filter={{year: selectedYear, month: selectedMonth}} data={data} />}
                        {activeTab === 'cf' && <CashFlowDashboard filter={{year: selectedYear, month: selectedMonth}} data={data} />}
                        {activeTab === 'nvts' && <CapitalAssetAnalysis filter={{year: selectedYear, month: selectedMonth}} data={data} />}
                        {activeTab === 'cfo' && <CFOOverviewDashboard filter={{year: selectedYear, month: selectedMonth}} data={data} />}
                        {activeTab === 'dupont' && <PerformanceAnalysis filter={{year: selectedYear, month: selectedMonth}} data={data} />}
                        {activeTab === 'matrix' && <FinancialMatrixTables filter={{year: selectedYear, month: selectedMonth}} data={data} />}
                    </div>
                )}
            </div>

            {/* Navigation Tabs (Excel/Power BI style at bottom) */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex overflow-x-auto no-scrollbar shrink-0">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-5 py-3.5 whitespace-nowrap border-r border-slate-100 text-sm font-bold transition-all
                            ${activeTab === tab.id 
                                ? 'bg-blue-50 text-blue-700 border-b-2 border-b-blue-600' 
                                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700 border-b-2 border-b-transparent'
                            }`}
                    >
                        <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
                        {tab.label}
                    </button>
                ))}
            </div>
        </div>
    );
}
