-- ==============================================================================
-- MIGRATION: Admin Delete User RPC
-- Cho phép admin xóa user khỏi auth.users (cần SECURITY DEFINER)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.admin_delete_user(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE
    is_admin BOOLEAN;
BEGIN
    -- Security: chỉ ROLE01 hoặc có quyền manage_users
    SELECT EXISTS (
        SELECT 1 FROM public.profiles p
        LEFT JOIN public.role_permissions rp ON p.role_code = rp.role_code
        WHERE p.id = auth.uid() 
          AND (rp.permission_code = 'manage_users' OR p.role_code = 'ROLE01')
    ) INTO is_admin;

    IF NOT is_admin THEN
        RETURN jsonb_build_object('success', false, 'error', 'Không có quyền xóa người dùng.');
    END IF;

    -- Không cho tự xóa mình
    IF p_user_id = auth.uid() THEN
        RETURN jsonb_build_object('success', false, 'error', 'Không thể tự xóa chính mình.');
    END IF;

    -- Xóa auth.identities
    DELETE FROM auth.identities WHERE user_id = p_user_id;
    -- Xóa auth.users
    DELETE FROM auth.users WHERE id = p_user_id;

    RETURN jsonb_build_object('success', true);

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_user(UUID) TO authenticated;
