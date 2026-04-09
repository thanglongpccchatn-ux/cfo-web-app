-- ═══════════════════════════════════════════════════════
-- Phase 3: HĐĐT (Hóa đơn điện tử) + Thuế
-- NĐ 123/2020/NĐ-CP, TT 78/2021/TT-BTC
-- ═══════════════════════════════════════════════════════

-- 1. Bảng Hóa đơn điện tử
CREATE TABLE IF NOT EXISTS acc_einvoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Thông tin HĐĐT
  invoice_type TEXT NOT NULL DEFAULT 'output' CHECK (invoice_type IN ('output', 'input')),
  invoice_series TEXT, -- Ký hiệu HĐ (1C24TAA)
  invoice_number TEXT, -- Số HĐ
  invoice_date DATE NOT NULL,
  
  -- Đối tác
  partner_type TEXT CHECK (partner_type IN ('customer', 'supplier')),
  partner_name TEXT NOT NULL,
  partner_tax_code TEXT,
  partner_address TEXT,
  
  -- Dự án liên kết
  project_id UUID REFERENCES projects(id),
  
  -- Giá trị
  subtotal NUMERIC(18,2) DEFAULT 0,            -- Tiền hàng
  vat_rate NUMERIC(5,2) DEFAULT 10,            -- %VAT
  vat_amount NUMERIC(18,2) DEFAULT 0,          -- Tiền thuế
  total_amount NUMERIC(18,2) DEFAULT 0,        -- Tổng thanh toán
  currency TEXT DEFAULT 'VND',
  
  -- Trạng thái
  status TEXT DEFAULT 'draft' CHECK (status IN (
    'draft',           -- Nháp
    'issued',          -- Đã phát hành (HĐ đầu ra)
    'received',        -- Đã nhận (HĐ đầu vào)
    'sent_to_buyer',   -- Đã gửi cho KH
    'cancelled',       -- Đã hủy
    'replaced',        -- Đã thay thế
    'adjusted'         -- Đã điều chỉnh
  )),
  
  -- Liên kết bút toán
  journal_entry_id UUID REFERENCES acc_journal_entries(id),
  
  -- NĐ123 metadata
  lookup_code TEXT,     -- Mã tra cứu CQT
  signing_date DATE,    -- Ngày ký số
  xml_data TEXT,        -- Dữ liệu XML (nếu import từ e-invoice provider)
  
  -- Mô tả
  description TEXT,
  notes TEXT,
  
  -- Audit
  created_by UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Chi tiết dòng hóa đơn
CREATE TABLE IF NOT EXISTS acc_einvoice_lines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  einvoice_id UUID NOT NULL REFERENCES acc_einvoices(id) ON DELETE CASCADE,
  line_number INT NOT NULL DEFAULT 1,
  
  item_name TEXT NOT NULL,
  unit TEXT,                        -- ĐVT
  quantity NUMERIC(18,3) DEFAULT 1,
  unit_price NUMERIC(18,2) DEFAULT 0,
  amount NUMERIC(18,2) DEFAULT 0,   -- = qty × price
  vat_rate NUMERIC(5,2) DEFAULT 10,
  vat_amount NUMERIC(18,2) DEFAULT 0,
  total NUMERIC(18,2) DEFAULT 0,    -- = amount + vat
  
  description TEXT,
  
  UNIQUE(einvoice_id, line_number)
);

-- 3. Bảng Tờ khai thuế
CREATE TABLE IF NOT EXISTS acc_tax_declarations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  tax_type TEXT NOT NULL CHECK (tax_type IN ('GTGT', 'TNDN', 'TNCN')),
  period_type TEXT DEFAULT 'monthly' CHECK (period_type IN ('monthly', 'quarterly', 'yearly')),
  period_month INT CHECK (period_month BETWEEN 1 AND 12),
  period_quarter INT CHECK (period_quarter BETWEEN 1 AND 4),
  period_year INT NOT NULL,
  
  -- Số liệu tổng hợp
  taxable_revenue NUMERIC(18,2) DEFAULT 0,     -- DT chịu thuế
  non_taxable_revenue NUMERIC(18,2) DEFAULT 0, -- DT không chịu thuế
  input_vat NUMERIC(18,2) DEFAULT 0,           -- Thuế GTGT đầu vào
  output_vat NUMERIC(18,2) DEFAULT 0,          -- Thuế GTGT đầu ra
  vat_payable NUMERIC(18,2) DEFAULT 0,         -- Thuế phải nộp = output - input
  cit_taxable_income NUMERIC(18,2) DEFAULT 0,  -- Thu nhập chịu thuế TNDN
  cit_amount NUMERIC(18,2) DEFAULT 0,          -- Thuế TNDN phải nộp
  pit_amount NUMERIC(18,2) DEFAULT 0,          -- Thuế TNCN phải nộp
  
  -- Trạng thái
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'accepted', 'rejected', 'amended')),
  
  submission_date DATE,
  acceptance_date DATE,
  notes TEXT,
  
  -- Liên kết kỳ kế toán
  fiscal_period_id UUID REFERENCES acc_fiscal_periods(id),
  
  -- Audit
  created_by UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(tax_type, period_year, period_month),
  UNIQUE(tax_type, period_year, period_quarter)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_einvoices_type_date ON acc_einvoices(invoice_type, invoice_date);
CREATE INDEX IF NOT EXISTS idx_einvoices_partner ON acc_einvoices(partner_tax_code);
CREATE INDEX IF NOT EXISTS idx_einvoices_status ON acc_einvoices(status);
CREATE INDEX IF NOT EXISTS idx_einvoice_lines_invoice ON acc_einvoice_lines(einvoice_id);
CREATE INDEX IF NOT EXISTS idx_tax_declarations_type_year ON acc_tax_declarations(tax_type, period_year);

-- RLS
ALTER TABLE acc_einvoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE acc_einvoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE acc_tax_declarations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage einvoices" ON acc_einvoices
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage einvoice_lines" ON acc_einvoice_lines
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage tax_declarations" ON acc_tax_declarations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Comments
COMMENT ON TABLE acc_einvoices IS 'Hóa đơn điện tử theo NĐ123/2020 - Đầu vào & Đầu ra';
COMMENT ON TABLE acc_einvoice_lines IS 'Chi tiết dòng hóa đơn';
COMMENT ON TABLE acc_tax_declarations IS 'Tờ khai thuế GTGT/TNDN/TNCN';
