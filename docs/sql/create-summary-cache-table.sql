-- Create summary_cache table to store cached summaries by topic and date
CREATE TABLE IF NOT EXISTS summary_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  topic TEXT NOT NULL,
  date DATE NOT NULL, -- Date for which the summary was generated (YYYY-MM-DD)
  is_paid BOOLEAN NOT NULL DEFAULT FALSE, -- Whether this is for paid or free tier
  summaries JSONB NOT NULL, -- The cached summaries
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(topic, date, is_paid) -- One cache entry per topic per day per tier
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_summary_cache_topic_date ON summary_cache(topic, date);
CREATE INDEX IF NOT EXISTS idx_summary_cache_date ON summary_cache(date DESC);
CREATE INDEX IF NOT EXISTS idx_summary_cache_is_paid ON summary_cache(is_paid);

-- Enable Row Level Security
ALTER TABLE summary_cache ENABLE ROW LEVEL SECURITY;

-- Allow service role to manage all cache entries
CREATE POLICY "Service role can manage all summary cache" ON summary_cache
  FOR ALL USING (auth.role() = 'service_role');

-- Allow anyone to read cache (for performance, but RLS will still apply)
CREATE POLICY "Anyone can read summary cache" ON summary_cache
  FOR SELECT USING (true);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_summary_cache_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update updated_at
CREATE TRIGGER update_summary_cache_timestamp
  BEFORE UPDATE ON summary_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_summary_cache_updated_at();

