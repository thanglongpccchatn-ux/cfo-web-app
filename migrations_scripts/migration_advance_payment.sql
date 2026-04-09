-- ═══════════════════════════════════════════════════════════════════════
-- Migration: Add advance payment columns to subcontractor_contracts
-- Date: 2026-04-03
-- Purpose: Track advance payments (tạm ứng) per contract
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE subcontractor_contracts
  ADD COLUMN IF NOT EXISTS advance_type TEXT DEFAULT 'fixed' CHECK (advance_type IN ('fixed', 'percent')),
  ADD COLUMN IF NOT EXISTS advance_value NUMERIC DEFAULT 50000000,
  ADD COLUMN IF NOT EXISTS advance_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS advance_notes TEXT;

-- Backfill existing contracts with default 50M fixed advance
UPDATE subcontractor_contracts
SET advance_type = 'fixed',
    advance_value = 50000000,
    advance_amount = 50000000
WHERE advance_type IS NULL;

COMMENT ON COLUMN subcontractor_contracts.advance_type IS 'Loại tạm ứng: fixed (cố định) hoặc percent (% GT HĐ)';
COMMENT ON COLUMN subcontractor_contracts.advance_value IS 'Giá trị tạm ứng (số tiền nếu fixed, % nếu percent)';
COMMENT ON COLUMN subcontractor_contracts.advance_amount IS 'Số tiền tạm ứng thực tế (đã tính)';
COMMENT ON COLUMN subcontractor_contracts.advance_notes IS 'Ghi chú tạm ứng';
