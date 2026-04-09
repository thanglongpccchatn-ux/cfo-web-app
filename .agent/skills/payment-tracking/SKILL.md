---
name: payment-tracking-expert
description: |
  CHUYÊN GIA quản lý dòng tiền 3 tầng: CĐT → Thăng Long → Sateco.
  Trigger: "thanh toán", "đợt thanh toán", "thu tiền CĐT", "chuyển tiền Sateco",
  "nợ Sateco", "nợ thực tế", "ĐNTT", "IPC", "tạm ứng", "nghiệm thu",
  "quyết toán", "bảo hành", "hoàn trả nội bộ", "dòng giấy tờ", "dòng tiền mặt",
  "external_income", "internal_paid", "quá hạn", "overdue", "payment stage",
  "lịch sử thanh toán", hoặc câu hỏi về logic 3 tầng nợ.
---

# 💰 Expert Skill: Quản Lý Dòng Tiền 3 Tầng

## Bối cảnh nghiệp vụ

PaymentTracking quản lý **vòng đời tiền** cho mỗi dự án qua 3 tầng:
1. CĐT → Thăng Long (Thu tiền khách hàng)
2. Thăng Long → Sateco (Chuyển khoản nội bộ theo dòng giấy tờ)
3. Sateco → Thăng Long (Hoàn trả tiền mặt chênh lệch tỷ lệ)

---

## 1. KIẾN TRÚC DATABASE

### Bảng `payments` (Giai đoạn thanh toán)
```sql
project_id               UUID → projects(id)
stage_name               TEXT     -- VD: "Tạm ứng", "IPC01", "IPC02"
stage_type               TEXT     -- 'Tạm ứng' | 'Nghiệm thu' | 'Quyết toán' | 'Bảo hành' | 'Phát sinh'
expected_amount          NUMERIC  -- Kế hoạch thu (dự kiến)
payment_code             TEXT     -- Auto-gen: "{project_code}-{stage}" VD: "HP4-01-IPC01"

-- Hóa đơn & ĐNTT
invoice_amount           NUMERIC  -- Giá trị xuất HĐ (gồm VAT)
invoice_date             DATE     -- Ngày xuất HĐ
invoice_status           TEXT     -- 'Chưa xuất' | 'Đã xuất' | 'CĐT đã nhận'
payment_request_amount   NUMERIC  -- Đề nghị thanh toán (gồm VAT)
due_date                 DATE     -- Hạn CĐT thanh toán
addenda_amount           NUMERIC  -- Phụ lục phát sinh đợt này

-- Thực thu
external_income          NUMERIC  -- CĐT đã trả (tổng lũy kế từ history)
internal_paid            NUMERIC  -- TL đã chuyển Sateco (tổng lũy kế)
internal_invoiced_amount NUMERIC  -- HĐ nội bộ Sateco

notes    TEXT
status   TEXT  -- 'Chưa thanh toán' | 'CĐT Đã thanh toán'
```

### Bảng `external_payment_history` (Lịch sử CĐT trả)
```sql
payment_stage_id  UUID → payments(id)
payment_date      DATE
amount            NUMERIC
description       TEXT   -- VD: "CK Techcombank UNC #12345"
```

### Bảng `internal_payment_history` (Lịch sử TL chuyển STC)
```sql
payment_stage_id  UUID → payments(id)
payment_date      DATE
amount            NUMERIC
description       TEXT   -- VD: "CK nội bộ Vietcombank"
```

---

## 2. LOGIC DÒNG TIỀN 3 TẦNG (QUAN TRỌNG)

```
    CĐT                Thăng Long              Sateco
     │                      │                      │
     │───── 100% ──────────→│                      │
     │  CĐT trả tiền HĐ   │                      │
     │  (external_income)   │                      │
     │                      │                      │
     │                      │── 98% (HĐ ratio)───→│
     │                      │  Dòng giấy tờ       │
     │                      │  (internal_paid)     │
     │                      │                      │
     │                      │                      │──── 2.5% ────→│
     │                      │                      │  Hoàn TM       │
     │                      │                      │  (refund cash) │
     │                      │                      │               TL
     │                      │                      │
     │                     TL giữ lại 2%          STC giữ 95.5%
```

### 3 tỷ lệ + chênh lệch:
```js
const contractRatio = project.sateco_contract_ratio / 100;  // 0.98 (dòng giấy tờ)
const actualRatio = project.sateco_actual_ratio / 100;      // 0.955 (dòng thực)
const refundRatio = contractRatio - actualRatio;             // 0.025 (Sateco hoàn TL)

// Mỗi đợt thanh toán:
const tlMustTransfer = income × contractRatio;     // TL phải chuyển STC (giấy tờ)
const satecoRefund = income × refundRatio;          // STC hoàn TL (tiền mặt)
const tlKeeps = income × (1 - contractRatio);       // TL giữ lại
```

---

## 3. WORKFLOW QUẢN LÝ 1 ĐỢT

### Phase A: Tạo đợt mới
```
Input: stage_name + expected_amount
Auto-suggest: 
  - Đợt đầu: "Tạm ứng" + type="Tạm ứng"
  - Đợt sau: "IPC{N}" + type="Nghiệm thu" (tự tăng số)
  - payment_code: "{project_code}-{stage_name}"
```

### Phase B: Cập nhật HĐ & ĐNTT
```
Input: invoice_date + invoice_amount + payment_request_amount + due_date
  → Hiện ngay "CĐT nợ HĐ" = request - income
  → due_date: auto-suggest +30 ngày từ invoice_date
```

### Phase C: Ghi nhận Thu CĐT (Expand → Cập nhật Lịch sử Thu CĐT)
```
Input: date + amount + notes
  → INSERT external_payment_history
  → Fetch-before-write: lấy fresh external_income từ DB
  → UPDATE payments.external_income += amount
  → UPDATE payments.status = 'CĐT Đã thanh toán'
  → Auto-calc: TL phải chuyển STC = income × contractRatio
```

### Phase D: Ghi nhận Chuyển Sateco (Expand → Lịch sử Chuyển Sateco)
```
Input: date + amount + notes
  → INSERT internal_payment_history
  → Fetch-before-write: lấy fresh internal_paid từ DB
  → UPDATE payments.internal_paid += amount
```

### QUAN TRỌNG: Fetch-before-write pattern
```js
// Tránh race condition khi 2 user cùng ghi
const { data: freshStage } = await supabase
    .from('payments')
    .select('external_income') // hoặc internal_paid
    .eq('id', stageId)
    .single();
const currentIncome = Number(freshStage?.external_income || 0);
const newIncome = currentIncome + amount;
```

### SUM-based recalculation (khi XÓA)
```js
// Khi xóa 1 payment history record:
// KHÔNG dùng: external_income -= deletedAmount (dễ lệch)
// DÙng: Tính lại từ tất cả history records

const { data: remaining } = await supabase
    .from('external_payment_history')
    .select('amount')
    .eq('payment_stage_id', stageId);
const newIncome = remaining.reduce((sum, r) => sum + Number(r.amount), 0);
await supabase.from('payments').update({ external_income: newIncome }).eq('id', stageId);
```

---

## 4. CARD LAYOUT & STATUS SYSTEM

### Stage Card Structure:
```
┌─────────────────────────────────────────────────┐
│ [#] IPC01 [Nghiệm thu] [CĐT trả đủ ●]        │
│   KH: 2,500,000,000₫    Hạn: 15/03/2026       │
│                                    2.0B / 2.5B  │
│                                    [○○○○●] 80%  │  ←── SVG donut
└──────────────────────────▼──────────────────────┘
│ ▼ Expanded:                                     │
│ ┌──────────┬──────────────┬─────────────┐       │
│ │ CĐT→TL  │ TL→Sateco    │ STC→TL      │       │
│ │ ĐNTT 2.5B│ Phải TL 2.45B│ Hoàn 62.5M │       │
│ │ Thu 2.0B │ Đã CK 2.0B  │ (auto-calc) │       │
│ │ Nợ 500M  │ Nợ 450M     │             │       │
│ │ [Cập nhật│ [Cập nhật   │             │       │
│ │  Lịch sử]│  Lịch sử]   │             │       │
│ └──────────┴──────────────┴─────────────┘       │
│ [Set HĐ/ĐNTT]                    [Xóa đợt]    │
└─────────────────────────────────────────────────┘
```

### Payment Status (getPaymentStatus):
| Key | Label | Color | Condition |
|-----|-------|-------|-----------|
| done | CĐT trả đủ | 🟢 Green | income ≥ request |
| late | CĐT trả muộn | 🟠 Orange | paid > dueDate |
| partial | Đang thu CĐT | 🟡 Yellow | income > 0 |
| overdue | Quá hạn thu | 🔴 Rose+pulse | today > dueDate |
| pending | Chưa thu | ⬜ Slate | default |

---

## 5. KPI HEADER (4 cards)

| KPI | Công thức | Color |
|-----|-----------|-------|
| Tổng Đề Nghị TT (TL) | Σ payment_request_amount | Blue |
| Thực Thu từ CĐT | Σ external_income | Emerald |
| TL Nợ Sateco (giấy tờ) | Σ(income × contractRatio) - Σ(internal_paid) | Indigo |
| Sateco Hoàn Trả TL | Σ(income × refundRatio) | Amber |

### Progress Bar:
```
overallProgress = Σ external_income / Σ expected_amount × 100
  ≥ 80% → emerald
  ≥ 40% → blue
  < 40% → orange
```

---

## 6. AUDIT TRAIL

Mỗi giao dịch thu/chi đều ghi audit log:
```js
await logAudit({
    action: 'CREATE' | 'DELETE',
    tableName: 'external_payment_history' | 'internal_payment_history',
    recordId: insertedData.id,
    recordName: `Thanh toán CĐT - Đợt ${stage.name}`,
    changes: { amount: { old: null, new: amount } },
    metadata: { project_id: project.id }
});
```

---

## 7. FILE MAP

```
src/components/
├── PaymentTracking.jsx               -- Main Module (719 lines)
│   ├── Stage CRUD (add/edit/delete)
│   ├── CĐT Payment Modal (external)
│   ├── TL-Sateco Payment Modal (internal)
│   ├── Stage Cards (expandable)
│   └── KPI header + Progress bar
│
├── documentTracking/
│   └── PaymentHistoryRow.jsx          -- Expandable row component
│
└── utils/
    └── formatters.js                  -- fmt(), fmtDate()
```

---

## 8. COMMON PATTERNS

### ✅ DO:
- Dùng Fetch-before-write cho mọi update aggregate (external_income, internal_paid)
- Dùng SUM-based recalculation khi xóa (không dùng phép trừ)
- Auto-suggest next stage name (IPC01 → IPC02 → ...)
- Log audit cho mọi giao dịch tài chính
- Hiện refundRatio chênh lệch rõ ràng (CĐT ratio - Actual ratio)

### ❌ DON'T:
- KHÔNG nhầm 3 loại nợ: Nợ HĐ / Nợ ĐNTT / Nợ Thực tế
- KHÔNG trừ trực tiếp khi xóa payment record → SUM-based
- KHÔNG cho phép xóa stage nếu đã có history records mà không confirm
- KHÔNG ẩn "Quá hạn thu" status — phải hiện to, rõ, pulse animation

---

## 9. EDGE CASES

- CĐT trả NHIỀU HƠN ĐNTT → vẫn ghi nhận, status = "CĐT trả đủ"
- CĐT trả SAU hạn → status = "CĐT trả muộn" (khác "Quá hạn thu")
- Nhiều lần thu cho 1 đợt → mỗi lần = 1 record trong history
- contractRatio = actualRatio → refundRatio = 0, ẩn column "Hoàn trả"
