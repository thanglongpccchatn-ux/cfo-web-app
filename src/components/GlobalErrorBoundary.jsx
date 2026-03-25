import React from 'react';

/**
 * GlobalErrorBoundary catches syntax errors, render errors, and null exceptions
 * in any component tree below it. Instead of crashing the whole app (white screen),
 * it displays a clean fallback UI with a reload button.
 */
class GlobalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // You can also log the error to an error reporting service like Sentry
    console.error("Uncaught error in component tree:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900 p-6 text-center">
            <div className="bg-white dark:bg-slate-800 rounded-[24px] shadow-xl border border-rose-100 dark:border-rose-900/30 p-8 max-w-md w-full">
                <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <span className="material-symbols-outlined text-3xl">warning</span>
                </div>
                <h2 className="text-xl font-black text-slate-800 dark:text-white mb-2 tracking-tight">Đã Xảy Ra Lỗi Giao Diện</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 font-medium">
                    Hệ thống gặp sự cố khi hiển thị giao diện này. Nếu lỗi vẫn tiếp diễn, vui lòng liên hệ Admin.
                </p>
                <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-3 text-left mb-6 overflow-x-auto border border-slate-100 dark:border-slate-700">
                    <code className="text-[10px] text-rose-500 select-all font-mono">
                        {this.state.error?.message || "Unknown Error"}
                    </code>
                </div>
                <button 
                    onClick={() => window.location.reload()}
                    className="w-full bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-bold py-3 px-4 rounded-xl transition-all shadow-md active:scale-[0.98]"
                >
                    Tải Lại Ứng Dụng
                </button>
            </div>
        </div>
      );
    }

    return this.props.children; 
  }
}

export default GlobalErrorBoundary;
