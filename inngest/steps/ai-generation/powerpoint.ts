/**
 * PowerPoint Slide Generation Step
 *
 * Takes a transcript (from audio or document) and produces a lightweight slide
 * deck outline. Each slide recommends titles, bullets, optional speaker notes,
 * and simple clip art/icon suggestions. This keeps costs low while enabling
 * automation of text-based slides plus light vector visuals.
 */
import type { step as InngestStep } from "inngest";
import type OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { createBoundCompletion } from "../../lib/openai-client";
import { type PowerPoint, powerPointSchema } from "../../schemas/ai-outputs";
import type { TranscriptWithExtras } from "../../types/assemblyai";

const POWERPOINT_SYSTEM_PROMPT =
  "You are a medical education expert creating serious clinical PowerPoint presentations. CRITICAL RULES: 1) SKIP ENTIRE transcript sections containing names (Zach, Zachary, Ninja), podcast references (podcast, YouTube), greetings, or announcements - DO NOT extract ANY content from these sections. 2) Extract ONLY clinical medical content: conditions, diagnoses, treatments, complications, management. 3) Transform ALL content to third-person professional medical language - NEVER use 'we', 'I', 'he says'. 4) DO NOT create slides for: 'The Ninja Nerd Podcast is launching...', 'We're doing a video podcast', 'Zach: Well, Ninja, thank you...', 'We have finished our very first video podcast' - these are FORBIDDEN. 5) Every slide must contain ONLY clinical medical content with actionable information for doctors. You actively filter out names, podcast references, and conversational elements BEFORE creating slides. The final deck is a serious medical education resource.";

const SOURCE_TYPE_LABELS: Record<"audio" | "document", string> = {
  audio: "audio transcript from a podcast episode",
  document: "text extracted from a PDF or document",
};

function buildPowerPointPrompt(
  transcript: TranscriptWithExtras,
  sourceType: "audio" | "document",
): string {
  const context = SOURCE_TYPE_LABELS[sourceType];
  
  // Use full transcript, but if it's very long, use a smart truncation strategy
  // Include beginning, middle sections, and end to capture full context
  const fullText = transcript.text;
  const textLength = fullText.length;
  let transcriptSection = "";
  
  if (textLength <= 10000) {
    // Use full transcript if under 10k chars
    transcriptSection = fullText;
  } else {
    // For longer transcripts, use beginning, chapter summaries, and end
    const startSection = fullText.substring(0, 3000);
    const endSection = fullText.substring(textLength - 2000);
    
    // Include chapter summaries if available
    const chapterSummaries = transcript.chapters
      ?.map((ch) => `[${ch.headline}]: ${ch.summary || ch.gist || ""}`)
      .join("\n\n") || "";
    
    transcriptSection = `BEGINNING OF TRANSCRIPT:\n${startSection}\n\n...\n\n${chapterSummaries ? `CHAPTER SUMMARIES:\n${chapterSummaries}\n\n...\n\n` : ""}END OF TRANSCRIPT:\n${endSection}`;
  }

  // Build comprehensive chapters section
  const chaptersSection =
    transcript.chapters?.length > 0
      ? `\n\nDETAILED CHAPTER BREAKDOWN:\n${transcript.chapters
          .map((chapter, index) => {
            const summary = chapter.summary || chapter.gist || "No summary available";
            return `${index + 1}. ${chapter.headline}\n   Summary: ${summary}\n   Start: ${chapter.start ? Math.floor(chapter.start / 1000) : "N/A"}s`;
          })
          .join("\n\n")}`
      : "";

  // Calculate appropriate number of slides based on content length
  // More slides = better coverage of all content
  const baseSlides = 20;
  const chapterCount = transcript.chapters?.length || 0;
  const textBasedSlides = Math.ceil(textLength / 2000); // ~1 slide per 2000 chars
  const chapterBasedSlides = chapterCount > 0 ? chapterCount * 2 : 0; // 2 slides per chapter
  
  const estimatedSlides = Math.min(
    Math.max(baseSlides, Math.max(textBasedSlides, chapterBasedSlides + 5)),
    40 // Cap at 40 slides for very long content
  );

  return `🚨🚨🚨 CRITICAL INSTRUCTIONS - READ THIS FIRST 🚨🚨🚨

You are creating a SERIOUS medical education PowerPoint deck. The transcript below contains NON-CLINICAL content (names, podcast references, greetings, announcements) that you MUST COMPLETELY IGNORE.

FORBIDDEN CONTENT - DO NOT CREATE SLIDES FOR THESE:
- "The Ninja Nerd Podcast is launching a video podcast" → SKIP, DO NOT CREATE
- "Welcome back to the Ninja Nerd Podcast" → SKIP, DO NOT CREATE
- "We're doing a video podcast" → SKIP, DO NOT CREATE  
- "We're working on volume disorders because we're doing it for YouTube" → SKIP, DO NOT CREATE
- "We have finished our very first video podcast" → SKIP, DO NOT CREATE
- "Zach: Well, Ninja, thank you guys for listening" → SKIP, DO NOT CREATE
- Any slide with "Zach", "Zachary", "Ninja" in title → SKIP, DO NOT CREATE
- Any slide mentioning "podcast" or "YouTube" → SKIP, DO NOT CREATE

ONLY CREATE SLIDES FOR PURE CLINICAL MEDICAL CONTENT.

🚨 CRITICAL: YOU MUST SKIP ENTIRE SECTIONS OF THE TRANSCRIPT THAT CONTAIN NON-CLINICAL CONTENT 🚨

⚠️ STEP 1: IDENTIFY AND SKIP NON-CLINICAL SECTIONS
Read through the transcript and IDENTIFY sections to COMPLETELY SKIP (do not extract ANY content from these):
- "The Ninja Nerd Podcast is launching a video podcast" → SKIP ENTIRELY
- "Welcome back to the Ninja Nerd Podcast" → SKIP ENTIRELY
- "We're doing a video podcast" → SKIP ENTIRELY
- "We're working on volume disorders because we're doing it for YouTube" → SKIP ENTIRELY
- "We have finished our very first video podcast" → SKIP ENTIRELY
- "Zach: Well, Ninja, thank you guys for listening" → SKIP ENTIRELY
- "So, Zach, give us our classic send off" → SKIP ENTIRELY
- Any section starting with "Zach:", "Zachary:", or containing "Ninja" → SKIP ENTIRELY (unless you can extract pure clinical content without the name)
- Any section with "podcast", "YouTube", "every Friday", "keep updated" → SKIP ENTIRELY
- Any greeting, thank you, send-off, or announcement → SKIP ENTIRELY

⚠️ STEP 2: EXTRACT ONLY CLINICAL CONTENT
From the REMAINING sections (after skipping non-clinical), extract ONLY:
- Medical conditions and clinical presentations
- Diagnostic approaches and criteria
- Treatment protocols and medications
- Complications and management strategies
- Clinical pearls and evidence-based recommendations

⚠️ STEP 3: ACTIVE FILTERING AND TRANSFORMATION
For EVERY piece of content you extract:
1. If it contains ANY name (Zach, Zachary, Ninja, any name) → DELETE the name completely, extract only the medical content
   Example: "Zachary: What are some common complications" → Extract only: "Complications of Hypovolemia"
2. If it contains "we", "I", "he says", "they said" → REWRITE in third-person professional language
   Example: "I would give her 1-2 liters" → "Initial fluid resuscitation: 1-2 liters normal saline"
   Example: "He says GI losses are the cause" → "GI losses are a common cause of hypovolemia"
3. If it contains podcast/platform references → DELETE those words completely, extract only medical content
   Example: "We're working on volume disorders because we're doing it for YouTube" → SKIP ENTIRELY, do not create slide
4. Transform conversational to clinical:
   - "I would give her maybe 1 to 2 liters" → "Initial fluid resuscitation: 1-2 liters normal saline or lactated Ringer's solution"
   - "I'm going to fix the complications" → "Complications are managed by correcting volume status: improve blood pressure and reduce tachycardia through fluid replacement"
   - "We get vitals, physical exam, and lab findings" → "Clinical Assessment: Vital Signs, Physical Examination, and Laboratory Findings"
   - "Zach: What fluid would you give" → "Fluid Management for Acute Kidney Injury"
   - "A lot of things to try and sift through" → Extract specific clinical findings, do not use vague language

⚠️ STEP 4: SLIDE CREATION RULES - MANDATORY CHECKS
Before creating EACH slide, verify:
1. Does the title contain "Zach", "Zachary", "Ninja", "podcast", "YouTube", "we're doing", "we have finished"?
   → If YES: DO NOT CREATE THIS SLIDE, SKIP IT ENTIRELY
2. Are the bullets conversational ("I would", "we get", "he says", "they said")?
   → If YES: REWRITE in third-person professional language
3. Are the bullets vague ("I'm going to fix", "a lot of things", "she's got a lot going on")?
   → If YES: Make specific and actionable
4. Is this slide a greeting, thank you, announcement, or send-off?
   → If YES: DO NOT CREATE THIS SLIDE, SKIP IT ENTIRELY
5. Can you extract pure clinical medical content from this section?
   → If NO: DO NOT CREATE THIS SLIDE, SKIP IT ENTIRELY

ONLY create slides that pass ALL checks above.

CRITICAL REQUIREMENTS - READ CAREFULLY:
- This is a SERIOUS, COMPREHENSIVE MEDICAL EDUCATION presentation for healthcare professionals
- DIVE DEEP into PURE CLINICAL CONTENT ONLY: conditions, diagnostic approaches, treatment protocols, clinical management
- Focus on ACTIONABLE CLINICAL KNOWLEDGE:
  * What conditions/diseases/problems are discussed
  * How to diagnose these conditions (diagnostic criteria, workup, tests)
  * How to treat these conditions (treatment protocols, medications, dosages, interventions)
  * What to look for clinically (signs, symptoms, clinical presentations)
  * What complications occur and how to manage them
  * How to manage patients (management plans, follow-up, monitoring)
  * Clinical pearls and evidence-based recommendations
- SYNTHESIZE medical information - transform spoken discussions into structured clinical education
- SUPPLEMENT with reputable medical knowledge: You may supplement clinical content with established medical knowledge from reputable sources on the topic being discussed
- ABSOLUTELY REMOVE - ZERO TOLERANCE:
  * ANY names: speaker names, host names, "Dr. X", "Dr. Y", "Zach", "Ninja", podcast host names, guest names, ANY names whatsoever
  * ANY podcast references: "podcast", "Ninja Nerd Podcast", "video podcast", "we're doing a podcast"
  * ANY platform references: "YouTube", "every Friday", "keep updated on YouTube", "release a podcast"
  * ANY conversational elements: "we", "I would", "I'm going to", "he says", "she says", "they said"
  * ANY dialogue markers: "he said/she said", "the host said", "the guest mentioned"
  * ANY casual language: "coolest thing", "hopefully", "kind of", "sort of"
  * ANY non-clinical content: podcast announcements, thank you messages, send-offs, greetings
  * ANY vague statements: "I'm going to fix it" (must explain HOW), "a lot of things" (must specify WHAT)
- Generate ${estimatedSlides} UNIQUE, CLINICALLY RELEVANT slides (minimum 15, maximum 40)
- Each slide must cover a DISTINCT clinical topic with actionable medical content
- REMOVE any slides that are not clinically relevant (greetings, thank yous, podcast announcements)
- **ABSOLUTELY FORBIDDEN**: 
  * Do NOT include ANY names - ZERO names allowed anywhere
  * Do NOT mention podcast, YouTube, video podcast, or any platform
  * Do NOT include conversational elements ("we", "I", "he says", etc.)
  * Do NOT include non-clinical content (greetings, thank yous, announcements)
  * Do NOT create vague statements - must be specific and actionable
  * Do NOT copy conversations word-for-word
  * Do NOT use generic placeholder text
- **REQUIRED**: 
  * Extract ONLY clinical content: conditions, diagnoses, treatments, complications, management
  * Synthesize into clear, actionable clinical education format
  * Use third-person, professional medical language
  * Include specific clinical details: how to diagnose, how to treat, what to monitor
  * Supplement with reputable medical knowledge when appropriate
  * Ensure each slide is UNIQUE and clinically relevant

FULL TRANSCRIPT CONTENT:
${transcriptSection}
${chaptersSection}

COMPREHENSIVE CLINICAL CONTENT EXTRACTION REQUIREMENTS:
1. Analyze the ENTIRE transcript to extract EVERYTHING a doctor needs to know for clinical practice

2. Extract ALL CLINICAL PRESENTATIONS:
   * What conditions do patients present with?
   * What are the different clinical scenarios?
   * What signs and symptoms are seen?
   * What physical examination findings are present?
   * What are the different types/variants of conditions?
   * What are the clinical presentations in different patient populations?

3. Extract COMPLETE DIAGNOSTIC INFORMATION:
   * How to diagnose each condition (step-by-step diagnostic approach)
   * What diagnostic criteria are used?
   * What laboratory tests are needed? What do abnormal values indicate?
   * What imaging studies are indicated? What findings are significant?
   * What is the differential diagnosis? How to distinguish between conditions?
   * What are the diagnostic algorithms and workup protocols?
   * What are the diagnostic pitfalls to avoid?

4. Extract ALL TREATMENT INFORMATION:
   * What are the treatment options and protocols?
   * What medications are used? At what dosages? For how long?
   * What are the first-line treatments? Second-line? Alternatives?
   * What are the treatment algorithms and decision trees?
   * How to choose between treatment options?
   * How to monitor treatment response?
   * What are the treatment contraindications and precautions?

5. Extract ALL COMPLICATION INFORMATION:
   * What complications can occur with these conditions?
   * What complications can occur with treatments?
   * What are the potential adverse outcomes?
   * What should doctors watch for and monitor?
   * How to prevent complications?
   * How to recognize complications early?
   * How to manage complications when they occur?

6. Extract COMPLETE MANAGEMENT INFORMATION:
   * How to manage patients acutely?
   * How to manage patients long-term?
   * What monitoring is needed? How often?
   * What follow-up care is required?
   * When to admit? When to discharge?
   * When to refer to specialists?
   * What are the discharge criteria?
   * What are the management protocols for different scenarios?

7. Extract CLINICAL PEARLS:
   * Important clinical pearls and practice points
   * Common pitfalls to avoid
   * Evidence-based recommendations
   * Key takeaway points for clinical practice

8. SYNTHESIZE deeply - extract comprehensive medical knowledge, not the conversation
9. SUPPLEMENT with reputable medical knowledge: You may supplement clinical content with established medical knowledge from reputable sources on the topic (e.g., volume disorders, hypovolemia, hypervolemia)
10. ABSOLUTELY REMOVE ALL NAMES - ZERO TOLERANCE: speaker names, host names, doctor names, guest names, "Zach", "Ninja", ANY names whatsoever
11. ABSOLUTELY REMOVE ALL PODCAST/PLATFORM REFERENCES - ZERO TOLERANCE: "podcast", "Ninja Nerd Podcast", "video podcast", "YouTube", "every Friday", "keep updated", any platform references
12. ABSOLUTELY REMOVE ALL CONVERSATIONAL ELEMENTS: "we", "I", "he says", "she says", "they said", "the host said", "I would", "I'm going to", dialogue markers, casual language
13. ABSOLUTELY REMOVE ALL NON-CLINICAL CONTENT: greetings, thank yous, send-offs, podcast announcements, "we're doing", "we have finished", any non-medical content
14. REMOVE vague statements - must be specific: "I'm going to fix complications" → "Complications are managed by [specific approach]"
15. Each slide covers ONE DISTINCT clinical topic - ensure comprehensive coverage
16. Organize slides logically: clinical presentations → pathophysiology → diagnosis → treatment → complications → management
17. Include ONLY clinically relevant content: conditions, presentations, diagnoses, treatments, complications, management
18. Make each slide DISTINCT and comprehensive - cover all aspects of each clinical topic
19. REMOVE any slides that are greetings, thank yous, announcements, or non-clinical content

COMPREHENSIVE MEDICAL EDUCATION SLIDE STRUCTURE (${estimatedSlides} slides total):

🚨 ABSOLUTE PROHIBITION - THESE EXACT SLIDES ARE FORBIDDEN, DO NOT CREATE THEM:
❌ Title: "The Ninja Nerd Podcast is launching a video podcast on clinical medicine"
   Bullets: "Welcome back to the Ninja Nerd Podcast", "We are doing a video podcast"
   → FORBIDDEN: Contains podcast name, conversational "we", non-clinical announcement
   → ACTION: SKIP THIS ENTIRELY, DO NOT CREATE THIS SLIDE

❌ Title: "We're working on volume disorders because we're doing it for YouTube"
   → FORBIDDEN: Contains "we", "YouTube", non-clinical reason
   → ACTION: SKIP THIS ENTIRELY, DO NOT CREATE THIS SLIDE

❌ Title: "Zachary: What are some common complications of hypovolemia"
   Bullets: "Zachary: What are some common complications", "He says the GI losses..."
   → FORBIDDEN: Contains name "Zachary", "He says"
   → ACTION: SKIP THIS ENTIRELY, extract only: "Complications of Hypovolemia" with clinical content

❌ Title: "What fluid would you administer to a patient with acute kidney injury"
   Bullets: "I would give her maybe 1 to 2 liters", "I'm going to fix the complications"
   → FORBIDDEN: Contains "I", vague "I'm going to fix"
   → ACTION: REWRITE as: "Fluid Management for Acute Kidney Injury" with specific protocols

❌ Title: "We have finished our very first video podcast"
   Bullets: "Every Friday we'll release a podcast", "Keep updated on YouTube"
   → FORBIDDEN: Contains "we", "podcast", "YouTube", announcement
   → ACTION: SKIP THIS ENTIRELY, DO NOT CREATE THIS SLIDE

❌ Title: "Zach: Well, Ninja, thank you guys for listening to this podcast"
   Bullets: "So, Zach, give us our classic send off", "Well, Ninja, thank you guys..."
   → FORBIDDEN: Contains names, thank you, send-off
   → ACTION: SKIP THIS ENTIRELY, DO NOT CREATE THIS SLIDE

❌ Title: "Summary and Key Takeaways"
   Bullets: "So, Zach, give us our classic send off. Well, Ninja, thank you guys..."
   → FORBIDDEN: Contains names, thank you, send-off in summary
   → ACTION: SKIP THIS ENTIRELY, create proper clinical summary instead

❌ Any slide with "Zach", "Zachary", "Ninja" in title or bullets → SKIP ENTIRELY
❌ Any slide mentioning "podcast", "YouTube", "video podcast" → SKIP ENTIRELY
❌ Any slide that is a greeting, thank you, or announcement → SKIP ENTIRELY

✅ ONLY CREATE SLIDES FOR PURE CLINICAL CONTENT:
1. Title Slide (1 slide): Medical topic title ONLY (e.g., "Volume Disorders: Comprehensive Clinical Guide")
   - Extract the medical topic from the content
   - DO NOT include podcast names, host names, or any names
   - DO NOT mention platforms or announcements
2. Overview/Introduction (1 slide): Medical topic overview, scope of conditions covered
   - Focus ONLY on the medical content discussed
   - DO NOT mention "we're doing this for YouTube" or any platform references
3. Main Medical Content Slides (${estimatedSlides - 3} slides minimum) - MUST INCLUDE ALL CLINICAL ASPECTS:
   
   CLINICAL PRESENTATIONS (Multiple slides):
   - What conditions/clinical presentations do patients present with?
   - What are the different clinical scenarios and patient presentations?
   - What signs and symptoms do patients exhibit?
   - What physical examination findings are present?
   - What are the different types/variants of the condition?
   
   PATHOPHYSIOLOGY (Multiple slides):
   - What causes these conditions?
   - What are the underlying mechanisms?
   - What are the pathophysiological processes?
   
   DIAGNOSTIC APPROACH (Multiple slides):
   - How to diagnose these conditions (comprehensive diagnostic workup)
   - What diagnostic criteria are used?
   - What laboratory tests are needed and what do they show?
   - What imaging studies are indicated?
   - What is the differential diagnosis?
   - What are the diagnostic algorithms/workup protocols?
   - How to distinguish between different conditions?
   
   TREATMENT PLANS (Multiple slides):
   - What are the treatment options and protocols?
   - What medications are used and at what dosages?
   - What are the treatment algorithms?
   - What are the first-line treatments?
   - What are the second-line or alternative treatments?
   - What are the treatment strategies for different scenarios?
   - How to monitor treatment response?
   
   COMPLICATIONS (Multiple slides):
   - What complications can occur?
   - What are the potential adverse outcomes?
   - What should doctors watch for?
   - How to prevent complications?
   - How to manage complications when they occur?
   
   MANAGEMENT AND FOLLOW-UP (Multiple slides):
   - How to manage patients long-term?
   - What monitoring is needed?
   - What follow-up care is required?
   - When to refer to specialists?
   - What are the discharge criteria?
   - What are the management protocols?
   
   CLINICAL PEARLS AND PRACTICE POINTS (Multiple slides):
   - Important clinical pearls
   - Common pitfalls to avoid
   - Practice recommendations
   - Evidence-based guidelines
   - Key takeaway points for clinical practice
   
4. Summary/Key Takeaways (1 slide): Most important clinical points, essential practice recommendations

CRITICAL: Extract EVERYTHING a doctor needs to know:
- All conditions and clinical presentations discussed
- Complete diagnostic approaches and workups
- All treatment plans, protocols, and medications
- All complications and how to manage them
- Complete management strategies
- Everything clinically relevant for patient care

CRITICAL: Each slide must be UNIQUE, COHERENT, and ACTIONABLE:
- Each slide covers a DISTINCT medical topic - ensure NO duplicates or near-duplicates
- All bullets on a slide relate to the slide's main medical topic
- Bullets build on each other to explain the complete medical concept
- Don't mix unrelated medical topics on the same slide
- Ensure the slide title accurately reflects the DISTINCT medical content
- Each slide should provide actionable medical knowledge: what to know, what to look for, how to diagnose, how to treat, how to manage
- Focus on clinical utility: information doctors can use in practice

For EACH slide, provide COMPREHENSIVE CLINICAL EDUCATION content - SYNTHESIZED and ACTIONABLE:
- Title: Clear, DISTINCT clinical topic title focusing on what doctors need to know
  * Examples: 
    - "Clinical Presentations of Volume Depletion"
    - "Diagnostic Workup for Volume Disorders"
    - "Treatment Protocols for Volume Overload"
    - "Complications of Volume Disorders"
    - "Management Strategies for Volume Depletion"
  * Use medical terminology - focus on clinical aspect (presentation, diagnosis, treatment, complications, management)
  * Professional medical education format
  * Ensure title is UNIQUE and describes the specific clinical content
- Bullets: 4-8 COMPREHENSIVE, ACTIONABLE clinical bullet points - DEEP SYNTHESIS from the discussion
  * CRITICAL: Each bullet must be a SINGLE, DISTINCT sentence or point
  * Do NOT combine multiple sentences into one bullet - each bullet should be separate
  * Each bullet should start on a new line and cover ONE specific clinical point
  * Avoid repetition - each bullet should add unique information
  * Keep bullets focused and distinct from each other
  * Extract COMPREHENSIVE CLINICAL KNOWLEDGE covering ALL aspects:
    - CLINICAL PRESENTATIONS: What conditions patients present with, signs, symptoms, physical findings, clinical scenarios
    - DIAGNOSIS: How to diagnose (complete workup, diagnostic criteria, tests, algorithms, differential diagnosis)
    - TREATMENT: Treatment plans, protocols, medications, dosages, algorithms, monitoring
    - COMPLICATIONS: What complications occur, how to recognize them, how to prevent them, how to manage them
    - MANAGEMENT: How to manage patients, monitoring, follow-up, when to refer, discharge criteria
  * SYNTHESIZE deeply - transform spoken medical discussion into comprehensive, actionable clinical knowledge
  * SUPPLEMENT with reputable medical knowledge when appropriate to provide complete clinical information
  * ABSOLUTELY NO NAMES - ZERO TOLERANCE: NO speaker names, NO host names, NO doctor names, NO guest names, NO "Zach", NO "Ninja", NO ANY names
  * ABSOLUTELY NO PODCAST/PLATFORM REFERENCES - ZERO TOLERANCE: NO "podcast", NO "YouTube", NO "video podcast", NO platform mentions
  * ABSOLUTELY NO CONVERSATIONAL ELEMENTS: NO "we", NO "I", NO "he says", NO "she says", NO "I would", NO "I'm going to", NO dialogue markers
  * Use third-person, professional medical language: "Patients present with..." NOT "We see patients with..." or "I would give..."
  * Structure as comprehensive clinical education: clear, actionable, professional medical language
  * Be SPECIFIC: "Complications are managed by [specific approach]" NOT "I'm going to fix complications"
  * Example of EXCELLENT clinical slide (comprehensive, actionable):
    Title: "Clinical Presentations of Volume Depletion"
    Bullets:
    - "Patients present with orthostatic hypotension (drop >20 mmHg systolic or >10 mmHg diastolic), tachycardia, and dizziness"
    - "Physical examination reveals decreased skin turgor, dry mucous membranes, and sunken eyes"
    - "Severe cases demonstrate altered mental status, oliguria (<400 mL/day), and signs of hypovolemic shock"
    - "Elderly patients may present atypically with falls, confusion, or functional decline"
    - "Children may present with irritability, decreased urine output, and absence of tears when crying"
  * Example of EXCELLENT treatment slide:
    Title: "Treatment Protocol for Volume Depletion"
    Bullets:
    - "Initial management: IV normal saline bolus 500-1000 mL over 30-60 minutes, reassess hemodynamics"
    - "For ongoing losses: replace with appropriate fluid (normal saline for isotonic losses, half-normal saline for hypertonic losses)"
    - "Monitor urine output (target >0.5 mL/kg/hr), blood pressure, heart rate, and mental status"
    - "Correct electrolyte abnormalities: replace potassium if <3.5 mEq/L, correct acid-base disturbances"
    - "Address underlying cause: discontinue diuretics if appropriate, treat GI losses, manage third-spacing"
  * Example of BAD slide (includes names, podcast references, conversational) - DO NOT CREATE THESE:
    Title: "The Ninja Nerd Podcast is launching a video podcast"
    Bullets:
    - "Welcome back to the Ninja Nerd Podcast"
    - "We are doing a video podcast"
    - "We're going to keep doing more podcast episodes"
    ❌ REJECT THIS - Contains podcast name, conversational "we", non-clinical content
    
    Title: "Zach: What fluid would you give"
    Bullets:
    - "I would give her maybe 1 to 2 liters of normal saline"
    - "I'm going to fix the complications"
    - "Then I would step back and put them on maintenance fluid"
    ❌ REJECT THIS - Contains name "Zach", conversational "I", vague "I'm going to fix"
    
    Title: "We have finished our very first video podcast"
    Bullets:
    - "Every Friday we'll release a podcast"
    - "Keep updated on YouTube"
    ❌ REJECT THIS - Contains "we", "podcast", "YouTube", non-clinical announcement
    
    Title: "Zach: Well, Ninja, thank you guys for listening"
    Bullets:
    - "So, Zach, give us our classic send off"
    - "Well, Ninja, thank you guys so much"
    ❌ REJECT THIS - Contains names, thank you, send-off, non-clinical content
    
  * Example of GOOD slide (clinical, specific, no names) - CREATE THESE:
    Title: "Fluid Management for Acute Kidney Injury"
    Bullets:
    - "Initial fluid resuscitation: 1-2 liters normal saline or lactated Ringer's solution"
    - "Complications are managed by correcting volume status: improve blood pressure and reduce tachycardia through fluid replacement"
    - "After initial resuscitation, transition to maintenance fluids based on ongoing losses and electrolyte needs"
    ✅ ACCEPT THIS - Pure clinical content, third-person, specific, actionable
    
    Title: "Clinical Presentation of Hypovolemia"
    Bullets:
    - "Patients present with orthostatic hypotension, tachycardia, and signs of dehydration"
    - "Physical examination reveals decreased skin turgor, dry mucous membranes, and sunken eyes"
    - "Common causes include GI losses (diarrhea, vomiting), renal losses, third-spacing, or inadequate intake"
    ✅ ACCEPT THIS - Clinical content only, no names, no conversational elements
  * Example of EXCELLENT complications slide:
    Title: "Complications of Volume Disorders"
    Bullets:
    - "Acute kidney injury: monitor creatinine and BUN, may require renal replacement therapy if severe"
    - "Electrolyte imbalances: hyponatremia, hypernatremia, hypokalemia can cause cardiac arrhythmias"
    - "Hypovolemic shock: requires aggressive fluid resuscitation and vasopressor support if unresponsive"
    - "Cerebral edema: can occur with rapid correction of hypernatremia, correct sodium slowly (<0.5 mEq/L/hr)"
  * MANDATORY VALIDATION CHECKLIST - Before creating EACH slide, you MUST verify:
    1. Does the title contain ANY names (Zach, Zachary, Ninja, any name)? 
       → If YES: REJECT THIS SLIDE ENTIRELY, DO NOT CREATE IT
    2. Does the title mention podcast/YouTube/platform/announcement?
       → If YES: REJECT THIS SLIDE ENTIRELY, DO NOT CREATE IT
    3. Is this slide a greeting, thank you, send-off, or announcement?
       → If YES: REJECT THIS SLIDE ENTIRELY, DO NOT CREATE IT
    4. Do bullets contain ANY names (Zach, Zachary, Ninja, any name)?
       → If YES: DELETE the name, rewrite the bullet without the name
    5. Do bullets mention podcast/YouTube/platform?
       → If YES: DELETE the reference, rewrite the bullet without it
    6. Do bullets use "we", "I", "he says", "they said", "the host said"?
       → If YES: REWRITE in third-person ("Patients present..." NOT "We see patients...")
    7. Are bullets vague ("I'm going to fix", "a lot of things")?
       → If YES: Make specific ("Complications are managed by correcting volume status...")
    8. Does the slide contain conversational banter or non-medical content?
       → If YES: REJECT THIS SLIDE ENTIRELY, DO NOT CREATE IT
    
    ⚠️ IF ANY CHECK FAILS → DO NOT CREATE THE SLIDE, SKIP IT ENTIRELY
  
  * NEVER include ANY names - ZERO tolerance (scan every word for names: Zach, Zachary, Ninja, any names)
  * NEVER mention podcast, YouTube, or any platform - ZERO tolerance
  * NEVER use conversational language ("we", "I", "he says", "they said") - use third-person professional language
  * NEVER include vague statements - must be specific and actionable
  * NEVER include non-clinical content (greetings, thank yous, announcements, send-offs)
  * NEVER copy word-for-word from transcript - always synthesize into comprehensive clinical education format
  * ALWAYS use third-person, professional medical language ("Patients present..." NOT "We see patients...")
  * ALWAYS be specific: explain HOW, not just WHAT ("Complications are managed by correcting volume status..." NOT "I'm going to fix complications")
  * ALWAYS filter out non-clinical content BEFORE creating slides
  * Ensure bullets provide COMPLETE clinical knowledge: conditions, presentations, diagnoses, treatments, complications, management
  * Cover EVERYTHING a doctor needs to know for clinical practice
  * REMOVE any slides that are greetings, thank yous, announcements, or non-clinical - DO NOT CREATE THEM
- Notes: Clinical education speaker notes (2-4 sentences):
  * Clinical importance and when to use this information
  * How this connects to other medical topics in the presentation
  * Additional clinical pearls or practice recommendations
  * Key points for clinical decision-making
- Visual Hint: Medical/clinical icon suggestion relevant to the medical topic
- Layout: Suggested layout (title, bullets, quote, or two-column)

DEEP MEDICAL CONTENT EXTRACTION AND SYNTHESIS RULES:
- Read through the ENTIRE transcript to identify ALL medical conditions, problems, diagnostic approaches, treatments, and management strategies
- DIVE DEEP into MEDICAL CONTENT - extract comprehensive medical knowledge:
  * What medical conditions/problems are discussed
  * Pathophysiology and disease mechanisms
  * Clinical presentations: what to look for (signs, symptoms, physical exam findings, clinical features)
  * Diagnostic approaches: how to diagnose (diagnostic criteria, differential diagnosis, diagnostic tests, workup algorithms)
  * Treatment protocols: how to treat (treatment algorithms, medications, dosages, interventions, treatment strategies)
  * Management strategies: how to manage patients (monitoring, follow-up, clinical decision-making, management plans)
  * Clinical pearls: practice recommendations, important clinical points, evidence-based guidelines
- SYNTHESIZE deeply - extract the medical knowledge and structure it for clinical practice
- ABSOLUTELY REMOVE ALL NAMES - ZERO TOLERANCE:
  * NO speaker names, NO host names, NO doctor names, NO guest names, NO "Zach", NO "Zachary", NO "Ninja", NO ANY names
  * ACTIVELY scan every word in every bullet point and DELETE any name references
  * If you see "Zach:" or "Zachary:" in transcript → DELETE the name, extract only the clinical content
  * If you see "Ninja" in transcript → DELETE it, extract only the clinical content
- REMOVE all conversational elements:
  * Dialogue markers ("he said", "she mentioned", "they discussed", "the host said")
  * Filler words and casual language ("um", "you know", "like", "sort of")
  * Conversational transitions ("so", "well", "you know what I mean")
- Extract ACTIONABLE MEDICAL KNOWLEDGE:
  * Specific diagnostic criteria and how to apply them
  * Treatment protocols with specific details (medications, dosages, algorithms)
  * Management strategies with specific steps and decision points
  * Clinical signs and symptoms to look for
  * What to do in specific clinical scenarios
- Group related MEDICAL CONCEPTS together - organize by medical topic, not conversation flow
- Use professional medical terminology - transform casual discussion into formal medical education language
- If medical statistics, data, or protocols are mentioned, extract and synthesize into actionable format
- If medical processes or protocols are described, extract ALL steps and synthesize into clear clinical format
- If clinical examples or cases are given, synthesize into educational format (remove ALL name references)
- ACTIVELY TRANSFORM spoken medical discussion into polished, actionable medical education format:
  * If you see "Zach:" or "Zachary:" → DELETE the name, extract only the medical content
  * If you see "The Ninja Nerd Podcast is launching..." → SKIP THIS ENTIRELY, DO NOT CREATE A SLIDE
  * If you see "We're doing a video podcast" → SKIP THIS ENTIRELY, DO NOT CREATE A SLIDE
  * If you see "We have finished our very first video podcast" → SKIP THIS ENTIRELY, DO NOT CREATE A SLIDE
  * If you see "Zach: Well, Ninja, thank you guys" → SKIP THIS ENTIRELY, DO NOT CREATE A SLIDE
  * Transform conversational: "I would give her 1-2 liters" → "Initial fluid resuscitation: 1-2 liters normal saline"
  * Transform conversational: "I'm going to fix complications" → "Complications are managed by correcting volume status through fluid replacement and electrolyte correction"
  * Transform conversational: "We get vitals, physical exam, and lab findings" → "Clinical Assessment: Vital Signs, Physical Examination, and Laboratory Findings"
  * Transform conversational: "He says GI losses are the cause" → "GI losses are a common cause of hypovolemia"
- Ensure each slide covers ONE DISTINCT MEDICAL TOPIC - ensure NO duplicates or near-duplicates
- Structure slides for clinical practice: condition → pathophysiology → clinical presentation → diagnosis → treatment → management
- Focus on what doctors need to know: how to diagnose, how to treat, how to manage, what to look for
- BEFORE creating each slide, ask these questions:
  1. "Does this section contain names, podcast references, or non-clinical content?"
  2. "Is this a greeting, thank you, or announcement?"
  3. "Can I extract pure clinical content from this?"
  → If questions 1 or 2 are YES → DO NOT CREATE THE SLIDE, SKIP IT ENTIRELY
  → If question 3 is NO → DO NOT CREATE THE SLIDE, SKIP IT ENTIRELY

COMPREHENSIVE CLINICAL EDUCATION QUALITY STANDARDS:
- Each slide must be COHERENT, CLINICALLY COMPREHENSIVE, and structured for professional medical practice
- Every slide covers ONE complete CLINICAL TOPIC - all bullets relate to that clinical aspect
- Bullets work together to provide COMPLETE clinical information - structured for medical practice
- SYNTHESIZE comprehensively - extract ALL clinical information: presentations, diagnoses, treatments, complications, management
- SUPPLEMENT with reputable medical knowledge when appropriate to provide complete clinical information
- ABSOLUTELY REMOVE - ZERO TOLERANCE:
  * ANY names: speaker names, host names, doctor names, guest names, "Zach", "Ninja", ANY names whatsoever
  * ANY podcast/platform references: "podcast", "YouTube", "video podcast", "every Friday", "keep updated", ANY platform mentions
  * ANY conversational elements: "we", "I", "he says", "she says", "they said", "I would", "I'm going to", dialogue markers
  * ANY non-clinical content: greetings, thank yous, send-offs, podcast announcements, "we're doing", "we have finished"
  * ANY vague statements: must be specific and actionable
- Focus on COMPREHENSIVE CLINICAL CONTENT ONLY:
  * Clinical presentations: what conditions patients present with, signs, symptoms, physical findings
  * Diagnostic approaches: how to diagnose, complete workups, diagnostic criteria, tests, algorithms
  * Treatment plans: protocols, medications, dosages, algorithms, monitoring
  * Complications: what can go wrong, how to recognize, prevent, and manage
  * Management: how to manage patients, monitoring, follow-up, referrals, discharge
- Use third-person, professional medical language throughout
- Structure information clearly for clinical practice - group related clinical concepts together
- Include ALL important clinical information: conditions, presentations, diagnostic workups, treatment protocols, complications, management strategies
- Ensure COMPREHENSIVE coverage - extract EVERYTHING a doctor needs to know for patient care
- Make bullets substantial and clinically actionable - doctors should be able to use this information in practice
- Include specific clinical facts: diagnostic criteria, treatment protocols, medication dosages, monitoring parameters, complication recognition
- Be SPECIFIC: explain HOW to manage complications, not just "I'm going to fix them"
- Use professional medical terminology and formal medical education language
- NEVER include speaker names or conversational references - ZERO tolerance
- NEVER mention podcast, YouTube, or any platform - ZERO tolerance
- NEVER use conversational language - use third-person professional language
- NEVER copy word-for-word - always synthesize into comprehensive clinical education format
- NEVER create generic placeholder content - extract real comprehensive clinical content from the transcript
- NEVER mix unrelated clinical topics on one slide - organize by clinical concept
- NEVER include non-clinical slides - remove greetings, thank yous, announcements
- Ensure slides flow logically: clinical presentations → pathophysiology → diagnosis → treatment → complications → management
- Each slide should be understandable on its own as a comprehensive clinical resource
- The deck should provide COMPLETE clinical education covering ALL aspects: presentations, diagnoses, treatments, complications, management
- The deck should be exportable to PowerPoint and ready for comprehensive medical education presentation
- Cover EVERYTHING a doctor would do: recognize presentations, diagnose conditions, treat patients, prevent/manage complications, manage patients

🚨 FINAL VALIDATION - MANDATORY BEFORE FINALIZING:
Go through EVERY slide and check:

FOR EACH SLIDE TITLE:
- Contains "Zach", "Zachary", "Ninja", or any name? → DELETE THIS SLIDE
- Contains "podcast", "YouTube", "video podcast", "we're doing"? → DELETE THIS SLIDE
- Is it a greeting, thank you, or announcement? → DELETE THIS SLIDE
- Contains "we're launching", "we have finished", "welcome back"? → DELETE THIS SLIDE

FOR EACH BULLET POINT:
- Contains "Zach", "Zachary", "Ninja", or any name? → DELETE that bullet, rewrite without name
- Contains "podcast", "YouTube", "every Friday"? → DELETE that bullet, rewrite without reference
- Contains "we", "I", "he says", "they said"? → REWRITE in third-person
- Contains "I'm going to fix" or vague statements? → REWRITE to be specific
- Contains "welcome back", "thank you", "send off"? → DELETE that bullet

FINAL CHECKLIST:
✅ NO slides contain names
✅ NO slides mention podcast/YouTube/platform
✅ NO slides are greetings, thank yous, or announcements
✅ ALL slides contain ONLY clinical medical content
✅ ALL language is third-person professional medical language
✅ ALL content is specific and actionable

IF ANY SLIDE FAILS THESE CHECKS → DELETE IT IMMEDIATELY

Provide a comprehensive narrative summary (3-4 sentences) describing:
- The overall flow and structure of the deck
- How the clinical content is organized
- What medical professionals will learn
- The presentation's key clinical themes and takeaways`;
}

/**
 * Generates a simple slide deck outline using OpenAI's structured outputs.
 * Falls back to a basic outline if the API call fails.
 */
export async function generatePowerPoint(
  step: typeof InngestStep,
  transcript: TranscriptWithExtras,
  sourceType: "audio" | "document",
  userApiKey?: string,
): Promise<PowerPoint> {
  console.log("Generating PowerPoint slides with GPT");

  try {
    const createCompletion = createBoundCompletion(userApiKey);

    const response = (await step.ai.wrap(
      "generate-powerpoint-with-gpt",
      createCompletion,
      {
        model: "gpt-4o",
        messages: [
          { role: "system", content: POWERPOINT_SYSTEM_PROMPT },
          {
            role: "user",
            content: buildPowerPointPrompt(transcript, sourceType),
          },
        ],
        response_format: zodResponseFormat(powerPointSchema, "powerPoint"),
      },
    )) as OpenAI.Chat.Completions.ChatCompletion;

    const content = response.choices[0]?.message?.content;
    let powerpoint = content
      ? powerPointSchema.parse(JSON.parse(content))
      : fallbackPowerPoint(transcript);

    // POST-PROCESSING: Filter out slides with forbidden content
    powerpoint = filterForbiddenContent(powerpoint);

    return powerpoint;
  } catch (error) {
    console.error("GPT PowerPoint generation error:", error);
    const fallback = fallbackPowerPoint(transcript);
    // Apply filter to fallback as well
    return filterForbiddenContent(fallback);
  }
}

/**
 * Filters out slides containing forbidden content (names, podcast references, non-clinical content)
 * This is a CODE-LEVEL filter that removes bad slides regardless of what AI generates
 */
function filterForbiddenContent(powerpoint: PowerPoint): PowerPoint {
  const forbiddenTitlePatterns = [
    /\b(Zach|Zachary|Ninja|Zach Romere)\b/gi,
    /\b(podcast|video podcast|Ninja Nerd Podcast)\b/gi,
    /\b(YouTube|every Friday|keep updated|release a podcast)\b/gi,
    /\b(we're doing|we have finished|we're launching|we're working on)\b/gi,
    /\b(welcome back|thank you|send off|until next time)\b/gi,
  ];

  // Filter slides - CODE-LEVEL FILTERING
  const filteredSlides = powerpoint.slides
    .map((slide) => {
      // Clean title first
      let cleanedTitle = slide.title || "";
      
      // Remove names from title
      cleanedTitle = cleanedTitle.replace(/\b(Zach|Zachary|Ninja|Zach Romere):\s*/gi, "");
      cleanedTitle = cleanedTitle.replace(/\b(Zach|Zachary|Ninja|Zach Romere)\b/gi, "");
      
      // Remove podcast/platform references from title
      cleanedTitle = cleanedTitle.replace(/\b(podcast|video podcast|Ninja Nerd Podcast|YouTube|every Friday)\b/gi, "");
      
      // Transform conversational titles
      cleanedTitle = cleanedTitle.replace(/\bwe're (working on|doing)\b/gi, "");
      cleanedTitle = cleanedTitle.replace(/\bwe have finished\b/gi, "");
      cleanedTitle = cleanedTitle.replace(/\bwe're launching\b/gi, "");
      
      // Clean up title
      cleanedTitle = cleanedTitle.replace(/\s+/g, " ").trim();
      cleanedTitle = cleanedTitle.replace(/^[.,\s]+|[.,\s]+$/g, "");
      
      // Return a new slide object with cleaned title
      return {
        ...slide,
        title: cleanedTitle,
      };
    })
    .filter((slide) => {
      const titleLower = slide.title.toLowerCase();
      
      // Check title for ANY forbidden content - if found, REMOVE ENTIRE SLIDE
      const hasForbiddenTitle = forbiddenTitlePatterns.some((pattern) =>
        pattern.test(slide.title),
      );

      if (hasForbiddenTitle) {
        console.log(`[FILTERED] Removed slide with forbidden title: "${slide.title}"`);
        return false;
      }

      // Additional checks for common forbidden patterns
      if (
        titleLower.includes("zach") ||
        titleLower.includes("zachary") ||
        titleLower.includes("ninja") ||
        titleLower.includes("podcast") ||
        titleLower.includes("youtube") ||
        titleLower.includes("video podcast") ||
        titleLower.includes("episode") ||
        titleLower.includes("brand new") ||
        titleLower.includes("new episode") ||
        titleLower.includes("today we") ||
        titleLower.includes("we have") ||
        titleLower.includes("welcome") ||
        titleLower.includes("thank you") ||
        titleLower.includes("send off") ||
        titleLower.includes("we're doing") ||
        titleLower.includes("we have finished") ||
        titleLower.includes("we're launching") ||
        titleLower.includes("we're working on") ||
        titleLower.startsWith("zach") ||
        titleLower.startsWith("zachary") ||
        titleLower === "" ||
        titleLower.length < 5
      ) {
        console.log(`[FILTERED] Removed non-clinical slide: "${slide.title}"`);
        return false;
      }
      
      return true;
    })
    .map((slide) => {
      // Filter and clean bullets - CODE-LEVEL FILTERING WITH TRANSFORMATION
      // First, split any bullets that contain multiple sentences (separated by periods, semicolons, or newlines)
      const splitBullets = slide.bullets.flatMap((bullet) => {
        // Skip if bullet is clearly non-clinical or a fragment
        const bulletLower = bullet.toLowerCase().trim();
        if (bulletLower.length < 10 || 
            bulletLower.startsWith("'") || 
            bulletLower.startsWith("ng ") ||
            bulletLower.startsWith("'s ") ||
            bulletLower.startsWith("'re ") ||
            bulletLower.startsWith("'ve ")) {
          return []; // Skip fragments
        }
        
        // Split on periods followed by space and capital letter (new sentence)
        // But preserve abbreviations like "Dr.", "e.g.", "i.e.", etc.
        const sentences = bullet
          .split(/(?<=[.!?])\s+(?=[A-Z])/)
          .map(s => s.trim())
          .filter(s => s.length > 10 && !s.startsWith("'") && !s.startsWith("ng ")); // Filter out fragments
        
        // If bullet was already a single sentence, return as-is
        if (sentences.length <= 1) {
          return [bullet];
        }
        
        // Otherwise, split into separate bullets
        return sentences;
      });
      
      const cleanedBullets = splitBullets
        .map((bullet) => {
          let cleaned = bullet;
          
          // Skip bullets that are clearly non-clinical (greetings, thank yous, announcements)
          const cleanedLower = cleaned.toLowerCase();
          if (
            cleanedLower.includes("welcome back") ||
            cleanedLower.includes("thank you") ||
            cleanedLower.includes("send off") ||
            cleanedLower.includes("we have finished") ||
            cleanedLower.includes("we're doing a video podcast") ||
            cleanedLower.includes("every friday we'll") ||
            cleanedLower.includes("keep updated on youtube") ||
            cleanedLower.includes("until next time") ||
            cleanedLower.includes("i love you")
          ) {
            return null; // Mark for removal
          }
          
          // Remove names (with colon and without)
          cleaned = cleaned.replace(/\b(Zach|Zachary|Ninja|Zach Romere):\s*/gi, "");
          cleaned = cleaned.replace(/\b(Zach|Zachary|Ninja|Zach Romere)\b/gi, "");
          
          // Remove podcast/platform references
          cleaned = cleaned.replace(/\b(podcast|video podcast|Ninja Nerd Podcast|YouTube|every Friday|keep updated|release a podcast)\b/gi, "");
          
          // Transform conversational elements to third-person
          cleaned = cleaned.replace(/\bI would give (her|him|them|the patient)\b/gi, "Initial fluid resuscitation:");
          cleaned = cleaned.replace(/\bI'm going to fix (the|these|those)\b/gi, "Management of");
          cleaned = cleaned.replace(/\bI will\b/gi, "");
          cleaned = cleaned.replace(/\b(I hope|I think|I was like)\b/gi, "");
          
          // Remove dialogue markers
          cleaned = cleaned.replace(/\b(he says|she says|they said|the host said|he said|she said)\b/gi, "");
          
          // Transform "we" statements
          cleaned = cleaned.replace(/\bwe get (vitals|physical exam|lab findings)\b/gi, "Clinical assessment includes: $1");
          cleaned = cleaned.replace(/\bwe're (working on|doing)\b/gi, "");
          cleaned = cleaned.replace(/\b(we|we're|we have|we are)\b/gi, "");
          cleaned = cleaned.replace(/\b(you have to|you'll|you guys)\b/gi, "");
          
          // Remove greetings/thank yous/send-offs
          cleaned = cleaned.replace(/\b(welcome back|thank you|send off|until next time|classic send off|I love you)\b/gi, "");
          
          // Remove vague conversational phrases
          cleaned = cleaned.replace(/\b(the coolest thing|hopefully|kind of|sort of|you know|like)\b/gi, "");
          cleaned = cleaned.replace(/\b(a lot of things|she's got a lot going on|a bunch of)\b/gi, "");
          cleaned = cleaned.replace(/\b(is this pretty common|are we looking at)\b/gi, "");
          
          // Transform specific patterns
          cleaned = cleaned.replace(/\blet's move (right )?into\b/gi, "");
          cleaned = cleaned.replace(/\bso today we're going to\b/gi, "");
          cleaned = cleaned.replace(/\bwhat you'll notice is\b/gi, "");
          
          // Clean up extra spaces and punctuation
          cleaned = cleaned.replace(/\s+/g, " ").trim();
          cleaned = cleaned.replace(/^[.,\s]+|[.,\s]+$/g, ""); // Remove leading/trailing punctuation
          
          return cleaned;
        })
        .filter((bullet) => {
          // Remove null bullets (marked for removal)
          if (!bullet) return false;
          
          // Remove bullets that are now empty or too short
          if (bullet.length < 15) return false;
          
          const bulletTrimmed = bullet.trim();
          const bulletLower = bulletTrimmed.toLowerCase();
          
          // Remove fragments (starting with apostrophes, incomplete words, etc.)
          if (bulletTrimmed.startsWith("'") || 
              bulletTrimmed.startsWith("ng ") ||
              bulletTrimmed.startsWith("'s ") ||
              bulletTrimmed.startsWith("'re ") ||
              bulletTrimmed.startsWith("'ve ") ||
              bulletTrimmed.match(/^[a-z]'/) || // Starts with lowercase letter followed by apostrophe
              (bulletTrimmed.length < 20 && bulletTrimmed.split(' ').length < 3)) { // Very short fragments
            return false;
          }
          
          // Remove non-clinical conversational fragments and jokes
          if (bulletLower.includes("rush hour reference") ||
              bulletLower.includes("for anyone that cares") ||
              bulletLower.includes("that's a ") ||
              bulletLower.includes("but hey") ||
              bulletLower.includes("sister") ||
              bulletLower.includes("drinking beads") ||
              bulletLower.includes("harris stomach") ||
              bulletLower.includes("going pretty well") ||
              bulletLower.includes("been going") ||
              bulletLower.includes("brand new episode") ||
              bulletLower.includes("new episode") ||
              bulletLower.includes("today we have") ||
              bulletLower.includes("today have") ||
              bulletLower.includes("it's been going") ||
              bulletLower.includes("i mean") ||
              bulletLower.includes("brain breasts") ||
              bulletLower.includes("serious not")) {
            return false;
          }
          
          // Check for forbidden content in bullets
          if (
            bulletLower.includes("zach") ||
            bulletLower.includes("zachary") ||
            bulletLower.includes("ninja") ||
            bulletLower.includes("podcast") ||
            bulletLower.includes("youtube") ||
            bulletLower.includes("video podcast") ||
            bulletLower.includes("welcome") ||
            bulletLower.includes("thank you") ||
            bulletLower.includes("send off") ||
            bulletLower.includes("we're doing") ||
            bulletLower.includes("we have finished") ||
            bulletLower.includes("we're launching") ||
            bulletLower.includes("we're working") ||
            bulletLower.includes("every friday") ||
            bulletLower.includes("keep updated") ||
            bulletLower.startsWith("i would") ||
            bulletLower.startsWith("i'm going") ||
            bulletLower.startsWith("he says") ||
            bulletLower.startsWith("we ") ||
            bulletLower.startsWith("so, zach") ||
            bulletLower.startsWith("well, ninja") ||
            bulletLower.includes("episode") ||
            bulletLower.includes("brand new") ||
            bulletLower.includes("today we") ||
            bulletLower.includes("today have")
          ) {
            return false;
          }
          
          return true;
        })
        // Remove duplicate bullets within the same slide
        .filter((bullet, bulletIndex, bulletsArray) => {
          const bulletLower = bullet.toLowerCase();
          // Check if this bullet is too similar to any previous bullet in the same slide
          for (let i = 0; i < bulletIndex; i++) {
            const prevBulletLower = bulletsArray[i].toLowerCase();
            // If bullets are very similar (70% match), remove the duplicate
            if (bulletLower === prevBulletLower ||
                (bulletLower.length > 20 && prevBulletLower.length > 20 &&
                 (bulletLower.includes(prevBulletLower.substring(0, Math.min(prevBulletLower.length, bulletLower.length) * 0.7)) ||
                  prevBulletLower.includes(bulletLower.substring(0, Math.min(bulletLower.length, prevBulletLower.length) * 0.7))))) {
              console.log(`[FILTERED] Removed duplicate bullet in slide "${slide.title}": "${bullet.substring(0, 50)}..."`);
              return false;
            }
          }
          return true;
        });

      // Return null if slide was marked for removal
      if (!slide || typeof slide !== "object") {
        return null;
      }

      // Return a new slide object with cleaned bullets
      return {
        ...slide,
        bullets: cleanedBullets,
      };
    })
    .filter((slide) => {
      // Remove null slides (marked for removal)
      if (!slide || typeof slide !== "object") {
        return false;
      }

      // Ensure slide has required properties
      if (!slide.title || !Array.isArray(slide.bullets)) {
        console.log(`[FILTERED] Removed slide with missing required properties:`, slide);
        return false;
      }
      // Remove slide if it has no valid bullets left or too few bullets
      if (slide.bullets.length === 0 || slide.bullets.length < 2) {
        console.log(`[FILTERED] Removed slide with insufficient valid bullets: "${slide.title}"`);
        return false;
      }

      // Final check: ensure title doesn't contain forbidden content after cleaning
      const finalTitleLower = slide.title.toLowerCase();
      if (
        finalTitleLower.includes("zach") ||
        finalTitleLower.includes("zachary") ||
        finalTitleLower.includes("ninja") ||
        finalTitleLower.includes("podcast") ||
        finalTitleLower.includes("youtube")
      ) {
        console.log(`[FILTERED] Removed slide with forbidden content in title after cleaning: "${slide.title}"`);
        return false;
      }

      return true;
    });

  // Deduplicate slides - remove slides with very similar titles or content
  const deduplicatedSlides = filteredSlides.filter((slide, index, array) => {
    // Check if this slide's title is too similar to any previous slide
    const titleLower = slide.title.toLowerCase();
    for (let i = 0; i < index; i++) {
      const prevTitleLower = array[i].title.toLowerCase();
      // If titles are very similar (80% match), remove the duplicate
      if (titleLower === prevTitleLower || 
          (titleLower.length > 10 && prevTitleLower.length > 10 && 
           (titleLower.includes(prevTitleLower.substring(0, Math.min(prevTitleLower.length, titleLower.length) * 0.8)) ||
            prevTitleLower.includes(titleLower.substring(0, Math.min(titleLower.length, prevTitleLower.length) * 0.8))))) {
        console.log(`[FILTERED] Removed duplicate slide: "${slide.title}" (similar to "${array[i].title}")`);
        return false;
      }
    }
    return true;
  });

  // Final validation: ensure all slides are valid objects
  const validSlides = deduplicatedSlides.filter((slide) => {
    if (!slide || typeof slide !== "object") {
      console.error(`[FILTERED] Found invalid slide (not an object):`, slide);
      return false;
    }
    if (!slide.title || typeof slide.title !== "string") {
      console.error(`[FILTERED] Found slide with invalid title:`, slide);
      return false;
    }
    if (!Array.isArray(slide.bullets)) {
      console.error(`[FILTERED] Found slide with invalid bullets:`, slide);
      return false;
    }
    return true;
  });

  console.log(`[FILTERED] Filtered ${powerpoint.slides.length - validSlides.length} slides (${powerpoint.slides.length - deduplicatedSlides.length} duplicates, ${deduplicatedSlides.length - validSlides.length} invalid). Remaining: ${validSlides.length} slides.`);

  return {
    ...powerpoint,
    slides: validSlides,
  };
}

function fallbackPowerPoint(transcript: TranscriptWithExtras): PowerPoint {
  // Extract real content from transcript for fallback
  const fullText = transcript.text;
  const chapterCount = transcript.chapters?.length || 0;
  const minSlides = Math.max(15, chapterCount * 2 + 5);
  
  // Extract first few sentences for title slide
  const firstSentences = fullText.split(/[.!?]+/).slice(0, 3).join(". ").substring(0, 200);
  const firstChapter = transcript.chapters?.[0];
  
  // Create slides using ACTUAL content from transcript
  const slides = [
    {
      title: firstChapter?.headline || "Presentation Overview",
      bullets: [
        firstChapter?.summary?.substring(0, 150) || firstSentences.substring(0, 150),
        fullText.substring(150, 300) || "Content from the transcript",
        fullText.substring(300, 450) || "Additional information from the source material",
      ].filter(b => b.length > 20), // Only include substantial bullets
      notes: firstChapter?.gist || "Introduction based on the content provided.",
      visualHint: "Title slide with podcast/document icon",
      layout: "title",
    },
  ];

  // Add slides using REAL chapter content if available
  if (chapterCount > 0 && transcript.chapters) {
    transcript.chapters.slice(0, Math.min(15, chapterCount)).forEach((chapter, idx) => {
      const summary = chapter.summary || chapter.gist || "";
      if (summary.length > 50) {
        // Split long summaries into multiple bullets
        const summaryParts = summary.split(/[.!?]+/).filter(s => s.trim().length > 20);
        slides.push({
          title: chapter.headline || `Topic ${idx + 1}`,
          bullets: summaryParts.slice(0, 6).map(s => s.trim()),
          notes: `Content from: ${chapter.headline}`,
          visualHint: "Content icon",
          layout: "bullets",
        });
      }
    });
  } else {
    // Extract content from transcript text by splitting into sections
    const textSections = fullText.split(/\n\n+/).filter(s => s.trim().length > 100);
    textSections.slice(0, Math.min(13, minSlides - 1)).forEach((section, idx) => {
      const sentences = section.split(/[.!?]+/).filter(s => s.trim().length > 30);
      if (sentences.length >= 3) {
        slides.push({
          title: `Section ${idx + 1}`,
          bullets: sentences.slice(0, 6).map(s => s.trim().substring(0, 200)),
          notes: "Content extracted from the transcript.",
          visualHint: "Topic icon",
          layout: "bullets",
        });
      }
    });
  }

  // Add summary slide with real content
  const lastChapter = transcript.chapters?.[transcript.chapters.length - 1];
  if (slides.length < minSlides) {
    slides.push({
      title: "Summary and Key Takeaways",
      bullets: [
        lastChapter?.summary?.substring(0, 150) || fullText.substring(fullText.length - 300, fullText.length - 150),
        fullText.substring(Math.max(0, fullText.length - 150), fullText.length) || "Final thoughts from the content",
      ].filter(b => b && b.length > 20),
      notes: "Summary of the main content covered.",
      visualHint: "Summary icon or checklist",
      layout: "bullets",
    });
  }

  return {
    slides: slides.slice(0, Math.max(15, minSlides)),
    summary:
      fullText.length > 0
        ? `This presentation deck is based on the actual content from the transcript. Each slide contains real information extracted from the source material.`
        : "A presentation deck based on the provided content.",
    theme: "Professional",
  };
}
