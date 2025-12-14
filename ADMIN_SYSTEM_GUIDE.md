# 🔐 Admin System Guide

## Overview

The admin system allows you to mark specific users as admins who can delete any file from any user. Regular users can only delete their own files.

## How It Works

- **Users**: Authenticated via Clerk (userId)
- **Roles**: Stored in Convex `userSettings` table
- **Default Role**: All users are "user" by default
- **Admin Privileges**: Admins can delete any project/file

---

## 🎯 Marking a User as Admin

### Method 1: Using Convex Dashboard (Recommended)

1. **Go to Convex Dashboard**
   - Navigate to: https://dashboard.convex.dev
   - Select your project

2. **Open the Functions Tab**
   - Click on "Functions" in the sidebar
   - Find `userSettings:setUserRole`

3. **Run the Mutation**
   - Click on `setUserRole`
   - Click "Run Function"
   - Enter the parameters:
     ```json
     {
       "userId": "user_36Rcp3R12r26z45asYWijtFu4kY",
       "role": "admin"
     }
     ```
   - Replace `userId` with the actual Clerk user ID
   - Click "Run"

4. **Verify**
   - Check the `userSettings` table in the Data tab
   - Find the user's record
   - Verify `role` field is set to `"admin"`

### Method 2: Direct Database Update

1. **Go to Convex Dashboard → Data**
   - Navigate to: https://dashboard.convex.dev
   - Select your project
   - Click "Data" tab

2. **Find the User Settings**
   - Open the `userSettings` table
   - Find the record where `userId` matches the Clerk user ID

3. **Update the Role**
   - Click on the record
   - Edit the `role` field
   - Set it to `"admin"` (or `"user"` to remove admin)
   - Save

### Method 3: Using Convex CLI

```bash
# Run the mutation via CLI
npx convex run userSettings:setUserRole \
  --userId "user_36Rcp3R12r26z45asYWijtFu4kY" \
  --role "admin"
```

---

## 🔍 Finding a User's Clerk ID

### From Your Application

1. **Check Browser Console**
   - User logs in
   - Open DevTools (F12)
   - Check Clerk session - userId is usually visible

2. **Check Convex Database**
   - Go to `projects` table
   - Find a project uploaded by the user
   - The `userId` field contains their Clerk ID

3. **Check Clerk Dashboard**
   - Go to: https://dashboard.clerk.com
   - Select your application
   - Go to "Users"
   - Find the user
   - Copy their User ID

---

## ✅ Verifying Admin Status

### Check in Convex Dashboard

1. Go to **Data** → `userSettings` table
2. Find the user's record
3. Check the `role` field:
   - `"admin"` = Admin user
   - `"user"` or `undefined` = Regular user

### Test Admin Deletion

1. Log in as the admin user
2. Try to delete a file uploaded by a different user
3. If deletion succeeds, admin status is working ✅

---

## 🔒 Security Notes

- **Default Role**: All users default to "user" role
- **Admin Check**: Happens server-side in Convex mutations
- **Cannot Bypass**: Client-side code cannot grant admin access
- **Audit Trail**: Admin deletions are logged with `[CONVEX DELETE]` prefix

---

## 📝 Example: Making User an Admin

**Scenario**: You want to make user `user_36Rcp3R12r26z45asYWijtFu4kY` an admin.

### Step 1: Get User ID
- Found in Clerk Dashboard or Convex `projects` table

### Step 2: Mark as Admin
- Go to Convex Dashboard → Functions
- Run `userSettings:setUserRole`
- Parameters:
  ```json
  {
    "userId": "user_36Rcp3R12r26z45asYWijtFu4kY",
    "role": "admin"
  }
  ```

### Step 3: Verify
- Check `userSettings` table
- Confirm `role: "admin"`

### Step 4: Test
- Admin can now delete any file from any user ✅

---

## 🗑️ Removing Admin Access

To remove admin privileges, set the role back to "user":

```json
{
  "userId": "user_36Rcp3R12r26z45asYWijtFu4kY",
  "role": "user"
}
```

Or delete the `role` field from the `userSettings` record (defaults to "user").

---

## 🚨 Troubleshooting

### Admin Can't Delete Files

1. **Check Role**: Verify `role: "admin"` in `userSettings` table
2. **Check User ID**: Make sure the userId matches exactly
3. **Check Logs**: Look for `[CONVEX DELETE]` logs in terminal
4. **Verify Mutation**: Check if `deleteProject` mutation is being called

### User Settings Don't Exist

If a user doesn't have a `userSettings` record:
- The system will create one when you set their role
- Or they can create one by updating their API keys in Settings

---

## 📋 Summary

- ✅ All users default to "user" role
- ✅ Admins can be marked in Convex Dashboard
- ✅ Admins can delete any file from any user
- ✅ Regular users can only delete their own files
- ✅ Role is stored in `userSettings.role` field

---

## 🔗 Related Files

- `convex/schema.ts` - Schema definition with `role` field
- `convex/userSettings.ts` - `setUserRole` mutation and `isUserAdmin` query
- `convex/projects.ts` - `deleteProject` mutation with admin check






