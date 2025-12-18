# Fix Magic Link Authentication Error

## The Problem
Getting error: "invalid request: both auth code and code verifier should be non-empty"

This happens when Supabase tries to use PKCE flow for email OTP, but email OTP doesn't use PKCE.

## Root Cause
The redirect URL in your Supabase dashboard might be pointing to `/api/auth/callback` instead of `/auth/callback`, OR the emailRedirectTo in your code might not be matching what's configured.

## Fix Steps

### 1. Check Supabase Dashboard Configuration

Go to your Supabase Dashboard:
1. Navigate to **Authentication** → **URL Configuration**
2. Check the **Site URL** - should be: `http://localhost:3000` (for dev)
3. Check **Redirect URLs** - should include:
   - `http://localhost:3000/auth/callback` ✅ (CORRECT - client-side)
   - `http://localhost:3000/api/auth/callback` ❌ (WRONG - this causes PKCE errors)

**IMPORTANT**: The code now handles both:
- `/api/auth/callback` - Server-side code exchange (tries PKCE first, then redirects to client if needed)
- `/auth/callback` - Client-side OTP verification (fallback for email OTP codes)

### 2. Update Redirect URLs

In Supabase Dashboard → Authentication → URL Configuration:

**Add** (both are needed):
- `http://localhost:3000/api/auth/callback` ✅ (for server-side code exchange)
- `http://localhost:3000/auth/callback` ✅ (for client-side OTP verification fallback)
- `http://localhost:3000/api/auth/callback/**` (wildcard for all paths)
- `http://localhost:3000/auth/callback/**` (wildcard for all paths)

### 3. Verify Email Template

1. Go to **Authentication** → **Email Templates**
2. Click on **Magic Link** template
3. Check that the confirmation link uses: `{{ .ConfirmationURL }}`
4. Make sure the template redirects to `/auth/callback`, not `/api/auth/callback`

### 4. Test Again

1. Request a new magic link (old ones may be expired)
2. Click the link from your email
3. Check browser console for detailed logs
4. The logs will show:
   - What parameters are received
   - Which verification method is tried
   - Why it fails (if it does)

## What the Logs Should Show

When you click a magic link, you should see in the browser console:

**Server-side (API route):**
```
🔍 API Auth Callback - Request received
  Code: abc123... (length: XX)
🔐 Code parameter detected - attempting server-side exchange
  ✅ Code exchange successful on server side (PKCE/OAuth flow)
```

**OR if it redirects to client-side:**
```
🔍 Client Auth Callback - Starting authentication flow
  Code: abc123... (length: XX)
🔐 Attempting OTP verification with code...
  ✅ Successfully verified OTP as email!
```

## Common Error: "Email link is invalid or has expired" (403)

This error means:
1. **The code was already used** - Email clients sometimes pre-fetch links, consuming the code
2. **The code expired** - Magic link codes expire quickly (usually within a few minutes)
3. **The redirect URL doesn't match** - Check Supabase dashboard configuration

**Solution:**
- Request a **new magic link** (old ones cannot be reused)
- Click the link **immediately** after receiving it
- Make sure your Supabase redirect URLs are correctly configured

If you see errors, share the full console output.

## Alternative: Check if Code Needs Different Handling

If OTP verification still fails, the console logs will show the exact error. Common issues:

1. **Code expired**: Request a new magic link
2. **Code already used**: Request a new magic link  
3. **Wrong redirect URL**: Fix Supabase dashboard configuration
4. **Code format issue**: The logs will show what's wrong

## Quick Test

After updating Supabase configuration:
1. Clear browser cookies for localhost:3000
2. Request a new magic link
3. Click the link immediately
4. Check console logs for detailed debugging info

