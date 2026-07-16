-- ============================================================
--  RPC XUẤT KHO TỪ ĐỀ NGHỊ (atomic): ghi phiếu xuất (nhiều dòng) + cập nhật SL đã xuất
--  của đề nghị + đánh dấu đề nghị DONE nếu đã xuất đủ — trong 1 transaction.
--  Chạy 1 lần trong Supabase SQL Editor (sau material_requests_issues.sql).
-- ============================================================

create or replace function public.issue_from_request(
    p_request_id       uuid,
    p_slip_code        text,
    p_subcontractor_id uuid,
    p_subcontractor_name text,
    p_issue_date       date,
    p_notes            text,
    p_lines            jsonb   -- [{ request_item_id, material_id, material_key, product_name, unit, quantity, unit_price }]
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_project uuid;
begin
    -- Tự kiểm tra quyền trong hàm; chạy security definer để insert không bị RLS chặn.
    if not (public.current_user_has_perm('export_inventory') or public.current_user_has_perm('manage_materials') or public.current_user_has_perm('manage_materials_tracking')) then
        raise exception 'forbidden';
    end if;

    select project_id into v_project from public.material_requests where id = p_request_id;
    if v_project is null then
        raise exception 'request not found';
    end if;

    -- C2: chỉ cho xuất cho CÔNG TRÌNH mà người dùng được giao (trừ admin/xem-tất-cả).
    if not (
        public.current_user_has_perm('view_all_inventory')
        or exists (select 1 from public.staff_assignments sa
                   where sa.user_id = auth.uid() and sa.project_id = v_project and sa.end_date is null)
        or exists (select 1 from public.profiles p
                   where p.id = auth.uid() and p.current_project_id = v_project)
    ) then
        raise exception 'forbidden: khong duoc giao cong trinh nay';
    end if;

    -- Chặn giả mạo: mọi request_item_id trong p_lines phải THUỘC đề nghị p_request_id.
    if exists (
        select 1 from jsonb_array_elements(p_lines) l
        where nullif(l->>'request_item_id','') is not null
          and (l->>'request_item_id')::uuid not in
              (select id from public.material_request_items where request_id = p_request_id)
    ) then
        raise exception 'invalid request_item_id';
    end if;

    -- 1) Ghi các dòng phiếu xuất (chỉ dòng SL > 0)
    insert into public.material_issues
        (project_id, material_id, material_key, product_name, unit, quantity, unit_price, issue_date, notes,
         created_by, slip_code, subcontractor_id, subcontractor_name, request_id, request_item_id)
    select v_project, nullif(l->>'material_id','')::uuid, l->>'material_key', l->>'product_name', l->>'unit',
           (l->>'quantity')::numeric, coalesce((l->>'unit_price')::numeric, 0), p_issue_date, p_notes,
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

grant execute on function public.issue_from_request(uuid, text, uuid, text, date, text, jsonb) to authenticated;
