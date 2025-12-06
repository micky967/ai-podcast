# Quick Start: Deploy to Vercel in 10 Steps

This is a condensed version of the full deployment guide. Follow these steps in order.

## 🚀 Quick Deployment Steps

### Step 1: Connect Repository to Vercel
1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **"Add New Project"**
3. Import your GitHub repo: `micky967/ai-podcast`
4. Select branch: `Working-App`
5. **Don't deploy yet** - we need to set up services first

---

### Step 2: Set Up Clerk (5 minutes)
1. Go to [dashboard.clerk.com](https://dashboard.clerk.com)
2. Get your keys:
   - **API Keys** → Copy `Publishable Key` and `Secret Key`
3. Create JWT Template:
   - **JWT Templates** → **Create Template** → Name: `convex`
   - Add claim: `{"sub": "{{user.id}}"}`
   - Copy the **Issuer URL** (looks like: `https://your-app.clerk.accounts.dev`)
4. Set up billing plans:
   - **Subscriptions** → **Products** → Create Free, Pro, Ultra plans
   - Add features: `summary`, `social_posts`, `titles`, `hashtags`, `engagement`, etc.

**Keys to save:**
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (starts with `pk_live_`)
- `CLERK_SECRET_KEY` (starts with `sk_live_`)
- `CLERK_JWT_ISSUER_DOMAIN` (the Issuer URL)

---

### Step 3: Set Up Convex (3 minutes)
1. Go to [dashboard.convex.dev](https://dashboard.convex.dev)
2. Create a new project (or use existing)
3. Get your Production URL:
   - **Settings** → **General** → Copy Production URL (looks like: `https://xxx.convex.cloud`)
4. Add environment variable in Convex:
   - **Settings** → **Environment Variables**
   - Add: `CLERK_JWT_ISSUER_DOMAIN` = (your Clerk Issuer URL from Step 2)
5. Deploy schema:
   ```bash
   cd /path/to/ai-podcast
   convex deploy --prod
   ```

**Keys to save:**
- `NEXT_PUBLIC_CONVEX_URL` (the Production URL)

---

### Step 4: Set Up Inngest (2 minutes)
1. Go to [app.inngest.com](https://app.inngest.com)
2. Sign in or create account
3. Get your keys:
   - **Settings** → **Keys** → Copy `Event Key` and `Signing Key`
4. Note: Inngest will auto-discover your functions at `/api/inngest` after deployment

**Keys to save:**
- `INNGEST_EVENT_KEY`
- `INNGEST_SIGNING_KEY`

---

### Step 5: Set Up OpenAI (2 minutes)
1. Go to [platform.openai.com](https://platform.openai.com)
2. **API Keys** → **Create new secret key**
3. Copy the key immediately (you won't see it again!)

**Keys to save:**
- `OPENAI_API_KEY` (starts with `sk-`)

---

### Step 6: Set Up AssemblyAI (2 minutes)
1. Go to [app.assemblyai.com](https://app.assemblyai.com)
2. **API Keys** → Copy your API key

**Keys to save:**
- `ASSEMBLYAI_API_KEY`

---

### Step 7: Enable Vercel Blob Storage (1 minute)
1. In Vercel Dashboard → Your Project → **Storage** tab
2. Click **"Create Database"** → Select **"Blob"**
3. Choose region and name it
4. Done! Token is auto-configured

---

### Step 8: Add All Environment Variables to Vercel (5 minutes)
1. In Vercel Dashboard → Your Project → **Settings** → **Environment Variables**
2. Add each variable (click "Add" for each):

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = pk_live_...
CLERK_SECRET_KEY = sk_live_...
CLERK_JWT_ISSUER_DOMAIN = https://your-app.clerk.accounts.dev
NEXT_PUBLIC_CONVEX_URL = https://xxx.convex.cloud
INNGEST_EVENT_KEY = ...
INNGEST_SIGNING_KEY = ...
OPENAI_API_KEY = sk-...
ASSEMBLYAI_API_KEY = ...
```

3. For each variable, select:
   - ✅ Production
   - ✅ Preview  
   - ✅ Development
4. Click **"Save"** after each variable

---

### Step 9: Deploy to Vercel (2 minutes)
1. In Vercel Dashboard → **Deployments** tab
2. Click **"Redeploy"** on latest deployment
3. Or push a commit to trigger auto-deployment:
   ```bash
   git push origin Working-App
   ```
4. Watch the build logs
5. Wait for deployment to complete ✅

---

### Step 10: Verify Everything Works (5 minutes)

#### Test Authentication:
- [ ] Visit your Vercel URL
- [ ] Sign up/Log in works
- [ ] User profile loads

#### Test File Upload:
- [ ] Upload a small audio file
- [ ] Upload completes successfully

#### Test Processing:
- [ ] Check Inngest Dashboard → **Runs** (should see function execution)
- [ ] Wait for transcription to complete
- [ ] AI-generated content appears in your app

#### Check Services:
- [ ] Clerk Dashboard → Users (see your test user)
- [ ] Convex Dashboard → Data (see project data)
- [ ] Inngest Dashboard → Functions (see your functions registered)
- [ ] Vercel Dashboard → Storage → Blob (see uploaded files)

---

## 🎉 Done!

Your app is now live in production! 

### Next Steps:
- [ ] Add custom domain (optional)
- [ ] Set up monitoring and error tracking
- [ ] Configure usage limits in API dashboards
- [ ] Test subscription flows

### Troubleshooting:
If something doesn't work:
1. Check Vercel build logs
2. Verify all environment variables are set
3. Check each service dashboard for errors
4. See full guide: `DEPLOYMENT_GUIDE.md`

---

## 📋 Quick Checklist

Before deploying, make sure you have:
- [ ] Clerk production keys
- [ ] Convex production URL
- [ ] Inngest keys
- [ ] OpenAI API key
- [ ] AssemblyAI API key
- [ ] Vercel Blob storage enabled
- [ ] All environment variables added to Vercel
- [ ] Convex schema deployed
- [ ] Clerk JWT template created

---

**Estimated Total Time: ~25 minutes**

Good luck! 🚀

