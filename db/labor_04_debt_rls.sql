-- ============================================================
--  THẦU PHỤ & TỔ ĐỘI — PHASE 0 / FILE 4: VIEW CÔNG NỢ 2 TẦNG + RLS + QUYỀN
--  Chạy SAU file 3.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1) VIEW công nợ theo HỢP ĐỒNG — mỗi hợp đồng 1 dòng, đủ giá trị + 2 tầng công nợ.
--    Tránh fan-out (contract × labor × payments) bằng cách gộp riêng rồi join.
-- ─────────────────────────────────────────────────────────────
create or replace view public.v_subcontractor_contract_debt as
with labor_agg as (
    select contract_id,
           count(*)                                as so_de_nghi,
           sum(requested_amount)                   as tong_de_nghi,
           sum(approved_amount)                    as tong_duyet,
           sum(completed_current)                  as tong_nghiem_thu,
           sum(paid_amount)                        as tong_da_tra_denorm
      from public.expense_labor
     where contract_id is not null
     group by contract_id
),
pay_agg as (
    select e.contract_id,
           sum(lp.amount)                          as tong_thuc_tra,
           max(lp.payment_date)                    as lan_chi_cuoi
      from public.labor_payments lp
      join public.expense_labor e on e.id = lp.labor_id
     where e.contract_id is not null
     group by e.contract_id
)
select
    sc.id                                          as contract_id,
    sc.contract_code,
    sc.contract_name,
    sc.contract_type,
    sc.status                                      as contract_status,
    sc.project_id,
    sc.partner_id,
    pr.name                                        as partner_name,
    pr.short_name                                  as partner_short_name,
    coalesce(pr.entity_type, 'team')               as entity_type,   -- contractor | team
    -- Giá trị hợp đồng (sau thuế) + tạm ứng + xuất hóa đơn
    round(coalesce(sc.contract_value, 0) * (1 + coalesce(sc.vat_rate, 0) / 100.0)) as gt_hop_dong,
    coalesce(sc.advance_amount, 0)                 as tam_ung,
    coalesce(sc.invoiced_amount, 0)                as gt_xuat_hoa_don,
    -- Lũy kế từ sổ đề nghị
    coalesce(la.tong_de_nghi, 0)                   as gt_de_nghi,
    coalesce(la.tong_duyet, 0)                     as gt_duyet,
    coalesce(la.tong_nghiem_thu, 0)                as gt_nghiem_thu,
    coalesce(pa.tong_thuc_tra, 0)                  as gt_thuc_tra,
    coalesce(la.so_de_nghi, 0)                     as so_de_nghi,
    pa.lan_chi_cuoi,
    -- CÔNG NỢ 2 TẦNG:
    --  đến kỳ  = đã duyệt   − đã trả  (phần phải trả ngay theo tỷ lệ điều khoản)
    greatest(0, coalesce(la.tong_duyet, 0)     - coalesce(pa.tong_thuc_tra, 0)) as cong_no_den_ky,
    --  khối lượng = đã nghiệm thu − đã trả (tổng còn phải trả cả HĐ)
    greatest(0, coalesce(la.tong_nghiem_thu, 0) - coalesce(pa.tong_thuc_tra, 0)) as cong_no_khoi_luong,
    --  trên hóa đơn = đã xuất HĐ − đã trả (nghĩa vụ pháp lý, chỉ có ý nghĩa với Nhà thầu)
    greatest(0, coalesce(sc.invoiced_amount, 0) - coalesce(pa.tong_thuc_tra, 0)) as cong_no_hoa_don
from public.subcontractor_contracts sc
left join public.partners pr on pr.id = sc.partner_id
left join labor_agg la on la.contract_id = sc.id
left join pay_agg  pa on pa.contract_id = sc.id;

comment on view public.v_subcontractor_contract_debt is
    'Công nợ thầu phụ/tổ đội theo từng hợp đồng. cong_no_den_ky=duyệt−trả; cong_no_khoi_luong=nghiệm thu−trả; cong_no_hoa_don=xuất HĐ−trả (Nhà thầu).';

grant select on public.v_subcontractor_contract_debt to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 2) VIEW tổng hợp theo NHÀ THẦU/TỔ ĐỘI (gộp mọi hợp đồng của 1 partner)
-- ─────────────────────────────────────────────────────────────
create or replace view public.v_subcontractor_debt_by_partner as
select
    partner_id,
    partner_name,
    partner_short_name,
    entity_type,
    count(*)                        as so_hop_dong,
    sum(gt_hop_dong)                as gt_hop_dong,
    sum(gt_xuat_hoa_don)            as gt_xuat_hoa_don,
    sum(gt_duyet)                   as gt_duyet,
    sum(gt_nghiem_thu)              as gt_nghiem_thu,
    sum(gt_thuc_tra)                as gt_thuc_tra,
    sum(cong_no_den_ky)             as cong_no_den_ky,
    sum(cong_no_khoi_luong)         as cong_no_khoi_luong,
    sum(cong_no_hoa_don)            as cong_no_hoa_don,
    max(lan_chi_cuoi)               as lan_chi_cuoi
from public.v_subcontractor_contract_debt
where partner_id is not null
group by partner_id, partner_name, partner_short_name, entity_type;

grant select on public.v_subcontractor_debt_by_partner to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 3) CHUẨN HÓA QUYỀN: bảo đảm 4 quyền labor tồn tại trong danh mục permissions
--    (an toàn nếu bảng permissions không có/không đúng tên — bọc trong DO).
-- ─────────────────────────────────────────────────────────────
do $$
begin
    if to_regclass('public.permissions') is not null then
        insert into public.permissions (code, name, module)
        select v.code, v.name, 'labor'
          from (values
                ('view_labor',    'Xem thầu phụ / tổ đội'),
                ('manage_labor',  'Tạo/sửa/xóa đề nghị thanh toán NC'),
                ('approve_labor', 'Duyệt đề nghị thanh toán NC'),
                ('pay_labor',     'Chi tiền thanh toán NC')
               ) as v(code, name)
         where not exists (select 1 from public.permissions p where p.code = v.code);
    end if;
exception when others then
    raise notice 'Bo qua them permissions: %', sqlerrm;
end $$;

-- 3b. Gán 4 quyền labor cho admin (ROLE01/ADMIN) nếu bảng role_permissions tồn tại.
do $$
begin
    if to_regclass('public.role_permissions') is not null then
        insert into public.role_permissions (role_code, permission_code)
        select r.role_code, v.code
          from (values ('ROLE01'), ('ADMIN')) as r(role_code)
         cross join (values ('view_labor'),('manage_labor'),('approve_labor'),('pay_labor')) as v(code)
         where not exists (
            select 1 from public.role_permissions rp
             where rp.role_code = r.role_code and rp.permission_code = v.code);
    end if;
exception when others then
    raise notice 'Bo qua gan role_permissions: %', sqlerrm;
end $$;

-- ─────────────────────────────────────────────────────────────
-- 4) RLS: SELECT mở cho authenticated; GHI qua bộ quyền labor.
--    (RPC security definer đã kiểm quyền; RLS là lớp phòng thủ thứ 2 chặn ghi thẳng bảng.)
-- ─────────────────────────────────────────────────────────────
select public._apply_rls('expense_labor', 'manage_labor', 'approve_labor', 'pay_labor', 'manage_expenses');
select public._apply_rls('labor_payments', 'pay_labor', 'manage_labor');

notify pgrst, 'reload schema';

-- ─────────────────────────────────────────────────────────────
-- KIỂM TRA (chạy tay, chỉ đọc)
-- ─────────────────────────────────────────────────────────────
-- select partner_short_name, entity_type, so_hop_dong, gt_thuc_tra,
--        cong_no_den_ky, cong_no_khoi_luong, cong_no_hoa_don
--   from public.v_subcontractor_debt_by_partner order by cong_no_den_ky desc;
