-- ============================================================
-- Migration: Thêm cột status cho expense_labor
-- Hỗ trợ Workflow 2 Bước: PENDING → PAID
-- ============================================================

-- Thêm cột status
ALTER TABLE public.expense_labor
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'PENDING';

-- Migrate dữ liệu cũ: phiếu đã có paid_amount > 0 → PAID
UPDATE public.expense_labor
SET status = 'PAID'
WHERE paid_amount > 0 AND (status IS NULL OR status = 'PENDING');

-- Comment
COMMENT ON COLUMN public.expense_labor.status IS 'Trạng thái phiếu: PENDING (Chờ Kế Toán Chi) | PAID (Đã Chi Tiền)';
