-- ==============================================================================
-- MIGRATION SCRIPT: ADMIN CREATE USER RPC
-- Description: Creates a secure RPC function so Administrators can create
--              new user accounts directly from the frontend without the Admin API.
-- ==============================================================================

-- 0. Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Create the RPC function with SECURITY DEFINER
-- This allows the frontend (authenticated user) to perform actions as the database owner (postgres),
-- which is necessary to insert into the protected auth.users schema.

CREATE OR REPLACE FUNCTION public.admin_create_user(
    p_email TEXT,
    p_password TEXT,
    p_full_name TEXT,
    p_role_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE
    new_user_id UUID;
    encrypted_pw TEXT;
    is_admin BOOLEAN;
    result JSONB;
BEGIN
    -- Security Check: Ensure the caller actually has permission to manage users.
    -- First check: does user have 'manage_users' permission?
    SELECT EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.role_permissions rp ON p.role_code = rp.role_code
        WHERE p.id = auth.uid() AND rp.permission_code = 'manage_users'
    ) INTO is_admin;

    -- If no RLS/Permissions are strictly enforced yet during setup, we can bypass this check 
    -- if you are the FIRST user. For safety, we allow it if the caller is an ADMIN role.
    IF NOT is_admin THEN
        -- Fallback check: is caller an ADMIN role directly? (ROLE01 is Admin)
        SELECT EXISTS (
            SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role_code IN ('ROLE01')
        ) INTO is_admin;
        
        -- If still not admin, check if there are ANY users in profiles. 
        -- If 0 users, allow the first one to be created as admin (bootstrap).
        IF NOT is_admin THEN
            IF (SELECT COUNT(*) FROM public.profiles) = 0 THEN
                is_admin := TRUE;
            END IF;
        END IF;

        IF NOT is_admin THEN
            RETURN jsonb_build_object('success', false, 'error', 'Bạn không có quyền tạo người dùng.');
        END IF;
    END IF;

    -- Check if email already exists
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = p_email) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Email này đã được sử dụng trong hệ thống.');
    END IF;

    -- Generate new user UUID
    new_user_id := gen_random_uuid();
    
    -- Cryptographically hash the password using Supabase's exact bf algorithm requirements
    encrypted_pw := crypt(p_password, gen_salt('bf'));

    -- Insert into auth.users
    -- Note: GoTrue requires several token columns to be empty strings rather than NULL
    -- otherwise it throws "Database error querying schema" during login/session refresh.
    INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password, 
        email_confirmed_at, created_at, updated_at, 
        raw_app_meta_data, raw_user_meta_data, 
        is_super_admin, is_sso_user,
        confirmation_token, recovery_token, email_change_token_new, email_change
    )
    VALUES (
        '00000000-0000-0000-0000-000000000000', new_user_id, 'authenticated', 'authenticated', p_email, encrypted_pw, 
        now(), now(), now(), 
        '{"provider":"email","providers":["email"]}', 
        jsonb_build_object('full_name', p_full_name), 
        false, false,
        '', '', '', ''
    );

    -- Insert into auth.identities to ensure GoTrue login works smoothly (email provider)
    INSERT INTO auth.identities (
        id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    )
    VALUES (
        gen_random_uuid(), new_user_id, format('{"sub":"%s","email":"%s"}', new_user_id::text, p_email)::jsonb, 'email', new_user_id::text, now(), now(), now()
    );

    -- Ensure a profile exists for this new user in public schema
    -- (Supabase might have a trigger doing this. Using ON CONFLICT handles both cases securely)
    INSERT INTO public.profiles (id, email, full_name, role_code, status)
    VALUES (new_user_id, p_email, p_full_name, p_role_code, 'Hoạt động')
    ON CONFLICT (id) DO UPDATE 
    SET full_name = EXCLUDED.full_name, role_code = EXCLUDED.role_code, status = 'Hoạt động';

    RETURN jsonb_build_object('success', true, 'user_id', new_user_id);
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.admin_create_user(TEXT, TEXT, TEXT, TEXT) TO authenticated;
