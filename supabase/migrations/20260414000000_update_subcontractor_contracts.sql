-- ==============================================================================
-- CẬP NHẬT TRƯỜNG THIẾU CHO BẢNG subcontractor_contracts
-- ==============================================================================

ALTER TABLE public.subcontractor_contracts
ADD COLUMN IF NOT EXISTS invoiced_amount NUMERIC NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS system_code TEXT,
ADD COLUMN IF NOT EXISTS warranty_months INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS signing_status TEXT NOT NULL DEFAULT 'Chưa ký',

-- Fields related to advance payment
ADD COLUMN IF NOT EXISTS advance_type TEXT DEFAULT 'fixed',
ADD COLUMN IF NOT EXISTS advance_value NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS advance_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS advance_notes TEXT,

-- Fields related to payment schedule percentage
ADD COLUMN IF NOT EXISTS pct_rough NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS pct_install NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS pct_acceptance NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS pct_settlement NUMERIC DEFAULT 0;

-- Optionally, you can trigger a cache reload by calling a simple query 
NOTIFY pgrst, 'reload schema';
