-- Bảng Projects (Hợp đồng gốc)
CREATE TABLE public.projects (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    client TEXT NOT NULL,
    payment_terms TEXT,
    original_value NUMERIC NOT NULL DEFAULT 0,
    sateco_ratio NUMERIC NOT NULL DEFAULT 95.5,
    status TEXT NOT NULL DEFAULT 'Đang thi công',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Bảng Addendas (Phụ lục phát sinh)
CREATE TABLE public.addendas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    requested_value NUMERIC NOT NULL DEFAULT 0,
    sateco_value NUMERIC NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'Chờ duyệt',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Bảng Payments (Theo dõi Thanh toán)
CREATE TABLE public.payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    stage_name TEXT NOT NULL,
    expected_amount NUMERIC NOT NULL DEFAULT 0,
    
    -- Nghiep vu Hoa don & Thanh toan CĐT
    invoice_amount NUMERIC NOT NULL DEFAULT 0,
    invoice_date DATE,
    payment_request_amount NUMERIC NOT NULL DEFAULT 0,
    external_income NUMERIC NOT NULL DEFAULT 0,
    
    -- Nghiep vu Cong no Noi bo Sateco (Auto-calculated via UI or triggers, 95.5%)
    internal_debt_invoice NUMERIC NOT NULL DEFAULT 0,
    internal_debt_request NUMERIC NOT NULL DEFAULT 0,
    internal_debt_actual NUMERIC NOT NULL DEFAULT 0,
    
    -- Nghiep vu Thuc chi Sateco
    internal_paid NUMERIC NOT NULL DEFAULT 0,
    sateco_invoice_received NUMERIC NOT NULL DEFAULT 0,
    
    status TEXT NOT NULL DEFAULT 'Chưa thanh toán',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Bảng Internal Payment History (Lịch sử trả tiền Sateco)
CREATE TABLE public.internal_payment_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    payment_stage_id UUID REFERENCES public.payments(id) ON DELETE CASCADE,
    payment_date DATE NOT NULL,
    amount NUMERIC NOT NULL DEFAULT 0,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Bảng External Payment History (Lịch sử CĐT thanh toán)
CREATE TABLE public.external_payment_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    payment_stage_id UUID REFERENCES public.payments(id) ON DELETE CASCADE,
    payment_date DATE NOT NULL,
    amount NUMERIC NOT NULL DEFAULT 0,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Bảng Expenses (Chi phí dự án - Phục vụ tính Lãi/Lỗ)
CREATE TABLE public.expenses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    expense_type TEXT NOT NULL CHECK (expense_type IN ('Máy thi công', 'Nghiệm thu/Thẩm duyệt', 'BCH công trường', 'Chi phí chung')),
    amount NUMERIC NOT NULL DEFAULT 0,
    expense_date DATE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Bảng Expense Materials (Chi tiết Vật tư - Theo cấu trúc Excel)
CREATE TABLE public.expense_materials (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    item_group TEXT,
    expense_date DATE NOT NULL,
    supplier_name TEXT,
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

-- Bảng Expense Labor (Chi tiết Thanh toán Thầu phụ / Tổ đội - Theo cấu trúc Excel)
CREATE TABLE public.expense_labor (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    team_name TEXT NOT NULL,
    payment_stage TEXT NOT NULL,
    contract_value NUMERIC NOT NULL DEFAULT 0,
    request_date DATE,
    completed_previous NUMERIC NOT NULL DEFAULT 0,
    completed_current NUMERIC NOT NULL DEFAULT 0,
    requested_amount NUMERIC NOT NULL DEFAULT 0,
    approved_amount NUMERIC NOT NULL DEFAULT 0,
    payment_date DATE,
    paid_amount NUMERIC NOT NULL DEFAULT 0,
    priority TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Bật RLS (Row Level Security) tạm thời cho phép tất cả các thao tác để dev nhanh
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_payment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_payment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_labor ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all public operations on projects" ON public.projects FOR ALL USING (true);
CREATE POLICY "Allow all public operations on addendas" ON public.addendas FOR ALL USING (true);
CREATE POLICY "Allow all public operations on payments" ON public.payments FOR ALL USING (true);
CREATE POLICY "Allow all public operations on internal_payment_history" ON public.internal_payment_history FOR ALL USING (true);
CREATE POLICY "Allow all public operations on external_payment_history" ON public.external_payment_history FOR ALL USING (true);
CREATE POLICY "Allow all public operations on expenses" ON public.expenses FOR ALL USING (true);
CREATE POLICY "Allow all public operations on expense_materials" ON public.expense_materials FOR ALL USING (true);
CREATE POLICY "Allow all public operations on expense_labor" ON public.expense_labor FOR ALL USING (true);
