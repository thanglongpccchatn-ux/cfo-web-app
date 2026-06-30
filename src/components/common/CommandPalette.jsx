/**
 * CommandPalette — nhảy nhanh giữa ~50 module bằng Ctrl/⌘ + K.
 * Tìm theo nhãn + nhóm (bỏ dấu tiếng Việt), điều hướng bằng phím ↑/↓/Enter, Esc để đóng.
 * Lọc theo quyền (admin xem tất cả). Không dùng glassmorphism nặng — gọn, nhanh.
 */
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { flattenNav } from '../../config/navigation';
import Icon from './Icon';

const norm = (s) =>
    (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');

export default function CommandPalette() {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [active, setActive] = useState(0);
    const navigate = useNavigate();
    const { profile, hasPermission } = useAuth();
    const inputRef = useRef(null);
    const listRef = useRef(null);

    const isAdmin = profile?.role_code === 'ROLE01' || profile?.role_code === 'ADMIN';

    const canView = useCallback((perms) => {
        if (isAdmin) return true;
        if (!perms || perms.length === 0) return false;
        if (perms.includes('*')) return true;
        return perms.some((p) => hasPermission(p));
    }, [isAdmin, hasPermission]);

    const allItems = useMemo(() => flattenNav().filter((it) => canView(it.perms)), [canView]);

    const results = useMemo(() => {
        const q = norm(query.trim());
        if (!q) return allItems;
        return allItems.filter((it) => norm(it.label).includes(q) || norm(it.group).includes(q));
    }, [query, allItems]);

    // Phím tắt toàn cục mở/đóng (reset state ngay trong handler, không dùng effect)
    useEffect(() => {
        const onKey = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setQuery('');
                setActive(0);
                setOpen((o) => !o);
            } else if (e.key === 'Escape') {
                setOpen(false);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    // Chỉ focus ô nhập khi mở (side-effect DOM, không setState)
    useEffect(() => {
        if (!open) return;
        const t = setTimeout(() => inputRef.current?.focus(), 30);
        return () => clearTimeout(t);
    }, [open]);

    const go = useCallback((item) => {
        if (!item) return;
        setOpen(false);
        navigate(`/${item.id}`);
    }, [navigate]);

    const onKeyDown = (e) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
        else if (e.key === 'Enter') { e.preventDefault(); go(results[active]); }
    };

    // Cuộn item active vào tầm nhìn
    useEffect(() => {
        const el = listRef.current?.querySelector(`[data-idx="${active}"]`);
        el?.scrollIntoView({ block: 'nearest' });
    }, [active]);

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] px-4 bg-slate-900/50"
            onClick={() => setOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-label="Tìm nhanh chức năng"
        >
            <div
                className="w-full max-w-xl bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center gap-3 px-4 border-b border-slate-100 dark:border-slate-700">
                    <Icon name="search" size={18} className="text-slate-400 flex-shrink-0" />
                    <input
                        ref={inputRef}
                        value={query}
                        onChange={(e) => { setQuery(e.target.value); setActive(0); }}
                        onKeyDown={onKeyDown}
                        placeholder="Tìm chức năng… (vd: hợp đồng, bút toán, vay)"
                        className="flex-1 py-3.5 bg-transparent outline-none text-sm text-slate-800 dark:text-white placeholder:text-slate-400"
                        aria-label="Ô tìm kiếm chức năng"
                    />
                    <kbd className="hidden sm:inline text-[10px] font-mono text-slate-400 border border-slate-200 dark:border-slate-600 rounded px-1.5 py-0.5">ESC</kbd>
                </div>

                <ul ref={listRef} className="max-h-[55vh] overflow-y-auto py-2" role="listbox">
                    {results.length === 0 && (
                        <li className="px-4 py-8 text-center text-sm text-slate-400">Không tìm thấy chức năng phù hợp</li>
                    )}
                    {results.map((it, idx) => (
                        <li key={`${it.id}-${idx}`} data-idx={idx} role="option" aria-selected={idx === active}>
                            <button
                                onMouseEnter={() => setActive(idx)}
                                onClick={() => go(it)}
                                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors cursor-pointer ${
                                    idx === active ? 'bg-primary/10 text-primary' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                                }`}
                            >
                                <Icon name={it.icon} size={18} className="flex-shrink-0" />
                                <span className="text-sm font-medium truncate flex-1">{it.label}</span>
                                <span className="text-[11px] text-slate-400 truncate">{it.group}</span>
                            </button>
                        </li>
                    ))}
                </ul>

                <div className="flex items-center justify-between px-4 py-2 border-t border-slate-100 dark:border-slate-700 text-[11px] text-slate-400">
                    <span>↑↓ chọn · Enter mở</span>
                    <span>{results.length} kết quả</span>
                </div>
            </div>
        </div>
    );
}
