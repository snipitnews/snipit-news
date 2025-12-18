-- Create topics table for managing available topics
CREATE TABLE IF NOT EXISTS topics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  main_category TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_topics_main_category ON topics(main_category);
CREATE INDEX IF NOT EXISTS idx_topics_is_active ON topics(is_active);

-- Enable RLS
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read active topics
CREATE POLICY "Anyone can view active topics" ON topics
  FOR SELECT
  USING (is_active = TRUE);

-- Only admins can manage topics
CREATE POLICY "Admins can manage topics" ON topics
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Insert initial topics from the predefined list
INSERT INTO topics (name, main_category) VALUES
-- Sports
('NBA', 'Sports'),
('NFL', 'Sports'),
('MLB', 'Sports'),
('NHL', 'Sports'),
('Soccer', 'Sports'),
('La Liga', 'Sports'),
('Ligue 1', 'Sports'),
('EPL', 'Sports'),
('Tennis', 'Sports'),
('Golf', 'Sports'),
('Esports', 'Sports'),
('Motorsports', 'Sports'),
('Athlete Spotlights', 'Sports'),
('Recovery and Injury Prevention', 'Sports'),

-- Politics
('U.S. Politics', 'Politics'),
('Global Politics', 'Politics'),
('Policy Updates', 'Politics'),
('Elections', 'Politics'),
('Legislative News', 'Politics'),
('International Law', 'Politics'),

-- Technology
('AI', 'Technology'),
('Startups', 'Technology'),
('Gadgets', 'Technology'),
('Big Tech', 'Technology'),
('Software Development', 'Technology'),
('Blockchain Technology', 'Technology'),
('Space Exploration', 'Technology'),
('Cybersecurity', 'Technology'),
('Emerging Tech Trends', 'Technology'),

-- Business and Finance
('Stock Market', 'Business and Finance'),
('Corporate News', 'Business and Finance'),
('Personal Finance Tips', 'Business and Finance'),
('Investments', 'Business and Finance'),
('Cryptocurrency', 'Business and Finance'),
('Bitcoin', 'Business and Finance'),
('Ethereum', 'Business and Finance'),
('NFTs', 'Business and Finance'),
('Economic Policies', 'Business and Finance'),
('Inflation Trends', 'Business and Finance'),
('Job Market', 'Business and Finance'),
('Venture Capital', 'Business and Finance'),
('Business Models', 'Business and Finance'),

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
('Public Health Policies', 'Health and Wellness'),
('Therapy Tips', 'Health and Wellness'),
('Mindfulness', 'Health and Wellness'),
('Coping Mechanisms', 'Health and Wellness'),
('Stress Management', 'Health and Wellness'),

-- Entertainment
('Movies', 'Entertainment'),
('TV Shows', 'Entertainment'),
('Celebrities', 'Entertainment'),
('Streaming Platforms', 'Entertainment'),
('Music', 'Entertainment'),
('Genres', 'Entertainment'),
('Albums', 'Entertainment'),
('Concerts', 'Entertainment'),
('Podcasts', 'Entertainment'),
('Reviews', 'Entertainment'),
('Trends', 'Entertainment'),
('Stand-Up Comedy', 'Entertainment'),
('Memes', 'Entertainment'),

-- Lifestyle and Luxury
('High-End Fashion', 'Lifestyle and Luxury'),
('Wellness', 'Lifestyle and Luxury'),
('Home Decor', 'Lifestyle and Luxury'),
('Travel', 'Lifestyle and Luxury'),
('Exclusive Destinations', 'Lifestyle and Luxury'),
('Fine Dining', 'Lifestyle and Luxury'),
('Watches', 'Lifestyle and Luxury'),
('Skincare', 'Lifestyle and Luxury'),
('Sustainable Living', 'Lifestyle and Luxury'),

-- Education
('Higher Education', 'Education'),
('Online Learning', 'Education'),
('Trends in Education', 'Education'),
('EdTech Innovations', 'Education'),
('Virtual Reality in Education', 'Education'),

-- World News
('Regional News', 'World News'),
('Europe', 'World News'),
('Asia', 'World News'),
('Africa', 'World News'),
('Global Events', 'World News'),
('Conflict Zones', 'World News'),
('International Relations', 'World News'),

-- Environment
('Climate Change', 'Environment'),
('Renewable Energy', 'Environment'),
('Wildlife Conservation', 'Environment'),
('Marine Conservation', 'Environment'),
('Eco-Tourism', 'Environment'),
('Sustainable Agriculture', 'Environment'),

-- Food
('Recipes', 'Food'),
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
('History', 'Culture'),
('Literature', 'Culture'),
('Cultural Festivals', 'Culture'),
('Military History', 'Culture'),
('Pop Culture Analysis', 'Culture'),

-- Parenting and Family
('Parenting Tips', 'Parenting and Family'),
('Child Development', 'Parenting and Family'),
('Work-Life Balance', 'Parenting and Family'),
('Family Health', 'Parenting and Family'),
('Teen Trends', 'Parenting and Family'),

-- Automotive
('Electric Vehicles', 'Automotive'),
('Car Reviews', 'Automotive'),
('Auto Industry News', 'Automotive'),
('Drones in Transportation', 'Automotive'),

-- Career and Professional Development
('Resume Tips', 'Career and Professional Development'),
('Networking', 'Career and Professional Development'),
('Industry Trends', 'Career and Professional Development'),
('Remote Work', 'Career and Professional Development'),
('Career Growth Strategies', 'Career and Professional Development'),
('Work Culture', 'Career and Professional Development'),

-- Military and Defense
('Global Conflicts', 'Military and Defense'),
('Weapons Technology', 'Military and Defense'),
('Defense Strategies', 'Military and Defense'),
('Cybersecurity in Warfare', 'Military and Defense'),

-- Adventure and Outdoor Activities
('Hiking', 'Adventure and Outdoor Activities'),
('Camping', 'Adventure and Outdoor Activities'),
('National Parks', 'Adventure and Outdoor Activities'),
('Extreme Sports', 'Adventure and Outdoor Activities'),

-- Personal Development
('Productivity', 'Personal Development'),
('Time Management', 'Personal Development'),
('Goal Setting', 'Personal Development'),
('Emotional Intelligence', 'Personal Development'),

-- Legal and Policy
('Landmark Cases', 'Legal and Policy'),
('Legal Advice', 'Legal and Policy'),
('Intellectual Property', 'Legal and Policy'),
('Legislative Updates', 'Legal and Policy'),

-- Shopping and Deals
('E-Commerce', 'Shopping and Deals'),
('Seasonal Sales', 'Shopping and Deals'),
('Product Reviews', 'Shopping and Deals'),
('Discount Alerts', 'Shopping and Deals'),

-- Festivals and Events
('Music Festivals', 'Festivals and Events'),
('Cultural Celebrations', 'Festivals and Events'),
('Conferences', 'Festivals and Events'),
('Local Fairs', 'Festivals and Events'),

-- Pets and Animals
('Pet Care', 'Pets and Animals'),
('Wildlife', 'Pets and Animals'),
('Animal Behavior', 'Pets and Animals'),
('Animal Rescue', 'Pets and Animals')
ON CONFLICT (name) DO NOTHING;

