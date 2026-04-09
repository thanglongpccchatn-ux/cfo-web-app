---
name: cashflow-analysis-expert
description: |
  CHUYÊN GIA phân tích thanh khoản, dòng tiền, stress test cho toàn danh mục dự án.
  Trigger: "thanh khoản", "cashflow", "dòng tiền", "liquidity", "stress test",
  "dự báo", "forecast", "budget", "ngân sách", "tổng nợ phải thu", "tổng nợ phải trả",
  "tình hình tài chính", "tổng quan công ty", "portfolio", "dashboard tổng",
  "risk", "rủi ro", "kịch bản", "scenario", "safety zone", "danger zone",
  hoặc bất kỳ câu hỏi về sức khỏe tài chính TOÀN CÔNG TY (không phải 1 dự án).
---

# 🏦 Expert Skill: Phân Tích Thanh Khoản & Dòng Tiền Tổng Thể

## Bối cảnh nghiệp vụ

Module này nhìn tổng thể **toàn bộ danh mục dự án** của Sateco — khác với 
ContractDetailedDashboard (chỉ 1 dự án). Mục tiêu: đánh giá khả năng chi trả,
phát hiện rủi ro thanh khoản, và mô phỏng kịch bản xấu.

---

## 1. NGUỒN DỮ LIỆU (Multi-project aggregation)

### Phải thu (Receivables)
```sql
-- Tổng doanh thu danh mục
SELECT SUM(original_value * sateco_actual_ratio / 100) as total_revenue
FROM projects WHERE status = 'Đang thi công';

-- Đã thu thực tế
SELECT SUM(external_income * p.sateco_actual_ratio / 100) as total_collected
FROM payments pay JOIN projects p ON pay.project_id = p.id;

-- Còn phải thu = Tổng doanh thu - Đã thu
```

### Phải trả (Payables)
```sql
-- Nợ NCC Vật tư
SELECT SUM(total_amount - paid_amount) as material_debt
FROM expense_materials WHERE paid_amount < total_amount;

-- Nợ Thầu phụ / Tổ đội
SELECT SUM(approved_amount - paid_amount) as labor_debt
FROM expense_labor WHERE status = 'PENDING';

-- Nợ Sateco nội bộ
SELECT SUM(external_income * sateco_contract_ratio/100) - SUM(internal_paid) as sateco_debt
FROM payments pay JOIN projects p ON pay.project_id = p.id;
```

---

## 2. CÁC MÀN HÌNH PHÂN TÍCH

### 2.1 DashboardOverview (Tổng công ty)

| KPI | Ý nghĩa | Tín hiệu |
|-----|---------|---------|
| Tổng DT danh mục | Σ(original_value × sateco_ratio) | Quy mô CĐT |
| Đã thu thực tế | Σ(external_income × sateco_ratio) | Tiền đã về |
| Tổng chi phí | Σ(VT + NC + CPSXC) toàn danh mục | Tiền đã xuất |
| Còn phải thu | Tổng DT - Đã thu | Cần đòi |
| Công nợ Sateco | Σ internal_debt - Σ internal_paid | Phải trả |
| Nợ NCC | Σ(total_amount - paid_amount) | VT chưa TT |

### 2.2 LiquidityGauge (Đồng hồ thanh khoản)

```
Công thức: Thanh khoản = Tiền khả dụng / Nghĩa vụ ngắn hạn × 100

Tiền khả dụng = Σ CĐT đang pending trả (dự kiến vào trong 30 ngày)
              + Số dư quỹ hiện tại (nếu track)

Nghĩa vụ ngắn hạn = Nợ NCC quá hạn
                   + Thầu phụ chờ chi (PENDING)
                   + Công nợ Sateco chưa trả
                   + Lương nhân viên (nếu track)
```

**Vùng an toàn:**
```
Đỏ   (<30%): NGUY HIỂM — Không đủ tiền trả, cần hành động ngay
Vàng (30-60%): CẢNH BÁO — Theo dõi sát, ưu tiên thu tiền
Xanh (>60%): AN TOÀN — Đủ thanh khoản
```

### 2.3 StressTestSimulator (Mô phỏng kịch bản)

**3 kịch bản built-in:**

| # | Kịch bản | Tham số | Mục đích |
|---|----------|---------|----------|
| 1 | CĐT trả chậm | +30/60/90 ngày | Test gap thanh khoản nếu thu chậm |
| 2 | DA lớn nhất bị dừng | Loại 1-2 DA top revenue | Test tập trung rủi ro |
| 3 | Chi phí tăng | +10/20/30% chi phí | Test margin sensitivity |

**Cách hoạt động:**
```
1. Lấy data thực tế hiện tại
2. Áp tham số scenario
3. Recalc tất cả KPI
4. Hiện delta (trước vs sau stress)
5. Highlight các chỉ số chuyển từ xanh → vàng/đỏ
```

---

## 3. TÍN HIỆU & CẢNH BÁO

### 🚨 NGUY HIỂM (cần hành động NGAY):
- Công nợ Sateco > Tiền đang có → **thiếu hụt thanh khoản**
- Nợ NCC vật tư > 30% tổng VT → **NCC có thể ngừng cung cấp**
- Nhiều HĐ cùng đến hạn tạm ứng thầu → **cần lên lịch ưu tiên**
- LiquidityGauge < 30% → **vùng đỏ, nguy hiểm**
- CĐT overdue > 60 ngày → **khả năng thất thu**

### ⚠️ CẢNH BÁO (theo dõi sát):
- Margin tổng < 15% → **lợi nhuận mỏng, rủi ro phát sinh**
- Đã thu / Phải thu < 50% → **thu chậm so với tiến độ**
- Tỷ lệ chi/thu > 0.85 → **chi gần bằng thu, buffer mỏng**
- Nhiều DA cùng status "Quá hạn thu" → **CĐT trả chậm hệ thống**

### ✅ TỐT:
- Đã thu / Phải thu > 60% → **thu tốt**
- Công nợ Sateco đã giải quyết > 80% → **nội bộ ổn**
- Margin tổng > 25% → **lợi nhuận khỏe**
- LiquidityGauge > 60% → **thanh khoản an toàn**

---

## 4. PHÂN TÍCH CHÉO (Cross-project)

### 4.1 Top Projects by Revenue
```
Sắp xếp projects theo: Đã thu (DESC) → Top 5 contributors
```

### 4.2 Concentration Risk
```
Top 1 project > 40% tổng DT → RỦI RO TẬP TRUNG
Top 3 projects > 80% tổng DT → RỦI RO TẬP TRUNG
```

### 4.3 Monthly Cashflow Forecast
```
Tháng tới dự kiến thu: Σ expected_amount (due_date trong tháng tới)
Tháng tới dự kiến chi: Σ approved_amount PENDING + Nợ NCC quá hạn
GAP = Thu dự kiến - Chi dự kiến
```

### 4.4 Aging Analysis (Phân tích tuổi nợ)
```
0-30 ngày: Nợ mới → màu xanh
31-60 ngày: Cần theo dõi → màu vàng
61-90 ngày: Cần hành động → màu cam
> 90 ngày: Rủi ro thất thu → màu đỏ
```

---

## 5. FILE MAP

```
src/components/
├── DashboardOverview.jsx           -- KPI tổng công ty
│   ├── Revenue/Expense summary
│   ├── Project list with health indicators
│   └── Quick action buttons
│
├── LiquidityGauge.jsx              -- Gauge chart thanh khoản
│   ├── SVG gauge (red/yellow/green)
│   ├── Current ratio calculation
│   └── Trend indicator
│
├── StressTestSimulator.jsx         -- Stress test scenarios
│   ├── Scenario selector
│   ├── Parameter adjustment
│   ├── Before/After comparison
│   └── Risk alert highlights
│
└── ProjectFirewall.jsx             -- (Planned) Chi tiêu lớn cần duyệt
```

---

## 6. DECISION FRAMEWORK

Khi user hỏi về dòng tiền / thanh khoản, follow framework:

### Bước 1: Assessment (Đánh giá)
```
1. Tính tổng phải thu, phải trả, margin
2. Check LiquidityGauge đang ở vùng nào
3. List top 3 rủi ro concentration
```

### Bước 2: Diagnosis (Chẩn đoán)
```
Nếu thanh khoản thấp:
  → CĐT trả chậm? → Push ĐNTT, gọi CĐT
  → Chi phí phình? → Review VT + NC
  → Nợ NCC cao? → Ưu tiên trả NCC chiến lược

Nếu thanh khoản tốt:
  → Có cơ hội đầu tư/mở rộng?
  → Margin có thể cải thiện?
```

### Bước 3: Action (Hành động)
```
1. Lập lịch thu tiền CĐT (ưu tiên DA quá hạn)
2. Lên kế hoạch chi (ưu tiên NCC chiến lược)
3. Chạy stress test cho 30 ngày tới
4. Báo cáo cho Ban GĐ
```

---

## 7. COMMON PATTERNS

### ✅ DO:
- Phân biệt rõ: nợ Sateco (nội bộ) vs nợ NCC (bên ngoài)
- Stress test = mô phỏng, KHÔNG thay đổi DB
- Luôn context time range (tháng này vs tháng sau)
- Cross-reference với từng DA cụ thể khi cần detail

### ❌ DON'T:
- Không nhầm revenue (doanh thu HĐ) với income (tiền thực thu)
- Không tính DA đã "Hoàn thành" vào pipeline phải thu
- Không mix số liệu TL với STC khi phân tích liquidity
- Không skip aging analysis cho nợ > 60 ngày
