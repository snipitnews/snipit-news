-- Enable Row Level Security

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  subscription_tier TEXT NOT NULL DEFAULT 'free' CHECK (subscription_tier IN ('free', 'paid')),
  stripe_customer_id TEXT UNIQUE,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_topics table
CREATE TABLE IF NOT EXISTS user_topics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  topic_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, topic_name)
);

-- Create user_email_settings table for delivery preferences
CREATE TABLE IF NOT EXISTS user_email_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  delivery_time TIME WITH TIME ZONE DEFAULT '08:00:00-05:00', -- Default 8 AM EST
  timezone TEXT DEFAULT 'America/New_York',
  paused BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create email_archive table to store sent emails
CREATE TABLE IF NOT EXISTS email_archive (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  subject TEXT NOT NULL,
  content JSONB NOT NULL, -- Store the summaries as JSON
  topics TEXT[] NOT NULL, -- Array of topic names
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create subscription_metadata table
CREATE TABLE IF NOT EXISTS subscription_metadata (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  stripe_subscription_id TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL,
  current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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

-- Create topics table for managing available topics
CREATE TABLE IF NOT EXISTS topics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  main_category TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_email_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE summary_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE cron_job_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can view their own data" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own data" ON users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own data" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- RLS Policies for user_topics table
CREATE POLICY "Users can view their own topics" ON user_topics
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own topics" ON user_topics
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own topics" ON user_topics
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own topics" ON user_topics
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for user_email_settings table
CREATE POLICY "Users can view their own email settings" ON user_email_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own email settings" ON user_email_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own email settings" ON user_email_settings
  FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for email_archive table
CREATE POLICY "Users can view their own email archive" ON email_archive
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all email archive" ON email_archive
  FOR ALL USING (auth.role() = 'service_role');

-- RLS Policies for subscription_metadata table
CREATE POLICY "Users can view their own subscription data" ON subscription_metadata
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all subscription data" ON subscription_metadata
  FOR ALL USING (auth.role() = 'service_role');

-- RLS Policies for summary_cache table
CREATE POLICY "Service role can manage all summary cache" ON summary_cache
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Anyone can read summary cache" ON summary_cache
  FOR SELECT USING (true);

-- RLS Policies for cron_job_logs table
CREATE POLICY "Admins can read cron job logs" ON cron_job_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Service role can insert cron job logs" ON cron_job_logs
  FOR INSERT
  WITH CHECK (true);

-- RLS Policies for topics table
CREATE POLICY "Anyone can view active topics" ON topics
  FOR SELECT
  USING (is_active = TRUE);

CREATE POLICY "Admins can manage topics" ON topics
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Function to check topic limits
CREATE OR REPLACE FUNCTION check_topic_limit()
RETURNS TRIGGER AS $$
DECLARE
  user_tier TEXT;
  current_count INTEGER;
  max_topics INTEGER;
BEGIN
  -- Get user's subscription tier
  SELECT subscription_tier INTO user_tier
  FROM users
  WHERE id = NEW.user_id;
  
  -- Set max topics based on tier
  IF user_tier = 'paid' THEN
    max_topics := 12;
  ELSE
    max_topics := 5;
  END IF;
  
  -- Count current topics
  SELECT COUNT(*) INTO current_count
  FROM user_topics
  WHERE user_id = NEW.user_id;
  
  -- Check if adding this topic would exceed the limit
  IF current_count >= max_topics THEN
    RAISE EXCEPTION 'Topic limit exceeded. Free tier allows 5 topics, paid tier allows 12 topics.';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to enforce topic limits
CREATE TRIGGER enforce_topic_limit
  BEFORE INSERT ON user_topics
  FOR EACH ROW
  EXECUTE FUNCTION check_topic_limit();

-- Function to automatically create email settings when user is created
CREATE OR REPLACE FUNCTION create_user_email_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_email_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically create email settings
CREATE TRIGGER on_user_created_email_settings
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION create_user_email_settings();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_topics_user_id ON user_topics(user_id);
CREATE INDEX IF NOT EXISTS idx_user_email_settings_user_id ON user_email_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_email_archive_user_id ON email_archive(user_id);
CREATE INDEX IF NOT EXISTS idx_email_archive_sent_at ON email_archive(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscription_metadata_user_id ON subscription_metadata(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_metadata_stripe_id ON subscription_metadata(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_summary_cache_topic_date ON summary_cache(topic, date);
CREATE INDEX IF NOT EXISTS idx_summary_cache_date ON summary_cache(date DESC);
CREATE INDEX IF NOT EXISTS idx_summary_cache_is_paid ON summary_cache(is_paid);
CREATE INDEX IF NOT EXISTS idx_cron_job_logs_execution_date ON cron_job_logs(execution_date DESC);
CREATE INDEX IF NOT EXISTS idx_cron_job_logs_status ON cron_job_logs(status);
CREATE INDEX IF NOT EXISTS idx_topics_main_category ON topics(main_category);
CREATE INDEX IF NOT EXISTS idx_topics_is_active ON topics(is_active);

-- Function to handle user creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create user record if email is available
  IF NEW.email IS NOT NULL THEN
    BEGIN
      INSERT INTO users (id, email, subscription_tier)
      VALUES (NEW.id, NEW.email, 'free')
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email;
    EXCEPTION WHEN OTHERS THEN
      -- Log the error but don't fail the auth process
      RAISE WARNING 'Error creating user record: %', SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically create user record
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Function to automatically update summary_cache updated_at timestamp
CREATE OR REPLACE FUNCTION update_summary_cache_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update summary_cache updated_at
CREATE TRIGGER update_summary_cache_timestamp
  BEFORE UPDATE ON summary_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_summary_cache_updated_at();

-- Insert initial topics from the predefined list
INSERT INTO topics (name, main_category) VALUES
-- Sports
('NBA', 'Sports'),
('NFL', 'Sports'),
('MLB', 'Sports'),
('NHL', 'Sports'),
('Soccer', 'Sports'),

-- Politics
('U.S. Politics', 'Politics'),
('Global Politics', 'Politics'),

-- Technology
('AI', 'Technology'),
('Startups', 'Technology'),
('Gadgets', 'Technology'),
('Big Tech', 'Technology'),

-- Business and Finance
('Stock Market', 'Business and Finance'),
('Corporate News', 'Business and Finance'),
('Personal Finance Tips', 'Business and Finance'),

-- Science
('Medical Research', 'Science'),
('Environmental Science', 'Science'),
('Astronomy', 'Science'),
('NASA Missions', 'Science'),
('Scientific Discoveries', 'Science'),

-- Health and Wellness
('Fitness', 'Health and Wellness'),
('Nutrition', 'Health and Wellness'),
('Mental Health', 'Health and Wellness'),

-- Entertainment
('Movies', 'Entertainment'),
('TV Shows', 'Entertainment'),
('Celebrities', 'Entertainment'),

-- Lifestyle and Luxury
('High-End Fashion', 'Lifestyle and Luxury'),
('Wellness', 'Lifestyle and Luxury'),
('Home Decor', 'Lifestyle and Luxury'),


-- Education
('Higher Education', 'Education'),
('Online Learning', 'Education'),


-- World News
('Regional News', 'World News'),
('Europe', 'World News'),
('Asia', 'World News'),


-- Environment
('Climate Change', 'Environment'),
('Renewable Energy', 'Environment'),


-- Food
('Restaurant Reviews', 'Food'),
('Food Trends', 'Food'),

-- Gaming
('Game Releases', 'Gaming'),
('Console Updates', 'Gaming'),
('PC Gaming', 'Gaming'),

-- Culture
('Art', 'Culture'),
('Painting', 'Culture'),
('Graphic Design', 'Culture'),
('Sculpture', 'Culture'),
('Architecture', 'Culture'),


-- Parenting and Family
('Parenting Tips', 'Parenting and Family'),
('Child Development', 'Parenting and Family'),


-- Automotive
('Electric Vehicles', 'Automotive'),
('Car Reviews', 'Automotive'),


-- Career and Professional Development
('Resume Tips', 'Career and Professional Development'),
('Networking', 'Career and Professional Development'),


-- Military and Defense
('Global Conflicts', 'Military and Defense'),


-- Adventure and Outdoor Activities
('Hiking', 'Adventure and Outdoor Activities'),
('Camping', 'Adventure and Outdoor Activities'),


-- Personal Development
('Productivity', 'Personal Development'),
('Time Management', 'Personal Development'),

-- Legal and Policy
('Landmark Cases', 'Legal and Policy')
ON CONFLICT (name) DO NOTHING;
