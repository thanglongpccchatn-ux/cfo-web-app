---
name: ux-ui-cfo-app
description: |
  Cải thiện giao diện UX/UI cho CFO web app. Dùng khi user nói "cải thiện UI",
  "thay đổi giao diện", "đẹp hơn", "responsive", "dark mode", "animation",
  "component mới", "redesign", "layout", "màu sắc", "font", "spacing",
  "button style", "card design", hoặc yêu cầu thay đổi trực quan bất kỳ.
  Cũng kích hoạt khi user muốn thêm component mới hoặc chỉnh sửa Sidebar/Header.
---

# Goal

Thực hiện thay đổi UX/UI cho CFO web app chuẩn theo design system hiện tại
(Tailwind CSS + custom CSS variables, dark mode, glassmorphism), đảm bảo
nhất quán về visual language và không phá vỡ responsive layout.

---

# Instructions

## Design System (PHẢI tuân theo):

### Stack kỹ thuật:
- **Framework**: React + Vite
- **CSS**: Tailwind CSS + Custom CSS (`index.css`, `App.css`)
- **Font**: Inter (từ Google Fonts)
- **Icons**: Material Symbols Outlined (Google)
- **Dark mode**: `dark:` prefix Tailwind — toggle qua class `dark` ở `<html>`

### Color Palette:

```css
/* Status Colors (dùng cho tài chính) */
--safe-text: #10b981;    /* Xanh lá — An toàn */
--watch-text: #f59e0b;   /* Vàng — Cảnh báo */
--danger-text: #ef4444;  /* Đỏ — Nguy hiểm */
--critical-text: #f87171; /* Đỏ đậm + pulse animation — Khẩn cấp */

/* Primary action */
bg-primary = #3c83f6 (blue-500 variant)
text-primary = blue cues cho links + CTAs

/* Background */
Light: bg-background-light (slate-50 tone)
Dark:  bg-[#0f172a] hoặc bg-[#111827] hoặc bg-[#1e293b]
```

### Typography scale:
```
Title (h1):       text-2xl font-bold
Section (h2):     text-lg font-bold
Card heading:     text-sm font-semibold uppercase tracking-wide
Body:             text-sm font-normal
Caption:          text-xs text-slate-500
Number/Amount:    font-bold tabular-nums (tiền tệ)
```

### Spacing & Radius:
- Container padding: `p-6` hoặc `px-6 py-4`
- Card inner: `p-6`
- Gap between sections: `gap-6` hoặc `gap-8`
- Border radius: `rounded-xl` (card), `rounded-lg` (input/button), `rounded-full` (badge/chip)

## CSS Classes có sẵn (dùng lại, KHÔNG viết lại):

| Class | Dùng khi |
|-------|----------|
| `.glass-panel` | Card có glassmorphism + backdrop blur |
| `.glass-card` | Card nền mờ nhẹ trên dark bg |
| `.btn`, `.btn-primary`, `.btn-danger`, `.btn-glass` | Buttons |
| `.status-safe/watch/danger/critical` | Badge trạng thái tài chính |
| `.status-badge` | Wrapper cho badge |
| `.animate-slide-in` | Hiệu ứng xuất hiện |
| `.no-scrollbar` | Ẩn scrollbar trên list/table |
| `.step-active`, `.step-inactive` | Sidebar steps indicator |
| `.text-gradient` | Text gradient trắng → slate |

## Quy tắc Component:

### Buttons:
```jsx
// Primary action (tạo mới, lưu)
<button className="px-4 py-2 bg-primary hover:bg-blue-600 text-white font-bold text-sm rounded-lg shadow-sm transition-colors">
  Thêm mới
</button>

// Destructive (xóa)
<button className="btn btn-danger">Xóa</button>

// Ghost/Secondary
<button className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm hover:bg-slate-50 transition-colors">
  Hủy
</button>
```

### Cards/Panels:
```jsx
// Standard card (light + dark)
<div className="bg-white dark:bg-[#1e293b] rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">

// KPI stat card
<div className="bg-white dark:bg-[#1e293b] rounded-xl p-5 border border-slate-100 dark:border-slate-800">
  <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Label</div>
  <div className="text-2xl font-black text-slate-800 dark:text-white mt-2">Value</div>
</div>
```

### Status tài chính:
```jsx
// Dùng cho P&L, cashflow
<span className="status-badge status-safe">An toàn</span>
<span className="status-badge status-danger">Nguy hiểm</span>
```

### Tables:
```jsx
// Header style chuẩn
<thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">
// Row hover
<tr className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
```

## Quy trình thay đổi UI:

1. **Xác định component** cần sửa → tìm file trong `src/components/`
2. **Đọc CSS hiện tại** của component trước khi override
3. **Ưu tiên Tailwind classes** — chỉ dùng CSS thuần khi Tailwind không đủ
4. **Luôn có `dark:` variant** cho mọi màu background, border, text
5. **Thêm `transition-colors`** cho mọi hover state
6. **Test responsive**: `sm:`, `md:`, `lg:` breakpoints

---

# Examples

## Ví dụ 1: Thêm KPI card mới vào DashboardOverview

```jsx
<div className="bg-white dark:bg-[#1e293b] rounded-xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm">
  <div className="flex items-center justify-between mb-3">
    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Lợi nhuận tháng</span>
    <span className="material-symbols-outlined text-green-500 text-[20px]">trending_up</span>
  </div>
  <div className="text-2xl font-black text-slate-800 dark:text-white">
    {formatBillion(profit)}
  </div>
  <div className="text-xs text-slate-500 mt-1">
    <span className="text-green-500 font-semibold">↑ 12%</span> so với tháng trước
  </div>
</div>
```

## Ví dụ 2: Cải thiện empty state cho bảng

```jsx
// Thay thế "Chưa có dữ liệu." đơn giản bằng:
<tr>
  <td colSpan={9} className="py-16 text-center">
    <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600 block mb-3">
      inbox
    </span>
    <p className="text-slate-400 font-medium text-sm">Chưa có dữ liệu</p>
    <p className="text-slate-400 text-xs mt-1">Nhấn "Thêm dòng mới" để bắt đầu</p>
  </td>
</tr>
```

## Ví dụ 3: Animation fadeIn cho component

```jsx
// Thêm vào className của container
<div className="animate-fade-in">

// Trong index.css hoặc App.css thêm:
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
.animate-fade-in { animation: fadeIn 0.3s ease-out; }
```

```

## Ví dụ 4: Bảng theo dõi thanh toán chuyên nghiệp

```jsx
// Row hover & transition
<tr className="hover:bg-blue-50/50 hover:shadow-sm transition-all group cursor-pointer border-l-2 border-transparent hover:border-blue-500">
  {/* Status icon & text */}
  <td className="px-3 py-4">
    <div className="flex items-center gap-2">
      <span className="material-symbols-outlined text-emerald-500 text-[18px]">check_circle</span>
      <span className="text-emerald-600 font-bold uppercase tracking-tight text-[10px]">Đã trả đủ</span>
    </div>
  </td>
  
  {/* Click-to-history highlight */}
  <td className="px-3 py-4 text-right group-hover:text-blue-600 font-black transition-colors">
    {fmt(amount)}
  </td>
</tr>
```

---

# Constraints

- 🚫 KHÔNG dùng TailwindCSS v4 syntax — dự án đang dùng v3
- 🚫 KHÔNG xóa `dark:` variant của bất kỳ element nào
- ✅ LUÔN test cả light mode và dark mode sau khi sửa
- ✅ Font chữ số tiền: dùng tabular-nums để tránh nhảy layout
- ✅ Mobile: ưu tiên `hidden md:block` thay vì bỏ hoàn toàn element
- ✅ Bảng tài chính: row height tối ưu (py-3 hoặc py-4), không làm giãn quá mức
- ✅ Interactivity: mọi số liệu "Thực thu" nên có link hoặc click để xem lịch sử
- 📌 File CSS chính: `src/index.css` (variables) + `src/App.css` (layout)
- 📌 Icon: dùng `<span className="material-symbols-outlined">icon_name</span>`
  → Tìm icon tại: https://fonts.google.com/icons


<!-- Generated by Skill Creator Ultra v1.1 -->
