-- ============================================================
-- App Metrics Table — Business Intelligence & Performance Tracking
-- Stores buffered metrics from src/lib/metrics.js
-- ============================================================

CREATE TABLE IF NOT EXISTS app_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_name VARCHAR(100) NOT NULL,
  event_value NUMERIC DEFAULT 1,
  event_data JSONB DEFAULT '{}',
  user_id UUID REFERENCES auth.users(id),
  page_url VARCHAR(500),
  recorded_at TIMESTAMPTZ DEFAULT now()
);

-- Index on event_name for querying specific metrics
CREATE INDEX IF NOT EXISTS idx_metrics_event ON app_metrics(event_name);
CREATE INDEX IF NOT EXISTS idx_metrics_recorded ON app_metrics(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_user ON app_metrics(user_id) WHERE user_id IS NOT NULL;

-- Composite index for dashboard queries (event + time range)
CREATE INDEX IF NOT EXISTS idx_metrics_event_time ON app_metrics(event_name, recorded_at DESC);

-- RLS: Users can insert their own metrics, admins can read all
ALTER TABLE app_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert metrics" ON app_metrics
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can view own metrics" ON app_metrics
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role_code IN ('ROLE01', 'ADMIN')
  ));

-- ============================================================
-- Cleanup: Auto-delete metrics older than 90 days (optional)
-- Run via Supabase cron or pg_cron extension
-- ============================================================
-- SELECT cron.schedule('cleanup-old-metrics', '0 3 * * 0', 
--   $$DELETE FROM public.app_metrics WHERE recorded_at < now() - interval '90 days'$$
-- );

COMMENT ON TABLE app_metrics IS 'Business metrics and analytics tracking — buffered inserts from frontend';
