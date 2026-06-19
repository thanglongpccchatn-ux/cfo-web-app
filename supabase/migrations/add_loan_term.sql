-- ==============================================================================
-- MIGRATION: Add loan_term (kỳ hạn vay) to loans table
-- Description: Thêm kỳ hạn vay (tháng), tự động tính ngày đáo hạn
-- ==============================================================================

-- Thêm cột kỳ hạn vay (số tháng)
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS loan_term INTEGER;
-- COMMENT: loan_term = số tháng vay. VD: 3, 6, 12, 24...

