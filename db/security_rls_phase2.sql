-- ============================================================
--  VÁ BẢO MẬT — GIAI ĐOẠN 2 (review lần 2)
--  Khoá RLS ghi cho CÁC BẢNG NGHIỆP VỤ còn `USING(true)` + vá IDOR get_user_permissions
--  + bỏ cửa hậu bootstrap admin_create_user + guard 2 RPC lưu kế hoạch.
--
--  NGUYÊN TẮC: SELECT mở cho authenticated (app cần đọc); GHI phải có ÍT NHẤT MỘT
--  trong các quyền của module (OR) — admin (ROLE01/ADMIN) luôn qua. Danh sách quyền để
--  "rộng" nhằm KHÔNG khoá nhầm người dùng hợp lệ, chỉ chặn anon + user khác module.
--
--  ⚠️ CHẠY TRÊN SUPABASE SQL EDITOR. Sau khi chạy, TEST bằng 1 tài khoản quyền thấp:
--     phải KHÔNG ghi được bảng ngoài quyền; tài khoản đúng module vẫn ghi bình thường.
--  Có ROLLBACK ở cuối file nếu khoá nhầm.
-- ============================================================

-- 0) Bảo đảm helper tồn tại (phòng khi đã drop sau giai đoạn 1)
create or replace function public.current_user_has_perm(p_code text)
returns boolean language sql stable security definer set search_path = public as $$
    select exists (select 1 from public.user_roles ur join public.role_permissions rp on rp.role_code = ur.role_code
                    where ur.user_id = auth.uid() and rp.permission_code = p_code)
        or exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role_code in ('ROLE01','ADMIN'))
        or exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.role_code in ('ROLE01','ADMIN'));
$$;
grant execute on function public.current_user_has_perm(text) to authenticated;

create or replace function public._drop_all_policies(p_table text)
returns void language plpgsql as $$
declare p record;
begin
    for p in select policyname from pg_policies where schemaname='public' and tablename=p_table loop
        execute format('drop policy %I on public.%I', p.policyname, p_table);
    end loop;
end $$;

-- 1) Generator: áp RLS chuẩn cho 1 bảng. SELECT mở (authenticated); GHI = OR các quyền.
--    Bỏ qua nếu bảng không tồn tại (tên bảng khác nhau giữa các bản migration).
create or replace function public._apply_rls(p_table text, variadic p_perms text[])
returns void language plpgsql as $$
declare cond text;
begin
    if to_regclass('public.'||p_table) is null then
        raise notice 'BỎ QUA (không có bảng): %', p_table; return;
    end if;
    perform public._drop_all_policies(p_table);
    execute format('alter table public.%I enable row level security', p_table);
    execute format('create policy %I on public.%I for select to authenticated using (true)', 'rls_sel_'||p_table, p_table);
    select string_agg(format('public.current_user_has_perm(%L)', perm), ' or ') into cond from unnest(p_perms) perm;
    execute format('create policy %I on public.%I for all to authenticated using (%s) with check (%s)', 'rls_wr_'||p_table, p_table, cond, cond);
    raise notice 'OK: %', p_table;
end $$;

-- 2) ÁP THEO NHÓM ────────────────────────────────────────────

-- A. Tài chính / hợp đồng
select public._apply_rls('projects','create_contracts','edit_contracts','delete_contracts','view_contracts');
select public._apply_rls('addendas','create_contracts','edit_contracts','delete_contracts');
select public._apply_rls('payments','create_payments','edit_payments','delete_payments');
select public._apply_rls('internal_payment_history','create_payments','edit_payments','delete_payments');
select public._apply_rls('external_payment_history','create_payments','edit_payments','delete_payments');
select public._apply_rls('expenses','manage_expenses','view_expenses');
select public._apply_rls('expense_materials','manage_expenses','manage_materials_tracking','manage_materials');
select public._apply_rls('expense_labor','manage_expenses','manage_labor');
select public._apply_rls('revenue_plan','manage_planning','view_planning');
-- cash_flow_plan: nhiều bộ phận cùng ghi (mỗi hạng mục 1 chủ) -> OR tất cả quyền hạng mục
select public._apply_rls('cash_flow_plan','manage_cashflow_plan','manage_materials_tracking','manage_labor','manage_expenses','manage_loans','edit_payments');
select public._apply_rls('cash_flow_opening','manage_cashflow_plan');
select public._apply_rls('weekly_expense_plans','manage_planning','view_planning','manage_expenses');
select public._apply_rls('settlement_documents','manage_settlement','view_settlement');
select public._apply_rls('contract_variations','manage_variations','view_variations');
select public._apply_rls('variation_history','manage_variations');
select public._apply_rls('subcontractor_contracts','manage_subcontractors','manage_labor','view_subcontractors');
select public._apply_rls('subcontractor_variations','manage_subcontractors','manage_labor');
select public._apply_rls('loans','manage_loans','view_loans');
select public._apply_rls('loan_payments','manage_loans','view_loans');
select public._apply_rls('internal_loans','manage_treasury','manage_loans');
select public._apply_rls('internal_refunds','manage_treasury','manage_loans');

-- B. Kho / mua hàng / vật tư
select public._apply_rls('purchase_orders','manage_materials_tracking','manage_materials','import_inventory');
select public._apply_rls('purchase_order_lines','manage_materials_tracking','manage_materials','import_inventory');
select public._apply_rls('purchase_order_items','manage_materials_tracking','manage_materials','import_inventory');
select public._apply_rls('po_payments','manage_materials_tracking','manage_materials');
select public._apply_rls('request_revisions','manage_materials_tracking','manage_materials');
select public._apply_rls('inventory_warehouses','manage_materials','import_inventory','export_inventory');
select public._apply_rls('inventory_stocks','manage_materials','import_inventory','export_inventory','manage_materials_tracking');
select public._apply_rls('inventory_receipts','import_inventory','export_inventory','manage_materials','manage_materials_tracking');
select public._apply_rls('inventory_receipt_items','import_inventory','export_inventory','manage_materials','manage_materials_tracking');
select public._apply_rls('inventory_requests','import_inventory','export_inventory','manage_materials','manage_materials_tracking');
select public._apply_rls('inventory_request_items','import_inventory','export_inventory','manage_materials','manage_materials_tracking');
select public._apply_rls('materials','manage_materials','edit_materials_master','manage_materials_tracking');
select public._apply_rls('material_categories','manage_materials','edit_materials_master','manage_materials_tracking');
select public._apply_rls('material_brands','manage_materials','edit_materials_master','manage_materials_tracking');
select public._apply_rls('supplier_purchases','manage_materials_tracking','manage_materials');
select public._apply_rls('supplier_payments','manage_materials_tracking','manage_materials');
select public._apply_rls('supplier_price_history','manage_materials_tracking','manage_materials');
select public._apply_rls('material_price_history','manage_materials_tracking','manage_materials');

-- C. Kế toán TT200
select public._apply_rls('acc_journal_entries','manage_accounting','create_journal','view_accounting');
select public._apply_rls('acc_journal_lines','manage_accounting','create_journal','view_accounting');
select public._apply_rls('acc_accounts','manage_accounting','view_accounting');
select public._apply_rls('acc_fiscal_years','manage_accounting','manage_fiscal_periods');
select public._apply_rls('acc_fiscal_periods','manage_accounting','manage_fiscal_periods');
select public._apply_rls('acc_budgets','manage_accounting','view_accounting');
select public._apply_rls('acc_budget_lines','manage_accounting','view_accounting');
select public._apply_rls('acc_recurring_templates','manage_accounting','view_accounting');
select public._apply_rls('acc_recurring_template_lines','manage_accounting','view_accounting');
select public._apply_rls('acc_einvoices','manage_accounting','view_accounting');
select public._apply_rls('acc_einvoice_lines','manage_accounting','view_accounting');
select public._apply_rls('acc_tax_declarations','manage_accounting','view_accounting');

-- D. Đối tác / ngân hàng / cấu hình
select public._apply_rls('partners','manage_partners','view_suppliers','manage_materials');
select public._apply_rls('suppliers','manage_partners','view_suppliers','manage_materials');
select public._apply_rls('subcontractors','manage_partners','manage_subcontractors','view_subcontractors');
select public._apply_rls('company_bank_profiles','manage_treasury','manage_settings','manage_users');
select public._apply_rls('company_settings','manage_settings','manage_users');

-- E. Vận hành
select public._apply_rls('site_diary','view_construction','manage_construction');
select public._apply_rls('staff_assignments','manage_users','manage_staff_assignment');
-- (BỎ QUA cố ý: tasks/task_*/chat_*/notifications = cộng tác, rủi ro thấp; treasury_* đã có policy riêng)

-- 3) Vá IDOR: get_user_permissions chỉ cho xem quyền CỦA MÌNH (trừ khi có manage_users)
create or replace function public.get_user_permissions(p_user_id uuid)
returns table (permission_code text) language plpgsql security definer set search_path = public as $$
begin
    -- is distinct from: xử lý NULL (anon) đúng -> chặn; = uid mình thì cho qua.
    if p_user_id is distinct from auth.uid() and not public.current_user_has_perm('manage_users') then
        raise exception 'forbidden';
    end if;
    return query
        select distinct rp.permission_code::text
        from public.user_roles ur join public.role_permissions rp on ur.role_code = rp.role_code
        where ur.user_id = p_user_id;
end $$;
revoke execute on function public.get_user_permissions(uuid) from public;
grant execute on function public.get_user_permissions(uuid) to authenticated;

-- 4) Bỏ CỬA HẬU bootstrap trong admin_create_user + dùng chung current_user_has_perm
--    (giữ NGUYÊN phần tạo user; chỉ đổi khối kiểm quyền đầu hàm)
create or replace function public.admin_create_user(p_email text, p_password text, p_full_name text, p_role_code text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare new_user_id uuid; encrypted_pw text;
begin
    if not public.current_user_has_perm('manage_users') then
        return jsonb_build_object('success', false, 'error', 'Bạn không có quyền tạo người dùng.');
    end if;
    if exists (select 1 from auth.users where email = p_email) then
        return jsonb_build_object('success', false, 'error', 'Email này đã được sử dụng trong hệ thống.');
    end if;
    new_user_id := gen_random_uuid();
    encrypted_pw := crypt(p_password, gen_salt('bf'));
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
        raw_app_meta_data, raw_user_meta_data, is_super_admin, is_sso_user, confirmation_token, recovery_token, email_change_token_new, email_change)
    values ('00000000-0000-0000-0000-000000000000', new_user_id, 'authenticated', 'authenticated', p_email, encrypted_pw, now(), now(), now(),
        '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', p_full_name), false, false, '', '', '', '');
    insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), new_user_id, format('{"sub":"%s","email":"%s"}', new_user_id::text, p_email)::jsonb, 'email', new_user_id::text, now(), now(), now());
    insert into public.profiles (id, email, full_name, role_code, status)
    values (new_user_id, p_email, p_full_name, p_role_code, 'Hoạt động')
    on conflict (id) do update set full_name = excluded.full_name, role_code = excluded.role_code, status = 'Hoạt động';
    return jsonb_build_object('success', true, 'user_id', new_user_id);
exception when others then
    return jsonb_build_object('success', false, 'error', sqlerrm);
end $$;
grant execute on function public.admin_create_user(text, text, text, text) to authenticated;

-- 5) Guard tường minh trong 2 RPC lưu kế hoạch (defense-in-depth) + sửa lọc material
create or replace function public.save_material_plan(p_project_id uuid, p_year int, p_rows jsonb)
returns void language plpgsql as $$
begin
    if not public.current_user_has_perm('manage_materials_tracking') then raise exception 'forbidden'; end if;
    delete from public.cash_flow_plan where project_id = p_project_id and year = p_year and category = 'material';
    if jsonb_array_length(coalesce(p_rows,'[]'::jsonb)) > 0 then
        insert into public.cash_flow_plan (project_id, year, month, direction, category, sub_category, planned_amount)
        select p_project_id, p_year, (r->>'month')::int, 'out', 'material', nullif(r->>'sub_category',''), (r->>'planned_amount')::numeric
        from jsonb_array_elements(p_rows) r;
    end if;
end $$;
grant execute on function public.save_material_plan(uuid, int, jsonb) to authenticated;

create or replace function public.save_cash_flow_plan(p_project_id uuid, p_year int, p_rows jsonb)
returns void language plpgsql as $$
begin
    if not public.current_user_has_perm('manage_cashflow_plan') then raise exception 'forbidden'; end if;
    delete from public.cash_flow_plan where year = p_year and category <> 'material'
        and ((p_project_id is null and project_id is null) or project_id = p_project_id);
    if jsonb_array_length(coalesce(p_rows,'[]'::jsonb)) > 0 then
        insert into public.cash_flow_plan (project_id, year, month, direction, category, planned_amount)
        select p_project_id, p_year, (r->>'month')::int, r->>'direction', r->>'category', (r->>'planned_amount')::numeric
        from jsonb_array_elements(p_rows) r
        where r->>'category' <> 'material';   -- không đụng material (quản ở màn riêng)
    end if;
end $$;
grant execute on function public.save_cash_flow_plan(uuid, int, jsonb) to authenticated;

-- ============================================================
-- TEST: đăng nhập user quyền thấp (vd chỉ view_materials) rồi thử qua REST:
--   supabase.from('payments').insert({...})      -> PHẢI bị chặn (RLS)
--   supabase.rpc('get_user_permissions',{p_user_id:'<uid người khác>'}) -> PHẢI 'forbidden'
-- User đúng module + admin vẫn thao tác bình thường trên app.
--
-- ROLLBACK 1 BẢNG (nếu khoá nhầm):
--   select public._drop_all_policies('<tên_bảng>');
--   create policy tmp_open on public.<tên_bảng> for all to authenticated using (true) with check (true);
-- ============================================================
