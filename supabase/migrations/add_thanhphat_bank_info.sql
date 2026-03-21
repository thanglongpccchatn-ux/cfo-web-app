-- ==========================================
-- BỔ SUNG THÔNG TIN NGÂN HÀNG THÀNH PHÁT
-- ==========================================

-- 1. Bổ sung cho bảng Projects (Lưu trữ theo từng Hợp đồng)
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS tp_bank_account TEXT,
ADD COLUMN IF NOT EXISTS tp_bank_name TEXT,
ADD COLUMN IF NOT EXISTS tp_bank_branch TEXT,
ADD COLUMN IF NOT EXISTS tp_account_holder TEXT;

-- 2. Bổ sung cho bảng Bank Profiles (Cấu hình chọn nhanh)
ALTER TABLE public.company_bank_profiles
ADD COLUMN IF NOT EXISTS tp_account_number TEXT,
ADD COLUMN IF NOT EXISTS tp_bank_name TEXT,
ADD COLUMN IF NOT EXISTS tp_branch TEXT,
ADD COLUMN IF NOT EXISTS tp_holder TEXT DEFAULT 'CÔNG TY TNHH THÀNH PHÁT';

-- 3. Cập nhật thông tin mẫu cho MSB profile (nếu đã tồn tại)
UPDATE public.company_bank_profiles 
SET 
    tp_bank_name = 'Ngân hàng MSB',
    tp_account_number = '111222333',
    tp_branch = 'CN Hà Nội',
    tp_holder = 'CÔNG TY TNHH THÀNH PHÁT'
WHERE label = 'MSB';

-- 4. Cập nhật thông tin liên hệ/ngân hàng mặc định cho Thành Phát trong company_settings
UPDATE public.company_settings
SET 
    bank_name = 'Ngân hàng MSB',
    bank_account = '111222333',
    bank_branch = 'CN Hà Nội',
    account_holder = 'CÔNG TY TNHH THÀNH PHÁT'
WHERE company_key = 'thanhphat' AND (bank_account IS NULL OR bank_account = '');
