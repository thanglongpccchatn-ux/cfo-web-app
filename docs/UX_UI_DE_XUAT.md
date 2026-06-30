# CFO Web App — Đề xuất cải thiện UX/UI

> Dựa trên đọc code thực tế (App.jsx, Sidebar, index.css, cfo-design-system.md). Sắp theo mức ưu tiên P0→P2 (tác động/chi phí).

## 0. Vấn đề gốc: design-doc vs code đang LỆCH nhau
`cfo-design-system.md` đặt mục tiêu một đằng, code làm một nẻo → thiếu nhất quán:

| Hạng mục | Design-doc nói | Code thực tế |
|---|---|---|
| Theme | Dark OLED mặc định | **Light mặc định** (`--bg-primary:#f8fafc`), dark chỉ một phần |
| Font | Fira Code + Fira Sans | **Inter** |
| Icon | SVG (Heroicons/Lucide), KHÔNG icon kiểu font | **Material Symbols** (webfont) — dù đã cài sẵn `lucide-react` |
| Hiệu năng | "Excellent" | **Glassmorphism `backdrop-blur` khắp nơi** (tốn GPU), 2 hệ icon |

👉 **Việc đầu tiên:** chốt 1 định hướng. Khuyến nghị cho app tài chính dày dữ liệu: **"Clean Data-Dense"** — nền sáng làm chính + dark mode tùy chọn, **Inter** (giữ — hợp số liệu hơn Fira), **một hệ icon SVG (lucide)**, glass dùng tiết chế. Sửa lại design-doc cho khớp.

---

## P0 — Tác động cao, nên làm trước

### 1. Command Palette (Ctrl/⌘ + K)
~50 module trong sidebar → tìm/nhảy nhanh là đòn bẩy UX lớn nhất cho người dùng thành thạo (CFO/kế toán dùng hàng ngày). Gõ "hợp đồng", "bút toán", "vay"... → enter. Kèm tìm nhanh dự án/đối tác.

### 2. Hợp nhất icon về `lucide-react`, bỏ Material Symbols
- Material Symbols là **webfont nặng** tải toàn bộ; `lucide-react` đã có sẵn, tree-shakeable, là SVG → nhẹ hơn, render nhanh, **đúng design-doc**.
- Lợi: giảm bundle, bớt FOUT/nhấp nháy icon, 1 nguồn icon nhất quán.

### 3. Tiết chế glassmorphism trên bề mặt dữ liệu
- `backdrop-filter: blur()` rất tốn khi cuộn bảng lớn / nhiều card. Giữ glass cho header/sidebar; **bỏ blur trên bảng, danh sách, modal dữ liệu** → cuộn mượt hơn rõ rệt.
- Thay bằng nền đặc + viền + shadow nhẹ (đã có token `--border-light`, shadow).

### 4. Chuẩn hóa component Bảng (DataTable dùng chung)
App là công cụ dữ liệu nhưng mỗi màn tự dựng bảng. Tạo 1 `<DataTable>` chuẩn:
- **Header dính (sticky)**, cột số căn phải + `font-variant-numeric: tabular-nums` (tiền thẳng cột).
- Sắp xếp/lọc/đổi rộng cột; **đóng băng cột đầu** (mã/tên dự án).
- Trạng thái rỗng (empty state) + **skeleton** (đã có `SkeletonTable`, dùng nhất quán).
- Phân trang/ảo hóa (virtualize) cho danh sách dài → hiệu năng.

---

## P1 — Nền tảng nhất quán

### 5. Design tokens + thư viện component lõi
Hiện rất nhiều giá trị "magic" inline (`rounded-[40px]`, `blur-[80px]`, gradient lặp). Gom về:
- Thang **radius/shadow/spacing** trong `index.css` (đã có vài var — mở rộng & ép dùng).
- Component lõi: `Button`, `Card`, `StatCard`, `Badge`, `Modal`, `DataTable` → giảm trùng lặp, đồng bộ hover/focus.

### 6. Accessibility (design-doc checklist gần như chưa đạt)
- `:focus-visible` rõ ràng cho điều hướng bàn phím; ARIA cho nav/bảng/modal.
- **`prefers-reduced-motion`** (hiện `animate-float`, transition bỏ qua người nhạy chuyển động).
- Tương phản light-mode ≥ 4.5:1 (chữ xám nhạt trên nền trắng đang rủi ro).
- `cursor-pointer` + transition 150–300ms nhất quán mọi phần tử bấm được.

### 7. Lazy-load thư viện xuất nặng (xlsx, jspdf, html2canvas)
Build cảnh báo chunk >500KB. `xlsx` (429KB), `jspdf` (386KB), `html2canvas` (201KB) chỉ cần khi xuất → `import()` động lúc bấm "Xuất" thay vì nạp sẵn → tải trang ban đầu nhanh hơn nhiều.

### 8. Điều hướng: breadcrumb + giữ trạng thái
- Breadcrumb cho route lồng (`accounting/coa` → Kế toán › Hệ thống TK).
- Sidebar: tô đậm nhóm đang mở, nhớ nhóm đã mở (đã có `sidebar_collapsed` — tốt), thêm ô tìm trong menu.

---

## P2 — Nâng chất trải nghiệm

### 9. Dark mode đúng nghĩa (toggle)
Design-doc muốn OLED; nhiều `dark:` đã có sẵn → hoàn thiện token dark + nút bật/tắt + nhớ lựa chọn. Hợp người làm tài chính buổi tối.

### 10. KPI cards tài chính chuyên nghiệp
- Sparkline xu hướng + **delta %** (▲/▼) + màu ngữ nghĩa (đã có token safe/watch/danger/critical — dùng nhất quán).
- Định dạng tiền VND/tỷ thống nhất (đã có `formatVND/formatBillion` — ép dùng mọi nơi).

### 11. Form khổng lồ (ContractCreate, DocumentTracking)
- Chia **wizard nhiều bước** + thanh lưu dính (sticky), **autosave nháp**, validate inline.
- Mask nhập số có phân cách nghìn (đã có `formatInputNumber` — dùng nhất quán).

### 12. Responsive cho bảng tài chính
Bảng nhiều cột trên mobile (375px) → bọc `overflow-x:auto`, hoặc chế độ "card per row" cho màn nhỏ. Test các mốc 375/768/1024/1440 (design-doc yêu cầu).

---

## Gợi ý thứ tự thực thi
1. **P0.2 (icon) + P0.3 (glass)** — gọn, cải thiện hiệu năng/nhất quán ngay, ít rủi ro.
2. **P0.4 (DataTable) + P1.5 (component lõi)** — nền cho mọi màn về sau.
3. **P0.1 (Command Palette)** — tính năng "wow", giá trị dùng hàng ngày cao.
4. P1.6 (a11y) + P1.7 (lazy export) — chất lượng & tốc độ.
5. P2 — khi nền đã vững.

> Lưu ý: nhiều mục là refactor diện rộng → nên làm khi chạy được `npm run dev` để kiểm bằng mắt, kèm screenshot trước/sau.
