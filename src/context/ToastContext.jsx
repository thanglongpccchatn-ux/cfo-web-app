import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { TOAST_EVENT_NAME } from '../utils/globalToast';

const ToastContext = createContext();

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) throw new Error('useToast must be used within a ToastProvider');
    return context;
};

 
export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);

    const showToast = useCallback((message, type = 'success') => {
        const id = Date.now() + Math.random();
        setToasts(prev => [...prev, { id, message, type }]);

        // Auto remove after 4 seconds
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 4000);
    }, []);

    const dismissToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    // Listen for global toast events (from smartToast / globalToast)
    useEffect(() => {
        const handler = (e) => {
            const { message, type } = e.detail;
            showToast(message, type);
        };
        window.addEventListener(TOAST_EVENT_NAME, handler);
        return () => window.removeEventListener(TOAST_EVENT_NAME, handler);
    }, [showToast]);

    const value = {
        showToast,
        success: (msg) => showToast(msg, 'success'),
        error: (msg) => showToast(msg, 'error'),
        info: (msg) => showToast(msg, 'info'),
        warning: (msg) => showToast(msg, 'warning'),
    };

    const iconMap = {
        success: 'check_circle',
        error: 'error',
        info: 'info',
        warning: 'warning'
    };

    const colorMap = {
        success: 'bg-emerald-500/95 border-emerald-400 shadow-emerald-500/25',
        error: 'bg-red-500/95 border-red-400 shadow-red-500/25',
        info: 'bg-blue-500/95 border-blue-400 shadow-blue-500/25',
        warning: 'bg-amber-500/95 border-amber-400 shadow-amber-500/25',
    };

    return (
        <ToastContext.Provider value={value}>
            {children}
            {/* Toast Container */}
            <div className="fixed bottom-4 right-4 md:bottom-8 md:right-8 z-[9999] flex flex-col gap-3 max-w-[360px] w-full pointer-events-none">
                {toasts.map(toast => (
                    <div 
                        key={toast.id}
                        className={`
                            px-5 py-3.5 rounded-2xl shadow-2xl border backdrop-blur-xl animate-slide-in 
                            flex items-start gap-3 pointer-events-auto
                            ${colorMap[toast.type] || colorMap.info}
                        `}
                    >
                        <span className="material-symbols-outlined text-white/90 text-[20px] mt-0.5 shrink-0">
                            {iconMap[toast.type] || 'info'}
                        </span>
                        <p className="text-sm font-bold text-white tracking-tight flex-1 leading-snug">{toast.message}</p>
                        <button 
                            onClick={() => dismissToast(toast.id)} 
                            className="text-white/60 hover:text-white transition-colors shrink-0 mt-0.5"
                        >
                            <span className="material-symbols-outlined text-[16px]">close</span>
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};
