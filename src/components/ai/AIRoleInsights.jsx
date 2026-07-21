import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { askAI } from '../../lib/aiAssistant';
import Icon from '../common/Icon';

/**
 * Nhận định AI theo VAI TRÒ, hiển thị trên dashboard.
 *
 * Cố ý KHÔNG tự chạy khi mở trang: mỗi lượt phân tích là một lần gọi API tốn tiền,
 * và người dùng thường chỉ cần khi thật sự muốn xem. Bấm nút mới chạy.
 * (AIFinanceInsights rule-based vẫn giữ nguyên bên cạnh — miễn phí, hiện tức thì.)
 */
const PROMPT_BY_ROLE = {
    ROLE02: 'Tóm tắt tình hình tài chính hiện tại cho giám đốc: dòng tiền, công nợ phải thu lớn nhất, công nợ phải trả thầu phụ, và 1-2 rủi ro cần quyết định. Ngắn gọn, mỗi ý 1 dòng.',
    ROLE05: 'Tóm tắt cho bộ phận thanh toán thầu phụ: bao nhiêu đề nghị đang chờ duyệt, bao nhiêu chờ chi, tổ đội/nhà thầu nào công nợ đến kỳ cao nhất. Ngắn gọn.',
    ROLE03: 'Tóm tắt cho bộ phận vật tư: vật tư nào biến động giá đáng chú ý, tồn kho nào sắp hết. Ngắn gọn.',
    ROLE09: 'Tóm tắt tồn kho hiện tại: vật tư nào sắp hết hoặc dưới định mức. Rất ngắn gọn.',
    ROLE10: 'Tóm tắt tồn kho toàn công ty: vật tư dưới định mức, vật tư tồn nhiều. Ngắn gọn.',
    ROLE11: 'Tóm tắt tồn kho: vật tư nào dưới định mức. Rất ngắn gọn.',
};
const DEFAULT_PROMPT = 'Tóm tắt tình hình hiện tại trong phạm vi dữ liệu tôi được xem: công nợ, dòng tiền hoặc tồn kho tùy vai trò của tôi. Ngắn gọn, tối đa 5 gạch đầu dòng.';

export default function AIRoleInsights() {
    const { profile } = useAuth();
    const [state, setState] = useState('idle');   // idle | loading | done | error
    const [text, setText] = useState('');
    const [err, setErr] = useState('');

    const run = async () => {
        setState('loading'); setErr('');
        const prompt = PROMPT_BY_ROLE[profile?.role_code] || DEFAULT_PROMPT;
        const res = await askAI([{ role: 'user', content: prompt }]);
        if (!res.ok) { setErr(res.error); setState('error'); return; }
        setText(res.answer); setState('done');
    };

    return (
        <div className="rounded-2xl border border-violet-200 dark:border-violet-500/25 bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-500/10 dark:to-indigo-500/10 p-4 md:p-5">
            <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                    <span className="w-9 h-9 rounded-xl bg-violet-600 text-white flex items-center justify-center shrink-0">
                        <Icon name="auto_awesome" size={20} />
                    </span>
                    <div className="min-w-0">
                        <h3 className="text-sm font-black text-slate-800 dark:text-white truncate">Nhận định AI</h3>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                            Theo vai trò: {profile?.roles?.name || profile?.role_code || 'Nhân viên'}
                        </p>
                    </div>
                </div>
                <button onClick={run} disabled={state === 'loading'}
                    className="shrink-0 px-3 py-2 min-h-[40px] rounded-xl bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-1.5">
                    {state === 'loading'
                        ? <><Icon name="progress_activity" size={16} className="animate-spin" />Đang phân tích...</>
                        : <><Icon name="auto_awesome" size={16} />{state === 'done' ? 'Phân tích lại' : 'Phân tích'}</>}
                </button>
            </div>

            {state === 'idle' && (
                <p className="text-[12px] text-slate-500 dark:text-slate-400">
                    Bấm <b>Phân tích</b> để AI đọc số liệu thật trong phạm vi quyền của bạn và tóm tắt những điểm đáng chú ý.
                </p>
            )}
            {state === 'error' && (
                <p className="text-[12px] text-rose-600 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-lg p-2.5">⚠️ {err}</p>
            )}
            {state === 'done' && (
                <div className="text-[13px] text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed bg-white/70 dark:bg-slate-900/40 rounded-xl p-3 border border-white dark:border-slate-700">
                    {text}
                    <p className="text-[9px] text-slate-400 mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                        AI có thể sai — đối chiếu số liệu gốc trước khi ra quyết định.
                    </p>
                </div>
            )}
        </div>
    );
}
