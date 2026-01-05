# Convex Schema Synchronization Rule

## Critical Workflow: Schema Changes and Deployment

### 1. Schema Change Detection
Before suggesting a 'Retry' on any failed Inngest or AI job, you MUST:
- Check if convex/schema.ts was recently modified
- Check if inngest/schemas/ai-outputs.ts (Zod schemas) was recently modified
- Verify schema alignment between Convex validators and Zod schemas

### 2. Deployment Verification
If the schema was changed, you MUST ask:
> "Have you run 
px convex dev or 
px convex deploy to update the cloud validator?"

**Do NOT assume the database is updated just because the file is saved.**

### 3. Schema Alignment Requirements
Verify that Zod schemas and Convex schemas are perfectly aligned:

| Layer | File | Field Definition | Purpose |
|-------|------|-----------------|---------|
| **OpenAI API** | inngest/schemas/ai-outputs.ts | ield: z.string() | Force AI to generate (required) |
| **Database** | convex/schema.ts | ield: v.optional(v.string()) | Accept new + old data (optional) |
| **Mutation** | convex/projects.ts | ield: v.optional(v.string()) | Match database schema |

**Rule:** Zod required = Convex optional or required (but Convex must accept what Zod generates)

### 4. Common Schema Mismatch Patterns

#### Pattern A: Missing Field in Convex Schema
`	ypescript
//  WRONG - Field in Zod but not in Convex
// ai-outputs.ts
rationale: z.string()

// schema.ts
v.object({
  vignette: v.string(),
  // rationale missing! 
})
`

#### Pattern B: Missing Field in Mutation Validator
`	ypescript
//  WRONG - Field in schema.ts but not in mutation args
// schema.ts has rationale, but mutation doesn't accept it
export const appendClinicalScenarios = mutation({
  args: {
    scenarios: v.array(v.object({
      vignette: v.string(),
      // rationale missing! 
    }))
  }
})
`

#### Pattern C: Union Schema Mismatch
`	ypescript
//  WRONG - Field added to wrong union member
v.union(
  v.object({ /* QBank format - needs rationale */ }),
  v.object({ /* SOAP format - has rationale */ }) //  Added here instead
)
`

### 5. Deployment Checklist
Before marking a schema change as complete:
- [ ] Updated convex/schema.ts
- [ ] Updated inngest/schemas/ai-outputs.ts (if needed)
- [ ] Updated mutation validators in convex/projects.ts (if needed)
- [ ] Ran 
px convex dev or 
px convex deploy
- [ ] Verified Convex Dashboard shows new fields
- [ ] Tested generation  save  display flow

### 6. Credit Protection
When schema changes affect AI generation:
- Wrap expensive AI calls in named step.run() for idempotency
- If save fails, Inngest will use cached AI result on retry
- Prevents wasting credits on re-generation

### 7. Error Messages to Watch For
- ArgumentValidationError  Mutation validator doesn't match schema
- Zod field uses .optional() without .nullable()  OpenAI Strict mode error
- NESTING_STEPS  step.* calls nested inside other step.* calls

### 8. Quick Reference: Schema Sync Commands
`ash
# Development (auto-reload)
npx convex dev

# Production deployment
npx convex deploy

# Check deployment status
# Visit Convex Dashboard  Schema tab
`

---

**Remember:** Code changes  Database changes. Always deploy!
