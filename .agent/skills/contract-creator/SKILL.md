---
name: contract-creator-expert
description: |
  CHUYÊN GIA tạo và quản lý Hợp đồng/Dự án trong hệ thống CFO Sateco.
  Trigger: "tạo hợp đồng", "thêm dự án", "nhập hợp đồng", "add contract",
  "chỉnh sửa HĐ", "phụ lục", "addenda", "tỷ lệ Sateco", "tỷ lệ khoán",
  "giá trị hợp đồng", "VAT", "bảo hành", "bảo lãnh", "mốc thanh toán",
  "milestone", "payment schedule", "thông tin ngân hàng", "Google Drive",
  hoặc bất kỳ câu hỏi nào về quá trình setup hợp đồng từ đầu đến cuối.
---

# 📋 Expert Skill: Tạo & Quản Lý Hợp Đồng

## Bối cảnh nghiệp vụ

Sateco hoạt động trong cấu trúc 3 pháp nhân:
- **Thăng Long** (TL) — Công ty mẹ, ký HĐ với CĐT
- **Sateco** (STC) — Công ty con, thi công thực tế, nhận khoán từ TL
- **Thành Phát** (TP) — Công ty liên kết, xử lý một số dòng tiền

Module này quản lý **toàn bộ vòng đời hợp đồng**: từ tạo mới, thiết lập tỷ lệ phân bổ,
mốc thanh toán, bảo hành, đến tích hợp Google Drive.

---

## 1. KIẾN TRÚC DATABASE

### Bảng `projects` (Hợp đồng / Dự án)
```sql
-- Thông tin pháp lý
name                 TEXT        -- Tên HĐ đầy đủ (BẮT BUỘC)
code                 TEXT UNIQUE -- Mã HĐ CĐT (BẮT BUỘC, VD: "2024/HĐTC/VG-STC")
internal_code        TEXT UNIQUE -- Mã nội bộ Sateco (VD: "HP4-01")
partner_id           UUID → partners(id)   -- FK Chủ đầu tư
client               TEXT        -- Tên CĐT (denormalized)
contract_type        TEXT        -- 'Thi công' | 'Cung cấp' | 'Thiết kế' | 'EPC'
contract_form        TEXT        -- 'Trọn gói' | 'Đơn giá' | 'Đơn giá điều chỉnh'
acting_entity_key    TEXT        -- 'thanglong' | 'thanhphat' (đơn vị ký HĐ)
signature_status     TEXT        -- 'Chưa ký' | 'Đã ký' | 'Đã ký PL'
settlement_status    TEXT        -- 'Chưa quyết toán' | 'Đang quyết toán' | 'Đã quyết toán'
location, description, payment_terms  TEXT

-- Giá trị tài chính (cốt lõi)
original_value           NUMERIC -- Giá trị trước VAT (BẮT BUỘC)
vat_percentage           NUMERIC -- % VAT CĐT (thường 8%)
vat_amount               NUMERIC -- Tiền VAT = original_value × vat%
total_value_post_vat     NUMERIC -- Tổng sau VAT
internal_vat_percentage  NUMERIC -- % VAT nội bộ (có thể khác VAT CĐT)

-- Phân bổ Sateco (Dual Ratio System)
sateco_contract_ratio    NUMERIC -- Tỷ lệ HĐ (dòng giấy tờ): mặc định 98%
sateco_actual_ratio      NUMERIC -- Tỷ lệ thực (dòng tiền mặt): AUTO-CALC
internal_deduction       NUMERIC -- Chiết khấu nội bộ (%)

-- Thời gian
sign_date, start_date, end_date  DATE
status    TEXT  -- 'Đang thi công' | 'Hoàn thành' | 'Tạm dừng' | 'Bảo hành'

-- Bảo hành
warranty_percentage        NUMERIC -- % giữ lại BH (thường 5%)
warranty_duration_months   INT     -- Thời gian BH (tháng)
has_warranty_bond          BOOLEAN -- Có bảo lãnh BH thay thế không
handover_date              DATE    -- Ngày bàn giao
warranty_schedule          JSONB   -- [{year, percentage, amount, date}]

-- Mốc thanh toán
payment_schedule  JSONB  -- [{name, percentage, amount, condition, has_guarantee, due_days, base_type}]

-- Ngân hàng (3 công ty)
tl_bank_account, tl_bank_name, tl_bank_branch, tl_account_holder  TEXT
tp_bank_account, tp_bank_name, tp_bank_branch, tp_account_holder  TEXT
st_bank_account, st_bank_name, st_bank_branch, st_account_holder  TEXT

-- Google Drive
google_drive_folder_id  TEXT
document_link           TEXT
```

### Bảng `partners` (Đối tác)
```sql
-- Filter: type = 'Client'
id, code, name, short_name, tax_code, address, phone, email, type
```

### Bảng `addendas` (Phụ lục HĐ)
```sql
project_id       UUID → projects(id)
name             TEXT
requested_value  NUMERIC
status           TEXT  -- 'Chờ duyệt' | 'Đã duyệt' | 'Từ chối'
```

---

## 2. DUAL RATIO SYSTEM (Quan trọng nhất)

### Concept: 2 tỷ lệ phân bổ
```
┌─────────────────────────────────────────────┐
│ CĐT trả Thăng Long: 100% giá trị HĐ       │
│                                             │
│ Thăng Long chuyển Sateco theo 2 dòng:       │
│                                             │
│ 1. DÒNG GIẤY TỜ (sateco_contract_ratio)    │
│    → Mặc định 98% → Xuất hóa đơn nội bộ    │
│    → Dùng để tính công nợ trên sổ sách      │
│                                             │
│ 2. DÒNG TIỀN MẶT (sateco_actual_ratio)     │
│    → = contract_ratio - internal_deduction  │
│    → Mặc định 98% - 2.5% = 95.5%           │
│    → Tiền thực tế Sateco được giữ           │
│                                             │
│ Chênh lệch (2.5%):                          │
│    → Sateco hoàn trả TL bằng tiền mặt      │
│    → Là "phí quản lý nội bộ"               │
└─────────────────────────────────────────────┘
```

### Auto-calculate (contractHelpers.js)
```js
function calculateAllocations(totalValue, vat, internalVat, contractRatio, internalDeduction) {
    const actualRatio = contractRatio - internalDeduction; // 98 - 2.5 = 95.5
    
    // Thăng Long giữ
    const tl_cutPercent = 100 - contractRatio;  // 2%
    const tl_preVat = totalValue * (1 + vat/100);
    
    // Sateco nhận (dòng giấy tờ - hóa đơn)
    const st_invoice_preVat = totalValue * contractRatio / 100;
    const st_invoice_postVat = st_invoice_preVat * (1 + internalVat/100);
    
    // Sateco nhận (dòng tiền mặt - thực tế)
    const st_actual_preVat = totalValue * actualRatio / 100;
    const st_actual_postVat = st_actual_preVat * (1 + internalVat/100);
    
    return { actualRatio, tl_preVat, st_invoice_preVat, st_actual_preVat, ... };
}
```

---

## 3. FORM TẠO HỢP ĐỒNG (7 sections)

### Section 1: Thông tin Pháp lý (ContractLegalInfo)
- Tên HĐ, Mã HĐ (CĐT), Mã nội bộ
- Loại HĐ: Thi công / Cung cấp / Thiết kế / EPC
- Hình thức: Trọn gói / Đơn giá / Đơn giá điều chỉnh
- Đơn vị ký: Thăng Long / Thành Phát
- Trạng thái ký: Chưa ký → Đã ký → Đã ký PL
- Địa chỉ, Mô tả

### Section 2: Chủ Đầu tư (ContractPartner)
- Dropdown chọn từ `partners` (type = 'Client')
- Tạo mới CĐT inline (ContractPartnerModal)
- Thông tin: Tên, MST, Địa chỉ, SĐT, Email

### Section 3: Giá trị & Thời gian (ContractValueTime)
- **Input giá trị**: Nhập trước VAT HOẶC sau VAT → auto-calc ngược
- **VAT%**: Mặc định 8%, có thể đổi
- **Ngày ký / Khởi công / Hoàn thành**
- Format: `formatInputNumber()` — hiện dấu phẩy ngàn khi blur

### Section 4: Mốc Thanh toán (ContractMilestones)
- Danh sách milestones: [{name, percentage, amount, condition}]
- Base type: Trước VAT / Sau VAT (chọn 1)
- Tự động tính amount khi thay đổi %
- Mặc định có 1 mốc "Tạm ứng 20%"
- Thêm/xóa milestone tùy ý

### Section 5: Phân bổ Sateco (ContractSateco)
- Tỷ lệ HĐ (contract_ratio): mặc định 98%
- Chiết khấu nội bộ: mặc định 2.5%
- VAT nội bộ: mặc định 8%
- Hiện bảng tính: TL giữ / STC HĐ / STC Thực

### Section 6: Bảo hành (ContractWarranty)
- Tỷ lệ giữ lại BH: 5%
- Thời hạn BH: 24 tháng
- Bảo lãnh thay thế: có/không
- Ngày bàn giao
- Lịch hoàn trả BH: [{year, percentage, amount}]

### Section 7: Thông tin Ngân hàng (ContractBanking)
- 3 bộ TK ngân hàng: TL, TP, STC
- Bank profiles: chọn từ template đã lưu
- Hiện đầy đủ: STK, Tên NH, Chi nhánh, Chủ TK

---

## 4. BUSINESS RULES

### 4.1 Validation
- ❗ BẮT BUỘC: name, code, partner_id, original_value > 0
- ❗ contract_ratio: 0-100%
- ❗ internal_deduction: 0 ≤ deduction ≤ contract_ratio
- ❗ start_date ≤ end_date
- ❗ VAT: 0-30%
- ❗ code + internal_code: UNIQUE (kiểm tra trước khi lưu)

### 4.2 Auto behaviors
- Khi thay đổi `original_value` hoặc `vat` → recalc tất cả allocations
- Khi thay đổi milestone % → recalc amount (và ngược lại)
- Khi save → auto-create Google Drive folder (nếu connected)
- Khi save → ghi audit log + send notification
- Default status: 'Đang thi công'

### 4.3 Google Drive Integration
- Auto-create folder structure khi tạo HĐ mới
- Folder name: `{name} ({internal_code || code})`
- Save `google_drive_folder_id` và `document_link`

---

## 5. FILE MAP

```
src/components/
├── ContractCreate.jsx              -- Main form orchestrator (602 lines)
├── contract/
│   ├── contractHelpers.js          -- Shared: formatInputNumber, calculateAllocations, navItems
│   ├── ContractLegalInfo.jsx       -- Section 1: Pháp lý
│   ├── ContractPartner.jsx         -- Section 2: CĐT
│   ├── ContractPartnerModal.jsx    -- Modal tạo CĐT mới
│   ├── ContractValueTime.jsx       -- Section 3: Giá trị + Thời gian
│   ├── ContractMilestones.jsx      -- Section 4: Mốc thanh toán
│   ├── ContractSateco.jsx          -- Section 5: Phân bổ Sateco
│   ├── ContractWarranty.jsx        -- Section 6: Bảo hành
│   ├── ContractBanking.jsx         -- Section 7: Ngân hàng
│   ├── ContractExpenseTab.jsx      -- Chi phí (trong Dashboard)
│   ├── ContractAddendaTab.jsx      -- Phụ lục (trong Dashboard)
│   └── ContractDriveTab.jsx        -- Tài liệu Drive (trong Dashboard)
```

---

## 6. COMMON PATTERNS

### ✅ DO:
- Luôn validate uniqueness cho code + internal_code trước khi save
- Dùng `formatInputNumber` khi hiển thị, `parseFormattedNumber` khi đọc
- Lưu cả warranty_ratio + warranty_percentage (backward compat)
- Upsert `company_settings` khi save (sync bank info)
- Ghi audit log cho CREATE và UPDATE

### ❌ DON'T:
- Không mix actual_ratio với contract_ratio — chúng khác nhau!
- Không cho phép VAT > 30% hoặc < 0%
- Không lưu HĐ nếu thiếu CĐT (partner_id)
- Không xóa Google Drive folder khi sửa HĐ
