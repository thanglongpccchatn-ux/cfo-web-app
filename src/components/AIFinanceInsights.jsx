import React, { useMemo } from 'react';
import { fmt, fmtB } from '../utils/formatters';

/**
 * AIFinanceInsights - Automated financial analysis engine.
 * Now has 6 rule-based insights with relaxed thresholds to provide maximum value.
 */
export default function AIFinanceInsights({ financials, performance, planData, dashboardData }) {
    


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
                    desc: `Hiện tại mới đạt ${completionRate.toFixed(1)}% mục tiêu năm, chậm ${gap.toFixed(1)}% so với tiến độ thời gian đến Tháng ${currentMonth}.`,
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
            } else {
                list.push({
                    type: 'variance',
                    title: 'Tiến độ Doanh thu cần theo dõi',
                    severity: 'amber',
                    icon: 'monitoring',
                    desc: `Đạt ${completionRate.toFixed(1)}% mục tiêu năm, chậm ${gap.toFixed(1)}% so với timeline. Thu ${fmtB(achievedRevenue)}₫ / ${fmtB(targetRevenue)}₫.`,
                    action: 'Tiếp tục đẩy mạnh thu hồi nợ và quyết toán để bám sát kế hoạch.'
                });
            }
        }

        // 2. Reconciliation: Debt vs Invoice Recovery
        const totalDebt = financials?.totalDebtInvoiceAll || 0;
        const recoveryRate = financials?.recoveryRate || 0;
        
        if (recoveryRate < 80 && recoveryRate > 0) {
            list.push({
                type: 'reconciliation',
                title: 'Công nợ chưa thu hồi cao',
                severity: recoveryRate < 50 ? 'rose' : 'amber',
                icon: 'money_off',
                desc: `Tỷ lệ thu hồi dòng tiền hiện đạt ${recoveryRate.toFixed(1)}%. Khoảng ${fmtB(totalDebt)}₫ chưa được thu hồi sau khi đã xuất hóa đơn.`,
                action: 'Nên đối soát lại các biên bản nghiệm thu và gửi công văn nhắc nợ cho CĐT.'
            });
        }

        // 3. Billing: Unsettled Projects
        const unsettledCount = dashboardData?.stats?.unsettledContracts || 0;
        if (unsettledCount > 0) {
            list.push({
                type: 'billing',
                title: 'Tồn đọng Quyết toán dự án',
                severity: unsettledCount > 5 ? 'rose' : 'indigo',
                icon: 'gavel',
                desc: `Có ${unsettledCount} dự án đã hoàn thành thi công nhưng chưa chốt quyết toán cuối cùng.`,
                action: 'Ưu tiên hoàn thiện hồ sơ hoàn công để giải phóng 5-10% giá trị hợp đồng còn lại.'
            });
        }

        // 4. Profitability: Gross margin analysis
        const avgLng = performance?.avg_lng_dt || 0;
        if (avgLng > 0 && avgLng < 20) {
            list.push({
                type: 'profit',
                title: avgLng < 10 ? 'Biên lợi nhuận gộp rất thấp' : 'Biên lợi nhuận gộp cần cải thiện',
                severity: avgLng < 10 ? 'rose' : 'amber',
                icon: 'analytics',
                desc: `Lợi nhuận gộp trung bình (${avgLng.toFixed(1)}%) ${avgLng < 10 ? 'đang ở mức nguy hiểm' : 'đang thấp hơn mức kỳ vọng'} (tiêu chuẩn ngành >= 18%).`,
                action: 'Rà soát chi phí vật tư, nhân công trực tiếp và tỷ lệ chi phí ngoài kế hoạch.'
            });
        } else if (avgLng >= 20) {
            list.push({
                type: 'profit',
                title: 'Biên lợi nhuận ổn định',
                severity: 'emerald',
                icon: 'analytics',
                desc: `Lợi nhuận gộp TB đạt ${avgLng.toFixed(1)}%, trên mức kỳ vọng ngành (18%).`,
                action: 'Duy trì kiểm soát chi phí và tối ưu hợp đồng có biên thấp.'
            });
        }

        // 5. Unsigned Contracts Warning
        const unsignedCount = dashboardData?.stats?.unsignedContracts || 0;
        if (unsignedCount > 0) {
            list.push({
                type: 'compliance',
                title: `${unsignedCount} Hợp đồng chưa ký`,
                severity: unsignedCount > 3 ? 'rose' : 'amber',
                icon: 'draw',
                desc: `Có ${unsignedCount} dự án đang thi công nhưng hợp đồng chưa được ký chính thức. Rủi ro pháp lý và tài chính.`,
                action: 'Hoàn thiện hồ sơ pháp lý và đốc thúc ký hợp đồng ngay.'
            });
        }

        // 6. Cash-flow vs Expense balance
        const avgThuChi = performance?.avg_thu_chi || 0;
        if (avgThuChi > 0 && avgThuChi < 1) {
            list.push({
                type: 'cashflow',
                title: 'Mất cân đối Thu/Chi',
                severity: 'rose',
                icon: 'compare_arrows',
                desc: `Tỷ lệ thu/chi trung bình ${avgThuChi.toFixed(2)}x — chi phí đang lớn hơn doanh thu thực thu. Dòng tiền âm.`,
                action: 'Kiểm soát chặt chi phí và ưu tiên thu hồi nợ để đảm bảo thanh khoản.'
            });
        }

        return list.slice(0, 4); // Show max 4 insights
    }, [financials, performance, planData, dashboardData]);

    if (insights.length === 0) return null;

    return (
        <div className="bg-slate-900 rounded-[24px] md:rounded-[32px] p-4 md:p-6 text-left relative overflow-hidden group shadow-xl">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
            
            <div className="flex items-center gap-3 md:gap-4 mb-4 md:mb-6 relative z-10">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shrink-0">
                    <span className="material-symbols-outlined text-[20px] md:text-[24px] animate-pulse">psychology</span>
                </div>
                <div>
                    <h3 className="text-base md:text-xl font-black text-white tracking-tight flex items-center gap-2">
                        SATECO AI INSIGHTS
                        <span className="px-2 py-0.5 rounded-md bg-white/10 text-indigo-300 text-[10px] font-bold uppercase tracking-widest border border-white/10">BETA</span>
                    </h3>
                    <p className="text-indigo-200/60 text-[9px] md:text-[11px] font-bold uppercase tracking-widest">Phân tích chuyên sâu dựa trên tri thức AI Finance</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 relative z-10">
                {insights.map((insight, idx) => (
                    <div key={idx} className="bg-white/5 backdrop-blur-md rounded-xl md:rounded-2xl p-3 md:p-4 border border-white/10 hover:bg-white/10 transition-all group/card flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between mb-2 md:mb-3">
                                <div className={`w-7 h-7 md:w-8 md:h-8 rounded-lg bg-${insight.severity}-500/20 text-${insight.severity}-400 flex items-center justify-center`}>
                                    <span className="material-symbols-outlined text-[16px] md:text-[18px]">{insight.icon}</span>
                                </div>
                                <span className={`text-[8px] md:text-[9px] font-black uppercase text-${insight.severity}-500 bg-${insight.severity}-500/10 px-1.5 md:px-2 py-0.5 rounded`}>
                                    {insight.type}
                                </span>
                            </div>
                            <h4 className="text-xs md:text-sm font-black text-white mb-1.5 md:mb-2 leading-tight">{insight.title}</h4>
                            <p className="text-[10px] md:text-[12px] text-slate-400 font-medium leading-relaxed mb-3 md:mb-4">{insight.desc}</p>
                        </div>
                        <div className="pt-2 md:pt-3 border-t border-white/5 mt-auto">
                            <div className="flex items-start gap-1.5 md:gap-2">
                                <span className="material-symbols-outlined text-[12px] md:text-[14px] text-indigo-400 mt-0.5">lightbulb</span>
                                <p className="text-[9px] md:text-[10px] font-bold text-indigo-300 italic">{insight.action}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-4 md:mt-6 flex justify-end">
                <p className="text-[8px] md:text-[9px] font-bold text-slate-500 italic flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[12px]">verified</span>
                    Rules based on Anthropic Finance Framework
                </p>
            </div>
        </div>
    );
}
