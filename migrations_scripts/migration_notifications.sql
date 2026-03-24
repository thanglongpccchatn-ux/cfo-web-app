-- --------------------------------------------------------------------------------------
-- MIGRATION: Setup Notification System (Universal Hub)
-- Description: Creates the `notifications` table, RLS, Realtime, and smart routing RPCs.
-- --------------------------------------------------------------------------------------

-- 1. Create the notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    type VARCHAR(50) DEFAULT 'INFO',
    link VARCHAR(255),
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    sender_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- 2. Setup Row Level Security (RLS)
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications"
ON public.notifications FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications"
ON public.notifications FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own notifications" ON public.notifications;
CREATE POLICY "Users can delete their own notifications"
ON public.notifications FOR DELETE
USING (auth.uid() = user_id);

-- (To ensure strict security, we don't allow open INSERT via frontend. Instead we use a SECURITY DEFINER function below)

-- 3. Enable Realtime on the table
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- 4. Create an RPC to safely insert notifications for an array of target users
CREATE OR REPLACE FUNCTION public.send_notification(
    p_user_ids UUID[],
    p_title VARCHAR,
    p_content TEXT,
    p_type VARCHAR,
    p_link VARCHAR,
    p_sender_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    uid UUID;
BEGIN
    FOREACH uid IN ARRAY p_user_ids
    LOOP
        INSERT INTO public.notifications (user_id, title, content, type, link, sender_id)
        VALUES (uid, p_title, p_content, p_type, p_link, p_sender_id);
    END LOOP;
END;
$$;

-- 5. Create an RPC to smartly fetch user IDs based on a required permission code
-- (This allows the Frontend to say: "Send this to whoever has 'edit_payments'")
CREATE OR REPLACE FUNCTION public.get_users_by_permission(p_permission_code TEXT)
RETURNS TABLE (user_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT p.id 
    FROM public.profiles p
    LEFT JOIN public.role_permissions rp ON p.role_code = rp.role_code
    WHERE rp.permission_code = p_permission_code 
       OR p.role_code = 'ROLE01' -- Admin ALWAYS receives notifications for critical flows
       OR p.role_code = 'ADMIN';
END;
$$;
