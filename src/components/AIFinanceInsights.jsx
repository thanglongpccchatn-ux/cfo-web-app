import React, { useMemo } from 'react';

/**
 * AIFinanceInsights - A specialized component that provides automated financial
 * analysis based on professional rules (Reconciliation, Variance Analysis).
 */
export default function AIFinanceInsights({ financials, performance, planData, dashboardData }) {
    
    const fmt = (v) => v ? Number(Math.round(v)).toLocaleString('vi-VN') : '0';

    const insights = useMemo(() => {
        const list = [];
        const currentMonth = new Date().getMonth() + 1;
        const progressTarget = (currentMonth / 12) * 100;
        
        const targetRevenue = parseFloat(planData?.target_revenue) || 0;
        const achievedRevenue = financials?.totalIncomeThisYear || 0;
        const completionRate = targetRevenue > 0 ? (achievedRevenue / targetRevenue) * 100 : 0;

        // 1. Variance Analysis: Revenue Plan Gap
        if (targetRevenue > 0) {
            const gap = progressTarget - completionRate;
            if (gap > 10) {
                list.push({
                    type: 'variance',
                    title: 'Cảnh báo Tiến độ Doanh thu',
                    severity: 'rose',
                    icon: 'trending_down',
                    desc: `Hiện tại mới đạt ${completionRate.toFixed(1)}% mục tiêu năm, chậm ${gap.toFixed(1)}% so với tiến độ thời gian bình quân tính đến Tháng ${currentMonth}.`,
                    action: 'Cần đẩy nhanh nghiệm thu quyết toán các dự án đang thi công dở dang.'
                });
            } else if (gap <= 0) {
                list.push({
                    type: 'variance',
                    title: 'Hiệu suất Thu tiền Xuất sắc',
                    severity: 'emerald',
                    icon: 'auto_graph',
                    desc: `Thực thu đang vượt tiến độ thời gian (Đạt ${completionRate.toFixed(1)}% vs Mục tiêu kế hoạch).`,
                    action: 'Duy trì phong độ và tập trung tối ưu hóa lợi nhuận gộp.'
                });
            }
        }

        // 2. Reconciliation Insight: Debt vs. Invoice
        const totalDebt = financials?.totalDebtInvoiceAll || 0;
        const recoveryRate = financials?.recoveryRate || 0;
        
        if (recoveryRate < 70 && recoveryRate > 0) {
            list.push({
                type: 'reconciliation',
                title: 'Công nợ chưa thu hồi cao',
                severity: 'amber',
                icon: 'money_off',
                desc: `Tỷ lệ thu hồi dòng tiền hiện đạt ${recoveryRate.toFixed(1)}%. Khoảng ${fmt(totalDebt)} ₫ chưa được thu hồi sau khi đã xuất hóa đơn.`,
                action: 'Nên đối soát lại các biên bản nghiệm thu và gửi công văn nhắc nợ cho CĐT.'
            });
        }

        // 3. Billing Insight: Unsettled Projects
        const unsettledCount = dashboardData?.stats?.unsettledContracts || 0;
        if (unsettledCount > 5) {
            list.push({
                type: 'billing',
                title: 'Tồn đọng Quyết toán dự án',
                severity: 'indigo',
                icon: 'gavel',
                desc: `Có ${unsettledCount} dự án đã hoàn thành thi công nhưng chưa chốt quyết toán cuối cùng.`,
                action: 'Ưu tiên hoàn thiện hồ sơ hoàn công để giải phóng 5-10% giá trị hợp đồng còn lại.'
            });
        }

        // 4. Profitability Insight (from performance metrics)
        const avgLng = performance?.avg_lng_dt || 0;
        if (avgLng < 15 && avgLng > 0) {
            list.push({
                type: 'profit',
                title: 'Biên lợi nhuận gộp thấp',
                severity: 'rose',
                icon: 'analytics',
                desc: `Lợi nhuận gộp trung bình (${avgLng.toFixed(1)}%) đang thấp hơn mức kỳ vọng (thường >= 18%).`,
                action: 'Rà soát lại chi phí vật tư và nhân công trực tiếp tại các dự án trọng điểm.'
            });
        }

        return list;
    }, [financials, performance, planData, dashboardData]);

    if (insights.length === 0) return null;

    return (
        <div className="bg-slate-900 rounded-[32px] p-6 text-left relative overflow-hidden group shadow-xl">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
            
            <div className="flex items-center gap-4 mb-6 relative z-10">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg">
                    <span className="material-symbols-outlined text-[24px] animate-pulse">psychology</span>
                </div>
                <div>
                    <h3 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                        SATECO AI INSIGHTS
                        <span className="px-2 py-0.5 rounded-md bg-white/10 text-indigo-300 text-[10px] font-bold uppercase tracking-widest border border-white/10">BETA</span>
                    </h3>
                    <p className="text-indigo-200/60 text-[11px] font-bold uppercase tracking-widest">Phân tích chuyên sâu dựa trên tri thức AI Finance</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 relative z-10">
                {insights.map((insight, idx) => (
                    <div key={idx} className="bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/10 hover:bg-white/10 transition-all group/card flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <div className={`w-8 h-8 rounded-lg bg-${insight.severity}-500/20 text-${insight.severity}-400 flex items-center justify-center`}>
                                    <span className="material-symbols-outlined text-[18px]">{insight.icon}</span>
                                </div>
                                <span className={`text-[9px] font-black uppercase text-${insight.severity}-500 bg-${insight.severity}-500/10 px-2 py-0.5 rounded`}>
                                    {insight.type}
                                </span>
                            </div>
                            <h4 className="text-sm font-black text-white mb-2 leading-tight">{insight.title}</h4>
                            <p className="text-[12px] text-slate-400 font-medium leading-relaxed mb-4">{insight.desc}</p>
                        </div>
                        <div className="pt-3 border-t border-white/5 mt-auto">
                            <div className="flex items-start gap-2">
                                <span className="material-symbols-outlined text-[14px] text-indigo-400 mt-0.5">lightbulb</span>
                                <p className="text-[10px] font-bold text-indigo-300 italic">{insight.action}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-6 flex justify-end">
                <p className="text-[9px] font-bold text-slate-500 italic flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[12px]">verified</span>
                    Rules based on Anthropic Finance Framework
                </p>
            </div>
        </div>
    );
}
