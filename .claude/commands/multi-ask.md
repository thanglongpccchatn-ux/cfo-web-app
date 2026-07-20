---
description: "CFO app: Gemini soạn prompt (có ngữ cảnh dự án) → Sonnet phản biện → main model implement"
---

Yêu cầu gốc của user: $ARGUMENTS

Đây là bản multi-ask RIÊNG cho dự án CFO Dashboard (SATECO). Thực hiện đúng thứ tự. Trao đổi trung gian tóm tắt ngắn; kết quả cuối đầy đủ.

## Ngữ cảnh dự án (dùng cho MỌI bước)

- **Stack:** React 19 + Vite 7 + Tailwind 3, phần lớn .jsx (đang migrate TS dần), Supabase (PostgreSQL/Auth/Realtime/Storage), Chart.js, jsPDF/xlsx/PapaParse, react-query. Deploy Vercel auto từ `main`.
- **Bản chất:** ERP tài chính-thi công cho 3 pháp nhân (Thăng Long/Thành Phát/Sateco, `acting_entity_key`), có kế toán kép TT200 (`lib/accountingService.js`, bảng acc_*).
- **RBAC:** RPC `get_user_permissions` union nhiều vai trò qua `user_roles`; admin=ROLE01/ADMIN bypass. Route mở cho mọi user dùng `requiredPerms: []`, KHÔNG dùng `['*']`.
- **Nguồn tính tiền DUY NHẤT:** `utils/financialCalcs.js` (computeProjectFinancials, getEffectiveTotalValuePostVat, getWarrantyAmount). `lib/financials.ts` + `hooks/useQueries.js` là CODE CHẾT — cấm import.
- **Bảo mật đã siết:** RLS phase 1+2 (`db/security_rls_hardening.sql`, `db/security_rls_phase2.sql` — generator `_apply_rls`); giá vật tư che server-side qua view `supplier_purchases_v`/`material_issues_v` theo quyền `view_material_price` (`db/vattu_price_guard.sql`).
- **Tài liệu đọc thêm khi cần:** `docs/KIEN_TRUC_TONG_QUAN.md`, `docs/CODE_REVIEW_2026-07-07.md`, `docs/KHO_VAT_TU_PLAN.md`, `cfo-design-system.md`.
- **Lệnh:** `npm run dev` (5173) / `npm run build` / `npx vitest run` / `npm run lint`. Repo còn ~114 lỗi lint CŨ không chặn build — chỉ cần file mình sửa sạch lint.

## Các bài học xương máu (BẮT BUỘC đưa vào prompt và review)

1. **Không nuốt lỗi Supabase:** cấm mẫu `const {data} = await ...insert()` bỏ qua `error` rồi vẫn báo thành công (bug 42703 reference_no cũ). Mọi thao tác ghi phải check `error`, hiện smartToast, không đóng modal khi lỗi.
2. **Ghi nhiều bảng / delete-then-insert → RPC atomic** trong Postgres (mẫu: `save_material_plan`, `save_cash_flow_plan`, `issue_from_request`), kèm `current_user_has_perm` guard trong hàm SQL.
3. **RLS là lớp bảo vệ thật, UI chỉ là tiện ích.** Bảng mới PHẢI có RLS theo mẫu `_apply_rls` (SELECT authenticated, GHI theo quyền module, admin bypass). Cấm `FOR ALL USING (true)`.
4. **Cột giá vật tư là nhạy cảm** — mọi truy vấn giá đi qua view `*_v`, không đọc bảng gốc.
5. **Số hiển thị:** đơn vị triệu đồng ở các màn kế hoạch, `tabular-nums`, NumberInput có sẵn.
6. **Idempotent kế toán:** bút toán tự sinh dùng source_module+source_id + unique index, bắt lỗi 23505 → skip.
7. **projects.status là TIẾNG VIỆT** ('Đang thi công'/'Bảo hành'/'Đã hoàn thành').
8. **useEffect nạp dữ liệu phải guard dirty** (mẫu loadedKeyRef ở MaterialPlan) để refetch ngầm không đè dữ liệu đang gõ.

## Bước 1 — Gemini soạn prompt

1. Ghi vào file tạm trong scratchpad (`gemini_input.md`): yêu cầu gốc + TOÀN BỘ phần "Ngữ cảnh dự án" và "Bài học xương máu" ở trên + danh sách file/module liên quan trực tiếp tới yêu cầu (tự Glob/Grep tìm trước, liệt kê đường dẫn + 1 dòng mô tả).
2. Chạy: `gemini -p "Ban la ky su truong cua du an nay. Doc noi dung duoc pipe vao, viet prompt ky thuat chi tiet cho yeu cau: muc tieu, pham vi (file nao sua/tao), rang buoc (bam sat ngu canh du an va bai hoc xuong mau), tieu chi nghiem thu, edge case, SQL can chay neu co. Tra loi tieng Viet." < gemini_input.md`
3. Lưu kết quả vào `prompt_v1.md`. Gemini free tier chậm (1-3 phút) và có thể phải retry — kiên nhẫn, timeout đặt 180000ms trở lên; nếu quá thì chạy background và đọc file output.
4. Nếu `gemini` lỗi hẳn (quota/mạng): tự soạn prompt thay, ghi rõ Gemini vắng mặt, KHÔNG dừng quy trình.

## Bước 2 — Sonnet phản biện

Spawn Agent (general-purpose, model: sonnet, run_in_background: false) với prompt gồm: yêu cầu gốc + prompt_v1 + phần "Bài học xương máu". Yêu cầu Sonnet soát theo checklist CFO:
- Phân quyền: route có requiredPerms đúng? nav↔route khớp? RLS cho bảng mới?
- Tiền: có tính inline trùng với financialCalcs.js không? VAT 8%, khoán Sateco trên PRE-VAT, bảo hành 5% — dùng hàm chung.
- Ghi dữ liệu: có chỗ nào nuốt lỗi / delete-then-insert không atomic / thiếu guard dirty?
- Multi-entity: có xử lý đúng `acting_entity_key`?
- Trả về tối đa 5 vấn đề quan trọng nhất kèm sửa cụ thể, hoặc "APPROVED".

## Bước 3 — Vòng lặp (tối đa 2 vòng)

Có phản biện thì ghi `feedback.md` (prompt cũ + phản biện + "Nhiệm vụ: sửa prompt, trả bản hoàn chỉnh") → pipe cho Gemini → `prompt_v2.md` → Sonnet review chốt (SendMessage agent cũ giữ context). Sau 2 vòng lấy bản mới nhất, tự dung hòa ý còn lại.

## Bước 4 — Main model implement

TỰ MÌNH thực hiện theo prompt chốt:
- Code bám các mẫu có sẵn trong repo (DataTable, NumberInput, SearchableSelect, smartToast, Icon.jsx, navigation.js).
- Bảng/cột mới → viết file SQL vào `db/` (kèm RLS + rollback), ghi rõ trong báo cáo "USER CẦN CHẠY SQL" — user tự chạy trên Supabase, KHÔNG tự ý chạy.
- Chạy `npx vitest run` + `npm run build`; thêm test cho logic tiền mới (vitest, đặt ở `src/test/`).
- Sửa xong lint sạch cho file mình đụng vào.

## Bước 5 — Báo cáo

Tóm tắt: Gemini đề xuất gì, Sonnet bắt gì, bản chốt khác yêu cầu gốc ở đâu, đã implement + test ra sao, và danh sách SQL user cần chạy (nếu có).
