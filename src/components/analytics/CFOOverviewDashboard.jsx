import React, { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Bar, Scatter } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function CFOOverviewDashboard({ filter, data }) {
    // Premium Dashboard styling with vibrant gradients and glassmorphism
    
    // MOCK DATA for demonstration of Power BI style CFO Overview
    const monthlyLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    // Combo Chart Data (Net Income vs Cash Flow)
    const comboData = {
        labels: monthlyLabels,
        datasets: [
            {
                type: 'line',
                label: 'Free Cash Flow (FCF)',
                borderColor: '#10b981', // Emerald
                backgroundColor: 'rgba(16, 185, 129, 0.2)',
                borderWidth: 3,
                tension: 0.4,
                fill: true,
                yAxisID: 'y',
                data: [120, 190, 30, 50, 200, 300, 250, 400, 350, 450, 500, 600]
            },
            {
                type: 'bar',
                label: 'Net Income',
                backgroundColor: 'rgba(59, 130, 246, 0.8)', // Blue
                borderRadius: 4,
                yAxisID: 'y',
                data: [150, 200, 50, 100, 180, 250, 220, 380, 310, 400, 480, 550]
            }
        ]
    };

    const comboOptions = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
            legend: { position: 'top', labels: { usePointStyle: true, boxWidth: 8, font: { family: 'Inter', weight: '600' } } },
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
            x: { grid: { display: false } },
            y: { 
                type: 'linear', 
                display: true, 
                position: 'left',
                grid: { color: '#f1f5f9', borderDash: [5, 5] },
                ticks: { callback: (value) => `$${value}k` }
            }
        }
    };

    // Store Performance Data
    const stores = [
        { name: 'Chi nhánh Hà Nội', roe: 24.5, roa: 12.2, margin: 15.4, rev: 12500 },
        { name: 'Chi nhánh HCM', roe: 32.1, roa: 15.8, margin: 18.2, rev: 18200 },
        { name: 'Chi nhánh Đà Nẵng', roe: 18.4, roa: 8.5, margin: 10.1, rev: 6400 },
        { name: 'Chi nhánh Cần Thơ', roe: 12.0, roa: 5.4, margin: 8.5, rev: 4200 },
        { name: 'Chi nhánh Hải Phòng', roe: 21.2, roa: 10.1, margin: 12.8, rev: 8900 },
    ];

    return (
        <div className="flex flex-col gap-6 h-full animate-fade-in pb-10">
            {/* Top Row: Executive KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <KPICard title="Net Sales" value="$42.5M" change="+12.5%" isPositive={true} icon="payments" color="from-blue-500 to-indigo-600" />
                <KPICard title="Net Income" value="$8.2M" change="+5.2%" isPositive={true} icon="account_balance_wallet" color="from-emerald-400 to-teal-500" />
                <KPICard title="Operating Cash Flow" value="$6.4M" change="-2.1%" isPositive={false} icon="currency_exchange" color="from-orange-400 to-red-500" />
                <KPICard title="ROE (Return on Equity)" value="24.8%" change="+1.2%" isPositive={true} icon="trending_up" color="from-purple-500 to-fuchsia-600" />
            </div>

            {/* Middle Row: Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[400px]">
                {/* Main Combo Chart */}
                <div className="col-span-1 lg:col-span-2 bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-emerald-400 opacity-50"></div>
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="text-lg font-black text-slate-800">Thu nhập ròng vs Lưu chuyển tiền thuần</h3>
                            <p className="text-sm text-slate-500 font-medium">Độ lệch dòng tiền (Cash Conversion) theo tháng</p>
                        </div>
                        <button className="text-slate-400 hover:text-blue-500 transition-colors">
                            <span className="material-symbols-outlined">more_vert</span>
                        </button>
                    </div>
                    <div className="flex-1 w-full min-h-0">
                        <ChartJSWrapper type="combo" data={comboData} options={comboOptions} />
                    </div>
                </div>

                {/* DuPont Breakdown / ROE drivers */}
                <div className="col-span-1 bg-gradient-to-b from-slate-900 to-slate-800 rounded-3xl p-6 shadow-xl border border-slate-700 flex flex-col text-white relative overflow-hidden">
                    <div className="absolute -right-20 -top-20 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl pointer-events-none"></div>
                    
                    <h3 className="text-lg font-black mb-1">DuPont Analysis</h3>
                    <p className="text-slate-400 text-sm font-medium mb-6">Động lực tăng trưởng ROE</p>

                    <div className="flex-1 flex flex-col justify-center space-y-6">
                        <DuPontRow label="Net Profit Margin" value="19.2%" target="15.0%" status="good" />
                        <div className="h-px w-full bg-slate-700/50"></div>
                        <DuPontRow label="Asset Turnover" value="1.25x" target="1.50x" status="warning" />
                        <div className="h-px w-full bg-slate-700/50"></div>
                        <DuPontRow label="Equity Multiplier" value="1.82x" target="2.00x" status="neutral" />
                    </div>
                </div>
            </div>

            {/* Bottom Row: Data Matrix */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="text-lg font-black text-slate-800">Hiệu suất theo Chi nhánh / Dự án</h3>
                        <p className="text-sm text-slate-500 font-medium">Bảng xếp hạng hiệu suất tài chính</p>
                    </div>
                    <button className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 text-slate-600 px-4 py-2 rounded-xl text-sm font-bold transition-colors">
                        <span className="material-symbols-outlined text-[18px]">download</span>
                        Export
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b-2 border-slate-100">
                                <th className="py-4 px-4 text-xs font-black text-slate-400 uppercase tracking-wider">Chi nhánh</th>
                                <th className="py-4 px-4 text-xs font-black text-slate-400 uppercase tracking-wider text-right">Doanh thu ($)</th>
                                <th className="py-4 px-4 text-xs font-black text-slate-400 uppercase tracking-wider text-right">Lợi nhuận gộp (%)</th>
                                <th className="py-4 px-4 text-xs font-black text-slate-400 uppercase tracking-wider text-right">ROA (%)</th>
                                <th className="py-4 px-4 text-xs font-black text-slate-400 uppercase tracking-wider text-right">ROE (%)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stores.map((s, i) => (
                                <tr key={i} className="border-b border-slate-50 hover:bg-blue-50/50 transition-colors group">
                                    <td className="py-4 px-4 font-bold text-slate-700">{s.name}</td>
                                    <td className="py-4 px-4 text-right font-medium text-slate-600">{s.rev.toLocaleString()}</td>
                                    <td className="py-4 px-4 text-right font-bold text-emerald-600">{s.margin}%</td>
                                    <td className="py-4 px-4 text-right font-medium text-slate-600">{s.roa}%</td>
                                    <td className="py-4 px-4 text-right">
                                        <span className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-black
                                            ${s.roe > 20 ? 'bg-emerald-100 text-emerald-700' : s.roe > 15 ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                                            {s.roe}%
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

// ─── Sub Components ───

function KPICard({ title, value, change, isPositive, icon, color }) {
    return (
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col relative overflow-hidden group hover:shadow-md transition-all duration-300 hover:-translate-y-1">
            <div className={`absolute -right-6 -top-6 w-24 h-24 bg-gradient-to-br ${color} opacity-10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700`}></div>
            
            <div className="flex justify-between items-start mb-4">
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${color} text-white flex items-center justify-center shadow-lg`}>
                    <span className="material-symbols-outlined">{icon}</span>
                </div>
                <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold
                    ${isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                    <span className="material-symbols-outlined text-[14px]">
                        {isPositive ? 'trending_up' : 'trending_down'}
                    </span>
                    {change}
                </div>
            </div>
            
            <div>
                <h4 className="text-slate-400 text-sm font-bold tracking-wide uppercase mb-1">{title}</h4>
                <p className="text-3xl font-black text-slate-800 tracking-tight">{value}</p>
            </div>
        </div>
    );
}

function DuPontRow({ label, value, target, status }) {
    const statusColor = {
        good: 'text-emerald-400',
        warning: 'text-orange-400',
        neutral: 'text-blue-400'
    }[status];

    return (
        <div className="flex justify-between items-end">
            <div>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">{label}</p>
                <div className="flex items-baseline gap-2">
                    <span className={`text-2xl font-black ${statusColor}`}>{value}</span>
                    <span className="text-xs text-slate-500 font-medium">Target: {target}</span>
                </div>
            </div>
            <div className="w-16 h-8 opacity-50">
                {/* Mini sparkline placeholder */}
                <svg viewBox="0 0 100 30" className="w-full h-full stroke-current" style={{color: status === 'good' ? '#34d399' : '#fb923c'}}>
                    <path d="M0,20 Q20,10 40,25 T80,10 T100,5" fill="none" strokeWidth="3" strokeLinecap="round" />
                </svg>
            </div>
        </div>
    );
}

// Wrapper for safe chart rendering
function ChartJSWrapper({ type, data, options }) {
    if (type === 'combo') {
        return <Bar data={data} options={options} />;
    }
    return <Line data={data} options={options} />;
}
