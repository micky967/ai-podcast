# Production Deployment Guide

This guide will help you migrate your existing development setup to production on Vercel.

## Prerequisites

You already have these set up (development):
- ✅ Clerk account and application
- ✅ Convex project (development)
- ✅ GitHub repository
- ✅ Local development environment working

---

## Step 1: Prepare Your Existing Services

### 1.1 Verify Clerk Configuration

1. Go to [Clerk Dashboard](https://dashboard.clerk.com/)
2. Find your existing application
3. Verify you have a JWT template named `convex`:
   - Go to **JWT Templates**
   - If you don't have one, create it:
     - Name: `convex` (exact match)
     - Token Lifetime: 86400 seconds (24 hours)
     - Claims:
       ```json
       {
         "sub": "{{user.id}}"
       }
       ```
4. Copy these values (you'll need them for Vercel):
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (from API Keys section)
   - `CLERK_SECRET_KEY` (from API Keys section)
   - `CLERK_JWT_ISSUER_DOMAIN` (from JWT template, format: `your-app.clerk.accounts.dev` - **without** `https://`)

---

## Step 2: Migrate Convex to Production

### 2.1 Create Production Deployment in Convex

You have two options:

#### Option A: Use Existing Dev Project as Production (Recommended for Start)

If you want to use your current dev database as production:

1. In [Convex Dashboard](https://dashboard.convex.dev/), select your current project
2. Note your **Deployment URL** (format: `https://[project-name].convex.cloud`)
3. This is your production database URL

**Note:** This means dev and production share the same database. Good for initial launch, but consider separate deployments later.

#### Option B: Create Separate Production Deployment (Recommended for Scale)

For a separate production database:

1. In [Convex Dashboard](https://dashboard.convex.dev/), click **New Project** or **Add Deployment**
2. Create a new deployment (name it something like `ai-podcast-prod`)
3. Copy the new **Deployment URL**

### 2.2 Deploy Schema to Production

From your local machine, deploy your schema to production:

**Important:** `convex deploy` deploys to production by default. There is no `--prod` flag.

**Note:** `npx` works with pnpm (you don't need to use `pnpm exec` - `npx` is universal)

```bash
# Deploy to production (default behavior)
npx convex deploy
```

This will:
- Deploy all your schema changes (`convex/schema.ts`)
- Deploy all your functions (`convex/*.ts`)
- Update your production deployment

**If you have multiple deployments configured:**

To deploy to a specific deployment, you need to set the deployment URL in your environment:

1. Check your current deployment URL:
   - Look in `.env.local` or `.env` for `CONVEX_DEPLOYMENT` or `NEXT_PUBLIC_CONVEX_URL`
   - Or check Convex Dashboard → Settings for your deployment URL

2. Ensure your `.env.local` has the correct production deployment:
   ```bash
   NEXT_PUBLIC_CONVEX_URL=https://your-production-deployment.convex.cloud
   ```

3. Then deploy:
   ```bash
   npx convex deploy
   ```

**Alternative (if you prefer pnpm-specific syntax):**
```bash
pnpm exec convex deploy
```

This will:
- Deploy all your schema changes (`convex/schema.ts`)
- Deploy all your functions (`convex/*.ts`)
- Set up authentication configuration
- Migrate all your code to production

### 2.3 Configure Environment Variable in Convex Production

1. In [Convex Dashboard](https://dashboard.convex.dev/), go to your production deployment
2. Go to **Settings** → **Environment Variables**
3. Add: `CLERK_JWT_ISSUER_DOMAIN` = your Clerk JWT issuer domain (same value from Step 1.1, without `https://`)

**Important:** This must match the value you'll set in Vercel.

### 2.4 Export/Import Data (Optional - Only if creating new production deployment)

If you created a new production deployment and want to migrate existing data:

**Export from Dev:**
```bash
# Export all data from dev database
npx convex export --output backup.json
```

**Import to Production:**
```bash
# Import to production database
npx convex import --input backup.json --prod
```

**Note:** Convex doesn't have a built-in export/import CLI, so you might need to:
1. Use Convex Dashboard → Data to manually export
2. Write a migration script using Convex mutations
3. Or start fresh in production (if you're okay losing dev data)

---

## Step 3: Generate Encryption Key

Generate a secure encryption key for API key encryption:

```bash
# Generate a 32-byte (256-bit) hex key
openssl rand -hex 32
```

This will output a 64-character hex string. **Save this securely** - you'll need it for Vercel environment variables, and you'll need it if you ever need to decrypt existing encrypted keys.

**Required Environment Variable:**
- `ENCRYPTION_KEY` - 64-character hex string

---

## Step 4: Set Up Inngest (If Not Already Done)

### 4.1 Create Inngest Account (If New)

1. Go to [Inngest Dashboard](https://app.inngest.com/)
2. Sign up for free account
3. Create a new app

### 4.2 Note Your Inngest Details

Your Inngest endpoint will be: `https://[your-vercel-app].vercel.app/api/inngest`

No environment variables needed for basic Inngest - it connects automatically after Vercel deployment.

---

## Step 5: Deploy to Vercel

### 5.1 Connect GitHub Repository

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **Add New Project**
3. Import your GitHub repository (`ai-podcast`)
4. Select your repository

### 5.2 Configure Build Settings

Vercel should auto-detect Next.js. Verify:
- **Framework Preset:** Next.js
- **Root Directory:** `./` (root)
- **Build Command:** `pnpm build` (or leave default)
- **Output Directory:** `.next` (default)

### 5.3 Add Environment Variables

**Important:** Add these BEFORE deploying. Go to **Settings** → **Environment Variables**:

#### Required Variables:

```bash
# Clerk Authentication (from Step 1.1)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_... or pk_live_...
CLERK_SECRET_KEY=sk_test_... or sk_live_...
CLERK_JWT_ISSUER_DOMAIN=your-app.clerk.accounts.dev

# Convex Database (from Step 2.1)
NEXT_PUBLIC_CONVEX_URL=https://your-project.convex.cloud

# Encryption (from Step 3)
ENCRYPTION_KEY=your-64-character-hex-string-here
```

#### Optional Variables (Fallback API Keys - Only if you want shared keys):

```bash
# Optional: OpenAI fallback key
OPENAI_API_KEY=sk-...

# Optional: AssemblyAI fallback key
ASSEMBLYAI_API_KEY=...
```

**Note:** Your app uses BYOK (Bring Your Own Key) - users provide their own API keys. The optional keys are only fallbacks.

### 5.4 Deploy

1. Click **Deploy**
2. Wait for build to complete
3. Your app will be live at `https://[your-project].vercel.app`

---

## Step 6: Connect Inngest to Production

### 6.1 Sync Inngest with Vercel Deployment

1. Go to [Inngest Dashboard](https://app.inngest.com/)
2. Go to **Apps** → **Add App** (or edit existing)
3. Enter your Vercel deployment URL: `https://[your-vercel-app].vercel.app/api/inngest`
4. Click **Sync**

### 6.2 Verify Functions Are Registered

In the Inngest Dashboard, you should see:
- ✅ `podcastProcessor` function
- ✅ `retryJobFunction` function

If they don't appear, check:
- Vercel deployment is live
- `/api/inngest` endpoint is accessible (visit it in browser - should show function list)
- No build errors in Vercel logs

---

## Step 7: Verify Production Deployment

### 7.1 Test Authentication

1. Visit your deployed app: `https://[your-vercel-app].vercel.app`
2. Try signing up/logging in
3. Verify user is created in Convex production database

### 7.2 Test File Upload

1. Log in to your production app
2. Go to Settings, add your API keys (OpenAI and AssemblyAI)
3. Upload a test audio file
4. Verify it processes through Inngest
5. Check Convex dashboard to see data being created

### 7.3 Verify Inngest Execution

1. Go to Inngest Dashboard → **Executions**
2. You should see processing events
3. Verify jobs complete successfully

### 7.4 Verify Data in Convex

1. Go to Convex Dashboard → your production deployment
2. Check **Data** tab
3. Verify projects, users, and other data are being created

---

## Environment Variables Summary

### Required in Vercel:

| Variable | Description | Where to Get |
|----------|-------------|--------------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key | Clerk Dashboard → API Keys |
| `CLERK_SECRET_KEY` | Clerk secret key | Clerk Dashboard → API Keys |
| `CLERK_JWT_ISSUER_DOMAIN` | Clerk JWT issuer domain | Clerk Dashboard → JWT Templates (without https://) |
| `NEXT_PUBLIC_CONVEX_URL` | Convex production URL | Convex Dashboard → Your Deployment |
| `ENCRYPTION_KEY` | 64-char hex string | Generate: `openssl rand -hex 32` |

### Also Required in Convex Dashboard (Production Deployment):

| Variable | Description |
|----------|-------------|
| `CLERK_JWT_ISSUER_DOMAIN` | Same value as Vercel (without https://) |

### Optional in Vercel (Fallback API Keys):

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | OpenAI API key (fallback only) |
| `ASSEMBLYAI_API_KEY` | AssemblyAI API key (fallback only) |

### Auto-Configured by Vercel:

| Variable | Description |
|----------|-------------|
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob storage token (automatic) |

---

## Troubleshooting

### "ENCRYPTION_KEY is required" Error

- Verify you generated a 64-character hex string: `openssl rand -hex 32`
- Check it's set correctly in Vercel (no extra spaces or quotes)
- Ensure it's the same key if you're migrating existing encrypted data

### "CLERK_JWT_ISSUER_DOMAIN is not set" Error in Convex

- Set this in **Convex Dashboard** → **Settings** → **Environment Variables** (for your production deployment)
- Use only the domain part (e.g., `your-app.clerk.accounts.dev`), not the full URL
- Must match the value in Vercel exactly

### Inngest Functions Not Showing Up

- Verify Vercel deployment is live and accessible
- Check `/api/inngest` endpoint (visit in browser - should show function list)
- Re-sync Inngest app connection in Inngest Dashboard
- Check Vercel function logs for errors

### File Uploads Failing

- Verify users have added their API keys in Settings
- Check Vercel Blob is enabled (automatic with Vercel)
- Verify Inngest functions are registered and running
- Check Inngest execution logs for errors

### Authentication Issues

- Verify all Clerk environment variables are set correctly in Vercel
- Check that JWT template name is exactly `convex` (case-sensitive)
- Ensure `CLERK_JWT_ISSUER_DOMAIN` matches in both Vercel and Convex production
- Verify you're using the correct Clerk keys (test vs live)

### Convex Data Not Appearing

- Verify you're looking at the correct Convex deployment (production vs dev)
- Check that `NEXT_PUBLIC_CONVEX_URL` in Vercel points to the correct deployment
- Verify schema is deployed: `npx convex deploy`
- Check Convex dashboard logs for errors

---

## Production Checklist

Before going live:

- [ ] Clerk application verified and JWT template `convex` exists
- [ ] Convex production deployment created (or using existing)
- [ ] Schema deployed to production: `npx convex deploy --prod`
- [ ] Convex environment variable `CLERK_JWT_ISSUER_DOMAIN` set
- [ ] Encryption key generated and saved securely
- [ ] All required Vercel environment variables set
- [ ] Vercel deployment successful
- [ ] Inngest app connected to Vercel endpoint
- [ ] Test authentication (sign up/login in production)
- [ ] Test file upload with API keys
- [ ] Verify Inngest functions are executing
- [ ] Verify data appears in Convex production database
- [ ] Test end-to-end workflow (upload → process → view results)

---

## Important Notes

### Development vs Production

- **Development:** Uses `convex dev` with local/dev database
- **Production:** Uses `npx convex deploy` (deploys to prod by default) with production database
- You can have both running simultaneously - they use different environment variables

### API Keys Strategy

- Your app uses **BYOK (Bring Your Own Key)** - users provide their own API keys
- Optional environment variables (`OPENAI_API_KEY`, `ASSEMBLYAI_API_KEY`) are only fallbacks
- User keys are encrypted with `ENCRYPTION_KEY` before storing in Convex

### Data Migration

- If you created a new production deployment, you'll start with an empty database
- Existing dev data won't automatically transfer (you'd need to export/import manually)
- Consider if you want to start fresh in production or use dev database as production initially

### Encryption Key Security

- **Never commit `ENCRYPTION_KEY` to git**
- **Never share `ENCRYPTION_KEY` publicly**
- If you change the encryption key, existing encrypted API keys will become unreadable
- Keep a secure backup of your encryption key

---

## Next Steps After Deployment

1. **Monitor Vercel logs** for any errors
2. **Monitor Inngest executions** to ensure jobs complete successfully
3. **Monitor Convex dashboard** for database performance
4. **Set up error tracking** (consider Sentry or similar)
5. **Configure custom domain** in Vercel (if needed)
6. **Set up production monitoring** and alerts

---

## Support

For issues:
1. Check Vercel deployment logs
2. Check Inngest execution logs  
3. Check Convex dashboard for errors
4. Verify all environment variables are set correctly
5. Verify Clerk JWT template configuration
