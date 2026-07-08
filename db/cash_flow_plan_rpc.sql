-- ============================================================
--  RPC lưu kế hoạch dòng tiền / vật liệu TRONG 1 TRANSACTION
--  Fix review C2: trước đây client làm DELETE rồi INSERT tách rời -> insert lỗi
--  giữa chừng thì mất sạch dữ liệu. Body plpgsql chạy nguyên khối (atomic):
--  nếu insert lỗi, delete cũng bị rollback.
--  Chạy 1 lần trong Supabase SQL Editor (yêu cầu bảng cash_flow_plan đã có cột sub_category).
-- ============================================================

-- 1) Lưu KẾ HOẠCH VẬT LIỆU của 1 dự án (category='material'), theo nhóm × tháng.
--    p_rows: jsonb array [{ "month": 1..12, "sub_category": "MÃ_NHÓM"|null, "planned_amount": number }]
create or replace function public.save_material_plan(
    p_project_id uuid,
    p_year       int,
    p_rows       jsonb
) returns void
language plpgsql
as $$
begin
    delete from public.cash_flow_plan
     where project_id = p_project_id and year = p_year and category = 'material';

    if jsonb_array_length(coalesce(p_rows, '[]'::jsonb)) > 0 then
        insert into public.cash_flow_plan (project_id, year, month, direction, category, sub_category, planned_amount)
        select p_project_id, p_year, (r->>'month')::int, 'out', 'material',
               nullif(r->>'sub_category', ''), (r->>'planned_amount')::numeric
          from jsonb_array_elements(p_rows) r;
    end if;
end;
$$;

-- 2) Lưu KẾ HOẠCH DÒNG TIỀN (các hạng mục KHÁC material) của 1 scope.
--    p_project_id null = toàn công ty (overhead). KHÔNG đụng dòng material (quản ở màn riêng).
--    p_rows: jsonb array [{ "month": 1..12, "direction": "in"|"out", "category": "...", "planned_amount": number }]
create or replace function public.save_cash_flow_plan(
    p_project_id uuid,
    p_year       int,
    p_rows       jsonb
) returns void
language plpgsql
as $$
begin
    delete from public.cash_flow_plan
     where year = p_year
       and category <> 'material'
       and ((p_project_id is null and project_id is null) or project_id = p_project_id);

    if jsonb_array_length(coalesce(p_rows, '[]'::jsonb)) > 0 then
        insert into public.cash_flow_plan (project_id, year, month, direction, category, planned_amount)
        select p_project_id, p_year, (r->>'month')::int, r->>'direction', r->>'category',
               (r->>'planned_amount')::numeric
          from jsonb_array_elements(p_rows) r;
    end if;
end;
$$;

-- Cho phép user đã đăng nhập gọi (RLS trên bảng vẫn áp dụng vì hàm chạy security invoker mặc định).
grant execute on function public.save_material_plan(uuid, int, jsonb)  to authenticated;
grant execute on function public.save_cash_flow_plan(uuid, int, jsonb) to authenticated;
