-- ==========================================
-- BẢNG CẤU HÌNH NGÂN HÀNG NHANH (BANK PROFILES)
-- ==========================================

CREATE TABLE IF NOT EXISTS public.company_bank_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label TEXT UNIQUE NOT NULL, -- Ví dụ: 'MSB', 'Techcombank'
    
    -- Thông tin Thăng Long
    tl_account_number TEXT,
    tl_bank_name TEXT,
    tl_branch TEXT,
    tl_holder TEXT DEFAULT 'CÔNG TY TNHH THĂNG LONG',
    
    -- Thông tin Sateco
    st_account_number TEXT,
    st_bank_name TEXT,
    st_branch TEXT,
    st_holder TEXT DEFAULT 'CÔNG TY CP SATECO',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Bật RLS
ALTER TABLE public.company_bank_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cho phép tất cả thao tác trên company_bank_profiles"
    ON public.company_bank_profiles FOR ALL USING (true) WITH CHECK (true);

-- Insert dữ liệu mẫu (MSB như yêu cầu)
INSERT INTO public.company_bank_profiles 
(label, tl_bank_name, st_bank_name, tl_account_number, st_account_number, tl_branch, st_branch)
VALUES 
('MSB', 'Ngân hàng MSB', 'Ngân hàng MSB', '123456789', '987654321', 'CN Hà Nội', 'CN Hà Nội')
ON CONFLICT (label) DO NOTHING;
