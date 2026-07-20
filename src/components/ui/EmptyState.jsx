import Icon from '../common/Icon';

/**
 * Trạng thái rỗng chuẩn — dùng khi bảng/danh sách không có dữ liệu,
 * thay cho việc để trống hoặc mỗi màn tự chế một kiểu.
 */
export default function EmptyState({ icon = 'inbox', title = 'Chưa có dữ liệu', description, action = null, className = '' }) {
    return (
        <div className={`flex flex-col items-center justify-center text-center py-12 px-6 ${className}`}>
            <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                <Icon name={icon} size={28} className="text-slate-400 dark:text-slate-500" />
            </div>
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{title}</p>
            {description && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 max-w-xs leading-relaxed">{description}</p>}
            {action && <div className="mt-4">{action}</div>}
        </div>
    );
}
