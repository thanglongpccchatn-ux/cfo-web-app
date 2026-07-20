-- ============================================================
--  TÁCH POLICY GHI THEO TỪNG LỆNH cho payments + 2 bảng lịch sử thanh toán
--  (từ review: _apply_rls tạo 1 policy FOR ALL nên ai có create_payments
--   cũng UPDATE/DELETE được ở tầng DB — 3 quyền create/edit/delete chỉ
--   có ý nghĩa trên UI).
--
--  Sau khi chạy:
--  - INSERT cần create_payments (lịch sử: create_payments HOẶC edit_payments —
--    vì luồng "thu tiền" trên UI gate bằng edit_payments và kèm update tổng).
--  - UPDATE cần edit_payments.
--  - DELETE cần delete_payments.
--  - SELECT giữ nguyên (rls_sel_* using(true)). Admin luôn qua (current_user_has_perm).
--  ⚠️ CHẠY TRÊN SUPABASE SQL EDITOR. Test lại 3 vai: người tạo / người sửa / người xóa.
--  ROLLBACK: chạy lại 3 dòng _apply_rls ở cuối file.
-- ============================================================

do $do$
declare v_table text;
begin
    foreach v_table in array array['payments', 'external_payment_history', 'internal_payment_history'] loop
        -- gỡ policy ghi gộp cũ (nếu còn)
        execute format('drop policy if exists %I on public.%I', 'rls_wr_' || v_table, v_table);
        execute format('drop policy if exists %I on public.%I', v_table || '_ins', v_table);
        execute format('drop policy if exists %I on public.%I', v_table || '_upd', v_table);
        execute format('drop policy if exists %I on public.%I', v_table || '_del', v_table);

        if v_table = 'payments' then
            execute format($p$create policy %I on public.%I for insert to authenticated
                with check (public.current_user_has_perm('create_payments'))$p$, v_table || '_ins', v_table);
        else
            -- lịch sử: người có edit_payments (nút thu tiền/chuyển tiền) cũng insert được
            execute format($p$create policy %I on public.%I for insert to authenticated
                with check (public.current_user_has_perm('create_payments') or public.current_user_has_perm('edit_payments'))$p$, v_table || '_ins', v_table);
        end if;

        execute format($p$create policy %I on public.%I for update to authenticated
            using (public.current_user_has_perm('edit_payments'))
            with check (public.current_user_has_perm('edit_payments'))$p$, v_table || '_upd', v_table);

        execute format($p$create policy %I on public.%I for delete to authenticated
            using (public.current_user_has_perm('delete_payments'))$p$, v_table || '_del', v_table);

        raise notice 'OK: % — tách policy insert/update/delete', v_table;
    end loop;
end $do$;

-- ROLLBACK (trả về policy gộp như cũ):
-- select public._apply_rls('payments','create_payments','edit_payments','delete_payments');
-- select public._apply_rls('internal_payment_history','create_payments','edit_payments','delete_payments');
-- select public._apply_rls('external_payment_history','create_payments','edit_payments','delete_payments');
