-- ============================================================
--  RPC XÓA DỰ ÁN ATOMIC (từ review module Hợp đồng & Thanh toán)
--  Thay chuỗi 5+ lệnh delete rời rạc phía client (ContractMasterDetail):
--  lỗi giữa chừng (thiếu quyền vật tư, FK...) để lại dữ liệu dở dang.
--  RPC = 1 transaction: hoặc xóa hết, hoặc rollback sạch.
--  ⚠️ CHẠY SAU db/payments_history_cascade.sql (lịch sử thanh toán cascade theo payments).
--  ⚠️ CHẠY TRÊN SUPABASE SQL EDITOR, sau đó: notify pgrst, 'reload schema';
-- ============================================================

create or replace function public.delete_project_cascade(p_project_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
    -- Cùng quyền với policy xóa projects (admin luôn qua).
    if not public.current_user_has_perm('delete_contracts') then
        raise exception 'forbidden';
    end if;
    if not exists (select 1 from public.projects where id = p_project_id) then
        raise exception 'project not found';
    end if;

    -- Kho: các bảng không có FK cascade theo project (giữ nguyên hành vi client cũ, nhưng atomic)
    delete from public.inventory_receipt_items
        where receipt_id in (select id from public.inventory_receipts where project_id = p_project_id);
    delete from public.inventory_receipts where project_id = p_project_id;
    delete from public.inventory_request_items
        where request_id in (select id from public.inventory_requests where project_id = p_project_id);
    delete from public.inventory_requests where project_id = p_project_id;

    -- Thanh toán: xóa lịch sử con trước cho chắc (nếu FK đã cascade thì các lệnh này vô hại),
    -- rồi xóa các đợt thanh toán của dự án.
    delete from public.external_payment_history
        where payment_stage_id in (select id from public.payments where project_id = p_project_id);
    delete from public.internal_payment_history
        where payment_stage_id in (select id from public.payments where project_id = p_project_id);
    delete from public.payments where project_id = p_project_id;

    -- Cuối cùng: xóa dự án (các bảng khác có FK on delete cascade theo project_id sẽ tự dọn).
    delete from public.projects where id = p_project_id;
end $$;

grant execute on function public.delete_project_cascade(uuid) to authenticated;

notify pgrst, 'reload schema';
