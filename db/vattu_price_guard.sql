-- ============================================================
--  C1 — ẨN GIÁ Ở SERVER (không chỉ ẩn UI) cho supplier_purchases + material_issues
--  Thủ kho (không có 'view_material_price') đọc được SỐ LƯỢNG/tồn nhưng KHÔNG thấy
--  unit_price/vat_rate/total_amount — kể cả gõ Console.
--
--  Cách: khóa cột GIÁ trên BẢNG GỐC; đọc giá qua VIEW che-cột-theo-quyền.
--
--  ⚠️ LƯU Ý QUAN TRỌNG: 2 view _v dùng security_invoker = false (chạy quyền owner) nên
--  BYPASS RLS HÀNG của bảng gốc. Hiện policy SELECT là using(true) nên không lộ gì thêm,
--  nhưng NẾU SAU NÀY siết đọc theo công trình/phòng ban ở bảng gốc thì PHẢI thêm điều kiện
--  lọc hàng tương ứng vào 2 view này (hoặc chuyển security_invoker = true) — nếu không
--  view sẽ âm thầm mở toang dữ liệu.
--  ⚠️ CHẠY TRÊN SUPABASE SQL EDITOR (cần current_user_has_perm từ security_rls_phase2.sql).
--  ⚠️ SAU KHI CHẠY test 2 tài khoản: thủ kho thấy tồn KHÔNG giá; kế toán thấy đủ giá,
--     Mua hàng & Công nợ NCC vẫn chạy bình thường.
-- ============================================================

-- ─────────────────────────────────────────────────────────
-- 1) supplier_purchases
-- ─────────────────────────────────────────────────────────
drop view if exists public.supplier_purchases_v;
create view public.supplier_purchases_v with (security_invoker = false) as
select
    id, project_id, supplier_id, material_group, purchase_date, product_name, unit,
    quantity, material_id, reference_no, notes, created_by, created_at, updated_at,
    case when public.current_user_has_perm('view_material_price') then unit_price   end as unit_price,
    case when public.current_user_has_perm('view_material_price') then vat_rate     end as vat_rate,
    case when public.current_user_has_perm('view_material_price') then total_amount end as total_amount
from public.supplier_purchases;
alter view public.supplier_purchases_v owner to postgres;
grant select on public.supplier_purchases_v to authenticated;

revoke select on public.supplier_purchases from authenticated;
grant  select (id, project_id, supplier_id, material_group, purchase_date, product_name, unit,
               quantity, material_id, reference_no, notes, created_by, created_at, updated_at)
    on public.supplier_purchases to authenticated;

-- ─────────────────────────────────────────────────────────
-- 2) material_issues (giá xuất = đơn giá BQ lúc xuất)
-- ─────────────────────────────────────────────────────────
drop view if exists public.material_issues_v;
create view public.material_issues_v with (security_invoker = false) as
select
    id, project_id, material_id, material_key, product_name, unit, quantity, issue_date,
    notes, created_by, created_at, slip_code, subcontractor_id, subcontractor_name,
    request_id, request_item_id,
    case when public.current_user_has_perm('view_material_price') then unit_price end as unit_price
from public.material_issues;
alter view public.material_issues_v owner to postgres;
grant select on public.material_issues_v to authenticated;

revoke select on public.material_issues from authenticated;
grant  select (id, project_id, material_id, material_key, product_name, unit, quantity, issue_date,
               notes, created_by, created_at, slip_code, subcontractor_id, subcontractor_name,
               request_id, request_item_id)
    on public.material_issues to authenticated;

-- 3) Siết GHI material_issues: thủ kho (chỉ export_inventory) KHÔNG ghi thẳng được nữa,
--    phải qua RPC issue_from_request / issue_adhoc (SECURITY DEFINER, có kiểm tồn + công trình).
--    Ghi thẳng chỉ dành cho quản lý vật tư / admin.
drop policy if exists mi_write on public.material_issues;
create policy mi_write on public.material_issues for all to authenticated
    using (public.current_user_has_perm('manage_materials') or public.current_user_has_perm('manage_materials_tracking'))
    with check (public.current_user_has_perm('manage_materials') or public.current_user_has_perm('manage_materials_tracking'));

-- ROLLBACK:
-- grant select on public.supplier_purchases to authenticated; drop view if exists public.supplier_purchases_v;
-- grant select on public.material_issues to authenticated;   drop view if exists public.material_issues_v;
-- drop policy if exists mi_write on public.material_issues;
-- create policy mi_write on public.material_issues for all to authenticated
--   using (public.current_user_has_perm('export_inventory') or public.current_user_has_perm('manage_materials') or public.current_user_has_perm('manage_materials_tracking'))
--   with check (public.current_user_has_perm('export_inventory') or public.current_user_has_perm('manage_materials') or public.current_user_has_perm('manage_materials_tracking'));
