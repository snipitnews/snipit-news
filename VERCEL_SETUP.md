# Vercel Setup Guide

## Initial Setup

### 1. Connect Repository to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"Add New..."** → **"Project"**
3. Import your GitHub repository
4. Configure:
   - **Framework Preset**: Next.js
   - **Root Directory**: `./` (default)
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `.next` (default)

### 2. Configure Branch Deployments

In **Vercel Dashboard** → **Settings** → **Git**:

- **Production Branch**: `main`
- **Enable Automatic Deployments**: ✅
- **Enable Preview Deployments**: ✅ (for PRs)

### 3. Set Up Staging Environment

1. Go to **Settings** → **Git**
2. Under **"Ignored Build Step"**, leave empty (or add custom logic)
3. Go to **Settings** → **Deployment Protection**
4. Add branch protection for `main` (optional but recommended)

## Environment Variables Setup

### Production Environment (main branch)

Go to **Settings** → **Environment Variables** and add:

```
NEXT_PUBLIC_APP_URL=https://snipit.news
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_key
STRIPE_SECRET_KEY=your_stripe_secret
STRIPE_WEBHOOK_SECRET=your_webhook_secret
OPENAI_API_KEY=your_openai_key
NEWS_API_KEY=your_news_api_key
RESEND_API_KEY=your_resend_key
CRON_SECRET=generate_secure_random_string_here
```

**Important**: Select **"Production"** environment only for these.

### Staging Environment (staging branch)

Add the same variables but:
- `NEXT_PUBLIC_APP_URL` should point to your staging URL (or Vercel preview URL)
- Use test/staging API keys where applicable
- Select **"Preview"** environment for staging variables

### Shared Variables

Some variables can be shared across all environments:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `NEWS_API_KEY`
- `RESEND_API_KEY`

Select **"Production, Preview, Development"** for these.

## Domain Configuration

### Production Domain

1. Go to **Settings** → **Domains**
2. Add `snipit.news`
3. Add `www.snipit.news`
4. Follow DNS configuration instructions
5. Wait for DNS propagation (5-30 minutes)

### Staging Domain (Optional)

If you want a separate staging domain:
1. Add `staging.snipit.news` (or use Vercel's preview URLs)
2. Configure DNS similarly

## Cron Jobs

1. Go to **Settings** → **Cron Jobs**
2. Verify the cron job from `vercel.json` is active:
   - Path: `/api/cron/send-digests`
   - Schedule: `30 11 * * *` (6:30 AM EST)
3. Ensure `CRON_SECRET` is set in environment variables

## Pull Request Previews

PR previews are **automatically enabled** when you:
1. Create a PR from any branch to `main` or `staging`
2. Vercel will create a preview deployment
3. The preview URL will be added as a comment on the PR

### PR Preview Workflow

1. Create feature branch: `git checkout -b feature/new-feature`
2. Make changes and push: `git push origin feature/new-feature`
3. Create PR to `staging` (or `main`)
4. Vercel automatically creates preview deployment
5. Test on preview URL
6. Merge when ready

## Deployment Workflow

### Recommended Flow

```
Feature Branch → PR to Staging → Merge to Staging → PR to Main → Merge to Main
     ↓                ↓                    ↓                ↓              ↓
  Preview         Preview            Staging          Preview      Production
```

### Step-by-Step

1. **Development**
   ```bash
   git checkout staging
   git checkout -b feature/my-feature
   # Make changes
   git push origin feature/my-feature
   # Create PR to staging
   ```

2. **Staging Review**
   - PR preview is automatically created
   - Review and test on preview URL
   - Get approvals
   - Merge to `staging`

3. **Staging Deployment**
   - Automatically deploys to staging environment
   - Test thoroughly

4. **Production Release**
   ```bash
   git checkout main
   git checkout -b release/staging-to-main
   git merge staging
   git push origin release/staging-to-main
   # Create PR to main
   ```

5. **Production Deployment**
   - PR preview created
   - Final review
   - Merge to `main`
   - Automatically deploys to production

## Monitoring Deployments

1. **Vercel Dashboard** → **Deployments**
   - See all deployments
   - View build logs
   - Promote previous deployments if needed

2. **Vercel Analytics**
   - Monitor performance
   - Track errors
   - View real-time metrics

## Troubleshooting

### Build Fails
- Check build logs in Vercel
- Verify all environment variables are set
- Ensure `package.json` scripts are correct

### Environment Variables Not Working
- Check variable names (case-sensitive)
- Verify environment selection (Production/Preview/Development)
- Redeploy after adding variables

### Domain Not Working
- Check DNS configuration
- Wait for DNS propagation
- Verify domain in Vercel dashboard

### Cron Job Not Running
- Verify cron job is active in Vercel
- Check `CRON_SECRET` is set
- Verify the endpoint is accessible

## Next Steps

1. ✅ Set up environment variables in Vercel
2. ✅ Configure domains
3. ✅ Push `staging` branch to GitHub
4. ✅ Test PR preview deployments
5. ✅ Test staging deployment
6. ✅ Test production deployment

