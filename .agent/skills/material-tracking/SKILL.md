---
name: material-tracking-expert
description: |
  CHUYÊN GIA quản lý mua sắm vật tư, theo dõi chi phí nguyên vật liệu M&E/Xây dựng.
  Trigger: "vật tư", "vật liệu", "material", "nhà cung cấp", "NCC", "đơn giá",
  "nhóm vật tư", "danh mục vật tư", "catalog", "price history", "giá niêm yết",
  "import excel vật tư", "bảng kê mua vật tư", "phân tích vật tư",
  "còn nợ NCC", "đã thanh toán vật tư", "chi phí vật liệu", "procurement".
---

# 📦 Expert Skill: Quản Lý Mua Sắm Vật Tư

## Bối cảnh nghiệp vụ

Module Bảng Kê Mua Vật Tư quản lý **toàn bộ quy trình mua sắm nguyên vật liệu**
cho các dự án M&E/Xây dựng tại Sateco. Hỗ trợ nhập liệu catalog-based, tự động
tính toán, so sánh giá, và phân tích chi phí theo nhóm/nhà cung cấp.

---

## 1. KIẾN TRÚC DATABASE

### Bảng `expense_materials` (Giao dịch mua VT)
```sql
project_id       UUID → projects(id)     -- FK dự án
item_group       TEXT        -- Mã nhóm VT (từ material_categories.code)
expense_date     DATE        -- Ngày mua/nhập
supplier_name    TEXT        -- Tên NCC (denormalized)
supplier_id      UUID        -- FK → partners(id) (optional)
product_name     TEXT        -- Tên sản phẩm / quy cách
material_id      UUID        -- FK → materials(id) (optional, link catalog)
unit             TEXT        -- ĐVT: Cái, Bộ, m², m, Tấn, kg, Cuộn...
quantity         NUMERIC     -- Số lượng
unit_price       NUMERIC     -- Đơn giá (chưa VAT)
vat_rate         NUMERIC     -- % VAT (thường 8%)
total_amount     NUMERIC     -- Thành tiền = qty × price × (1 + vat/100)
paid_amount      NUMERIC     -- Đã thanh toán NCC
notes            TEXT        -- Ghi chú / diễn giải
```

### Bảng `materials` (Danh mục VT — Catalog)
```sql
code              TEXT UNIQUE    -- Mã VT: VD: "THEP-D10", "ONGPVC-90"
name              TEXT           -- Tên đầy đủ
unit              TEXT           -- ĐVT mặc định
category_code     TEXT           -- FK logic → material_categories.code
base_price        NUMERIC        -- Giá niêm yết gốc (nhà sản xuất)
actual_price      NUMERIC        -- Giá thực tế mua gần nhất
discount_percentage NUMERIC      -- % chiết khấu (nếu có)
```

### Bảng `material_categories` (Nhóm VT)
```sql
code    TEXT UNIQUE     -- Mã nhóm: VD: "VAT_TU_PHU", "CO_DIEN"
name    TEXT            -- Tên nhóm: "Vật tư phụ", "Cơ điện"
```

### Bảng `material_price_history` (Lịch sử giá)
```sql
material_id   UUID → materials(id)
supplier_id   UUID → partners(id)    -- NCC nào bán
unit_price    NUMERIC                  -- Giá lần mua này
notes         TEXT                     -- VD: "Giá mua TT (niêm yết: 25,000)"
created_at    TIMESTAMPTZ              -- Thời điểm ghi nhận
```

### Bảng `partners` (NCC)
```sql
-- Filter: type = 'Supplier'
id, code, name, short_name, type
-- VD: { code: 'TN-001', name: 'Thép Miền Nam', type: 'Supplier' }
```

---

## 2. CASCADE LOGIC (Auto-fill thông minh)

### 2.1 Chọn Vật tư từ Catalog
```
Chọn materials.id → Auto-fill:
  ├── product_name  ← materials.name
  ├── unit          ← materials.unit
  ├── unit_price    ← materials.actual_price || materials.base_price
  ├── item_group    ← materials.category_code
  └── total_amount  ← qty × price × (1 + vat/100)   [RE-CALC]
```

### 2.2 Chọn NCC từ Catalog
```
Chọn partners.id → Auto-fill:
  ├── supplier_id   ← partners.id
  └── supplier_name ← partners.name
```

### 2.3 Auto-calculate khi thay đổi số
```
Thay đổi quantity | unit_price | vat_rate →
  total_amount = quantity × unit_price × (1 + vat_rate/100)
```

### 2.4 Filter Vật tư theo Nhóm
```
Khi đã chọn item_group → dropdown VT chỉ hiện materials có category_code khớp
Khi chưa chọn → hiện tất cả
```

---

## 3. HỆ THỐNG CẢNH BÁO GIÁ (Price Intelligence)

### 3.1 Price Deviation Alert
```
Khi nhập unit_price cho VT có trong catalog:
  deviation = (input_price - catalog_price) / catalog_price × 100

  Hiển thị:
  - |deviation| < 0.5% → ẩn (giá khớp)
  - deviation > 0     → ↑X% (badge đỏ: mua đắt hơn)
  - deviation < 0     → ↓X% (badge xanh: mua rẻ hơn)
```

### 3.2 Price History Tooltip (hover vào ô Đơn giá)
```
Hiện tooltip dark:
  ┌─────────────────────────────┐
  │ Giá niêm yết: 25,000đ      │
  │ ─────────────────────────── │
  │ 3 lần mua gần nhất:        │
  │ 15/03 · NCC ABC    24,500đ │
  │ 01/02 · NCC XYZ    25,200đ │
  │ 10/01 · NCC ABC    25,000đ │
  └─────────────────────────────┘
```

### 3.3 Auto-save Price History
```
Khi lưu dòng VT:
  IF material_id exists AND unit_price > 0
  AND unit_price ≠ catalog_price
  → INSERT material_price_history (material_id, supplier_id, unit_price, notes)
```

---

## 4. CHẾ ĐỘ HIỂN THỊ

### 4.1 Bảng kê (Grid mode) — Mặc định
```
Desktop (≥xl): Inline-edit table giống Excel
  - Edit trực tiếp trong hàng (highlight cam)
  - Dropdown search cho: Nhóm VT, NCC, Tên SP
  - InlineSearchDropdown component cho catalog search

Mobile (<xl): Card layout
  - Bottom sheet modal khi edit
  - Touch-friendly, scrollable fields
```

### 4.2 Phân tích (Analytics mode)
```
Toggle "Phân tích" → hiện 2 bảng:
1. Cơ cấu chi phí theo Nhóm VT
   - Bảng + progress bar tỷ trọng %
2. Giá trị nhập theo NCC
   - Card grid, mỗi NCC 1 card với tổng giá trị + tỷ trọng
```

---

## 5. FILE MAP (Component Architecture)

```
src/components/
├── MaterialTracking.jsx           -- Module chính (882 lines)
│   ├── Header: Project filter + KPI (Tổng/Đã TT/Còn Nợ)
│   ├── Analytics mode toggle
│   ├── Desktop inline-edit table
│   ├── Mobile card view
│   ├── Mobile edit bottom sheet
│   └── Excel import integration
│
├── common/InlineSearchDropdown.jsx -- Typeahead dropdown for inline editing
│   ├── Search-as-you-type
│   ├── Create new option (nhóm VT)
│   └── Highlight matched text
│
└── ExcelImportModal.jsx           -- Import từ Excel
    ├── Column mapping: MATERIAL_COLUMN_MAPPING
    ├── Template download: mau_vat_tu.xlsx
    └── Auto-assign project_id
```

---

## 6. UX OPTIMIZATION GUIDELINES

### 6.1 Nhập liệu tối ưu
- **Catalog-first**: Ưu tiên chọn từ catalog (materials, partners) → auto-fill cascading
- **Allow freetext**: Vẫn cho phép nhập tay nếu VT chưa có trong catalog
- **Create-on-the-fly**: Nhóm VT mới → tạo luôn trong `material_categories` từ dropdown
- **Smart defaults**: VAT mặc định 8%, quantity = 1, expense_date = today
- **Number formatting**: Dùng `formatCurrency()` hiển thị, nhập raw number
- **Filter by category**: Khi đã chọn nhóm → dropdown VT chỉ hiện nhóm đó

### 6.2 Inline Edit Experience
```
Click Edit → hàng chuyển sang edit mode:
  - Background: orange-50/40
  - Outline: orange-300
  - Shadow: orange glow
  - All fields become inputs (text, number, date, dropdown)
  - Save (✓) + Cancel (✕) buttons appear
  
Click Add → dòng mới insert đầu bảng, auto enter edit mode
  - id = 'temp-' + timestamp (chưa lưu DB)
  - Cancel → xóa khỏi state
  - Save → INSERT vào DB
```

### 6.3 Project Selection (khi không embedded)
```
Custom searchable project dropdown:
  - Input text + dropdown list
  - Search by: internal_code, code, name
  - "Tất cả dự án" option
  - Flash red ring nếu chưa chọn DA khi thêm dòng
```

### 6.4 Color System
| Element | Color | Context |
|---------|-------|---------|
| Header, actions | Orange | Module identity |
| Thành tiền | Orange (bg-orange-50) | Key financial column |
| Đã thanh toán | Emerald (bg-emerald-50) | Positive/paid |
| Còn nợ | Red (bg-red-50) | Attention needed |
| VAT | Yellow | Tax highlight |
| Nhóm VT badge | Slate | Category tag |
| NCC | Indigo | Supplier identity |

---

## 7. BUSINESS RULES (Luật nghiệp vụ)

### 7.1 Validation
- ❗ BẮT BUỘC: `product_name` + `expense_date`
- ❗ BẮT BUỘC: `project_id` (auto từ context hoặc filter)
- Auto-calc: `total_amount = qty × price × (1 + vat/100)` — có thể override
- `paid_amount` = 0 khi tạo mới (chưa thanh toán NCC)

### 7.2 VAT Rules
| Loại NCC | VAT mặc định | Ghi chú |
|----------|-------------|---------|
| Công ty (có MST) | 8% | Hóa đơn VAT |
| Cửa hàng nhỏ | 0% | Không hóa đơn |
| Hàng nhập khẩu | 8-10% | Tùy mặt hàng |

### 7.3 Nhóm VT phổ biến (Sateco M&E)
| Code | Tên nhóm | Ví dụ sản phẩm |
|------|---------|----------------|
| VT_CHINH | Vật tư chính | Ống thép, dây cáp điện, sprinkler |
| VT_PHU | Vật tư phụ | Ốc vít, keo silicon, băng keo |
| CO_DIEN | Cơ điện | Tủ điện, CB, contactors, ổ cắm |
| PCCC | PCCC | Đầu báo khói, còi, nút nhấn |
| ONG_DUONG | Ống đường ống | Ống PVC, ống thép, phụ kiện ống |
| HOAN_THIEN | Hoàn thiện | Sơn, bả, gạch, kính |
| MAY_MOC | Máy móc/thiết bị | Máy bơm, quạt, máy phát |
| AN_TOAN | An toàn/BHL | Mũ, giày, dây đai, lưới |

### 7.4 Đơn vị tính phổ biến
`Cái`, `Bộ`, `m`, `m²`, `m³`, `kg`, `Tấn`, `Cuộn`, `Hộp`, `Tấm`, `Thanh`, `Ống`, `Lít`, `Can`

---

## 8. ANALYTICS & REPORTING

### 8.1 KPI Header (real-time)
```
Tổng (gồm VAT) = Σ total_amount (all non-new rows)
Đã TT           = Σ paid_amount
Còn Nợ           = Tổng - Đã TT
```

### 8.2 Phân tích theo Nhóm
```sql
SELECT item_group, SUM(total_amount) as total
FROM expense_materials
WHERE project_id = ?
GROUP BY item_group
ORDER BY total DESC
```
→ Hiện bảng + progress bar tỷ trọng

### 8.3 Phân tích theo NCC
```sql
SELECT supplier_name, SUM(total_amount) as total
FROM expense_materials
WHERE project_id = ?
GROUP BY supplier_name
ORDER BY total DESC
```
→ Hiện card grid, mỗi NCC 1 card

---

## 9. EXCEL IMPORT

### Column Mapping
```js
MATERIAL_COLUMN_MAPPING = {
    expense_date: 'Ngày Nhập',
    item_group: 'Nhóm Vật Tư',
    supplier_name: 'Nhà Cung Cấp',
    product_name: 'Tên Vật Tư / MMTB',
    unit: 'Đơn Vị',
    quantity: 'Số Lượng',
    unit_price: 'Đơn Giá (VNĐ)',
    vat_rate: 'VAT (%)',
    total_amount: 'Thành Tiền (VAT)',
    notes: 'Ghi Chú'
}
```

### Template mẫu
File: `mau_vat_tu.xlsx` — tự auto-generate từ mapping + sample rows

---

## 10. COMMON PATTERNS & ANTI-PATTERNS

### ✅ DO:
- Luôn chọn từ catalog trước khi nhập tay → đảm bảo tracking giá
- Dùng `InlineSearchDropdown` cho tất cả dropdown trong edit mode
- Invalidate `['materials']` + `['materialCatalogs']` sau mỗi thay đổi
- Lưu `material_id` và `supplier_id` khi chọn từ catalog (cho tracking)
- Auto-scroll đến dòng mới khi thêm
- Dùng `tabular-nums` cho tất cả cột số tiền

### ❌ DON'T:
- Không cho thêm dòng khi chưa chọn dự án → flash red warning
- Không tự ý thay đổi `total_amount` khi user đã override
- Không xóa `paid_amount` khi edit dòng đã có payment
- Không duplicate supplier_name nếu đã có supplier_id
- Không query tất cả materials nếu đã filter theo category

---

## 11. OPTIMIZATION IDEAS (Future)

### Đã implement:
- [x] Catalog-based input (materials + suppliers)
- [x] Price deviation alerts (↑/↓ %)
- [x] Price history tooltip
- [x] Auto-save price history
- [x] Analytics view (nhóm + NCC)
- [x] Mobile bottom sheet edit
- [x] Excel import

### Chưa implement (Priority):
- [ ] 3-step approval workflow: Công trường → Ban GĐ → Kế toán chi
- [ ] Barcode/QR scan để nhập VT nhanh
- [ ] Photo upload (ảnh hóa đơn, chứng từ)
- [ ] Stock tracking (tồn kho thực tế vs. đã dùng)
- [ ] Budget warning (so sánh với dự toán)
- [ ] Auto-suggest NCC theo VT (NCC nào thường cung cấp VT này)
- [ ] Batch payment (gom nhiều dòng NCC để thanh toán 1 lần)
- [ ] Export PDF bảng kê (cho kế toán in ký)
