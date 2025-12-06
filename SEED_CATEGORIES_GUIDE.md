# 🌱 How to Seed Categories

You have **3 easy ways** to seed all the medical specialty categories into your Convex database:

---

## 🎯 **Option 1: Admin Page (Easiest - Recommended)**

1. **Start your dev server** (if not already running):
   ```bash
   pnpm dev
   ```

2. **Visit the admin page**:
   ```
   http://localhost:3000/dashboard/admin/seed-categories
   ```

3. **Click the "Seed Categories Now" button**

4. **Done!** All 20 categories + subcategories will be created.

---

## 🚀 **Option 2: Convex CLI (Quick)**

Run this command in your terminal:

```bash
npx convex run categories:seedCategories
```

That's it! The categories will be seeded directly.

---

## 📊 **Option 3: Convex Dashboard**

1. Go to [Convex Dashboard](https://dashboard.convex.dev)
2. Select your project
3. Go to **Functions** tab
4. Find `seedCategories` in `convex/seed-categories.ts`
5. Click **"Run"** button
6. Wait for completion

---

## ✅ **What Gets Created?**

- **20 Main Categories** (Medical specialties like Cardiology, Emergency Medicine, etc.)
- **All Subcategories** (e.g., "Heart disease management", "Trauma cases", etc.)

**Example Categories:**
- Anesthesiology / Perioperative Medicine & Pain Medicine
- Critical Care / Intensive Care / ICU
- Emergency Medicine
- Cardiology / Heart / Vascular Medicine & Cardiac Surgery
- ... and 16 more!

---

## 🔄 **Safe to Run Multiple Times**

The seed function is **idempotent** - you can run it multiple times safely. It won't create duplicate categories. If categories already exist, they'll be skipped.

---

## 🎯 **Recommended: Use Option 1 (Admin Page)**

The admin page is the easiest because:
- ✅ No command line needed
- ✅ Shows you exactly what was created
- ✅ Visual feedback
- ✅ Works from your browser

---

**Once seeded, visit** `/dashboard/categories` **to see all your categories!** 🎉

