-- ==============================================================================
-- MIGRATION: Multi-Role Users
-- Cho phép 1 người dùng có nhiều vai trò (role) cùng lúc
-- ==============================================================================

-- 1. Tạo bảng user_roles (junction table)
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role_code TEXT NOT NULL REFERENCES public.roles(code) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ DEFAULT now(),
    assigned_by UUID REFERENCES auth.users(id),
    UNIQUE(user_id, role_code)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role_code);

-- RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on user_roles" ON public.user_roles;
CREATE POLICY "Allow all operations on user_roles" ON public.user_roles
    FOR ALL USING (true);

-- 2. Migrate data: copy existing profiles.role_code vào user_roles
INSERT INTO public.user_roles (user_id, role_code)
SELECT id, role_code FROM public.profiles
WHERE role_code IS NOT NULL AND role_code != ''
ON CONFLICT (user_id, role_code) DO NOTHING;

-- 3. Update get_user_permissions() để aggregate từ TẤT CẢ roles
CREATE OR REPLACE FUNCTION public.get_user_permissions(p_user_id UUID)
RETURNS TABLE (permission_code TEXT) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT rp.permission_code
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON ur.role_code = rp.role_code
    WHERE ur.user_id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_permissions(UUID) TO authenticated;

COMMENT ON TABLE public.user_roles IS 'Junction table: 1 user = nhiều roles. Permissions = UNION từ tất cả roles.';
