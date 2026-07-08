# Báo cáo Review Toàn dự án — CFO Web App

**Ngày:** 2026-07-07
**Phạm vi:** Toàn bộ `src/` + migrations SQL. 3 trục review song song: Bảo mật/RBAC, Chất lượng & Logic tài chính, Kiến trúc.
**Verdict:** 🔴 **BLOCK** — có lỗ hổng leo quyền admin toàn hệ thống và các lỗi mất dữ liệu tài chính đa người dùng.

> Trạng thái: **Chỉ báo cáo, chưa sửa** (theo yêu cầu). Dùng file này làm backlog.

---

## 🔴 CRITICAL

### C1. RLS mở toang → bất kỳ ai cũng tự leo quyền Admin (NGHIÊM TRỌNG NHẤT)
Hầu hết bảng nghiệp vụ dùng policy `FOR ALL USING (true)`, nhiều policy áp cho cả `anon`.
- **File:** `supabase/migrations/rbac_setup.sql:61-65`, `roles_and_partners.sql:263-265` (profiles), `schema.sql:129-136`, và ~12 migration khác (setup_wms_tables, procurement_workflow, add_task_management, split_partners_and_materials, add_variations_tables, add_settlement_fields, staff_assignments, add_material_brands_table, add_revenue_plan, add_subcontractor_contracts, add_subcontractor_variations).
- **Tác hại:** RBAC ứng dụng (`get_user_permissions`, `hasPermission`, `ProtectedRoute`, nav gating) chỉ là lớp UI. Với anon key (lộ sẵn trong bundle), user quyền thấp/chưa đăng nhập gọi thẳng REST:
  `supabase.from('profiles').update({ role_code:'ROLE01' }).eq('id', myId)` → thành Admin → full quyền dữ liệu tài chính.
- **Mẫu đúng đã có sẵn:** `treasury_module.sql:27,30,55` (policy INSERT/UPDATE join `profiles`/`role_permissions`). Cần áp lại cho mọi bảng.
- **Fix:**
  1. `profiles`: SELECT mở cho authenticated; UPDATE giới hạn `auth.uid()=id` VÀ cấm sửa `role_code`/`status` trừ khi có `manage_users`.
  2. `role_permissions`/`permissions`/`roles`: INSERT/UPDATE/DELETE bắt buộc kiểm tra `manage_users`.
  3. Rà toàn bộ bảng `FOR ALL USING (true)`, áp pattern như `treasury_module.sql`.
  4. Thêm `WITH CHECK` cho mọi policy ghi.
  5. Test: gọi REST bằng anon key + JWT user quyền thấp, xác nhận không ghi được bảng nhạy cảm.

### C2. Lưu kế hoạch = DELETE toàn bộ rồi INSERT, không transaction → mất dữ liệu
- **File:** `src/components/MaterialPlan.jsx:136-143`, `src/components/CashFlowPlan.jsx:211-225`
- Supabase client không có transaction đa-statement. Insert lỗi giữa chừng (mạng/RLS/constraint) → toàn bộ KH dự án+năm biến mất, chỉ hiện toast.
- **Fix:** RPC Postgres bọc transaction, hoặc `upsert` theo khóa `(project_id, year, category, sub_category, month)` thay vì xoá sạch.

### C3. Lost-update giữa các phòng ban / người nhập
- **File:** `src/components/CashFlowPlan.jsx:206-225`, `src/components/MaterialPlan.jsx:129-151`
- CashFlowPlan save xoá tất cả category (trừ material) rồi ghi lại từ snapshot `planBase` lúc mở trang → đè mất bản cập nhật của bộ phận khác vừa lưu. MaterialPlan tương tự giữa 2 người sửa nhóm khác nhau cùng dự án.
- **Fix:** Chỉ ghi category/nhóm user có quyền & thực sự đổi; dùng upsert theo khóa; hoặc optimistic concurrency (kiểm tra version/`updated_at`).

---

## 🟠 HIGH

### H4. `useEffect` nạp lại `lines` không check `dirty` → mất dữ liệu đang gõ
- **File:** `src/components/MaterialPlan.jsx:82-91`. Effect phụ thuộc `data?.planRows`; query refetch ngầm (sau `save()` invalidate không scope theo project, hoặc reconnect sau `staleTime` 2') sẽ ghi đè `lines` khi user đang nhập dở.
- **Fix:** `if (dirty) return;` đầu effect, hoặc tách "load khi đổi project/year" (ref theo dõi) khỏi refetch ngầm.

### H5. Route `/site_diary` thiếu `requiredPerms`
- **File:** `src/App.jsx:244` vs `src/config/navigation.js:62` (nav yêu cầu `view_construction`/`manage_construction`). RLS `20240325_site_diary.sql:40-41` cố ý tin "app validate", nhưng `SiteDiary.jsx:41-51` không lọc theo `project_members`.
- **Tác hại:** Mọi user đăng nhập tạo nhật ký thi công giả + upload ảnh cho bất kỳ dự án nào.
- **Fix:** Thêm `requiredPerms={['view_construction','manage_construction']}`; lọc dự án theo phân công; RLS INSERT join `project_members`.

### H6. Filter injection qua `.or()` (GlobalSearch)
- **File:** `src/components/GlobalSearch.jsx:79,85,92` — nội suy thẳng chuỗi tìm kiếm vào cú pháp `.or()`, không escape `, ( ) .`
- **Fix:** Escape input, hoặc dùng nhiều `.ilike()` riêng, hoặc RPC full-text search.

### H7. Công thức tài chính lệch giữa các màn
- "Tổng HĐ gồm phát sinh": `financialCalcs.js:29`, Dashboard/ContractMasterDetail/Settlement CÓ cộng; `contract/PartnerDetailModal.jsx` KHÔNG cộng `total_approved_variations`.
- "Tiền bảo hành": `financialCalcs.js:70-71` dùng `originalValue` (pre-VAT); `WarrantyTracking.tsx:68` dùng `total_value_post_vat` (post-VAT) → lệch phần VAT.
- **Fix:** Hàm dùng chung `getEffectiveTotalValuePostVat(project)` + thống nhất cơ sở tính bảo hành.

### H8. Race idempotent → bút toán kế toán trùng
- **File:** `src/lib/accountingService.js:57-68,100-108` — check-then-insert không có UNIQUE constraint. Double-click/retry tạo 2 bút toán cho 1 nghiệp vụ.
- **Fix:** UNIQUE `(source_module, source_id)` trên `acc_journal_entries`; bắt lỗi unique = "đã tồn tại".

---

## 🟡 MEDIUM

- **M9. 3 nguồn tính tài chính trùng** đồng bộ tay: `utils/financialCalcs.js`, `lib/financials.ts`, `components/contract/contractHelpers.ts`. `financials.test.js:284` có test "tương đương" chứng minh logic bị nhân đôi. `formatBillion` định nghĩa trùng 3 nơi.
- **M10. Code chết:** `lib/financials.ts` và `hooks/useQueries.js` — 0 import ngoài test. Rủi ro sửa nhầm nơi không chạy.
- **M11. Nav ↔ route perms lệch:** `contracts`, `doc_tracking`, `weekly_expense_plan`, `partners` (nav `manage_users` vs route `manage_partners`). Nên refactor route đọc `requiredPerms` từ `flattenNav()`.
- **M12. Không có CSP/security headers** — thêm ở `vercel.json` (CSP, X-Frame-Options, HSTS…).
- **M13. `InventoryContext`** giữ 6 bảng server-state bằng `useState` + `safeFetch` nuốt lỗi (trả `[]` + console.warn) → lỗi dữ liệu thành "không có dữ liệu". Nên chuyển react-query, bỏ nuốt lỗi.
- **M14. Component/hàm quá dài gộp nhiều trách nhiệm:** CashFlowPlan.jsx & MaterialPlan.jsx (~235 dòng hàm chính), `computeProjectFinancials` (~90 dòng). Tách custom hook.

---

## ⚪ LOW

- **L15. 11 file >800 dòng:** SubcontractorContracts.jsx (1474), BiddingManagement.jsx (1052), TaskManagement.jsx (947), ContractMasterDetail.jsx (909), MaterialTracking.jsx (890), accounting/FinancialReports.jsx (838), SuppliersMaster.jsx (835), MaterialsMaster.jsx (824), accounting/EInvoiceManagement.jsx (823), DashboardOverview.jsx (811), UserManagement.jsx (808).
- **L16. `console.*` in số tiền bút toán** ra production: `accountingService.js:105,123,137,160,176,192,196`. Dùng logger gate theo `import.meta.env.DEV`.
- **L17. Magic number** `Math.abs(totalDebit-totalCredit) > 1` (accountingService.js:113) — đặt hằng `BALANCE_TOLERANCE_VND`.
- **L18. `calculateSafetyRatio` trả 0 khi không có chi phí** (financials.ts:53-57) — nên là ∞ (dead code nên tác động thấp).

---

## ✅ Đã kiểm tra OK (không phải lỗi)
- Không có secret hardcode; `.env*` đã gitignore, chỉ commit `.env.example`.
- Không XSS / `dangerouslySetInnerHTML`.
- Client chỉ dùng anon key (không có service_role trong bundle).
- Auth bcrypt chuẩn; RPC `admin_create_user`/`admin_delete_user` SECURITY DEFINER có kiểm tra `manage_users` (nhưng bị C1 làm giảm giá trị vì có thể ghi thẳng bảng).
- Mọi `.delete()` đều có scope `.eq/.in/.match`.
- `cashflow.js` index tháng nhất quán (0-based nội bộ, 1-based khi lưu) — không off-by-one. Gộp trùng (nhóm,tháng) trước khi lưu đã đúng. Chia-cho-0 được guard.
- Mẫu `Promise.all` gộp query trong `DashboardOverview` — tốt, nên nhân rộng.

---

## Thứ tự đề xuất xử lý
1. **C1 (RLS)** — an ninh, ưu tiên tuyệt đối. SQL phía Supabase.
2. **C2, C3, H4** — mất dữ liệu, sửa trong code client (upsert theo khóa + guard dirty).
3. **H5, H6, H8** — an ninh/toàn vẹn cục bộ.
4. **H7, M9, M10** — thống nhất logic tài chính về 1 nguồn (`lib/financials.ts`).
5. **M11–M14, L15–L18** — dọn dần theo backlog.
