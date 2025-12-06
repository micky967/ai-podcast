# Environment Variables Checklist

Quick reference for all environment variables needed in production.

## Required Environment Variables

### Clerk (Authentication)
```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
CLERK_JWT_ISSUER_DOMAIN=https://your-app.clerk.accounts.dev
```

**Where to get:**
- Clerk Dashboard → API Keys
- Clerk Dashboard → JWT Templates → "convex" template → Issuer URL

---

### Convex (Database)
```bash
NEXT_PUBLIC_CONVEX_URL=https://your-project.convex.cloud
```

**Also needed in Convex Dashboard:**
```bash
CLERK_JWT_ISSUER_DOMAIN=https://your-app.clerk.accounts.dev
```

**Where to get:**
- Convex Dashboard → Settings → General → Production URL

---

### Inngest (Background Jobs)
```bash
INNGEST_EVENT_KEY=...
INNGEST_SIGNING_KEY=...
```

**Where to get:**
- Inngest Dashboard → Settings → Keys

**Note:** Inngest will automatically discover your functions at `/api/inngest`

---

### OpenAI (AI Content Generation)
```bash
OPENAI_API_KEY=sk-...
```

**Where to get:**
- OpenAI Platform → API Keys → Create new secret key

---

### AssemblyAI (Transcription)
```bash
ASSEMBLYAI_API_KEY=...
```

**Where to get:**
- AssemblyAI Dashboard → API Keys

---

### Vercel Blob (File Storage)
```bash
BLOB_READ_WRITE_TOKEN=...
```

**Note:** Automatically configured when you enable Blob storage in Vercel Dashboard → Storage

---

### Encryption Key (For API Key Encryption)
```bash
ENCRYPTION_KEY=... (64-character hex string)
```

**Where to get:**
- Generate using: `openssl rand -hex 32`
- This is a 256-bit (32-byte) encryption key used to encrypt user API keys before storing in database
- **KEEP THIS SECRET** - Store it securely and never commit to git

**Security Notes:**
- Used to encrypt user API keys before storing in Convex
- If you lose this key, you cannot decrypt existing encrypted keys
- Rotating this key requires re-encrypting all user keys

---

## Environment Variable Summary Table

| Variable | Service | Required | Auto-Configured |
|----------|---------|----------|-----------------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk | ✅ Yes | ❌ No |
| `CLERK_SECRET_KEY` | Clerk | ✅ Yes | ❌ No |
| `CLERK_JWT_ISSUER_DOMAIN` | Clerk/Convex | ✅ Yes | ❌ No |
| `NEXT_PUBLIC_CONVEX_URL` | Convex | ✅ Yes | ❌ No |
| `INNGEST_EVENT_KEY` | Inngest | ✅ Yes | ❌ No |
| `INNGEST_SIGNING_KEY` | Inngest | ✅ Yes | ❌ No |
| `ENCRYPTION_KEY` | Encryption | ✅ Yes | ❌ No |
| `OPENAI_API_KEY` | OpenAI | ✅ Yes | ❌ No |
| `ASSEMBLYAI_API_KEY` | AssemblyAI | ✅ Yes | ❌ No |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob | ✅ Yes | ✅ Yes* |

*Automatically set when Blob storage is enabled in Vercel

---

## Quick Setup Commands

### For Vercel CLI (Alternative to Dashboard)
```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Link project
vercel link

# Add environment variables
vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY production
vercel env add CLERK_SECRET_KEY production
vercel env add CLERK_JWT_ISSUER_DOMAIN production
vercel env add NEXT_PUBLIC_CONVEX_URL production
vercel env add INNGEST_EVENT_KEY production
vercel env add INNGEST_SIGNING_KEY production
vercel env add OPENAI_API_KEY production
vercel env add ASSEMBLYAI_API_KEY production

# Deploy
vercel --prod
```

---

## Verification Checklist

After setting up environment variables, verify:

- [ ] All variables are set in Vercel Dashboard → Settings → Environment Variables
- [ ] Variables are set for Production, Preview, and Development environments
- [ ] `CLERK_JWT_ISSUER_DOMAIN` is also set in Convex Dashboard → Environment Variables
- [ ] All keys are production keys (Clerk keys start with `pk_live_` and `sk_live_`)
- [ ] Vercel Blob storage is enabled in Vercel Dashboard → Storage
- [ ] Build completes successfully with all variables

---

## Security Notes

⚠️ **Important:**
- Never commit environment variables to Git
- Use production keys only in production environment
- Rotate keys if they're accidentally exposed
- Use different keys for development and production
- Monitor API usage in each service dashboard

