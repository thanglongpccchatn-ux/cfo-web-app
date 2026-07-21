-- ============================================================
--  THẦU PHỤ & TỔ ĐỘI — PHASE 0 / FILE 2: RPC TẠO/SỬA ĐỀ NGHỊ + DUYỆT
--  Chạy SAU file 1. Cần helper current_user_has_perm (security_rls_phase2.sql).
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1) save_labor_request — tạo/sửa đề nghị thanh toán (thay insert/update thẳng bảng)
--    BẮT BUỘC contract_id: nối đề nghị với hợp đồng thầu phụ.
--    Tự lấy partner_id + team_name từ hợp đồng (không tin client).
-- ─────────────────────────────────────────────────────────────
create or replace function public.save_labor_request(
    p_id                uuid,        -- null = tạo mới; có = sửa
    p_contract_id       uuid,        -- BẮT BUỘC
    p_payment_stage     text,
    p_request_type      text,
    p_request_date      date,
    p_completed_previous numeric,
    p_completed_current  numeric,
    p_requested_amount  numeric,
    p_daily_labor_count numeric default 0,
    p_daily_labor_rate  numeric default 0,
    p_priority          text default 'Bình thường',
    p_notes             text default null
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
    v_partner_id  uuid;
    v_team_name   text;
    v_contract_val numeric;
    v_id          uuid;
    v_status      text;
begin
    if not public.current_user_has_perm('manage_labor') then
        raise exception 'forbidden';
    end if;
    if p_contract_id is null then
        raise exception 'thieu hop dong thau phu (contract_id)';
    end if;
    if coalesce(p_requested_amount, 0) <= 0 then
        raise exception 'so tien de nghi phai > 0';
    end if;

    -- Lấy thông tin hợp đồng (server-side, không tin client)
    select sc.partner_id,
           coalesce(nullif(trim(pr.short_name), ''), pr.name, 'Chưa xác định'),
           sc.contract_value * (1 + coalesce(sc.vat_rate, 0) / 100.0)
      into v_partner_id, v_team_name, v_contract_val
      from public.subcontractor_contracts sc
      left join public.partners pr on pr.id = sc.partner_id
     where sc.id = p_contract_id;

    if not found then
        raise exception 'hop dong khong ton tai';
    end if;

    if p_id is null then
        -- TẠO MỚI
        insert into public.expense_labor (
            contract_id, partner_id, team_name, project_id,
            payment_stage, request_type, request_date,
            completed_previous, completed_current,
            requested_amount, contract_value,
            daily_labor_count, daily_labor_rate,
            priority, notes, status, approved_amount, paid_amount, created_by
        )
        select p_contract_id, v_partner_id, v_team_name, sc.project_id,
               p_payment_stage, p_request_type, coalesce(p_request_date, current_date),
               coalesce(p_completed_previous, 0), coalesce(p_completed_current, 0),
               p_requested_amount, v_contract_val,
               coalesce(p_daily_labor_count, 0), coalesce(p_daily_labor_rate, 0),
               coalesce(p_priority, 'Bình thường'), p_notes, 'PENDING', 0, 0, auth.uid()
          from public.subcontractor_contracts sc
         where sc.id = p_contract_id
        returning id into v_id;
        return v_id;
    end if;

    -- SỬA: chỉ cho sửa khi CHƯA chi (chưa có đợt thanh toán nào)
    select status into v_status from public.expense_labor where id = p_id;
    if not found then
        raise exception 'khong tim thay de nghi';
    end if;
    if exists (select 1 from public.labor_payments where labor_id = p_id) then
        raise exception 'de nghi da co dot chi — khong the sua';
    end if;

    update public.expense_labor set
        contract_id = p_contract_id,
        partner_id = v_partner_id,
        team_name = v_team_name,
        payment_stage = p_payment_stage,
        request_type = p_request_type,
        request_date = coalesce(p_request_date, request_date),
        completed_previous = coalesce(p_completed_previous, 0),
        completed_current = coalesce(p_completed_current, 0),
        requested_amount = p_requested_amount,
        contract_value = v_contract_val,
        daily_labor_count = coalesce(p_daily_labor_count, 0),
        daily_labor_rate = coalesce(p_daily_labor_rate, 0),
        priority = coalesce(p_priority, 'Bình thường'),
        notes = p_notes,
        -- Sửa đề nghị sau khi đã duyệt -> quay lại chờ duyệt
        status = case when status = 'APPROVED' then 'PENDING' else status end,
        approved_amount = case when status = 'APPROVED' then 0 else approved_amount end
    where id = p_id;

    return p_id;
end $$;

grant execute on function public.save_labor_request(uuid,uuid,text,text,date,numeric,numeric,numeric,numeric,numeric,text,text) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 2) approve_labor_request — DUYỆT đề nghị (bước 2)
--    p_approved_amount: số được duyệt (<= hoặc khác đề nghị tùy kế toán trưởng).
-- ─────────────────────────────────────────────────────────────
create or replace function public.approve_labor_request(
    p_id              uuid,
    p_approved_amount numeric,
    p_note            text default null
) returns void
language plpgsql security definer set search_path = public
as $$
declare v_status text;
begin
    if not public.current_user_has_perm('approve_labor') then
        raise exception 'forbidden';
    end if;
    if coalesce(p_approved_amount, 0) <= 0 then
        raise exception 'so duyet phai > 0';
    end if;

    select status into v_status from public.expense_labor where id = p_id;
    if not found then
        raise exception 'khong tim thay de nghi';
    end if;
    if v_status not in ('PENDING') then
        raise exception 'chi duyet duoc de nghi dang cho duyet (hien tai: %)', v_status;
    end if;

    update public.expense_labor set
        approved_amount = p_approved_amount,
        approved_by = auth.uid(),
        approved_at = now(),
        approved_note = p_note,
        status = 'APPROVED'
    where id = p_id;
end $$;

grant execute on function public.approve_labor_request(uuid,numeric,text) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 3) reject_labor_request — TỪ CHỐI đề nghị
-- ─────────────────────────────────────────────────────────────
create or replace function public.reject_labor_request(
    p_id   uuid,
    p_note text default null
) returns void
language plpgsql security definer set search_path = public
as $$
declare v_status text;
begin
    if not public.current_user_has_perm('approve_labor') then
        raise exception 'forbidden';
    end if;
    select status into v_status from public.expense_labor where id = p_id;
    if not found then raise exception 'khong tim thay de nghi'; end if;
    if v_status = 'PAID' or exists (select 1 from public.labor_payments where labor_id = p_id) then
        raise exception 'de nghi da chi — khong the tu choi';
    end if;
    update public.expense_labor set
        status = 'REJECTED', approved_by = auth.uid(), approved_at = now(), approved_note = p_note
    where id = p_id;
end $$;

grant execute on function public.reject_labor_request(uuid,text) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 4) delete_labor_request — XÓA đề nghị (chặn nếu đã chi)
-- ─────────────────────────────────────────────────────────────
create or replace function public.delete_labor_request(p_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
    if not public.current_user_has_perm('manage_labor') then
        raise exception 'forbidden';
    end if;
    if exists (select 1 from public.labor_payments where labor_id = p_id) then
        raise exception 'de nghi da co dot chi — khong the xoa (hay huy tung dot truoc)';
    end if;
    delete from public.expense_labor where id = p_id;
    if not found then
        raise exception 'khong tim thay de nghi';
    end if;
end $$;

grant execute on function public.delete_labor_request(uuid) to authenticated;

notify pgrst, 'reload schema';
