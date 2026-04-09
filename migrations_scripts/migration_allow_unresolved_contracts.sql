-- Migration: Allow importing contracts with unresolved project or partner
-- Run this in Supabase SQL Editor

-- 1. DROP NOT NULL constraint for partner_id and project_id to allow unresolved imports
ALTER TABLE subcontractor_contracts ALTER COLUMN partner_id DROP NOT NULL;
ALTER TABLE subcontractor_contracts ALTER COLUMN project_id DROP NOT NULL;

-- 2. Add columns to store the raw strings from the Excel file if they don't match our database
ALTER TABLE subcontractor_contracts ADD COLUMN IF NOT EXISTS unresolved_project TEXT;
ALTER TABLE subcontractor_contracts ADD COLUMN IF NOT EXISTS unresolved_partner TEXT;
