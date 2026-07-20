# CFO Web App — Hướng dẫn cho AI Agent

Ứng dụng quản lý tài chính doanh nghiệp xây dựng (PCCC/M&E): hợp đồng & dự án, hồ sơ thanh toán,
công nợ CĐT & nhà cung cấp, vật tư/kho, kế toán TT200, dashboard dòng tiền. **Toàn bộ UI tiếng Việt.**

## Stack & lệnh

- React 18 + Vite 7 (JSX thuần, KHÔNG TypeScript), Tailwind CSS (dark mode theo class), PWA.
- Supabase: PostgREST + RLS + RPC (plpgsql). TanStack Query cho data fetching ở một số module.
- Lệnh: `npm run dev` (dev server) · `npm run build` (bắt buộc pass trước khi kết thúc task) ·
  `npm run test` (vitest, 5 file trong `src/test/`) · `npm run lint`.

## Cấu trúc

- `src/components/` — module lớn đặt theo tính năng: `supplierPayables/` (mua hàng & công nợ NCC),
  `Inventory/` (kho/vật tư), `dashboard/`, `documentTracking/`, `payments/`, `common/` (SearchableSelect, NumberInput...).
- `src/App.jsx` — routes + lazy load + `ProtectedRoute requiredPerms=[...]`.
- `db/*.sql` — migration/RPC chạy TAY trong Supabase SQL Editor. **Agent chỉ tạo/sửa file SQL,
  KHÔNG tự chạy lên database.** Người dùng tự chạy và xác nhận.
- `src/context/AuthContext` — `useAuth()` trả `hasPermission(perm)`, `profile`, `user`.

## Quy tắc bảo mật & dữ liệu (BẮT BUỘC)

1. **Không tin dữ liệu client** với giá/tồn kho/quyền: thao tác ghi nhạy cảm đi qua RPC
   `security definer` có kiểm `current_user_has_perm(...)`. RPC hiện có:
   `save_purchase_order`, `issue_from_request`, `issue_adhoc`, `delete_project_cascade`.
   Đã có RPC thì KHÔNG insert/update thẳng bảng tương ứng nữa.
2. **RLS**: SELECT mở (`using true`), WRITE theo quyền. Cột giá bị khóa ở bảng gốc
   (`supplier_purchases`, `material_issues`) — đọc giá qua view `supplier_purchases_v` /
   `material_issues_v` (che cột theo quyền `view_material_price`).
3. **Mọi mutation phải kiểm `error`**; với delete/update có thể bị RLS chặn im lặng, dùng
   `{ count: 'exact' }` và báo toast khi `count === 0`. KHÔNG BAO GIỜ nuốt lỗi im lặng.
4. **Gate nút theo quyền** bằng `hasPermission('create_payments' | 'edit_payments' |
   'delete_payments' | 'manage_materials' | ...)` — xem mẫu ở `DocTrackingRows.jsx`.
5. **Audit log** (`logAudit`) chỉ ghi SAU khi thao tác chắc chắn thành công.
6. Mã tự sinh chống trùng (số HĐ, mã phiếu) phải xử lý ở server với `pg_advisory_xact_lock`
   — không kiểm tra trùng phía client rồi insert.

## Quy ước UI

- Text hiển thị tiếng Việt có dấu; toast qua `smartToast` hoặc `useToast`.
- Mobile: pattern chuẩn = bảng desktop `hidden md:block` + card list `md:hidden`,
  vùng chạm ≥ 44px (`min-h-[44px]`), text dài dùng `truncate`/`line-clamp-2`,
  phân trang mobile rút gọn Trước/Sau. Dark mode: mọi phần tử mới có class `dark:`
  (RIÊNG DashboardOverview + DashboardDetailModal chỉ có light — đừng thêm dark: ở đó).
- Tiền tệ: `formatCurrency`/`formatVND`/`formatBillion` từ utils có sẵn — không tự format.

## An toàn vận hành

- KHÔNG chạy lệnh ghi/xóa lên Supabase production (kể cả qua curl/REST). Chỉ đọc để kiểm tra.
- KHÔNG commit/push trừ khi được yêu cầu rõ ràng. Commit theo conventional: `feat|fix|refactor(scope): mô tả`.
- File > 800 dòng: tách module. Hàm > 50 dòng: cân nhắc tách.
- Khi sửa xong: chạy `npm run build` xác nhận pass rồi mới báo hoàn thành.
