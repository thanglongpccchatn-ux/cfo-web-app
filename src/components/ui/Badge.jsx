const TONES = {
    success: 'bg-success-light text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900',
    warning: 'bg-warning-light text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900',
    danger: 'bg-danger-light text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-900',
    info: 'bg-primary-light text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-900',
    neutral: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
};

/**
 * Nhãn trạng thái chuẩn — màu theo ngữ nghĩa, không tự chế màu mới.
 * @param {{ tone?: 'success'|'warning'|'danger'|'info'|'neutral', dot?: boolean }} props
 */
export default function Badge({ tone = 'neutral', dot = false, children, className = '', ...rest }) {
    return (
        <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-bold whitespace-nowrap
                ${TONES[tone] || TONES.neutral} ${className}`}
            {...rest}
        >
            {dot && <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden="true" />}
            {children}
        </span>
    );
}
