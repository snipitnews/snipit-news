-- Create user_email_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_email_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  delivery_time TIME WITH TIME ZONE DEFAULT '08:00:00-05:00',
  timezone TEXT DEFAULT 'America/New_York',
  paused BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE user_email_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_email_settings table
DROP POLICY IF EXISTS "Users can view their own email settings" ON user_email_settings;
CREATE POLICY "Users can view their own email settings" ON user_email_settings
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own email settings" ON user_email_settings;
CREATE POLICY "Users can insert their own email settings" ON user_email_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own email settings" ON user_email_settings;
CREATE POLICY "Users can update their own email settings" ON user_email_settings
  FOR UPDATE USING (auth.uid() = user_id);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_user_email_settings_user_id ON user_email_settings(user_id);

-- Create email_archive table if it doesn't exist
CREATE TABLE IF NOT EXISTS email_archive (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  subject TEXT NOT NULL,
  content JSONB NOT NULL,
  topics TEXT[] NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security on email_archive
ALTER TABLE email_archive ENABLE ROW LEVEL SECURITY;

-- RLS Policies for email_archive table
DROP POLICY IF EXISTS "Users can view their own email archive" ON email_archive;
CREATE POLICY "Users can view their own email archive" ON email_archive
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage all email archive" ON email_archive;
CREATE POLICY "Service role can manage all email archive" ON email_archive
  FOR ALL USING (auth.role() = 'service_role');

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_email_archive_user_id ON email_archive(user_id);
CREATE INDEX IF NOT EXISTS idx_email_archive_sent_at ON email_archive(sent_at DESC);

