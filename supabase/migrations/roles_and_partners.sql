-- ==============================================================================
-- 1. BẢNG DỰ ÁN (PROJECTS)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    client TEXT NOT NULL, -- Sẽ được thay thế bằng partner_id sau này
    original_value NUMERIC NOT NULL DEFAULT 0,
    sateco_ratio NUMERIC NOT NULL DEFAULT 95.5,
    status TEXT NOT NULL DEFAULT 'Đang thi công',
    payment_terms TEXT,
    contract_type TEXT DEFAULT 'Thi công',
    sign_date DATE,
    start_date DATE,
    end_date DATE,
    description TEXT,
    location TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Bật RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all public operations on projects" ON public.projects;
CREATE POLICY "Allow all public operations on projects" ON public.projects FOR ALL USING (true);


-- ==============================================================================
-- 2. BẢNG DANH MỤC ĐỐI TÁC (PARTNERS)
-- Hợp nhất các cột của Chủ đầu tư, NCC, Thầu phụ
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.partners (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    code TEXT UNIQUE,
    name TEXT NOT NULL,
    short_name TEXT,
    type TEXT DEFAULT 'Client', -- Client | Supplier | Subcontractor
    tax_code TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    representative TEXT,
    representative_title TEXT,
    bank_name TEXT,
    bank_account TEXT,
    notes TEXT,
    status TEXT DEFAULT 'Hoạt động',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Bật RLS
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all public operations on partners" ON public.partners;
CREATE POLICY "Allow all public operations on partners" ON public.partners FOR ALL USING (true) WITH CHECK (true);

-- Cập nhật project tham chiếu tới partner
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES public.partners(id);
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.partners(id) ON DELETE SET NULL;


-- ==============================================================================
-- 3. BẢNG PHỤ LỤC (ADDENDAS)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.addendas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    requested_value NUMERIC NOT NULL DEFAULT 0,
    sateco_value NUMERIC NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'Chờ duyệt',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.addendas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all public operations on addendas" ON public.addendas;
CREATE POLICY "Allow all public operations on addendas" ON public.addendas FOR ALL USING (true);


-- ==============================================================================
-- 4. BẢNG THEO DÕI THANH TOÁN (PAYMENTS)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    stage_name TEXT NOT NULL,
    expected_amount NUMERIC NOT NULL DEFAULT 0,
    
    -- Nghiep vu Hoa don & Thanh toan CĐT
    invoice_amount NUMERIC NOT NULL DEFAULT 0,
    invoice_date DATE,
    payment_request_amount NUMERIC NOT NULL DEFAULT 0,
    external_income NUMERIC NOT NULL DEFAULT 0,
    
    -- Nghiep vu Cong no Noi bo Sateco
    internal_debt_invoice NUMERIC NOT NULL DEFAULT 0,
    internal_debt_request NUMERIC NOT NULL DEFAULT 0,
    internal_debt_actual NUMERIC NOT NULL DEFAULT 0,
    
    -- Nghiep vu Thuc chi Sateco
    internal_paid NUMERIC NOT NULL DEFAULT 0,
    sateco_invoice_received NUMERIC NOT NULL DEFAULT 0,
    
    status TEXT NOT NULL DEFAULT 'Chưa thanh toán',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all public operations on payments" ON public.payments;
CREATE POLICY "Allow all public operations on payments" ON public.payments FOR ALL USING (true);


-- ==============================================================================
-- 5. LỊCH SỬ THANH TOÁN (INTERNAL & EXTERNAL)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.internal_payment_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    payment_stage_id UUID REFERENCES public.payments(id) ON DELETE CASCADE,
    payment_date DATE NOT NULL,
    amount NUMERIC NOT NULL DEFAULT 0,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.internal_payment_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all public operations on internal_payment_history" ON public.internal_payment_history;
CREATE POLICY "Allow all public operations on internal_payment_history" ON public.internal_payment_history FOR ALL USING (true);

CREATE TABLE IF NOT EXISTS public.external_payment_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    payment_stage_id UUID REFERENCES public.payments(id) ON DELETE CASCADE,
    payment_date DATE NOT NULL,
    amount NUMERIC NOT NULL DEFAULT 0,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.external_payment_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all public operations on external_payment_history" ON public.external_payment_history;
CREATE POLICY "Allow all public operations on external_payment_history" ON public.external_payment_history FOR ALL USING (true);

-- Khôi phục tự động các khoản thu cũ vào lịch sử (nếu rỗng)
INSERT INTO public.external_payment_history (payment_stage_id, payment_date, amount, description)
SELECT 
    id, 
    COALESCE(invoice_date, CURRENT_DATE), 
    external_income, 
    'Ghi nhận tổng (Dữ liệu cũ)'
FROM public.payments 
WHERE external_income > 0 
AND NOT EXISTS (
    SELECT 1 FROM public.external_payment_history WHERE payment_stage_id = public.payments.id
);


-- ==============================================================================
-- 6. CÁC BẢNG CHI PHÍ VÀ THẦU PHỤ (EXPENSES)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    expense_type TEXT NOT NULL CHECK (expense_type IN ('Máy thi công', 'Nghiệm thu/Thẩm duyệt', 'BCH công trường', 'Chi phí chung', 'Vật tư', 'Nhân công')),
    amount NUMERIC NOT NULL DEFAULT 0,
    expense_date DATE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all public operations on expenses" ON public.expenses;
CREATE POLICY "Allow all public operations on expenses" ON public.expenses FOR ALL USING (true);


CREATE TABLE IF NOT EXISTS public.expense_materials (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    supplier_id UUID REFERENCES public.partners(id) ON DELETE SET NULL,
    supplier_name TEXT, -- Migrate dần sang supplier_id
    item_group TEXT,
    expense_date DATE NOT NULL,
    product_name TEXT NOT NULL,
    unit TEXT,
    quantity NUMERIC NOT NULL DEFAULT 0,
    unit_price NUMERIC NOT NULL DEFAULT 0,
    vat_rate NUMERIC DEFAULT 0,
    total_amount NUMERIC NOT NULL DEFAULT 0,
    paid_amount NUMERIC NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.expense_materials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all public operations on expense_materials" ON public.expense_materials;
CREATE POLICY "Allow all public operations on expense_materials" ON public.expense_materials FOR ALL USING (true);


CREATE TABLE IF NOT EXISTS public.expense_labor (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    subcontractor_id UUID REFERENCES public.partners(id) ON DELETE SET NULL,
    team_name TEXT NOT NULL, -- Migrate dần sang subcontractor_id
    payment_stage TEXT NOT NULL DEFAULT 'Giai đoạn',
    contract_value NUMERIC NOT NULL DEFAULT 0,
    request_date DATE,
    completed_previous NUMERIC NOT NULL DEFAULT 0,
    completed_current NUMERIC NOT NULL DEFAULT 0,
    requested_amount NUMERIC NOT NULL DEFAULT 0,
    approved_amount NUMERIC NOT NULL DEFAULT 0,
    payment_date DATE,
    paid_amount NUMERIC NOT NULL DEFAULT 0,
    priority TEXT,
    labor_type TEXT,
    work_volume NUMERIC,
    unit_price NUMERIC,
    total_amount NUMERIC,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.expense_labor ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all public operations on expense_labor" ON public.expense_labor;
CREATE POLICY "Allow all public operations on expense_labor" ON public.expense_labor FOR ALL USING (true);


-- ==============================================================================
-- 7. DANH MỤC VAI TRÒ & NGƯỜI DÙNG (ROLES & PROFILES)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.roles (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all public operations on roles" ON public.roles;
CREATE POLICY "Allow all public operations on roles" ON public.roles FOR ALL USING (true);

INSERT INTO public.roles (code, name, description) VALUES
('ROLE01', 'Trưởng phòng dự án (Admin)', 'Toàn quyền hệ thống'),
('ROLE02', 'Giám đốc', 'Xem báo cáo, duyệt thanh toán cuối'),
('ROLE03', 'Bộ phận vật tư', 'Quản lý NCC, mua sắm, nhập xuất kho tổng'),
('ROLE04', 'Bộ phận kiểm soát khối lượng', 'Kiểm soát đơn hàng, khối lượng'),
('ROLE05', 'Bộ phận thanh toán thầu phụ', 'Quản lý thầu phụ, duyệt thanh toán'),
('ROLE06', 'Bộ phận theo dõi hợp đồng', 'Theo dõi hợp đồng, thanh toán CĐT'),
('ROLE07', 'Quản lý dự án / Chỉ huy trưởng', 'Duyệt yêu cầu vật tư, theo dõi site'),
('ROLE08', 'Kỹ sư các bộ môn', 'Tạo yêu cầu vật tư dự án'),
('ROLE09', 'Kho dự án', 'Nhập xuất vật tư tại công trường'),
('ROLE10', 'Quản lý kho (Tổng)', 'Quản lý kho tổng'),
('ROLE11', 'Nhân viên kho (Tổng)', 'Nhập xuất kho tổng')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    full_name TEXT,
    role_code TEXT REFERENCES public.roles(code),
    avatar_url TEXT,
    email TEXT,
    status TEXT DEFAULT 'Hoạt động',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Hố trợ xem danh sách mail cho quản trị viên
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all public operations on profiles" ON public.profiles;
CREATE POLICY "Allow all public operations on profiles" ON public.profiles FOR ALL USING (true);
