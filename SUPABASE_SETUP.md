# Supabase Configuration Fix

## Issue: Magic Link Expired Error

The error "otp_expired" means the magic link has expired or the redirect URL isn't properly configured in Supabase.

## Fix Steps:

### 1. Configure Redirect URLs in Supabase

1. Go to your Supabase project dashboard
2. Navigate to **Authentication** → **URL Configuration**
3. Under **Redirect URLs**, add these URLs:
   - `http://localhost:3000/api/auth/callback`
   - `http://localhost:3000/**` (for development)
   - Your production URL when deployed (e.g., `https://yourdomain.com/api/auth/callback`)

### 2. Check Site URL

1. In Supabase dashboard, go to **Authentication** → **URL Configuration**
2. Set **Site URL** to: `http://localhost:3000` (for development)
3. For production, set it to your actual domain

### 3. Verify Email Settings

1. Go to **Authentication** → **Email Templates**
2. Make sure email templates are enabled
3. Check that the magic link template includes the redirect URL

### 4. Test Again

After making these changes:
1. Request a new magic link (the old one is expired)
2. Click the link immediately (they expire after 1 hour)
3. Make sure you're using the same browser/device

## Common Issues:

- **Link expired**: Magic links expire after 1 hour. Request a new one.
- **Wrong redirect URL**: The redirect URL in the email must match what's configured in Supabase
- **Browser cache**: Clear your browser cache and cookies
- **Multiple requests**: Don't request multiple magic links - use the most recent one

## Quick Test:

1. Go to http://localhost:3000
2. Enter your email
3. Check your email immediately
4. Click the magic link within a few minutes
5. You should be redirected to the dashboard

