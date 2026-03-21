-- =========================================================================================
-- MIGRATION SCRIPT: ROLE-BASED ACCESS CONTROL (RBAC) & PERMISSIONS SETUP
-- =========================================================================================

-- 1. Create Permissions Table
CREATE TABLE IF NOT EXISTS public.permissions (
    code VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    module VARCHAR(50) NOT NULL, -- e.g., 'INVENTORY', 'CONTRACTS', 'SYSTEM'
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create Role_Permissions Mapping Table
CREATE TABLE IF NOT EXISTS public.role_permissions (
    role_code VARCHAR(20) REFERENCES public.roles(code) ON DELETE CASCADE,
    permission_code VARCHAR(50) REFERENCES public.permissions(code) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (role_code, permission_code)
);

-- 3. Initial Seed for Permissions
INSERT INTO public.permissions (code, name, module, description) VALUES
-- System / App
('view_dashboard', 'Truy cập Dashboard', 'SYSTEM', 'Cho phép xem màn hình tổng quan dự án'),
('manage_users', 'Quản lý người dùng', 'SYSTEM', 'Thêm, sửa, khóa tài khoản người dùng'),
('manage_roles', 'Quản lý phân quyền', 'SYSTEM', 'Thiết lập vai trò và phân quyền hệ thống'),

-- Contracts & Planning
('view_contracts', 'Xem Hợp đồng', 'CONTRACTS', 'Xem danh sách và chi tiết hợp đồng'),
('edit_contracts', 'Tạo/Sửa Hợp đồng', 'CONTRACTS', 'Tạo hợp đồng con, phụ lục, cập nhật thông tin'),
('view_planning', 'Xem Kế hoạch thanh toán', 'PLANNING', 'Xem Hub Kế hoạch dòng tiền'),
('edit_planning', 'Cập nhật Kế hoạch', 'PLANNING', 'Thiết lập kế hoạch dòng tiền, ngày gạch nợ'),

-- Payments
('view_payments', 'Xem Theo dõi Thanh toán', 'PAYMENTS', 'Xem hồ sơ GTTT, tạm ứng, UNC'),
('edit_payments', 'Khai báo Thanh toán', 'PAYMENTS', 'Tạo hồ sơ thanh toán mới, tạo UNC'),
('approve_payments', 'Duyệt Thanh toán', 'PAYMENTS', 'Quyền duyệt các khoản chi/thu nội bộ'),

-- Inventory
('view_inventory', 'Xem Kho vật tư', 'INVENTORY', 'Xem tồn kho, tìm kiếm danh mục vật tư'),
('edit_inventory', 'Nhập/Xuất kho', 'INVENTORY', 'Tạo phiếu Nhập/Xuất kho vật tư')
ON CONFLICT (code) DO NOTHING;

-- 4. Assign Default Permissions to System Admin (Assuming 'ADMIN' or 'ROLE01' exists)
-- This ensures the Admin role does not get locked out. We will map to all permissions.
DO $$
DECLARE
    admin_role_code VARCHAR;
BEGIN
    -- Find the main Admin role (usually code 'ADMIN' or the first created role)
    SELECT code INTO admin_role_code FROM public.roles ORDER BY code ASC LIMIT 1;
    
    IF admin_role_code IS NOT NULL THEN
        INSERT INTO public.role_permissions (role_code, permission_code)
        SELECT admin_role_code, code FROM public.permissions
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- 5. Create RPC Function to efficiently get user permissions by user_id
-- We use SECURITY DEFINER so it can query role_permissions even if RLS is strict
CREATE OR REPLACE FUNCTION public.get_user_permissions(p_user_id UUID)
RETURNS TABLE (permission_code VARCHAR)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT rp.permission_code
    FROM public.profiles p
    JOIN public.role_permissions rp ON p.role_code = rp.role_code
    WHERE p.id = p_user_id;
END;
$$;
