-- ============================================================
--  THỦ KHO (vai trò "Kho dự án" = ROLE09) chỉ thấy KHO VẬT TƯ.
--  Ẩn Nhà cung cấp / Danh mục Vật tư / Mua hàng & Công nợ NCC (đều lộ giá/công nợ).
--  Chạy trong Supabase SQL Editor. (Hoặc chỉnh tương đương ở màn Phân quyền.)
--  ĐỔI 'ROLE09' nếu thủ kho của bạn ở vai trò khác.
-- ============================================================

-- 1) Bảo đảm thủ kho có quyền dùng Kho vật tư (xem tab + xuất kho)
insert into public.role_permissions (role_code, permission_code)
select 'ROLE09', p from (values ('view_inventory'), ('import_inventory'), ('export_inventory')) as x(p)
where exists (select 1 from public.permissions where code = x.p)
on conflict do nothing;

-- 2) Gỡ các quyền khiến thủ kho THẤY các menu khác trong nhóm VẬT TƯ (có giá bán / công nợ)
delete from public.role_permissions
where role_code = 'ROLE09'
  and permission_code in (
    'view_materials','view_suppliers','manage_materials','manage_materials_tracking',
    'edit_materials_master','manage_partners','create_purchase_order','create_suppliers',
    'edit_suppliers','pay_supplier','receive_goods','create_materials_tracking','create_material_request'
  );

-- 3) KHÔNG cấp view_material_price / view_all_inventory cho ROLE09 -> thủ kho ẩn giá + chỉ thấy
--    công trình được phân công (đã xử lý ở db/inventory_permissions.sql).

-- Kiểm tra quyền còn lại của thủ kho:
-- select permission_code from public.role_permissions where role_code='ROLE09' order by 1;
