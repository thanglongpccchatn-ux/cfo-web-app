-- ==============================================================================
-- 1. MỞ RỘNG CÁC BẢNG HIỆN CÓ ĐỂ PHỤC VỤ WMS
-- ==============================================================================

-- Bổ sung cho bảng partners (Ncc/Thầu phụ)
ALTER TABLE public.partners 
ADD COLUMN IF NOT EXISTS rating INTEGER DEFAULT 5,
ADD COLUMN IF NOT EXISTS projects_count INTEGER DEFAULT 0;

-- Bổ sung cho bảng materials (Vật tư)
ALTER TABLE public.materials
ADD COLUMN IF NOT EXISTS manufacturer TEXT,
ADD COLUMN IF NOT EXISTS group_name TEXT,
ADD COLUMN IF NOT EXISTS sub_category TEXT;

-- ==============================================================================
-- 2. QUẢN LÝ KHO (WAREHOUSES)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.inventory_warehouses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- 'Kho trung tâm', 'Kho dự án', 'Kho ảo'
    location TEXT,
    capacity NUMERIC,
    manager_id UUID REFERENCES auth.users(id),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'Hoạt động',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.inventory_warehouses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all public operations on inventory_warehouses" ON public.inventory_warehouses FOR ALL USING (true);

-- ==============================================================================
-- 3. TỒN KHO THỰC TẾ (STOCKS)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.inventory_stocks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    warehouse_id UUID REFERENCES public.inventory_warehouses(id) ON DELETE CASCADE,
    material_id UUID REFERENCES public.materials(id) ON DELETE CASCADE,
    quantity NUMERIC DEFAULT 0 NOT NULL,
    min_stock NUMERIC DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(warehouse_id, material_id)
);

ALTER TABLE public.inventory_stocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all public operations on inventory_stocks" ON public.inventory_stocks FOR ALL USING (true);

-- ==============================================================================
-- 4. PHIẾU NHẬP/XUẤT (RECEIPTS)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.inventory_receipts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    type TEXT NOT NULL, -- 'NHAP_NCC', 'XUAT_CONG_TRUONG', 'DIEU_CHUYEN', 'TRA_HANG'
    code TEXT UNIQUE NOT NULL, -- Số phiếu (VD: PN001, PX001)
    date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Đối tượng liên quan
    warehouse_id UUID REFERENCES public.inventory_warehouses(id), -- Kho đích (nếu là Nhập) hoặc Kho nguồn (nếu là Xuất)
    target_warehouse_id UUID REFERENCES public.inventory_warehouses(id), -- Cho trường hợp điều chuyển
    partner_id UUID REFERENCES public.partners(id), -- Nhà cung cấp hoặc Thầu phụ
    project_id UUID REFERENCES public.projects(id),
    
    -- Người thực hiện
    created_by UUID REFERENCES auth.users(id),
    receiver_name TEXT, -- Tên người nhận hàng (nếu xuất)
    deliverer_name TEXT, -- Tên người giao hàng (nếu nhập)
    
    status TEXT DEFAULT 'Chờ duyệt', -- 'Chờ duyệt', 'Đã duyệt', 'Đã hủy'
    notes TEXT,
    total_amount NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.inventory_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all public operations on inventory_receipts" ON public.inventory_receipts FOR ALL USING (true);

-- CHI TIẾT PHIẾU
CREATE TABLE IF NOT EXISTS public.inventory_receipt_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    receipt_id UUID REFERENCES public.inventory_receipts(id) ON DELETE CASCADE,
    material_id UUID REFERENCES public.materials(id),
    quantity NUMERIC NOT NULL, -- Số lượng thực tế
    doc_quantity NUMERIC, -- Số lượng theo chứng từ
    unit TEXT, -- Đơn vị lúc nhập/xuất
    unit_price NUMERIC DEFAULT 0,
    conversion_rate NUMERIC DEFAULT 1, -- Tỷ lệ quy đổi tại thời điểm đó
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.inventory_receipt_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all public operations on inventory_receipt_items" ON public.inventory_receipt_items FOR ALL USING (true);

-- ==============================================================================
-- 5. YÊU CẦU VẬT TƯ (MATERIAL REQUESTS)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.inventory_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    project_id UUID REFERENCES public.projects(id),
    requester_name TEXT,
    team_name TEXT,
    date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    priority TEXT DEFAULT 'Bình thường',
    status TEXT DEFAULT 'Chờ duyệt',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.inventory_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all public operations on inventory_requests" ON public.inventory_requests FOR ALL USING (true);

-- Chi tiết yêu cầu
CREATE TABLE IF NOT EXISTS public.inventory_request_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    request_id UUID REFERENCES public.inventory_requests(id) ON DELETE CASCADE,
    material_id UUID REFERENCES public.materials(id),
    material_name_manual TEXT, -- Trường hợp vật tư chưa có trong danh mục
    quantity NUMERIC NOT NULL,
    unit TEXT,
    note TEXT
);

ALTER TABLE public.inventory_request_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all public operations on inventory_request_items" ON public.inventory_request_items FOR ALL USING (true);
