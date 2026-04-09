---
name: ux-ui-cfo-app-expert
description: |
  CHUYÊN GIA UX/UI cho CFO web app Sateco: Design system, component library,
  responsive patterns, accessibility, module-specific styling.
  Trigger: "UI", "UX", "giao diện", "responsive", "mobile", "dark mode",
  "animation", "component", "redesign", "layout", "màu", "font", "spacing",
  "button", "card", "table", "modal", "sidebar", "header", "skeleton",
  "loading", "empty state", "toast", "notification", hoặc yêu cầu visual.
---

# 🎨 Expert Skill: UX/UI Design System — CFO Web App

## 1. TECH STACK

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | React | 19 |
| Build | Vite | 7 |
| CSS | Tailwind CSS | 3 |
| Font | Inter | Google Fonts |
| Icons | Material Symbols Outlined | Google |
| Query | TanStack React Query | v5 |
| Backend | Supabase | PostgreSQL |

---

## 2. DESIGN TOKENS

### Color Palette (Financial-first)

```css
/* Module Identity Colors */
--contract:  blue-600 / indigo-600    /* Hợp đồng */
--payment:   emerald-600              /* Thanh toán CĐT */
--labor:     purple-600 / violet-600  /* Thầu phụ */
--material:  orange-600 / amber-600   /* Vật tư */
--expense:   rose-600                 /* Chi phí */
--internal:  indigo-600               /* Dòng nội bộ TL-STC */

/* Financial Status Colors */
--safe:      emerald-500  #10b981     /* Đã thanh toán, đủ */
--warning:   amber-500    #f59e0b     /* Cảnh báo, chờ */
--danger:    rose-500     #f43f5e     /* Nợ, quá hạn */
--critical:  rose-700     #f87171     /* Khẩn cấp + pulse */
--info:      blue-500     #3b82f6     /* Thông tin */
--neutral:   slate-500    #64748b     /* Mặc định */

/* Background Hierarchy (Light) */
--bg-app:    slate-50, white
--bg-card:   white
--bg-inset:  slate-50/50
--bg-hover:  slate-50, blue-50/30
--bg-active: blue-50, orange-50

/* Background Hierarchy (Dark) */
--bg-app:    #0f172a, #111827
--bg-card:   #1e293b
--bg-inset:  #1e293b/50
```

### Typography Scale
```
Heading XL:   text-2xl font-black
Heading L:    text-xl font-black  
Heading M:    text-lg font-bold
Heading S:    text-sm font-bold
Body:         text-sm font-medium
Caption:      text-xs text-slate-500
Label:        text-[10px] font-black uppercase tracking-widest
Micro:        text-[9px] font-bold uppercase tracking-widest

Amount/Number: font-black tabular-nums tracking-tight
Currency VND:  new Intl.NumberFormat('vi-VN') — KHÔNG dùng ₫ trong bảng
```

### Spacing & Layout
```
Container:     p-6, px-6 py-4
Card inner:    p-5 hoặc p-6
Section gap:   gap-6 hoặc gap-8
Grid gap:      gap-3 hoặc gap-4
Input height:  py-2 (small), py-2.5 (medium), py-3 (large)
```

### Border Radius
```
Card/Panel:    rounded-xl (12px) hoặc rounded-2xl (16px)
Button:        rounded-lg (8px)
Input:         rounded-lg (8px) hoặc rounded-xl (12px) for mobile
Badge/Chip:    rounded-full hoặc rounded-md
Modal:         rounded-2xl
Bottom Sheet:  rounded-t-3xl (mobile)
```

---

## 3. COMPONENT LIBRARY

### 3.1 Buttons

```jsx
// Primary Action (CTA)
<button className="px-4 py-2 bg-{module}-600 hover:bg-{module}-700 text-white font-bold 
  text-sm rounded-lg shadow-sm shadow-{module}-500/20 transition-colors flex items-center gap-2">
  <span className="material-symbols-outlined text-[18px]">add</span>
  Thêm mới
</button>

// Ghost / Secondary
<button className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 
  font-bold text-sm hover:bg-slate-50 transition-colors">
  Hủy
</button>

// Danger (Delete)
<button className="btn btn-danger">Xóa</button>

// Icon-only (Action table)
<button className="w-7 h-7 flex items-center justify-center bg-white border border-slate-200 
  hover:border-{color}-400 text-{color}-600 hover:bg-{color}-50 rounded shadow-sm transition-all">
  <span className="material-symbols-outlined text-[16px]">edit</span>
</button>
```

### 3.2 Cards & Panels

```jsx
// Standard Card
<div className="bg-white rounded-xl shadow-sm border border-slate-200/60 p-6">

// Glass Panel (Hero/KPI areas)
<div className="glass-panel p-6 shadow-sm border border-slate-200/60">

// KPI Stat Card
<div className="bg-white rounded-xl border border-{color}-200 shadow-sm p-4 relative overflow-hidden group">
  <div className="absolute -right-6 -top-6 w-24 h-24 bg-{color}-50 rounded-full blur-2xl 
    group-hover:bg-{color}-100 transition-colors"></div>
  <div className="flex items-center gap-2 mb-2 relative z-10">
    <span className="material-symbols-outlined text-{color}-500 text-[18px]">{icon}</span>
    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{label}</p>
  </div>
  <p className="text-2xl font-black text-{color}-700 tabular-nums relative z-10">{value}</p>
</div>

// Gradient Accent Card (P&L)
<div className="glass-panel p-6 bg-gradient-to-br from-{color}-50/50 to-white relative overflow-hidden">
  <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-{color}-100/50 rounded-full blur-2xl"></div>
```

### 3.3 Tables

```jsx
// Header
<thead className="bg-[#f8f9fa] text-slate-600 font-bold sticky top-0 z-10 
  shadow-sm border-b-2 border-slate-300 uppercase tracking-wider text-[10px]">

// Column-specific styling
<th className="bg-yellow-50 text-yellow-700">  // VAT
<th className="bg-orange-50 text-orange-700">  // Thành tiền
<th className="bg-emerald-50 text-emerald-700"> // Đã TT
<th className="bg-red-50 text-red-700">         // Còn nợ

// Row hover (Desktop)
<tr className="hover:bg-{module}-50/20 group transition-colors cursor-default">

// Edit row highlight
<tr className="bg-orange-50/40 relative z-20 shadow-[0_0_10px_rgba(249,115,22,0.1)] 
  outline outline-1 outline-orange-300">

// Action buttons (show on hover)
<div className="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
```

### 3.4 Status Badges

```jsx
// Financial status
<span className="status-badge status-safe">An toàn</span>
<span className="status-badge status-watch">Cảnh báo</span>
<span className="status-badge status-danger">Nguy hiểm</span>

// Generic tag/badge
<span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] 
  font-black uppercase tracking-widest border border-slate-200/50 
  bg-{color}-100 text-{color}-700">
  <span className="w-1.5 h-1.5 rounded-full bg-{color}-500"></span>
  {label}
</span>

// Priority badges (Labor)
<span className="bg-rose-100 text-rose-700">Khẩn cấp</span>
<span className="bg-amber-100 text-amber-700">Cao</span>
<span className="bg-slate-100 text-slate-600">Bình thường</span>
```

### 3.5 Modals

```jsx
// Desktop overlay
<div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] 
  flex items-center justify-center p-4 animate-fade-in">
  <div className="bg-white rounded-2xl shadow-2xl w-full max-w-{size} 
    overflow-hidden animate-slide-in">
    // Header: bg-{module}-600 text-white
    // Body: p-6
  </div>
</div>

// Mobile Bottom Sheet
<div className="fixed inset-0 z-[100] flex items-end justify-center 
  bg-slate-900/60 backdrop-blur-sm xl:hidden animate-fade-in sm:items-center">
  <div className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl 
    overflow-hidden animate-slide-up sm:animate-zoom-in max-h-[90vh] flex flex-col">
    // Handle bar: w-12 h-1.5 bg-slate-200 rounded-full
  </div>
</div>
```

### 3.6 Form Inputs

```jsx
// Standard (Desktop inline edit)
<input className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 
  focus:ring-2 focus:ring-{module}-500/20 focus:border-{module}-500 outline-none text-xs" />

// Mobile (Bottom Sheet)
<input className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 
  text-sm focus:ring-2 focus:ring-{module}-500/20 focus:border-{module}-500 outline-none" />

// Number (currency)
<input type="number" className="... text-right font-bold" />

// Read-only display
<div className="bg-slate-50/50 border border-slate-200 rounded-lg px-3 py-2 font-bold text-sm">
```

---

## 4. RESPONSIVE PATTERNS

### 4.1 Table-to-Card (Core pattern)

```
Desktop (≥xl / ≥1280px):
  → Full data table, inline editing, hover actions
  → Hidden on: block xl:hidden (card view)

Mobile (<xl):
  → Card layout per entry
  → Bottom sheet for editing
  → Hidden on: hidden xl:block (table view)
```

### 4.2 Breakpoint Strategy
```
sm  (640px):   Show/hide labels, stack side-by-side
md  (768px):   Grid 2-col, show longer text
lg  (1024px):  Grid 3-4-col, sidebar visible
xl  (1280px):  Switch to table view, full dashboard
2xl (1536px):  Extra wide tables, more KPI cards
```

### 4.3 Navigation (Mobile)
```
< md: Bottom nav with icons only
≥ md: Sidebar with labels
Tabs: overflow-x-auto no-scrollbar (horizontal scroll)
```

---

## 5. ANIMATIONS & MICRO-INTERACTIONS

### Available CSS Animations:
```css
.animate-fade-in    { animation: fadeIn 0.3s ease-out; }
.animate-slide-in   { animation: slideIn 0.3s ease-out; }
.animate-slide-up   { animation: slideUp 0.3s ease-out; }
.animate-zoom-in    { animation: zoomIn 0.2s ease-out; }
.animate-pulse      { /* Built-in Tailwind pulse */ }
```

### Interactive States:
```
Hover: transition-colors (150ms default)
  → bg-slate-50, hover:bg-{module}-50/30
Expand: transition-transform duration-300
  → rotate-180 for chevrons
Scale: group-hover:scale-110 transition-transform
  → Icons, avatars
Active: active:scale-95 transition-transform
  → Mobile buttons (touch feedback)
```

### Loading States:
```jsx
// Skeleton loader
<div className="h-6 w-32 bg-{module}-100 rounded-full animate-pulse" />

// SkeletonLoader component (reusable)
<SkeletonLoader lines={4} />

// Button loading
{isSaving ? 'Đang lưu...' : 'Lưu'} // + disabled:opacity-50
```

---

## 6. MODULE-SPECIFIC STYLE GUIDE

| Module | Primary Color | Icon | Header BG |
|--------|--------------|------|-----------|
| Hợp đồng | Blue/Indigo | `gavel` | blue-600 |
| Thanh toán | Emerald | `account_balance_wallet` | emerald-600 |
| Thầu phụ | Purple/Violet | `engineering` | purple-600 |
| Vật tư | Orange/Amber | `inventory_2` | orange-600 |
| Chi phí | Rose | `receipt_long` | rose-600 |
| Nội bộ | Indigo | `sync_alt` | indigo-600 |
| Drive | Emerald | `folder_open` | emerald-600 |
| Phân tích | Blue | `analytics` | blue-600 |

---

## 7. CSS CLASSES CÓ SẴN (Dùng lại, không viết lại)

| Class | Sử dụng |
|-------|---------|
| `.glass-panel` | Card with glassmorphism + backdrop blur |
| `.glass-card` | Card nền mờ nhẹ |
| `.btn`, `.btn-primary`, `.btn-danger`, `.btn-glass` | Buttons |
| `.status-safe/watch/danger/critical` | Financial status badges |
| `.status-badge` | Badge wrapper |
| `.animate-fade-in`, `.animate-slide-in`, `.animate-slide-up` | Entry animations |
| `.no-scrollbar` | Hide scrollbar (horizontal lists) |
| `.text-gradient` | Text gradient effect |
| `.tabular-nums` | Monospace digits for numbers |
| `.custom-scrollbar` | Styled scrollbar |

---

## 8. COMMON ANTI-PATTERNS (Tránh tuyệt đối)

### ❌ DON'T:
- Không dùng Tailwind v4 syntax (project dùng v3)
- Không xóa `dark:` variant có sẵn
- Không dùng `text-sm` cho số tiền LỚN (dùng `text-2xl font-black`)
- Không dùng generic red/blue/green → dùng semantic colors (rose/emerald/blue)
- Không quên `tabular-nums` cho cột số tiền (gây nhảy layout)
- Không hardcode pixel values → dùng Tailwind spacing
- Không quên mobile bottom sheet cho modal trên mobile
- Không dùng `position: fixed` cho sidebar trên mobile

### ✅ DO:
- Luôn test cả light + dark mode
- Luôn thêm `transition-colors` cho hover states
- Dùng `hidden xl:block` / `block xl:hidden` cho table/card switch
- Font: dùng Inter (Google Fonts), font-sans fallback
- Icon: dùng `<span className="material-symbols-outlined notranslate" translate="no">`
- Bảng: alternate row styling, sticky header, hover effect
- Number: dùng `Intl.NumberFormat('vi-VN')` — dấu chấm ngàn, phẩy thập phân
