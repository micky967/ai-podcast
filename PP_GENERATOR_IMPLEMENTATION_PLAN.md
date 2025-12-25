# PowerPoint Generator Implementation Plan

## My Understanding of Your Request

You want to:
1. **Replace the "Hashtags" tab** with **"PP Generator"** (PowerPoint Generator)
2. **Create an audio-to-slide generator** that produces complete PowerPoint presentations with:
   - Diagrams
   - Tables
   - Learning objectives
   - Perfect for classmates, tutors, or self-review
3. **Use existing infrastructure**: OpenAI, AssemblyAI, Inngest, Convex DB, Clerk
4. **Maintain current design/styling** consistency
5. **Implement in phases** with step-by-step testing
6. **Ability to revert** if needed (checkpoint created: `checkpoint-before-pp-generator`)

---

## Current System Architecture Understanding

### Data Flow:
1. **User uploads audio** → AssemblyAI transcribes → Inngest workflow processes
2. **Inngest steps** generate content (summary, hashtags, social posts, etc.) using OpenAI
3. **Results saved to Convex** → Real-time UI updates
4. **UI displays** content in tabs on project detail page

### Current Hashtag Implementation:
- **Tab Config**: `lib/tab-config.ts` - defines "hashtags" tab
- **AI Generation**: `inngest/steps/ai-generation/hashtags.ts` - generates hashtags
- **Schema**: `inngest/schemas/ai-outputs.ts` - defines hashtags structure
- **UI Component**: `components/project-tabs/hashtags-tab.tsx` - displays hashtags
- **Database**: `convex/schema.ts` - stores hashtags in projects table
- **Workflow**: `inngest/functions/podcast-processor.ts` - orchestrates generation

---

## Step-by-Step Implementation Plan

### **Phase 1: UI & Configuration Changes** (No AI yet - just replace hashtag UI)
**Goal**: Replace hashtag tab with PP Generator tab, show placeholder content

1. **Update Tab Configuration** (`lib/tab-config.ts`)
   - Change "hashtags" → "pp-generator"
   - Change label "Hashtags" → "PP Generator"
   - Keep same feature key initially (or create new one)

2. **Update Project Detail Page** (`app/dashboard/projects/[id]/page.tsx`)
   - Replace `HashtagsTab` import with `PPGeneratorTab`
   - Update TabsContent value from "hashtags" to "pp-generator"
   - Update feature references

3. **Create PP Generator Tab Component** (`components/project-tabs/pp-generator-tab.tsx`)
   - Create new component with placeholder UI
   - Match current design/styling (glass-card, gradient-emerald-text, etc.)
   - Show "Coming soon" or placeholder message initially
   - Structure for future PowerPoint content display

4. **Update Schema References** (temporary - keep hashtags in DB for now)
   - Update UI to read from new field (or reuse hashtags field temporarily)
   - This allows testing UI without breaking existing data

**Testing**: Verify tab appears, placeholder content shows, no errors

---

### **Phase 2: Database Schema Update**
**Goal**: Add PowerPoint data structure to database

1. **Update Convex Schema** (`convex/schema.ts`)
   - Add `powerpointGenerator` field to projects table
   - Define structure for PowerPoint content (slides, diagrams, tables, learning objectives)

2. **Update Project Queries** (`convex/projects.ts`)
   - Ensure new field is included in project queries
   - Add validation if needed

**Testing**: Verify schema updates, no migration errors

---

### **Phase 3: AI Generation Schema & Prompt Design**
**Goal**: Design the PowerPoint structure and AI prompt

1. **Create PowerPoint Schema** (`inngest/schemas/ai-outputs.ts`)
   - Define structure for slides (title, content, slide type)
   - Define structure for diagrams (type, description, data)
   - Define structure for tables (headers, rows)
   - Define learning objectives structure
   - Use Zod for validation

2. **Design AI Prompt** (plan in comments first)
   - System prompt: "You are an expert educational content creator..."
   - User prompt structure:
     - Extract key concepts from transcript
     - Create learning objectives
     - Generate slides with appropriate content
     - Suggest diagrams for complex concepts
     - Create tables for structured data
   - Specify output format (JSON with slides array)

**Testing**: Review schema and prompt design before implementation

---

### **Phase 4: AI Generation Function**
**Goal**: Create the PowerPoint generation function

1. **Create Generation Function** (`inngest/steps/ai-generation/powerpoint-generator.ts`)
   - Similar structure to `hashtags.ts`
   - Use OpenAI with structured outputs
   - Parse transcript (chapters, summary, full text)
   - Generate PowerPoint structure
   - Error handling and fallbacks

2. **Integrate into Workflow** (`inngest/functions/podcast-processor.ts`)
   - Add PowerPoint generation to job list
   - Replace hashtags generation with PowerPoint generation
   - Handle plan-based feature gating (PRO/ULTRA)

3. **Update Save Function** (`inngest/steps/persistence/save-to-convex.ts`)
   - Save PowerPoint data to Convex
   - Update error handling

**Testing**: Test generation with sample audio, verify data structure

---

### **Phase 5: UI Implementation**
**Goal**: Display PowerPoint content beautifully

1. **Update PP Generator Tab Component** (`components/project-tabs/pp-generator-tab.tsx`)
   - Display slides in a card-based layout
   - Show learning objectives prominently
   - Display diagrams (as descriptions initially, or with visualizations)
   - Display tables with proper formatting
   - Add navigation between slides
   - Match current design system

2. **Add Export Functionality** (optional - future phase)
   - Export to PowerPoint file (.pptx)
   - Or export as PDF
   - Or copy content

**Testing**: Verify all content displays correctly, styling matches

---

### **Phase 6: Remove Hashtag References**
**Goal**: Clean up old hashtag code

1. **Remove Hashtag Generation** (`inngest/steps/ai-generation/hashtags.ts`)
   - Keep file for reference initially, then delete

2. **Remove Hashtag Schema** (`inngest/schemas/ai-outputs.ts`)
   - Remove hashtagsSchema

3. **Update Constants** (`lib/constants.ts`, `lib/tier-config.ts`)
   - Remove hashtag feature references

4. **Clean Up Imports**
   - Remove hashtag imports from workflow files

**Testing**: Verify no broken references, app still works

---

## Technical Considerations

### PowerPoint Structure Design:
```typescript
{
  learningObjectives: string[];  // 3-5 learning objectives
  slides: Array<{
    slideNumber: number;
    title: string;
    content: string;  // Main content/text
    slideType: "content" | "diagram" | "table" | "summary";
    diagram?: {
      type: "flowchart" | "concept-map" | "timeline" | "comparison";
      description: string;
      data?: any;  // Structured data for diagram
    };
    table?: {
      headers: string[];
      rows: string[][];
      caption?: string;
    };
  }>;
  totalSlides: number;
}
```

### AI Prompt Strategy:
- Use transcript chapters to create slide structure
- Extract key concepts for learning objectives
- Identify complex topics that need diagrams
- Identify structured data that needs tables
- Ensure educational value (for classmates, tutors, self-review)

### Integration Points:
- **AssemblyAI**: Already provides transcript with chapters
- **OpenAI**: Use GPT-4 or GPT-4-turbo for better structure understanding
- **Inngest**: Add as new step in workflow
- **Convex**: Store as JSON in projects table
- **Clerk**: Use existing feature gating (PRO/ULTRA plans)

---

## Risk Mitigation

1. **Checkpoint Created**: Tag `checkpoint-before-pp-generator` allows full revert
2. **Phased Approach**: Each phase can be tested independently
3. **Backward Compatibility**: Keep hashtag field initially, migrate gradually
4. **Error Handling**: Comprehensive error handling at each step
5. **Fallback Content**: If generation fails, show helpful message

---

## Answers to Questions:

1. **Feature Gating**: ✅ PRO and ULTRA plans only
2. **Slide Count**: ✅ Dynamic - enough to cover everything (could be 20, 30, or 40 slides depending on content)
3. **Diagram Visualization**: ✅ Both images AND descriptions to be generated
4. **Export Format**: ✅ .pptx file export, but only for "owner" role. Admins and users cannot export (may be allowed later)
5. **Document Support**: ✅ Support both audio and PDF files

---

## Next Steps:

1. **Confirm understanding** - Does this plan match your vision?
2. **Answer questions** - Help me refine the approach
3. **Start Phase 1** - Begin with UI changes (safest, reversible)
4. **Test each phase** - Verify before moving to next phase

---

**Ready to proceed when you confirm!** 🚀

