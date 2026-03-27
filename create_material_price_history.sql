-- ============================================
-- Bảng Lịch sử Giá mua Vật tư
-- Ghi nhận mỗi khi đơn giá mua thay đổi so với giá niêm yết
-- ============================================

-- Xóa bảng cũ nếu bị tạo lỗi từ lần trước
DROP TABLE IF EXISTS material_price_history;

CREATE TABLE material_price_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  material_id UUID,
  supplier_id UUID,
  unit_price NUMERIC NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  recorded_by UUID,
  notes TEXT
);

-- Indexes
CREATE INDEX idx_mph_material ON material_price_history(material_id);
CREATE INDEX idx_mph_supplier ON material_price_history(supplier_id);
CREATE INDEX idx_mph_recorded_at ON material_price_history(recorded_at DESC);

-- RLS
ALTER TABLE material_price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage price history"
  ON material_price_history FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
