/**
 * SATECO — Global Toast System
 * Event-based toast that works from ANYWHERE (inside and outside React components).
 * For components using hooks, continue using useToast().
 * For non-hook contexts or when useToast is not available, use globalToast.
 */

const TOAST_EVENT = 'sateco-toast';

/**
 * Show a global toast notification (works everywhere, no hooks needed).
 * Usage: globalToast.success('Saved!'), globalToast.error('Failed'), etc.
 */
export const globalToast = {
    _emit: (message, type = 'info') => {
        window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: { message, type } }));
    },
    success: (msg) => globalToast._emit(msg, 'success'),
    error: (msg) => globalToast._emit(msg, 'error'),
    info: (msg) => globalToast._emit(msg, 'info'),
    warning: (msg) => globalToast._emit(msg, 'warning'),
};

/**
 * Replacement for alert() calls.
 * Detects message content and auto-selects toast type.
 * Usage: smartToast('Đã lưu thành công!') → success toast
 *        smartToast('Lỗi khi lưu') → error toast
 */
export const smartToast = (msg) => {
    const lowerMsg = (msg || '').toLowerCase();
    if (lowerMsg.includes('lỗi') || lowerMsg.includes('error') || lowerMsg.includes('không thể') || lowerMsg.includes('thất bại')) {
        globalToast.error(msg);
    } else if (lowerMsg.includes('thành công') || lowerMsg.includes('success') || lowerMsg.includes('đã lưu') || lowerMsg.includes('đã import') || lowerMsg.includes('đã cập nhật') || lowerMsg.includes('đã xóa')) {
        globalToast.success(msg);
    } else if (lowerMsg.includes('vui lòng') || lowerMsg.includes('chọn') || lowerMsg.includes('nhập')) {
        globalToast.warning(msg);
    } else {
        globalToast.info(msg);
    }
};

export const TOAST_EVENT_NAME = TOAST_EVENT;
