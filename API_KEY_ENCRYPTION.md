# 🔐 API Key Encryption - Complete!

API keys are now **encrypted before storing** in Convex database and **only decrypted server-side** for use.

## 🔒 Security Implementation

### ✅ What's Encrypted

- **OpenAI API Keys** - Encrypted before storage
- **AssemblyAI API Keys** - Encrypted before storage
- Keys are **never exposed in plaintext** to frontend or database

### ✅ Encryption Details

- **Algorithm**: AES-256-GCM (Authenticated Encryption)
- **Key Size**: 256 bits (32 bytes)
- **IV**: Random 16-byte IV for each encryption (ensures uniqueness)
- **Authentication**: GCM mode provides built-in authentication tag

### ✅ Flow

```
User Input → Server Action → Encrypt → Store in Convex (encrypted)
                                                      ↓
Process Podcast → Retrieve from Convex → Decrypt (server-side) → Use for API calls
```

## 🔑 Setup Instructions

### Step 1: Generate Encryption Key

Generate a secure 256-bit encryption key:

```bash
# On Linux/Mac:
openssl rand -hex 32

# On Windows (PowerShell):
[System.Convert]::ToHexString((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

Or use an online generator:
```bash
# Using Node.js:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

This will output a 64-character hex string like:
```
a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456
```

### Step 2: Add to Environment Variables

Add the encryption key to your environment variables:

**Local Development (.env.local):**
```bash
ENCRYPTION_KEY=a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456
```

**Vercel Production:**
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add: `ENCRYPTION_KEY` = `(your 64-character hex string)`
3. Apply to all environments (Production, Preview, Development)

**Inngest (for server-side decryption):**
1. Go to Inngest Dashboard → Your App → Environment Variables
2. Add: `ENCRYPTION_KEY` = `(same value as Vercel)`

### Step 3: Deploy

After setting the environment variable:
1. Redeploy your Vercel application
2. Redeploy your Inngest functions (if separate)
3. Test by adding API keys in Settings

## 🔧 Technical Details

### Files Created/Modified

**New Files:**
- `lib/encryption.ts` - Encryption/decryption utilities
- `inngest/lib/user-api-keys.ts` - Utility to retrieve and decrypt keys

**Modified Files:**
- `app/actions/user-settings.ts` - Encrypts keys before storing
- `convex/userSettings.ts` - Added `getUserSettingsStatus` query for frontend
- `inngest/functions/podcast-processor.ts` - Decrypts keys before use
- `inngest/functions/retry-job.ts` - Decrypts keys before use
- `components/settings/settings-form.tsx` - Uses status query (no key exposure)
- `app/dashboard/settings/page.tsx` - Uses status query

### Encryption Functions

```typescript
// Encrypt before storing
import { encrypt } from "@/lib/encryption";
const encryptedKey = encrypt("sk-your-actual-key");

// Decrypt when retrieving (server-side only)
import { decrypt } from "@/lib/encryption";
const decryptedKey = decrypt(encryptedKey);
```

### Security Guarantees

1. **Database Security**: Even if Convex database is compromised, keys are encrypted
2. **Frontend Security**: Frontend only sees status (keys are set/not set), never actual keys
3. **Server-Side Only**: Decryption only happens in server actions and Inngest functions
4. **Unique IVs**: Each encryption uses a random IV, so same key encrypts differently each time
5. **Authentication**: GCM mode ensures data integrity (detects tampering)

## ⚠️ Important Notes

### Key Management

- **BACKUP YOUR ENCRYPTION KEY**: If you lose it, you cannot decrypt existing keys
- **Store Securely**: Never commit the encryption key to git
- **Rotation**: Changing the encryption key requires re-encrypting all user keys

### Migration

If you have existing unencrypted keys:
1. Set up encryption key (see Step 1-2 above)
2. Users will need to re-enter their keys (they'll be encrypted on save)
3. Or create a migration script to encrypt existing keys

### Error Handling

If decryption fails:
- Check that `ENCRYPTION_KEY` is set correctly
- Verify the key matches what was used for encryption
- Error messages will guide you to the issue

## 🚀 Testing

1. **Set Encryption Key** in environment variables
2. **Add API Keys** in Settings page
3. **Process a Podcast** - should work normally
4. **Check Convex Database** - keys should be encrypted (hex strings)

## ✅ Benefits

- ✅ Keys encrypted at rest in database
- ✅ Frontend never sees actual keys
- ✅ Even if database is hacked, keys are useless without encryption key
- ✅ Server-side decryption only
- ✅ Industry-standard AES-256-GCM encryption

**Your API keys are now securely encrypted!** 🔐









