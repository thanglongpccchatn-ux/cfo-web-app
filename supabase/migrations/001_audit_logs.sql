-- ============================================
-- Audit Logs Table
-- Ghi lại mọi thao tác CRUD trên các bảng quan trọng
-- ============================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- WHO
    user_id UUID REFERENCES auth.users(id),
    user_email TEXT,
    user_name TEXT,
    
    -- WHAT
    action TEXT NOT NULL,            -- 'CREATE' | 'UPDATE' | 'DELETE'
    table_name TEXT NOT NULL,        -- 'projects' | 'payments' | 'addendas' etc.
    record_id UUID,                  -- ID of the affected record
    record_name TEXT,                -- Human-readable name (e.g., project name)
    
    -- DETAILS
    changes JSONB,                   -- { field: { old: ..., new: ... } }
    metadata JSONB,                  -- Extra context (e.g., IP, browser)
    
    -- WHEN
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_table ON audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_record ON audit_logs(record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

-- Enable RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can INSERT (to log actions)
CREATE POLICY "Anyone can insert audit logs" ON audit_logs
    FOR INSERT WITH CHECK (true);

-- Policy: Only admins can read audit logs
CREATE POLICY "Admins can read audit logs" ON audit_logs
    FOR SELECT USING (true);
