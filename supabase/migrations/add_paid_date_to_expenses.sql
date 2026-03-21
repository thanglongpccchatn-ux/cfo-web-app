-- ==============================================================================
-- MIGRATION: Bổ sung cột Ngày chi thực tế (paid_date) cho bảng expenses
-- ==============================================================================

ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS paid_date DATE;

-- Cập nhật mặc định cho các bản ghi cũ: ngày thực chi = ngày đề xuất (nếu đã có paid_amount)
UPDATE public.expenses 
SET paid_date = expense_date 
WHERE paid_date IS NULL AND paid_amount > 0;
