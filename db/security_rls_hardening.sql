-- ============================================================
--  VÁ BẢO MẬT RLS — GIAI ĐOẠN 1: chặn LEO QUYỀN ADMIN (review C1)
--  Vấn đề: hầu hết bảng dùng policy FOR ALL USING (true) -> user quyền thấp gọi
--  thẳng REST bằng anon key có thể tự cấp vai trò/quyền admin.
--  File này khoá CÁC BẢNG PHÂN QUYỀN (crown jewels): user_roles, profiles,
--  role_permissions, permissions, roles. Các bảng nghiệp vụ khác khoá ở giai đoạn 2.
--
--  CÁCH CHẠY: Supabase -> SQL Editor -> dán toàn bộ -> Run.
--  Nếu có sự cố, có phần ROLLBACK ở cuối (mở lại tạm thời).
-- ============================================================

-- 0) Helper: user hiện tại có quyền p_code không (đọc user_roles + role_permissions,
--    admin ROLE01/ADMIN bypass). SECURITY DEFINER để chính policy đọc được bảng.
create or replace function public.current_user_has_perm(p_code text)
returns boolean
language sql stable security definer set search_path = public as $$
    select exists (
        select 1 from public.user_roles ur
          join public.role_permissions rp on rp.role_code = ur.role_code
         where ur.user_id = auth.uid() and rp.permission_code = p_code
    ) or exists (
        select 1 from public.user_roles ur
         where ur.user_id = auth.uid() and ur.role_code in ('ROLE01', 'ADMIN')
    ) or exists (
        select 1 from public.profiles pr
         where pr.id = auth.uid() and pr.role_code in ('ROLE01', 'ADMIN')
    );
$$;
grant execute on function public.current_user_has_perm(text) to authenticated;

-- Hàm tiện ích: xoá SẠCH mọi policy đang có trên 1 bảng (để bỏ policy "USING (true)" cũ
-- dù không biết tên). RLS policy là phép OR -> còn 1 policy mở là vẫn thủng.
create or replace function public._drop_all_policies(p_table text)
returns void language plpgsql as $$
declare p record;
begin
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = p_table loop
        execute format('drop policy %I on public.%I', p.policyname, p_table);
    end loop;
end $$;

-- 1) user_roles — CỬA LEO QUYỀN CHÍNH (get_user_permissions đọc bảng này)
select public._drop_all_policies('user_roles');
alter table public.user_roles enable row level security;
create policy ur_select on public.user_roles for select to authenticated using (true);
create policy ur_write  on public.user_roles for all    to authenticated
    using (public.current_user_has_perm('manage_users'))
    with check (public.current_user_has_perm('manage_users'));

-- 2) role_permissions
select public._drop_all_policies('role_permissions');
alter table public.role_permissions enable row level security;
create policy rp_select on public.role_permissions for select to authenticated using (true);
create policy rp_write  on public.role_permissions for all    to authenticated
    using (public.current_user_has_perm('manage_users'))
    with check (public.current_user_has_perm('manage_users'));

-- 3) permissions
select public._drop_all_policies('permissions');
alter table public.permissions enable row level security;
create policy perm_select on public.permissions for select to authenticated using (true);
create policy perm_write  on public.permissions for all    to authenticated
    using (public.current_user_has_perm('manage_users'))
    with check (public.current_user_has_perm('manage_users'));

-- 4) roles
select public._drop_all_policies('roles');
alter table public.roles enable row level security;
create policy roles_select on public.roles for select to authenticated using (true);
create policy roles_write  on public.roles for all    to authenticated
    using (public.current_user_has_perm('manage_users'))
    with check (public.current_user_has_perm('manage_users'));

-- 5) profiles — SELECT mở; user chỉ sửa hàng CỦA MÌNH; đổi role_code/status phải có manage_users
select public._drop_all_policies('profiles');
alter table public.profiles enable row level security;
create policy pf_select on public.profiles for select to authenticated using (true);
create policy pf_insert on public.profiles for insert to authenticated
    with check (public.current_user_has_perm('manage_users'));
create policy pf_update on public.profiles for update to authenticated
    using (auth.uid() = id or public.current_user_has_perm('manage_users'))
    with check (auth.uid() = id or public.current_user_has_perm('manage_users'));
create policy pf_delete on public.profiles for delete to authenticated
    using (public.current_user_has_perm('manage_users'));

-- Trigger chặn user thường tự đổi role_code/status của chính mình (policy update cho sửa hàng mình)
create or replace function public.guard_profile_privilege()
returns trigger language plpgsql security definer set search_path = public as $$
begin
    if not public.current_user_has_perm('manage_users') then
        if new.role_code is distinct from old.role_code or new.status is distinct from old.status then
            raise exception 'Không có quyền thay đổi vai trò/trạng thái tài khoản';
        end if;
    end if;
    return new;
end $$;
drop trigger if exists trg_guard_profile_privilege on public.profiles;
create trigger trg_guard_profile_privilege before update on public.profiles
    for each row execute function public.guard_profile_privilege();

-- ============================================================
-- KIỂM TRA (chạy khi đăng nhập bằng 1 user quyền thấp qua app / REST):
--   update profiles set role_code='ROLE01' where id=auth.uid();  -> PHẢI bị chặn
--   insert into user_roles(user_id, role_code) values (auth.uid(),'ROLE01'); -> PHẢI bị chặn
-- Admin (ROLE01) vẫn thao tác được ở màn Người dùng / Phân quyền.
--
-- ROLLBACK KHẨN CẤP (nếu khoá nhầm, mở lại tạm — CHỈ dùng khi cần gấp):
--   select public._drop_all_policies('profiles');
--   create policy tmp_open on public.profiles for all using (true);
--   (tương tự cho user_roles/role_permissions nếu cần)
-- ============================================================
