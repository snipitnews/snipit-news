-- Add skip_reasons column to cron_job_logs table to track why emails were skipped
ALTER TABLE cron_job_logs 
ADD COLUMN IF NOT EXISTS skip_reasons JSONB DEFAULT '[]'::jsonb;

-- Add comment to document the column
COMMENT ON COLUMN cron_job_logs.skip_reasons IS 'Array of reasons why emails were skipped (e.g., "User paused emails", "Not delivery time", "No news found")';

