-- ==============================================================================
-- 1. BẢNG NHÀ CUNG CẤP (SUPPLIERS)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.suppliers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    code TEXT UNIQUE,
    name TEXT NOT NULL,
    short_name TEXT,
    tax_code TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    contact_person TEXT,
    bank_name TEXT,
    bank_account TEXT,
    bank_branch TEXT,
    account_holder TEXT,
    notes TEXT,
    status TEXT DEFAULT 'Hoạt động',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all public operations on suppliers" ON public.suppliers;
CREATE POLICY "Allow all public operations on suppliers" ON public.suppliers FOR ALL USING (true);


-- ==============================================================================
-- 2. BẢNG THẦU PHỤ / TỔ ĐỘI (SUBCONTRACTORS)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.subcontractors (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    code TEXT UNIQUE,
    name TEXT NOT NULL,
    short_name TEXT,
    tax_code TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    contact_person TEXT,
    bank_name TEXT,
    bank_account TEXT,
    bank_branch TEXT,
    account_holder TEXT,
    notes TEXT,
    status TEXT DEFAULT 'Hoạt động',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.subcontractors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all public operations on subcontractors" ON public.subcontractors;
CREATE POLICY "Allow all public operations on subcontractors" ON public.subcontractors FOR ALL USING (true);


-- ==============================================================================
-- 3. DANH MỤC VẬT TƯ (MATERIAL CATEGORIES)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.material_categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    short_name TEXT,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.material_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all public operations on material_categories" ON public.material_categories;
CREATE POLICY "Allow all public operations on material_categories" ON public.material_categories FOR ALL USING (true);


-- ==============================================================================
-- 4. BẢNG VẬT TƯ (MATERIALS)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.materials (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    category_code TEXT REFERENCES public.material_categories(code) ON DELETE SET NULL,
    brand TEXT,
    model TEXT,
    
    -- Đơn giá & Chiết khấu (Bulk Updates Support)
    unit TEXT NOT NULL DEFAULT 'Cái', -- ĐVT chuẩn (Báo cáo)
    base_price NUMERIC NOT NULL DEFAULT 0, -- Giá niêm yết
    discount_percentage NUMERIC DEFAULT 0, -- Chiết khấu %
    actual_price NUMERIC GENERATED ALWAYS AS (base_price * (1 - COALESCE(discount_percentage, 0) / 100)) STORED,
    weight_per_unit NUMERIC, -- Trọng lượng kg/ĐVT chuẩn (Ví dụ 2.5kg / Cây)
    
    -- Tồn kho & Quy đổi
    min_inventory NUMERIC DEFAULT 0,
    import_unit TEXT,
    import_conversion_rate NUMERIC DEFAULT 1,
    export_unit TEXT,
    export_conversion_rate NUMERIC DEFAULT 1,
    
    notes TEXT,
    status TEXT DEFAULT 'Hoạt động',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all public operations on materials" ON public.materials;
CREATE POLICY "Allow all public operations on materials" ON public.materials FOR ALL USING (true);


-- ==============================================================================
-- 5. CẬP NHẬT DỰ ÁN (PROJECTS) VÀ CÁC THAM CHIẾU (EXPENSES)
-- ==============================================================================

-- Thêm metadata cho Dự án
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS project_type TEXT,
ADD COLUMN IF NOT EXISTS location TEXT,
ADD COLUMN IF NOT EXISTS manager TEXT;

-- Sửa expense_materials trỏ về suppliers (Thay vì partner_id rỗng)
ALTER TABLE public.expense_materials
ADD COLUMN IF NOT EXISTS supplier_id UUID;

ALTER TABLE public.expense_materials
DROP CONSTRAINT IF EXISTS expense_materials_supplier_id_fkey;
ALTER TABLE public.expense_materials
ADD CONSTRAINT expense_materials_supplier_id_fkey 
FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL;

-- Sửa expense_labor trỏ về subcontractors
ALTER TABLE public.expense_labor
ADD COLUMN IF NOT EXISTS subcontractor_id UUID;

ALTER TABLE public.expense_labor
DROP CONSTRAINT IF EXISTS expense_labor_subcontractor_id_fkey;
ALTER TABLE public.expense_labor
ADD CONSTRAINT expense_labor_subcontractor_id_fkey 
FOREIGN KEY (subcontractor_id) REFERENCES public.subcontractors(id) ON DELETE SET NULL;
