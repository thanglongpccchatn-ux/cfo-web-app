-- ==========================================
-- BỔ SUNG LOGIC THĂNG LONG - SATECO
-- ==========================================

-- 1. Bổ sung Tỷ lệ khoán và tỷ lệ thực tế vào dự án (Mặc định 100%)
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS sateco_contract_ratio numeric(5,2) DEFAULT 100.00,
ADD COLUMN IF NOT EXISTS sateco_actual_ratio numeric(5,2) DEFAULT 100.00;

-- 2. Bảng Quản lý Vay mượn (Thăng Long cho Sateco Vay)
CREATE TABLE IF NOT EXISTS public.internal_loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    amount numeric NOT NULL, -- Số tiền vay
    loan_date date NOT NULL,
    notes text,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Bật RLS cho internal_loans
ALTER TABLE public.internal_loans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cho phép tất cả thao tác trên internal_loans"
    ON public.internal_loans
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- 3. Bảng Quản lý Hoàn trả tiền mặt - Công nợ nội bộ (Sateco trả lại tiền chênh lệch cho Thăng Long)
CREATE TABLE IF NOT EXISTS public.internal_refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    amount numeric NOT NULL, -- Số tiền hoàn trả (Tiền mặt)
    refund_date date NOT NULL,
    notes text,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Bật RLS cho internal_refunds
ALTER TABLE public.internal_refunds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cho phép tất cả thao tác trên internal_refunds"
    ON public.internal_refunds
    FOR ALL
    USING (true)
    WITH CHECK (true);
