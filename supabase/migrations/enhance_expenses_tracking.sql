-- ==============================================================================
-- MIGRATION: Nâng cấp bảng expenses để hỗ trợ Đối soát Kế hoạch vs Thực tế
-- ==============================================================================

-- 1. Thêm cột paid_amount (Số tiền thực tế đã chi)
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS paid_amount NUMERIC NOT NULL DEFAULT 0;

-- 2. Cập nhật Ràng buộc loại chi phí (expense_type) để khớp với cơ cấu bộ phận mới
-- Phải xóa ràng buộc cũ trước
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'expenses_expense_type_check') THEN
        ALTER TABLE public.expenses DROP CONSTRAINT expenses_expense_type_check;
    END IF;
END $$;

ALTER TABLE public.expenses ADD CONSTRAINT expenses_expense_type_check 
CHECK (expense_type IN ('Máy thi công', 'Nghiệm thu/Thẩm duyệt', 'BCH công trường', 'Chi phí chung', 'Vật tư', 'Nhân công', 'Vận hành', 'Khác'));

-- 3. Cập nhật các bản ghi cũ: coi như đã chi đủ nếu chưa có dữ liệu paid_amount
UPDATE public.expenses SET paid_amount = amount WHERE paid_amount = 0;
