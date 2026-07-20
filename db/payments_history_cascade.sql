-- ============================================================
--  FK CASCADE CHO LỊCH SỬ THANH TOÁN (từ review module Hợp đồng & Thanh toán)
--  Vấn đề: xóa đợt thanh toán (payments) không xóa lịch sử con
--  external_payment_history / internal_payment_history -> rác orphan
--  (tab Lịch sử thu tiền vẫn hiển thị giao dịch của đợt đã xóa).
--
--  Script này (idempotent, chạy đè an toàn):
--  1) Báo cáo + DỌN các dòng orphan hiện có (trỏ tới payment đã xóa).
--  2) Ép FK payment_stage_id -> payments(id) ON DELETE CASCADE
--     (tạo mới nếu chưa có FK, thay thế nếu FK cũ không cascade).
--  ⚠️ CHẠY TRÊN SUPABASE SQL EDITOR.
-- ============================================================

-- 0) Xem trước orphan (chạy riêng nếu muốn kiểm tra trước khi dọn):
-- select 'external' src, h.* from public.external_payment_history h
--   left join public.payments p on p.id = h.payment_stage_id where p.id is null
-- union all
-- select 'internal', h.* from public.internal_payment_history h
--   left join public.payments p on p.id = h.payment_stage_id where p.id is null;

-- 1) Dọn orphan (bắt buộc trước khi thêm FK, nếu không ALTER sẽ lỗi)
delete from public.external_payment_history h
where h.payment_stage_id is not null
  and not exists (select 1 from public.payments p where p.id = h.payment_stage_id);

delete from public.internal_payment_history h
where h.payment_stage_id is not null
  and not exists (select 1 from public.payments p where p.id = h.payment_stage_id);

-- 2) Ép FK ON DELETE CASCADE cho cả 2 bảng
do $do$
declare
    v_table text;
    r record;
    v_has_fk boolean;
begin
    foreach v_table in array array['external_payment_history', 'internal_payment_history'] loop
        v_has_fk := false;
        for r in
            select tc.constraint_name
            from information_schema.table_constraints tc
            join information_schema.key_column_usage kcu
              on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
            where tc.table_schema = 'public' and tc.constraint_type = 'FOREIGN KEY'
              and tc.table_name = v_table and kcu.column_name = 'payment_stage_id'
        loop
            v_has_fk := true;
            execute format('alter table public.%I drop constraint %I', v_table, r.constraint_name);
            execute format(
                'alter table public.%I add constraint %I foreign key (payment_stage_id) references public.payments(id) on delete cascade',
                v_table, r.constraint_name);
            raise notice 'OK: % — FK % đã chuyển sang ON DELETE CASCADE', v_table, r.constraint_name;
        end loop;
        if not v_has_fk then
            execute format(
                'alter table public.%I add constraint %I foreign key (payment_stage_id) references public.payments(id) on delete cascade',
                v_table, v_table || '_stage_fk');
            raise notice 'OK: % — tạo mới FK cascade', v_table;
        end if;
    end loop;
end $do$;

-- KIỂM TRA SAU KHI CHẠY:
-- select tc.table_name, tc.constraint_name, rc.delete_rule
-- from information_schema.table_constraints tc
-- join information_schema.referential_constraints rc on rc.constraint_name = tc.constraint_name
-- where tc.table_name in ('external_payment_history','internal_payment_history');
-- -> delete_rule phải là CASCADE.
