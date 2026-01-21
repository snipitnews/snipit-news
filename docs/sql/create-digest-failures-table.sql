-- Create digest_failures table to track failed digest deliveries
-- This helps with monitoring and debugging delivery issues
CREATE TABLE IF NOT EXISTS digest_failures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  failure_reason TEXT NOT NULL, -- Description of why the digest failed
  failure_type TEXT NOT NULL CHECK (failure_type IN ('fetch_error', 'summary_error', 'email_error', 'unknown')),
  topics TEXT[] NOT NULL, -- Topics the user had subscribed to
  error_details JSONB, -- Additional error details (stack trace, API response, etc.)
  retry_count INTEGER DEFAULT 0, -- Number of retry attempts
  resolved BOOLEAN DEFAULT FALSE, -- Whether the failure was eventually resolved
  resolved_at TIMESTAMPTZ, -- When it was resolved
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_digest_failures_user_id ON digest_failures(user_id);
CREATE INDEX IF NOT EXISTS idx_digest_failures_created_at ON digest_failures(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_digest_failures_resolved ON digest_failures(resolved);
CREATE INDEX IF NOT EXISTS idx_digest_failures_failure_type ON digest_failures(failure_type);

-- Enable Row Level Security
ALTER TABLE digest_failures ENABLE ROW LEVEL SECURITY;

-- Users can view their own failures
CREATE POLICY "Users can view their own digest failures" ON digest_failures
  FOR SELECT USING (auth.uid() = user_id);

-- Admins can view all failures
CREATE POLICY "Admins can view all digest failures" ON digest_failures
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Service role can insert failures
CREATE POLICY "Service role can insert digest failures" ON digest_failures
  FOR INSERT
  WITH CHECK (true);

-- Service role can update failures (for marking as resolved)
CREATE POLICY "Service role can update digest failures" ON digest_failures
  FOR UPDATE
  USING (auth.role() = 'service_role');

-- Function to get failure statistics
CREATE OR REPLACE FUNCTION get_digest_failure_stats(days_back INTEGER DEFAULT 7)
RETURNS TABLE (
  total_failures BIGINT,
  unresolved_failures BIGINT,
  failures_by_type JSONB,
  most_affected_users JSONB
) AS $$
DECLARE
  type_stats JSONB;
  user_stats JSONB;
  total_count BIGINT;
  unresolved_count BIGINT;
BEGIN
  -- Get total and unresolved counts
  SELECT
    COUNT(*)::BIGINT,
    COUNT(*) FILTER (WHERE NOT resolved)::BIGINT
  INTO total_count, unresolved_count
  FROM digest_failures
  WHERE created_at > NOW() - (days_back || ' days')::INTERVAL;

  -- Get failures by type
  SELECT COALESCE(jsonb_object_agg(failure_type, count), '{}'::jsonb)
  INTO type_stats
  FROM (
    SELECT
      df.failure_type,
      COUNT(*) as count
    FROM digest_failures df
    WHERE df.created_at > NOW() - (days_back || ' days')::INTERVAL
    GROUP BY df.failure_type
  ) type_counts;

  -- Get most affected users (top 10)
  SELECT COALESCE(jsonb_agg(user_data), '[]'::jsonb)
  INTO user_stats
  FROM (
    SELECT
      jsonb_build_object(
        'user_id', df.user_id,
        'email', u.email,
        'failure_count', COUNT(*)
      ) as user_data
    FROM digest_failures df
    JOIN users u ON u.id = df.user_id
    WHERE df.created_at > NOW() - (days_back || ' days')::INTERVAL
    AND NOT df.resolved
    GROUP BY df.user_id, u.email
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC
    LIMIT 10
  ) top_users;

  -- Return the results
  RETURN QUERY SELECT total_count, unresolved_count, type_stats, user_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
