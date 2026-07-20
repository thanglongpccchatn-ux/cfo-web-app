/**
 * Card chuẩn của hệ thống — dùng thay cho các div bg-white tự chế.
 * @param {{ raised?: boolean, padded?: boolean, className?: string }} props
 * raised: card nổi (hover nhấc nhẹ) cho phần tử bấm được / nội dung chính.
 */
export default function Card({ children, raised = false, padded = true, className = '', ...rest }) {
    return (
        <div
            className={`bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl
                ${raised ? 'shadow-raised hover:shadow-overlay hover:-translate-y-0.5 transition-all duration-200' : 'shadow-card'}
                ${padded ? 'p-4 md:p-5' : ''} ${className}`}
            {...rest}
        >
            {children}
        </div>
    );
}
