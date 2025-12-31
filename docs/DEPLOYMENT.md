# Deployment Guide

## Branch Strategy

We use a **three-branch deployment strategy**:

- **`main`** → Production (snipit.news)
- **`staging`** → Staging environment (staging.snipit.news or Vercel preview)
- **Feature branches** → PR previews (automatic Vercel previews)

## Workflow

### 1. Development Workflow

```bash
# Create a feature branch from staging
git checkout staging
git pull origin staging
git checkout -b feature/your-feature-name

# Make your changes and commit
git add .
git commit -m "feat: your feature description"

# Push and create PR to staging
git push origin feature/your-feature-name
```

### 2. Staging Deployment

1. **Create PR to `staging` branch**
   - Vercel will automatically create a preview deployment
   - Test the preview URL
   - Get team review/approval

2. **Merge PR to `staging`**
   - Vercel will automatically deploy to staging environment
   - Test thoroughly on staging

### 3. Production Deployment

1. **Create PR from `staging` to `main`**
   - Vercel will create a preview deployment
   - Final review and testing

2. **Merge PR to `main`**
   - Vercel will automatically deploy to production (snipit.news)
   - Monitor deployment and test production

## Vercel Configuration

### Environment Variables

Set environment variables in Vercel Dashboard for each environment:

**Production (main branch):**
- `NEXT_PUBLIC_APP_URL=https://snipit.news`
- All production API keys and secrets

**Staging (staging branch):**
- `NEXT_PUBLIC_APP_URL=https://staging.snipit.news` (or Vercel preview URL)
- Staging/test API keys (if using separate services)

**Preview (PR branches):**
- Uses staging environment variables by default
- Can override per-preview if needed

### Setting Up Environments in Vercel

1. Go to **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**
2. Add variables for each environment:
   - **Production**: Select "Production" only
   - **Preview**: Select "Preview" only  
   - **Development**: Select "Development" only
   - **All**: Select all environments

### Recommended Environment Variable Setup

```
# Production Only
NEXT_PUBLIC_APP_URL=https://snipit.news
STRIPE_WEBHOOK_SECRET=whsec_prod_...
CRON_SECRET=prod_secret_...

# Staging Only
NEXT_PUBLIC_APP_URL=https://staging.snipit.news
STRIPE_WEBHOOK_SECRET=whsec_test_...
CRON_SECRET=staging_secret_...

# All Environments (shared)
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
OPENAI_API_KEY=...
NEWS_API_KEY=...
RESEND_API_KEY=...
```

## Supabase Configuration

### Redirect URLs

Add these URLs in **Supabase Dashboard** → **Authentication** → **URL Configuration**:

**Production:**
- `https://snipit.news/api/auth/callback`
- `https://snipit.news/auth/callback`

**Staging:**
- `https://staging.snipit.news/api/auth/callback` (or your staging URL)
- `https://staging.snipit.news/auth/callback`

**Development:**
- `http://localhost:3000/api/auth/callback`
- `http://localhost:3000/auth/callback`

### Site URL

Set the **Site URL** in Supabase:
- **Production**: `https://snipit.news`
- **Staging**: Your staging URL
- **Development**: `http://localhost:3000`

## Stripe Configuration

### Webhooks

Set up separate webhook endpoints for each environment:

**Production:**
- Endpoint: `https://snipit.news/api/webhooks/stripe`
- Use production webhook secret

**Staging:**
- Endpoint: `https://staging.snipit.news/api/webhooks/stripe`
- Use test mode webhook secret

## Testing Checklist

### Before Merging to Staging
- [ ] Code passes linting
- [ ] Build succeeds locally
- [ ] Feature works in local development
- [ ] No console errors

### Before Merging to Production
- [ ] Tested on staging environment
- [ ] All environment variables are set correctly
- [ ] Supabase redirect URLs are configured
- [ ] Stripe webhooks are configured (if applicable)
- [ ] Email delivery works
- [ ] Authentication flow works
- [ ] Payment flow works (test mode)

## Rollback Procedure

If something goes wrong in production:

1. **Quick Rollback in Vercel:**
   - Go to **Deployments** tab
   - Find the last working deployment
   - Click **"..."** → **"Promote to Production"**

2. **Git Rollback:**
   ```bash
   # Revert the problematic commit
   git revert <commit-hash>
   git push origin main
   ```

## Monitoring

- Check **Vercel Dashboard** → **Deployments** for deployment status
- Monitor **Vercel Analytics** for errors and performance
- Check **Supabase Dashboard** for database issues
- Monitor **Stripe Dashboard** for payment issues

## Best Practices

1. **Always test on staging first** before deploying to production
2. **Use feature flags** for risky changes
3. **Keep PRs small and focused**
4. **Write clear commit messages**
5. **Review environment variables** before each deployment
6. **Monitor deployments** for the first few minutes after going live
7. **Have a rollback plan** ready

## Troubleshooting

### Deployment Fails
- Check build logs in Vercel
- Verify all environment variables are set
- Ensure dependencies are up to date

### Authentication Not Working
- Verify Supabase redirect URLs are correct
- Check `NEXT_PUBLIC_APP_URL` is set correctly
- Verify Site URL in Supabase matches environment

### Environment Variables Not Working
- Check variable names match exactly (case-sensitive)
- Verify environment is selected correctly (Production/Preview/Development)
- Redeploy after adding new variables

