-- ==============================================================================
-- MIGRATION: Trigger tự động cập nhật tổng thanh toán từ lịch sử
-- ==============================================================================

-- 1. Hàm tính toán và cập nhật số tổng external_income
CREATE OR REPLACE FUNCTION public.fn_sync_external_income()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        UPDATE public.payments
        SET external_income = (
            SELECT COALESCE(SUM(amount), 0)
            FROM public.external_payment_history
            WHERE payment_stage_id = NEW.payment_stage_id
        )
        WHERE id = NEW.payment_stage_id;
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE public.payments
        SET external_income = (
            SELECT COALESCE(SUM(amount), 0)
            FROM public.external_payment_history
            WHERE payment_stage_id = OLD.payment_stage_id
        )
        WHERE id = OLD.payment_stage_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 2. Tạo Trigger cho bảng external_payment_history
DROP TRIGGER IF EXISTS trg_sync_external_income ON public.external_payment_history;
CREATE TRIGGER trg_sync_external_income
AFTER INSERT OR UPDATE OR DELETE ON public.external_payment_history
FOR EACH ROW EXECUTE FUNCTION public.fn_sync_external_income();

-- 3. Đồng nhất dữ liệu hiện tại (Chạy 1 lần)
UPDATE public.payments p
SET external_income = (
    SELECT COALESCE(SUM(amount), 0)
    FROM public.external_payment_history eph
    WHERE eph.payment_stage_id = p.id
);
