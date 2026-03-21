-- ==============================================================================
-- MIGRATION: Nâng cấp bảng projects + Tạo bảng company_settings
-- ==============================================================================

-- 1. Bổ sung cột chiết khấu nội bộ vào projects
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS internal_deduction NUMERIC(5,2) DEFAULT 0;

-- 2. Bổ sung cột bảo hành
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS warranty_ratio NUMERIC(5,2) DEFAULT 5,
ADD COLUMN IF NOT EXISTS warranty_period_months INTEGER DEFAULT 12,
ADD COLUMN IF NOT EXISTS has_warranty_bond BOOLEAN DEFAULT false;

-- 3. Bổ sung cột TK ngân hàng thụ hưởng cho từng HĐ (override settings chung)
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS tl_bank_account TEXT,
ADD COLUMN IF NOT EXISTS tl_bank_name TEXT,
ADD COLUMN IF NOT EXISTS tl_bank_branch TEXT,
ADD COLUMN IF NOT EXISTS tl_account_holder TEXT,
ADD COLUMN IF NOT EXISTS st_bank_account TEXT,
ADD COLUMN IF NOT EXISTS st_bank_name TEXT,
ADD COLUMN IF NOT EXISTS st_bank_branch TEXT,
ADD COLUMN IF NOT EXISTS st_account_holder TEXT;

-- 4. Bảng cài đặt chung công ty (Company Settings)
CREATE TABLE IF NOT EXISTS public.company_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_key TEXT NOT NULL UNIQUE, -- 'thanglong' hoặc 'sateco'
    company_name TEXT NOT NULL,
    tax_code TEXT,
    address TEXT,
    representative TEXT,
    representative_title TEXT,
    bank_account TEXT,
    bank_name TEXT,
    bank_branch TEXT,
    account_holder TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Bật RLS
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on company_settings"
    ON public.company_settings FOR ALL USING (true) WITH CHECK (true);

-- 5. Insert dữ liệu mặc định
INSERT INTO public.company_settings (company_key, company_name, tax_code)
VALUES
    ('thanglong', 'CÔNG TY TNHH THĂNG LONG', ''),
    ('sateco', 'CÔNG TY CP SATECO', '')
ON CONFLICT (company_key) DO NOTHING;

-- Xác nhận
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'projects'
AND column_name IN ('internal_deduction', 'warranty_ratio', 'warranty_period_months', 'has_warranty_bond', 'tl_bank_account', 'st_bank_account');
