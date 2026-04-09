-- Migration: Add signing_status + payment schedule columns to subcontractor_contracts
-- Run this in Supabase SQL Editor

-- 1. Signing status (Đã ký / Chưa ký / Đang đàm phán / Hết hiệu lực)
ALTER TABLE subcontractor_contracts
ADD COLUMN IF NOT EXISTS signing_status TEXT DEFAULT 'Chưa ký';

-- 2. Payment schedule percentages per stage
ALTER TABLE subcontractor_contracts
ADD COLUMN IF NOT EXISTS pct_rough NUMERIC DEFAULT 70;        -- Phần thô
ALTER TABLE subcontractor_contracts
ADD COLUMN IF NOT EXISTS pct_install NUMERIC DEFAULT 85;      -- Hoàn thành lắp đặt
ALTER TABLE subcontractor_contracts
ADD COLUMN IF NOT EXISTS pct_acceptance NUMERIC DEFAULT 0;    -- Nghiệm thu
ALTER TABLE subcontractor_contracts
ADD COLUMN IF NOT EXISTS pct_settlement NUMERIC DEFAULT 95;   -- Quyết toán

-- 3. Backfill existing records with sensible defaults based on system_code
UPDATE subcontractor_contracts
SET pct_rough = CASE
    WHEN system_code ILIKE '%FA%' THEN 40
    WHEN system_code ILIKE '%PAINT%' THEN 75
    WHEN system_code ILIKE '%XD%' THEN 60
    ELSE 70
END,
pct_install = CASE
    WHEN system_code ILIKE '%FA%' THEN 70
    WHEN system_code ILIKE '%XD%' THEN 75
    ELSE 85
END,
pct_acceptance = CASE
    WHEN system_code ILIKE '%FA%' THEN 85
    WHEN system_code ILIKE '%XD%' THEN 85
    ELSE 0
END,
pct_settlement = 95,
signing_status = 'Đã ký'
WHERE signing_status IS NULL OR pct_rough IS NULL;

-- Verify
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'subcontractor_contracts'
AND column_name IN ('signing_status', 'pct_rough', 'pct_install', 'pct_acceptance', 'pct_settlement');
