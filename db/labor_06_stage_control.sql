-- ============================================================
--  KIỂM SOÁT THEO GIAI ĐOẠN — bổ sung tỷ lệ thanh toán vào view công nợ
--
--  VẤN ĐỀ: hợp đồng thầu phụ đã khai sẵn 4 mốc tỷ lệ (pct_rough / pct_install /
--  pct_acceptance / pct_settlement — VD hệ FF: 70% / 85% / — / 95%), nhưng luồng
--  đề nghị → duyệt → chi KHÔNG đọc mấy con số này, nên trần thanh toán từng giai
--  đoạn hoàn toàn phụ thuộc người duyệt tự nhẩm tay.
--
--  SAU FILE NÀY: view trả thêm tỷ lệ + tạm ứng để giao diện tự tính:
--     trần lũy kế đến mốc X = giá trị HĐ (sau VAT) × pct_X%
--     còn được đề nghị       = trần − đã duyệt lũy kế
--
--  ⚠️ CHẠY TRÊN SUPABASE SQL EDITOR (sau labor_04_debt_rls.sql).
-- ============================================================

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
           sum(lp.deduction_amount)                as tong_khau_tru,
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
    coalesce(pr.entity_type, 'team')               as entity_type,
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
    -- CÔNG NỢ 2 TẦNG
    greatest(0, coalesce(la.tong_duyet, 0)      - coalesce(pa.tong_thuc_tra, 0)) as cong_no_den_ky,
    greatest(0, coalesce(la.tong_nghiem_thu, 0) - coalesce(pa.tong_thuc_tra, 0)) as cong_no_khoi_luong,
    greatest(0, coalesce(sc.invoiced_amount, 0) - coalesce(pa.tong_thuc_tra, 0)) as cong_no_hoa_don,
    -- ── CỘT MỚI: đặt Ở CUỐI vì CREATE OR REPLACE VIEW không cho chèn cột giữa
    -- danh sách cũ (Postgres coi đó là đổi tên cột, bị chặn) — chỉ được nối thêm.
    -- TỶ LỆ THANH TOÁN THEO GIAI ĐOẠN (nguồn để tính trần từng mốc)
    coalesce(sc.pct_rough, 0)                      as pct_rough,
    coalesce(sc.pct_install, 0)                    as pct_install,
    coalesce(sc.pct_acceptance, 0)                 as pct_acceptance,
    coalesce(sc.pct_settlement, 0)                 as pct_settlement,
    coalesce(pa.tong_khau_tru, 0)                  as gt_khau_tru
from public.subcontractor_contracts sc
left join public.partners pr on pr.id = sc.partner_id
left join labor_agg la on la.contract_id = sc.id
left join pay_agg  pa on pa.contract_id = sc.id;

comment on view public.v_subcontractor_contract_debt is
    'Công nợ thầu phụ theo hợp đồng + tỷ lệ thanh toán từng mốc (pct_*) để giao diện tự tính trần lũy kế được phép thanh toán.';

grant select on public.v_subcontractor_contract_debt to authenticated;

-- View gộp theo nhà thầu giữ nguyên cấu trúc cũ (tạo lại vì view cha vừa đổi)
create or replace view public.v_subcontractor_debt_by_partner as
select
    partner_id, partner_name, partner_short_name, entity_type,
    count(*)                as so_hop_dong,
    sum(gt_hop_dong)        as gt_hop_dong,
    sum(gt_xuat_hoa_don)    as gt_xuat_hoa_don,
    sum(gt_duyet)           as gt_duyet,
    sum(gt_nghiem_thu)      as gt_nghiem_thu,
    sum(gt_thuc_tra)        as gt_thuc_tra,
    sum(cong_no_den_ky)     as cong_no_den_ky,
    sum(cong_no_khoi_luong) as cong_no_khoi_luong,
    sum(cong_no_hoa_don)    as cong_no_hoa_don,
    max(lan_chi_cuoi)       as lan_chi_cuoi
from public.v_subcontractor_contract_debt
where partner_id is not null
group by partner_id, partner_name, partner_short_name, entity_type;

grant select on public.v_subcontractor_debt_by_partner to authenticated;

notify pgrst, 'reload schema';

-- ─────────────────────────────────────────────────────────────
-- KIỂM TRA: xem trần từng mốc của một hợp đồng
-- ─────────────────────────────────────────────────────────────
-- select contract_code, gt_hop_dong,
--        round(gt_hop_dong * pct_rough      / 100) as tran_phan_tho,
--        round(gt_hop_dong * pct_install    / 100) as tran_lap_dat,
--        round(gt_hop_dong * pct_settlement / 100) as tran_quyet_toan,
--        gt_duyet, gt_thuc_tra
--   from public.v_subcontractor_contract_debt
--  order by gt_hop_dong desc limit 10;
