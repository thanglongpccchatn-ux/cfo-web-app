-- ============================================================
--  HỆ THỐNG THẦU PHỤ & TỔ ĐỘI — PHASE 0 / FILE 1: SCHEMA + DI TRÚ DỮ LIỆU
--
--  Mục tiêu:
--   1) Phân loại đối tác: Nhà thầu (xuất được hóa đơn) vs Tổ đội (không xuất).
--   2) NỐI LẠI mắt xích đang đứt: expense_labor -> subcontractor_contracts (contract_id)
--      và -> partners (partner_id). Trước đây form chỉ chép team_name (text) rồi vứt liên kết
--      => không theo dõi được lũy kế/công nợ theo từng hợp đồng.
--   3) Bảng labor_payments: 1 đề nghị chi được NHIỀU đợt.
--
--  AN TOÀN: chỉ THÊM, KHÔNG xóa/đổi tên cột hay bảng nào. Chạy lại nhiều lần vô hại
--  (idempotent). Bảng subcontractors giữ nguyên, chỉ COPY sang partners cái còn thiếu.
--
--  ⚠️ CHẠY TRÊN SUPABASE SQL EDITOR. Chạy FILE 1 -> 2 -> 3 -> 4 theo thứ tự.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- A. MỞ RỘNG SCHEMA
-- ─────────────────────────────────────────────────────────────

-- A1. partners: phân loại Nhà thầu / Tổ đội (chọn tay ở giao diện danh mục)
alter table public.partners add column if not exists entity_type text;

do $$
begin
    if not exists (select 1 from pg_constraint where conname = 'partners_entity_type_chk') then
        alter table public.partners
            add constraint partners_entity_type_chk
            check (entity_type is null or entity_type in ('contractor', 'team')) not valid;
    end if;
end $$;

comment on column public.partners.entity_type is
    'contractor = Nhà thầu (xuất được hóa đơn) | team = Tổ đội (không xuất hóa đơn). Chỉ dùng cho type=Subcontractor.';

-- A2. expense_labor: nối lại liên kết hợp đồng + nhà thầu, thêm vết duyệt
alter table public.expense_labor
    add column if not exists contract_id   uuid,
    add column if not exists partner_id    uuid,
    add column if not exists created_by    uuid,
    add column if not exists approved_by   uuid,
    add column if not exists approved_at   timestamptz,
    add column if not exists approved_note text;

do $$
begin
    -- FK -> subcontractor_contracts (hợp đồng bị xóa thì phiếu vẫn còn, chỉ mất liên kết)
    if not exists (select 1 from pg_constraint where conname = 'expense_labor_contract_id_fkey') then
        alter table public.expense_labor
            add constraint expense_labor_contract_id_fkey
            foreign key (contract_id) references public.subcontractor_contracts(id) on delete set null;
    end if;
    if not exists (select 1 from pg_constraint where conname = 'expense_labor_partner_id_fkey') then
        alter table public.expense_labor
            add constraint expense_labor_partner_id_fkey
            foreign key (partner_id) references public.partners(id) on delete set null;
    end if;
end $$;

create index if not exists idx_expense_labor_contract on public.expense_labor(contract_id);
create index if not exists idx_expense_labor_partner  on public.expense_labor(partner_id);
create index if not exists idx_expense_labor_status   on public.expense_labor(status);

comment on column public.expense_labor.contract_id is
    'Hợp đồng thầu phụ của đề nghị này — BẮT BUỘC với phiếu tạo mới (phiếu cũ có thể NULL).';

-- A3. labor_payments: lịch sử chi từng đợt (1 đề nghị -> N đợt chi)
create table if not exists public.labor_payments (
    id                uuid primary key default gen_random_uuid(),
    labor_id          uuid not null references public.expense_labor(id) on delete cascade,
    amount            numeric not null check (amount > 0),
    deduction_amount  numeric not null default 0 check (deduction_amount >= 0),
    deduction_reason  text,
    payment_date      date not null default current_date,
    payment_method    text default 'Chuyển khoản',
    is_over_request   boolean not null default false,   -- đợt chi này vượt số đề nghị/duyệt
    journal_entry_id  uuid,                             -- bút toán 622/334 đã sinh
    note              text,
    created_by        uuid,
    created_at        timestamptz not null default now()
);

create index if not exists idx_labor_payments_labor on public.labor_payments(labor_id);
create index if not exists idx_labor_payments_date  on public.labor_payments(payment_date);

comment on table public.labor_payments is
    'Mỗi dòng = 1 đợt chi cho 1 đề nghị thanh toán nhân công. Chỉ ghi qua RPC pay_labor.';

-- ─────────────────────────────────────────────────────────────
-- B. DI TRÚ DỮ LIỆU (an toàn — không xóa gì)
-- ─────────────────────────────────────────────────────────────

-- B1. Gán entity_type cho nhà thầu đã có: có MST -> Nhà thầu, không MST -> Tổ đội.
--     (Chỉ đoán lần đầu; sau này người dùng chỉnh tay trong danh mục.)
update public.partners
   set entity_type = case
        when coalesce(nullif(trim(tax_code), ''), '') <> '' then 'contractor'
        else 'team'
   end
 where type = 'Subcontractor' and entity_type is null;

-- B2. COPY nhà thầu từ bảng subcontractors sang partners nếu CHƯA có.
--     Lý do: hợp đồng thầu phụ đọc nhà thầu từ partners(type=Subcontractor), còn tab
--     "Danh mục" lại lưu vào subcontractors => 2 danh sách lệch nhau. Copy để không
--     thiếu nhà thầu khi tạo hợp đồng. KHÔNG xóa bảng subcontractors.
do $$
declare v_copied int := 0;
begin
    if to_regclass('public.subcontractors') is null then
        raise notice 'B2: khong co bang subcontractors -> bo qua';
        return;
    end if;

    insert into public.partners (code, name, short_name, tax_code, type, entity_type)
    select s.code,
           s.name,
           coalesce(nullif(trim(s.short_name), ''), s.name),
           s.tax_code,
           'Subcontractor',
           case when coalesce(nullif(trim(s.tax_code), ''), '') <> '' then 'contractor' else 'team' end
      from public.subcontractors s
     where coalesce(nullif(trim(s.name), ''), '') <> ''
       and not exists (
            select 1 from public.partners p
             where p.type = 'Subcontractor'
               and (
                    (coalesce(nullif(trim(p.tax_code), ''), '') <> ''
                     and trim(p.tax_code) = trim(s.tax_code))
                 or lower(trim(p.name)) = lower(trim(s.name))
                 or (coalesce(nullif(trim(p.code), ''), '') <> ''
                     and lower(trim(p.code)) = lower(trim(s.code)))
               )
       );
    get diagnostics v_copied = row_count;
    raise notice 'B2: da copy % nha thau tu subcontractors -> partners', v_copied;
exception
    when undefined_column then
        raise notice 'B2: bang subcontractors thieu cot (short_name/code?) -> copy toi thieu';
        insert into public.partners (name, tax_code, type, entity_type)
        select s.name, s.tax_code, 'Subcontractor',
               case when coalesce(nullif(trim(s.tax_code), ''), '') <> '' then 'contractor' else 'team' end
          from public.subcontractors s
         where coalesce(nullif(trim(s.name), ''), '') <> ''
           and not exists (select 1 from public.partners p
                            where p.type = 'Subcontractor'
                              and lower(trim(p.name)) = lower(trim(s.name)));
    when others then
        raise notice 'B2: bo qua do loi: %', sqlerrm;
end $$;

-- B3. Backfill partner_id cho phiếu cũ: dò theo team_name (text) khớp short_name/name/code.
update public.expense_labor el
   set partner_id = p.id
  from public.partners p
 where el.partner_id is null
   and p.type = 'Subcontractor'
   and coalesce(nullif(trim(el.team_name), ''), '') <> ''
   and (
        lower(trim(el.team_name)) = lower(trim(coalesce(p.short_name, '')))
     or lower(trim(el.team_name)) = lower(trim(coalesce(p.name, '')))
     or lower(trim(el.team_name)) = lower(trim(coalesce(p.code, '')))
   );

-- B4. Chuẩn hóa status cũ về bộ mới: PENDING | APPROVED | PARTIAL | PAID | REJECTED
update public.expense_labor
   set status = case
        when coalesce(paid_amount, 0) > 0 then 'PAID'
        when upper(coalesce(status, '')) in ('PENDING','APPROVED','PARTIAL','PAID','REJECTED')
             then upper(status)
        else 'PENDING'
   end
 where status is null
    or upper(coalesce(status, '')) not in ('PENDING','APPROVED','PARTIAL','PAID','REJECTED');

-- B5. Sinh labor_payments cho các phiếu ĐÃ CHI trước đây (giữ nguyên lịch sử, không mất số liệu).
insert into public.labor_payments
    (labor_id, amount, deduction_amount, deduction_reason, payment_date, payment_method, note, created_at)
select el.id,
       el.paid_amount,
       coalesce(el.deduction_amount, 0),
       el.deduction_reason,
       coalesce(el.payment_date, el.request_date, current_date),
       'Không rõ',
       'Di trú từ dữ liệu cũ (trước khi có bảng labor_payments)',
       coalesce(el.created_at, now())
  from public.expense_labor el
 where coalesce(el.paid_amount, 0) > 0
   and not exists (select 1 from public.labor_payments lp where lp.labor_id = el.id);

-- B6. Phiếu đã chi mà chưa có số duyệt -> coi số đề nghị là số duyệt (để tính công nợ đến kỳ).
update public.expense_labor
   set approved_amount = requested_amount
 where coalesce(approved_amount, 0) = 0
   and coalesce(requested_amount, 0) > 0
   and status in ('PAID', 'PARTIAL');

notify pgrst, 'reload schema';

-- ─────────────────────────────────────────────────────────────
-- KIỂM TRA SAU KHI CHẠY (chạy tay, chỉ đọc)
-- ─────────────────────────────────────────────────────────────
-- select entity_type, count(*) from public.partners where type='Subcontractor' group by 1;
-- select status, count(*), sum(paid_amount) from public.expense_labor group by 1;
-- select count(*) as so_dot_chi, sum(amount) as tong_chi from public.labor_payments;
-- select count(*) filter (where partner_id is null) as phieu_chua_ro_nha_thau,
--        count(*) filter (where contract_id is null) as phieu_chua_gan_hop_dong
--   from public.expense_labor;
