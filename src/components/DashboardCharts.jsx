import React from 'react';
import { formatBillion } from '../utils/formatters';
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
  ArcElement,
  Filler,
} from 'chart.js';
import { Line, Doughnut, Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);



export function CashFlowChart({ data }) {
    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: 'rgba(15, 23, 42, 0.9)',
                padding: 12,
                titleFont: { size: 12, weight: 'bold' },
                bodyFont: { size: 12 },
                callbacks: {
                    label: (context) => ` Thực thu: ${formatBillion(context.raw)} Tỷ`
                }
            }
        },
        scales: {
            y: { 
                grid: { color: 'rgba(226, 232, 240, 0.4)', drawBorder: false },
                ticks: { font: { size: 10, weight: '600' }, color: '#64748b' }
            },
            x: { 
                grid: { display: false },
                ticks: { font: { size: 10, weight: '600' }, color: '#64748b' }
            }
        }
    };

    const chartData = {
        labels: data.labels || [],
        datasets: [{
            fill: true,
            label: 'Thực thu',
            data: data.values || [],
            borderColor: '#3b82f6',
            backgroundColor: (context) => {
                const ctx = context.chart.ctx;
                const gradient = ctx.createLinearGradient(0, 0, 0, 300);
                gradient.addColorStop(0, 'rgba(59, 130, 246, 0.2)');
                gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');
                return gradient;
            },
            tension: 0.4,
            pointRadius: 4,
            pointBackgroundColor: '#fff',
            pointBorderColor: '#3b82f6',
            pointBorderWidth: 2,
        }]
    };

    return <Line options={options} data={chartData} />;
}

export function PortfolioChart({ data }) {
    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { 
                position: 'right',
                labels: { 
                    usePointStyle: true, 
                    pointStyle: 'circle',
                    font: { size: 11, weight: '600' },
                    padding: 15
                }
            },
            tooltip: {
                callbacks: {
                    label: (context) => ` ${context.label}: ${formatBillion(context.raw)} Tỷ`
                }
            }
        },
        cutout: '70%'
    };

    const chartData = {
        labels: data.labels || [],
        datasets: [{
            data: data.values || [],
            backgroundColor: [
                '#3b82f6', // blue
                '#10b981', // emerald
                '#f59e0b', // amber
                '#ef4444', // rose
                '#6366f1', // indigo
                '#94a3b8'  // slate
            ],
            borderWidth: 0,
            hoverOffset: 10
        }]
    };

    return <Doughnut options={options} data={chartData} />;
}

export function ReceivablesAgingChart({ data }) {
    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11, weight: '600' } } },
            tooltip: {
                callbacks: { label: (context) => ` ${context.dataset.label}: ${formatBillion(context.raw)} Tỷ` }
            }
        },
        scales: {
            y: { 
                stacked: false,
                grid: { color: 'rgba(226, 232, 240, 0.4)' },
                ticks: { font: { size: 10 } }
            },
            x: { grid: { display: false }, ticks: { font: { size: 10 } } }
        }
    };

    const chartData = {
        labels: data.labels || [],
        datasets: [
            {
                label: 'Tổng xuất HĐ',
                data: data.invoiceValues || [],
                backgroundColor: '#cbd5e1',
                borderRadius: 4,
            },
            {
                label: 'Thực thu',
                data: data.incomeValues || [],
                backgroundColor: '#3b82f6',
                borderRadius: 4,
            }
        ]
    };

    return <Bar options={options} data={chartData} />;
}

export function TopProfitChart({ data }) {
    const options = {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                callbacks: { label: (context) => ` Lợi nhuận dự kiến: ${formatBillion(context.raw)} Tỷ` }
            }
        },
        scales: {
            x: { grid: { display: false }, ticks: { font: { size: 10 } } },
            y: { grid: { display: false }, ticks: { font: { size: 11, weight: '700' }, color: '#475569' } }
        }
    };

    const chartData = {
        labels: data.labels || [],
        datasets: [{
            label: 'Lợi nhuận',
            data: data.values || [],
            backgroundColor: (context) => {
                const ctx = context.chart.ctx;
                const gradient = ctx.createLinearGradient(0, 0, 400, 0);
                gradient.addColorStop(0, '#10b981');
                gradient.addColorStop(1, '#34d399');
                return gradient;
            },
            borderRadius: 8,
            barThickness: 24,
        }]
    };

    return <Bar options={options} data={chartData} />;
}
