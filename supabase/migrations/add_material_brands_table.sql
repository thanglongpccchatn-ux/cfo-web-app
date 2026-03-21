-- Tạo bảng Hãng sản xuất (Brands)
CREATE TABLE IF NOT EXISTS public.material_brands (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Bật RLS
ALTER TABLE public.material_brands ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all public operations on material_brands" ON public.material_brands;
CREATE POLICY "Allow all public operations on material_brands" ON public.material_brands FOR ALL USING (true);

-- Đảm bảo bảng material_categories cũng có RLS thông thoáng (nếu chưa có)
-- Thường bảng này đã được tạo ở migration trước, mình chỉ check RLS
ALTER TABLE public.material_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all public operations on material_categories" ON public.material_categories;
CREATE POLICY "Allow all public operations on material_categories" ON public.material_categories FOR ALL USING (true);

-- Insert dữ liệu mẫu cho Hãng sản xuất
INSERT INTO public.material_brands (name) VALUES 
('Tiền Phong'), 
('Panasonic'), 
('Trần Phú'), 
('Sino'), 
('Cadisun'), 
('Schneider'),
('Vĩnh Tường'),
('Daikin'),
('Mitsubishi')
ON CONFLICT (name) DO NOTHING;

-- Insert dữ liệu mẫu cho Danh mục (Nếu bảng đang trống)
INSERT INTO public.material_categories (code, name) VALUES 
('ONG', 'Ống nhựa & Phụ kiện'),
('DAY', 'Dây & Cáp điện'),
('THIETBI', 'Thiết bị điện'),
('DEN', 'Đèn chiếu sáng'),
('DIEUHOA', 'Điều hòa không khí'),
('SON', 'Sơn & Chống thấm'),
('SAT', 'Sắt thép xây dựng')
ON CONFLICT (code) DO NOTHING;
