-- Migration: Add Settlement Management fields
-- Run this in Supabase SQL Editor

-- 1. Add settlement fields to projects table
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS settlement_proposed_value NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS settlement_approved_value NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS settlement_assignee TEXT,
ADD COLUMN IF NOT EXISTS settlement_notes TEXT;

-- 2. Create settlement documents checklist table
CREATE TABLE IF NOT EXISTS public.settlement_documents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    doc_type TEXT NOT NULL,
    doc_name TEXT NOT NULL,
    is_completed BOOLEAN DEFAULT false,
    completed_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. RLS
ALTER TABLE public.settlement_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on settlement_documents" ON public.settlement_documents FOR ALL USING (true);

-- 4. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
