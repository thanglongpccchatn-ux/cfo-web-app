---
name: contract-dashboard-expert
description: |
  CHUYÊN GIA Dashboard tổng quan tài chính dự án: P&L, KPI xếp hạng, tiến độ thu.
  Trigger: "dashboard", "tổng quan", "P&L", "lãi lỗ", "margin", "KPI",
  "xếp hạng dự án", "rating", "tiến độ tài chính", "chi phí sateco",
  "lợi nhuận thi công", "Thăng Long invest", "sateco execute",
  "nợ CĐT", "phân tích dự án", "6 chỉ số", hoặc bất kỳ câu hỏi về
  overview tài chính 1 dự án cụ thể.
---

# 📊 Expert Skill: Dashboard Tổng Quan Dự Án

## Bối cảnh nghiệp vụ

ContractDetailedDashboard là **trung tâm chỉ huy tài chính** cho mỗi dự án.
Nó tổng hợp realtime từ 5 bảng DB (addendas, payments, expenses, expense_materials,
expense_labor) và tính toán P&L, KPI rating, tiến độ thu hồi.

---

## 1. DUAL VIEW SYSTEM

### View Bên ngoài: CĐT → Thăng Long
```
isInternalView = false (mặc định)
- Hiện giá trị HĐ TỔNG (gốc + phụ lục)
- CĐT Đã thu = Σ external_income
- CĐT Nợ hóa đơn = Tổng HĐ - CĐT đã thu
```

### View Nội bộ: Thăng Long → Sateco
```
isInternalView = true
- Hiện Giá Khoán Nội bộ = Tổng HĐ × contract_ratio
- Đã thu từ Group = Σ internal_paid
- Công nợ Nội bộ = Giá khoán - Đã thu
```

---

## 2. DUAL RATIO LOGIC (Cốt lõi)

```js
// 2 tỷ lệ từ project settings
const SATECO_CONTRACT_RATIO = project.sateco_contract_ratio / 100; // 98% → 0.98
const SATECO_ACTUAL_RATIO = project.sateco_actual_ratio / 100;     // 95.5% → 0.955

// Giá trị phân bổ
contractValueSateco = totalContractValueThangLong × CONTRACT_RATIO;  // Dòng giấy tờ
actualValueSateco = totalContractValueThangLong × ACTUAL_RATIO;      // Dòng tiền mặt

// Lợi nhuận
thangLongNetProfit = cdtTotalIncome - (cdtTotalIncome × ACTUAL_RATIO); // TL giữ lại
satecoNetProfit = (cdtTotalIncome × ACTUAL_RATIO) - totalExpensesSateco; // STC giữ lại
```

---

## 3. KPI QUICK BAR (5 chỉ số hàng đầu)

| # | KPI | Công thức | Ý nghĩa |
|---|-----|-----------|---------|
| 1 | Tổng Giá trị HĐ | originalValue + Σ approved addendas | Tổng cam kết CĐT |
| 2 | CĐT Đã thu | Σ external_income (hoặc internal_paid) | Tiền thực tế về |
| 3 | CĐT Nợ | Tổng HĐ - Đã thu | Tiền chưa thu |
| 4 | Tổng Chi phí Sateco | VT + NC + CP khác | Tổng đã xuất |
| 5 | Lợi nhuận Thi công | Thu Sateco - Chi phí | P&L bottom line |

### Luồng Nội bộ (hiện thêm nếu có dual ratio):
- Giao về Sateco (actual_ratio)
- Đã thanh toán Sateco
- % tiêu hao ngân sách

---

## 4. HỆ THỐNG XẾP HẠNG DỰ ÁN (6 KPIs → Rating A+ / A / B / C)

### 6 Chỉ số Performance:

| # | KPI | Trọng số | Công thức | Ý tốt |
|---|-----|----------|-----------|-------|
| 1 | Tỷ suất LNG/DT | 10% | satecoNetProfit / contractValueSateco × 100 | > 10% |
| 2 | Tỷ suất SL & CP | 15% | (cdtTotalInvoiced - totalExpenses) / cdtTotalInvoiced × 100 | > 20% |
| 3 | Hệ số SPI | 20% | cdtTotalInvoiced / plannedVolume | > 1.0 |
| 4 | Chuyển đổi DT→SL | 20% | cdtTotalIncome / cdtTotalInvoiced × 100 | > 80% |
| 5 | Chuyển đổi Thu→DT | 10% | cdtTotalIncome / contractValueSateco × 100 | Cao |
| 6 | Cân đối Thu-Chi | 5% | cdtTotalIncome / totalExpenses | > 1.0 |

### Rating Scale:
```
≥ 90 điểm → A+ (Xuất sắc) — Emerald
≥ 80 điểm → A  (Tốt)      — Blue
≥ 65 điểm → B  (Trung bình) — Amber
<  65 điểm → C  (Cần lưu ý)  — Rose
```

### SPI (Schedule Performance Index):
```js
// Dựa trên tiến độ thời gian vs sản lượng
const totalDays = endDate - startDate;
const daysPassed = today - startDate;
const timeProgress = daysPassed / totalDays;       // % thời gian đã qua
const plannedVolume = contractValue × timeProgress; // Sản lượng lẽ ra đạt
const SPI = actualInvoiced / plannedVolume;         // > 1 là vượt tiến độ
```

---

## 5. TABS & CONTENT

### Tab "Tổng quan Dự án" (overview)
```
┌─────────────────────────────────────────┐
│ KPI Quick Bar (5 chỉ số)                │
│ [+ Luồng Nội bộ nếu có dual ratio]     │
├─────────────────────────────────────────┤
│ Rating + 6 KPI Cards                    │
├──────────────────┬──────────────────────┤
│ LEFT (4 cols)    │ RIGHT (8 cols)       │
│ ┌──────────────┐ │ ┌─────────────────┐  │
│ │ Đặc tả HĐ   │ │ │ Tiến độ Thu CĐT │  │
│ │ - Loại HĐ   │ │ │ (Payment Table) │  │
│ │ - Khởi công  │ │ │ Expandable rows │  │
│ │ - Hoàn thành │ │ └─────────────────┘  │
│ │ - Milestones │ │ ┌────────┬────────┐  │
│ ├──────────────┤ │ │ TL     │ STC    │  │
│ │ Quyết toán   │ │ │ Invest │Execute │  │
│ │ Nội bộ       │ │ │ P&L    │  P&L   │  │
│ │ - Tỷ lệ HĐ  │ │ └────────┴────────┘  │
│ │ - Tỷ lệ Thực│ │                       │
│ │ - Ngân sách  │ │                       │
│ └──────────────┘ │                       │
└──────────────────┴──────────────────────┘
```

### Tab "Tài liệu & Drive" (doc)
- Hiện subfolders từ Google Drive
- Browse files trực tiếp trong app

---

## 6. DATA FETCHING

### fetchDashboardData() — Promise.all 5 queries:
```js
const [addendas, payments, expenses, expenseMaterials, expenseLabor] = await Promise.all([
    supabase.from('addendas').select('*').eq('project_id', id),
    supabase.from('payments').select('*').eq('project_id', id),
    supabase.from('expenses').select('*').eq('project_id', id),
    supabase.from('expense_materials').select('*').eq('project_id', id),
    supabase.from('expense_labor').select('*').eq('project_id', id),
]);
```

### Cost Aggregation:
```js
totalMaterialExpenses = Σ expense_materials.total_amount
totalLaborExpenses    = Σ expense_labor.paid_amount      // Chỉ đã chi!
totalGenericExpenses  = Σ expenses.amount
totalExpensesSateco   = materials + labor + generic
```

---

## 7. PAYMENT HISTORY (Expandable rows)

### Click vào row → toggle expand:
```
┌────────────────────────────────────────────────┐
│ IPC01 │ 15/03 │ 2.5B │ 2.5B │ 2.0B │ 500M │ Chờ thu │ ▼ │
├────────────────────────────────────────────────┤
│ ▼ PaymentHistoryRow (expanded)                  │
│   Lịch sử thu tiền từ payment_history table     │
│   [{date, amount, notes}]                       │
└────────────────────────────────────────────────┘
```

### Status Logic:
```js
getPaymentStatus(stage, lastExternalPaymentDate):
  - income >= request && request > 0:
       - lastPaid > dueDate → "CĐT trả muộn" (orange)
       - else → "CĐT trả đủ" (green)
  - today > dueDate → "Quá hạn thu" (rose, pulse animation)
  - income > 0 → "Đang thu CĐT" (yellow)
  - else → "Chưa thu" (slate)
```

---

## 8. FILE MAP

```
src/components/
├── ContractDetailedDashboard.jsx     -- Main Dashboard (614 lines)
│   ├── KPI Quick Bar (dual view)
│   ├── Rating system (6 KPIs)
│   ├── Contract specs panel
│   ├── Internal settlement panel
│   ├── Payment timeline table
│   ├── P&L grid (TL + STC)
│   └── Drive tab
│
├── documentTracking/
│   └── PaymentHistoryRow.jsx         -- Expandable payment history
│
├── common/
│   └── SkeletonLoader.jsx           -- Loading skeletons
│
└── utils/
    └── formatters.js                -- fmt(), fmtB(), fmtDate()
```

---

## 9. COMMON PATTERNS

### ✅ DO:
- Phân biệt isInternalView: thay đổi labels, nguồn data, công thức
- Dùng `fmtB()` cho số lớn (tỷ), `fmt()` cho số nhỏ (triệu)
- Lazy load payment history (chỉ fetch khi expand row)
- Dùng `tabular-nums` cho tất cả số tài chính
- Highlight overdue payments với rose + pulse animation

### ❌ DON'T:
- Không edit trực tiếp trên dashboard — chỉ xem, edit ở từng module
- Không nhầm external_income (CĐT trả) với internal_paid (TL trả STC)
- Không tính totalLaborExpenses từ approved_amount, phải từ paid_amount
- Không cache dashboard data quá lâu (financial data thay đổi liên tục)
