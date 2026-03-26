export const DEFAULT_THEME = {
    company_name: "SATECO",
    sub_name: "Mechanical & Electrical",
    logo_url: '/logo.png',
    logo_icon: 'apartment',
    primary_color: '#005faf',
    primary_hover_color: '#004786',
    sidebar_bg_light: '#ffffff',
    sidebar_bg_dark: '#111827',
    app_bg_light: '#f8fafc',
    app_bg_dark: '#0f172a',
    font_family: "'Inter', sans-serif",
    font_url: null
};

// Lưu cache (bản in memory) để các thẻ (Sidebar, Login) có thể truy cập mà không Cần Context
export let currentTheme = { ...DEFAULT_THEME };

/**
 * Hàm tự động Áp dụng cấu hình Theme lên toàn bộ DOM lúc khởi chạy.
 * Được gọi ở src/App.jsx. Truyền vào dữ liệu từ Supabase (hoặc dùng mặc định).
 */
export const applyBrandTheme = (dbConfig = null) => {
    // Hợp nhất dữ liệu DB với Default
    const theme = { ...DEFAULT_THEME, ...(dbConfig || {}) };
    currentTheme = theme; // Cập nhật cache
    
    const root = document.documentElement;
    
    // Tiêm Biến CSS Màu sắc
    root.style.setProperty('--color-primary', theme.primary_color);
    root.style.setProperty('--color-primary-hover', theme.primary_hover_color);
    root.style.setProperty('--bg-sidebar-light', theme.sidebar_bg_light);
    root.style.setProperty('--bg-sidebar-dark', theme.sidebar_bg_dark);
    root.style.setProperty('--bg-primary', theme.app_bg_light); // Override CSS gốc
    
    // Tiêm Biến CSS Font Chữ
    if (theme.font_family) {
        root.style.setProperty('--font-sans', theme.font_family);
    }

    // Nhúng Google Font nếu được cấu hình
    if (theme.font_url) {
        if (!document.querySelector(`link[href="${theme.font_url}"]`)) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = theme.font_url;
            document.head.appendChild(link);
        }
    }
    
    // Đổi Title web - Luôn ưu tiên hiển thị tên gọn theo yêu cầu người dùng
    document.title = "SATECO";
};


