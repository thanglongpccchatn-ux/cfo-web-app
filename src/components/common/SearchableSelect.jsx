import React, { useState, useRef, useEffect } from 'react';

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
    const wrapperRef = useRef(null);
    const inputRef = useRef(null);

    const selectedOption = options.find(opt => opt.id === value);

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
                setSearchTerm('');
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Filter logic with accent-insensitivity
    const filteredOptions = options.filter(opt => {
        const search = removeAccents(searchTerm.toLowerCase());
        const label = removeAccents(String(opt.label || '').toLowerCase());
        const subLabel = opt.subLabel ? removeAccents(String(opt.subLabel).toLowerCase()) : '';
        return label.includes(search) || subLabel.includes(search);
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

            {/* Dropdown Results */}
            {isOpen && (
                <div className="absolute z-[100] w-full mt-2 bg-white/95 backdrop-blur-xl border border-slate-200 rounded-2xl shadow-2xl overflow-hidden animate-slide-up max-h-[350px] flex flex-col border-t-0 ring-1 ring-black/5">
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
                </div>
            )}
        </div>
    );
}
