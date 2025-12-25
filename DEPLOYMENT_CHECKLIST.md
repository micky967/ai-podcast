# Production Deployment Checklist

Use this checklist to migrate your existing development setup to production.

## Pre-Deployment: Verify Existing Services

### Clerk (Already Set Up)
- [ ] Go to Clerk Dashboard → Verify JWT template named `convex` exists
- [ ] If missing, create JWT template:
  - Name: `convex` (exact match)
  - Token Lifetime: 86400 seconds (24 hours)
  - Claims: `{"sub": "{{user.id}}"}`
- [ ] Copy `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (from API Keys)
- [ ] Copy `CLERK_SECRET_KEY` (from API Keys)
- [ ] Copy `CLERK_JWT_ISSUER_DOMAIN` (from JWT template, domain only, no https://)

### Convex (Already Set Up)
- [ ] Go to Convex Dashboard → Note your current project URL
- [ ] Decide: Use existing as production OR create new production deployment

**Option A: Use Existing Dev as Production**
- [ ] Note deployment URL: `https://[project-name].convex.cloud`
- [ ] This will be your production URL

**Option B: Create New Production Deployment**
- [ ] Create new deployment in Convex Dashboard
- [ ] Note new deployment URL
- [ ] Plan for data migration (if needed)

### Generate Encryption Key
- [ ] Run: `openssl rand -hex 32`
- [ ] Copy the 64-character hex string
- [ ] Save securely (you'll need this!)

## Deploy Convex to Production

- [ ] Run: `npx convex deploy` (deploys to prod by default)
- [ ] Verify schema deployed successfully
- [ ] In Convex Dashboard → Production deployment → Settings → Environment Variables
- [ ] Set: `CLERK_JWT_ISSUER_DOMAIN` = (same value as Clerk, without https://)

## Vercel Deployment

### Connect Repository
- [ ] Go to Vercel Dashboard → Add New Project
- [ ] Import GitHub repository
- [ ] Verify build settings (Next.js auto-detected)

### Environment Variables (Add BEFORE Deploying)

**Required:**
- [ ] `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` = (from Clerk)
- [ ] `CLERK_SECRET_KEY` = (from Clerk)
- [ ] `CLERK_JWT_ISSUER_DOMAIN` = (from Clerk JWT template)
- [ ] `NEXT_PUBLIC_CONVEX_URL` = (from Convex production deployment)
- [ ] `ENCRYPTION_KEY` = (64-char hex string you generated)

**Optional (Fallback API Keys):**
- [ ] `OPENAI_API_KEY` = (if you want fallback)
- [ ] `ASSEMBLYAI_API_KEY` = (if you want fallback)

### Deploy
- [ ] Click Deploy
- [ ] Wait for build to complete
- [ ] Note deployment URL: `https://[your-app].vercel.app`

## Post-Deployment: Connect Services

### Inngest
- [ ] Go to Inngest Dashboard → Add App
- [ ] Enter URL: `https://[your-vercel-app].vercel.app/api/inngest`
- [ ] Click Sync
- [ ] Verify functions appear: `podcastProcessor`, `retryJobFunction`

## Testing Production

### Authentication
- [ ] Visit deployed app
- [ ] Test sign up
- [ ] Test login
- [ ] Verify user created in Convex production database

### File Processing
- [ ] Log in to production app
- [ ] Go to Settings → Add API keys (OpenAI, AssemblyAI)
- [ ] Upload test audio file
- [ ] Verify upload succeeds
- [ ] Check Inngest Dashboard → Executions (should see processing)
- [ ] Wait for processing to complete
- [ ] Verify results appear in app
- [ ] Check Convex Dashboard → Data (should see project)

### Verify All Services Connected
- [ ] Clerk: Authentication working
- [ ] Convex: Data being created in production database
- [ ] Inngest: Functions executing successfully
- [ ] Vercel Blob: Files uploading (automatic)

## Production Ready ✅

Once all items are checked, your app is live in production!

## Common Issues & Solutions

### Issue: "CLERK_JWT_ISSUER_DOMAIN is not set" in Convex
**Solution:** Set this in Convex Dashboard → Settings → Environment Variables (for production deployment), not just Vercel

### Issue: Convex deploy fails
**Solution:** Make sure you're authenticated: `npx convex login` first

### Issue: Inngest functions not showing
**Solution:** 
1. Verify Vercel deployment is live
2. Visit `https://[your-app].vercel.app/api/inngest` in browser (should show function list)
3. Re-sync Inngest app connection

### Issue: "ENCRYPTION_KEY is required"
**Solution:** Verify the 64-character hex string is set correctly in Vercel (no extra spaces/quotes)

### Issue: Data not appearing in Convex
**Solution:**
- Verify you're looking at the correct Convex deployment (production vs dev)
- Check `NEXT_PUBLIC_CONVEX_URL` in Vercel points to production
- Verify schema is deployed: `npx convex deploy`
