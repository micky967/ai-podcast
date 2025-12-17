# 🚀 Category System Setup Instructions

## ⚠️ **IMPORTANT: Before Testing**

Before you can test the category system, you need to **seed the categories** into your Convex database.

---

## 📋 Quick Setup Steps

### Step 1: Start Your Dev Server
```bash
pnpm dev
```

### Step 2: Seed Categories

**Option A: Using Convex Dashboard (Easiest)**

1. Open your Convex Dashboard: https://dashboard.convex.dev
2. Select your project
3. Go to **Functions** tab
4. Find `seedCategories` function in `convex/seed-categories.ts`
5. Click **"Run"** button (or use the function playground)
6. It will create all 20 categories + subcategories

**Option B: Using Convex CLI**

1. Open Convex Dashboard → Your Project → Functions
2. Go to `convex/seed-categories.ts`
3. Click "Run" in the function playground
4. Or use the Convex dashboard's function runner

**Option C: Create a one-time script**

I can create a simple script you can run, or you can use the Convex dashboard function runner.

---

## ✅ What Gets Created

- **20 Main Categories** (Medical specialties)
- **All Subcategories** (nested under main categories)

**Example:**
- Cardiology / Heart / Vascular Medicine
  - Heart disease management
  - Arrhythmia, coronary disease
  - Vascular medicine and surgery
  - Cardiac surgery / thoracic-cardiac surgery

---

## 🧪 Testing Steps

Once categories are seeded:

1. **Start dev server**: `pnpm dev`
2. **Go to upload page**: `http://localhost:3000/dashboard/upload`
3. **Select a file** - You should see the category selector appear
4. **Select a category** - Dropdown should show all 20 categories
5. **Select subcategory** (if available) - Second dropdown appears
6. **Upload** - Should work normally

---

## 🔍 Troubleshooting

### Category selector shows empty?
- ✅ Categories haven't been seeded yet - run seed function first

### Upload fails?
- ✅ Make sure you selected a category (required)
- ✅ Check browser console for errors

### Categories not showing on project cards?
- ✅ Need to upload a new file with category selected
- ✅ Old projects won't have categories (that's expected)

---

## 📝 Notes

- **First Time Setup**: You only need to seed categories once
- **Existing Projects**: Projects uploaded before categories won't have categories (normal)
- **New Projects**: All new uploads will require category selection

---

**Ready to seed?** Go to Convex Dashboard and run the `seedCategories` function! 🎯








