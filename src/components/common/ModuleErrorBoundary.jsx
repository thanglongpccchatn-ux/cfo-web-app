import React from 'react';
import { isChunkLoadError, reloadForNewVersion, forceReload } from '../../lib/chunkReload';

/**
 * ModuleErrorBoundary — wraps individual route modules.
 * On crash, shows a self-contained recovery UI instead of killing the entire app.
 *
 * Props:
 *   - moduleName: string — Display name for the module
 *   - children: ReactNode — The module content
 */
class ModuleErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, isChunkError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error, isChunkError: isChunkLoadError(error) };
  }

  componentDidCatch(error, errorInfo) {
    console.error(`[ModuleError] ${this.props.moduleName || 'Unknown'}:`, error, errorInfo);
    // Lỗi tải chunk cũ sau deploy: tự reload 1 lần để nạp bản mới (có cooldown chống loop).
    if (isChunkLoadError(error)) reloadForNewVersion();
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, isChunkError: false });
  };

  render() {
    if (this.state.hasError) {
      // Lỗi do phiên bản mới (chunk cũ 404) — hướng người dùng tải lại thay vì "Thử lại" vô ích.
      if (this.state.isChunkError) {
        return (
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-8 animate-fade-in">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-blue-100 dark:border-blue-900/30 p-8 max-w-lg w-full">
              <div className="w-14 h-14 bg-blue-50 dark:bg-blue-900/20 text-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-5">
                <span className="material-symbols-outlined text-[28px]">system_update_alt</span>
              </div>
              <h3 className="text-lg font-black text-slate-800 dark:text-white mb-1 tracking-tight">
                Đã có phiên bản mới
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 font-medium">
                Ứng dụng vừa được cập nhật. Vui lòng tải lại trang để dùng phiên bản mới nhất.
              </p>
              <div className="flex justify-center">
                <button
                  onClick={forceReload}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-md shadow-blue-500/20 active:scale-[0.97] flex items-center gap-2 text-sm"
                >
                  <span className="material-symbols-outlined text-[18px]">refresh</span>
                  Tải lại phiên bản mới
                </button>
              </div>
            </div>
          </div>
        );
      }
      return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-8 animate-fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-rose-100 dark:border-rose-900/30 p-8 max-w-lg w-full">
            <div className="w-14 h-14 bg-rose-50 dark:bg-rose-900/20 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <span className="material-symbols-outlined text-[28px]">error_outline</span>
            </div>
            <h3 className="text-lg font-black text-slate-800 dark:text-white mb-1 tracking-tight">
              Module {this.props.moduleName || ''} gặp lỗi
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-5 font-medium">
              Phân hệ này đã gặp sự cố nhưng các phần khác của ứng dụng vẫn hoạt động bình thường.
            </p>
            <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-3 text-left mb-6 border border-slate-100 dark:border-slate-700 overflow-x-auto">
              <code className="text-[10px] text-rose-500 select-all font-mono leading-relaxed">
                {this.state.error?.message || 'Unknown Error'}
              </code>
            </div>
            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleRetry}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-md shadow-blue-500/20 active:scale-[0.97] flex items-center gap-2 text-sm"
              >
                <span className="material-symbols-outlined text-[18px]">refresh</span>
                Thử lại
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-2.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-bold rounded-xl transition-all hover:bg-slate-50 text-sm"
              >
                Tải lại trang
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ModuleErrorBoundary;
