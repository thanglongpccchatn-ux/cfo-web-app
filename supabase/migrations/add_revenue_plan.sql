-- Bảng Kế hoạch Doanh thu Năm
CREATE TABLE IF NOT EXISTS public.revenue_plan (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    year INTEGER NOT NULL UNIQUE,
    target_revenue NUMERIC NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS
ALTER TABLE public.revenue_plan ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all public operations on revenue_plan" ON public.revenue_plan FOR ALL USING (true);
