-- ==============================================================================
-- MIGRATION SCRIPT: COMPANY SETTINGS (DYNAMIC BRANDING)
-- Description: Creates a table to store company-wide settings (Logo, Colors, Fonts)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.company_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name TEXT NOT NULL DEFAULT 'Thăng Long',
    sub_name TEXT DEFAULT 'Construction & Admin',
    logo_url TEXT,
    logo_icon TEXT DEFAULT 'apartment',
    primary_color TEXT DEFAULT '#005faf',
    primary_hover_color TEXT DEFAULT '#004786',
    sidebar_bg_light TEXT DEFAULT '#ffffff',
    sidebar_bg_dark TEXT DEFAULT '#111827',
    app_bg_light TEXT DEFAULT '#f8fafc',
    app_bg_dark TEXT DEFAULT '#0f172a',
    font_family TEXT DEFAULT '''Inter'', sans-serif',
    font_url TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by UUID REFERENCES public.profiles(id)
);

-- Ensure only one active row exists by truncating or checking
-- Alternatively, just insert a single predefined UUID
INSERT INTO public.company_settings (id) 
VALUES ('11111111-1111-1111-1111-111111111111') 
ON CONFLICT (id) DO NOTHING;

-- Enable Row Level Security
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

-- 1. Mọi người đều có thể đọc (để trang Login hiện đúng Logo khi chưa đăng nhập)
DROP POLICY IF EXISTS "Cho phép đọc công khai cài đặt" ON public.company_settings;
CREATE POLICY "Cho phép đọc công khai cài đặt" 
ON public.company_settings FOR SELECT 
TO public
USING (true);

-- 2. Chỉ có Admin mới được sửa cài đặt
DROP POLICY IF EXISTS "Chỉ Admin được cập nhật cài đặt" ON public.company_settings;
CREATE POLICY "Chỉ Admin được cập nhật cài đặt" 
ON public.company_settings FOR UPDATE 
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND (role_code = 'ROLE01' OR role_code = 'ADMIN')
    )
);
