-- ============================================================
-- SATECO CFO — Module Kế Toán TT200 (Phase 1A)
-- Bảng: acc_accounts, acc_fiscal_years, acc_fiscal_periods
-- Tham khảo: VietERP/apps/Accounting Prisma schema
-- ============================================================

-- ─── 1. Hệ thống Tài khoản (Chart of Accounts) ─────────────
CREATE TABLE IF NOT EXISTS acc_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_number TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  name_en TEXT,
  description TEXT,
  account_type TEXT NOT NULL CHECK (account_type IN (
    'asset', 'liability', 'equity', 'revenue', 'expense',
    'contra_asset', 'contra_revenue'
  )),
  account_group INT NOT NULL CHECK (account_group BETWEEN 1 AND 9),
  normal_balance TEXT NOT NULL CHECK (normal_balance IN ('debit', 'credit')),
  parent_id UUID REFERENCES acc_accounts(id),
  level INT DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  is_system_account BOOLEAN DEFAULT false,
  is_bank_account BOOLEAN DEFAULT false,
  currency TEXT DEFAULT 'VND',
  tt200_code TEXT,
  opening_balance NUMERIC(18,4) DEFAULT 0,
  current_balance NUMERIC(18,4) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_acc_accounts_type ON acc_accounts(account_type);
CREATE INDEX IF NOT EXISTS idx_acc_accounts_group ON acc_accounts(account_group);
CREATE INDEX IF NOT EXISTS idx_acc_accounts_parent ON acc_accounts(parent_id);

-- ─── 2. Năm tài chính ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS acc_fiscal_years (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INT NOT NULL UNIQUE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_current BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed', 'locked')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 3. Kỳ kế toán ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS acc_fiscal_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fiscal_year_id UUID NOT NULL REFERENCES acc_fiscal_years(id) ON DELETE CASCADE,
  period INT NOT NULL,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'soft_close', 'hard_close', 'reopened')),
  closed_by UUID,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(fiscal_year_id, period)
);

CREATE INDEX IF NOT EXISTS idx_acc_periods_status ON acc_fiscal_periods(status);

-- ─── 4. RLS Policies ────────────────────────────────────────
ALTER TABLE acc_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE acc_fiscal_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE acc_fiscal_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "acc_accounts_select" ON acc_accounts FOR SELECT TO authenticated USING (true);
CREATE POLICY "acc_accounts_insert" ON acc_accounts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "acc_accounts_update" ON acc_accounts FOR UPDATE TO authenticated USING (true);
CREATE POLICY "acc_accounts_delete" ON acc_accounts FOR DELETE TO authenticated USING (true);

CREATE POLICY "acc_fiscal_years_select" ON acc_fiscal_years FOR SELECT TO authenticated USING (true);
CREATE POLICY "acc_fiscal_years_insert" ON acc_fiscal_years FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "acc_fiscal_years_update" ON acc_fiscal_years FOR UPDATE TO authenticated USING (true);

CREATE POLICY "acc_fiscal_periods_select" ON acc_fiscal_periods FOR SELECT TO authenticated USING (true);
CREATE POLICY "acc_fiscal_periods_insert" ON acc_fiscal_periods FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "acc_fiscal_periods_update" ON acc_fiscal_periods FOR UPDATE TO authenticated USING (true);

-- ============================================================
-- 5. SEED DATA — 85 Tài khoản TT200 cho DN Xây dựng MEP/PCCC
-- ============================================================

-- Helper: Insert parent first, then children reference parent_id
-- Nhóm 1: Tài sản ngắn hạn
INSERT INTO acc_accounts (account_number, name, name_en, account_type, account_group, normal_balance, level, is_system_account, tt200_code) VALUES
('111', 'Tiền mặt', 'Cash on hand', 'asset', 1, 'debit', 1, true, '111'),
('112', 'Tiền gửi ngân hàng', 'Cash in bank', 'asset', 1, 'debit', 1, true, '112'),
('131', 'Phải thu của khách hàng', 'Accounts receivable', 'asset', 1, 'debit', 1, true, '131'),
('133', 'Thuế GTGT được khấu trừ', 'VAT deductible', 'asset', 1, 'debit', 1, true, '133'),
('136', 'Phải thu nội bộ', 'Internal receivables', 'asset', 1, 'debit', 1, true, '136'),
('138', 'Phải thu khác', 'Other receivables', 'asset', 1, 'debit', 1, true, '138'),
('141', 'Tạm ứng', 'Advances', 'asset', 1, 'debit', 1, true, '141'),
('152', 'Nguyên liệu, vật liệu', 'Raw materials', 'asset', 1, 'debit', 1, true, '152'),
('153', 'Công cụ, dụng cụ', 'Tools & supplies', 'asset', 1, 'debit', 1, true, '153'),
('154', 'Chi phí SXKD dở dang', 'Work in progress', 'asset', 1, 'debit', 1, true, '154'),
('155', 'Thành phẩm', 'Finished goods', 'asset', 1, 'debit', 1, true, '155')
ON CONFLICT (account_number) DO NOTHING;

-- Nhóm 1 cấp 2
INSERT INTO acc_accounts (account_number, name, name_en, account_type, account_group, normal_balance, level, is_system_account, tt200_code, parent_id) VALUES
('1111', 'Tiền Việt Nam', 'VND cash', 'asset', 1, 'debit', 2, true, '1111', (SELECT id FROM acc_accounts WHERE account_number = '111')),
('1112', 'Ngoại tệ', 'Foreign currency cash', 'asset', 1, 'debit', 2, false, '1112', (SELECT id FROM acc_accounts WHERE account_number = '111')),
('1121', 'Tiền VNĐ gửi NH', 'VND bank deposits', 'asset', 1, 'debit', 2, true, '1121', (SELECT id FROM acc_accounts WHERE account_number = '112')),
('1122', 'Ngoại tệ gửi NH', 'Foreign currency deposits', 'asset', 1, 'debit', 2, false, '1122', (SELECT id FROM acc_accounts WHERE account_number = '112')),
('1331', 'Thuế GTGT hàng hóa, DV', 'VAT on goods & services', 'asset', 1, 'debit', 2, true, '1331', (SELECT id FROM acc_accounts WHERE account_number = '133')),
('1332', 'Thuế GTGT của TSCĐ', 'VAT on fixed assets', 'asset', 1, 'debit', 2, false, '1332', (SELECT id FROM acc_accounts WHERE account_number = '133'))
ON CONFLICT (account_number) DO NOTHING;

-- Nhóm 2: Tài sản dài hạn
INSERT INTO acc_accounts (account_number, name, name_en, account_type, account_group, normal_balance, level, is_system_account, tt200_code) VALUES
('211', 'TSCĐ hữu hình', 'Tangible fixed assets', 'asset', 2, 'debit', 1, true, '211'),
('214', 'Hao mòn TSCĐ', 'Accumulated depreciation', 'contra_asset', 2, 'credit', 1, true, '214'),
('242', 'Chi phí trả trước', 'Prepaid expenses', 'asset', 2, 'debit', 1, true, '242')
ON CONFLICT (account_number) DO NOTHING;

INSERT INTO acc_accounts (account_number, name, name_en, account_type, account_group, normal_balance, level, is_system_account, tt200_code, parent_id) VALUES
('2111', 'Nhà cửa, vật kiến trúc', 'Buildings & structures', 'asset', 2, 'debit', 2, true, '2111', (SELECT id FROM acc_accounts WHERE account_number = '211')),
('2112', 'Máy móc, thiết bị', 'Machinery & equipment', 'asset', 2, 'debit', 2, true, '2112', (SELECT id FROM acc_accounts WHERE account_number = '211')),
('2113', 'Phương tiện vận tải', 'Vehicles', 'asset', 2, 'debit', 2, true, '2113', (SELECT id FROM acc_accounts WHERE account_number = '211')),
('2114', 'Thiết bị, dụng cụ QL', 'Office equipment', 'asset', 2, 'debit', 2, false, '2114', (SELECT id FROM acc_accounts WHERE account_number = '211')),
('2141', 'Hao mòn TSCĐ hữu hình', 'Accum. depr. - tangible', 'contra_asset', 2, 'credit', 2, true, '2141', (SELECT id FROM acc_accounts WHERE account_number = '214'))
ON CONFLICT (account_number) DO NOTHING;

-- Nhóm 3: Nợ phải trả
INSERT INTO acc_accounts (account_number, name, name_en, account_type, account_group, normal_balance, level, is_system_account, tt200_code) VALUES
('331', 'Phải trả cho người bán', 'Accounts payable', 'liability', 3, 'credit', 1, true, '331'),
('333', 'Thuế và các khoản phải nộp NN', 'Taxes payable', 'liability', 3, 'credit', 1, true, '333'),
('334', 'Phải trả người lao động', 'Payroll payable', 'liability', 3, 'credit', 1, true, '334'),
('335', 'Chi phí phải trả', 'Accrued expenses', 'liability', 3, 'credit', 1, true, '335'),
('338', 'Phải trả, phải nộp khác', 'Other payables', 'liability', 3, 'credit', 1, true, '338'),
('341', 'Vay và nợ thuê tài chính', 'Borrowings & finance leases', 'liability', 3, 'credit', 1, true, '341')
ON CONFLICT (account_number) DO NOTHING;

INSERT INTO acc_accounts (account_number, name, name_en, account_type, account_group, normal_balance, level, is_system_account, tt200_code, parent_id) VALUES
('3331', 'Thuế GTGT phải nộp', 'VAT output', 'liability', 3, 'credit', 2, true, '3331', (SELECT id FROM acc_accounts WHERE account_number = '333')),
('3332', 'Thuế TTĐB', 'Special consumption tax', 'liability', 3, 'credit', 2, false, '3332', (SELECT id FROM acc_accounts WHERE account_number = '333')),
('3334', 'Thuế TNDN', 'Corporate income tax', 'liability', 3, 'credit', 2, true, '3334', (SELECT id FROM acc_accounts WHERE account_number = '333')),
('3335', 'Thuế TNCN', 'Personal income tax', 'liability', 3, 'credit', 2, true, '3335', (SELECT id FROM acc_accounts WHERE account_number = '333')),
('3338', 'Thuế khác', 'Other taxes', 'liability', 3, 'credit', 2, false, '3338', (SELECT id FROM acc_accounts WHERE account_number = '333')),
('3382', 'Kinh phí công đoàn', 'Trade union fee', 'liability', 3, 'credit', 2, true, '3382', (SELECT id FROM acc_accounts WHERE account_number = '338')),
('3383', 'Bảo hiểm xã hội', 'Social insurance', 'liability', 3, 'credit', 2, true, '3383', (SELECT id FROM acc_accounts WHERE account_number = '338')),
('3384', 'Bảo hiểm y tế', 'Health insurance', 'liability', 3, 'credit', 2, true, '3384', (SELECT id FROM acc_accounts WHERE account_number = '338')),
('3386', 'Bảo hiểm thất nghiệp', 'Unemployment insurance', 'liability', 3, 'credit', 2, true, '3386', (SELECT id FROM acc_accounts WHERE account_number = '338'))
ON CONFLICT (account_number) DO NOTHING;

-- Nhóm 4: Vốn chủ sở hữu
INSERT INTO acc_accounts (account_number, name, name_en, account_type, account_group, normal_balance, level, is_system_account, tt200_code) VALUES
('411', 'Vốn đầu tư của chủ sở hữu', 'Owner''s equity', 'equity', 4, 'credit', 1, true, '411'),
('421', 'Lợi nhuận sau thuế chưa phân phối', 'Retained earnings', 'equity', 4, 'credit', 1, true, '421')
ON CONFLICT (account_number) DO NOTHING;

INSERT INTO acc_accounts (account_number, name, name_en, account_type, account_group, normal_balance, level, is_system_account, tt200_code, parent_id) VALUES
('4211', 'LN chưa phân phối năm trước', 'Prior year retained earnings', 'equity', 4, 'credit', 2, true, '4211', (SELECT id FROM acc_accounts WHERE account_number = '421')),
('4212', 'LN chưa phân phối năm nay', 'Current year retained earnings', 'equity', 4, 'credit', 2, true, '4212', (SELECT id FROM acc_accounts WHERE account_number = '421'))
ON CONFLICT (account_number) DO NOTHING;

-- Nhóm 5: Doanh thu
INSERT INTO acc_accounts (account_number, name, name_en, account_type, account_group, normal_balance, level, is_system_account, tt200_code) VALUES
('511', 'Doanh thu bán hàng và CCDV', 'Revenue from sales & services', 'revenue', 5, 'credit', 1, true, '511'),
('515', 'Doanh thu hoạt động tài chính', 'Financial income', 'revenue', 5, 'credit', 1, true, '515'),
('521', 'Các khoản giảm trừ doanh thu', 'Revenue deductions', 'contra_revenue', 5, 'debit', 1, true, '521')
ON CONFLICT (account_number) DO NOTHING;

INSERT INTO acc_accounts (account_number, name, name_en, account_type, account_group, normal_balance, level, is_system_account, tt200_code, parent_id) VALUES
('5111', 'Doanh thu bán hàng hóa', 'Goods revenue', 'revenue', 5, 'credit', 2, false, '5111', (SELECT id FROM acc_accounts WHERE account_number = '511')),
('5112', 'Doanh thu cung cấp dịch vụ', 'Service revenue', 'revenue', 5, 'credit', 2, false, '5112', (SELECT id FROM acc_accounts WHERE account_number = '511')),
('5113', 'Doanh thu xây lắp', 'Construction revenue', 'revenue', 5, 'credit', 2, true, '5113', (SELECT id FROM acc_accounts WHERE account_number = '511'))
ON CONFLICT (account_number) DO NOTHING;

-- Nhóm 6: Chi phí sản xuất kinh doanh
INSERT INTO acc_accounts (account_number, name, name_en, account_type, account_group, normal_balance, level, is_system_account, tt200_code) VALUES
('621', 'Chi phí NVL trực tiếp', 'Direct material costs', 'expense', 6, 'debit', 1, true, '621'),
('622', 'Chi phí nhân công trực tiếp', 'Direct labor costs', 'expense', 6, 'debit', 1, true, '622'),
('623', 'Chi phí sử dụng máy thi công', 'Machine usage costs', 'expense', 6, 'debit', 1, true, '623'),
('627', 'Chi phí sản xuất chung', 'Manufacturing overhead', 'expense', 6, 'debit', 1, true, '627'),
('632', 'Giá vốn hàng bán', 'Cost of goods sold', 'expense', 6, 'debit', 1, true, '632'),
('635', 'Chi phí tài chính', 'Financial expenses', 'expense', 6, 'debit', 1, true, '635'),
('642', 'Chi phí quản lý doanh nghiệp', 'Administrative expenses', 'expense', 6, 'debit', 1, true, '642')
ON CONFLICT (account_number) DO NOTHING;

INSERT INTO acc_accounts (account_number, name, name_en, account_type, account_group, normal_balance, level, is_system_account, tt200_code, parent_id) VALUES
('6271', 'Chi phí nhân viên phân xưởng', 'Factory staff costs', 'expense', 6, 'debit', 2, false, '6271', (SELECT id FROM acc_accounts WHERE account_number = '627')),
('6272', 'Chi phí NVL', 'Material overhead', 'expense', 6, 'debit', 2, false, '6272', (SELECT id FROM acc_accounts WHERE account_number = '627')),
('6273', 'Chi phí dụng cụ SX', 'Production tools', 'expense', 6, 'debit', 2, false, '6273', (SELECT id FROM acc_accounts WHERE account_number = '627')),
('6274', 'Chi phí khấu hao TSCĐ', 'Depreciation overhead', 'expense', 6, 'debit', 2, false, '6274', (SELECT id FROM acc_accounts WHERE account_number = '627')),
('6277', 'Chi phí dịch vụ mua ngoài', 'Outsourced service costs', 'expense', 6, 'debit', 2, false, '6277', (SELECT id FROM acc_accounts WHERE account_number = '627')),
('6278', 'Chi phí bằng tiền khác', 'Other cash expenses', 'expense', 6, 'debit', 2, false, '6278', (SELECT id FROM acc_accounts WHERE account_number = '627')),
('6421', 'Chi phí nhân viên quản lý', 'Admin staff costs', 'expense', 6, 'debit', 2, true, '6421', (SELECT id FROM acc_accounts WHERE account_number = '642')),
('6422', 'Chi phí vật liệu quản lý', 'Admin material costs', 'expense', 6, 'debit', 2, false, '6422', (SELECT id FROM acc_accounts WHERE account_number = '642')),
('6423', 'Chi phí CCDC', 'Admin tools & supplies', 'expense', 6, 'debit', 2, false, '6423', (SELECT id FROM acc_accounts WHERE account_number = '642')),
('6424', 'Chi phí khấu hao TSCĐ QL', 'Admin depreciation', 'expense', 6, 'debit', 2, false, '6424', (SELECT id FROM acc_accounts WHERE account_number = '642')),
('6425', 'Thuế, phí và lệ phí', 'Taxes, fees & charges', 'expense', 6, 'debit', 2, false, '6425', (SELECT id FROM acc_accounts WHERE account_number = '642')),
('6427', 'Chi phí DV mua ngoài', 'Admin outsourced services', 'expense', 6, 'debit', 2, false, '6427', (SELECT id FROM acc_accounts WHERE account_number = '642')),
('6428', 'Chi phí bằng tiền khác (QL)', 'Admin other cash expenses', 'expense', 6, 'debit', 2, false, '6428', (SELECT id FROM acc_accounts WHERE account_number = '642'))
ON CONFLICT (account_number) DO NOTHING;

-- Nhóm 7: Thu nhập khác
INSERT INTO acc_accounts (account_number, name, name_en, account_type, account_group, normal_balance, level, is_system_account, tt200_code) VALUES
('711', 'Thu nhập khác', 'Other income', 'revenue', 7, 'credit', 1, true, '711')
ON CONFLICT (account_number) DO NOTHING;

-- Nhóm 8: Chi phí khác
INSERT INTO acc_accounts (account_number, name, name_en, account_type, account_group, normal_balance, level, is_system_account, tt200_code) VALUES
('811', 'Chi phí khác', 'Other expenses', 'expense', 8, 'debit', 1, true, '811'),
('821', 'Chi phí thuế TNDN', 'CIT expense', 'expense', 8, 'debit', 1, true, '821')
ON CONFLICT (account_number) DO NOTHING;

INSERT INTO acc_accounts (account_number, name, name_en, account_type, account_group, normal_balance, level, is_system_account, tt200_code, parent_id) VALUES
('8211', 'CP thuế TNDN hiện hành', 'Current CIT', 'expense', 8, 'debit', 2, true, '8211', (SELECT id FROM acc_accounts WHERE account_number = '821')),
('8212', 'CP thuế TNDN hoãn lại', 'Deferred CIT', 'expense', 8, 'debit', 2, false, '8212', (SELECT id FROM acc_accounts WHERE account_number = '821'))
ON CONFLICT (account_number) DO NOTHING;

-- Nhóm 9: Xác định kết quả kinh doanh
INSERT INTO acc_accounts (account_number, name, name_en, account_type, account_group, normal_balance, level, is_system_account, tt200_code) VALUES
('911', 'Xác định kết quả kinh doanh', 'Income summary', 'equity', 9, 'credit', 1, true, '911')
ON CONFLICT (account_number) DO NOTHING;

-- ─── 6. Tạo năm tài chính hiện tại (2026) + 12 kỳ ──────────
INSERT INTO acc_fiscal_years (year, start_date, end_date, is_current, status) VALUES
(2026, '2026-01-01', '2026-12-31', true, 'open')
ON CONFLICT (year) DO NOTHING;

-- Auto-generate 12 kỳ cho năm 2026
DO $$
DECLARE
  fy_id UUID;
  m INT;
  m_start DATE;
  m_end DATE;
BEGIN
  SELECT id INTO fy_id FROM acc_fiscal_years WHERE year = 2026;
  IF fy_id IS NOT NULL THEN
    FOR m IN 1..12 LOOP
      m_start := make_date(2026, m, 1);
      m_end := (m_start + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
      INSERT INTO acc_fiscal_periods (fiscal_year_id, period, name, start_date, end_date, status)
      VALUES (fy_id, m, 'Tháng ' || m || '/2026', m_start, m_end, 'open')
      ON CONFLICT (fiscal_year_id, period) DO NOTHING;
    END LOOP;
  END IF;
END $$;

-- ─── 7. Permissions cho module Kế toán ──────────────────────
INSERT INTO permissions (code, name, description) VALUES
('view_accounting', 'Xem Kế toán', 'Xem hệ thống tài khoản, sổ cái, báo cáo'),
('manage_accounting', 'Quản lý Kế toán', 'Tạo/sửa tài khoản, bút toán'),
('approve_journal', 'Duyệt bút toán', 'Duyệt và ghi sổ bút toán'),
('manage_fiscal_periods', 'Quản lý kỳ kế toán', 'Mở/khóa sổ kỳ kế toán')
ON CONFLICT (code) DO NOTHING;
