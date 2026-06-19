-- =====================================================
-- Sổ Công Nợ NCC Vật Tư (Supplier Material Payables)
-- Bảng mua hàng + thanh toán cho NCC
-- =====================================================

-- 1. Bảng mua hàng từ NCC (chi tiết từng lần mua)
CREATE TABLE IF NOT EXISTS supplier_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES partners(id) ON DELETE SET NULL,
  material_group TEXT NOT NULL DEFAULT 'Khác',
  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  product_name TEXT NOT NULL,
  unit TEXT DEFAULT 'cái',
  quantity NUMERIC NOT NULL DEFAULT 0,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  vat_rate NUMERIC NOT NULL DEFAULT 10,
  total_amount NUMERIC GENERATED ALWAYS AS (
    quantity * unit_price * (1 + vat_rate / 100)
  ) STORED,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Bảng thanh toán cho NCC
CREATE TABLE IF NOT EXISTS supplier_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES partners(id) ON DELETE SET NULL,
  material_group TEXT,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC NOT NULL DEFAULT 0,
  payment_method TEXT DEFAULT 'Chuyển khoản',
  reference_no TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_supplier_purchases_project ON supplier_purchases(project_id);
CREATE INDEX IF NOT EXISTS idx_supplier_purchases_supplier ON supplier_purchases(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_purchases_group ON supplier_purchases(material_group);
CREATE INDEX IF NOT EXISTS idx_supplier_purchases_date ON supplier_purchases(purchase_date);

CREATE INDEX IF NOT EXISTS idx_supplier_payments_project ON supplier_payments(project_id);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_supplier ON supplier_payments(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_date ON supplier_payments(payment_date);

-- 4. RLS Policies
ALTER TABLE supplier_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view supplier_purchases"
  ON supplier_purchases FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert supplier_purchases"
  ON supplier_purchases FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update supplier_purchases"
  ON supplier_purchases FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete supplier_purchases"
  ON supplier_purchases FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view supplier_payments"
  ON supplier_payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert supplier_payments"
  ON supplier_payments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update supplier_payments"
  ON supplier_payments FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete supplier_payments"
  ON supplier_payments FOR DELETE TO authenticated USING (true);

-- 5. View tổng hợp công nợ NCC
CREATE OR REPLACE VIEW v_supplier_payables AS
SELECT
  sp.supplier_id,
  p.name AS supplier_name,
  sp.project_id,
  pr.name AS project_name,
  sp.material_group,
  COALESCE(SUM(sp.total_amount), 0) AS total_purchased,
  COALESCE(pay.total_paid, 0) AS total_paid,
  COALESCE(SUM(sp.total_amount), 0) - COALESCE(pay.total_paid, 0) AS balance_due
FROM supplier_purchases sp
LEFT JOIN partners p ON p.id = sp.supplier_id
LEFT JOIN projects pr ON pr.id = sp.project_id
LEFT JOIN (
  SELECT supplier_id, project_id, material_group,
         SUM(amount) AS total_paid
  FROM supplier_payments
  GROUP BY supplier_id, project_id, material_group
) pay ON pay.supplier_id = sp.supplier_id
     AND pay.project_id = sp.project_id
     AND pay.material_group = sp.material_group
GROUP BY sp.supplier_id, p.name, sp.project_id, pr.name, sp.material_group, pay.total_paid;
