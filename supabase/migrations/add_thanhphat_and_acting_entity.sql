-- ==========================================
-- MIGRATION: Bổ sung Thành Phát & Phân loại Pháp nhân ký kết
-- ==========================================

-- 1. Thêm Thành Phát vào công ty nội bộ
INSERT INTO public.company_settings (company_key, company_name, tax_code)
VALUES ('thanhphat', 'CÔNG TY TNHH THÀNH PHÁT', '')
ON CONFLICT (company_key) DO NOTHING;

-- 2. Thêm trường acting_entity_id vào bảng projects (mặc định lấy Thăng Long)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'acting_entity_id') THEN
        ALTER TABLE public.projects ADD COLUMN acting_entity_id UUID REFERENCES public.company_settings(id);
        
        -- Cập nhật dữ liệu cũ mặc định là Thăng Long
        UPDATE public.projects SET acting_entity_id = (SELECT id FROM public.company_settings WHERE company_key = 'thanglong')
        WHERE acting_entity_id IS NULL;
    END IF;
END $$;
