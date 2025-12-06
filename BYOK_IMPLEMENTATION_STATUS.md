# BYOK (Bring Your Own Key) Implementation Status

## ✅ Completed

1. **Schema Updates**
   - Added `userSettings` table to Convex schema
   - Stores `openaiApiKey` and `assemblyaiApiKey` per user

2. **Convex Functions**
   - Created `convex/userSettings.ts` with:
     - `getUserSettings` query
     - `updateUserSettings` mutation
     - `clearUserApiKeys` mutation

3. **Server Actions**
   - Created `app/actions/user-settings.ts` for managing API keys

4. **UI Components**
   - Created `app/dashboard/settings/page.tsx` - Settings page
   - Created `components/settings/settings-form.tsx` - Form component

5. **API Client Updates**
   - Updated `inngest/lib/openai-client.ts` to support user keys
   - Updated `inngest/steps/transcription/assemblyai.ts` to accept user keys

## 🔄 In Progress / Remaining

### Critical: Update Inngest Functions

1. **Update Podcast Processor** (`inngest/functions/podcast-processor.ts`)
   - Get project to retrieve `userId`
   - Fetch user settings using `userId`
   - Pass `openaiApiKey` and `assemblyaiApiKey` to all functions

2. **Update All AI Generation Steps**
   - Modify each step to accept optional `userApiKey` parameter
   - Use `createOpenAIClient(userApiKey)` instead of default `openai` client
   - Files to update:
     - `inngest/steps/ai-generation/summary.ts`
     - `inngest/steps/ai-generation/social-posts.ts`
     - `inngest/steps/ai-generation/titles.ts`
     - `inngest/steps/ai-generation/hashtags.ts`
     - `inngest/steps/ai-generation/key-moments.ts`
     - `inngest/steps/ai-generation/youtube-timestamps.ts`
     - `inngest/steps/ai-generation/engagement.ts`

3. **Update Retry Job Function** (`inngest/functions/retry-job.ts`)
   - Get user settings when retrying jobs
   - Pass API keys to retry functions

### Nice to Have

1. **Add Settings Link to Navigation**
   - Add "Settings" link to dashboard navigation
   
2. **Key Validation**
   - Test API keys before saving (optional)
   - Show validation status in UI

3. **Usage Tracking**
   - Track which keys are being used (user vs shared)
   - Show usage statistics

## Implementation Notes

### Pattern for AI Generation Steps

Replace:
```typescript
import { openai } from "../../lib/openai-client";
```

With:
```typescript
import { createOpenAIClient } from "../../lib/openai-client";

// In function:
const openai = createOpenAIClient(userApiKey);
```

### Pattern for Transcription

Already updated to accept `userApiKey` parameter.

### Getting User Settings in Inngest

```typescript
// Get project to retrieve userId
const project = await convex.query(api.projects.getProject, { projectId });
const userId = project.userId;

// Get user settings
const userSettings = await convex.query(api.userSettings.getUserSettings, { userId });

// Use keys (fallback to environment keys if not provided)
const openaiApiKey = userSettings?.openaiApiKey;
const assemblyaiApiKey = userSettings?.assemblyaiApiKey;
```

## Testing Checklist

- [ ] User can save OpenAI API key
- [ ] User can save AssemblyAI API key
- [ ] User can clear API keys
- [ ] Processing uses user keys when provided
- [ ] Processing falls back to environment keys when user keys not provided
- [ ] All AI generation steps work with user keys
- [ ] Transcription works with user keys
- [ ] Retry jobs work with user keys

## Next Steps

1. Complete podcast processor updates
2. Update all AI generation steps
3. Update retry job function
4. Add navigation link
5. Test end-to-end

