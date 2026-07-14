-- ============================================================
--  Thêm cột cho dòng ĐỀ NGHỊ VẬT TƯ: nhóm vật tư (mã) + KL hợp đồng + ghi chú.
--  Chạy 1 lần trong Supabase SQL Editor.
-- ============================================================

alter table public.material_request_items add column if not exists material_group text;   -- mã nhóm VT
alter table public.material_request_items add column if not exists contract_qty  numeric;  -- KL hợp đồng (tham chiếu)
alter table public.material_request_items add column if not exists note          text;     -- ghi chú dòng
