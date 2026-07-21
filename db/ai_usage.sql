-- ============================================================
--  BẢNG NHẬT KÝ DÙNG AI — phục vụ 2 việc:
--   1) Giới hạn số lượt hỏi/người/ngày (tránh bị đốt tiền API).
--   2) Audit: ai hỏi gì, dùng công cụ nào — soi lại khi cần.
--  ⚠️ CHẠY TRÊN SUPABASE SQL EDITOR trước khi deploy Edge Function ai-assistant.
-- ============================================================

create table if not exists public.ai_usage (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null references auth.users(id) on delete cascade,
    role_code   text,
    question    text,
    tools_used  text[],
    created_at  timestamptz not null default now()
);

create index if not exists idx_ai_usage_user_day on public.ai_usage(user_id, created_at desc);

comment on table public.ai_usage is
    'Nhật ký hỏi AI. Edge Function ai-assistant ghi mỗi lượt; dùng để rate limit theo ngày.';

-- RLS: mỗi người CHỈ đọc/ghi nhật ký của chính mình (câu hỏi có thể chứa thông tin
-- nhạy cảm — không để người này đọc câu hỏi của người kia). Admin đọc tất cả.
alter table public.ai_usage enable row level security;

do $$
begin
    if exists (select 1 from pg_policies where schemaname='public' and tablename='ai_usage' and policyname='ai_usage_self_select') then
        drop policy ai_usage_self_select on public.ai_usage;
    end if;
    if exists (select 1 from pg_policies where schemaname='public' and tablename='ai_usage' and policyname='ai_usage_self_insert') then
        drop policy ai_usage_self_insert on public.ai_usage;
    end if;
end $$;

create policy ai_usage_self_select on public.ai_usage
    for select to authenticated
    using (user_id = auth.uid() or public.current_user_has_perm('manage_users'));

create policy ai_usage_self_insert on public.ai_usage
    for insert to authenticated
    with check (user_id = auth.uid());

notify pgrst, 'reload schema';

-- ─────────────────────────────────────────────────────────────
-- KIỂM TRA
-- ─────────────────────────────────────────────────────────────
-- select role_code, count(*) as so_luot, max(created_at) as lan_cuoi
--   from public.ai_usage group by role_code order by so_luot desc;
