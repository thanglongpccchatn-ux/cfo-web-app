import { useEffect, useState } from 'react';

const STORAGE_KEY = 'ui_theme';

/** Đọc theme đã lưu; chưa lưu thì theo cài đặt hệ điều hành. */
export const getInitialTheme = () => {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved === 'dark' || saved === 'light') return saved;
    } catch { /* private mode — bỏ qua */ }
    return window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ? 'dark' : 'light';
};

/** Gán/bỏ class `dark` trên <html> — nguồn duy nhất được phép đổi class này. */
export const applyTheme = (theme) => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
};

/** Hook bật/tắt dark mode, tự lưu lựa chọn vào localStorage. */
export default function useDarkMode() {
    const [theme, setTheme] = useState(getInitialTheme);

    useEffect(() => {
        applyTheme(theme);
        try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* bỏ qua */ }
    }, [theme]);

    const toggle = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'));
    return { theme, toggle, isDark: theme === 'dark' };
}
