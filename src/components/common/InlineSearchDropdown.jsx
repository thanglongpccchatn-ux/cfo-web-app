import React, { useState, useRef, useEffect } from 'react';

/**
 * InlineSearchDropdown — Compact searchable dropdown for table inline edit
 * 
 * Props:
 *   items       - Array of { id, label, subLabel? }
 *   value       - Display value (text shown when not searching)
 *   onSelect    - (item) => void — called with the selected item
 *   placeholder - Placeholder text
 *   allowCreate - { enabled: boolean, onCreateNew?: (search) => Promise<void> }
 *   highlight   - boolean — if true, use orange styling (for primary fields)
 *   className   - additional classes
 */
const removeAccents = (str) => {
    if (!str) return '';
    return str.normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd').replace(/Đ/g, 'D');
};

export default function InlineSearchDropdown({
    items = [],
    value = '',
    onSelect,
    placeholder = 'Tìm...',
    allowCreate = null,
    highlight = false,
    className = '',
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const ref = useRef(null);

    useEffect(() => {
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) {
                setIsOpen(false);
                setSearch('');
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const filtered = items.filter(item => {
        if (!search) return true;
        const s = removeAccents(search.toLowerCase());
        return removeAccents(String(item.label || '').toLowerCase()).includes(s) ||
               (item.subLabel && removeAccents(String(item.subLabel).toLowerCase()).includes(s));
    });

    const hasExact = search && items.some(i => i.label.toLowerCase() === search.toLowerCase());

    const borderClass = highlight
        ? 'border-orange-400 focus:ring-orange-500/20 focus:border-orange-500 font-bold text-orange-700'
        : 'border-slate-300 focus:ring-orange-500/20 focus:border-orange-500';

    return (
        <div className={`relative ${className}`} ref={ref}>
            <input
                type="text"
                value={isOpen ? search : value}
                onChange={(e) => { setSearch(e.target.value); if (!isOpen) setIsOpen(true); }}
                onFocus={() => { setSearch(''); setIsOpen(true); }}
                placeholder={value || placeholder}
                className={`w-full bg-white border rounded px-2 py-1.5 outline-none text-xs ${borderClass}`}
            />
            {isOpen && (
                <div className="absolute z-50 left-0 right-0 top-full mt-0.5 bg-white border border-slate-300 rounded shadow-lg max-h-48 overflow-y-auto">
                    {filtered.map(item => (
                        <div
                            key={item.id}
                            onClick={() => { onSelect(item); setIsOpen(false); setSearch(''); }}
                            className="px-2 py-1.5 text-xs cursor-pointer hover:bg-orange-50 transition-colors border-b border-slate-100 last:border-0"
                        >
                            {item.subLabel && <span className={`font-bold ${highlight ? 'text-orange-500' : 'text-slate-500'} mr-1`}>[{item.subLabel}]</span>}
                            <span className="font-medium">{item.label}</span>
                        </div>
                    ))}
                    {/* Allow create new */}
                    {allowCreate?.enabled && search && !hasExact && (
                        <div
                            onClick={async () => {
                                if (allowCreate.onCreateNew) await allowCreate.onCreateNew(search);
                                setIsOpen(false);
                                setSearch('');
                            }}
                            className="px-2 py-1.5 text-xs cursor-pointer hover:bg-emerald-50 transition-colors border-t border-emerald-200 text-emerald-700 font-bold flex items-center gap-1"
                        >
                            <span className="material-symbols-outlined text-[14px]">add_circle</span>
                            Thêm "{search}"
                        </div>
                    )}
                    {filtered.length === 0 && !search && (
                        <div className="px-2 py-2 text-xs text-slate-400 text-center">Không có mục nào</div>
                    )}
                    {filtered.length === 0 && search && !allowCreate?.enabled && (
                        <div className="px-2 py-2 text-xs text-slate-400 text-center">Không tìm thấy "{search}"</div>
                    )}
                </div>
            )}
        </div>
    );
}
