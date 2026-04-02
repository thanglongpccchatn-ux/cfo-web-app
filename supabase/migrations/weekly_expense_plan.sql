-- Weekly Expense Plan table
-- Bảng kế hoạch chi tiền hàng tuần (tổng hợp Vật tư + Nhân công + CP Chung)
CREATE TABLE IF NOT EXISTS weekly_expense_plans (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    week_number INTEGER NOT NULL,
    year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM NOW()),
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    project_id UUID REFERENCES projects(id),
    cht_name TEXT, -- Chỉ huy trưởng
    category TEXT NOT NULL DEFAULT 'Vật tư', -- Vật tư / Nhân công / Chi phí khác
    description TEXT,
    priority TEXT DEFAULT 'Bình thường', -- Gấp / Bình thường
    requested_amount NUMERIC DEFAULT 0, -- Đề nghị tạm ứng
    actual_amount NUMERIC DEFAULT 0, -- Thực tế chi tiền
    planned_payment_date DATE, -- Ngày dự kiến chi
    actual_payment_date DATE, -- Ngày thực chi
    status TEXT DEFAULT 'Chờ duyệt', -- Chờ duyệt / Đã duyệt / Đã chi / Từ chối
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast week lookups
CREATE INDEX IF NOT EXISTS idx_weekly_plans_week ON weekly_expense_plans(year, week_number);
CREATE INDEX IF NOT EXISTS idx_weekly_plans_project ON weekly_expense_plans(project_id);
CREATE INDEX IF NOT EXISTS idx_weekly_plans_status ON weekly_expense_plans(status);

-- RLS
ALTER TABLE weekly_expense_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON weekly_expense_plans FOR ALL TO authenticated USING (true) WITH CHECK (true);
