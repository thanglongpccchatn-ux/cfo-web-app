-- ==============================================================================
-- FIX: Tạo đầy đủ permissions còn thiếu và gán cho tất cả vai trò
-- Chạy 1 lần trên Supabase SQL Editor
-- ==============================================================================

-- 1. TẠO CÁC PERMISSION CÒN THIẾU
INSERT INTO public.permissions (code, name, module, description) VALUES
('view_contracts', 'Xem hợp đồng', 'Contracts', 'Quyền xem danh sách hợp đồng'),
('view_payments', 'Xem thanh toán', 'Payments', 'Quyền xem lịch sử thanh toán'),
('view_suppliers', 'Xem nhà cung cấp', 'Suppliers', 'Quyền xem danh sách NCC và vật tư'),
('view_materials', 'Xem kho vật tư', 'WMS', 'Quyền xem kho vật tư, đề nghị VT'),
('view_bids', 'Xem đấu thầu', 'Bidding', 'Quyền xem gói thầu và báo giá'),
('view_loans', 'Xem vay vốn', 'Loans', 'Quyền xem khoản vay')
ON CONFLICT (code) DO NOTHING;

-- 2. GÁN QUYỀN CHO TỪNG VAI TRÒ
-- ROLE01 (Admin) → Toàn quyền (đã auto-assign ở rbac_setup.sql, nhưng cần thêm permission mới)
INSERT INTO public.role_permissions (role_code, permission_code)
SELECT 'ROLE01', code FROM public.permissions
ON CONFLICT DO NOTHING;

-- ROLE02 (Giám đốc) → Xem tất cả
INSERT INTO public.role_permissions (role_code, permission_code) VALUES
('ROLE02', 'view_contracts'),
('ROLE02', 'view_payments'),
('ROLE02', 'view_suppliers'),
('ROLE02', 'view_materials'),
('ROLE02', 'view_bids'),
('ROLE02', 'view_loans')
ON CONFLICT DO NOTHING;

-- KETOAN (Kế toán nội bộ) → Xem tài chính, NCC, kho
INSERT INTO public.role_permissions (role_code, permission_code) VALUES
('KETOAN', 'view_dashboard'),
('KETOAN', 'view_payments'),
('KETOAN', 'view_suppliers'),
('KETOAN', 'view_materials'),
('KETOAN', 'view_contracts')
ON CONFLICT DO NOTHING;

-- NHANSU (Nhân sự)
INSERT INTO public.role_permissions (role_code, permission_code) VALUES
('NHANSU', 'view_dashboard'),
('NHANSU', 'manage_labor')
ON CONFLICT DO NOTHING;

-- DAUTHAU (Đấu thầu) → Quản lý gói thầu, NCC
INSERT INTO public.role_permissions (role_code, permission_code) VALUES
('DAUTHAU', 'view_dashboard'),
('DAUTHAU', 'view_bids'),
('DAUTHAU', 'view_suppliers'),
('DAUTHAU', 'view_contracts'),
('DAUTHAU', 'manage_labor')
ON CONFLICT DO NOTHING;

-- ROLE03 (BP Vật tư) → NCC, kho, PO
INSERT INTO public.role_permissions (role_code, permission_code) VALUES
('ROLE03', 'view_dashboard'),
('ROLE03', 'view_suppliers'),
('ROLE03', 'view_materials'),
('ROLE03', 'view_payments'),
('ROLE03', 'create_purchase_order')
ON CONFLICT DO NOTHING;

-- ROLE04 (BP Kiểm soát KL) → Xem kho, NCC, HĐ
INSERT INTO public.role_permissions (role_code, permission_code) VALUES
('ROLE04', 'view_dashboard'),
('ROLE04', 'view_contracts'),
('ROLE04', 'view_materials'),
('ROLE04', 'view_suppliers')
ON CONFLICT DO NOTHING;

-- ROLE05 (BP Thanh toán thầu phụ)
INSERT INTO public.role_permissions (role_code, permission_code) VALUES
('ROLE05', 'view_dashboard'),
('ROLE05', 'view_payments'),
('ROLE05', 'view_suppliers'),
('ROLE05', 'manage_payments')
ON CONFLICT DO NOTHING;

-- ROLE06 (BP Theo dõi HĐ) → HĐ, TT, NCC
INSERT INTO public.role_permissions (role_code, permission_code) VALUES
('ROLE06', 'view_contracts'),
('ROLE06', 'view_payments'),
('ROLE06', 'view_suppliers')
ON CONFLICT DO NOTHING;

-- ROLE07 (Chỉ huy trưởng) → Kho, NCC, nhân công, thi công
INSERT INTO public.role_permissions (role_code, permission_code) VALUES
('ROLE07', 'view_dashboard'),
('ROLE07', 'view_materials'),
('ROLE07', 'view_suppliers'),
('ROLE07', 'manage_labor'),
('ROLE07', 'manage_inventory')
ON CONFLICT DO NOTHING;

-- ROLE08 (Kỹ sư các bộ môn) → Kho VT, tạo đề nghị
INSERT INTO public.role_permissions (role_code, permission_code) VALUES
('ROLE08', 'view_materials'),
('ROLE08', 'view_suppliers'),
('ROLE08', 'manage_inventory')
ON CONFLICT DO NOTHING;

-- ROLE09 (Kho dự án) → Kho, NCC
INSERT INTO public.role_permissions (role_code, permission_code) VALUES
('ROLE09', 'view_materials'),
('ROLE09', 'view_suppliers'),
('ROLE09', 'manage_inventory'),
('ROLE09', 'receive_goods')
ON CONFLICT DO NOTHING;

-- ROLE10 (Quản lý kho Tổng) → Kho, NCC
INSERT INTO public.role_permissions (role_code, permission_code) VALUES
('ROLE10', 'view_dashboard'),
('ROLE10', 'view_materials'),
('ROLE10', 'view_suppliers'),
('ROLE10', 'manage_inventory')
ON CONFLICT DO NOTHING;

-- ROLE11 (NV kho Tổng) → Kho
INSERT INTO public.role_permissions (role_code, permission_code) VALUES
('ROLE11', 'view_materials'),
('ROLE11', 'manage_inventory')
ON CONFLICT DO NOTHING;
