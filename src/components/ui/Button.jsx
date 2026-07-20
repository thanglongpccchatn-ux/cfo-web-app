import Icon from '../common/Icon';

const VARIANTS = {
    primary: 'bg-primary hover:bg-primary-hover text-white shadow-sm shadow-primary/20',
    secondary: 'bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700',
    ghost: 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800',
    danger: 'bg-danger-light text-red-700 border border-red-200 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900',
    success: 'bg-success text-white hover:bg-emerald-600 shadow-sm shadow-success/20',
};

const SIZES = {
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-5 py-2.5 text-base gap-2',
};

/**
 * Nút chuẩn của hệ thống.
 * @param {{ variant?: 'primary'|'secondary'|'ghost'|'danger'|'success', size?: 'sm'|'md'|'lg', icon?: string, loading?: boolean }} props
 */
export default function Button({ variant = 'primary', size = 'md', icon, loading = false, disabled, children, className = '', type = 'button', ...rest }) {
    return (
        <button
            type={type}
            disabled={disabled || loading}
            className={`inline-flex items-center justify-center font-semibold rounded-lg cursor-pointer
                min-h-[44px] md:min-h-0 transition-all duration-150
                focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:outline-none
                disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0
                ${VARIANTS[variant] || VARIANTS.primary} ${SIZES[size] || SIZES.md} ${className}`}
            {...rest}
        >
            {loading
                ? <span className="animate-spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full" aria-hidden="true" />
                : icon && <Icon name={icon} size={size === 'sm' ? 16 : 18} />}
            {children}
        </button>
    );
}
