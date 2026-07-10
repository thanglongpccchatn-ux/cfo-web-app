-- ============================================================
--  Thanh toán NCC theo TỪNG ĐƠN HÀNG
--  Thêm cột supplier_payments.purchase_ref để gắn khoản trả với 1 đơn mua
--  (khoá đơn = NCC + dự án + ngày + số HĐ). Nhờ đó tính được "đã trả / còn nợ" theo đơn.
--  Chạy 1 lần trong Supabase SQL Editor.
-- ============================================================

alter table public.supplier_payments add column if not exists purchase_ref text;

create index if not exists idx_supplier_payments_ref on public.supplier_payments (purchase_ref);
