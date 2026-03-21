import React, { useState } from 'react';
import { Lock, Unlock, AlertOctagon, Info } from 'lucide-react';

const mockProjects = [
    { id: 'PRJ-101', name: 'Landmark 81 - Tòa Tháp B', cashIn: 15000, cashOut: 12000, mode: 'STRICT_PROJECT', status: 'ACTIVE' },
    { id: 'PRJ-102', name: 'Cao tốc Bắc Nam - Gói 4', cashIn: 8000, cashOut: 9500, mode: 'COMPANY_LEVEL', status: 'WARNING' },
    { id: 'PRJ-103', name: 'Sân bay Long Thành - Terminal 2', cashIn: 2000, cashOut: 500, mode: 'STRICT_PROJECT', status: 'ACTIVE' },
];

export default function ProjectFirewall() {
    const [projects, setProjects] = useState(mockProjects);

    const toggleMode = (id) => {
        setProjects(projects.map(p => {
            if (p.id === id) {
                return {
                    ...p,
                    mode: p.mode === 'STRICT_PROJECT' ? 'COMPANY_LEVEL' : 'STRICT_PROJECT'
                };
            }
            return p;
        }));
    };

    const getNetBalance = (p) => p.cashIn - p.cashOut;

    return (
        <div className="glass-panel" style={{ padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                <div>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <AlertOctagon className="text-danger" size={24} />
                        Project Survival Firewall
                    </h2>
                    <p className="text-secondary mt-1">Phân quyền bơm vốn chéo. Chặn thầu phụ rút quỹ nếu dự án âm tiền.</p>
                </div>
                <button className="btn btn-glass">
                    <Info size={16} /> Hướng dẫn
                </button>
            </div>

            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-strong)', color: 'var(--text-muted)' }}>
                            <th style={{ padding: '16px 8px' }}>Mã DA</th>
                            <th style={{ padding: '16px 8px' }}>Tên Dự Án</th>
                            <th style={{ padding: '16px 8px' }}>Chủ Đầu Tư Trả (A)</th>
                            <th style={{ padding: '16px 8px' }}>Đã Chi Thầu Phụ (B)</th>
                            <th style={{ padding: '16px 8px' }}>Quỹ Dự Án (A - B)</th>
                            <th style={{ padding: '16px 8px' }}>Survival Mode</th>
                            <th style={{ padding: '16px 8px', textAlign: 'right' }}>Hành động</th>
                        </tr>
                    </thead>
                    <tbody>
                        {projects.map((p) => {
                            const net = getNetBalance(p);
                            const isNegative = net < 0;

                            return (
                                <tr key={p.id} style={{ borderBottom: '1px solid var(--border-light)', transition: 'background 0.2s' }}>
                                    <td style={{ padding: '16px 8px', fontWeight: 600 }}>{p.id}</td>
                                    <td style={{ padding: '16px 8px' }}>{p.name}</td>
                                    <td style={{ padding: '16px 8px', color: 'var(--safe-text)' }}>{p.cashIn} Tỷ</td>
                                    <td style={{ padding: '16px 8px', color: 'var(--danger-text)' }}>{p.cashOut} Tỷ</td>
                                    <td style={{ padding: '16px 8px' }}>
                                        <span className={`status-badge ${isNegative ? 'status-danger' : 'status-safe'}`}>
                                            {net} Tỷ
                                        </span>
                                    </td>
                                    <td style={{ padding: '16px 8px' }}>
                                        <span className={`status-badge ${p.mode === 'STRICT_PROJECT' ? 'status-watch' : 'status-critical'}`} style={{ display: 'flex', alignItems: 'center', gap: '4px', width: 'fit-content' }}>
                                            {p.mode === 'STRICT_PROJECT' ? <Lock size={12} /> : <Unlock size={12} />}
                                            {p.mode}
                                        </span>
                                    </td>
                                    <td style={{ padding: '16px 8px', textAlign: 'right' }}>
                                        <button
                                            className={`btn ${p.mode === 'STRICT_PROJECT' ? 'btn-danger' : 'btn-glass'}`}
                                            onClick={() => toggleMode(p.id)}
                                            style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                                        >
                                            Toggle Mode
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="glass-card mt-4" style={{ display: 'flex', gap: '16px', backgroundColor: 'rgba(245, 158, 11, 0.05)' }}>
                <Lock className="text-watch" size={24} />
                <div>
                    <h4 className="text-watch">Cảnh báo Cấu hình Tường Lửa</h4>
                    <p className="text-secondary" style={{ fontSize: '0.9rem', marginTop: '4px' }}>
                        <strong>STRICT_PROJECT:</strong> Ăn bao nhiêu làm bấy nhiêu. Hệ thống khoá chi lập tức nếu quỹ dự án &lt; 0.<br />
                        <strong>COMPANY_LEVEL:</strong> Dự án được sử dụng Quỹ Chung của Công Ty để trả nợ thầu phụ. (Nguy hiểm - Chỉ dành cho Dự án chiến lược).
                    </p>
                </div>
            </div>
        </div>
    );
}
