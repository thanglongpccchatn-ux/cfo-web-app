-- ============================================================
--  XUẤT KHO đơn giản theo dự án (Kho vật tư = Nhập từ mua hàng − Xuất − Tồn)
--  Nhập kho = suy từ supplier_purchases (mua hàng đã nhập). Xuất kho = bảng này.
--  Tồn = Σ nhập − Σ xuất theo (dự án, vật tư). Khớp qua material_key.
--  Chạy 1 lần trong Supabase SQL Editor.
-- ============================================================

create table if not exists public.material_issues (
    id           uuid primary key default gen_random_uuid(),
    project_id   uuid references public.projects(id) on delete cascade,
    material_id  uuid references public.materials(id) on delete set null,
    material_key text,                       -- khoá gộp (material_id hoặc tên chuẩn hoá) để khớp tồn với nhập
    product_name text not null,
    unit         text,
    quantity     numeric not null default 0,
    unit_price   numeric not null default 0, -- đơn giá bình quân lúc xuất (để tính giá trị xuất)
    issue_date   date not null default current_date,
    notes        text,
    created_by   uuid,
    created_at   timestamptz default now()
);
create index if not exists idx_material_issues_scope on public.material_issues (project_id, material_key);

-- RLS: đọc mở cho authenticated; ghi cần quyền xuất kho / quản lý vật tư (helper từ security_rls_phase2.sql)
alter table public.material_issues enable row level security;
do $$ begin
    perform 1 from pg_proc where proname = 'current_user_has_perm';
    if found then
        execute $p$create policy mi_select on public.material_issues for select to authenticated using (true)$p$;
        execute $p$create policy mi_write on public.material_issues for all to authenticated
            using (public.current_user_has_perm('export_inventory') or public.current_user_has_perm('manage_materials') or public.current_user_has_perm('manage_materials_tracking'))
            with check (public.current_user_has_perm('export_inventory') or public.current_user_has_perm('manage_materials') or public.current_user_has_perm('manage_materials_tracking'))$p$;
    else
        -- chưa có helper -> tạm mở (chạy security_rls_phase2.sql sau để siết)
        execute $p$create policy mi_all on public.material_issues for all to authenticated using (true) with check (true)$p$;
    end if;
exception when duplicate_object then null; end $$;
