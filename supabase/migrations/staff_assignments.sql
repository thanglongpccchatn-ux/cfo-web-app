-- ==============================================================================
-- MIGRATION: staff_assignments — Quản lý điều chuyển nhân sự giữa các dự án
-- BP Nhân sự quản lý điều chuyển, Admin set role
-- ==============================================================================

-- 1. Thêm current_project_id vào profiles (lookup nhanh)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS current_project_id UUID REFERENCES public.projects(id);

-- 2. Bảng lịch sử điều chuyển
CREATE TABLE IF NOT EXISTS public.staff_assignments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL NOT NULL,
    assigned_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,                                          -- NULL = đang ở dự án này
    assigned_by UUID REFERENCES auth.users(id),             -- Người ra quyết định (HR)
    notes TEXT,                                             -- "Luân chuyển từ DA X sang DA Y"
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index cho tra cứu nhanh
CREATE INDEX IF NOT EXISTS idx_staff_assignments_user ON public.staff_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_assignments_project ON public.staff_assignments(project_id);
CREATE INDEX IF NOT EXISTS idx_staff_assignments_active ON public.staff_assignments(user_id, end_date) WHERE end_date IS NULL;

-- RLS
ALTER TABLE public.staff_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on staff_assignments" ON public.staff_assignments;
CREATE POLICY "Allow all on staff_assignments" ON public.staff_assignments FOR ALL USING (true);

-- 3. Permission: manage_staff_assignment cho BP Nhân sự
INSERT INTO public.permissions (code, name, module, description) VALUES
('manage_staff_assignment', 'Điều chuyển nhân sự', 'staff', 'Quản lý điều chuyển nhân sự giữa các dự án')
ON CONFLICT (code) DO NOTHING;

-- Gán permission cho ROLE10 (Nhân sự) và ROLE01 (Admin)
INSERT INTO public.role_permissions (role_code, permission_code) VALUES
('ROLE10', 'manage_staff_assignment'),
('ROLE01', 'manage_staff_assignment')
ON CONFLICT DO NOTHING;
