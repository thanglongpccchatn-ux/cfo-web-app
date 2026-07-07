-- ============================================================
--  KẾ HOẠCH DÒNG TIỀN (Cash Flow Plan) — chạy 1 lần trong Supabase SQL Editor
--  Thực tế KHÔNG lưu ở đây (tính on-the-fly từ payments/expenses/loans/treasury).
--  Bảng này chỉ lưu KẾ HOẠCH (planned) theo tháng + số dư đầu kỳ (tùy chọn override).
-- ============================================================

-- 1) Kế hoạch thu-chi theo THÁNG (quý/năm = cộng dồn các tháng)
create table if not exists public.cash_flow_plan (
    id             uuid primary key default gen_random_uuid(),
    entity_key     text,                 -- pháp nhân (null = chung/không phân biệt)
    project_id     uuid references public.projects(id) on delete cascade,  -- null = toàn công ty (overhead)
    year           int  not null,
    month          int  not null check (month between 1 and 12),
    direction      text not null check (direction in ('in','out')),
    category       text not null,        -- mã hạng mục: project/loan/other_in | material/labor/operation/command/acceptance/machinery/debt/other_out
    sub_category   text,                 -- nhóm chi tiết (dùng cho material = mã material_categories.code); null = không phân nhóm
    planned_amount numeric not null default 0,
    note           text,
    created_at     timestamptz default now()
);
create index if not exists idx_cash_flow_plan_scope
    on public.cash_flow_plan (year, project_id, entity_key);

-- Nếu bảng đã tồn tại từ trước (chưa có sub_category) thì thêm cột:
alter table public.cash_flow_plan add column if not exists sub_category text;

-- 2) Số dư đầu kỳ (tùy chọn override; nếu không có dòng nào → app tự lấy tổng current_balance của Sổ quỹ)
create table if not exists public.cash_flow_opening (
    id             uuid primary key default gen_random_uuid(),
    entity_key     text,
    project_id     uuid references public.projects(id) on delete cascade,
    year           int not null,
    opening_balance numeric not null default 0,
    note           text,
    created_at     timestamptz default now()
);
create unique index if not exists uq_cash_flow_opening
    on public.cash_flow_opening (project_id, entity_key, year) nulls not distinct;

-- 3) RLS (theo pattern app: RBAC ở tầng ứng dụng, RLS cho authenticated)
alter table public.cash_flow_plan    enable row level security;
alter table public.cash_flow_opening enable row level security;
do $$ begin
    create policy cash_flow_plan_all on public.cash_flow_plan
        for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
    create policy cash_flow_opening_all on public.cash_flow_opening
        for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;

-- 4) Quyền (để gán trong màn Phân quyền + gate menu)
insert into public.permissions (code, name, module, description) values
    ('view_cashflow_plan',   'Xem KH dòng tiền', 'Kế hoạch', 'Xem kế hoạch dòng tiền'),
    ('manage_cashflow_plan', 'Lập KH dòng tiền', 'Kế hoạch', 'Lập/sửa kế hoạch dòng tiền')
on conflict (code) do nothing;

-- 5) Cấp sẵn cho Admin (ROLE01). Các vai trò khác cấp trong màn Phân quyền.
insert into public.role_permissions (role_code, permission_code) values
    ('ROLE01','view_cashflow_plan'),
    ('ROLE01','manage_cashflow_plan')
on conflict do nothing;
