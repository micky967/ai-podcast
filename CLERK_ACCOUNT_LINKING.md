# Clerk Account Linking Guide

## Issue: Different User IDs for Different OAuth Providers

When you log in with different OAuth providers (e.g., Facebook vs Google), Clerk creates **different user IDs** for each provider, even if it's the same person. This means:

- Facebook login → `user_facebook_123`
- Google login → `user_google_456`

**These are treated as separate users** in the system, which can cause issues with:
- Group ownership
- File sharing
- User settings
- Admin roles

## Solution: Link Accounts in Clerk

Clerk can automatically link accounts that use the same email address. Here's how to ensure this works:

### 1. Check Clerk Dashboard Settings

1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Select your application
3. Go to **User & Authentication** → **Email, Phone, Username**
4. Ensure **"Link accounts with same email"** is enabled

### 2. Manual Account Linking (if needed)

If accounts aren't auto-linking:

1. Go to **Users** in Clerk Dashboard
2. Find the user account (search by email)
3. Click on the user
4. Go to **Linked Accounts** tab
5. Click **"Link Account"**
6. Select the other OAuth provider account
7. Confirm the link

### 3. Verify Account Linking

After linking:
- Both OAuth providers should show under the same user
- The user will have a **primary user ID** that remains consistent
- Logging in with either provider will use the same user ID

## Testing

After linking accounts:
1. Log in with Facebook → Note the user ID
2. Log out
3. Log in with Google → Should have the **same user ID**
4. Groups created with one provider should be accessible with the other

## Important Notes

- **Always use the same login method** for testing, OR ensure accounts are linked
- If accounts aren't linked, groups/files created with one provider won't be accessible with the other
- The system uses Clerk's user ID for all ownership checks - this must be consistent

## Troubleshooting

If you're still seeing different user IDs:
1. Check Clerk Dashboard → Users → Find both accounts
2. Verify they have the same email address
3. Check if "Link accounts with same email" is enabled
4. Manually link accounts if needed
5. Clear browser cookies and try again










