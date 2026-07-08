-- ============================================================
--  FIX: không lưu được đơn mua hàng (Mua hàng & Công nợ NCC)
--  Nguyên nhân: code chèn cột supplier_purchases.reference_no (Số hóa đơn/REF)
--  nhưng bảng CHƯA có cột này -> insert lỗi 42703, bị nuốt im lặng, modal đóng
--  như thành công mà không lưu gì.
--  Chạy 1 lần trong Supabase SQL Editor.
-- ============================================================

alter table public.supplier_purchases add column if not exists reference_no text;

-- (tuỳ chọn) đánh index để lọc/nhóm theo số hoá đơn nhanh hơn:
-- create index if not exists idx_supplier_purchases_ref on public.supplier_purchases (reference_no);
