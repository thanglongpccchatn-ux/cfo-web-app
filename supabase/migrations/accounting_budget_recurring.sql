-- ═══════════════════════════════════════════════════════
-- Phase 4A: Ngân sách Dự án + Bút toán Định kỳ
-- ═══════════════════════════════════════════════════════

-- 1. Ngân sách (Budget) — theo dự án + kỳ
CREATE TABLE IF NOT EXISTS acc_budgets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,                          -- Tên ngân sách
  budget_type TEXT DEFAULT 'project' CHECK (budget_type IN ('project', 'department', 'company')),
  project_id UUID REFERENCES projects(id),     -- Liên kết DA (nếu project-level)
  fiscal_year INT NOT NULL,
  fiscal_period_id UUID REFERENCES acc_fiscal_periods(id),
  
  total_budget NUMERIC(18,2) DEFAULT 0,        -- Tổng NS
  total_actual NUMERIC(18,2) DEFAULT 0,        -- Tổng thực tế (auto-calc)
  total_committed NUMERIC(18,2) DEFAULT 0,     -- Cam kết (PO chưa TT)
  
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'active', 'closed', 'over_budget')),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  notes TEXT,
  
  created_by UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Dòng ngân sách — từng hạng mục
CREATE TABLE IF NOT EXISTS acc_budget_lines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  budget_id UUID NOT NULL REFERENCES acc_budgets(id) ON DELETE CASCADE,
  
  account_id UUID REFERENCES acc_accounts(id), -- TK kế toán liên kết
  category TEXT NOT NULL,                      -- Hạng mục: Nhân công, Vật liệu, Máy TC...
  
  budget_amount NUMERIC(18,2) DEFAULT 0,       -- NS dự kiến
  actual_amount NUMERIC(18,2) DEFAULT 0,       -- Thực tế
  committed_amount NUMERIC(18,2) DEFAULT 0,    -- Cam kết
  variance NUMERIC(18,2) DEFAULT 0,            -- Chênh lệch = budget - actual - committed
  variance_pct NUMERIC(8,2) DEFAULT 0,         -- % chênh lệch
  
  notes TEXT,
  
  UNIQUE(budget_id, category)
);

-- 3. Bút toán định kỳ (Recurring Journal Templates)
CREATE TABLE IF NOT EXISTS acc_recurring_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,                          -- Tên template
  description TEXT,
  journal_type TEXT DEFAULT 'general',
  
  -- Lịch lặp
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
  day_of_month INT CHECK (day_of_month BETWEEN 1 AND 31),
  next_run_date DATE,
  last_run_date DATE,
  end_date DATE,                               -- Ngày kết thúc (NULL = vô hạn)
  
  -- Template data
  total_amount NUMERIC(18,2) DEFAULT 0,
  
  is_active BOOLEAN DEFAULT true,
  auto_post BOOLEAN DEFAULT false,             -- Tự động ghi sổ (true) hoặc tạo draft (false)
  
  created_by UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Dòng template định kỳ
CREATE TABLE IF NOT EXISTS acc_recurring_template_lines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES acc_recurring_templates(id) ON DELETE CASCADE,
  line_number INT NOT NULL DEFAULT 1,
  
  account_id UUID NOT NULL REFERENCES acc_accounts(id),
  debit_amount NUMERIC(18,2) DEFAULT 0,
  credit_amount NUMERIC(18,2) DEFAULT 0,
  description TEXT,
  
  UNIQUE(template_id, line_number)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_budgets_project ON acc_budgets(project_id);
CREATE INDEX IF NOT EXISTS idx_budgets_year ON acc_budgets(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_budget_lines_budget ON acc_budget_lines(budget_id);
CREATE INDEX IF NOT EXISTS idx_recurring_active ON acc_recurring_templates(is_active, next_run_date);

-- RLS
ALTER TABLE acc_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE acc_budget_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE acc_recurring_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE acc_recurring_template_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth manage budgets" ON acc_budgets FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth manage budget_lines" ON acc_budget_lines FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth manage recurring_templates" ON acc_recurring_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth manage recurring_template_lines" ON acc_recurring_template_lines FOR ALL TO authenticated USING (true) WITH CHECK (true);
