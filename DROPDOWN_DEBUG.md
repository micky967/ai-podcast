# Dropdown Not Expanding - Debug Guide

## Issue
The category dropdown menu is not expanding when clicked.

## Possible Causes

1. **Categories not seeded** - Most likely cause
   - If categories haven't been seeded in Convex, the dropdown will be empty
   - The SelectContent might not render properly when empty

2. **SelectContent conditional rendering**
   - Currently, SelectContent only renders when categories exist
   - This might prevent the dropdown from opening

3. **CSS/Z-index issues**
   - The dropdown might be rendering but hidden behind other elements
   - Z-index conflicts with glass-card or other overlays

## Quick Checks

1. **Check browser console** for any errors
2. **Check if categories are loaded**:
   - Open browser DevTools
   - Go to Network tab
   - Look for Convex queries to `getMainCategories`
   - Check if it returns data

3. **Verify categories are seeded**:
   - Go to Convex Dashboard
   - Check if categories table exists and has data

## Solution

The dropdown should work once:
1. Categories are seeded in Convex
2. The SelectContent is always rendered (not conditional)

## Testing Steps

1. Seed categories first (via Convex Dashboard)
2. Refresh the page
3. Check if dropdown opens
4. If still not working, check browser console for errors





