-- Create Translation Memory table for Sateco Excel Addin
CREATE TABLE IF NOT EXISTS public.translation_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_text TEXT UNIQUE NOT NULL,
    translated_text TEXT NOT NULL,
    domain TEXT DEFAULT 'Construction',
    is_verified BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Set up Row Level Security (RLS)
ALTER TABLE public.translation_memory ENABLE ROW LEVEL SECURITY;

-- Allow anonymous read access (since Addin uses anon key)
CREATE POLICY "Allow public read access to translation memory"
    ON public.translation_memory
    FOR SELECT
    USING (true);

-- Allow anonymous insert access (to save new translations from Addin)
CREATE POLICY "Allow public insert to translation memory"
    ON public.translation_memory
    FOR INSERT
    WITH CHECK (true);

-- Allow anonymous update access (if we want to update existing items later)
CREATE POLICY "Allow public update to translation memory"
    ON public.translation_memory
    FOR UPDATE
    USING (true)
    WITH CHECK (true);
