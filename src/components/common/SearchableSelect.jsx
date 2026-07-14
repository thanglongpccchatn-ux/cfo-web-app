import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

/**
 * SearchableSelect Component
 * A premium dropdown with seamless direct-input search and glassmorphism styling
 */
const removeAccents = (str) => {
    if (!str) return '';
    return str.normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D');
};

export default function SearchableSelect({ 
    options = [], 
    value, 
    onChange, 
    placeholder = "Chọn mục...", 
    className = "",
    disabled = false,
    loading = false
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [coords, setCoords] = useState(null);
    const wrapperRef = useRef(null);
    const inputRef = useRef(null);
    const dropdownRef = useRef(null);

    const selectedOption = options.find(opt => opt.id === value);

    // Close on click outside (kể cả khi dropdown render qua portal)
    useEffect(() => {
        function handleClickOutside(event) {
            const inWrapper = wrapperRef.current && wrapperRef.current.contains(event.target);
            const inDropdown = dropdownRef.current && dropdownRef.current.contains(event.target);
            if (!inWrapper && !inDropdown) {
                setIsOpen(false);
                setSearchTerm('');
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Định vị dropdown theo vị trí ô input (fixed) — không bị cắt bởi overflow của bảng/thẻ cha
    useEffect(() => {
        if (!isOpen) return;
        const update = () => {
            const el = wrapperRef.current;
            if (!el) return;
            const r = el.getBoundingClientRect();
            const spaceBelow = window.innerHeight - r.bottom;
            const DROP_H = 350;
            const flipUp = spaceBelow < DROP_H && r.top > spaceBelow;
            setCoords(flipUp
                ? { bottom: window.innerHeight - r.top + 6, left: r.left, width: r.width }
                : { top: r.bottom + 6, left: r.left, width: r.width });
        };
        update();
        window.addEventListener('scroll', update, true);
        window.addEventListener('resize', update);
        return () => {
            window.removeEventListener('scroll', update, true);
            window.removeEventListener('resize', update);
        };
    }, [isOpen]);

    // Tìm kiếm thông minh: không dấu, tách theo khoảng trắng thành nhiều từ khóa,
    // MỖI từ khóa chỉ cần xuất hiện trong nhãn (không cần liền nhau, không cần đúng thứ tự).
    const tokens = removeAccents(searchTerm.toLowerCase()).split(/\s+/).filter(Boolean);
    const filteredOptions = options.filter(opt => {
        if (tokens.length === 0) return true;
        const label = removeAccents(String(opt.label || '').toLowerCase());
        const subLabel = opt.subLabel ? removeAccents(String(opt.subLabel).toLowerCase()) : '';
        const hay = `${label} ${subLabel}`;
        return tokens.every(t => hay.includes(t));
    });

    const handleInputChange = (e) => {
        setSearchTerm(e.target.value);
        if (!isOpen) setIsOpen(true);
    };

    const handleInputFocus = () => {
        if (!disabled) {
            setIsOpen(true);
        }
    };

    const handleSelect = (opt) => {
        onChange(opt.id);
        setIsOpen(false);
        setSearchTerm('');
    };

    return (
        <div ref={wrapperRef} className={`relative ${className} w-full`}>
            {/* Main Input Container */}
            <div className="relative group">
                <input
                    ref={inputRef}
                    type="text"
                    value={isOpen ? searchTerm : (selectedOption ? selectedOption.label : '')}
                    onChange={handleInputChange}
                    onFocus={handleInputFocus}
                    placeholder={selectedOption ? selectedOption.label : placeholder}
                    disabled={disabled}
                    className={`
                        w-full px-4 py-3.5 rounded-2xl text-sm font-bold transition-all outline-none border
                        ${isOpen 
                            ? 'border-blue-500 bg-white ring-4 ring-blue-500/10 shadow-lg' 
                            : 'border-slate-200 bg-slate-50/50 hover:bg-white hover:border-slate-300'}
                        ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-100' : 'cursor-text'}
                        ${!selectedOption && !isOpen ? 'text-slate-400' : 'text-slate-900'}
                    `}
                />
                
                {/* Icons Area */}
                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 text-slate-400 pointer-events-none">
                    {loading && (
                        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    )}
                    <span className={`material-symbols-outlined transition-transform duration-300 ${isOpen ? 'rotate-180 text-blue-500' : 'text-slate-400'}`}>
                        expand_more
                    </span>
                </div>

                {/* Clear Button (only when typing) */}
                {isOpen && searchTerm && (
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            setSearchTerm('');
                        }}
                        className="absolute right-12 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 rounded-full transition-colors pointer-events-auto"
                    >
                        <span className="material-symbols-outlined text-[16px] text-slate-400">close</span>
                    </button>
                )}
            </div>

            {/* Dropdown Results — render qua portal (fixed) để không bị bảng/thẻ cha cắt */}
            {isOpen && coords && createPortal(
                <div ref={dropdownRef} style={{ position: 'fixed', top: coords.top, bottom: coords.bottom, left: coords.left, width: coords.width, zIndex: 9999 }} className="bg-white/95 backdrop-blur-xl border border-slate-200 rounded-2xl shadow-2xl overflow-hidden animate-slide-up max-h-[350px] flex flex-col ring-1 ring-black/5">
                    <div className="overflow-y-auto no-scrollbar py-2">
                        {filteredOptions.length === 0 ? (
                            <div className="px-6 py-10 text-center space-y-2">
                                <span className="material-symbols-outlined text-4xl text-slate-200">search_off</span>
                                <p className="text-slate-400 text-xs italic">Không tìm thấy kết quả cho "{searchTerm}"</p>
                            </div>
                        ) : (
                            filteredOptions.map((opt) => (
                                <div
                                    key={opt.id}
                                    onClick={() => handleSelect(opt)}
                                    className={`
                                        px-5 py-3.5 text-sm cursor-pointer transition-all flex flex-col gap-1 border-l-4
                                        ${opt.id === value 
                                            ? 'bg-blue-50/80 border-blue-500 text-blue-700' 
                                            : 'hover:bg-slate-50 border-transparent text-slate-700 hover:border-slate-300'}
                                    `}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className={`font-bold ${opt.id === value ? 'text-blue-700' : 'text-slate-800'}`}>
                                            {opt.label}
                                        </span>
                                        {opt.id === value && (
                                            <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                                                <span className="material-symbols-outlined text-[16px] text-blue-600">check</span>
                                            </div>
                                        )}
                                    </div>
                                    {opt.subLabel && (
                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{opt.subLabel}</span>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
