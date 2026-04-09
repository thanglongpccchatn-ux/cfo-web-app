-- ==============================================================================
-- MIGRATION: Bổ sung Permissions cho module Kế Toán (TT200)
-- Mô tả: Thêm các quyền kế toán vào bảng permissions và gán cho vai trò phù hợp
-- Ngày: 2026-04-09
-- ==============================================================================

-- 1. TẠO CÁC PERMISSION MỚI CHO MODULE KẾ TOÁN
INSERT INTO public.permissions (code, name, module, description) VALUES
-- Quyền xem chung
('view_accounting',       'Xem Kế toán',                'Kế toán', 'Quyền xem các phân hệ kế toán: Hệ thống TK, Sổ Cái, Báo cáo TC'),
-- Quyền quản trị hệ thống TK
('manage_accounting',     'Quản lý Hệ thống TK',       'Kế toán', 'Quyền thêm/sửa/xóa tài khoản kế toán trong Hệ thống TK (CoA)'),
-- Quyền quản lý kỳ kế toán
('manage_fiscal_periods', 'Quản lý Kỳ kế toán',        'Kế toán', 'Quyền mở/đóng/khóa kỳ kế toán theo tháng và năm tài chính'),
-- Quyền tạo bút toán
('create_journal',        'Tạo & Sửa Bút toán',        'Kế toán', 'Quyền tạo bút toán kép mới, sửa bút toán nháp, và gửi duyệt'),
-- Quyền duyệt bút toán
('approve_journal',       'Duyệt Bút toán',            'Kế toán', 'Quyền duyệt (post) hoặc từ chối bút toán kế toán'),
-- Quyền xem báo cáo tài chính
('view_financial_reports', 'Xem Báo cáo Tài chính',    'Kế toán', 'Quyền xem CĐPS, CĐKT (B01-DN), KQKD (B02-DN), LCTT (B03-DN)'),
-- Quyền quản lý HĐĐT & Thuế  
('manage_einvoice',       'Quản lý HĐĐT & Thuế',       'Kế toán', 'Quyền nhập/đối soát hóa đơn điện tử theo NĐ123 và quản lý thuế'),
-- Quyền quản lý ngân sách
('manage_budget',         'Quản lý Ngân sách',         'Kế toán', 'Quyền tạo/sửa kế hoạch ngân sách và so sánh thực tế vs kế hoạch'),
-- Quyền quản lý bút toán định kỳ
('manage_recurring',      'Quản lý Bút toán định kỳ',  'Kế toán', 'Quyền tạo/sửa/xóa mẫu bút toán tự động hạch toán định kỳ')
ON CONFLICT (code) DO NOTHING;

-- 2. GÁN QUYỀN CHO CÁC VAI TRÒ

-- ROLE01 (Admin) → Toàn quyền kế toán (auto-assign tất cả permissions)
INSERT INTO public.role_permissions (role_code, permission_code)
SELECT 'ROLE01', code FROM public.permissions
WHERE module = 'Kế toán'
ON CONFLICT DO NOTHING;

-- KETOAN (Kế toán nội bộ) → Toàn quyền kế toán (core user của module này)
INSERT INTO public.role_permissions (role_code, permission_code)
SELECT 'KETOAN', code FROM public.permissions
WHERE module = 'Kế toán'
ON CONFLICT DO NOTHING;

-- ROLE02 (Giám đốc) → Chỉ xem
INSERT INTO public.role_permissions (role_code, permission_code) VALUES
('ROLE02', 'view_accounting'),
('ROLE02', 'view_financial_reports'),
('ROLE02', 'approve_journal')
ON CONFLICT DO NOTHING;

-- ROLE06 (BP Theo dõi HĐ) → Xem kế toán cơ bản
INSERT INTO public.role_permissions (role_code, permission_code) VALUES
('ROLE06', 'view_accounting')
ON CONFLICT DO NOTHING;
