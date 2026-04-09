-- Migration: Add cost breakdown columns to bids table
-- Date: 2026-04-06
-- Purpose: Chi phí cấu thành giá vốn trong báo giá/đấu thầu

ALTER TABLE bids ADD COLUMN IF NOT EXISTS cost_material NUMERIC DEFAULT 0;
ALTER TABLE bids ADD COLUMN IF NOT EXISTS cost_labor NUMERIC DEFAULT 0;
ALTER TABLE bids ADD COLUMN IF NOT EXISTS cost_inspection_pct NUMERIC DEFAULT 0;
ALTER TABLE bids ADD COLUMN IF NOT EXISTS cost_management_pct NUMERIC DEFAULT 3;
ALTER TABLE bids ADD COLUMN IF NOT EXISTS cost_risk_pct NUMERIC DEFAULT 1;
ALTER TABLE bids ADD COLUMN IF NOT EXISTS cost_accounting_pct NUMERIC DEFAULT 2;

-- Add comments for documentation
COMMENT ON COLUMN bids.cost_material IS 'Chi phí vật liệu (VL)';
COMMENT ON COLUMN bids.cost_labor IS 'Chi phí nhân công (NC)';
COMMENT ON COLUMN bids.cost_inspection_pct IS 'Tỷ lệ % chi phí nghiệm thu (trên VL+NC)';
COMMENT ON COLUMN bids.cost_management_pct IS 'Tỷ lệ % chi phí quản lý (mặc định 3%, trên VL+NC)';
COMMENT ON COLUMN bids.cost_risk_pct IS 'Tỷ lệ % rủi ro (mặc định 1%, trên VL+NC)';
COMMENT ON COLUMN bids.cost_accounting_pct IS 'Tỷ lệ % CAT kế toán (mặc định 2%, trên VL+NC)';
