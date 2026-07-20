import forms from '@tailwindcss/forms';
import containerQueries from '@tailwindcss/container-queries';

/** @type {import('tailwindcss').Config} */
export default {
    darkMode: "class",
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // Màu thương hiệu — giá trị thật inject runtime từ config/brand.js
                "primary": "var(--color-primary, #005faf)",
                "primary-hover": "var(--color-primary-hover, #004786)",
                "primary-light": "#dbeafe",
                "secondary": "#005faf",
                // Màu trạng thái ngữ nghĩa
                "success": "#22c55e",
                "success-light": "#dcfce7",
                "warning": "#f59e0b",
                "warning-light": "#fef3c7",
                "danger": "#ef4444",
                "danger-light": "#fee2e2",
                // Nền & bề mặt
                "background-light": "#f3f4f6",
                "background-dark": "#0f172a",
                "navy": "#1e293b",
                "surface-light": "#ffffff",
                "surface-dark": "#1e293b",
            },
            fontFamily: {
                "sans": ["Inter", "system-ui", "sans-serif"],
                "headline": ["Manrope", "Inter", "sans-serif"],
            },
            boxShadow: {
                // 3 tầng bóng ngữ nghĩa: card (nghỉ) → raised (nổi/hover) → overlay (modal)
                'card': '0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.06)',
                'raised': '0 4px 12px -2px rgba(15, 23, 42, 0.08), 0 2px 6px -2px rgba(15, 23, 42, 0.05)',
                'overlay': '0 20px 40px -12px rgba(15, 23, 42, 0.25)',
            },
            borderRadius: {
                // Giữ bare `rounded` = 0.5rem (137 chỗ đang dùng);
                // lg/xl/2xl/3xl trả về thang chuẩn Tailwind để thứ bậc không bị đảo
                "DEFAULT": "0.5rem",
            },
        },
    },
    plugins: [
        forms,
        containerQueries
    ]
}
