-- ============================================================
--  FIX bổ sung: IDOR get_user_permissions còn lọt khi gọi bằng anon
--  Lý do: auth.uid() = NULL (anon) khiến `p_user_id <> auth.uid()` = NULL (không TRUE)
--  -> guard không kích hoạt; và function còn PUBLIC execute mặc định.
--  Sửa: dùng `is distinct from` (xử lý NULL đúng) + revoke public.
--  Chạy trong Supabase SQL Editor (sau security_rls_phase2.sql).
-- ============================================================

create or replace function public.get_user_permissions(p_user_id uuid)
returns table (permission_code text) language plpgsql security definer set search_path = public as $$
begin
    -- is distinct from: coi NULL (anon) là "khác" -> chặn; user tự xem quyền mình thì cho qua.
    if p_user_id is distinct from auth.uid() and not public.current_user_has_perm('manage_users') then
        raise exception 'forbidden';
    end if;
    return query
        select distinct rp.permission_code::text
        from public.user_roles ur join public.role_permissions rp on ur.role_code = rp.role_code
        where ur.user_id = p_user_id;
end $$;

revoke execute on function public.get_user_permissions(uuid) from public;
grant  execute on function public.get_user_permissions(uuid) to authenticated;

-- Dọn: các primitive nguy hiểm không nên để PUBLIC gọi được
revoke execute on function public._drop_all_policies(text) from public;
revoke execute on function public._apply_rls(text, text[]) from public;

-- KIỂM TRA lại (anon): rpc('get_user_permissions',{p_user_id:'<uid bất kỳ>'}) PHẢI trả lỗi/permission denied.
