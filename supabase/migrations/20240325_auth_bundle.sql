-- Hàm RPC gộp để lấy cả Profile và Permissions trong 1 nốt nhạc
CREATE OR REPLACE FUNCTION get_user_auth_bundle(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
    v_profile JSON;
    v_permissions TEXT[];
BEGIN
    -- 1. Lấy Profile
    SELECT json_build_object(
        'id', p.id,
        'full_name', p.full_name,
        'role_code', p.role_code,
        'status', p.status,
        'role_name', r.name
    ) INTO v_profile
    FROM profiles p
    LEFT JOIN roles r ON p.role_code = r.code
    WHERE p.id = p_user_id;

    -- 2. Lấy Permissions
    SELECT ARRAY_AGG(permission_code) INTO v_permissions
    FROM user_permissions
    WHERE user_id = p_user_id;

    -- Trả về gói dữ liệu
    RETURN json_build_object(
        'profile', v_profile,
        'permissions', COALESCE(v_permissions, ARRAY[]::TEXT[])
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
