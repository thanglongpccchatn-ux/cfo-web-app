-- ==============================================================================
-- MIGRATION: Nâng cấp bảng payments cho Module Thanh toán & Hồ sơ chuyên nghiệp
-- ==============================================================================

-- 1. Bổ sung các cột phục vụ theo dõi thanh toán thông minh
ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS payment_code TEXT,
ADD COLUMN IF NOT EXISTS due_date DATE,
ADD COLUMN IF NOT EXISTS invoice_status TEXT DEFAULT 'Chưa xuất',
ADD COLUMN IF NOT EXISTS document_url TEXT,
ADD COLUMN IF NOT EXISTS completion_date DATE,
ADD COLUMN IF NOT EXISTS stage_type TEXT DEFAULT 'Nghiệm thu',
ADD COLUMN IF NOT EXISTS addenda_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- 2. Cập nhật chú thích cho các cột (Optional but helpful)
COMMENT ON COLUMN public.payments.payment_code IS 'Mã thanh toán tự động hoặc nhập tay (VD: IPC01-ABC)';
COMMENT ON COLUMN public.payments.due_date IS 'Ngày đến hạn thanh toán dự kiến (thường là Ngày đề nghị + 30 ngày)';
COMMENT ON COLUMN public.payments.invoice_status IS 'Trạng thái hóa đơn: Đã xuất / Chưa xuất';
COMMENT ON COLUMN public.payments.completion_date IS 'Ngày thực tế thanh toán xong (để theo dõi trả muộn)';

-- 3. Tạo index để tối ưu truy vấn cho module Hồ sơ
CREATE INDEX IF NOT EXISTS idx_payments_due_date ON public.payments(due_date);
CREATE INDEX IF NOT EXISTS idx_payments_invoice_status ON public.payments(invoice_status);
