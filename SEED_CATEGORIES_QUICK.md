# 🚀 Quick Seed Instructions

## ✅ The seed function is now ready in `convex/categories.ts`

Once Convex syncs (which happens automatically), you can use any of these methods:

---

## Option 1: Convex CLI (Fastest)

**Wait 10-30 seconds for Convex to sync, then run:**
```bash
npx convex run categories:seedCategories
```

---

## Option 2: Admin Page

1. Make sure your dev server is running: `pnpm dev`
2. Wait for Convex to finish syncing (check terminal)
3. Visit: `http://localhost:3000/dashboard/admin/seed-categories`
4. Click "Seed Categories Now"

---

## Option 3: Convex Dashboard

1. Go to https://dashboard.convex.dev
2. Select your project
3. Go to **Functions** tab
4. Find `categories:seedCategories`
5. Click **"Run"**

---

## 🔍 How to Check if Convex Has Synced

Look at your terminal where `pnpm dev` is running. You should see:
- ✅ "Convex functions updated"
- ✅ Or check the available functions list

**The function will appear as:** `categories:seedCategories`

---

**Once seeded, visit `/dashboard/categories` to see all 20 medical specialty categories!** 🎉




