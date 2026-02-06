# SnipIt - Personalized News Delivery Platform

SnipIt is a personalized news delivery platform designed for busy individuals who want to stay informed without wasting time. Our value proposition lies in delivering concise, interest-specific news updates directly to your email in under 60 seconds.

## Features

- **Passwordless Authentication**: Sign up with just your email - no passwords required
- **Topic Selection**: Choose up to 3 topics (free) or 12 topics (pro) that interest you
- **AI-Powered Summaries**: Get bullet-point summaries (free) or paragraph summaries (pro)
- **Daily Delivery**: Receive your personalized digest every morning at 6:30 AM EST
- **Real-time News**: Get news from the last 24 hours
- **Seamless Upgrades**: Easy upgrade to Pro tier for $0.99/month

## Tech Stack

- **Frontend/Backend**: Next.js 14 (App Router) + React + TypeScript
- **Database & Auth**: Supabase (passwordless email magic links)
- **Payment**: Stripe (Checkout + Customer Portal)
- **Email Delivery**: Resend (100 emails/day free tier)
- **News Source**: NewsAPI.org (free tier: 100 requests/day)
- **AI Summarization**: OpenAI GPT-4 API
- **Hosting**: Vercel (free tier)
- **Scheduling**: Vercel Cron Jobs (free)

## Setup Instructions

### 1. Clone and Install Dependencies

```bash
git clone <your-repo-url>
cd snipit-news
npm install
```

### 2. Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key_here
STRIPE_SECRET_KEY=your_stripe_secret_key_here
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret_here

# OpenAI
OPENAI_API_KEY=your_openai_api_key_here

# News API
NEWS_API_KEY=your_news_api_key_here

# Resend
RESEND_API_KEY=your_resend_api_key_here

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Cron Secret (for securing cron endpoints)
CRON_SECRET=your_cron_secret_here
```

### 3. Database Setup

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Run the SQL schema from `supabase-schema.sql` in your Supabase SQL editor
3. Enable email authentication in Supabase Auth settings
4. Add your domain to the allowed redirect URLs

### 4. Service Setup

#### Stripe

1. Create a Stripe account at [stripe.com](https://stripe.com)
2. Create a product called "SnipIt Pro" with a monthly price of $0.99
3. Set up webhook endpoint: `https://yourdomain.com/api/webhooks/stripe`
4. Add webhook events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`

#### NewsAPI

1. Sign up at [newsapi.org](https://newsapi.org)
2. Get your free API key (100 requests/day)

#### OpenAI

1. Create an account at [platform.openai.com](https://platform.openai.com)
2. Generate an API key
3. Add some credits to your account

#### Resend

1. Sign up at [resend.com](https://resend.com)
2. Get your API key
3. Verify your domain or use the free @resend.dev domain

### 5. Development

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to see the application.

### 6. Deployment

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add all environment variables in Vercel dashboard
4. Deploy!

## API Endpoints

- `GET /` - Landing page
- `GET /dashboard` - User dashboard (protected)
- `POST /api/auth/callback` - Supabase auth callback
- `GET /api/topics` - Get user topics
- `POST /api/topics` - Add new topic
- `DELETE /api/topics` - Remove topic
- `POST /api/checkout` - Create Stripe checkout session
- `POST /api/webhooks/stripe` - Stripe webhook handler
- `GET /api/cron/send-digests` - Daily digest cron job
- `GET /unsubscribe` - Unsubscribe page

## Database Schema

### Users Table

- `id` (UUID, Primary Key)
- `email` (TEXT, Unique)
- `subscription_tier` (TEXT: 'free' | 'paid')
- `stripe_customer_id` (TEXT, Nullable)
- `created_at` (TIMESTAMP)

### User Topics Table

- `id` (UUID, Primary Key)
- `user_id` (UUID, Foreign Key)
- `topic_name` (TEXT)
- `created_at` (TIMESTAMP)

### Subscription Metadata Table

- `id` (UUID, Primary Key)
- `user_id` (UUID, Foreign Key)
- `stripe_subscription_id` (TEXT, Unique)
- `status` (TEXT)
- `current_period_end` (TIMESTAMP)
- `created_at` (TIMESTAMP)

## Cost Breakdown (Monthly)

- **Supabase**: $0 (free tier: 50k MAU, 500MB database)
- **Vercel**: $0 (free tier: 100GB bandwidth, unlimited cron jobs)
- **Resend**: $0 up to 100 emails/day, then $20/mo for 50k emails
- **NewsAPI**: $0 (free tier: 100 requests/day, sufficient for ~100 users)
- **OpenAI**: ~$0.01-0.03 per user per day (GPT-4 usage)
- **Stripe**: 2.9% + $0.30 per transaction

For first 100 users sending daily emails: **~$30-50/month** in OpenAI costs only.

## Features Roadmap

- [ ] User-configurable email delivery time
- [ ] Historical email viewing on website
- [ ] Topic suggestions based on user interests
- [ ] Mobile app
- [ ] Social sharing of summaries
- [ ] Custom digest frequency (daily/weekly)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - see LICENSE file for details.
