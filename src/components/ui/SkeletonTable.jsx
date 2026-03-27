import React from 'react';

/**
 * SkeletonTable — Hiệu ứng loading skeleton dùng chung cho tất cả module.
 * Hỗ trợ 2 chế độ: Table (desktop) và Card (mobile).
 * 
 * @param {number} rows - Số dòng skeleton hiển thị (mặc định: 5)
 * @param {number} cols - Số cột skeleton cho table (mặc định: 6)
 * @param {'table'|'card'|'both'} mode - Chế độ hiển thị (mặc định: 'both')
 */
export default function SkeletonTable({ rows = 5, cols = 6, mode = 'both' }) {
    const skeletonRows = Array.from({ length: rows }, (_, i) => i);
    const skeletonCols = Array.from({ length: cols }, (_, i) => i);

    return (
        <>
            {/* Mobile Card Skeleton */}
            {(mode === 'card' || mode === 'both') && (
                <div className={`${mode === 'both' ? 'block lg:hidden' : ''} space-y-3 p-3`}>
                    {skeletonRows.slice(0, 3).map(i => (
                        <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 animate-pulse">
                            <div className="flex justify-between items-start mb-3">
                                <div className="space-y-2">
                                    <div className="h-3 w-20 bg-slate-200 rounded-full" />
                                    <div className="h-3.5 w-32 bg-slate-200 rounded-full" />
                                </div>
                                <div className="h-5 w-16 bg-slate-100 rounded-full" />
                            </div>
                            <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl">
                                {[1, 2, 3, 4].map(j => (
                                    <div key={j} className="space-y-1">
                                        <div className="h-2 w-10 bg-slate-200 rounded-full" />
                                        <div className="h-3 w-16 bg-slate-200 rounded-full" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Desktop Table Skeleton */}
            {(mode === 'table' || mode === 'both') && (
                <div className={`${mode === 'both' ? 'hidden lg:block' : ''}`}>
                    <table className="w-full">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100">
                                {skeletonCols.map(i => (
                                    <th key={i} className="px-4 py-3">
                                        <div className="h-3 bg-slate-200 rounded-full animate-pulse" style={{ width: `${50 + ((i * 17 + 7) % 40)}%` }} />
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {skeletonRows.map(i => (
                                <tr key={i} className="border-b border-slate-50">
                                    {skeletonCols.map(j => (
                                        <td key={j} className="px-4 py-4">
                                            <div 
                                                className="h-3.5 bg-slate-100 rounded-full animate-pulse" 
                                                style={{ 
                                                    width: `${40 + (((i * 7 + j * 13) % 5) * 12)}%`,
                                                    animationDelay: `${(i * 100 + j * 50)}ms` 
                                                }} 
                                            />
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </>
    );
}

/**
 * EmptyState — Giao diện khi không có dữ liệu, dùng chung cho tất cả module.
 *
 * @param {string} icon - Tên Material Symbol icon
 * @param {string} title - Tiêu đề
 * @param {string} description - Mô tả chi tiết
 * @param {string} actionLabel - Nhãn nút hành động (tùy chọn)
 * @param {function} onAction - Callback khi nhấn nút (tùy chọn)
 */
export function EmptyState({ icon = 'search_off', title = 'Không có dữ liệu', description = '', actionLabel, onAction }) {
    return (
        <div className="flex flex-col items-center justify-center py-16 md:py-24 px-6">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-slate-100 to-slate-50 border border-slate-200 flex items-center justify-center mb-5 shadow-inner">
                <span className="material-symbols-outlined notranslate text-4xl text-slate-300" translate="no">{icon}</span>
            </div>
            <h3 className="text-base font-black text-slate-600 mb-1.5">{title}</h3>
            {description && <p className="text-sm text-slate-400 text-center max-w-xs">{description}</p>}
            {actionLabel && onAction && (
                <button 
                    onClick={onAction}
                    className="mt-5 px-6 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all active:scale-95 flex items-center gap-2"
                >
                    <span className="material-symbols-outlined notranslate text-[18px]" translate="no">add_circle</span>
                    {actionLabel}
                </button>
            )}
        </div>
    );
}
