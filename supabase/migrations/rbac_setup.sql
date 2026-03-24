-- ==============================================================================
-- MIGRATION SCRIPT: RBAC SETUP (Role Based Access Control)
-- Description: Sets up the permissions table and assigns default permissions
--              to project roles.
-- ==============================================================================

-- 1. Create permissions table
CREATE TABLE IF NOT EXISTS public.permissions (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    module TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create role_permissions junction table
CREATE TABLE IF NOT EXISTS public.role_permissions (
    role_code TEXT REFERENCES public.roles(code) ON DELETE CASCADE,
    permission_code TEXT REFERENCES public.permissions(code) ON DELETE CASCADE,
    PRIMARY KEY (role_code, permission_code)
);

-- 3. Insert core permissions
INSERT INTO public.permissions (code, name, module, description) VALUES
('view_dashboard', 'Xem dashboard tổng quát', 'Dashboard', 'Quyền xem các chỉ số KPI cơ bản'),
('manage_users', 'Quản lý người dùng', 'Admin', 'Quyền tạo, sửa, hóa tài khoản nhân sự'),
('create_contract', 'Tạo hợp đồng mới', 'Contracts', 'Quyền khởi tạo dự án và hợp đồng gốc'),
('edit_contract', 'Sửa hợp đồng', 'Contracts', 'Quyền cập nhật thông tin hợp đồng'),
('delete_contract', 'Xóa hợp đồng', 'Contracts', 'Quyền xóa vĩnh viễn hợp đồng'),
('view_financials', 'Xem số liệu tài chính', 'Financials', 'Quyền xem dòng tiền, doanh thu, lợi nhuận'),
('manage_payments', 'Quản lý thu chi', 'Payments', 'Quyền nhập liệu thanh toán CĐT và Sateco'),
('manage_inventory', 'Quản lý kho', 'WMS', 'Quyền nhập/xuất vật tư'),
('manage_labor', 'Quản lý nhân công', 'Labor', 'Quyền quản lý tổ đội, thầu phụ')
ON CONFLICT (code) DO NOTHING;

-- 4. Assign permissions to roles (Default Setup)

-- ROLE01: Admin (Full Permissions)
INSERT INTO public.role_permissions (role_code, permission_code)
SELECT 'ROLE01', code FROM public.permissions
ON CONFLICT DO NOTHING;

-- ROLE02: Giám đốc (View only + Approved Financials)
INSERT INTO public.role_permissions (role_code, permission_code) VALUES
('ROLE02', 'view_dashboard'),
('ROLE02', 'view_financials')
ON CONFLICT DO NOTHING;

-- ROLE06: Bộ phận theo dõi hợp đồng (Contract + Payments)
INSERT INTO public.role_permissions (role_code, permission_code) VALUES
('ROLE06', 'view_dashboard'),
('ROLE06', 'create_contract'),
('ROLE06', 'edit_contract'),
('ROLE06', 'manage_payments')
ON CONFLICT DO NOTHING;

-- Bật RLS cho các bảng mới
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all public operations on permissions" ON public.permissions;
CREATE POLICY "Allow all public operations on permissions" ON public.permissions FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all public operations on role_permissions" ON public.role_permissions;
CREATE POLICY "Allow all public operations on role_permissions" ON public.role_permissions FOR ALL USING (true);

-- 5. Helper function to fetch permissions for a user
CREATE OR REPLACE FUNCTION public.get_user_permissions(p_user_id UUID)
RETURNS TABLE (permission_code TEXT) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT rp.permission_code
    FROM public.profiles p
    JOIN public.role_permissions rp ON p.role_code = rp.role_code
    WHERE p.id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_permissions(UUID) TO authenticated;
