-- Add role column to users table for admin support
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin'));

-- Create index for role lookups
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Update RLS policies to allow admins to view all users
-- Note: This requires service role for admin operations, but we'll handle admin checks in application code

-- Function to check if user is admin (for use in application code)
-- Admins can be identified by checking users.role = 'admin'

