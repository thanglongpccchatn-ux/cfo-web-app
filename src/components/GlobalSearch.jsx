import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { fmt } from '../utils/formatters';

/**
 * GlobalSearch — Command palette-style search (Ctrl+K / Cmd+K)
 * Searches projects, payments, partners across the system.
 */
export default function GlobalSearch() {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef(null);
    const navigate = useNavigate();

    // Keyboard shortcut: Ctrl+K or Cmd+K
    useEffect(() => {
        const handler = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                setIsOpen(prev => !prev);
            }
            if (e.key === 'Escape') setIsOpen(false);
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    // Focus input when modal opens
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 100);
            setQuery('');
            setResults([]);
            setSelectedIndex(0);
        }
    }, [isOpen]);

    // Quick menu items (when no query)
    const quickActions = [
        { type: 'nav', icon: 'dashboard', label: 'Tổng quan', desc: 'Dashboard chính', route: '/dashboard' },
        { type: 'nav', icon: 'description', label: 'Hợp đồng', desc: 'Danh sách hợp đồng', route: '/contracts' },
        { type: 'nav', icon: 'folder_open', label: 'Hồ sơ & Thanh toán', desc: 'Theo dõi hồ sơ', route: '/doc_tracking' },
        { type: 'nav', icon: 'receipt_long', label: 'Lịch sử thu tiền', desc: 'Payment receipts', route: '/payment_receipts' },
        { type: 'nav', icon: 'analytics', label: 'Kế hoạch & Báo cáo', desc: 'Kế hoạch dòng tiền', route: '/planning_hub' },
        { type: 'nav', icon: 'gavel', label: 'Đấu thầu', desc: 'Theo dõi báo giá', route: '/bidding' },
        { type: 'nav', icon: 'edit_note', label: 'Phát sinh', desc: 'Quản lý phát sinh', route: '/variations' },
        { type: 'nav', icon: 'security', label: 'Bảo hành', desc: 'Theo dõi bảo hành', route: '/warranty' },
        { type: 'nav', icon: 'balance', label: 'Quyết toán', desc: 'Quản lý quyết toán', route: '/settlement' },
        { type: 'nav', icon: 'credit_card', label: 'Vay vốn', desc: 'Quản lý khoản vay', route: '/loans' },
        { type: 'nav', icon: 'groups', label: 'Nhân công', desc: 'Chi phí nhân công', route: '/labor_tracking' },
        { type: 'nav', icon: 'local_shipping', label: 'Nhà cung cấp', desc: 'Quản lý NCC', route: '/suppliers' },
        { type: 'nav', icon: 'engineering', label: 'Thầu phụ / Tổ đội', desc: 'Công nợ thầu phụ', route: '/subcontractors' },
        { type: 'nav', icon: 'inventory_2', label: 'Kho vật tư', desc: 'Quản lý kho', route: '/inventory' },
        { type: 'nav', icon: 'edit_calendar', label: 'Nhật ký', desc: 'Nhật ký hiện trường', route: '/site_diary' },
        { type: 'nav', icon: 'construction', label: 'Thi công', desc: 'Module thi công', route: '/construction' },
        { type: 'nav', icon: 'settings', label: 'Cài đặt', desc: 'Cài đặt hệ thống', route: '/settings' },
    ];

    // Debounced search
    const searchTimer = useRef(null);
    const handleSearch = useCallback((q) => {
        setQuery(q);
        setSelectedIndex(0);

        if (searchTimer.current) clearTimeout(searchTimer.current);
        
        if (!q.trim()) {
            setResults([]);
            return;
        }

        searchTimer.current = setTimeout(async () => {
            setLoading(true);
            try {
                const searchTerm = `%${q.trim()}%`;
                
                // Search projects
                const { data: projects } = await supabase
                    .from('projects')
                    .select('id, code, internal_code, name, status, original_value, partners!projects_partner_id_fkey(name, short_name)')
                    .or(`name.ilike.${searchTerm},code.ilike.${searchTerm},internal_code.ilike.${searchTerm}`)
                    .limit(8);

                // Search partners
                const { data: partners } = await supabase
                    .from('partners')
                    .select('id, name, code, type')
                    .or(`name.ilike.${searchTerm},code.ilike.${searchTerm}`)
                    .limit(5);

                const formatted = [];

                // Format projects
                (projects || []).forEach(p => {
                
                    formatted.push({
                        type: 'project',
                        icon: 'folder_open',
                        label: p.internal_code || p.code || 'N/A',
                        desc: `${p.name} — ${p.partners?.short_name || p.partners?.name || ''} — ${fmt(p.original_value)}₫`,
                        status: p.status,
                        route: '/contracts',
                        data: p,
                    });
                });

                // Format partners
                (partners || []).forEach(p => {
                    formatted.push({
                        type: 'partner',
                        icon: p.type === 'Client' ? 'business' : 'local_shipping',
                        label: p.name,
                        desc: `${p.code || ''} — ${p.type === 'Client' ? 'Chủ đầu tư' : 'Nhà cung cấp'}`,
                        route: p.type === 'Client' ? '/contracts' : '/suppliers',
                    });
                });

                // Filter quick actions by query too
                const matchedNav = quickActions.filter(a =>
                    a.label.toLowerCase().includes(q.toLowerCase()) ||
                    a.desc.toLowerCase().includes(q.toLowerCase())
                );

                setResults([...formatted, ...matchedNav.slice(0, 3)]);
            } catch (err) {
                console.error('Search error:', err);
            } finally {
                setLoading(false);
            }
        }, 250);
    }, []);

    // Keyboard navigation
    const handleKeyDown = (e) => {
        const items = query ? results : quickActions;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => Math.min(prev + 1, items.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const selected = items[selectedIndex];
            if (selected) handleSelect(selected);
        }
    };

    const handleSelect = (item) => {
        setIsOpen(false);
        if (item.route) navigate(item.route);
    };

    const displayItems = query.trim() ? results : quickActions;

    if (!isOpen) {
        return (
            <div className="relative hidden md:block">
                <button
                    onClick={() => setIsOpen(true)}
                    className="flex items-center gap-2 pl-3 pr-3 py-2 w-64 bg-slate-50 dark:bg-slate-800 rounded-full text-sm text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors border border-transparent hover:border-slate-200"
                >
                    <span className="material-symbols-outlined notranslate text-[18px]" translate="no">search</span>
                    <span className="flex-1 text-left">Tìm kiếm hợp đồng...</span>
                    <kbd className="text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-500 px-1.5 py-0.5 rounded">Ctrl+K</kbd>
                </button>
            </div>
        );
    }

    return (
        <>
            {/* Backdrop */}
            <div 
                className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] animate-in fade-in duration-150"
                onClick={() => setIsOpen(false)}
            />
            
            {/* Search Modal */}
            <div className="fixed inset-x-0 top-[10%] mx-auto w-[90vw] max-w-2xl z-[201] animate-in slide-in-from-top-4 duration-200" role="dialog" aria-modal="true" aria-label="Tìm kiếm nhanh">
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    {/* Search Input */}
                    <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-800">
                        <span className="material-symbols-outlined text-[22px] text-blue-500">search</span>
                        <input
                            ref={inputRef}
                            type="text"
                            value={query}
                            onChange={(e) => handleSearch(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Tìm hợp đồng, dự án, đối tác, hoặc chức năng..."
                            className="flex-1 text-base text-slate-800 dark:text-white bg-transparent outline-none placeholder-slate-400"
                            autoComplete="off"
                        />
                        {loading && (
                            <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent" />
                        )}
                        <kbd 
                            onClick={() => setIsOpen(false)}
                            className="text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-400 px-2 py-1 rounded cursor-pointer hover:bg-slate-200"
                        >
                            ESC
                        </kbd>
                    </div>

                    {/* Results List */}
                    <div className="max-h-[60vh] overflow-y-auto py-2" role="listbox" aria-label="Kết quả tìm kiếm">
                        {!query.trim() && (
                            <div className="px-4 py-1.5">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Chuyển nhanh</span>
                            </div>
                        )}
                        
                        {query.trim() && results.length === 0 && !loading && (
                            <div className="px-5 py-8 text-center">
                                <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">search_off</span>
                                <p className="text-sm text-slate-400">Không tìm thấy kết quả cho "{query}"</p>
                            </div>
                        )}

                        {displayItems.map((item, idx) => (
                            <button
                                key={`${item.type}-${idx}`}
                                onClick={() => handleSelect(item)}
                                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                                    idx === selectedIndex 
                                        ? 'bg-blue-50 dark:bg-blue-900/20' 
                                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                }`}
                            >
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                    item.type === 'project' ? 'bg-blue-100 text-blue-600' :
                                    item.type === 'partner' ? 'bg-emerald-100 text-emerald-600' :
                                    'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                                }`}>
                                    <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-bold text-slate-800 dark:text-white truncate">{item.label}</span>
                                        {item.status && (
                                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
                                                item.status === 'Đang thi công' ? 'bg-blue-100 text-blue-600' :
                                                item.status === 'Đã hoàn thành' ? 'bg-emerald-100 text-emerald-600' :
                                                'bg-slate-100 text-slate-500'
                                            }`}>{item.status}</span>
                                        )}
                                    </div>
                                    <p className="text-[11px] text-slate-400 truncate">{item.desc}</p>
                                </div>
                                {idx === selectedIndex && (
                                    <span className="text-[10px] text-slate-400 font-bold shrink-0">Enter ↵</span>
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Footer */}
                    <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <div className="flex items-center gap-3 text-[10px] text-slate-400 font-bold">
                            <span>↑↓ Di chuyển</span>
                            <span>↵ Chọn</span>
                            <span>ESC Đóng</span>
                        </div>
                        <span className="text-[10px] font-bold text-blue-400">SATECO Search</span>
                    </div>
                </div>
            </div>
        </>
    );
}
