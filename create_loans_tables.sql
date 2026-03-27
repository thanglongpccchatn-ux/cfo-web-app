-- 1. Create loans table
CREATE TABLE IF NOT EXISTS loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_code TEXT NOT NULL,
    lender_type TEXT NOT NULL DEFAULT 'company' CHECK (lender_type IN ('company', 'individual', 'bank')),
    lender_name TEXT NOT NULL,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    loan_amount NUMERIC NOT NULL DEFAULT 0,
    interest_rate NUMERIC DEFAULT 0,
    interest_type TEXT DEFAULT 'fixed' CHECK (interest_type IN ('fixed', 'reducing')),
    loan_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'partially_paid', 'fully_paid', 'overdue')),
    total_paid NUMERIC DEFAULT 0,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create loan_payments table
CREATE TABLE IF NOT EXISTS loan_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    principal_amount NUMERIC DEFAULT 0,
    interest_amount NUMERIC DEFAULT 0,
    total_amount NUMERIC GENERATED ALWAYS AS (principal_amount + interest_amount) STORED,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);
CREATE INDEX IF NOT EXISTS idx_loans_lender_type ON loans(lender_type);
CREATE INDEX IF NOT EXISTS idx_loans_project_id ON loans(project_id);
CREATE INDEX IF NOT EXISTS idx_loan_payments_loan_id ON loan_payments(loan_id);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_payments ENABLE ROW LEVEL SECURITY;

-- 5. Create basic policies (Allow all authenticated users to manage for simplicity in internal app)
CREATE POLICY "Allow authenticated read loans" ON loans FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert loans" ON loans FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update loans" ON loans FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete loans" ON loans FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow authenticated read loan_payments" ON loan_payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert loan_payments" ON loan_payments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update loan_payments" ON loan_payments FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete loan_payments" ON loan_payments FOR DELETE TO authenticated USING (true);
