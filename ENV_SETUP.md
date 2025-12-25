# Environment Variables Quick Reference

Copy this template and fill in your values for Vercel deployment.

## Required Environment Variables

```bash
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_JWT_ISSUER_DOMAIN=your-app.clerk.accounts.dev

# Convex Database
NEXT_PUBLIC_CONVEX_URL=https://your-project.convex.cloud

# Encryption Key (generate with: openssl rand -hex 32)
ENCRYPTION_KEY=your-64-character-hex-string-here
```

## Optional Environment Variables (Fallback API Keys)

```bash
# Optional: OpenAI fallback key
OPENAI_API_KEY=sk-...

# Optional: AssemblyAI fallback key
ASSEMBLYAI_API_KEY=...
```

## Also Set in Convex Dashboard

In Convex Dashboard → Settings → Environment Variables:
- `CLERK_JWT_ISSUER_DOMAIN` = same value as above (without https://)

## Generate Encryption Key

```bash
openssl rand -hex 32
```

This will output a 64-character hex string. Use this for `ENCRYPTION_KEY`.
