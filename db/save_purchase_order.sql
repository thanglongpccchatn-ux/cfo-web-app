-- ============================================================
--  RPC LƯU/SỬA ĐƠN MUA HÀNG (atomic) — thay cho chuỗi insert/update/delete rời rạc phía client.
--  Vá các lỗi từ review:
--  - Số HĐ tự sinh KHÔNG trùng kể cả 2 người cùng lưu (advisory lock theo dự án+NCC+ngày,
--    lock giữ đến hết transaction nên kiểm tra + insert nằm trong cùng vùng an toàn).
--  - Sửa đơn: update + insert dòng mới + xoá dòng bỏ trong CÙNG 1 transaction (hết nửa vời).
--  - Ghi lịch sử đổi giá (supplier_price_history) ngay trong transaction.
--  - Từ chối giá NULL (giá bị che theo quyền qua view _v) -> không thể vô tình đè giá thật về 0.
--  ⚠️ CHẠY TRÊN SUPABASE SQL EDITOR (cần current_user_has_perm từ security_rls_phase2.sql).
--  ⚠️ SAU KHI CHẠY: notify pgrst, 'reload schema';  -- để PostgREST thấy RPC mới.
-- ============================================================

create or replace function public.save_purchase_order(
    p_project_id    uuid,
    p_supplier_id   uuid,
    p_purchase_date date,
    p_reference_no  text,       -- số HĐ người dùng gõ / số HĐ hiện tại khi sửa (null = tự sinh)
    p_ref_base      text,       -- gốc số HĐ tự sinh (MÃDA-NCC-DDMMYYYY) để thêm hậu tố -2, -3...
    p_lines         jsonb,      -- [{id?, product_name, material_group, unit, quantity, unit_price, vat_rate, notes, material_id}]
    p_delete_ids    uuid[] default null,   -- dòng bị bỏ khi sửa đơn
    p_editing       boolean default false
) returns text                  -- số HĐ đã dùng
language plpgsql security definer set search_path = public
as $$
declare
    v_ref  text;
    l      record;
    v_last numeric;
    v_id   uuid;
    n      int;
begin
    -- Cùng bộ quyền với policy ghi rls_wr_supplier_purchases (admin luôn qua).
    if not (public.current_user_has_perm('manage_materials_tracking') or public.current_user_has_perm('manage_materials')) then
        raise exception 'forbidden';
    end if;
    if p_project_id is null or p_supplier_id is null or p_purchase_date is null then
        raise exception 'thieu du an / nha cung cap / ngay mua';
    end if;
    if p_lines is null or jsonb_array_length(p_lines) = 0 then
        raise exception 'don hang trong';
    end if;

    -- Serialize theo (dự án, NCC, ngày): 2 người cùng lưu không thể sinh trùng số HĐ.
    perform pg_advisory_xact_lock(hashtext(p_project_id::text || p_supplier_id::text || p_purchase_date::text));

    v_ref := nullif(trim(coalesce(p_reference_no, '')), '');
    if v_ref is null then
        v_ref := nullif(trim(coalesce(p_ref_base, '')), '');
        -- Tạo mới + số HĐ tự sinh: nếu đã có đơn cùng base thì thêm -2, -3... (khi sửa giữ nguyên).
        if v_ref is not null and not coalesce(p_editing, false)
           and exists (select 1 from public.supplier_purchases
                       where project_id = p_project_id and supplier_id = p_supplier_id
                         and purchase_date = p_purchase_date and reference_no = v_ref) then
            n := 2;
            while exists (select 1 from public.supplier_purchases
                          where project_id = p_project_id and supplier_id = p_supplier_id
                            and purchase_date = p_purchase_date and reference_no = v_ref || '-' || n) loop
                n := n + 1;
            end loop;
            v_ref := v_ref || '-' || n;
        end if;
    end if;

    for l in
        select * from jsonb_to_recordset(p_lines) as x(
            id uuid, product_name text, material_group text, unit text,
            quantity numeric, unit_price numeric, vat_rate numeric, notes text, material_id uuid)
    loop
        if nullif(trim(coalesce(l.product_name, '')), '') is null then continue; end if;
        -- Giá NULL = giá đang bị che theo quyền (view _v) -> từ chối, tránh đè giá thật về 0.
        if l.unit_price is null then
            raise exception 'thieu don gia cho "%" (tai khoan khong co quyen xem gia?)', l.product_name;
        end if;

        if l.id is not null then
            update public.supplier_purchases set
                project_id = p_project_id, supplier_id = p_supplier_id, purchase_date = p_purchase_date,
                material_group = coalesce(nullif(l.material_group, ''), 'Khác'),
                product_name = l.product_name, unit = l.unit,
                quantity = coalesce(l.quantity, 0), unit_price = l.unit_price,
                vat_rate = coalesce(l.vat_rate, 8), notes = l.notes,
                material_id = l.material_id, reference_no = v_ref
            where id = l.id;
        else
            -- Giá gần nhất của (NCC, sản phẩm) để so sánh ghi lịch sử đổi giá.
            select unit_price into v_last from public.supplier_purchases
            where supplier_id = p_supplier_id and lower(product_name) = lower(l.product_name)
            order by purchase_date desc, created_at desc limit 1;

            insert into public.supplier_purchases
                (project_id, supplier_id, material_group, purchase_date, product_name, unit,
                 quantity, unit_price, vat_rate, notes, material_id, reference_no, created_by)
            values
                (p_project_id, p_supplier_id, coalesce(nullif(l.material_group, ''), 'Khác'), p_purchase_date,
                 l.product_name, l.unit, coalesce(l.quantity, 0), l.unit_price,
                 coalesce(l.vat_rate, 8), l.notes, l.material_id, v_ref, auth.uid())
            returning id into v_id;

            if v_last is not null and v_last <> l.unit_price then
                begin
                    insert into public.supplier_price_history
                        (product_name, supplier_id, old_price, new_price, change_date, purchase_id)
                    values (l.product_name, p_supplier_id, v_last, l.unit_price, p_purchase_date, v_id);
                exception when others then null;  -- bảng lịch sử giá có thể chưa tạo — bỏ qua như client cũ
                end;
            end if;
        end if;
    end loop;

    if p_delete_ids is not null and array_length(p_delete_ids, 1) > 0 then
        delete from public.supplier_purchases
        where id = any(p_delete_ids) and project_id = p_project_id and supplier_id = p_supplier_id;
    end if;

    return v_ref;
end $$;

grant execute on function public.save_purchase_order(uuid, uuid, date, text, text, jsonb, uuid[], boolean) to authenticated;

notify pgrst, 'reload schema';
