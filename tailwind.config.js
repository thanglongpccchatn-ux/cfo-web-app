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
                "primary-light": "#dbeafe",
                "primary-hover": "var(--color-primary-hover, #2563eb)",
                "success": "#22c55e",
                "success-light": "#dcfce7",
                "warning": "#f59e0b",
                "warning-light": "#fef3c7",
                "danger": "#ef4444",
                "danger-light": "#fee2e2",
                "background-light": "#f3f4f6",
                "background-dark": "#0f172a",
                "navy": "#1e293b",
                "surface-light": "#ffffff",
                "surface-dark": "#1e293b",
                // New
                "on-secondary-fixed-variant": "#004786",
                "on-tertiary": "#ffffff",
                "on-primary": "#ffffff",
                "inverse-surface": "#2e3036",
                "primary-fixed": "#d9e2ff",
                "on-secondary-fixed": "#001c3a",
                "outline": "#737783",
                "on-primary-container": "#a1bbff",
                "surface-bright": "#faf8ff",
                "on-error": "#ffffff",
                "on-error-container": "#93000a",
                "inverse-on-surface": "#f0f0f8",
                "surface-variant": "#e2e2ea",
                "surface": "#faf8ff",
                "secondary-fixed": "#d4e3ff",
                "surface-container-lowest": "#ffffff",
                "on-surface": "#1a1b21",
                "secondary": "#005faf",
                "secondary-container": "#54a0fe",
                "error-container": "#ffdad6",
                "tertiary-container": "#005914",
                "on-surface-variant": "#434652",
                "on-secondary": "#ffffff",
                "on-tertiary-fixed-variant": "#005312",
                "on-tertiary-fixed": "#002204",
                "surface-container-highest": "#e2e2ea",
                "tertiary-fixed": "#a3f69c",
                "on-primary-fixed-variant": "#00429c",
                "on-secondary-container": "#003567",
                "background": "#faf8ff",
                "surface-container": "#ededf5",
                "tertiary-fixed-dim": "#88d982",
                "secondary-fixed-dim": "#a5c8ff",
                "error": "#ba1a1a",
                "on-tertiary-container": "#7ecf79",
                "primary": "var(--color-primary, #003178)",
                "surface-dim": "#d9d9e1",
                "tertiary": "#003f0b",
                "inverse-primary": "#b0c6ff",
                "on-primary-fixed": "#001945",
                "surface-container-low": "#f3f3fb",
                "surface-tint": "#2b5bb5",
                "on-background": "#1a1b21",
                "primary-container": "#0d47a1",
                "primary-fixed-dim": "#b0c6ff",
                "outline-variant": "#c3c6d4",
                "surface-container-high": "#e8e7f0"
            },
            fontFamily: {
                "sans": ["Inter", "sans-serif"],
                "display": ["Inter", "sans-serif"],
                "body": ["Inter", "sans-serif"],
                "headline": ["Manrope", "sans-serif"],
                "label": ["Inter", "sans-serif"]
            },
            boxShadow: {
                'card': '0 2px 5px rgba(0,0,0,0.05)',
            },
            borderRadius: {
                "DEFAULT": "0.5rem",
                "lg": "1rem",
                "xl": "1.5rem",
                "full": "9999px"
            },
        },
    },
    plugins: [
        forms,
        containerQueries
    ]
}
