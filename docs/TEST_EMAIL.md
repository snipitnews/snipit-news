# Test Email Sending

## Option 1: Using curl (Terminal)

Run this command in your terminal:

```bash
curl -X GET "http://localhost:3000/api/cron/send-digests" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Replace `YOUR_CRON_SECRET` with the value from your `.env.local` file (the `CRON_SECRET` variable).

## Option 2: Using Browser (if CRON_SECRET is set)

If you want to test without curl, you can temporarily modify the route to accept requests without auth for testing, or use a tool like Postman/Insomnia.

## Option 3: Create a Test Button (Quick & Easy)

I can create a test button in your dashboard that triggers the email sending for just your user account.

## What to Check

After triggering:
1. Check your email inbox (and spam folder)
2. Check the terminal/console for logs
3. Check the email archive in your dashboard
4. Verify the email contains your selected topics

