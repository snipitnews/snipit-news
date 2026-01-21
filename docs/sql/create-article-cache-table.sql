-- Create article_cache table to store raw articles fetched from news sources
-- This reduces API calls by caching articles for 24-48 hours
CREATE TABLE IF NOT EXISTS article_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic TEXT NOT NULL,
  date DATE NOT NULL, -- Date for which articles were fetched (YYYY-MM-DD)
  source TEXT NOT NULL, -- Source of articles (e.g., 'currents', 'newsapi', 'rss')
  articles JSONB NOT NULL, -- Array of articles in NewsArticle format
  fetch_duration_ms INTEGER, -- How long it took to fetch these articles (for monitoring)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours', -- TTL for cache
  UNIQUE(topic, date, source) -- One cache entry per topic per day per source
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_article_cache_topic_date ON article_cache(topic, date);
CREATE INDEX IF NOT EXISTS idx_article_cache_expiry ON article_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_article_cache_source ON article_cache(source);
CREATE INDEX IF NOT EXISTS idx_article_cache_created_at ON article_cache(created_at DESC);

-- Enable Row Level Security
ALTER TABLE article_cache ENABLE ROW LEVEL SECURITY;

-- Allow service role to manage all cache entries
CREATE POLICY "Service role can manage all article cache" ON article_cache
  FOR ALL USING (auth.role() = 'service_role');

-- Allow anyone to read cache (for performance)
CREATE POLICY "Anyone can read article cache" ON article_cache
  FOR SELECT USING (true);

-- Function to clean up expired cache entries (optional, for maintenance)
CREATE OR REPLACE FUNCTION cleanup_expired_article_cache()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM article_cache WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: You can set up a periodic cron job to call cleanup_expired_article_cache()
-- or rely on Supabase's automatic cleanup policies
