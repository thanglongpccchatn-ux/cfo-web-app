import React from 'react';

const SkeletonLoader = ({ type = 'card', count = 1, className = '' }) => {
    const renderSkeleton = () => {
        switch (type) {
            case 'card':
                return (
                    <div className={`p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700/50 shadow-sm ${className}`}>
                        <div className="flex justify-between items-start mb-4">
                            <div className="w-1/3 h-5 skeleton-box rounded-md"></div>
                            <div className="w-8 h-8 skeleton-box rounded-lg"></div>
                        </div>
                        <div className="w-1/2 h-8 skeleton-box rounded-md mb-2"></div>
                        <div className="w-1/4 h-4 skeleton-box rounded-md"></div>
                    </div>
                );
            case 'table-row':
                return (
                    <tr className={className}>
                        <td className="px-6 py-4"><div className="w-8 h-4 skeleton-box rounded"></div></td>
                        <td className="px-6 py-4"><div className="w-3/4 h-4 skeleton-box rounded"></div></td>
                        <td className="px-6 py-4"><div className="w-1/2 h-4 skeleton-box rounded"></div></td>
                        <td className="px-6 py-4"><div className="w-1/4 h-4 skeleton-box rounded"></div></td>
                        <td className="px-6 py-4"><div className="w-1/4 h-4 skeleton-box rounded"></div></td>
                    </tr>
                );
            case 'block':
            default:
                return (
                    <div className={`skeleton-box rounded-xl ${className}`}></div>
                );
        }
    };

    return (
        <>
            {Array(count).fill(0).map((_, i) => (
                <React.Fragment key={i}>
                    {renderSkeleton()}
                </React.Fragment>
            ))}
        </>
    );
};

export default SkeletonLoader;
