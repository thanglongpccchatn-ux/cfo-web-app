-- Thêm trường VAT Nội bộ (mặc định 8) cho bảng Hợp đồng
ALTER TABLE projects ADD COLUMN IF NOT EXISTS internal_vat_percentage numeric DEFAULT 8;

-- Thêm trường VAT Nội bộ (mặc định 8) cho từng giai đoạn thanh toán
ALTER TABLE payments ADD COLUMN IF NOT EXISTS internal_vat_percentage numeric DEFAULT 8;
