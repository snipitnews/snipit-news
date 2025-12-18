# Quick Setup & Testing Guide

## Step 1: Create Environment Variables File

Create a `.env.local` file in the root directory:

```bash
# Supabase (Required)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# OpenAI (Required for summaries)
OPENAI_API_KEY=your_openai_api_key

# NewsAPI (Required for fetching news)
NEWS_API_KEY=your_news_api_key

# Resend (Required for sending emails)
RESEND_API_KEY=your_resend_api_key

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Cron Secret (any random string for testing)
CRON_SECRET=test-secret-123

# Stripe (Optional - only needed for payments)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_key
STRIPE_SECRET_KEY=your_stripe_secret
STRIPE_WEBHOOK_SECRET=your_webhook_secret
```

## Step 2: Set Up Supabase Database

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a new project
3. Go to SQL Editor
4. Copy and paste the entire contents of `supabase-schema.sql`
5. Run the SQL script

## Step 3: Get API Keys

### NewsAPI (Free)

- Go to [newsapi.org](https://newsapi.org)
- Sign up for free account
- Get your API key from the dashboard

### OpenAI

- Go to [platform.openai.com](https://platform.openai.com)
- Create account and add credits
- Create an API key

### Resend (Free tier available)

- Go to [resend.com](https://resend.com)
- Sign up and get API key
- Free tier: 100 emails/day

## Step 4: Run the Development Server

```bash
npm run dev
```

The app will start at: http://localhost:3000

## Step 5: Test the Application

### Test User Flow:

1. **Sign Up**

   - Go to http://localhost:3000
   - Enter your email
   - Check your email for magic link
   - Click the link to sign in

2. **Add Topics**

   - After signing in, you'll be redirected to `/dashboard`
   - Add topics like: "artificial intelligence", "tech", "crypto", "sports"
   - Free tier: up to 5 topics
   - Paid tier: up to 10 topics

3. **Configure Settings**

   - Click "Settings" tab
   - Set delivery time
   - Choose timezone
   - Test pause/resume functionality

4. **Test Email Sending (Manual)**

   - Open a new terminal
   - Run this curl command to manually trigger the cron job:

   ```bash
   curl -X GET "http://localhost:3000/api/cron/send-digests" \
     -H "Authorization: Bearer test-secret-123"
   ```

   - Check your email inbox for the digest

5. **View Archive**
   - Click "Archive" tab in dashboard
   - See all sent emails

## Step 6: Test API Endpoints Directly

### Get Email Settings

```bash
# First, get your session cookie from browser after logging in
curl http://localhost:3000/api/email-settings
```

### Update Email Settings

```bash
curl -X PUT http://localhost:3000/api/email-settings \
  -H "Content-Type: application/json" \
  -d '{"delivery_time": "09:00:00-05:00", "timezone": "America/New_York", "paused": false}'
```

### Get Archive

```bash
curl http://localhost:3000/api/archive
```

## Troubleshooting

### Database Errors

- Make sure you ran the SQL schema in Supabase
- Check that RLS policies are enabled
- Verify your service role key is correct

### Email Not Sending

- Check Resend API key is valid
- Verify email address is correct
- Check Resend dashboard for delivery status

### News Not Fetching

- Verify NewsAPI key is valid
- Check NewsAPI rate limits (100 requests/day free tier)
- Check browser console for errors

### OpenAI Errors

- Verify API key has credits
- Check rate limits
- Ensure you're using a valid model

## Quick Test Checklist

- [ ] App starts without errors
- [ ] Can sign up with email
- [ ] Can add topics
- [ ] Can view dashboard
- [ ] Can update email settings
- [ ] Can pause/resume emails
- [ ] Manual cron trigger sends email
- [ ] Email archive shows sent emails
- [ ] Topics are limited correctly (5 free, 10 paid)
