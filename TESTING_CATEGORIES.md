# 🧪 Testing Category System - Quick Guide

## ✅ **You Can Restart Now!**

Go ahead and restart your dev server:

```bash
pnpm dev
```

---

## ⚠️ **Important: Before Testing Upload**

### **Step 1: Seed Categories First**

The category selector needs categories in the database. Here's how:

1. **Wait for Convex to sync** (check terminal after starting dev server)
2. **Go to Convex Dashboard**: https://dashboard.convex.dev
3. **Select your project**
4. **Go to Functions tab**
5. **Find `seedCategories`** in the function list
6. **Click "Run"** button
7. **Wait for it to complete** - it will create all 20 categories

**OR** I can help you create a simpler way to seed them. But the dashboard method works!

---

## 🧪 **What to Test:**

### ✅ Upload Page:
1. Go to `/dashboard/upload`
2. Select a file
3. **Category selector should appear** below file info
4. Select a main category (required)
5. Select subcategory if available (optional)
6. Click "Start Upload"

### ✅ Project Cards:
1. After upload, go to `/dashboard/projects`
2. **Category badge should appear** on project cards
3. Shows category name (and subcategory if selected)

---

## 🐛 **Expected Issues:**

### ❌ Category dropdown is empty?
→ **Normal!** Categories aren't seeded yet. Run the seed function first.

### ❌ Upload button disabled?
→ **Normal!** Select a category first (it's required).

### ❌ Old projects don't have categories?
→ **Expected!** Only new uploads will have categories.

---

## 🎯 **Quick Test Checklist:**

- [ ] Start dev server: `pnpm dev`
- [ ] Seed categories (Convex Dashboard)
- [ ] Go to upload page
- [ ] Select file
- [ ] See category selector
- [ ] Select category
- [ ] Upload works
- [ ] See category on project card

---

**Ready to test!** Just seed categories first and you're good to go! 🚀








