-- ==========================================
-- RBAC Phase 3: Insert 15 new permission codes
-- Date: 2026-04-23
-- Purpose: Add granular CRUD permissions for
--          modules that were missing guards
-- ==========================================

-- 1. Insert new permission codes
INSERT INTO permissions (code, name) VALUES
  ('create_suppliers', 'Thêm NCC'),
  ('edit_suppliers', 'Sửa NCC'),
  ('delete_suppliers', 'Xóa NCC'),
  ('create_expenses', 'Tạo Chi phí'),
  ('edit_expenses', 'Sửa Chi phí'),
  ('delete_expenses', 'Xóa Chi phí'),
  ('create_settlement', 'Tạo Quyết toán'),
  ('edit_settlement', 'Sửa Quyết toán'),
  ('create_labor', 'Tạo phiếu Nhân công'),
  ('approve_labor', 'Duyệt Thanh toán NC'),
  ('create_subcontractors', 'Tạo HĐ Thầu phụ'),
  ('edit_subcontractors', 'Sửa HĐ Thầu phụ'),
  ('delete_subcontractors', 'Xóa HĐ Thầu phụ'),
  ('create_materials_tracking', 'Tạo VT hiện trường'),
  ('edit_materials_master', 'Sửa Danh mục VT'),
  ('create_weekly_plan', 'Tạo KH Chi Tuần'),
  ('manage_settings', 'Quản lý Cài đặt'),
  ('view_construction', 'Xem Thi công'),
  ('manage_partners', 'Quản lý Đối tác')
ON CONFLICT (code) DO NOTHING;

-- 2. Assign new permissions to ROLE01 (Admin) — full access
INSERT INTO role_permissions (role_code, permission_code)
SELECT 'ROLE01', code FROM permissions
WHERE code IN (
  'create_suppliers', 'edit_suppliers', 'delete_suppliers',
  'create_expenses', 'edit_expenses', 'delete_expenses',
  'create_settlement', 'edit_settlement',
  'create_labor', 'approve_labor',
  'create_subcontractors', 'edit_subcontractors', 'delete_subcontractors',
  'create_materials_tracking', 'edit_materials_master',
  'create_weekly_plan', 'manage_settings',
  'view_construction', 'manage_partners'
)
ON CONFLICT DO NOTHING;

-- 3. Assign to ROLE02 (Giám đốc) — view + approve
INSERT INTO role_permissions (role_code, permission_code)
SELECT 'ROLE02', code FROM permissions
WHERE code IN (
  'edit_settlement', 'approve_labor',
  'view_construction', 'manage_partners'
)
ON CONFLICT DO NOTHING;

-- 4. Assign to ROLE03 (Vật tư) — supplier & material operations
INSERT INTO role_permissions (role_code, permission_code)
SELECT 'ROLE03', code FROM permissions
WHERE code IN (
  'create_suppliers', 'edit_suppliers',
  'create_materials_tracking', 'edit_materials_master'
)
ON CONFLICT DO NOTHING;

-- 5. Assign to ROLE06 (Trưởng điều hành HĐ) — contracts & subcontractors
INSERT INTO role_permissions (role_code, permission_code)
SELECT 'ROLE06', code FROM permissions
WHERE code IN (
  'create_subcontractors', 'edit_subcontractors',
  'create_labor', 'approve_labor',
  'edit_settlement', 'view_construction',
  'create_expenses', 'edit_expenses'
)
ON CONFLICT DO NOTHING;

-- 6. Assign to ROLE07 (Quản lý dự án) — view + approve labor
INSERT INTO role_permissions (role_code, permission_code)
SELECT 'ROLE07', code FROM permissions
WHERE code IN (
  'approve_labor', 'view_construction',
  'create_labor'
)
ON CONFLICT DO NOTHING;

-- 7. Assign to KETOAN — expenses & settlement
INSERT INTO role_permissions (role_code, permission_code)
SELECT 'KETOAN', code FROM permissions
WHERE code IN (
  'create_expenses', 'edit_expenses', 'delete_expenses',
  'create_settlement', 'edit_settlement',
  'create_suppliers', 'edit_suppliers'
)
ON CONFLICT DO NOTHING;

-- 8. Assign to DAUTHAU — bidding related suppliers
INSERT INTO role_permissions (role_code, permission_code)
SELECT 'DAUTHAU', code FROM permissions
WHERE code IN (
  'create_suppliers', 'edit_suppliers'
)
ON CONFLICT DO NOTHING;

-- 9. Assign to NHANSU — labor management
INSERT INTO role_permissions (role_code, permission_code)
SELECT 'NHANSU', code FROM permissions
WHERE code IN (
  'create_labor', 'view_construction'
)
ON CONFLICT DO NOTHING;
