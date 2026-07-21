-- ============================================================
--  THẦU PHỤ & TỔ ĐỘI — PHASE 0 / FILE 3: RPC CHI TIỀN (nhiều đợt) + BÚT TOÁN
--  Chạy SAU file 2. Cần bảng kế toán acc_* (accountingService).
--
--  ĐIỂM QUAN TRỌNG: bút toán 622/334 sinh NGAY trong RPC, cùng transaction với việc
--  ghi đợt chi. Bút toán lỗi -> rollback sạch (không còn cảnh chi tiền mà thiếu bút toán
--  như bản client-side cũ, vốn còn insert nhầm cột line_number không tồn tại).
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- Helper: sinh bút toán tự động trong DB (thay createAutoJournalEntry phía client)
--   Trả về id bút toán. Idempotent theo (source_module, source_id) nếu có unique index.
-- ─────────────────────────────────────────────────────────────
create or replace function public._auto_journal_labor(
    p_source_id   uuid,          -- id của labor_payment (mỗi đợt 1 bút toán)
    p_entry_date  date,
    p_amount      numeric,
    p_desc        text,
    p_ref         text,
    p_project_id  uuid
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
    v_period    uuid;
    v_acc_622   uuid;
    v_acc_334   uuid;
    v_entry     uuid;
begin
    if coalesce(p_amount, 0) <= 0 then
        return null;
    end if;

    -- Idempotency: đã có bút toán cho đợt chi này thì trả lại luôn
    select id into v_entry from public.acc_journal_entries
     where source_module = 'labor_payment' and source_id = p_source_id limit 1;
    if found then return v_entry; end if;

    -- Kỳ kế toán mở chứa ngày chi
    select id into v_period from public.acc_fiscal_periods
     where start_date <= p_entry_date and end_date >= p_entry_date and status = 'open'
     order by start_date desc limit 1;
    if v_period is null then
        raise exception 'khong co ky ke toan MO cho ngay % (mo ky truoc khi chi)', p_entry_date;
    end if;

    -- Tài khoản 622 (CP nhân công) / 334 (phải trả người lao động)
    select id into v_acc_622 from public.acc_accounts where account_number = '622' and is_active limit 1;
    select id into v_acc_334 from public.acc_accounts where account_number = '334' and is_active limit 1;
    if v_acc_622 is null or v_acc_334 is null then
        raise exception 'thieu tai khoan 622 hoac 334 trong he thong ke toan';
    end if;

    insert into public.acc_journal_entries
        (journal_type, entry_date, description, reference_number, fiscal_period_id,
         total_debit, total_credit, status, source_module, source_id, created_by)
    values
        ('payroll', p_entry_date, '[Tự động] ' || p_desc, p_ref, v_period,
         p_amount, p_amount, 'draft', 'labor_payment', p_source_id, auth.uid())
    returning id into v_entry;

    insert into public.acc_journal_lines
        (journal_entry_id, line_order, account_id, debit_amount, credit_amount, description, project_id)
    values
        (v_entry, 1, v_acc_622, p_amount, 0, p_desc, p_project_id),
        (v_entry, 2, v_acc_334, 0, p_amount, p_desc, p_project_id);

    return v_entry;
end $$;

-- ─────────────────────────────────────────────────────────────
-- pay_labor — CHI 1 ĐỢT cho đề nghị đã duyệt (chi được nhiều lần)
--   p_allow_over: cho phép chi vượt số duyệt (kèm cảnh báo + cờ is_over_request).
--   Trả JSON: { payment_id, status, total_paid, remaining, is_over, journal_id, contract_over }
-- ─────────────────────────────────────────────────────────────
create or replace function public.pay_labor(
    p_labor_id        uuid,
    p_amount          numeric,
    p_deduction       numeric default 0,
    p_deduction_reason text default null,
    p_payment_date    date default null,
    p_payment_method  text default 'Chuyển khoản',
    p_note            text default null,
    p_allow_over      boolean default false
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
    l               record;
    v_paid_before   numeric;
    v_base          numeric;      -- số duyệt (mốc để tính vượt)
    v_total_after   numeric;
    v_is_over       boolean := false;
    v_pay_id        uuid;
    v_journal       uuid;
    v_new_status    text;
    v_date          date;
    v_contract_paid numeric;
    v_contract_val  numeric;
    v_contract_over boolean := false;
begin
    if not public.current_user_has_perm('pay_labor') then
        raise exception 'forbidden';
    end if;
    if coalesce(p_amount, 0) <= 0 then
        raise exception 'so tien chi phai > 0';
    end if;

    v_date := coalesce(p_payment_date, current_date);

    -- Khóa dòng đề nghị để 2 người không chi trùng cùng lúc
    select * into l from public.expense_labor where id = p_labor_id for update;
    if not found then
        raise exception 'khong tim thay de nghi';
    end if;
    if l.status = 'PENDING' then
        raise exception 'de nghi CHUA DUOC DUYET — khong the chi';
    end if;
    if l.status = 'REJECTED' then
        raise exception 'de nghi da bi tu choi';
    end if;

    -- Đã chi trước đó (tổng các đợt) + đợt này
    select coalesce(sum(amount), 0) into v_paid_before from public.labor_payments where labor_id = p_labor_id;
    v_base := coalesce(nullif(l.approved_amount, 0), l.requested_amount, 0);
    v_total_after := v_paid_before + p_amount;

    -- Vượt số duyệt?
    if v_total_after > v_base + 1 then
        if not coalesce(p_allow_over, false) then
            raise exception 'CHI VUOT: da chi % + dot nay % = % > so duyet %. Xac nhan cho phep vuot de tiep tuc.',
                v_paid_before, p_amount, v_total_after, v_base;
        end if;
        v_is_over := true;
    end if;

    -- Cảnh báo vượt TRẦN HỢP ĐỒNG (lũy kế mọi đề nghị cùng hợp đồng) — chỉ set cờ, không chặn
    if l.contract_id is not null then
        select coalesce(sum(lp.amount), 0)
          into v_contract_paid
          from public.labor_payments lp
          join public.expense_labor e2 on e2.id = lp.labor_id
         where e2.contract_id = l.contract_id;
        v_contract_val := coalesce(l.contract_value, 0);
        if v_contract_val > 0 and (v_contract_paid + p_amount) > v_contract_val + 1 then
            v_contract_over := true;
        end if;
    end if;

    -- Ghi đợt chi
    insert into public.labor_payments
        (labor_id, amount, deduction_amount, deduction_reason, payment_date,
         payment_method, is_over_request, note, created_by)
    values
        (p_labor_id, p_amount, coalesce(p_deduction, 0), p_deduction_reason, v_date,
         coalesce(p_payment_method, 'Chuyển khoản'), v_is_over, p_note, auth.uid())
    returning id into v_pay_id;

    -- Bút toán 622/334 cho đợt này (cùng transaction — lỗi thì rollback tất cả)
    v_journal := public._auto_journal_labor(
        v_pay_id, v_date, p_amount,
        'CP nhân công — ' || coalesce(l.team_name, ''),
        left(p_labor_id::text, 8),
        l.project_id
    );
    update public.labor_payments set journal_entry_id = v_journal where id = v_pay_id;

    -- Cập nhật tổng đã chi + trạng thái trên đề nghị
    v_new_status := case when v_total_after >= v_base - 1 then 'PAID' else 'PARTIAL' end;
    update public.expense_labor set
        paid_amount = v_total_after,
        deduction_amount = coalesce(deduction_amount, 0) + coalesce(p_deduction, 0),
        payment_date = v_date,
        status = v_new_status
    where id = p_labor_id;

    return jsonb_build_object(
        'payment_id', v_pay_id,
        'status', v_new_status,
        'total_paid', v_total_after,
        'remaining', greatest(0, v_base - v_total_after),
        'is_over', v_is_over,
        'journal_id', v_journal,
        'contract_over', v_contract_over
    );
end $$;

grant execute on function public.pay_labor(uuid,numeric,numeric,text,date,text,text,boolean) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- void_labor_payment — HỦY 1 đợt chi (đảo trạng thái + xóa bút toán nháp)
-- ─────────────────────────────────────────────────────────────
create or replace function public.void_labor_payment(p_payment_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
    lp        record;
    v_base    numeric;
    v_total   numeric;
    v_status  text;
begin
    if not public.current_user_has_perm('pay_labor') then
        raise exception 'forbidden';
    end if;

    select * into lp from public.labor_payments where id = p_payment_id;
    if not found then raise exception 'khong tim thay dot chi'; end if;

    -- Xóa bút toán nháp kèm theo (nếu còn nháp — đã ghi sổ thì giữ, chỉ cảnh báo)
    if lp.journal_entry_id is not null then
        delete from public.acc_journal_lines where journal_entry_id = lp.journal_entry_id;
        delete from public.acc_journal_entries where id = lp.journal_entry_id and status = 'draft';
    end if;

    delete from public.labor_payments where id = p_payment_id;

    -- Tính lại tổng đã chi + trạng thái đề nghị
    select coalesce(sum(amount), 0) into v_total from public.labor_payments where labor_id = lp.labor_id;
    select coalesce(nullif(approved_amount, 0), requested_amount, 0) into v_base
      from public.expense_labor where id = lp.labor_id;
    v_status := case
        when v_total <= 0 then 'APPROVED'
        when v_total >= v_base - 1 then 'PAID'
        else 'PARTIAL'
    end;
    update public.expense_labor set paid_amount = v_total, status = v_status where id = lp.labor_id;
end $$;

grant execute on function public.void_labor_payment(uuid) to authenticated;

notify pgrst, 'reload schema';
