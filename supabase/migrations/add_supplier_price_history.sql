-- =====================================================
-- Lịch sử giá vật tư theo NCC (Price History)
-- Ghi nhận mỗi khi đơn giá thay đổi so với lần mua gần nhất
-- =====================================================

CREATE TABLE IF NOT EXISTS supplier_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID REFERENCES materials(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES partners(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,        -- Snapshot tên SP tại thời điểm mua
  unit TEXT,
  old_price NUMERIC DEFAULT 0,
  new_price NUMERIC NOT NULL DEFAULT 0,
  change_date DATE NOT NULL DEFAULT CURRENT_DATE,
  purchase_id UUID REFERENCES supplier_purchases(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE supplier_price_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_select_price_history" ON supplier_price_history;
CREATE POLICY "auth_select_price_history" ON supplier_price_history FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_insert_price_history" ON supplier_price_history;
CREATE POLICY "auth_insert_price_history" ON supplier_price_history FOR INSERT TO authenticated WITH CHECK (true);

-- Index
CREATE INDEX IF NOT EXISTS idx_price_history_material ON supplier_price_history(material_id);
CREATE INDEX IF NOT EXISTS idx_price_history_supplier ON supplier_price_history(supplier_id);
CREATE INDEX IF NOT EXISTS idx_price_history_product ON supplier_price_history(product_name);

-- Thêm cột material_id vào supplier_purchases (liên kết SP từ danh mục)
ALTER TABLE supplier_purchases ADD COLUMN IF NOT EXISTS material_id UUID REFERENCES materials(id) ON DELETE SET NULL;
