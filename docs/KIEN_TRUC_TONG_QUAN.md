# CFO Web App (SATECO) — Kiến trúc & Hiểu sâu codebase

> Tài liệu do đọc hiểu toàn bộ codebase. Mục đích: nắm nhanh kiến trúc, mô hình dữ liệu, logic tài chính, và các điểm rủi ro/nợ kỹ thuật.

## 1. Tổng quan & quy mô
- **Loại:** ERP tài chính - thi công cho nhóm 3 pháp nhân **Thăng Long / Thành Phát / Sateco** (`acting_entity_key: thanglong|thanhphat|sateco`).
- **Quy mô:** ~155 file nguồn, **121 component .jsx**, ~50 module route (lazy-load). Lớn hơn nhiều so với README.
- **Stack:** React 19 + Vite 7 + Tailwind 3 + Supabase (Postgres/Auth/Realtime/Storage) + react-query + Chart.js + jsPDF/xlsx. Google Drive cho upload chứng từ. Deploy Vercel.
- **Ngôn ngữ:** chủ yếu `.jsx` (JS), một ít `.ts` (financials.ts, database.ts) — đang migrate TS dở dang.

## 2. Kiến trúc tầng (src/App.jsx)
- **Provider lồng nhau:** `GlobalErrorBoundary → QueryClientProvider → BrowserRouter → AuthProvider → AppContent`; sau đăng nhập: `NotificationProvider → ToastProvider → InventoryProvider → MainLayout`.
- **Routing:** ~50 `<Route>` bọc `ProtectedRoute`, tất cả component **lazy** (code splitting) + `Suspense` + `ModuleErrorBoundary` mỗi route.
- **RBAC** (`ProtectedRoute`): admin (`role_code` = `ROLE01`/`ADMIN`) bypass; còn lại cần `requiredPerms` qua `hasPermission`. Có màn "Không có quyền".
- **fullscreenView:** một số luồng phức tạp (ContractCreate, PaymentTracking, MaterialTracking, LaborTracking, AddendaCreate) chạy toàn màn hình ngoài Routes.
- **Khởi tạo:** load `theme_settings` (brand), `EventBus.initRealtimeBridge()`, timeout an toàn 12s/6s.

## 3. Xác thực & phân quyền (src/context/AuthContext.jsx)
- Supabase Auth (email/password, **PKCE**, localStorage). 
- Nạp `profiles` (+ `roles:role_code(name)`); nếu `status='Khóa'` → tự signOut.
- Đa vai trò: bảng `user_roles`; **quyền tổng hợp qua RPC `get_user_permissions`** (gộp mọi vai trò) → mảng `permission_code`.
- API context: `user, profile, permissions, userRoles, login, logout, hasPermission, hasRole, refreshProfile`.

## 4. Hạ tầng dùng chung (src/lib, utils, hooks)
| File | Vai trò |
|---|---|
| `lib/eventBus.js` | Pub/sub local + **Supabase Realtime broadcast** (cross-tab/user) + `watchTable` (postgres_changes). Enum `EVENTS`. |
| `lib/accountingService.js` | **Tự sinh bút toán kép** từ nghiệp vụ (xem §6). |
| `lib/auditLog.js` | Ghi nhật ký thao tác (bảng `audit_logs`). |
| `lib/metrics.js` | Đo lường/telemetry. |
| `lib/chatStorage.js` | Lưu trữ chat. |
| `lib/googleDrive.js` | Upload chứng từ lên Google Drive. |
| `lib/vietnam.js` | Tiện ích VN (định dạng/ngân hàng/số→chữ). |
| `lib/financials.ts` | Hàm tài chính cốt lõi (typed). |
| `utils/financialCalcs.js` | `computeProjectFinancials` — tổng hợp tài chính 1 dự án. |
| `utils/paymentUtils.js`, `formatters.js`, `exportExcel.js`, `globalToast.js` | Tiện ích thanh toán, định dạng, xuất Excel, toast toàn cục. |
| `hooks/useQueries.js` | Hook react-query truy vấn dữ liệu. |
| `hooks/useChat*.js`, `useMetrics.js` | Chat realtime, metrics. |

## 5. Mô hình dữ liệu (src/types/database.ts + code)
**Lõi kinh doanh:**
- `partners` (KH/ĐTP/NCC/TĐP), `projects` (giá trị pre/post VAT, `sateco_contract_ratio` ~98%, `sateco_actual_ratio` ~95.5%, công nợ TL/ST, acting_entity).
- `payments` (đề nghị TT, hóa đơn, `external_income`, công nợ nội bộ, invoice_date/due_date, trạng thái).
- `external_payment_history` (thực thu từ CĐT), `internal_payment_history` (chi nội bộ TL→Sateco).
- `addendas` (phụ lục), variations (phát sinh), `bank_account_profiles`, `audit_logs`.

**Kho/vật tư:** `materials`, `inventory_receipts`, `inventory_requests`, `material_price_history`, purchase orders (PO), `partners` (NCC).

**Vay & chi phí:** `loans`, `loan_payments`, expenses (`expense_type`, paid_amount), labor (team).

**Kế toán kép TT200:** `acc_accounts` (số hiệu TK), `acc_journal_entries`, `acc_journal_lines`, `acc_fiscal_periods`.

**Khác:** `theme_settings`, chat (conversations/messages), tasks, `profiles`/`roles`/`user_roles`.

## 6. Bộ não tài chính
### 6.1 Hàm cốt lõi (`lib/financials.ts`)
`calculateVAT` (mặc định 8%), `calculateSatecoRevenue` (tỷ lệ 98% trên post-VAT), `calculateGrossProfit` (actual 95.5%), `calculateInvoiceDebt`, `calculateRecoveryRate`, `calculateSPI` (chỉ số tiến độ), `calculateSafetyRatio`, format VND/tỷ.

### 6.2 Tổng hợp dự án (`utils/financialCalcs.js`)
`computeProjectFinancials(project, payments, extHistory, intHistory)` →
- Giá trị HĐ: original, VAT, post-VAT, **+ phát sinh đã duyệt** (`total_value_post_vat`).
- Thực thu (ưu tiên `external_payment_history`, fallback `payments.external_income`).
- Hóa đơn, đề nghị TT, công nợ (HĐ - thu, đề nghị - thu).
- DT nội bộ Sateco = post-VAT × contractRatio; lợi nhuận = thu × actualRatio − chi.
- Tỷ lệ thu hồi, bảo hành (5%).
- `aggregateFinancials` + `calculatePerformanceKPIs` (LNG/DT, SL/CP, SPI, DT/SL, thu/DT, thu/chi).

### 6.3 Kế toán kép tự động (`lib/accountingService.js`)
- `createAutoJournalEntry`: idempotent (`source_module`+`source_id`), cân Nợ=Có, map số hiệu TK→id, tìm kỳ kế toán mở, ghi `acc_journal_entries`+`acc_journal_lines` trạng thái **draft** (kế toán duyệt sau), emit event.
- Shortcut `autoJournal`: nhân công (622/334), TT NCC (331/112|111), thu KH (112/131), trả vay (341/635/112), CP chung (627/642/623/811/112), **kết chuyển cuối kỳ** (5xx/7xx→911→4212).

## 7. Bản đồ module (~50, nhóm chính)
- **Tổng quan/Phân tích:** DashboardOverview, FinancialAnalyticsHub + 8 dashboard (BalanceSheet, CashFlow, CFOOverview, IncomeStatement, FinancialMatrix, CapitalAsset, Performance).
- **Hợp đồng:** ContractMasterDetail, ContractCreate, ContractDetailedDashboard, AddendaCreate, VariationsManagement, BiddingManagement, SettlementManagement, WarrantyTracking, SiteDiary.
- **Thanh toán/Dòng tiền:** DocumentTrackingModule, PaymentReceiptsModule, PaymentTracking, PaymentsMaster, LoanManagement, ExpenseTracking, WeeklyExpensePlan.
- **NCC/Vật tư/Nhân công:** SuppliersMaster, SubcontractorsMaster, LaborSubcontractorHub, MaterialsMaster, MaterialTracking, SupplierPayables, Inventory/* (12 file: inbound/outbound/PO/price history/debt).
- **Kế toán TT200:** ChartOfAccounts, FiscalPeriodManager, JournalEntries, GeneralLedger, FinancialReports, EInvoiceManagement, BudgetManagement, RecurringTemplates.
- **Quản trị/Khác:** UserManagement, RoleManagement, PartnerManagement, BankManagement, TreasuryManagement, AuditTrailViewer, TaskManagement, ChatModule, ConstructionModule, PlanningModule, Settings, UserProfile, UserGuide.

## 8. Phát hiện & nợ kỹ thuật / rủi ro
1. **✅ ĐÃ XỬ LÝ (một phần):** Lệch logic tài chính giữa shared util và live components.
   - `financialCalcs.js` + `financials.ts` đã sửa: khoán Sateco áp **PRE-VAT** (đồng bộ commit + live); `debtRequested` kẹp âm **từng đợt** (khớp DashboardOverview, chính xác hơn cách gộp).
   - Đã thêm test tương đương (`computeProjectFinancials ⇔ DashboardOverview`) → **47/47 pass**; shared util giờ là nguồn chân lý đúng & an toàn để adopt.
   - **CÒN LẠI:** các component vẫn tính INLINE (chưa gọi `computeProjectFinancials`). Bước tiếp: refactor DashboardOverview/ContractMasterDetail/... dùng shared util (giờ đã an toàn vì đã chứng minh tương đương) — nên làm khi chạy được app để kiểm thị giác.
2. **Component khổng lồ:** SubcontractorContracts (97KB), BiddingManagement (82KB), ContractMasterDetail (69KB), SuppliersMaster/MaterialTracking (68KB)... khó bảo trì, nên tách.
3. **Thiếu test logic tài chính:** vitest có sẵn nhưng rất ít test; logic tiền/kế toán là chỗ rủi ro cao nhất — nên ưu tiên unit test cho `financials.ts`, `financialCalcs.js`, `accountingService.js`.
4. **Truy cập Supabase rải rác:** nhiều component gọi `supabase.from(...)` trực tiếp lẫn react-query — chưa nhất quán; cân nhắc gom về hooks/useQueries.
5. **Migrate TS dở dang:** chỉ 3 file .ts; phần lớn logic tiền vẫn .jsx không kiểu.
6. **Phụ thuộc RPC Supabase:** `get_user_permissions` (RBAC) — cần đảm bảo migration/định nghĩa nằm trong repo (`supabase_migrations/`).
7. **Idempotency bút toán** dựa `source_module+source_id` — tốt; nhưng sửa/xoá nghiệp vụ gốc chưa thấy luồng cập nhật/đảo bút toán tương ứng → rủi ro lệch sổ.
