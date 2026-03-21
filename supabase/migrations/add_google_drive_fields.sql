-- ==============================================================================
-- MIGRATION: Add Google Drive integration fields to projects
-- ==============================================================================

ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS google_drive_folder_id TEXT,
ADD COLUMN IF NOT EXISTS document_link TEXT;

-- Confirmation
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'projects'
AND column_name IN ('google_drive_folder_id', 'document_link');
