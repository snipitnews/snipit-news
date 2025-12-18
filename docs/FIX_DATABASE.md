# Fix Database Error - "Database error saving new user"

## Problem
When signing up with email, you get "Database error saving new user" because the database trigger is failing.

## Solution

Run this SQL in your Supabase SQL Editor to fix the trigger:

```sql
-- Drop and recreate the trigger function with better error handling
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

-- Recreate the function with better error handling
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

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();
```

## Alternative: Manual User Creation

If the trigger still doesn't work, you can manually create users in the auth callback:

1. Update `src/app/api/auth/callback/route.ts` to manually create the user record
2. Or use a Supabase Edge Function to handle user creation

## Verify the Fix

1. Try signing up with a new email
2. Check the Supabase logs for any errors
3. Verify the user record was created in the `users` table

