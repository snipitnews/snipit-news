-- Create cron_job_logs table to track daily digest execution
CREATE TABLE IF NOT EXISTS cron_job_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'running')),
  processed_count INTEGER NOT NULL DEFAULT 0,
  successful_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  errors JSONB DEFAULT '[]'::jsonb,
  execution_time_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for faster queries by date
CREATE INDEX IF NOT EXISTS idx_cron_job_logs_execution_date ON cron_job_logs(execution_date DESC);

-- Create index for status filtering
CREATE INDEX IF NOT EXISTS idx_cron_job_logs_status ON cron_job_logs(status);

-- Add RLS policies (only admins can read)
ALTER TABLE cron_job_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins can read logs
CREATE POLICY "Admins can read cron job logs"
  ON cron_job_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Policy: Service role can insert logs (for cron job)
CREATE POLICY "Service role can insert cron job logs"
  ON cron_job_logs
  FOR INSERT
  WITH CHECK (true);

