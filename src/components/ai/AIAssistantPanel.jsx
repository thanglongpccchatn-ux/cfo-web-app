import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { askAI, suggestionsFor } from '../../lib/aiAssistant';
import Icon from '../common/Icon';

/**
 * Khung chat trợ lý AI — nút nổi góc phải, mở ra panel hỏi đáp.
 * AI chỉ đọc được dữ liệu trong quyền của người đang đăng nhập (RLS chặn ở Edge Function).
 */
export default function AIAssistantPanel() {
    const { profile } = useAuth();
    const [open, setOpen] = useState(false);
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState([]);   // {role, content, tools?}
    const [loading, setLoading] = useState(false);
    const [remaining, setRemaining] = useState(null);
    const endRef = useRef(null);

    const suggestions = suggestionsFor(profile?.role_code);

    useEffect(() => {
        if (open) endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, open, loading]);

    const send = async (text) => {
        const q = (text ?? input).trim();
        if (!q || loading) return;
        setInput('');
        const next = [...messages, { role: 'user', content: q }];
        setMessages(next);
        setLoading(true);

        const res = await askAI(next.map(m => ({ role: m.role, content: m.content })));
        setLoading(false);

        if (!res.ok) {
            setMessages([...next, { role: 'assistant', content: `⚠️ ${res.error}`, isError: true }]);
            return;
        }
        setRemaining(res.remaining);
        setMessages([...next, { role: 'assistant', content: res.answer, tools: res.toolsUsed }]);
    };

    return (
        <>
            {/* Nút nổi */}
            {!open && (
                <button
                    onClick={() => setOpen(true)}
                    aria-label="Mở trợ lý AI"
                    className="fixed z-[90] bottom-5 right-5 w-14 h-14 rounded-full bg-gradient-to-br from-violet-600 to-indigo-700 text-white shadow-xl shadow-violet-500/30 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
                >
                    <Icon name="auto_awesome" size={26} />
                </button>
            )}

            {/* Panel */}
            {open && (
                <div className="fixed z-[95] inset-0 sm:inset-auto sm:bottom-5 sm:right-5 sm:w-[420px] sm:h-[600px] sm:max-h-[85vh] bg-white dark:bg-slate-900 sm:rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden">
                    {/* Header */}
                    <div className="px-4 py-3 bg-gradient-to-r from-violet-600 to-indigo-700 text-white flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-2 min-w-0">
                            <Icon name="auto_awesome" size={20} />
                            <div className="min-w-0">
                                <div className="font-bold text-sm leading-tight">Trợ lý AI</div>
                                <div className="text-[10px] text-white/70 truncate">
                                    {profile?.roles?.name || profile?.role_code || 'Nhân viên'}
                                    {remaining != null && ` · còn ${remaining} lượt hôm nay`}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            {messages.length > 0 && (
                                <button onClick={() => setMessages([])} title="Xóa hội thoại"
                                    className="w-9 h-9 rounded-lg hover:bg-white/15 flex items-center justify-center">
                                    <Icon name="delete" size={18} />
                                </button>
                            )}
                            <button onClick={() => setOpen(false)} aria-label="Đóng"
                                className="w-9 h-9 rounded-lg hover:bg-white/15 flex items-center justify-center">
                                <Icon name="close" size={20} />
                            </button>
                        </div>
                    </div>

                    {/* Nội dung */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50 dark:bg-slate-900">
                        {messages.length === 0 && (
                            <div className="text-center pt-6">
                                <div className="w-14 h-14 rounded-2xl bg-violet-100 dark:bg-violet-500/15 text-violet-600 flex items-center justify-center mx-auto mb-3">
                                    <Icon name="auto_awesome" size={28} />
                                </div>
                                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Hỏi gì về số liệu công ty?</p>
                                <p className="text-[11px] text-slate-500 mt-1 mb-4 px-4">
                                    Tôi chỉ đọc được dữ liệu trong phạm vi quyền của bạn.
                                </p>
                                <div className="space-y-2">
                                    {suggestions.map(s => (
                                        <button key={s} onClick={() => send(s)}
                                            className="w-full text-left text-[12.5px] px-3 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-violet-400 hover:text-violet-700 dark:hover:text-violet-300 transition-colors min-h-[44px]">
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {messages.map((m, i) => (
                            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap break-words ${
                                    m.role === 'user'
                                        ? 'bg-violet-600 text-white rounded-br-sm'
                                        : m.isError
                                            ? 'bg-rose-50 text-rose-700 border border-rose-200 rounded-bl-sm dark:bg-rose-500/10 dark:text-rose-300'
                                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-bl-sm'
                                }`}>
                                    {m.content}
                                    {m.tools?.length > 0 && (
                                        <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700 flex flex-wrap gap-1">
                                            {m.tools.map((t, k) => (
                                                <span key={k} className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300">
                                                    {t.replace(/_/g, ' ')}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}

                        {loading && (
                            <div className="flex justify-start">
                                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <span className="w-2 h-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <span className="w-2 h-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                                    <span className="text-[11px] text-slate-400 ml-1">đang tra số liệu...</span>
                                </div>
                            </div>
                        )}
                        <div ref={endRef} />
                    </div>

                    {/* Ô nhập */}
                    <div className="p-3 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                        <div className="flex items-end gap-2">
                            <textarea
                                rows={1}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
                                }}
                                placeholder="Hỏi về công nợ, dòng tiền, tồn kho..."
                                className="flex-1 resize-none max-h-28 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-[13px] focus:ring-2 focus:ring-violet-500/40 focus:border-violet-400 outline-none"
                            />
                            <button onClick={() => send()} disabled={loading || !input.trim()}
                                aria-label="Gửi"
                                className="w-11 h-11 shrink-0 rounded-xl bg-violet-600 text-white flex items-center justify-center disabled:opacity-40 hover:bg-violet-700 active:scale-95 transition-all">
                                <Icon name="send" size={20} />
                            </button>
                        </div>
                        <p className="text-[9px] text-slate-400 mt-1.5 text-center">
                            AI có thể sai — luôn đối chiếu số liệu gốc trước khi ra quyết định.
                        </p>
                    </div>
                </div>
            )}
        </>
    );
}
