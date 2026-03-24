-- --------------------------------------------------------------------------------------
-- MIGRATION: Fix get_user_permissions RPC Return Type Mismatch
-- Description: The get_user_permissions RPC was returning TEXT, but the underlying 
-- permission_code in role_permissions table was defined as VARCHAR(50). 
-- This caused a PostgREST error (42804) which resulted in null permissions 
-- being returned to the frontend, breaking the RBAC sidebar. 
-- This script safely recasts the return column to TEXT to match the function signature.
-- --------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_user_permissions(p_user_id UUID)
RETURNS TABLE (permission_code TEXT) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT rp.permission_code::TEXT
    FROM public.profiles p
    JOIN public.role_permissions rp ON p.role_code = rp.role_code
    WHERE p.id = p_user_id;
END;
$$;
