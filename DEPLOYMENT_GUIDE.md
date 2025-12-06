# Production Deployment Guide to Vercel

This guide will walk you through deploying your AI Podcast SaaS application to Vercel with all services configured.

## Table of Contents
1. [Vercel Deployment Setup](#1-vercel-deployment-setup)
2. [Clerk Configuration](#2-clerk-configuration)
3. [Convex Configuration](#3-convex-configuration)
4. [Inngest Configuration](#4-inngest-configuration)
5. [OpenAI Configuration](#5-openai-configuration)
6. [AssemblyAI Configuration](#6-assemblyai-configuration)
7. [Vercel Blob Configuration](#7-vercel-blob-configuration)
8. [Final Environment Variables](#8-final-environment-variables)
   - [Generate Encryption Key](#step-80-generate-encryption-key-for-api-key-security)
   - [Add to Vercel](#step-81-add-environment-variables-in-vercel)
   - [Add to Inngest](#step-82-add-encryption-key-to-inngest-required-for-production)
   - [Production Encryption Key Setup](#production-encryption-key-setup---complete-checklist)
9. [Deployment Verification](#9-deployment-verification)

---

## 1. Vercel Deployment Setup

### Step 1.1: Connect GitHub Repository to Vercel

1. **Go to Vercel Dashboard**
   - Visit [vercel.com](https://vercel.com)
   - Sign in with your GitHub account

2. **Import Your Project**
   - Click **"Add New..."** → **"Project"**
   - Select your GitHub repository: `micky967/ai-podcast`
   - Choose the branch: **`Working-App`** (or your main branch)

3. **Configure Project Settings**
   - **Framework Preset**: Next.js (should auto-detect)
   - **Root Directory**: `./` (leave as default)
   - **Build Command**: `pnpm run build` (or `npm run build`)
   - **Output Directory**: `.next` (auto-detected)
   - **Install Command**: `pnpm install` (or `npm install`)

4. **Don't Deploy Yet!**
   - We need to set up environment variables first
   - Click **"Cancel"** or leave the environment variables empty for now

---

## 2. Clerk Configuration

### Step 2.1: Set Up Clerk Production Instance

1. **Go to Clerk Dashboard**
   - Visit [dashboard.clerk.com](https://dashboard.clerk.com)
   - Sign in to your account

2. **Create or Select Application**
   - If you don't have one, click **"Create Application"**
   - Choose your application name (e.g., "AI Podcast SaaS")

3. **Configure Authentication Methods**
   - Go to **User & Authentication** → **Email, Phone, Username**
   - Enable the authentication methods you want (Email, Google OAuth, etc.)

4. **Set Up Billing/Subscriptions**
   - Go to **Subscriptions** → **Products**
   - Create your plans: **Free**, **Pro**, **Ultra**
   - Set up features for each plan:
     - Free: `summary`
     - Pro: `summary`, `social_posts`, `titles`, `hashtags`
     - Ultra: `summary`, `social_posts`, `titles`, `hashtags`, `engagement`, `youtube_timestamps`, `key_moments`, `speaker_diarization`

5. **Get Clerk API Keys**
   - Go to **API Keys** in Clerk Dashboard
   - Copy the following keys (you'll need these for Vercel):
     - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
     - `CLERK_SECRET_KEY`

6. **Configure JWT Template for Convex**
   - Go to **JWT Templates** → **Create Template**
   - Name it: **"convex"**
   - Token lifetime: 3600 seconds (1 hour)
   - Add these claims:
     ```json
     {
       "sub": "{{user.id}}"
     }
     ```
   - Save the template
   - Copy the **Issuer URL** (looks like: `https://your-app.clerk.accounts.dev`)
   - This will be your `CLERK_JWT_ISSUER_DOMAIN`

7. **Add Production URLs**
   - Go to **Domains**
   - Add your Vercel domain (e.g., `your-app.vercel.app`)
   - Or add your custom domain if you have one

---

## 3. Convex Configuration

### Step 3.1: Set Up Convex Production Deployment

1. **Install Convex CLI (if not already installed)**
   ```bash
   npm install -g convex
   ```

2. **Create Production Convex Project**
   ```bash
   cd /path/to/ai-podcast
   convex dev --configure prod
   ```
   - Or manually create a project at [dashboard.convex.dev](https://dashboard.convex.dev)

3. **Push Schema to Production**
   ```bash
   convex deploy --prod
   ```
   - This will deploy your schema and functions to production

4. **Get Production Convex URL**
   - Go to [dashboard.convex.dev](https://dashboard.convex.dev)
   - Select your production project
   - Go to **Settings** → **General**
   - Copy the **Production URL** (looks like: `https://your-project.convex.cloud`)
   - This will be your `NEXT_PUBLIC_CONVEX_URL`

5. **Configure Clerk Authentication in Convex**
   - In Convex Dashboard → **Settings** → **Environment Variables**
   - Add: `CLERK_JWT_ISSUER_DOMAIN` = your Clerk Issuer URL from Step 2.1.6
   - Save the environment variable

6. **Get Convex Deployment Key (if needed)**
   - If you need to deploy from CI/CD
   - Go to **Settings** → **Deploy Keys**
   - Copy the deployment key

---

## 4. Inngest Configuration

### Step 4.1: Set Up Inngest Production

1. **Go to Inngest Dashboard**
   - Visit [app.inngest.com](https://app.inngest.com)
   - Sign in or create an account

2. **Create Production Environment**
   - Click **"Environments"** → **"Create Environment"**
   - Name: **"Production"**
   - Region: Choose closest to your users (e.g., US East)

3. **Get Inngest Keys**
   - Go to **Settings** → **Keys**
   - Copy the following:
     - `INNGEST_EVENT_KEY` (for sending events from your app)
     - `INNGEST_SIGNING_KEY` (for webhook authentication)
     - Your Inngest App ID (already in code: `ai-podcast-saas-inngest-coderabbit-clerk`)

4. **Configure Inngest Webhook URL**
   - Your Inngest endpoint is: `/api/inngest`
   - Full URL will be: `https://your-app.vercel.app/api/inngest`
   - Inngest will automatically discover your functions on first deployment

---

## 5. OpenAI Configuration

### Step 5.1: Get OpenAI API Key

1. **Go to OpenAI Platform**
   - Visit [platform.openai.com](https://platform.openai.com)
   - Sign in or create an account

2. **Create API Key**
   - Go to **API Keys** → **"Create new secret key"**
   - Name it: "AI Podcast Production"
   - Copy the key immediately (you won't see it again!)
   - This will be your `OPENAI_API_KEY`

3. **Set Usage Limits (Recommended)**
   - Go to **Usage** → **Billing** → **Limits**
   - Set hard and soft limits to control costs

---

## 6. AssemblyAI Configuration

### Step 6.1: Get AssemblyAI API Key

1. **Go to AssemblyAI Dashboard**
   - Visit [app.assemblyai.com](https://app.assemblyai.com)
   - Sign in or create an account

2. **Get API Key**
   - Go to **API Keys** in your dashboard
   - Copy your API key
   - This will be your `ASSEMBLYAI_API_KEY`

3. **Upgrade Plan (if needed)**
   - Free tier has limitations
   - Upgrade to paid plan for production use

---

## 7. Vercel Blob Configuration

### Step 7.1: Enable Vercel Blob Storage

1. **In Vercel Dashboard**
   - Go to your project → **Storage** tab
   - Click **"Create Database"** → Select **"Blob"**
   - Choose a region close to your users
   - Name your blob store (e.g., "podcast-audio")

2. **Vercel Blob is Automatically Configured**
   - Vercel automatically injects `BLOB_READ_WRITE_TOKEN` environment variable
   - Your code already uses `@vercel/blob/client` which handles this automatically

---

## 8. Final Environment Variables

Now that you have all your keys, add them to Vercel:

### Step 8.0: Generate Encryption Key (For API Key Security)

**IMPORTANT:** This key is required to encrypt user API keys before storing them in the database.

1. **Generate Encryption Key**
   
   **On Linux/Mac:**
   ```bash
   openssl rand -hex 32
   ```
   
   **On Windows (PowerShell):**
   ```powershell
   [System.Convert]::ToHexString((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
   ```
   
   **Or using Node.js (any platform):**
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. **Save the Output**
   - This will generate a 64-character hex string like: `a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456`
   - **Keep this secure** - you'll need it for both Vercel and Inngest
   - **Backup this key** - if you lose it, you cannot decrypt existing encrypted keys
   - **Production Use Only**: Generate a NEW unique key for production (don't use your development key)

3. **For Production Deployment:**
   - Generate a **separate** encryption key for production (different from local development)
   - Store it securely (password manager, secure notes, etc.)
   - You'll add this to:
     - Vercel environment variables (Step 8.1)
     - Inngest environment variables (Step 8.2)
   - **Important:** The same key must be used in both Vercel and Inngest for decryption to work

### Step 8.1: Add Environment Variables in Vercel

1. **Go to Vercel Project Settings**
   - Your Project → **Settings** → **Environment Variables**

2. **Add Each Variable** (click "Add" for each):

#### Clerk Variables:
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = pk_live_... (from Step 2.1.5)
CLERK_SECRET_KEY = sk_live_... (from Step 2.1.5)
CLERK_JWT_ISSUER_DOMAIN = https://your-app.clerk.accounts.dev (from Step 2.1.6)
```

#### Convex Variables:
```
NEXT_PUBLIC_CONVEX_URL = https://your-project.convex.cloud (from Step 3.1.4)
```

#### Inngest Variables:
```
INNGEST_EVENT_KEY = ... (from Step 4.1.3)
INNGEST_SIGNING_KEY = ... (from Step 4.1.3)
```

#### OpenAI Variable:
```
OPENAI_API_KEY = sk-... (from Step 5.1.2)
```

#### AssemblyAI Variable:
```
ASSEMBLYAI_API_KEY = ... (from Step 6.1.2)
```

#### Encryption Key (Required for API Key Security):
```
ENCRYPTION_KEY = a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456 (from Step 8.0)
```

⚠️ **CRITICAL PRODUCTION STEPS:**
1. Generate a **NEW unique key** for production (don't reuse development key)
2. Add this key to **Production**, **Preview**, and **Development** environments in Vercel
3. **MUST also add the EXACT SAME key** to Inngest (see Step 8.2)
4. If keys don't match between Vercel and Inngest, user API key decryption will fail
5. Store the key securely - losing it means you cannot decrypt existing encrypted keys

#### Optional: Vercel Blob (Auto-configured, but you can verify):
```
BLOB_READ_WRITE_TOKEN = (automatically set by Vercel)
```

3. **Set Environment for Each Variable**
   - Select **Production**, **Preview**, and **Development** for each variable
   - Click **"Save"**

### Step 8.2: Add Encryption Key to Inngest (REQUIRED for Production)

The encryption key is also needed in Inngest for server-side decryption of user API keys. **This is critical for production.**

1. **Go to Inngest Dashboard**
   - Visit [app.inngest.com](https://app.inngest.com)
   - Navigate to your app → **Settings** → **Environment Variables**

2. **Add Encryption Key**
   - Variable name: `ENCRYPTION_KEY`
   - Variable value: `(the EXACT SAME value you used in Vercel - from Step 8.0)`
   - **CRITICAL:** The key must be **identical** to the one in Vercel (copy-paste it exactly)
   - If the keys don't match, user API keys cannot be decrypted and processing will fail

3. **Verify Key Match**
   - Double-check the key value matches exactly between Vercel and Inngest
   - Even one character difference will cause decryption failures
   - No spaces or extra characters should be included

4. **Save and Apply**
   - Click **"Save"** or **"Add Variable"**
   - The key will be available to all Inngest functions
   - Changes take effect immediately for new function executions

**Production Checklist for Encryption Key:**
- [ ] Generated unique encryption key (Step 8.0)
- [ ] Added `ENCRYPTION_KEY` to Vercel environment variables
- [ ] Added `ENCRYPTION_KEY` to Inngest environment variables
- [ ] Verified keys match exactly (copy-pasted, no typos)
- [ ] Key is stored securely (password manager, secure notes)

### Step 8.3: Deploy to Vercel

1. **Trigger Deployment**
   - Go to **Deployments** tab
   - Click **"Redeploy"** on the latest deployment
   - Or push a new commit to trigger automatic deployment

2. **Monitor Build**
   - Watch the build logs
   - Ensure build completes successfully

3. **Verify Encryption Key is Active**
   - After deployment, test by going to Settings page
   - Try saving an API key - it should save without encryption errors
   - Check server logs for any decryption errors

---

## 📋 Production Encryption Key Setup - Complete Checklist

### ⚠️ CRITICAL: This Must Be Done for Production

The encryption key setup is **required** for the BYOK (Bring Your Own Key) feature to work. User API keys are encrypted before storing in the database for security.

### What You Need to Do:

#### Step 1: Generate Production Encryption Key
```bash
# Generate a unique 256-bit encryption key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Output:** A 64-character hex string (e.g., `a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456`)

**Important:**
- Generate a **NEW unique key** for production (don't reuse development key)
- **Save this key securely** - you'll need it in two places
- If you lose it, you cannot decrypt existing encrypted keys

#### Step 2: Add to Vercel Production Environment

1. Go to **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**
2. Click **"Add"** to add a new variable
3. Variable name: `ENCRYPTION_KEY`
4. Variable value: `(paste your generated key from Step 1)`
5. Select environments: ✅ **Production**, ✅ **Preview**, ✅ **Development**
6. Click **"Save"**

#### Step 3: Add to Inngest Production Environment

1. Go to **Inngest Dashboard** → Your App → **Settings** → **Environment Variables**
2. Click **"Add Variable"** or **"New Environment Variable"**
3. Variable name: `ENCRYPTION_KEY`
4. Variable value: `(paste the EXACT SAME key from Step 1 - must match Vercel exactly)`
5. **CRITICAL:** Copy-paste the exact same value - no typos, no spaces
6. Click **"Save"**

#### Step 4: Verify Keys Match

- Double-check both keys are identical (copy from Vercel, paste to Inngest)
- Even one character difference will cause decryption failures
- Test by saving an API key in Settings after deployment

### Why Both Places?

- **Vercel**: Encrypts user API keys when users save them in Settings
- **Inngest**: Decrypts user API keys when processing podcasts
- **Must Match**: If keys differ, encryption/decryption fails and processing breaks

### Production Deployment Checklist:

- [ ] Generated unique encryption key for production
- [ ] Added `ENCRYPTION_KEY` to Vercel (Production, Preview, Development)
- [ ] Added `ENCRYPTION_KEY` to Inngest (Production environment)
- [ ] Verified keys match exactly between Vercel and Inngest
- [ ] Key is stored securely (password manager, secure notes)
- [ ] Deployed application after adding keys
- [ ] Tested by saving an API key in Settings (should work without errors)

### Troubleshooting Production Encryption Issues:

**Error: "ENCRYPTION_KEY environment variable is required"**
- Solution: Key is missing - add it to Vercel and/or Inngest environment variables

**Error: "Failed to decrypt data"**
- Solution: Keys don't match - verify the exact same key is in both Vercel and Inngest

**User API keys not working after deployment**
- Solution: Encryption key may have changed - users need to re-enter their keys in Settings

---

## 9. Deployment Verification

### Step 9.1: Verify Each Service

1. **Test Authentication (Clerk)**
   - Visit your Vercel URL
   - Try signing up/logging in
   - Verify user profile loads

2. **Test Database (Convex)**
   - Log in to your app
   - Try creating a project
   - Check Convex Dashboard → **Data** to see if data appears

3. **Test File Upload (Vercel Blob)**
   - Upload a test audio file
   - Verify it uploads successfully
   - Check Vercel Dashboard → **Storage** → **Blob** to see files

4. **Test Processing Pipeline (Inngest)**
   - Upload a small audio file
   - Check Inngest Dashboard → **Runs** to see function executions
   - Verify transcription starts

5. **Test AI Generation**
   - Wait for transcription to complete
   - Verify AI-generated content appears
   - Check OpenAI and AssemblyAI dashboards for API usage

### Step 9.2: Production Checklist

- [ ] All environment variables are set in Vercel
- [ ] Encryption key (`ENCRYPTION_KEY`) is set in Vercel (Step 8.0)
- [ ] Encryption key (`ENCRYPTION_KEY`) is set in Inngest (Step 8.2)
- [ ] Clerk authentication works
- [ ] Convex database is connected
- [ ] File uploads work (Vercel Blob)
- [ ] Inngest functions are discoverable
- [ ] User API keys can be saved in Settings (encrypted)
- [ ] Transcription completes successfully
- [ ] AI content generation works (using user API keys)
- [ ] Subscription plans are configured in Clerk
- [ ] Plan limits are enforced correctly

---

## Troubleshooting

### Build Fails
- Check build logs in Vercel
- Verify all environment variables are set
- Ensure package.json scripts are correct

### Authentication Not Working
- Verify Clerk keys are correct (production keys start with `pk_live_` and `sk_live_`)
- Check Clerk Dashboard → **Domains** includes your Vercel domain
- Verify `CLERK_JWT_ISSUER_DOMAIN` matches your JWT template

### Convex Connection Issues
- Verify `NEXT_PUBLIC_CONVEX_URL` is correct
- Check Convex Dashboard → **Environment Variables** has `CLERK_JWT_ISSUER_DOMAIN`
- Ensure Convex schema is deployed

### Inngest Functions Not Running
- Check Inngest Dashboard → **Functions** shows your functions
- Verify `/api/inngest` route is accessible
- Check Inngest logs for errors

### API Errors
- Verify API keys are correct and have sufficient credits
- Check service dashboards for rate limits
- Review error logs in Vercel → **Functions** tab

### Encryption/Decryption Errors
- Verify `ENCRYPTION_KEY` is set in both Vercel and Inngest
- Ensure the same encryption key is used in both places (must match exactly)
- Check that the key is exactly 64 hex characters (32 bytes)
- If users get "Failed to decrypt" errors, verify the encryption key hasn't changed
- If you changed the encryption key, users will need to re-enter their API keys in Settings
- Test by saving a test API key in Settings - it should save without errors

---

## Next Steps

1. **Set Up Custom Domain** (Optional)
   - Add custom domain in Vercel
   - Update DNS records
   - Update Clerk domains

2. **Enable Monitoring**
   - Set up error tracking (Sentry, etc.)
   - Configure Vercel Analytics
   - Set up uptime monitoring

3. **Configure CI/CD**
   - Set up GitHub Actions (optional)
   - Configure automatic deployments
   - Set up staging environment

4. **Optimize Performance**
   - Enable Vercel Edge Functions if needed
   - Set up CDN caching
   - Monitor API usage and costs

---

## Support Resources

- **Vercel Docs**: https://vercel.com/docs
- **Clerk Docs**: https://clerk.com/docs
- **Convex Docs**: https://docs.convex.dev
- **Inngest Docs**: https://www.inngest.com/docs
- **OpenAI Docs**: https://platform.openai.com/docs
- **AssemblyAI Docs**: https://www.assemblyai.com/docs

---

Good luck with your deployment! 🚀

