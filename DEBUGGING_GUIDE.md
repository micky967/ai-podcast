# 🐛 Debugging Guide - Where to Find Errors

## 📍 Quick Reference

When debugging issues (like deletion not working), check these locations in order:

---

## 1. **Terminal/Command Prompt** (Server-Side Logs)

**Where:** The terminal window where you run `pnpm dev`

**What to look for:**
- Server action logs (prefix: `[DELETE]`)
- Convex mutation logs (prefix: `[CONVEX DELETE]`)
- Error stack traces

**Example output:**
```
[DELETE] Attempting to delete project j1234567890 by user user_abc123
[CONVEX DELETE] Starting deletion for project j1234567890 by user user_abc123
[CONVEX DELETE] Successfully soft-deleted project j1234567890 at 1234567890
[DELETE] Project j1234567890 successfully soft-deleted in Convex
```

**If you see errors:**
- Look for `Error:` or `[DELETE] Error deleting project:`
- Check the full stack trace below the error

---

## 2. **Browser Console** (Client-Side Errors)

**How to open:**
1. Press `F12` (or `Ctrl+Shift+I` on Windows/Linux, `Cmd+Option+I` on Mac)
2. Click the **"Console"** tab

**What to look for:**
- Red error messages
- Toast notifications (success/error messages)
- Network errors (check the **Network** tab)

**Example errors:**
```
Failed to delete project: Unauthorized
Error: Project not found
Network request failed
```

---

## 3. **Convex Dashboard** (Convex-Specific Logs)

**Where:** https://dashboard.convex.dev

**Steps:**
1. Log in to your Convex account
2. Select your project
3. Click **"Logs"** or **"Functions"** in the sidebar
4. Filter by function name: `deleteProject`

**What to look for:**
- Function execution logs
- Error messages from Convex mutations
- Execution time and results

---

## 🔍 Debugging Deletion Issue

When deletion doesn't work in Convex DB:

### Step 1: Check Terminal Logs
```bash
# Look for these in your terminal:
[DELETE] Attempting to delete project...
[CONVEX DELETE] Starting deletion...
```

**If you DON'T see `[CONVEX DELETE]`:**
- The mutation isn't being called
- Check for errors before the Convex call

**If you DO see `[CONVEX DELETE]` but no success:**
- Look for error messages after it
- Check authorization errors

### Step 2: Check Browser Console
- Open DevTools (F12)
- Click delete button
- Watch for error messages in console
- Check Network tab for failed requests

### Step 3: Check Convex Dashboard
- Go to dashboard.convex.dev
- Check Logs tab
- Look for `deleteProject` function executions
- Check if mutations are being called

---

## 📝 Common Error Patterns

### Error: "Unauthorized"
- **Location:** Terminal or Browser Console
- **Meaning:** User authentication failed
- **Fix:** Check if user is logged in

### Error: "Project not found"
- **Location:** Terminal or Convex Dashboard
- **Meaning:** Project ID doesn't exist in database
- **Fix:** Verify the project ID is correct

### Error: "You don't own this project"
- **Location:** Terminal (Convex mutation)
- **Meaning:** User trying to delete someone else's project
- **Fix:** Security check working correctly - this is expected

### No errors but deletion doesn't work
- **Check:** Terminal logs to see if mutation is called
- **Check:** Convex Dashboard to see if mutation executed
- **Possible:** Mutation failing silently or not being called

---

## 💡 Tips

1. **Keep terminal visible** - Most errors appear here first
2. **Check both terminal and browser** - Errors can be in either place
3. **Look for the prefixes** - `[DELETE]` and `[CONVEX DELETE]` help identify our logs
4. **Check timestamps** - Make sure you're looking at recent logs

---

## 🚀 Quick Commands

```bash
# View all logs in terminal (already running with pnpm dev)
# Just scroll up to see previous logs

# Clear terminal (optional)
# Windows: cls
# Mac/Linux: clear
```

---

## 📞 When to Share Logs

If you need help debugging, share:

1. **Terminal output** - Copy the relevant error lines
2. **Browser console errors** - Screenshot or copy error messages
3. **What you were doing** - "Clicked delete button on project X"
4. **Expected vs Actual** - "Expected project to be deleted, but it's still in Convex DB"

---

## ✅ Success Indicators

When deletion works correctly, you should see:

```
✅ Terminal: [CONVEX DELETE] Successfully soft-deleted project...
✅ Browser: Toast notification "Project deleted successfully"
✅ Convex DB: Project has deletedAt timestamp set
✅ UI: Project disappears from list (filtered out by query)
```





