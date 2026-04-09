-- ═══════════════════════════════════════════════════════
-- Phase 2: Auto Journal Entry Source Tracking
-- Adds source_module and source_id columns to acc_journal_entries
-- for tracing auto-generated entries back to their origin.
-- ═══════════════════════════════════════════════════════

-- Add source tracking columns
ALTER TABLE acc_journal_entries
  ADD COLUMN IF NOT EXISTS source_module TEXT,
  ADD COLUMN IF NOT EXISTS source_id UUID;

-- Index for fast lookups (idempotency check)
CREATE INDEX IF NOT EXISTS idx_journal_entries_source 
  ON acc_journal_entries(source_module, source_id)
  WHERE source_module IS NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN acc_journal_entries.source_module IS 'Module that auto-created this entry (e.g. expense_labor, po_payment, external_payment, loan_payment)';
COMMENT ON COLUMN acc_journal_entries.source_id IS 'UUID of the source record that triggered this entry';
