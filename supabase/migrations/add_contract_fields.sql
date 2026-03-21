-- Migration: Add internal_code and contract_form to projects table
-- Run this in Supabase SQL Editor

-- 1. Thêm cột Mã HĐ nội bộ (do người dùng tự đặt để quản lý)
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS internal_code TEXT;

-- 2. Thêm cột Hình thức hợp đồng (Trọn gói, Theo khối lượng, v.v.)
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS contract_form TEXT DEFAULT 'Trọn gói';

-- Optional: Index on internal_code for fast lookup
CREATE INDEX IF NOT EXISTS idx_projects_internal_code ON projects(internal_code);

-- Verify
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'projects'
AND column_name IN ('internal_code', 'contract_form');
