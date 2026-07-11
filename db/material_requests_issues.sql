-- ============================================================
--  LUỒNG KHO VẬT TƯ (đơn giản theo dự án):
--   Nhập (từ supplier_purchases) → Đề nghị vật tư (tổ đội/nhà thầu) → Xuất theo phiếu → In.
--  Bảng này: material_requests (đề nghị) + items; và mở rộng material_issues thành PHIẾU XUẤT.
--  Chạy 1 lần trong Supabase SQL Editor (sau db/material_issues.sql).
-- ============================================================

-- 1) ĐỀ NGHỊ VẬT TƯ (kho tự nhập hộ tổ đội/nhà thầu, không cần duyệt)
create table if not exists public.material_requests (
    id               uuid primary key default gen_random_uuid(),
    code             text,
    project_id       uuid references public.projects(id) on delete cascade,
    subcontractor_id uuid,                 -- id nhà thầu (không FK cứng vì có 2 nguồn danh mục)
    subcontractor_name text,
    request_date     date not null default current_date,
    status           text not null default 'OPEN',   -- OPEN (còn phải xuất) / DONE (đã xuất đủ)
    notes            text,
    created_by       uuid,
    created_at       timestamptz default now()
);
create table if not exists public.material_request_items (
    id            uuid primary key default gen_random_uuid(),
    request_id    uuid references public.material_requests(id) on delete cascade,
    material_key  text,                     -- khoá khớp tồn (tên chuẩn hoá)
    material_id   uuid references public.materials(id) on delete set null,
    product_name  text not null,
    unit          text,
    qty_requested numeric not null default 0,
    qty_issued    numeric not null default 0
);
create index if not exists idx_material_requests_scope on public.material_requests (project_id, status);
create index if not exists idx_material_request_items_req on public.material_request_items (request_id);

-- 2) Mở rộng material_issues thành PHIẾU XUẤT (nhiều dòng cùng slip_code = 1 phiếu, 1 nhà thầu)
alter table public.material_issues add column if not exists slip_code text;
alter table public.material_issues add column if not exists subcontractor_id uuid;
alter table public.material_issues add column if not exists subcontractor_name text;
alter table public.material_issues add column if not exists request_id uuid;
alter table public.material_issues add column if not exists request_item_id uuid;
create index if not exists idx_material_issues_slip on public.material_issues (slip_code);

-- 3) RLS (đọc mở authenticated; ghi cần quyền kho — helper từ security_rls_phase2.sql)
do $$
declare has_perm boolean;
begin
    select exists(select 1 from pg_proc where proname = 'current_user_has_perm') into has_perm;
    -- material_requests
    execute 'alter table public.material_requests enable row level security';
    begin execute 'create policy mr_sel on public.material_requests for select to authenticated using (true)'; exception when duplicate_object then null; end;
    if has_perm then
        begin execute $p$create policy mr_wr on public.material_requests for all to authenticated
            using (public.current_user_has_perm('export_inventory') or public.current_user_has_perm('manage_materials') or public.current_user_has_perm('manage_materials_tracking'))
            with check (public.current_user_has_perm('export_inventory') or public.current_user_has_perm('manage_materials') or public.current_user_has_perm('manage_materials_tracking'))$p$; exception when duplicate_object then null; end;
    else
        begin execute 'create policy mr_wr on public.material_requests for all to authenticated using (true) with check (true)'; exception when duplicate_object then null; end;
    end if;
    -- material_request_items
    execute 'alter table public.material_request_items enable row level security';
    begin execute 'create policy mri_sel on public.material_request_items for select to authenticated using (true)'; exception when duplicate_object then null; end;
    if has_perm then
        begin execute $p$create policy mri_wr on public.material_request_items for all to authenticated
            using (public.current_user_has_perm('export_inventory') or public.current_user_has_perm('manage_materials') or public.current_user_has_perm('manage_materials_tracking'))
            with check (public.current_user_has_perm('export_inventory') or public.current_user_has_perm('manage_materials') or public.current_user_has_perm('manage_materials_tracking'))$p$; exception when duplicate_object then null; end;
    else
        begin execute 'create policy mri_wr on public.material_request_items for all to authenticated using (true) with check (true)'; exception when duplicate_object then null; end;
    end if;
end $$;
