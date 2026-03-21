import React from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { ShieldAlert, ShieldCheck } from 'lucide-react';

ChartJS.register(ArcElement, Tooltip, Legend);

export default function LiquidityGauge({ data, ratio }) {

    let status = 'SAFE';
    let color = '#10b981';
    let message = 'An toàn biên độ cao. Đủ thanh khoản mở rộng.';
    let Icon = ShieldCheck;

    if (ratio < 1) {
        status = 'CRITICAL';
        color = '#f87171';
        message = 'RỦI RO VỠ NỢ. Hệ thống Hard Stop đã được kích hoạt.';
        Icon = ShieldAlert;
    } else if (ratio < 2) {
        status = 'DANGER';
        color = '#ef4444';
        message = 'Mất an toàn thanh khoản. Chuẩn bị siết chi.';
        Icon = ShieldAlert;
    } else if (ratio < 3) {
        status = 'WATCH';
        color = '#f59e0b';
        message = 'Theo dõi chặt chẽ. Tránh giải ngân vượt tuyến.';
    }

    const chartData = {
        labels: ['Quỹ Sinh Tồn (Operating)', 'Chi phí OPEX 1 Tháng'],
        datasets: [
            {
                data: [data.operatingBalance, data.monthlyOpex],
                backgroundColor: [color, 'rgba(255, 255, 255, 0.1)'],
                borderColor: ['rgba(0,0,0,0.5)', 'rgba(0,0,0,0.5)'],
                borderWidth: 2,
                cutout: '80%',
            },
        ],
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                callbacks: {
                    label: function (context) {
                        let label = context.label || '';
                        if (label) { label += ': '; }
                        if (context.parsed !== null) {
                            label += new Intl.NumberFormat('vi-VN').format(context.parsed) + ' đ';
                        }
                        return label;
                    }
                }
            }
        }
    };

    return (
        <div className="glass-panel" style={{ padding: '32px', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2>Chỉ số Máu (Liquidity Survival Ratio)</h2>
                <span className={`status-badge status-${status.toLowerCase()}`}>
                    {ratio.toFixed(2)}x
                </span>
            </div>

            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '48px' }}>
                <div style={{ position: 'relative', width: '250px', height: '250px' }}>
                    <Doughnut data={chartData} options={options} />

                    <div style={{
                        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <Icon size={40} style={{ color, marginBottom: '8px' }} />
                        <span style={{ fontSize: '2.5rem', fontWeight: 800, color, lineHeight: 1 }}>
                            {ratio.toFixed(1)}
                        </span>
                        <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Months Runway</span>
                    </div>
                </div>

                <div style={{ flex: 1 }}>
                    <div className="glass-card" style={{ marginBottom: '16px', background: `linear-gradient(90deg, ${color}22, transparent)` }}>
                        <h4 style={{ color, marginBottom: '8px', fontSize: '1.25rem' }}>{status} STATUS</h4>
                        <p className="text-secondary">{message}</p>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '8px' }}>
                            <span className="text-muted">Tổng Tiền Hoạt Động (A)</span>
                            <span style={{ fontWeight: 600 }}>{new Intl.NumberFormat('vi-VN').format(data.operatingBalance)} VNĐ</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '8px' }}>
                            <span className="text-muted">Chi phí Duy trì/tháng (B)</span>
                            <span style={{ fontWeight: 600 }}>{new Intl.NumberFormat('vi-VN').format(data.monthlyOpex)} VNĐ</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span className="text-muted">Tỷ lệ Sinh Tồn (A/B)</span>
                            <span style={{ fontWeight: 600, color }}>{ratio.toFixed(2)} Tháng</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
