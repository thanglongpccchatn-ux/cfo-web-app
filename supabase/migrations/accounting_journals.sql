-- ============================================================
-- SATECO CFO — Module Kế Toán TT200 (Phase 1B)
-- Bảng: acc_journal_entries, acc_journal_lines
-- Bút toán kép + Sổ Cái
-- ============================================================

-- ─── 1. Bút toán (Journal Entries) ──────────────────────────
CREATE TABLE IF NOT EXISTS acc_journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_number TEXT NOT NULL UNIQUE,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  journal_type TEXT NOT NULL DEFAULT 'general' CHECK (journal_type IN (
    'general',        -- Tổng hợp
    'cash_receipt',   -- Phiếu thu tiền mặt
    'cash_payment',   -- Phiếu chi tiền mặt
    'bank_receipt',   -- Báo có ngân hàng
    'bank_payment',   -- Báo nợ ngân hàng
    'sales',          -- Bán hàng / Doanh thu
    'purchase',       -- Mua hàng
    'payroll',        -- Lương
    'depreciation',   -- Khấu hao
    'adjustment',     -- Điều chỉnh
    'closing',        -- Kết chuyển cuối kỳ
    'opening',        -- Số dư đầu kỳ
    'reversal'        -- Đảo ngược
  )),
  
  journal_source TEXT NOT NULL DEFAULT 'manual' CHECK (journal_source IN (
    'manual', 'system', 'import', 'recurring', 'migration'
  )),
  
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'pending', 'approved', 'posted', 'reversed', 'rejected'
  )),
  
  fiscal_period_id UUID REFERENCES acc_fiscal_periods(id),
  
  description TEXT,
  reference_number TEXT,         -- Số chứng từ gốc
  
  total_debit NUMERIC(18,4) DEFAULT 0,
  total_credit NUMERIC(18,4) DEFAULT 0,
  
  -- Audit fields
  created_by TEXT,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  posted_by TEXT,
  posted_at TIMESTAMPTZ,
  reversed_by TEXT,
  reversed_at TIMESTAMPTZ,
  reversal_entry_id UUID REFERENCES acc_journal_entries(id),
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Constraint: Nợ = Có khi đã ghi sổ
  CONSTRAINT chk_balanced_when_posted CHECK (
    status != 'posted' OR total_debit = total_credit
  )
);

CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON acc_journal_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_journal_entries_type ON acc_journal_entries(journal_type);
CREATE INDEX IF NOT EXISTS idx_journal_entries_status ON acc_journal_entries(status);
CREATE INDEX IF NOT EXISTS idx_journal_entries_period ON acc_journal_entries(fiscal_period_id);

-- ─── 2. Chi tiết dòng bút toán (Journal Lines) ─────────────
CREATE TABLE IF NOT EXISTS acc_journal_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id UUID NOT NULL REFERENCES acc_journal_entries(id) ON DELETE CASCADE,
  
  account_id UUID NOT NULL REFERENCES acc_accounts(id),
  
  debit_amount NUMERIC(18,4) DEFAULT 0,
  credit_amount NUMERIC(18,4) DEFAULT 0,
  
  description TEXT,               -- Diễn giải dòng
  
  -- Dimensions (đơn giản hóa từ VietERP)
  project_id UUID,                -- FK tới projects nếu cần
  partner_id UUID,                -- FK tới partners nếu cần
  
  line_order INT DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  
  -- Constraints
  CONSTRAINT chk_positive_amounts CHECK (debit_amount >= 0 AND credit_amount >= 0),
  CONSTRAINT chk_single_side CHECK (NOT (debit_amount > 0 AND credit_amount > 0))
);

CREATE INDEX IF NOT EXISTS idx_journal_lines_entry ON acc_journal_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_account ON acc_journal_lines(account_id);

-- ─── 3. Function: Auto-generate entry_number ────────────────
-- Format: {PREFIX}-{YYYY}-{NNNNNN}
-- VD: PT-2026-000001 (Phiếu thu), PC-2026-000002 (Phiếu chi)

CREATE OR REPLACE FUNCTION generate_entry_number(p_type TEXT, p_date DATE)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_prefix TEXT;
  v_year INT;
  v_seq INT;
BEGIN
  v_year := EXTRACT(YEAR FROM p_date);
  
  v_prefix := CASE p_type
    WHEN 'cash_receipt' THEN 'PT'
    WHEN 'cash_payment' THEN 'PC'
    WHEN 'bank_receipt' THEN 'BC'
    WHEN 'bank_payment' THEN 'BN'
    WHEN 'sales' THEN 'BH'
    WHEN 'purchase' THEN 'MH'
    WHEN 'payroll' THEN 'LG'
    WHEN 'depreciation' THEN 'KH'
    WHEN 'adjustment' THEN 'DC'
    WHEN 'closing' THEN 'KC'
    WHEN 'opening' THEN 'MS'
    WHEN 'reversal' THEN 'DN'
    ELSE 'TH'  -- Tổng hợp
  END;
  
  SELECT COALESCE(MAX(
    CAST(SPLIT_PART(entry_number, '-', 3) AS INT)
  ), 0) + 1 INTO v_seq
  FROM acc_journal_entries
  WHERE entry_number LIKE v_prefix || '-' || v_year || '-%';
  
  RETURN v_prefix || '-' || v_year || '-' || LPAD(v_seq::TEXT, 6, '0');
END;
$$;

-- ─── 4. Function: Update account balances after posting ─────
CREATE OR REPLACE FUNCTION update_account_balances_on_post()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only run when status changes TO 'posted'
  IF NEW.status = 'posted' AND (OLD.status IS NULL OR OLD.status != 'posted') THEN
    UPDATE acc_accounts a
    SET current_balance = a.current_balance + sub.net
    FROM (
      SELECT account_id, SUM(debit_amount - credit_amount) AS net
      FROM acc_journal_lines
      WHERE journal_entry_id = NEW.id
      GROUP BY account_id
    ) sub
    WHERE a.id = sub.account_id;
  END IF;
  
  -- Reverse balances when status changes FROM 'posted' to 'reversed'
  IF NEW.status = 'reversed' AND OLD.status = 'posted' THEN
    UPDATE acc_accounts a
    SET current_balance = a.current_balance - sub.net
    FROM (
      SELECT account_id, SUM(debit_amount - credit_amount) AS net
      FROM acc_journal_lines
      WHERE journal_entry_id = NEW.id
      GROUP BY account_id
    ) sub
    WHERE a.id = sub.account_id;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_balances
  AFTER UPDATE OF status ON acc_journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_account_balances_on_post();

-- ─── 5. RLS Policies ────────────────────────────────────────
ALTER TABLE acc_journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE acc_journal_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "journal_entries_select" ON acc_journal_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "journal_entries_insert" ON acc_journal_entries FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "journal_entries_update" ON acc_journal_entries FOR UPDATE TO authenticated USING (true);
CREATE POLICY "journal_entries_delete" ON acc_journal_entries FOR DELETE TO authenticated USING (status = 'draft');

CREATE POLICY "journal_lines_select" ON acc_journal_lines FOR SELECT TO authenticated USING (true);
CREATE POLICY "journal_lines_insert" ON acc_journal_lines FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "journal_lines_update" ON acc_journal_lines FOR UPDATE TO authenticated USING (true);
CREATE POLICY "journal_lines_delete" ON acc_journal_lines FOR DELETE TO authenticated USING (true);

-- ─── 6. Permissions bổ sung ─────────────────────────────────
INSERT INTO permissions (code, name, module, description) VALUES
('create_journal', 'Tạo bút toán', 'Accounting', 'Tạo bút toán nháp'),
('post_journal', 'Ghi sổ bút toán', 'Accounting', 'Duyệt và ghi sổ bút toán vào sổ cái')
ON CONFLICT (code) DO NOTHING;
