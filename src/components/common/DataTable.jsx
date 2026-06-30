/**
 * DataTable — bảng dữ liệu chuẩn cho app tài chính. KHÔNG glassmorphism (cuộn mượt).
 *
 * Tính năng:
 *  - Header DÍNH (sticky) khi cuộn.
 *  - Cột số căn phải + tabular-nums (tiền thẳng cột). Đặt align:'right' hoặc numeric:true.
 *  - Sắp xếp client-side (sortable:true) — bấm header để đổi chiều.
 *  - Skeleton khi loading; empty state khi rỗng.
 *  - Bọc overflow-x:auto → an toàn trên mobile.
 *
 * columns: [{ key, header, align?, numeric?, sortable?, width?, render?(row), sortValue?(row) }]
 */
import { useMemo, useState } from 'react';
import Icon from './Icon';

function SortIcon({ dir }) {
    return (
        <Icon
            name="expand_more"
            size={14}
            className={`inline-block transition-transform ${dir === 'asc' ? 'rotate-180' : ''} ${dir ? 'text-primary' : 'text-slate-300'}`}
        />
    );
}

export default function DataTable({
    columns = [],
    rows = [],
    loading = false,
    emptyMessage = 'Chưa có dữ liệu',
    getRowId = (_, i) => i,
    onRowClick,
    rowClassName,
    stickyHeader = true,
    maxHeight = '70vh',
    className = '',
}) {
    const [sort, setSort] = useState({ key: null, dir: null }); // dir: 'asc' | 'desc' | null

    const sortedRows = useMemo(() => {
        if (!sort.key || !sort.dir) return rows;
        const col = columns.find((c) => c.key === sort.key);
        if (!col) return rows;
        const val = col.sortValue || ((r) => r[sort.key]);
        const factor = sort.dir === 'asc' ? 1 : -1;
        return [...rows].sort((a, b) => {
            const va = val(a), vb = val(b);
            if (va == null) return 1;
            if (vb == null) return -1;
            if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * factor;
            return String(va).localeCompare(String(vb), 'vi') * factor;
        });
    }, [rows, sort, columns]);

    const toggleSort = (col) => {
        if (!col.sortable) return;
        setSort((s) => {
            if (s.key !== col.key) return { key: col.key, dir: 'asc' };
            if (s.dir === 'asc') return { key: col.key, dir: 'desc' };
            return { key: null, dir: null };
        });
    };

    const alignClass = (col) => (col.align === 'right' || col.numeric ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left');
    const numClass = (col) => (col.numeric ? 'tabular-nums' : '');

    return (
        <div className={`rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden ${className}`}>
            <div className="overflow-auto" style={{ maxHeight }}>
                <table className="w-full text-sm border-collapse">
                    <thead className={stickyHeader ? 'sticky top-0 z-10' : ''}>
                        <tr className="bg-slate-50 dark:bg-slate-700/60">
                            {columns.map((col) => (
                                <th
                                    key={col.key}
                                    onClick={() => toggleSort(col)}
                                    style={col.width ? { width: col.width } : undefined}
                                    className={`px-3 py-2.5 font-bold text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-300 border-b border-slate-200 dark:border-slate-600 whitespace-nowrap ${alignClass(col)} ${col.sortable ? 'cursor-pointer select-none hover:text-primary' : ''}`}
                                    aria-sort={sort.key === col.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                                >
                                    {col.header}
                                    {col.sortable && <SortIcon dir={sort.key === col.key ? sort.dir : null} />}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            Array.from({ length: 6 }).map((_, r) => (
                                <tr key={`sk-${r}`} className="border-b border-slate-100 dark:border-slate-700/50">
                                    {columns.map((col) => (
                                        <td key={col.key} className="px-3 py-3">
                                            <div className="h-3.5 rounded bg-slate-200/70 dark:bg-slate-700 animate-pulse" style={{ width: `${40 + ((r * 13 + col.key.length * 7) % 50)}%` }} />
                                        </td>
                                    ))}
                                </tr>
                            ))
                        ) : sortedRows.length === 0 ? (
                            <tr>
                                <td colSpan={columns.length} className="px-4 py-12 text-center">
                                    <Icon name="inventory_2" size={32} className="text-slate-300 mx-auto mb-2" />
                                    <p className="text-sm text-slate-400">{emptyMessage}</p>
                                </td>
                            </tr>
                        ) : (
                            sortedRows.map((row, i) => (
                                <tr
                                    key={getRowId(row, i)}
                                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                                    className={`border-b border-slate-100 dark:border-slate-700/50 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/30 ${onRowClick ? 'cursor-pointer' : ''} ${rowClassName ? rowClassName(row) : ''}`}
                                >
                                    {columns.map((col) => (
                                        <td key={col.key} className={`px-3 py-2.5 text-slate-700 dark:text-slate-200 ${alignClass(col)} ${numClass(col)}`}>
                                            {col.render ? col.render(row) : row[col.key]}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
