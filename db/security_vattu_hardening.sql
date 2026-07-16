-- ============================================================
--  VÁ BẢO MẬT MODULE VẬT TƯ (từ review lần 3)
--  H1: policy GHI của suppliers/partners/projects đang OR cả quyền CHỈ-ĐỌC
--      (view_suppliers / view_contracts) -> ai chỉ có quyền xem cũng tạo/sửa/xóa được
--      (kể cả tự tạo NCC/công trình khi import). Gỡ các quyền view_* khỏi policy GHI.
--
--  ⚠️ CHẠY TRÊN SUPABASE SQL EDITOR. Cần _apply_rls đã tồn tại (từ security_rls_phase2.sql).
--  ⚠️ SAU KHI CHẠY: test bằng 1 tài khoản CHỈ có quyền xem -> phải KHÔNG tạo/sửa được;
--     tài khoản quản lý NCC/HĐ (manage_partners/create_contracts...) vẫn ghi bình thường.
-- ============================================================

-- Ghi = CHỈ các quyền quản lý thực sự (bỏ view_*). Admin (ROLE01/ADMIN) vẫn luôn qua.
select public._apply_rls('suppliers', 'manage_partners', 'manage_materials');
select public._apply_rls('partners',  'manage_partners', 'manage_materials');
select public._apply_rls('projects',  'create_contracts', 'edit_contracts', 'delete_contracts');

-- Kiểm tra policy ghi hiện tại (không còn view_*):
-- select tablename, policyname, pg_get_expr(polqual, polrelid) as using_expr
-- from pg_policies join pg_policy on policyname=polname
-- where tablename in ('suppliers','partners','projects') and policyname like 'rls_wr_%';

-- ROLLBACK (nếu khoá nhầm ai đó) — trả lại như cũ:
-- select public._apply_rls('suppliers','manage_partners','view_suppliers','manage_materials');
-- select public._apply_rls('partners','manage_partners','view_suppliers','manage_materials');
-- select public._apply_rls('projects','create_contracts','edit_contracts','delete_contracts','view_contracts');
