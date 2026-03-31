# 🧠 SATECO CFO — Soul Notes

> Ghi chú chiến lược, ý tưởng mở rộng, và bài học rút ra để tham khảo sau.

---

## 📅 31/03/2026 — Đánh giá VietERP (nclamvn/Viet-ERP)

### Tổng quan repo
- **GitHub:** https://github.com/nclamvn/Viet-ERP
- **Claim:** ERP mã nguồn mở cho DN Việt Nam, 738K LOC, 14 modules, 27 shared packages
- **Thực tế:** 10 commits, 1 contributor, rất có khả năng AI-generated
- **Stack:** Next.js + NestJS + Prisma + PostgreSQL + Keycloak (khác hoàn toàn SATECO)

### Đã lấy được gì (4 patterns → đã deploy)
| Pattern | File SATECO | Trạng thái |
|---------|------------|------------|
| `@vierp/vietnam` → VN compliance | `src/lib/vietnam.js` | ✅ Đã cài |
| `@vierp/metrics` → Business metrics | `src/lib/metrics.js` | ✅ Đã cài |
| `@vierp/events` → Event bus | `src/lib/eventBus.js` | ✅ Đã cài |
| `@vierp/audit` → Enhanced audit | `src/lib/auditLog.js` (upgrade) | ✅ Đã cài |
| Hook kết hợp | `src/hooks/useMetrics.js` | ✅ Đã cài |
| DB migration | `supabase/migrations/add_app_metrics.sql` | ✅ Đã chạy |

### Module Accounting — ❌ RỖNG
- Chỉ có 3 API trivial: `docs/`, `health/`, `metrics/`
- Không có code kế toán thực (journal entries, VAS chart of accounts, AR/AP)
- SATECO `financialCalcs.js` + `financials.ts` thực tế hơn gấp 10 lần
- **Kết luận:** Không có gì để lấy

### Module HRM — 🟡 Tham khảo ý tưởng được
- Cấu trúc đầy đủ hơn: 50+ API routes, 27 Prisma models, 20 enums
- Tính năng: Nhân viên, tuyển dụng, chấm công, tính lương (thuế TNCN VN), KPI, AI Copilot
- **Nhưng:**
  - License: "Private — Chỉ sử dụng nội bộ tại Real-Time Robotics VN"
  - Stack: Next.js + Prisma + NextAuth — không dùng Supabase
  - Domain: Robotics, không phải xây dựng/M&E
- **Kết luận:** Không copy code. Nếu cần HRM cho SATECO → tham khảo data model rồi tự build trên Supabase

### Nếu làm HRM cho SATECO — Kế hoạch sơ bộ
- Tham khảo 27 models Prisma của VietERP HRM cho data model
- Tự thiết kế trên Supabase phù hợp ngành xây dựng/M&E
- Ưu tiên: Danh sách nhân viên → Chấm công → Tính lương (thuế TNCN, BHXH)
- Effort ước tính: ~2-3 tuần cho module cơ bản
- **Chưa làm — đợi quyết định**

### Các module VietERP khác — ❌ Không phù hợp
- MRP, Ecommerce, OTB → Khác ngành (retail/sản xuất)
- CRM → SATECO đã có PartnerManagement + SuppliersMaster
- TPM-API → NestJS, SATECO dùng Supabase
- PM → SATECO đã mạnh hơn (42 HĐ, 610 Tỷ real data)

---

## 💡 Ý tưởng mở rộng tương lai

- [ ] **Module HRM** — Quản lý nhân sự (nếu cần)
- [ ] **Module Kế toán VAS** — Tự xây nếu cần (VietERP không có code thực)
- [ ] Gắn `useMetrics` hook vào Dashboard + PaymentTracking
- [ ] Gắn `EventBus.broadcast()` khi tạo thanh toán → auto refresh
- [ ] Thay `logAudit()` cũ bằng shortcuts (`logCreate/logUpdate/logDelete`)
- [ ] Dashboard Metrics analytics (user behavior, page load)
