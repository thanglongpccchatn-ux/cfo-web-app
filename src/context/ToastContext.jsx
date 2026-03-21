import React, { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext();

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) throw new Error('useToast must be used within a ToastProvider');
    return context;
};

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);

    const showToast = useCallback((message, type = 'success') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);

        // Auto remove after 3 seconds
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 3000);
    }, []);

    const value = {
        showToast,
        success: (msg) => showToast(msg, 'success'),
        error: (msg) => showToast(msg, 'error'),
        info: (msg) => showToast(msg, 'info'),
        warning: (msg) => showToast(msg, 'warning'),
    };

    return (
        <ToastContext.Provider value={value}>
            {children}
            {/* Toast Container */}
            <div className="fixed bottom-8 right-8 z-[9999] flex flex-col gap-3">
                {toasts.map(toast => (
                    <div 
                        key={toast.id}
                        className={`
                            px-6 py-4 rounded-2xl shadow-2xl border backdrop-blur-xl animate-slide-in flex items-center gap-3 min-w-[300px]
                            ${toast.type === 'success' ? 'bg-emerald-500/90 text-white border-emerald-400' : ''}
                            ${toast.type === 'error' ? 'bg-red-500/90 text-white border-red-400' : ''}
                            ${toast.type === 'info' ? 'bg-blue-500/90 text-white border-blue-400' : ''}
                            ${toast.type === 'warning' ? 'bg-amber-500/90 text-white border-amber-400' : ''}
                        `}
                    >
                        <span className="material-symbols-outlined">
                            {toast.type === 'success' ? 'check_circle' : 
                             toast.type === 'error' ? 'error' :
                             toast.type === 'info' ? 'info' : 'warning'}
                        </span>
                        <p className="text-sm font-black tracking-tight">{toast.message}</p>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};
