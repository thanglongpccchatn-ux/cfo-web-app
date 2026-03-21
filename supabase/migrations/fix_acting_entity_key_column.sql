-- ==========================================
-- BỔ SUNG CỘT acting_entity_key VÀO BẢNG projects
-- ==========================================

-- 1. Thêm cột acting_entity_key (Lưu định danh text để hiển thị Badge nhanh)
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS acting_entity_key TEXT DEFAULT 'thanglong';

-- 2. Đồng bộ hóa dữ liệu từ acting_entity_id sang acting_entity_key (nếu đã có id)
UPDATE public.projects p
SET acting_entity_key = c.company_key
FROM public.company_settings c
WHERE p.acting_entity_id = c.id
AND p.acting_entity_key IS NULL OR p.acting_entity_key = 'thanglong';

-- 3. Đảm bảo Thành Phát có acting_entity_key đúng
UPDATE public.projects 
SET acting_entity_key = 'thanhphat'
WHERE acting_entity_id = (SELECT id FROM public.company_settings WHERE company_key = 'thanhphat');
