import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

export default function BalanceSheetDashboard({ filter, data }) {
    
    // Stacked Bar Data (Assets vs Liabilities/Equity)
    const stackedData = {
        labels: ['2022', '2023', '2024', '2025', '2026'],
        datasets: [
            {
                label: 'Tài sản ngắn hạn',
                backgroundColor: '#3b82f6', // Blue 500
                data: [1200, 1500, 1800, 2200, 2500],
                stack: 'Assets'
            },
            {
                label: 'Tài sản dài hạn',
                backgroundColor: '#93c5fd', // Blue 300
                data: [3000, 3100, 3400, 3800, 4200],
                stack: 'Assets'
            },
            {
                label: 'Nợ phải trả',
                backgroundColor: '#f43f5e', // Rose 500
                data: [2000, 2200, 2500, 2800, 3100],
                stack: 'LiabilitiesEquity'
            },
            {
                label: 'Vốn Chủ Sở Hữu',
                backgroundColor: '#10b981', // Emerald 500
                data: [2200, 2400, 2700, 3200, 3600],
                stack: 'LiabilitiesEquity'
            }
        ]
    };

    const stackedOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'top', labels: { usePointStyle: true, font: { family: 'Inter', weight: '600' } } },
            tooltip: {
                backgroundColor: 'rgba(15, 23, 42, 0.9)',
                titleFont: { family: 'Inter', size: 13 },
                bodyFont: { family: 'Inter', size: 13 },
                padding: 12,
                cornerRadius: 8,
                usePointStyle: true,
            }
        },
        scales: {
            x: { stacked: true, grid: { display: false } },
            y: { 
                stacked: true,
                grid: { color: '#f1f5f9', borderDash: [5, 5] },
                ticks: { callback: (value) => `$${value}k` }
            }
        }
    };

    return (
        <div className="flex flex-col gap-6 h-full animate-fade-in pb-10">
            {/* Top Row: Balance Sheet KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <BSCard title="Tổng Tài Sản" value="$6.7M" subtitle="Tăng trưởng 12.5% YoY" color="from-blue-500 to-indigo-600" />
                <BSCard title="Nợ phải trả" value="$3.1M" subtitle="Tỷ lệ Nợ/TS: 46%" color="from-rose-400 to-red-500" />
                <BSCard title="Vốn Chủ Sở Hữu" value="$3.6M" subtitle="ROE: 24.8%" color="from-emerald-400 to-teal-500" />
                <BSCard title="Vốn Lưu Động (Working Cap)" value="$1.4M" subtitle="Current Ratio: 1.8x" color="from-amber-400 to-orange-500" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Stacked Bar Chart */}
                <div className="col-span-1 lg:col-span-2 bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col relative overflow-hidden h-[450px]">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="text-lg font-black text-slate-800">Cơ cấu Nguồn vốn - Tài sản</h3>
                            <p className="text-sm text-slate-500 font-medium">Biến động 5 năm gần nhất</p>
                        </div>
                    </div>
                    <div className="flex-1 w-full min-h-0">
                        <Bar data={stackedData} options={stackedOptions} />
                    </div>
                </div>

                {/* Vertical Table / Tree view of Balance Sheet */}
                <div className="col-span-1 bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col">
                    <h3 className="text-lg font-black text-slate-800 mb-4">Chi tiết Số dư</h3>
                    
                    <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                        <AccountRow code="100" name="Tài sản ngắn hạn" amount="$2,500,000" isHeader />
                        <AccountRow code="110" name="Tiền & tương đương tiền" amount="$850,000" indent={1} />
                        <AccountRow code="130" name="Phải thu ngắn hạn" amount="$1,200,000" indent={1} />
                        <AccountRow code="140" name="Hàng tồn kho" amount="$450,000" indent={1} />
                        
                        <div className="h-px bg-slate-100 my-2"></div>
                        
                        <AccountRow code="200" name="Tài sản dài hạn" amount="$4,200,000" isHeader />
                        <AccountRow code="210" name="Tài sản cố định" amount="$3,800,000" indent={1} />
                        <AccountRow code="240" name="Bất động sản đầu tư" amount="$400,000" indent={1} />
                        
                        <div className="h-px bg-slate-800 my-4"></div>
                        
                        <AccountRow code="300" name="Nợ phải trả" amount="$3,100,000" isHeader />
                        <AccountRow code="310" name="Nợ ngắn hạn" amount="$1,400,000" indent={1} />
                        <AccountRow code="330" name="Nợ dài hạn" amount="$1,700,000" indent={1} />
                        
                        <div className="h-px bg-slate-100 my-2"></div>
                        
                        <AccountRow code="400" name="Vốn chủ sở hữu" amount="$3,600,000" isHeader />
                        <AccountRow code="411" name="Vốn góp CSH" amount="$2,000,000" indent={1} />
                        <AccountRow code="421" name="LNST chưa phân phối" amount="$1,600,000" indent={1} />
                    </div>
                </div>
            </div>
        </div>
    );
}

function BSCard({ title, value, subtitle, color }) {
    return (
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 relative overflow-hidden group">
            <div className={`absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b ${color}`}></div>
            <h4 className="text-slate-500 text-sm font-bold uppercase tracking-wider mb-2 pl-2">{title}</h4>
            <p className="text-4xl font-black text-slate-800 tracking-tight pl-2">{value}</p>
            <p className="text-slate-400 text-xs font-medium mt-3 pl-2">{subtitle}</p>
        </div>
    );
}

function AccountRow({ code, name, amount, isHeader, indent = 0 }) {
    return (
        <div className={`flex justify-between items-center py-1.5 ${isHeader ? 'mt-2' : ''}`} style={{ paddingLeft: `${indent * 1rem}px` }}>
            <div className="flex items-center gap-2">
                <span className={`text-xs ${isHeader ? 'font-black text-slate-800' : 'font-bold text-slate-400 w-8'}`}>{code}</span>
                <span className={`text-sm ${isHeader ? 'font-black text-slate-800' : 'font-medium text-slate-600'}`}>{name}</span>
            </div>
            <span className={`text-sm ${isHeader ? 'font-black text-slate-800' : 'font-bold text-slate-600'}`}>{amount}</span>
        </div>
    );
}
