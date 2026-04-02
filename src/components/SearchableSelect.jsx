import React, { useState, useRef, useEffect } from 'react';

/**
 * SearchableSelect — Dropdown thả xuống có hỗ trợ gõ tìm kiếm
 * Dùng thay thế cho <select> gốc ở tất cả form trong app.
 * 
 * Props:
 *   options     — [{ value, label, sub? }]
 *   value       — giá trị hiện tại
 *   onChange    — callback(value)
 *   placeholder — text mặc định khi chưa chọn
 *   required    — bắt buộc chọn
 *   className   — class bổ sung cho container
 *   icon        — material icon name (optional)
 */
export default function SearchableSelect({
    options = [],
    value,
    onChange,
    placeholder = 'Chọn...',
    required = false,
    className = '',
    icon,
    disabled = false,
    direction = 'down', // 'down' hoặc 'up'
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const containerRef = useRef(null);
    const inputRef = useRef(null);

    const selectedOption = options.find(o => o.value === value);

    // Filter options by search query
    const filtered = options.filter(o => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
            o.label.toLowerCase().includes(q) ||
            (o.sub && o.sub.toLowerCase().includes(q))
        );
    });

    // Close on click outside
    useEffect(() => {
        const handler = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setIsOpen(false);
                setSearch('');
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Focus input when opened
    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    const handleSelect = (val) => {
        onChange(val);
        setIsOpen(false);
        setSearch('');
    };

    const handleClear = (e) => {
        e.stopPropagation();
        onChange('');
        setSearch('');
    };

    return (
        <div ref={containerRef} className={`relative ${className}`}>
            {/* Hidden native input for form validation */}
            {required && (
                <input
                    tabIndex={-1}
                    autoComplete="off"
                    style={{ position: 'absolute', opacity: 0, height: 0, width: 0, pointerEvents: 'none' }}
                    value={value || ''}
                    onChange={() => {}}
                    required
                />
            )}

            {/* Display / Trigger */}
            <button
                type="button"
                disabled={disabled}
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full bg-slate-50 border rounded-xl px-4 py-3 text-sm font-medium text-left flex items-center gap-2 transition-all outline-none
                    ${isOpen ? 'ring-2 ring-purple-500 border-purple-500 bg-white' : 'border-slate-200 hover:border-purple-300'}
                    ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
            >
                {icon && (
                    <span className="material-symbols-outlined text-[16px] text-slate-400 shrink-0">{icon}</span>
                )}
                <span className={`flex-1 truncate ${selectedOption ? 'text-slate-800' : 'text-slate-400'}`}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                {value && !disabled && (
                    <span
                        onClick={handleClear}
                        className="material-symbols-outlined text-[16px] text-slate-300 hover:text-slate-500 transition-colors shrink-0"
                    >close</span>
                )}
                <span className={`material-symbols-outlined text-[18px] text-slate-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                    expand_more
                </span>
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className={`absolute z-[200] left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-slide-up ${
                    direction === 'up' ? 'bottom-full mb-1 origin-bottom' : 'top-full mt-1 origin-top'
                }`}>
                    {/* Search input */}
                    <div className="p-2 border-b border-slate-100 sticky top-0 bg-white">
                        <div className="relative">
                            <span className="material-symbols-outlined text-[16px] text-slate-400 absolute left-3 top-1/2 -translate-y-1/2">search</span>
                            <input
                                ref={inputRef}
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Gõ để tìm kiếm..."
                                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400 transition-all"
                                onKeyDown={(e) => {
                                    if (e.key === 'Escape') {
                                        setIsOpen(false);
                                        setSearch('');
                                    }
                                    if (e.key === 'Enter' && filtered.length === 1) {
                                        handleSelect(filtered[0].value);
                                    }
                                }}
                            />
                        </div>
                    </div>

                    {/* Options list */}
                    <div className="max-h-52 overflow-y-auto overscroll-contain">
                        {filtered.length === 0 ? (
                            <div className="px-4 py-6 text-center text-sm text-slate-400">
                                <span className="material-symbols-outlined text-[24px] block mb-1 opacity-40">search_off</span>
                                Không tìm thấy kết quả
                            </div>
                        ) : (
                            filtered.map((opt) => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => handleSelect(opt.value)}
                                    className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-3 transition-colors
                                        ${opt.value === value
                                            ? 'bg-purple-50 text-purple-700 font-bold'
                                            : 'hover:bg-slate-50 text-slate-700'
                                        }
                                    `}
                                >
                                    <span className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all
                                        ${opt.value === value 
                                            ? 'bg-purple-600 border-purple-600 text-white' 
                                            : 'border-slate-300 bg-white'
                                        }`}
                                    >
                                        {opt.value === value && (
                                            <span className="material-symbols-outlined text-[14px]">check</span>
                                        )}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium truncate">{opt.label}</div>
                                        {opt.sub && (
                                            <div className="text-[11px] text-slate-400 truncate mt-0.5">{opt.sub}</div>
                                        )}
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
