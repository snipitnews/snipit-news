# Codebase Organization

This document describes the organization of the SnipIt codebase.

## Directory Structure

### `/docs/` - Documentation and Configuration Files
- **SQL Scripts** (`docs/sql/`): All database migration and setup scripts
  - `supabase-schema.sql` - Main database schema
  - `admin-schema-update.sql` - Admin role additions
  - `create-email-settings-table.sql` - Email settings table
  - `create-summary-cache-table.sql` - Summary caching table
  - `create-topics-table.sql` - Topics management table
  - `check-schema.sql` - Schema validation
  - `fix-trigger.sql` - Trigger fixes

- **Templates** (`docs/templates/`): Email and other templates
  - `MAGIC_LINK_EMAIL_TEMPLATE.html` - Magic link email template

- **Documentation** (`docs/`): All markdown documentation files
  - `README.md` - Main project documentation
  - `SETUP.md` - Setup instructions
  - `SUPABASE_SETUP.md` - Supabase configuration guide
  - `TEST_EMAIL.md` - Email testing guide
  - `FIX_DATABASE.md` - Database troubleshooting
  - `FIX_MAGIC_LINK_AUTH.md` - Authentication troubleshooting
  - `OPTIMIZATION_SUMMARY.md` - Performance optimizations

### `/scripts/` - Utility Scripts
- `test-setup.js` - Environment variable validation script

### `/src/` - Application Source Code
- `app/` - Next.js App Router pages and API routes
- `components/` - Reusable React components
- `lib/` - Utility libraries and services

### `/public/` - Static Assets
- `favicon.png` - Site favicon (used in layout.tsx)
- `logos/` - Logo assets
  - `Asset 3@4x-8.png` - Main SnipIt logo (used in Navigation)
  - `README.md` - Logo usage documentation

## Files Removed During Cleanup

The following unused files were removed:
- `src/app/page-old.tsx` - Old backup of landing page
- `src/app/page-redesigned.tsx` - Redesigned backup of landing page
- `test-summaries.ts` - Standalone test script (replaced by API route)
- `public/file.svg` - Unused Next.js default asset
- `public/globe.svg` - Unused Next.js default asset
- `public/next.svg` - Unused Next.js default asset
- `public/vercel.svg` - Unused Next.js default asset
- `public/window.svg` - Unused Next.js default asset
- `public/logos/Asset 4.svg` - Unused logo variant
- `public/logos/Asset 5.svg` - Unused logo variant
- `public/logos/Asset 6.svg` - Unused logo variant
- `public/logos/Asset 7.svg` - Unused logo variant
- `public/logos/Favicon.png` - Duplicate favicon (using root favicon.png)

## Active Files

### Images in Use
- `/favicon.png` - Referenced in `src/app/layout.tsx`
- `/logos/Asset 3@4x-8.png` - Referenced in `src/components/Navigation.tsx`

### Test Endpoints
- `/api/test-email` - Test email sending
- `/api/test-summaries` - Test summary generation with static data

