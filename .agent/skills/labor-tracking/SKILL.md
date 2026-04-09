---
name: labor-tracking-expert
description: |
  CHUYÊN GIA quản lý thanh toán Thầu phụ & Tổ đội thi công M&E/Xây dựng.
  Trigger: "thầu phụ", "tổ đội", "nhân công", "labor", "thanh toán thầu",
  "đề nghị thanh toán", "tạm ứng", "nghiệm thu", "công nhật", "quyết toán",
  "phát sinh", "bảo lãnh", "khấu trừ", "giữ lại", "hợp đồng thầu phụ",
  "subcontractor", hoặc liên quan đến workflow thanh toán nhà thầu.
---

# 🏗️ Expert Skill: Quản Lý Thầu Phụ & Tổ Đội

## Bối cảnh nghiệp vụ

Sateco là công ty M&E (Cơ Điện), thi công các hệ thống: Điện (E), PCCC (FA/FF/PCCC),
Tăng áp hút khói (TAHK), Sơn chống cháy (PAINT), Xây dựng (XD), Cải tạo (CT).
Module này quản lý **toàn bộ vòng đời thanh toán** cho nhà thầu phụ và tổ đội.

---

## 1. PHÂN LOẠI NHÀ THẦU (Auto-detect)

| Loại | Tiêu chí nhận diện | VAT | Ví dụ |
|------|---------------------|-----|-------|
| **Thầu phụ** | Tên bắt đầu "Công ty" | 8% | Công ty TNHH Cơ Điện Minh Khoa |
| **Tổ đội** | Không bắt đầu "Công ty" | 0% | Tổ Thầu XD Tuấn Anh, Đội Điện Phước |

**Logic auto-detect (SubcontractorContracts.jsx:32-39):**
```js
function detectContractType(partnerName) {
    if (partnerName.toLowerCase().startsWith('công ty')) 
        return { type: 'Thầu phụ', vat: '8' };
    return { type: 'Tổ đội', vat: '0' };
}
```

### Khác biệt quan trọng:
- **Thầu phụ** → CÓ hóa đơn VAT, theo dõi `invoiced_amount`
- **Tổ đội** → KHÔNG hóa đơn, thanh toán trực tiếp, không thuế

---

## 2. KIẾN TRÚC DATABASE

### Bảng `subcontractor_contracts` (Quản lý HĐ)
```sql
-- Thông tin HĐ
partner_id        UUID → partners(id)     -- FK nhà thầu
project_id        UUID → projects(id)     -- FK dự án
contract_code     TEXT    -- Auto-gen: ddMM/yyyy/HĐTC/STC-[MÃ_NT]/[MÃ_DA]/[HỆ_THỐNG]
contract_name     TEXT    -- Nội dung HĐ
contract_type     TEXT    -- 'Thầu phụ' | 'Tổ đội'
system_code       TEXT    -- 'E','FA','FF','PCCC','TAHK','PAINT','XD','CT'

-- Giá trị tài chính
contract_value    NUMERIC -- GT trước thuế
vat_rate          NUMERIC -- % VAT (0 hoặc 8)
invoiced_amount   NUMERIC -- Tiền hóa đơn đã xuất (chỉ Thầu phụ)

-- Thời gian
start_date, end_date     DATE
warranty_months          INT     -- Thời hạn bảo hành (tháng)
status                   TEXT    -- 'Đang thực hiện' | 'Hoàn thành' | 'Tạm dừng' | 'Thanh lý'
```

### Bảng `expense_labor` (Từng đợt thanh toán)
```sql
project_id          UUID → projects(id)
team_name           TEXT        -- Tên nhà thầu/tổ đội (denormalized)
payment_stage       TEXT        -- Giai đoạn TT
request_type        TEXT        -- 'Tạm ứng' | 'Nghiệm thu' | 'Công nhật'
contract_value      NUMERIC     -- GT HĐ tại thời điểm

-- Khối lượng hoàn thành
completed_previous  NUMERIC     -- Lũy kế KT kỳ trước
completed_current   NUMERIC     -- KL kỳ này

-- Tài chính
requested_amount    NUMERIC     -- Số tiền đề nghị
approved_amount     NUMERIC     -- Số tiền được duyệt
paid_amount         NUMERIC     -- Số tiền thực chi
deduction_amount    NUMERIC     -- Khấu trừ/phạt
deduction_reason    TEXT

-- Công nhật (nếu request_type = 'Công nhật')
daily_labor_count   NUMERIC     -- Số công (ngày)
daily_labor_rate    NUMERIC     -- Đơn giá/công

request_date, payment_date  DATE
priority    TEXT    -- 'Bình thường' | 'Cao' | 'Khẩn cấp' | 'Thấp'
status      TEXT    -- 'PENDING' | 'PAID'
```

### Bảng `subcontractor_variations` (Phát sinh)
```sql
contract_id      UUID → subcontractor_contracts(id)
variation_code   TEXT    -- Auto: PS-001, PS-002...
description      TEXT
variation_value  NUMERIC
status           TEXT    -- 'Chờ duyệt' | 'Đã duyệt' | 'Từ chối'
approved_date    DATE
```

---

## 3. WORKFLOW THANH TOÁN (2 bước)

```
┌─────────────────┐     ┌──────────────────┐
│  BƯỚC 1         │     │  BƯỚC 2          │
│  Công trường     │ ──→ │  Kế toán / Quỹ   │
│  Tạo Đề nghị TT │     │  Giải ngân       │
│  (PENDING)       │     │  (PAID)          │
└─────────────────┘     └──────────────────┘
       ↓                        ↓
 LaborRequestModal       LaborPaymentModal
 - Chọn HĐ               - Xem info gốc (readonly)
 - Chọn giai đoạn TT      - Nhập khấu trừ/phạt
 - Nhập KL hoàn thành     - Nhập số tiền thực chi
 - Nhập số tiền đề nghị   - Xác nhận ngày thanh toán
```

### Giai đoạn thanh toán (payment_stage):
| Giai đoạn | Mô tả | Tần suất |
|-----------|-------|----------|
| Tạm ứng | Ứng trước cho nhà thầu bắt đầu thi công | 1 lần đầu |
| Nghiệm thu lần 1-5 | Thanh toán theo KL hoàn thành từng đợt | Nhiều lần |
| Công nhật | Thanh toán theo ngày công (không theo KL) | Linh hoạt |
| Phát sinh | Thanh toán phần việc ngoài HĐ | Khi cần |
| Quyết toán | Thanh toán cuối cùng, tất toán HĐ | 1 lần cuối |
| Bảo lãnh | Tiền giữ lại bảo hành (5-10% GT HĐ) | 1 lần |

---

## 4. BUSINESS RULES (Luật nghiệp vụ quan trọng)

### 4.1 Tạo Đề nghị TT (LaborRequestModal)
- ❗ BẮT BUỘC chọn HĐ từ `subcontractor_contracts`
- ❗ BẮT BUỘC nhập `requested_amount > 0`
- Auto-fill `team_name` từ partners.short_name
- Auto-fill `contract_value` = `contract_value × (1 + vat_rate/100)`
- Nếu `payment_stage = 'Công nhật'`:
  - Hiện form nhập Số công + Đơn giá/công
  - `requested_amount = daily_labor_count × daily_labor_rate`
  - Ẩn trường "Số tiền đề nghị" (auto-calc)
- Nếu HĐ loại 'Thầu phụ' → hiện thêm trường "Tiền Hóa đơn lũy kế"
- Khi submit → `status = 'PENDING'`

### 4.2 Giải ngân (LaborPaymentModal)
- Hiện thông tin gốc (readonly): tên tổ đội, dự án, giai đoạn, ngày đề nghị
- Kế toán nhập:
  - **Khấu trừ/Phạt** (nếu có): số tiền + lý do
  - **Số tiền thực chi** (BẮT BUỘC)
  - **Ngày thanh toán**
- Warning nếu `thực_chi ≠ đề_nghị - khấu_trừ` (số liệu không khớp)
- Khi submit:
  - `paid_amount = paymentAmount`
  - `approved_amount = paymentAmount + deduction`
  - `status = 'PAID'`

### 4.3 Tính Công nợ (SubcontractorContracts)
```
// Thầu phụ (có hóa đơn)
Công nợ = invoiced_amount - paid_amount  (nếu invoiced_amount > 0)

// Tổ đội (không hóa đơn)
Công nợ = requested_amount - paid_amount
```

### 4.4 Phát sinh (Variations)
- Mỗi phát sinh có `variation_code` auto-gen: PS-001, PS-002...
- Status flow: `Chờ duyệt → Đã duyệt / Từ chối`
- Chỉ phát sinh "Đã duyệt" mới tính vào tổng giá trị HĐ

---

## 5. FILE MAP (Component Architecture)

```
src/components/
├── SubcontractorContracts.jsx   -- Quản lý HĐ thầu phụ (888 lines)
│   ├── ContractModal            -- Tạo/sửa HĐ (form modal)
│   ├── StageCell               -- Cell hiển thị tiến độ TT
│   └── Main table + Variations panel
│
├── LaborTracking.jsx            -- Bảng kê thanh toán (429 lines)  
│   ├── Desktop table view (xl:)
│   ├── Mobile card view (<xl)
│   ├── KPI header (Chờ Chi / Đề Nghị / Đã Trả / Còn Nợ)
│   └── Filter: by project, by status
│
├── LaborRequestModal.jsx        -- Bước 1: Tạo đề nghị TT (395 lines)
│   ├── Contract selector (SearchableSelect)
│   ├── Payment stage selector
│   ├── Công nhật form (conditional)
│   └── Invoice amount (conditional: Thầu phụ only)
│
├── LaborPaymentModal.jsx        -- Bước 2: Kế toán giải ngân (293 lines)
│   ├── Read-only request info
│   ├── Deduction/penalty section
│   └── Actual payment input
│
└── SearchableSelect.jsx         -- Reusable typeahead dropdown
```

---

## 6. UX OPTIMIZATION GUIDELINES

### 6.1 Nhập liệu tối ưu
- **Pre-fill thông minh**: Khi chọn HĐ → auto-fill project, partner, contract value
- **Cascade logic**: Chọn nhà thầu → auto-detect loại (Thầu phụ/Tổ đội) → auto VAT
- **Progressive disclosure**: Trường Công nhật chỉ hiện khi chọn giai đoạn "Công nhật"
- **Format currency on-the-fly**: Dùng `formatInputNumber` khi gõ, hiện dấu phẩy ngàn
- **Auto-calc**: Công nhật = Số công × Đơn giá, Thành tiền tự tính

### 6.2 Hiển thị bảng
- **Desktop (≥xl)**: Data table đầy đủ, hover actions, color-coded columns
- **Mobile (<xl)**: Card layout, compact, touch-friendly action buttons
- **Color system**:
  - 🟠 Amber: Chờ Chi (PENDING)
  - 🟢 Emerald: Đã Chi (PAID) 
  - 🔵 Indigo: Đề nghị (financial amounts)
  - 🔴 Rose: Công nợ, khẩn cấp
  - 🟣 Purple: Dự án, thầu phụ identity

### 6.3 Validation rules
- Amount > 0 trước khi submit
- Contract phải được chọn
- Warning khi thực chi khác (đề nghị - khấu trừ)
- Animate pulse cho items "Chờ Chi" để gây chú ý

---

## 7. COMMON PATTERNS & ANTI-PATTERNS

### ✅ DO:
- Luôn link payment với contract qua contract selector
- Dùng `team_name` denormalized để hiển thị nhanh (không join)
- Invalidate cả `['labors']` và `['contract-payment-summary']` sau mỗi thao tác
- Dùng `tabular-nums` cho tất cả số tiền (monospace digits)
- Format số VND: `new Intl.NumberFormat('vi-VN')` — KHÔNG dùng ký hiệu ₫ trong bảng

### ❌ DON'T:
- Không cho phép xóa payment đã `status = 'PAID'` mà không confirm
- Không hiện nút "Thanh toán" nếu đã PAID
- Không mix data giữa các project trong view embedded
- Không yêu cầu nhập `approved_amount` ở bước 1 (chỉ bước 2)

---

## 8. SATECO BUSINESS CONTEXT

### Mã Số HĐ (Auto-generated)
Format: `ddMM/yyyy/HĐTC/STC-[MÃ_THẦU]/[MÃ_DA_NỘI_BỘ]/[HỆ_THỐNG]`
Ví dụ: `15/03/2026/HĐTC/STC-MK/HP4-01/E`
- 15/03/2026: Ngày ký
- STC: Sateco (viết tắt)
- MK: Mã nhà thầu (Minh Khoa)
- HP4-01: Mã dự án nội bộ
- E: Hệ thống Điện

### Hệ thống thi công M&E
| Code | Hệ thống | Ví dụ nhà thầu |
|------|----------|----------------|
| E | Điện | Công ty TNHH Điện Phúc An |
| FA | Báo cháy, exit, âm thanh | Tổ FA Minh Tuấn |
| FF | Chữa cháy | Đội Sprinkler Hải Phong |
| PCCC | HT PCCC tổng | Công ty PCCC Việt Nam |
| TAHK | Tăng áp hút khói | Tổ Đội TAHK Trung |
| PAINT | Sơn chống cháy | Đội Sơn CC Hoàng Long |
| XD | Xây dựng | Tổ Thầu XD Tuấn Anh |
| CT | Cải tạo | Đội CT Minh Đức |

### Tỷ lệ Sateco (context từ contract module)
- Sateco allocation: **95.5%** giá trị HĐ mặc định (có thể khác theo DA)
- Phần còn lại (4.5%): Chi phí quản lý, thuế, bảo lãnh

---

## 9. OPTIMIZATION CHECKLIST

Khi nhận yêu cầu liên quan module thầu phụ/tổ đội:

- [ ] Kiểm tra HĐ đã tồn tại trong `subcontractor_contracts` chưa
- [ ] Partner (nhà thầu) đã có trong bảng `partners` chưa (type = 'Subcontractor')
- [ ] Giai đoạn thanh toán phù hợp với tiến độ DA
- [ ] Số tiền đề nghị ≤ giá trị HĐ còn lại (chưa thanh toán)
- [ ] Nếu Thầu phụ: đã có hóa đơn chưa → cập nhật `invoiced_amount`
- [ ] Phát sinh (nếu có): đã được duyệt chưa trước khi thanh toán
- [ ] Warning nếu tổng đã thanh toán > 90% GT HĐ (gần quyết toán)
