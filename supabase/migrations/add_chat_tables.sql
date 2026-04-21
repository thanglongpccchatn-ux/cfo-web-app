-- ═══════════════════════════════════════════════════════
-- SATECO Internal Chat — Database Migration
-- Created: 2026-04-21
-- ═══════════════════════════════════════════════════════

-- 1. Hội thoại (1-1 hoặc nhóm)
CREATE TABLE IF NOT EXISTS chat_conversations (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    type            TEXT NOT NULL DEFAULT 'direct'
        CHECK (type IN ('direct', 'group')),
    name            TEXT,
    avatar_url      TEXT,
    created_by      UUID REFERENCES auth.users(id),
    last_message_at TIMESTAMPTZ DEFAULT now(),
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- 2. Thành viên hội thoại
CREATE TABLE IF NOT EXISTS chat_members (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES auth.users(id),
    role            TEXT DEFAULT 'member'
        CHECK (role IN ('admin', 'member')),
    joined_at       TIMESTAMPTZ DEFAULT now(),
    last_read_at    TIMESTAMPTZ DEFAULT now(),
    is_muted        BOOLEAN DEFAULT false,
    UNIQUE(conversation_id, user_id)
);

-- 3. Tin nhắn
CREATE TABLE IF NOT EXISTS chat_messages (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    sender_id       UUID NOT NULL REFERENCES auth.users(id),
    content         TEXT,
    type            TEXT DEFAULT 'text'
        CHECK (type IN ('text', 'image', 'file', 'system')),
    file_url        TEXT,
    file_name       TEXT,
    file_size       BIGINT,
    file_type       TEXT,
    reply_to        UUID REFERENCES chat_messages(id),
    is_edited       BOOLEAN DEFAULT false,
    is_deleted      BOOLEAN DEFAULT false,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- 4. Emoji reactions
CREATE TABLE IF NOT EXISTS chat_reactions (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    message_id      UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES auth.users(id),
    emoji           TEXT NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT now(),
    UNIQUE(message_id, user_id, emoji)
);

-- ═══════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON chat_messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender ON chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_members_user ON chat_members(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_members_conversation ON chat_members(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_reactions_message ON chat_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_last_msg ON chat_conversations(last_message_at DESC);

-- ═══════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_reactions ENABLE ROW LEVEL SECURITY;

-- Conversations: user can see conversations they're a member of
CREATE POLICY "chat_conv_select" ON chat_conversations FOR SELECT USING (
    id IN (SELECT conversation_id FROM chat_members WHERE user_id = auth.uid())
);
CREATE POLICY "chat_conv_insert" ON chat_conversations FOR INSERT WITH CHECK (
    created_by = auth.uid()
);
CREATE POLICY "chat_conv_update" ON chat_conversations FOR UPDATE USING (
    id IN (SELECT conversation_id FROM chat_members WHERE user_id = auth.uid() AND role = 'admin')
    OR created_by = auth.uid()
);

-- Members: can view members of conversations user belongs to
CREATE POLICY "chat_members_select" ON chat_members FOR SELECT USING (
    conversation_id IN (SELECT conversation_id FROM chat_members AS cm WHERE cm.user_id = auth.uid())
);
CREATE POLICY "chat_members_insert" ON chat_members FOR INSERT WITH CHECK (
    -- Admin of the conversation can add members, or creating self-membership
    user_id = auth.uid()
    OR conversation_id IN (
        SELECT conversation_id FROM chat_members WHERE user_id = auth.uid() AND role = 'admin'
    )
);
CREATE POLICY "chat_members_update" ON chat_members FOR UPDATE USING (
    user_id = auth.uid()
    OR conversation_id IN (
        SELECT conversation_id FROM chat_members WHERE user_id = auth.uid() AND role = 'admin'
    )
);
CREATE POLICY "chat_members_delete" ON chat_members FOR DELETE USING (
    user_id = auth.uid()
    OR conversation_id IN (
        SELECT conversation_id FROM chat_members WHERE user_id = auth.uid() AND role = 'admin'
    )
);

-- Messages: can view messages in conversations user belongs to
CREATE POLICY "chat_msg_select" ON chat_messages FOR SELECT USING (
    conversation_id IN (SELECT conversation_id FROM chat_members WHERE user_id = auth.uid())
);
CREATE POLICY "chat_msg_insert" ON chat_messages FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND conversation_id IN (SELECT conversation_id FROM chat_members WHERE user_id = auth.uid())
);
CREATE POLICY "chat_msg_update" ON chat_messages FOR UPDATE USING (
    sender_id = auth.uid()
);

-- Reactions: can view in accessible conversations, manage own
CREATE POLICY "chat_react_select" ON chat_reactions FOR SELECT USING (
    message_id IN (
        SELECT m.id FROM chat_messages m
        JOIN chat_members cm ON cm.conversation_id = m.conversation_id
        WHERE cm.user_id = auth.uid()
    )
);
CREATE POLICY "chat_react_insert" ON chat_reactions FOR INSERT WITH CHECK (
    user_id = auth.uid()
);
CREATE POLICY "chat_react_delete" ON chat_reactions FOR DELETE USING (
    user_id = auth.uid()
);

-- ═══════════════════════════════════════════════════════
-- FUNCTION: Auto-update last_message_at on new message
-- ═══════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE chat_conversations
    SET last_message_at = NEW.created_at, updated_at = NEW.created_at
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_chat_message_update_conversation
    AFTER INSERT ON chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_last_message();

-- ═══════════════════════════════════════════════════════
-- STORAGE: Create bucket for chat files (run in Supabase Dashboard)
-- Note: This SQL doesn't create storage buckets directly.
-- Use Supabase Dashboard > Storage > New Bucket:
--   Name: chat-files
--   Public: false
--   File size limit: 25MB
--   Allowed MIME types: image/*, application/pdf, 
--     application/msword, application/vnd.openxmlformats*,
--     application/vnd.ms-excel, application/zip, application/x-rar
-- ═══════════════════════════════════════════════════════

-- Storage policies (run after creating bucket)
-- INSERT policy: authenticated users can upload
-- SELECT policy: authenticated users can download from their conversations
-- DELETE policy: file owner can delete
