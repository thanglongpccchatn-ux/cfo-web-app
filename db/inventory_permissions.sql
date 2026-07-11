-- ============================================================
--  PHÂN QUYỀN KHO VẬT TƯ cho THỦ KHO
--   - view_material_price : xem giá (đơn giá/giá trị/thành tiền). Thủ kho KHÔNG có -> ẩn giá.
--   - view_all_inventory  : xem/lọc mọi công trình. Thủ kho KHÔNG có -> khoá vào công trình
--                           được phân công (profiles.current_project_id).
--  Chạy 1 lần trong Supabase SQL Editor. Sau đó chỉnh cấp quyền ở màn Phân quyền nếu cần.
-- ============================================================

insert into public.permissions (code, name, module, description) values
  ('view_material_price', 'Xem giá vật tư',        'Kho', 'Xem đơn giá/giá trị/thành tiền trong Kho vật tư (thủ kho không cấp).'),
  ('view_all_inventory',  'Xem kho mọi công trình', 'Kho', 'Xem/lọc tồn kho tất cả công trình; không cấp = chỉ thấy công trình được phân công.')
on conflict (code) do nothing;

-- Cấp mặc định cho các vai trò tài chính/vật tư (KHÔNG cấp cho thủ kho ROLE09/10/11).
-- ROLE01/ADMIN tự bypass ở app nên không cần cấp.
insert into public.role_permissions (role_code, permission_code)
select r, p from (values
  ('ROLE02','view_material_price'), ('ROLE03','view_material_price'), ('ROLE04','view_material_price'),
  ('ROLE05','view_material_price'), ('ROLE06','view_material_price'), ('KETOAN','view_material_price'),
  ('ROLE02','view_all_inventory'),  ('ROLE03','view_all_inventory'),  ('ROLE04','view_all_inventory'),
  ('KETOAN','view_all_inventory')
) as x(r, p)
where exists (select 1 from public.roles where code = x.r)
on conflict do nothing;
