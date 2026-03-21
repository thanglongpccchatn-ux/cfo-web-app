-- ==========================================
-- BẢN VÁ TỔNG HỢP: CẤU TRÚC ĐA THỰC THỂ (ACTING ENTITY)
-- ==========================================

-- 1. Đảm bảo bảng company_settings có đủ dữ liệu gốc
INSERT INTO public.company_settings (company_key, company_name, tax_code)
VALUES 
    ('thanglong', 'CÔNG TY TNHH THĂNG LONG', ''),
    ('thanhphat', 'CÔNG TY TNHH THÀNH PHÁT', ''),
    ('sateco', 'CÔNG TY CP SATECO', '')
ON CONFLICT (company_key) DO NOTHING;

-- 2. Bổ sung cột acting_entity_id (Liên kết UUID)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'acting_entity_id') THEN
        ALTER TABLE public.projects ADD COLUMN acting_entity_id UUID REFERENCES public.company_settings(id);
    END IF;
END $$;

-- 3. Bổ sung cột acting_entity_key (Định danh Text - Quan trọng để hiển thị Badge)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'acting_entity_key') THEN
        ALTER TABLE public.projects ADD COLUMN acting_entity_key TEXT DEFAULT 'thanglong';
    END IF;
END $$;

-- 4. Đồng bộ hóa dữ liệu hiện có (Mặc định về Thăng Long cho các dự án cũ)
UPDATE public.projects 
SET 
    acting_entity_key = 'thanglong',
    acting_entity_id = (SELECT id FROM public.company_settings WHERE company_key = 'thanglong')
WHERE acting_entity_key IS NULL OR acting_entity_id IS NULL;

-- 5. Cập nhật riêng cho các dự án của Thành Phát (nếu có dấu hiệu nhận biết qua mã HĐ)
-- Ví dụ: Nếu mã HĐ có chữ TP
UPDATE public.projects
SET 
    acting_entity_key = 'thanhphat',
    acting_entity_id = (SELECT id FROM public.company_settings WHERE company_key = 'thanhphat')
WHERE code ILIKE '%TP%' OR internal_code ILIKE '%TP%';
