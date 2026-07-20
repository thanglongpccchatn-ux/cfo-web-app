/**
 * Tiêu đề trang chuẩn: tên màn hình (Manrope) + mô tả + cụm nút hành động bên phải.
 * Trên mobile các nút tự xuống dòng, không tràn ngang.
 */
export default function PageHeader({ title, subtitle, actions = null, className = '' }) {
    return (
        <div className={`flex flex-wrap items-end justify-between gap-x-4 gap-y-3 mb-4 md:mb-6 ${className}`}>
            <div className="min-w-0">
                <h2 className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight truncate">{title}</h2>
                {subtitle && <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1">{subtitle}</p>}
            </div>
            {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
    );
}
