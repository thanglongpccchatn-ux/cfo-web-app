import React, { useState } from 'react';
import { FastForward, Activity, AlertTriangle, ShieldCheck } from 'lucide-react';

export default function StressTestSimulator({ data }) {
    const [delayDays, setDelayDays] = useState(0);

    // Giả định Mock Data Nợ phải trả trong 90 ngày tới (có thể làm dynamic)
    const pendingLiabilities = 15000000000; // 15 Tỷ
    const dailyOpex = data.monthlyOpex / 30; // ~166 Triệu/ngày

    // Tính toán Mô phỏng
    const simulatedOpexHit = dailyOpex * delayDays;
    const projectedBalance = data.operatingBalance - simulatedOpexHit - pendingLiabilities;
    const simulatedRatio = projectedBalance > 0 ? (projectedBalance / data.monthlyOpex) : 0;

    // Render Status
    let simStatus = 'SAFE';
    let color = 'var(--safe-text)';
    if (projectedBalance < 0) {
        simStatus = 'INSOLVENT (VỠ NỢ)';
        color = 'var(--critical-text)';
    } else if (simulatedRatio < 1) {
        simStatus = 'CRITICAL (BÁO ĐỘNG ĐỎ)';
        color = 'var(--critical-text)';
    } else if (simulatedRatio < 2) {
        simStatus = 'DANGER (NGUY HIỂM)';
        color = 'var(--danger-text)';
    } else if (simulatedRatio < 3) {
        simStatus = 'WATCH (THEO DÕI)';
        color = 'var(--watch-text)';
    }

    return (
        <div className="glass-panel" style={{ padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FastForward className="text-gradient" size={24} />
                        Time-Machine: Liquidity Stress Test
                    </h2>
                    <p className="text-secondary mt-1">Simulate: "Chuyện gì xảy ra nếu Chủ đầu tư giam thanh toán X ngày?"</p>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '48px', alignItems: 'flex-start' }}>

                {/* Điều khiển kéo thả */}
                <div style={{ flex: 1 }}>
                    <div className="glass-card" style={{ marginBottom: '24px' }}>
                        <label style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, marginBottom: '16px' }}>
                            <span>Độ trễ dòng tiền (Days Delayed)</span>
                            <span className="text-danger">+{delayDays} Ngày</span>
                        </label>
                        <input
                            type="range"
                            min="0" max="90" step="5"
                            value={delayDays}
                            onChange={(e) => setDelayDays(parseInt(e.target.value))}
                            style={{ width: '100%', accentColor: 'var(--danger-text)', cursor: 'pointer' }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            <span>Đúng hạn (0d)</span>
                            <span>1 Tháng (30d)</span>
                            <span>2 Tháng (60d)</span>
                            <span>3 Tháng (90d)</span>
                        </div>
                    </div>

                    <div style={{ padding: '24px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
                        <h4 style={{ marginBottom: '16px', color: 'var(--text-secondary)' }}>Biến số đầu vào (Inputs)</h4>

                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                            <span className="text-muted">Quỹ hiện tại (Operating Cash)</span>
                            <span className="text-safe" style={{ fontWeight: 600 }}>{new Intl.NumberFormat('vi-VN').format(data.operatingBalance)}</span>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                            <span className="text-muted">Nợ Thầu Phụ sắp đến hạn (Payables)</span>
                            <span className="text-danger" style={{ fontWeight: 600 }}>-{new Intl.NumberFormat('vi-VN').format(pendingLiabilities)}</span>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--border-strong)', paddingBottom: '12px' }}>
                            <span className="text-muted">OpEx bốc hơi trong {delayDays} ngày tới</span>
                            <span className="text-danger" style={{ fontWeight: 600 }}>-{new Intl.NumberFormat('vi-VN').format(simulatedOpexHit)}</span>
                        </div>
                    </div>
                </div>

                {/* Màn hình kết quả */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div className={`glass-card ${projectedBalance < 0 ? 'status-critical' : ''}`} style={{ textAlign: 'center', padding: '40px 24px' }}>
                        <h3 className="text-muted" style={{ marginBottom: '12px' }}>Quỹ sinh tồn (Ngày thứ {delayDays})</h3>
                        <div style={{ fontSize: '3rem', fontWeight: 800, color, lineHeight: 1, textShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                            {projectedBalance < 0 ? '-' : ''}{new Intl.NumberFormat('vi-VN').format(Math.abs(projectedBalance))}
                        </div>
                        <p className="mt-4" style={{ fontSize: '1.25rem', color, fontWeight: 600 }}>{simStatus}</p>
                    </div>

                    <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        {simulatedRatio >= 2 ? <ShieldCheck size={32} className="text-safe" /> : <AlertTriangle size={32} className="text-critical" />}
                        <div>
                            <h4 className="text-primary">Safety Ratio Tương Lai</h4>
                            <p style={{ color, fontSize: '1.1rem', fontWeight: 600, marginTop: '4px' }}>{simulatedRatio.toFixed(2)}x Tháng Ops</p>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
