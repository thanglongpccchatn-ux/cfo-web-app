# Kế hoạch hoàn thiện Module KHO VẬT TƯ (WMS) — chuyên nghiệp

**Ngày:** 2026-07-11 · **Phạm vi:** `/inventory` (InventoryManager + InventoryContext + bảng WMS)
**Mục tiêu:** đưa Kho vật tư từ "chạy được một phần, tồn kho không phản ánh thực" → **WMS khép vòng, tồn kho tự động, định giá & báo cáo, an toàn dữ liệu**.

> **CẬP NHẬT PHẠM VI (user chốt 2026-07-11):** Kho vật tư = **Nhập (tự động từ lịch sử mua hàng `supplier_purchases`) − Xuất − Tồn theo dự án**, và **xem giá trị tồn**. KHÔNG làm WMS đầy đủ (đề nghị/PO/duyệt/điều chuyển). Mỗi lần mua hàng = coi như nhập kho dự án (1 nguồn nhập liệu). → Đã dựng **tab "Tồn kho dự án"** (`ProjectStock.jsx`, mặc định): gom nhập theo dự án×vật tư (khớp theo tên), xuất qua bảng `material_issues`, tính Tồn + Giá trị tồn (đơn giá bình quân). SQL: `db/material_issues.sql`. Các tab WMS cũ (đề nghị/PO/nhập/xuất) giữ nguyên nhưng KHÔNG còn là trọng tâm.

---

## 1. Đánh giá hiện trạng (đã khảo sát code)

7 tab đều gọi Supabase thật (không mock), nghiệp vụ **Đề nghị → Duyệt L1/L2 → Tạo PO** nối tốt. Nhưng phần lõi kho bị **đứt và lệch schema**:

| Vấn đề | Mức độ | Vị trí |
|---|---|---|
| **Tồn kho KHÔNG tự cập nhật** khi nhập/xuất (không code, không trigger) | 🔴 Chí tử | `InventoryContext.createTransaction/processTransactionSideEffects` |
| **2 họ bảng PO xung đột**: `purchase_order_items` (UI PO) vs `purchase_order_lines` (Nhập kho/Context/Suppliers — bảng KHÔNG tồn tại trong migration) | 🔴 | `InventoryContext.jsx:72,155-172`, `InventoryInbound.jsx:31-52` |
| **Lệch schema phiếu nhập/xuất**: code ghi `number/uom/price/notes/sub_type/attachment_url` nhưng bảng có `code(NOT NULL)/unit/unit_price` | 🔴 | `InventoryInbound.jsx:97-106`, context `createTransaction` |
| **PO → Nhập kho đứt**: dropdown lọc `status in ('ordered','partial')` (thường) nhưng PO thật status `'ORDERED'` (hoa) + sai bảng | 🟠 | `InventoryContext.jsx:70` |
| **KPI sai**: "chờ duyệt" lọc `status='PENDING'` (thực tế `PENDING_L1/L2` → luôn 0); "sắp hết" dùng `min_quantity` (schema là `min_stock` → luôn fallback 10); giá trị tồn dùng `avg_unit_price/price` (PO dùng `actual_price/base_price`) → dễ ra 0 | 🟠 | `InventoryDashboard.jsx:41-74`, `InventoryList.jsx:98` |
| **RLS toàn bộ bảng WMS = `USING(true)`** — ai có token đều đọc/ghi | 🟠 An ninh | `setup_wms_tables.sql`, `procurement_workflow.sql` |
| **Atomic yếu**: side-effect (expense/PO) ngoài transaction, rollback thủ công | 🟠 | `InventoryContext.jsx:116,151-216` |
| Thiếu: màn tra cứu phiếu nhập/xuất, xác nhận phiếu DRAFT (có `confirmTransaction` nhưng không UI gọi), kiểm kê, điều chuyển kho, CRUD kho, báo cáo Nhập-Xuất-Tồn | 🟡 | toàn module |

**Kết luận:** khung UI đầy đủ và đẹp, nhưng "trái tim" WMS (tồn kho realtime) chưa đập, và có nợ schema khiến nhập/xuất chỉ chạy nếu DB đã sửa tay ngoài repo.

---

## 2. Vấn đề gốc cần quyết (chốt trước khi làm)

1. **Chọn 1 họ bảng PO duy nhất.** Khuyến nghị giữ **`purchase_order_items`** (UI tạo PO đang dùng, có `quantity_ordered/received`, link `request_item_id`) làm chuẩn; bỏ/chuyển hướng `purchase_order_lines`. Migrate Inbound/Context/Suppliers sang dùng `purchase_order_items` + chuẩn hoá status chữ HOA.
2. **Cập nhật tồn kho bằng TRIGGER DB hay code?** Khuyến nghị **TRIGGER + RPC** (nguyên tử, không phụ thuộc client, không nuốt lỗi). Nhập/xuất "xác nhận" → trigger cộng/trừ `inventory_stocks`.
3. **Phương pháp định giá tồn:** **Bình quân gia quyền** (cập nhật `avg_unit_price` mỗi lần nhập) — phù hợp vật tư xây lắp, đơn giản, đủ chuẩn kế toán. (FIFO để giai đoạn sau nếu cần.)
4. **Quy trình phiếu:** phiếu nhập/xuất có cần **duyệt** (DRAFT → Chờ duyệt → Xác nhận) hay ghi nhận là tồn đổi ngay? Khuyến nghị: **Nháp → Xác nhận** (2 trạng thái); chỉ khi *Xác nhận* mới đổi tồn (tránh tồn ảo).

---

## 3. Kiến trúc mục tiêu

```
Đề nghị VT ─► Duyệt L1 ─► Duyệt L2 ─► Đơn đặt hàng (PO) ─► NHẬP KHO ─┐
   (có)         (có)        (có)          (có)            (xác nhận) │
                                                                     ▼
                                             ┌──── inventory_stocks (TỒN, TRIGGER tự cập nhật) ◄─┐
                                             │            ▲                                       │
   Chi phí dự án ◄─ XUẤT KHO (xác nhận) ─────┘            │                                       │
        │                                                 └── Định giá bình quân (avg_unit_price) ─┘
        ▼
   expense_materials / công nợ NCC  (RPC atomic, không nuốt lỗi)
```

**Nguyên tắc:** mọi thao tác đổi tồn/tiền chạy trong **1 RPC transaction** (mẫu đã dùng cho cash flow `save_material_plan`); tồn kho là **hệ quả tự động** của phiếu đã xác nhận (trigger), không tính tay ở client.

---

## 4. Lộ trình theo giai đoạn

### 🟥 Giai đoạn 0 — Vá nền móng (bắt buộc, ~2–3 ngày)
Mục tiêu: nhập/xuất/PO chạy đúng schema, hết đứt gãy; KPI đúng.
- **0.1** Thống nhất họ bảng PO về `purchase_order_items`; sửa `InventoryContext`/`InventoryInbound`/`SuppliersMaster` (dropdown chọn PO, cập nhật `quantity_received`, status `'ORDERED'/'PARTIAL'/'COMPLETED'`). Bỏ mọi tham chiếu `purchase_order_lines`.
- **0.2** Đồng bộ schema phiếu ↔ code: chọn **sửa code về đúng cột** `code/unit/unit_price` (+ tự sinh `code` phiếu: `NK/XK-<dự án>-<seq>`), hoặc `ALTER TABLE` thêm cột thiếu. Khuyến nghị sửa code (sạch hơn).
- **0.3** Sửa KPI Dashboard: `status in ('PENDING_L1','PENDING_L2')`, dùng `min_stock`, thống nhất field giá (`avg_unit_price` → fallback `actual_price`→`base_price`).
- **0.4** Chuẩn hoá field giá vật tư (1 nguồn) dùng chung Dashboard/Export/PO.

### 🟧 Giai đoạn 1 — Khép vòng + tồn kho tự động (~3–5 ngày)
Mục tiêu: tồn kho phản ánh thực; phiếu có vòng đời.
- **1.1** **RPC + TRIGGER cập nhật tồn:** `confirm_inventory_receipt(p_receipt_id)` — trong 1 transaction: set phiếu `Đã xác nhận`, cộng/trừ `inventory_stocks` theo từng item (IN: +, OUT: −, có kiểm tra âm kho), cập nhật `avg_unit_price` (bình quân) khi nhập. Trigger đảm bảo nguyên tử.
- **1.2** Nối **PO → Nhập kho** đúng (dropdown PO còn hàng, cập nhật `quantity_received`, tự set PO `PARTIAL/COMPLETED`).
- **1.3** **Xuất kho**: kiểm tra tồn thực, trừ tồn (qua RPC 1.1), ghi **chi phí xuất cho dự án** (expense/xuất dùng nội bộ) — atomic.
- **1.4** **Đồng bộ tài chính atomic**: nhập kho ↔ `expense_materials`/công nợ NCC gom vào RPC; hết non-atomic. Xử lý lỗi = rollback + toast.
- **1.5** **Màn Danh sách phiếu Nhập/Xuất** (tra cứu, lọc, xem chi tiết, Xác nhận phiếu Nháp, Huỷ). Gắn `confirmTransaction`.

### 🟨 Giai đoạn 2 — Định giá & Báo cáo (~3–4 ngày)
- **2.1** Định giá bình quân gia quyền hoàn chỉnh; giá trị tồn kho đúng.
- **2.2** Cảnh báo **dưới định mức** (`min_stock`) chính xác + widget "Vật tư sắp hết".
- **2.3** **Báo cáo Nhập–Xuất–Tồn** theo kỳ (kho/dự án/nhóm VT), **Thẻ kho** (sổ chi tiết 1 vật tư), giá trị tồn theo dự án. Xuất Excel/PDF.
- **2.4** Dashboard KPI realtime đúng (tồn, chờ duyệt, sắp hết, nhập/xuất hôm nay).

### 🟩 Giai đoạn 3 — Nghiệp vụ nâng cao + An toàn (~4–6 ngày)
- **3.1** **Kiểm kê kho** (stock take) + điều chỉnh tồn có lý do + audit.
- **3.2** **Điều chuyển kho** (`DIEU_CHUYEN`, dùng `target_warehouse_id`) + **Trả hàng NCC** (`TRA_HANG`).
- **3.3** **CRUD kho** (`inventory_warehouses`) — gắn nút "Quản lý kho".
- **3.4** **Siết RLS** bảng WMS theo mẫu `security_rls_phase2.sql` (`_apply_rls`): đọc mở authenticated, ghi = `import_inventory/export_inventory/manage_materials`; phiếu/tồn chỉ thủ kho + admin.
- **3.5** **Atomic hoá toàn bộ** + audit trail phiếu; **UX**: quét mã/nhập nhanh, in phiếu chuẩn, đồng bộ style VẬT TƯ.

---

## 5. Việc DB (SQL — chạy trên Supabase)

| # | Nội dung |
|---|---|
| S1 | Bỏ `purchase_order_lines`: tạo VIEW tương thích trỏ về `purchase_order_items` (nếu cần giữ code cũ) hoặc migrate hẳn. |
| S2 | (Nếu chọn ALTER) thêm cột thiếu phiếu; hoặc bỏ qua nếu sửa code. |
| S3 | RPC `confirm_inventory_receipt` (cộng/trừ tồn + định giá + cập nhật PO) — atomic. |
| S4 | Trigger/kiểm tra tồn không âm khi xuất. |
| S5 | RLS phase-2 cho `inventory_*`, `purchase_order_*`, `po_payments`. |
| S6 | (Định giá) cột `avg_unit_price` trên `materials` (kiểm tra đã có chưa) + cập nhật trong RPC. |

---

## 6. Ưu tiên & thứ tự đề xuất

1. **Giai đoạn 0** (nền móng) — làm trước, vì nhập/xuất/PO hiện đang lệch, mọi thứ khác phụ thuộc.
2. **Giai đoạn 1** (tồn kho tự động) — giá trị lớn nhất; sau đây WMS "sống".
3. **Giai đoạn 2** (báo cáo) — biến số liệu thành công cụ quản trị.
4. **Giai đoạn 3** (nâng cao + RLS) — hoàn thiện & an toàn.

> Mỗi giai đoạn: code → lint/build → test trên localhost → commit/push. SQL kèm file trong `db/` để user chạy. Không nuốt lỗi; ưu tiên atomic bằng RPC.

---

## 7. Rủi ro & lưu ý
- **Schema thật có thể đã lệch repo** (DB sửa tay). Cần đối chiếu bảng thật trước khi ALTER (tránh hỏng dữ liệu đang có).
- Đổi họ bảng PO ảnh hưởng cả `SuppliersMaster` (đang dùng `purchase_order_lines`) — phải sửa đồng bộ.
- Cập nhật tồn bằng trigger: cần seed **tồn đầu kỳ** đúng trước khi bật, nếu không tồn sẽ lệch.
- RLS siết có thể khoá nhầm thủ kho — test kỹ, có rollback (như phase-1/2 đã làm).
