-- ============================================================================
-- PHÁT SINH, CÔNG NHẬT, KHẤU TRỪ/PHẠT CHO THẦU PHỤ
-- ============================================================================

-- 1. Bảng phát sinh thầu phụ (gắn vào HĐ gốc, tương tự addendas cho CĐT)
CREATE TABLE IF NOT EXISTS public.subcontractor_variations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    contract_id UUID NOT NULL REFERENCES public.subcontractor_contracts(id) ON DELETE CASCADE,
    variation_code TEXT,                      -- Mã phát sinh: VD: PS-001
    description TEXT NOT NULL,                -- Nội dung phát sinh
    variation_value NUMERIC NOT NULL DEFAULT 0,  -- Giá trị phát sinh (có thể âm nếu giảm trừ)
    vat_rate NUMERIC DEFAULT 0,               -- Thuế VAT riêng
    status TEXT DEFAULT 'Chờ duyệt',          -- Chờ duyệt / Đã duyệt / Từ chối
    approved_by TEXT,                         -- Người duyệt
    approved_date DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Thêm cột cho expense_labor: loại thanh toán, công nhật, khấu trừ
ALTER TABLE public.expense_labor 
    ADD COLUMN IF NOT EXISTS request_type TEXT DEFAULT 'Nghiệm thu',  -- 'Nghiệm thu' | 'Tạm ứng' | 'Công nhật' | 'Phát sinh'
    ADD COLUMN IF NOT EXISTS daily_labor_count NUMERIC DEFAULT 0,     -- Số công (ngày công)
    ADD COLUMN IF NOT EXISTS daily_labor_rate NUMERIC DEFAULT 0,      -- Đơn giá/công
    ADD COLUMN IF NOT EXISTS deduction_amount NUMERIC DEFAULT 0,      -- Khoản khấu trừ/phạt
    ADD COLUMN IF NOT EXISTS deduction_reason TEXT;                   -- Lý do khấu trừ

-- 3. RLS cho bảng mới
ALTER TABLE public.subcontractor_variations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on subcontractor_variations" ON public.subcontractor_variations FOR ALL USING (true);
