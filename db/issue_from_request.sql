-- ============================================================
--  RPC XUẤT KHO TỪ ĐỀ NGHỊ (atomic) + CHẶN TỒN ÂM (over-issue) + kiểm quyền/công trình.
--  Chạy 1 lần trong Supabase SQL Editor (sau material_requests_issues.sql).
--  Bản này thay thế bản cũ (create or replace) — chạy đè an toàn.
-- ============================================================

-- 0) Hàm chuẩn hóa tên vật tư (khớp norm() phía JS: bỏ dấu, đ->d, thường, gộp khoảng trắng).
--    IMMUTABLE để dùng được cho functional index.
create extension if not exists unaccent;
create or replace function public.norm_vt(txt text)
returns text language sql immutable as $$
    select lower(regexp_replace(trim(unaccent(translate(coalesce(txt, ''), 'đĐ', 'dD'))), '\s+', ' ', 'g'));
$$;

-- Index tăng tốc tính tồn theo (công trình, tên chuẩn hóa).
create index if not exists idx_sp_proj_normkey on public.supplier_purchases (project_id, public.norm_vt(product_name));
create index if not exists idx_mi_proj_normkey on public.material_issues   (project_id, public.norm_vt(product_name));

create or replace function public.issue_from_request(
    p_request_id       uuid,
    p_slip_code        text,
    p_subcontractor_id uuid,
    p_subcontractor_name text,
    p_issue_date       date,
    p_notes            text,
    p_lines            jsonb,          -- [{ request_item_id, material_id, material_key, product_name, unit, quantity, unit_price }]
    p_allow_over       boolean default false   -- true = người dùng đã xác nhận xuất quá tồn
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_project uuid;
    r_line    record;
    v_ton     numeric;
begin
    -- Quyền module (admin luôn qua). Security definer để insert không bị RLS chặn.
    if not (public.current_user_has_perm('export_inventory') or public.current_user_has_perm('manage_materials') or public.current_user_has_perm('manage_materials_tracking')) then
        raise exception 'forbidden';
    end if;

    select project_id into v_project from public.material_requests where id = p_request_id;
    if v_project is null then
        raise exception 'request not found';
    end if;

    -- C2: chỉ cho xuất cho CÔNG TRÌNH được giao (trừ admin/xem-tất-cả).
    if not (
        public.current_user_has_perm('view_all_inventory')
        or exists (select 1 from public.staff_assignments sa where sa.user_id = auth.uid() and sa.project_id = v_project and sa.end_date is null)
        or exists (select 1 from public.profiles p where p.id = auth.uid() and p.current_project_id = v_project)
    ) then
        raise exception 'forbidden: khong duoc giao cong trinh nay';
    end if;

    -- Chống giả mạo: mọi request_item_id phải THUỘC đề nghị p_request_id.
    if exists (
        select 1 from jsonb_array_elements(p_lines) l
        where nullif(l->>'request_item_id','') is not null
          and (l->>'request_item_id')::uuid not in (select id from public.material_request_items where request_id = p_request_id)
    ) then
        raise exception 'invalid request_item_id';
    end if;

    -- Serialize theo công trình -> chống 2 người xuất đồng thời làm tồn âm.
    perform pg_advisory_xact_lock(hashtext(v_project::text));

    -- CHẶN TỒN ÂM: mỗi dòng, tồn = Σ nhập − Σ đã xuất (khớp theo tên chuẩn hóa, cùng công trình).
    if not coalesce(p_allow_over, false) then
        for r_line in
            select public.norm_vt(l->>'product_name') as key,
                   coalesce(l->>'product_name','') as name,
                   sum((l->>'quantity')::numeric) as qty
            from jsonb_array_elements(p_lines) l
            where (l->>'quantity')::numeric > 0
            group by 1, 2
        loop
            v_ton := coalesce((select sum(quantity) from public.supplier_purchases
                               where project_id = v_project and public.norm_vt(product_name) = r_line.key), 0)
                   - coalesce((select sum(quantity) from public.material_issues
                               where project_id = v_project and public.norm_vt(product_name) = r_line.key), 0);
            if r_line.qty > v_ton then
                raise exception 'Xuat qua ton: "%" xuat % > ton %', r_line.name, r_line.qty, v_ton;
            end if;
        end loop;
    end if;

    -- 1) Ghi các dòng phiếu xuất (chỉ dòng SL > 0)
    -- Đơn giá lưu = giá BQ TỰ TÍNH ở server (không tin giá client -> vá H2).
    insert into public.material_issues
        (project_id, material_id, material_key, product_name, unit, quantity, unit_price, issue_date, notes,
         created_by, slip_code, subcontractor_id, subcontractor_name, request_id, request_item_id)
    select v_project, nullif(l->>'material_id','')::uuid, l->>'material_key', l->>'product_name', l->>'unit',
           (l->>'quantity')::numeric,
           coalesce((select sum(sp.quantity * sp.unit_price) / nullif(sum(sp.quantity), 0)
                     from public.supplier_purchases sp
                     where sp.project_id = v_project and public.norm_vt(sp.product_name) = public.norm_vt(l->>'product_name')), 0),
           p_issue_date, p_notes,
           auth.uid(), p_slip_code, p_subcontractor_id, p_subcontractor_name, p_request_id,
           nullif(l->>'request_item_id','')::uuid
    from jsonb_array_elements(p_lines) l
    where (l->>'quantity')::numeric > 0;

    -- 2) Cộng SL đã xuất vào từng dòng đề nghị
    update public.material_request_items mri
    set qty_issued = qty_issued + agg.q
    from (
        select (l->>'request_item_id')::uuid as rid, sum((l->>'quantity')::numeric) as q
        from jsonb_array_elements(p_lines) l
        where (l->>'quantity')::numeric > 0 and nullif(l->>'request_item_id','') is not null
        group by 1
    ) agg
    where mri.id = agg.rid;

    -- 3) Đánh dấu đề nghị DONE nếu mọi dòng đã xuất đủ
    update public.material_requests
    set status = case when not exists (
            select 1 from public.material_request_items
            where request_id = p_request_id and qty_issued < qty_requested
        ) then 'DONE' else 'OPEN' end
    where id = p_request_id;
end $$;

grant execute on function public.issue_from_request(uuid, text, uuid, text, date, text, jsonb, boolean) to authenticated;

-- ============================================================
--  RPC XUẤT LẺ (không theo đề nghị) — dùng cho nút "Xuất" ở màn Tồn kho.
--  Cùng bộ kiểm: quyền + công trình được giao + chặn tồn âm + advisory lock.
-- ============================================================
create or replace function public.issue_adhoc(
    p_project_id   uuid,
    p_material_id  uuid,
    p_material_key text,
    p_product_name text,
    p_unit         text,
    p_quantity     numeric,
    p_unit_price   numeric,
    p_issue_date   date,
    p_notes        text,
    p_slip_code    text,
    p_subcontractor_name text default null,
    p_allow_over   boolean default false
) returns void
language plpgsql security definer set search_path = public
as $$
declare v_ton numeric; v_key text; v_price numeric;
begin
    if not (public.current_user_has_perm('export_inventory') or public.current_user_has_perm('manage_materials') or public.current_user_has_perm('manage_materials_tracking')) then
        raise exception 'forbidden';
    end if;
    if not (
        public.current_user_has_perm('view_all_inventory')
        or exists (select 1 from public.staff_assignments sa where sa.user_id = auth.uid() and sa.project_id = p_project_id and sa.end_date is null)
        or exists (select 1 from public.profiles p where p.id = auth.uid() and p.current_project_id = p_project_id)
    ) then
        raise exception 'forbidden: khong duoc giao cong trinh nay';
    end if;
    if not (p_quantity > 0) then raise exception 'so luong phai > 0'; end if;

    perform pg_advisory_xact_lock(hashtext(p_project_id::text));
    v_key := public.norm_vt(p_product_name);

    if not coalesce(p_allow_over, false) then
        v_ton := coalesce((select sum(quantity) from public.supplier_purchases
                           where project_id = p_project_id and public.norm_vt(product_name) = v_key), 0)
               - coalesce((select sum(quantity) from public.material_issues
                           where project_id = p_project_id and public.norm_vt(product_name) = v_key), 0);
        if p_quantity > v_ton then
            raise exception 'Xuat qua ton: xuat % > ton %', p_quantity, v_ton;
        end if;
    end if;

    -- Đơn giá BQ tự tính ở server (bỏ tin giá client -> vá H2).
    v_price := coalesce((select sum(sp.quantity * sp.unit_price) / nullif(sum(sp.quantity), 0)
                         from public.supplier_purchases sp
                         where sp.project_id = p_project_id and public.norm_vt(sp.product_name) = v_key), 0);

    insert into public.material_issues
        (project_id, material_id, material_key, product_name, unit, quantity, unit_price,
         issue_date, notes, created_by, slip_code, subcontractor_name)
    values (p_project_id, nullif(p_material_id::text,'')::uuid, p_material_key, p_product_name, p_unit,
            p_quantity, v_price, p_issue_date, p_notes, auth.uid(), p_slip_code, p_subcontractor_name);
end $$;

grant execute on function public.issue_adhoc(uuid, uuid, text, text, text, numeric, numeric, date, text, text, text, boolean) to authenticated;
