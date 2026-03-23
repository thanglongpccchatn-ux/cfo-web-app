# SATECO.JSC — CFO Dashboard

> Hệ thống quản lý tài chính doanh nghiệp dành cho **SATECO Mechanical & Electric** (Thăng Long PCCC).  
> Theo dõi dòng tiền, hợp đồng, công nợ, và hiệu suất dự án theo thời gian thực.

---

## 📋 Tổng quan

CFO Dashboard là ứng dụng web nội bộ giúp Ban Giám đốc và Phòng Tài chính:

- **Quản lý Hợp đồng**: Tạo, theo dõi và phân tích hàng chục hợp đồng cùng lúc (bao gồm VAT, phụ lục, và khoán nội bộ Sateco).
- **Theo dõi Dòng tiền**: Giám sát thực thu (Cash-in), công nợ hóa đơn, và tỷ lệ thu hồi vốn.
- **Quản lý Hồ sơ Thanh toán**: Đề nghị thanh toán, xuất hóa đơn, lịch sử chuyển tiền ngoại bộ & nội bộ.
- **Dashboard Chiến lược**: Biểu đồ xu hướng, phân bổ danh mục, hiệu quả thu nợ, và top dự án lợi nhuận.
- **Kho Vật tư**: Quản lý nhập/xuất/tồn kho vật tư theo dự án.
- **Báo cáo Tài chính**: Xuất báo cáo tổng hợp theo tháng, so sánh kế hoạch vs thực tế.

---

## 🛠 Tech Stack

| Layer        | Công nghệ                                             |
| ------------ | ------------------------------------------------------ |
| **Frontend** | React 19, Vite 7, Tailwind CSS 3                      |
| **Backend**  | Supabase (PostgreSQL + Auth + Realtime + Storage)      |
| **Charts**   | Chart.js + react-chartjs-2                             |
| **Export**    | jsPDF, jspdf-autotable, xlsx, PapaParse                |
| **Icons**    | Material Symbols, Lucide React                         |
| **Deploy**   | Vercel (Auto-deploy via GitHub integration)            |
| **Storage**  | Google Drive API (Document uploads)                    |

---

## 🚀 Cài đặt & Chạy Cục bộ

### Yêu cầu

- **Node.js** >= 18
- **npm** >= 9
- Tài khoản Supabase (đã có sẵn, xem `.env`)

### Các bước

```bash
# 1. Clone repository
git clone https://github.com/thanglongpccchatn-ux/cfo-web-app.git
cd cfo-web-app

# 2. Cài đặt dependencies
npm install

# 3. Tạo file .env (hoặc copy từ .env.example)
#    Cần 3 biến môi trường:
#      VITE_SUPABASE_URL=<your_supabase_url>
#      VITE_SUPABASE_ANON_KEY=<your_supabase_anon_key>
#      VITE_GOOGLE_CLIENT_ID=<your_google_client_id>

# 4. Chạy dev server
npm run dev
# → Mở http://localhost:5173
```

---

## 📁 Cấu trúc Dự án

```
cfo-web-app/
├── public/                          # Static assets
├── src/
│   ├── components/                  # React components
│   │   ├── Login.jsx                # Đăng nhập (Supabase Auth)
│   │   ├── Sidebar.jsx              # Menu điều hướng chính
│   │   ├── Header.jsx               # Header + Search
│   │   ├── DashboardOverview.jsx    # Tổng quan CEO (KPIs + Charts)
│   │   ├── DashboardCharts.jsx      # Biểu đồ chiến lược (4 charts)
│   │   ├── ContractMasterDetail.jsx # Danh sách hợp đồng
│   │   ├── ContractCreate.jsx       # Form tạo/sửa hợp đồng
│   │   ├── ContractDetailedDashboard.jsx # Chi tiết dự án
│   │   ├── DocumentTrackingModule.jsx    # Hồ sơ thanh toán
│   │   ├── PaymentTracking.jsx      # Theo dõi thanh toán
│   │   ├── PaymentReceiptsModule.jsx # Lịch sử thu tiền
│   │   ├── SuppliersMaster.jsx      # Quản lý nhà cung cấp
│   │   ├── SubcontractorsMaster.jsx # Quản lý nhà thầu phụ
│   │   ├── MaterialsMaster.jsx      # Danh mục vật tư
│   │   ├── MonthlyReport.jsx        # Báo cáo tháng
│   │   ├── PlanActualDashboard.jsx  # Kế hoạch vs Thực tế
│   │   ├── Inventory/              # Module Kho vật tư
│   │   ├── common/                  # Components dùng chung
│   │   └── ...                      # Các module khác
│   ├── context/
│   │   ├── AuthContext.jsx          # Xác thực & phân quyền
│   │   ├── InventoryContext.jsx     # State quản lý kho
│   │   └── ToastContext.jsx         # Thông báo UI
│   ├── lib/
│   │   ├── supabase.js              # Supabase client config
│   │   └── googleDrive.js           # Google Drive API helpers
│   ├── config/                      # App configuration
│   ├── App.jsx                      # App router & layout
│   ├── main.jsx                     # Entry point
│   └── index.css                    # Global styles & Tailwind
├── .env                             # Environment variables (không commit)
├── package.json
├── vite.config.js
├── tailwind.config.js
└── README.md
```

---

## 🗄 Database (Supabase)

### Bảng chính

| Bảng                        | Mô tả                                       |
| --------------------------- | -------------------------------------------- |
| `projects`                  | Thông tin dự án / hợp đồng                  |
| `addendas`                  | Phụ lục hợp đồng                            |
| `payments`                  | Hồ sơ thanh toán (đề nghị, hóa đơn)         |
| `external_payment_history`  | Lịch sử thu tiền từ CĐT/TT                 |
| `internal_payment_history`  | Lịch sử chuyển tiền nội bộ TL→Sateco        |
| `partners`                  | Danh sách đối tác (CĐT, NCC, NTP)           |
| `materials`                 | Danh mục vật tư                              |
| `inventory_receipts`        | Phiếu nhập kho                               |
| `inventory_requests`        | Phiếu xuất kho                               |
| `user_roles`                | Phân quyền người dùng (RBAC)                |

### Xác thực

Sử dụng **Supabase Auth** với email/password. Phân quyền theo vai trò (`admin`, `manager`, `viewer`) được quản lý qua bảng `user_roles`.

---

## 🌐 Deployment

Ứng dụng được deploy tự động lên **Vercel** thông qua GitHub integration:

1. Push code lên nhánh `main`.
2. Vercel tự động detect, build (`vite build`), và deploy.
3. Cấu hình **Environment Variables** trên Vercel Dashboard (giống file `.env`).

### Build thủ công

```bash
npm run build    # Output: dist/
npm run preview  # Preview bản build
```

---

## 🤝 Contributing

### Quy ước Code

- **Component**: PascalCase (`ContractCreate.jsx`)
- **Utility/Lib**: camelCase (`supabase.js`)
- **CSS**: Tailwind utility-first, custom classes trong `index.css`

### Commit Messages

```
feat: mô tả tính năng mới
fix: mô tả lỗi đã sửa
refactor: mô tả refactoring
docs: cập nhật tài liệu
```

### Quy trình

1. Tạo branch từ `main`
2. Viết code + test (nếu có)
3. Tạo Pull Request
4. Review → Merge

---

## ⚠️ Known Issues & Roadmap

### Đang phát triển

- 🔨 **Construction Module** — Module quản lý thi công
- 📊 **Advanced BI Analytics** — Phân tích dữ liệu nâng cao

### Cần cải thiện

- ⬜ Migrate dần sang TypeScript
- ⬜ Bổ sung Unit Tests cho logic tài chính
- ⬜ Refactor component lớn (`ContractCreate`, `DocumentTracking`)
- ⬜ Thêm Audit Logging
- ⬜ Setup CI/CD pipeline (GitHub Actions)

---

## 📄 License

Private — Internal use only. © 2024-2026 SATECO Mechanical & Electric JSC.
