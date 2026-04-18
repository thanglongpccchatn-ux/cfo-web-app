-- ============================================================
-- Migration: Task Management Module
-- Tạo 4 bảng: task_categories, tasks, task_comments, task_attachments
-- ============================================================

-- Bảng task_categories: Nhóm công việc (Đấu thầu, Mua sắm, Thanh toán...)
CREATE TABLE IF NOT EXISTS public.task_categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    icon TEXT DEFAULT 'folder',
    color TEXT DEFAULT '#3b82f6',
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Seed default categories
INSERT INTO public.task_categories (name, icon, color, sort_order) VALUES
    ('Đấu thầu', 'gavel', '#6366f1', 1),
    ('Mua sắm vật tư', 'shopping_cart', '#8b5cf6', 2),
    ('Thanh toán', 'payments', '#ec4899', 3),
    ('Hợp đồng', 'description', '#f59e0b', 4),
    ('Khối lượng', 'straighten', '#14b8a6', 5),
    ('Thiết kế', 'design_services', '#3b82f6', 6),
    ('Thi công', 'construction', '#ef4444', 7),
    ('Nghiệm thu', 'fact_check', '#10b981', 8),
    ('Hành chính', 'apartment', '#64748b', 9)
ON CONFLICT (name) DO NOTHING;

-- Bảng tasks: Công việc chính
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    category_id UUID REFERENCES public.task_categories(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'todo'
        CHECK (status IN ('todo', 'in_progress', 'review', 'done')),
    priority TEXT NOT NULL DEFAULT 'medium'
        CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    assigned_to UUID,
    assigned_by UUID,
    due_date DATE,
    start_date DATE,
    completed_at TIMESTAMPTZ,
    tags TEXT[] DEFAULT '{}',
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Bảng task_comments: Bình luận / cập nhật tiến độ
CREATE TABLE IF NOT EXISTS public.task_comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
    user_id UUID NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Bảng task_attachments: File đính kèm
CREATE TABLE IF NOT EXISTS public.task_attachments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_type TEXT,
    uploaded_by UUID,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON public.tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON public.tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_category_id ON public.tasks(category_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON public.task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_attachments_task_id ON public.task_attachments(task_id);

-- RLS
ALTER TABLE public.task_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on task_categories" ON public.task_categories FOR ALL USING (true);
CREATE POLICY "Allow all operations on tasks" ON public.tasks FOR ALL USING (true);
CREATE POLICY "Allow all operations on task_comments" ON public.task_comments FOR ALL USING (true);
CREATE POLICY "Allow all operations on task_attachments" ON public.task_attachments FOR ALL USING (true);

-- Trigger auto-update updated_at
CREATE OR REPLACE FUNCTION update_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tasks_updated_at_trigger ON public.tasks;
CREATE TRIGGER tasks_updated_at_trigger
    BEFORE UPDATE ON public.tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_tasks_updated_at();
