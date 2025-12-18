-- Enable Row Level Security

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  subscription_tier TEXT NOT NULL DEFAULT 'free' CHECK (subscription_tier IN ('free', 'paid')),
  stripe_customer_id TEXT UNIQUE,
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

-- Enable Row Level Security on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_email_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_metadata ENABLE ROW LEVEL SECURITY;

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
