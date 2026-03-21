import React, { useState } from 'react';
import MonthlyReport from './MonthlyReport';
import InflowPlanning from './InflowPlanning';
import ExpenseTracking from './ExpenseTracking';
import MaterialExpensePlanning from './MaterialExpensePlanning';
import LaborExpensePlanning from './LaborExpensePlanning';

export default function PlanningModule() {
    const [subTab, setSubTab] = useState('monthly');

    const tabs = [
        { id: 'monthly', icon: 'table_chart', label: 'Báo cáo Thu - Chi Tháng' },
        { id: 'projects', icon: 'edit_calendar', label: 'Lập Kế hoạch Thu' },
        { id: 'materials', icon: 'inventory_2', label: 'Chi phí Vật tư' },
        { id: 'labor', icon: 'engineering', label: 'Chi phí Nhân công' },
        { id: 'expenses', icon: 'receipt_long', label: 'Quản lý Chi phí Chung' },
    ];

    return (
        <div className="space-y-6">
            {/* SUB-TABS HEADER */}
            <div className="flex items-center gap-1 bg-slate-100/80 p-1.5 rounded-2xl w-fit border border-slate-200 shadow-sm">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setSubTab(tab.id)}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                            subTab === tab.id 
                            ? 'bg-white text-indigo-600 shadow-sm' 
                            : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'
                        }`}
                    >
                        <span className="material-symbols-outlined notranslate text-[18px]" translate="no">{tab.icon}</span>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* CONTENT AREA */}
            <div className="animate-fade-in">
                {subTab === 'monthly' && <MonthlyReport />}
                {subTab === 'projects' && <InflowPlanning />}
                {subTab === 'materials' && <MaterialExpensePlanning />}
                {subTab === 'labor' && <LaborExpensePlanning />}
                {subTab === 'expenses' && <ExpenseTracking />}
            </div>
        </div>
    );
}
