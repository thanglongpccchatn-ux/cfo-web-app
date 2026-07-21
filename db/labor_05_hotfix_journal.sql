-- ============================================================
--  HOTFIX (bắt buộc chạy) — vá 2 lỗi NGHIÊM TRỌNG của labor_03_rpc_pay.sql
--
--  LỖI 1 (BẢO MẬT — nghiêm trọng):
--    _auto_journal_labor là SECURITY DEFINER nhưng KHÔNG kiểm quyền, và Postgres
--    mặc định GRANT EXECUTE cho PUBLIC => BẤT KỲ AI có anon key (key này nằm công
--    khai trong bundle JS của web) đều gọi được và ghi thẳng vào sổ kế toán,
--    bỏ qua RLS. Đã kiểm chứng: gọi bằng anon key chạy tới tận INSERT.
--    -> Thu hồi quyền execute, chỉ pay_labor (cùng owner) được gọi nội bộ.
--
--  LỖI 2 (CHỨC NĂNG — chặn hoàn toàn):
--    acc_journal_entries.entry_number là NOT NULL và KHÔNG có default. RPC cũ
--    không set cột này => mọi lần chi tiền đều lỗi 23502 rồi rollback
--    => KHÔNG chi được đồng nào. Sửa: lấy số bút toán từ generate_entry_number().
--
--  ⚠️ CHẠY TRÊN SUPABASE SQL EDITOR (sau labor_03_rpc_pay.sql).
-- ============================================================

-- ── Sửa hàm sinh bút toán: bổ sung entry_number ──────────────
create or replace function public._auto_journal_labor(
    p_source_id   uuid,
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
    v_number    text;
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

    -- Số bút toán (entry_number NOT NULL) — dùng đúng hàm hệ thống đang dùng
    begin
        v_number := public.generate_entry_number('payroll', p_entry_date);
    exception when others then
        v_number := null;
    end;
    if nullif(trim(coalesce(v_number, '')), '') is null then
        -- Dự phòng nếu hàm sinh số lỗi: LG-<năm>-<6 số> theo max hiện có
        select 'LG-' || extract(year from p_entry_date)::text || '-' ||
               lpad((coalesce(max(nullif(regexp_replace(split_part(entry_number, '-', 3), '\D', '', 'g'), '')::int), 0) + 1)::text, 6, '0')
          into v_number
          from public.acc_journal_entries
         where entry_number like 'LG-' || extract(year from p_entry_date)::text || '-%';
    end if;

    insert into public.acc_journal_entries
        (entry_number, journal_type, entry_date, description, reference_number, fiscal_period_id,
         total_debit, total_credit, status, source_module, source_id, created_by)
    values
        (v_number, 'payroll', p_entry_date, '[Tự động] ' || p_desc, p_ref, v_period,
         p_amount, p_amount, 'draft', 'labor_payment', p_source_id, auth.uid())
    returning id into v_entry;

    insert into public.acc_journal_lines
        (journal_entry_id, line_order, account_id, debit_amount, credit_amount, description, project_id)
    values
        (v_entry, 1, v_acc_622, p_amount, 0, p_desc, p_project_id),
        (v_entry, 2, v_acc_334, 0, p_amount, p_desc, p_project_id);

    return v_entry;
end $$;

-- ── THU HỒI quyền gọi trực tiếp hàm nội bộ (lỗ hổng chính) ───
revoke all on function public._auto_journal_labor(uuid, date, numeric, text, text, uuid) from public;
revoke all on function public._auto_journal_labor(uuid, date, numeric, text, text, uuid) from anon;
revoke all on function public._auto_journal_labor(uuid, date, numeric, text, text, uuid) from authenticated;

-- Các helper hạ tầng khác cũng KHÔNG được để lộ cho client
do $$
begin
    revoke all on function public._apply_rls(text, text[]) from public, anon, authenticated;
exception when undefined_function then null; end $$;
do $$
begin
    revoke all on function public._drop_all_policies(text) from public, anon, authenticated;
exception when undefined_function then null; end $$;

notify pgrst, 'reload schema';

-- ─────────────────────────────────────────────────────────────
-- KIỂM TRA SAU KHI CHẠY
-- ─────────────────────────────────────────────────────────────
-- 1) Gọi _auto_journal_labor bằng anon key phải trả 404 (không còn thấy hàm).
-- 2) Chi thử 1 đợt qua giao diện -> phải tạo được bút toán:
--    select entry_number, entry_date, total_debit, source_module, status
--      from public.acc_journal_entries where source_module='labor_payment'
--      order by created_at desc limit 5;
