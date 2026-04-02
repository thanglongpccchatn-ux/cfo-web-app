-- ==============================================================================
-- BẢNG HỢP ĐỒNG THẦU PHỤ / TỔ ĐỘI
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.subcontractor_contracts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Liên kết
    partner_id UUID REFERENCES public.partners(id) ON DELETE CASCADE NOT NULL,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    
    -- Thông tin HĐ
    contract_code TEXT,                          -- Số HĐ: "HĐ-2026/ÁD-BBL"
    contract_name TEXT NOT NULL,                 -- Mô tả: "Thi công phần điện"
    contract_type TEXT NOT NULL DEFAULT 'Tổ đội', -- 'Tổ đội' (ko thuế) | 'Thầu phụ' (có thuế)
    
    -- Giá trị
    contract_value NUMERIC NOT NULL DEFAULT 0,   -- Giá trị HĐ (trước thuế)
    vat_rate NUMERIC NOT NULL DEFAULT 0,          -- % VAT (0 cho Tổ đội, 8/10 cho Thầu phụ)
    contract_value_with_vat NUMERIC GENERATED ALWAYS AS (
        contract_value * (1 + COALESCE(vat_rate, 0) / 100)
    ) STORED,                                     -- Giá trị HĐ sau thuế (tự tính)
    
    -- Tiến độ
    scope_of_work TEXT,                           -- Phạm vi công việc
    start_date DATE,
    end_date DATE,
    status TEXT NOT NULL DEFAULT 'Đang thực hiện', -- Đang thực hiện / Hoàn thành / Thanh lý
    
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS
ALTER TABLE public.subcontractor_contracts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on subcontractor_contracts" ON public.subcontractor_contracts;
CREATE POLICY "Allow all on subcontractor_contracts" ON public.subcontractor_contracts FOR ALL USING (true);
