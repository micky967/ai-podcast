# Fix git state and merge feature branch

# Discard generated file changes
git checkout -- convex/_generated/api.d.ts convex/_generated/dataModel.d.ts

# Add all restored files
git add app/actions/categories.ts
git add convex/categories.ts
git add convex/categoryData.ts
git add convex/schema.ts
git add -A

# Commit restored files
git commit -m "Restore missing files: categories, actions, and schema"

# Merge feature branch
git merge feature/category-system -m "Merge feature/category-system: includes sharing fix and all features"

# Push to origin
git push origin master

