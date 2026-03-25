-- Site Diary Database Schema
-- 2024-03-25: Created tables for daily reporting

-- 1. Site Diary Table
CREATE TABLE IF NOT EXISTS public.site_diary (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    report_date DATE NOT NULL DEFAULT CURRENT_DATE,
    weather TEXT,
    progress_notes TEXT,
    labor_count INTEGER DEFAULT 0,
    issues TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Site Diary Images Table
CREATE TABLE IF NOT EXISTS public.site_diary_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    diary_id UUID NOT NULL REFERENCES public.site_diary(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable RLS
ALTER TABLE public.site_diary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_diary_images ENABLE ROW LEVEL SECURITY;

-- 4. Policies for site_diary
-- View: Admin or Project Members
CREATE POLICY "View Site Diary" ON public.site_diary FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.project_members pm 
        WHERE pm.project_id = site_diary.project_id AND pm.user_id = auth.uid()
    ) OR (SELECT role_code FROM profiles WHERE id = auth.uid()) IN ('ROLE01', 'ADMIN')
);

-- Create: Any Authenticated User (validated at app level for project membership)
CREATE POLICY "Create Site Diary" ON public.site_diary FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Update: Only Creator or Admin
CREATE POLICY "Update Site Diary" ON public.site_diary FOR UPDATE USING (
    auth.uid() = user_id OR (SELECT role_code FROM profiles WHERE id = auth.uid()) IN ('ROLE01', 'ADMIN')
);

-- 5. Policies for site_diary_images
CREATE POLICY "View Site Diary Images" ON public.site_diary_images FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.site_diary sd 
        WHERE sd.id = site_diary_images.diary_id
    )
);

CREATE POLICY "Insert Site Diary Images" ON public.site_diary_images FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.site_diary sd 
        WHERE sd.id = diary_id AND sd.user_id = auth.uid()
    )
);
