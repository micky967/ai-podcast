import type { step as InngestStep } from "inngest";
import type OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { NonRetriableError } from "inngest";
import { createBoundCompletion } from "../../lib/openai-client";
import {
    clinicalScenarioSchema,
    type ClinicalScenarios,
    clinicalScenariosSchema,
} from "../../schemas/ai-outputs";
import type { TranscriptWithExtras } from "../../types/assemblyai";

const GENERATION_MODEL = "gpt-4o";
const VERIFICATION_MODEL = "gpt-4o-mini";

export const clinicalScenariosBatchSchema = z.object({
    scenarios: z
        .array(clinicalScenarioSchema)
        .length(2)
        .describe("Exactly 2 board-style, source-grounded QBank questions"),
});

const verificationResultSchema = z.object({
    sourceQuote: z
        .string()
        .min(1)
        .max(500)
        .nullable()
        .describe(
            "A single exact sentence copied verbatim from the transcript that supports the key medical fact used to justify the correct answer, or null if no exact supporting sentence is found.",
        ),
});

type Input =
    | { contentType: "podcast"; transcript: TranscriptWithExtras; documentText?: never }
    | { contentType: "document"; documentText: string; transcript?: never };

type ExistingScenarioHint = {
    vignette: string;
    question: string;
};

function normalizeText(s: string): string {
    return s
        .toLowerCase()
        .replace(/\s+/g, " ")
        .replace(/[^a-z0-9 ]/g, "")
        .trim();
}

function fingerprintScenario(sc: any): string {
    const parts: string[] = [
        sc?.vignette,
        sc?.question,
        sc?.correctAnswer,
        sc?.sourceReference,
    ].filter(Boolean);
    return normalizeText(parts.join(" | "));
}

function jaccardSimilarity(a: string, b: string): number {
    const aTokens = new Set(a.split(" ").filter(Boolean));
    const bTokens = new Set(b.split(" ").filter(Boolean));

    if (aTokens.size === 0 || bTokens.size === 0) return 0;

    let intersection = 0;
    for (const t of aTokens) {
        if (bTokens.has(t)) intersection += 1;
    }
    const union = aTokens.size + bTokens.size - intersection;
    return union === 0 ? 0 : intersection / union;
}

function maxSimilarityToExisting(
    candidate: any,
    existing: ExistingScenarioHint[] | undefined,
): number {
    if (!existing || existing.length === 0) return 0;
    const candFp = fingerprintScenario(candidate);
    let max = 0;
    for (const ex of existing) {
        const exFp = fingerprintScenario(ex);
        const sim = jaccardSimilarity(candFp, exFp);
        if (sim > max) max = sim;
    }
    return max;
}

function buildClinicalScenariosPrompt(
    input: Input,
    opts: { existing?: ExistingScenarioHint[]; nonce: string; difficulty?: number },
): string {
    const contentPreview =
        input.contentType === "document"
            ? input.documentText.substring(0, 6000)
            : input.transcript.text.substring(0, 4000);

    // State-Based Prompting with XML tags for strict anti-repetition
    const existingBlock =
        opts.existing && opts.existing.length > 0
            ? `\n\n<previously_generated_topics>\n${opts.existing
                .slice(0, 20)
                .map(
                    (s, i) =>
                        `${i + 1}. PRIMARY DIAGNOSIS/MECHANISM: ${s.vignette.substring(0, 100)}...\n   QUESTION TYPE: ${s.question}`,
                )
                .join("\n\n")}\n</previously_generated_topics>\n\nHARD CONSTRAINT - STATE-BASED ANTI-REPETITION:\nIf the <previously_generated_topics> list is NOT EMPTY, you are STRICTLY FORBIDDEN from generating another question on a primary diagnosis or mechanism already mentioned.\n\nYou MUST pivot to:\n- A secondary complication of the condition\n- An advanced diagnostic dilemma\n- A 'Next Best Step' management scenario\n- A rare presentation or sequela\n- A different stage of the disease process\n\nEXAMPLE: If you already asked about 'Acute Pancreatitis Etiology', you MUST now ask about 'Pancreatic Necrosis Recognition', 'ERCP Timing', or 'Chronic Pancreatitis Management'.\n\nRULE: Ensure 20 questions represent a FULL MEDICAL TEXTBOOK progression from initial symptoms to rare long-term complications.`
            : "";

    const difficulty =
        typeof opts.difficulty === "number" ? Math.max(1, Math.min(5, opts.difficulty)) : 3;

    return `Create EXACTLY 2 resident/expert-grade multiple-choice board-style QBank questions based ONLY on the content below.

SEQUENTIAL COMPLEXITY FRAMEWORK (MANDATORY):
You MUST follow this logical clinical flow for EVERY batch, adapting to the specific medical topic in the transcript:

Question 1: PATHOPHYSIOLOGY/ETIOLOGY
- Focus: The "Why" or "What" underlying the condition.
- Examples: mechanism of injury, underlying cause, risk factors, cellular/molecular basis.
- Derive from transcript: If topic is Heart Failure → focus on reduced ejection fraction mechanism; if Pancreatitis → focus on enzyme activation cascade.

Question 2: ACUTE MANAGEMENT/DIAGNOSTICS  
- Focus: The "Next Step" in immediate care.
- Examples: initial lab choice, imaging modality, triage decision, fluid resuscitation, life-saving intervention.
- Derive from transcript: If topic is Sepsis → focus on lactate/blood cultures; if Trauma → focus on FAST exam or massive transfusion protocol.

Question 3: COMPLICATION RECOGNITION
- Focus: "Second-order effects" or sequelae specific to THIS condition.
- Examples: What happens if the condition worsens? What are the common complications?
- Derive from transcript: If topic is COPD → focus on Respiratory Failure or Cor Pulmonale; if Pancreatitis → focus on Pancreatic Necrosis or Pseudocyst; if MI → focus on Cardiogenic Shock or VSD.

Question 4: DEFINITIVE TREATMENT/LONG-TERM CARE
- Focus: The "Gold Standard" or best long-term management.
- Examples: definitive surgical procedure, chronic medication regimen, lifestyle modification, follow-up protocol.
- Derive from transcript: If topic is Appendicitis → focus on Appendectomy; if Diabetes → focus on HbA1c targets and metformin; if Afib → focus on anticoagulation strategy.

CRITICAL REQUIREMENTS:
- STRICT GROUNDING: Every question MUST be answerable using ONLY the provided content excerpt.
- Do NOT introduce diagnoses, drugs, tests, contraindications, or guideline rules that are not explicitly supported by the excerpt.
- If the excerpt does not support a high-quality board question for a specific framework step, choose a different concept within that step that IS supported.
- ADAPTIVE LOGIC: Do NOT hardcode any disease-specific terms. Derive complications and management from the specific transcript topic.
- DIVERSITY (GET SMASHED): DO NOT use Alcohol or Gallstones as the primary etiology unless the excerpt explicitly focuses on them. Rotate etiologies and mechanisms.
- DIVERSITY (GET SMASHED): Prefer rarer or non-obvious causes when supported by the excerpt (e.g., hypertriglyceridemia, medication-induced such as valproate or thiazides, post-ERCP, trauma, autoimmune, hereditary) rather than repeating common causes.
- CLINICAL SETTING VARIETY (MANDATORY): Rotate settings across questions to avoid repetitive narrative structures:
  * Outpatient Clinic (routine visit, follow-up, screening)
  * Emergency Department (acute presentation, triage)
  * Intensive Care Unit (critical illness, ventilator management)
  * Surgical Suite (perioperative, post-op)
  * Inpatient Ward (hospitalized patient, consult)
  * Obstetrics/Labor & Delivery (pregnancy-related)
- VIGNETTE STRUCTURE VARIETY: Avoid starting every vignette with "A [Age]-year-old [sex]...". Use varied openings:
  * "During a routine clinic visit, a [Age]-year-old..."
  * "In the emergency department, you evaluate..."
  * "A hospitalized patient develops..."
  * "Post-operatively, a [Age]-year-old..."
  * "On ICU rounds, you notice..."
- Provide EXACTLY 5 options (A-E). Make distractors plausible.
- Provide a complete explanation:
  - explanation.correct: why the correct answer is right, grounded in the excerpt.
  - explanation.distractors: 4 entries, each explaining why the other options are wrong.
- Provide sourceReference as a VERBATIM quote/snippet from the excerpt that supports the correct answer.
- Act as a board-certified specialist and medical educator.
- Return ONLY valid JSON.
- All strings MUST be plain text without unescaped newlines. If you need a newline, use \n.
- Keep content concise to avoid truncation:
  - vignette <= 900 chars
  - question <= 220 chars
  - options: exactly 5 strings, each <= 140 chars
  - correctAnswer must exactly equal one of options
  - explanation.correct <= 700 chars
  - explanation.distractors: exactly 4 strings, each <= 260 chars
  - sourceReference <= 360 chars
- Be extremely concise in your responses to avoid truncation.
- Each question MUST be meaningfully different from the others AND from any existing questions.
- Avoid common tropes unless the provided content is explicitly about them.
- Tropes to avoid by default: "middle-aged man with crushing chest pain/MI", "young woman with anxiety/panic", "classic PE workup", "appendicitis", "DKA", "stroke code", "UTI in elderly", "pneumonia".
- Difficulty control (apply to writing style and distractors, NOT a stored field):
  - Target difficulty = ${difficulty} (1-5).
  - Level 1-2 (Foundation): Focus on direct recall and classic presentations. Use textbook symptoms and straightforward lab findings.
  - Level 3-4 (Intermediate): Include distracting lab values and "Next best step" management questions. Add 1-2 competing diagnoses.
  - Level 5 (GRAY ZONE - Clinical Reasoning Template): MANDATORY requirements - ALL THREE must be present:
    
    REQUIREMENT A (Red Herring - MANDATORY):
    * Include a co-morbidity or finding that ISN'T the primary cause but adds diagnostic noise.
    * Example: 'Patient with known COPD presenting with chest pain' (COPD is the red herring, actual diagnosis is MI).
    * Example: 'History of alcohol use' in a patient with perforated ulcer (alcohol is the red herring).
    * The red herring MUST be plausible enough to appear in the distractors.
    
    REQUIREMENT B (Pertinent Negatives - MANDATORY):
    * Include findings that rule out other plausible diagnoses.
    * Example: 'No heart murmurs' (rules out valvular disease), 'Normal glucose' (rules out DKA), 'Lung sounds clear' (rules out pneumonia).
    * Example: 'No rebound tenderness' (rules out peritonitis), 'Troponin negative at 2 hours' (may still be early MI).
    * Must include at least 2 pertinent negatives in the vignette.
    
    REQUIREMENT C (Management Dilemma - MANDATORY):
    * Create a situation where TWO answers are plausible but one is superior based on guidelines, timing, or subtle clinical details.
    * Example: 'tPA vs. Thrombectomy' - both correct, but thrombectomy superior due to time window.
    * Example: 'CT head vs. Lumbar puncture' - timing and contraindications determine which is first.
    * Example: 'Immediate surgery vs. Antibiotics first' - patient stability determines the answer.
    * The correct answer must be defensible with a guideline-based or timing-based rationale.
    
    FORBIDDEN for Level 5: Textbook cases, classic presentations, obvious diagnoses, or scenarios where the answer is immediately clear.
    
    VERIFICATION: Before finalizing a Level 5 question, confirm:
    ✓ Red Herring present?
    ✓ At least 2 Pertinent Negatives present?
    ✓ Management Dilemma with 2 plausible answers?
- Nonce: ${opts.nonce}

CONTENT (${input.contentType === "document" ? "document excerpt" : "transcript excerpt"}):
${contentPreview}${(input.contentType === "document" ? input.documentText.length : input.transcript.text.length) > (input.contentType === "document" ? 6000 : 4000) ? "..." : ""}
${existingBlock}

OUTPUT:
Generate 2 questions. Each item must include:
- vignette
- question
- options (5 strings)
- correctAnswer
- explanation (correct, distractors)
- sourceReference
- rationale (MANDATORY - Comprehensive clinical rationale)

RATIONALE REQUIREMENTS (MANDATORY - MUST ALWAYS BE PROVIDED):
CRITICAL: The rationale field is REQUIRED and must ALWAYS contain a string value. You CANNOT omit this field or leave it empty.

The rationale field must provide a complete educational explanation that includes:

1. GOLD STANDARD JUSTIFICATION:
   - Explain WHY the correct answer is the gold standard or best choice
   - Reference clinical guidelines, timing considerations, or evidence-based medicine when applicable
   - Example: "Thrombectomy is superior to tPA in this case because the patient presents within 6 hours of symptom onset with a large vessel occlusion, per AHA/ASA 2018 guidelines."

2. DISTRACTOR ANALYSIS:
   - Explain WHY each of the 4 incorrect options is wrong
   - Specifically address any RED HERRINGS or NUANCES used in the vignette
   - Example: "Option A (tPA) is tempting given the patient's COPD history (red herring), but the time window and vessel size favor thrombectomy."
   - Example: "Option C is incorrect because the pertinent negative of 'no rebound tenderness' rules out peritonitis."

3. CLINICAL TEACHING POINTS:
   - Include 1-2 key learning points that help students remember the concept
   - Example: "Remember: In acute stroke with large vessel occlusion <6 hours, thrombectomy is first-line."

Format: Write the rationale as a cohesive paragraph (at least 350 words) that flows naturally and educates the reader. For Level 5 questions, provide comprehensive detail on the Management Dilemma and Red Herrings.

REMINDER: Every question MUST have a rationale field populated with a complete string. This is not optional.

ADAPTIVE QUESTION MAPPING:
- Ensure that across multiple batches, questions progressively cover the full spectrum of clinical knowledge.
- If 20 questions are generated, they should represent a complete "Medical Textbook" of the topic:
  * Initial presentation and symptoms
  * Diagnostic workup and differential diagnosis
  * Acute management and stabilization
  * Complications (common and rare)
  * Long-term management and follow-up
  * Prognosis and patient counseling
  * Special populations (pediatric, geriatric, pregnant)
  * Rare presentations and zebras (if supported by content)

Keep each question concise but clinically useful.`;
}

/**
 * Generate Clinical Scenarios with Sequential Complexity Framework
 * 
 * SAFETY & BACKWARD COMPATIBILITY:
 * - existing: Optional array (defaults to []) - prevents crashes on first generation
 * - difficulty: Optional number (defaults to 3) - maintains compatibility with old calls
 * - Zod schema unchanged - no breaking changes to saved scenarios
 * - State preservation: UI difficulty slider state persists during generation
 * 
 * @param step - Inngest step for AI wrapping
 * @param input - Content input (podcast transcript or document)
 * @param userApiKey - Optional user-provided OpenAI API key (BYOK)
 * @param existing - Optional array of existing scenarios for anti-repetition
 * @param difficulty - Optional difficulty level 1-5 (defaults to 3)
 * @returns Promise<ClinicalScenarios> - Generated scenarios matching Zod schema
 */
export async function generateClinicalScenarios(
    step: typeof InngestStep,
    input: Input,
    userApiKey?: string,
    existing?: ExistingScenarioHint[],
    difficulty?: number,
): Promise<ClinicalScenarios> {
    // SAFETY: Ensure difficulty defaults to 3 and is clamped to 1-5 range
    const targetDifficulty = typeof difficulty === "number" ? Math.max(1, Math.min(5, difficulty)) : 3;

    // Verification: Log difficulty parameter for debugging
    console.log(`[CLINICAL SCENARIOS] Generating 2 scenarios with difficulty=${targetDifficulty} (raw input: ${difficulty})`);
    console.log(`[CLINICAL SCENARIOS] Existing scenarios count: ${existing?.length ?? 0}`);

    const createCompletion = createBoundCompletion(userApiKey);

    const similarityThreshold = 0.9;
    const maxAttempts = 3;

    let lastBatch: z.infer<typeof clinicalScenariosBatchSchema> | null = null;
    let lastReason = "";

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        const nonce = `${Date.now()}-${Math.random().toString(16).slice(2)}-${attempt}`;
        const prompt = buildClinicalScenariosPrompt(input, { existing, nonce, difficulty: targetDifficulty });

        const batch = await (async () => {
            try {
                const response = (await step.ai.wrap(
                    `generate-clinical-scenarios-with-gpt-incremental-attempt-${attempt}`,
                    createCompletion,
                    {
                        model: GENERATION_MODEL,
                        temperature: 0.4,
                        messages: [
                            {
                                role: "system",
                                content:
                                    "You are a Board-Certified Specialist and medical educator writing resident/expert-grade multiple-choice questions. STRICTLY ground every question in the provided excerpt only. Do not add outside facts, guidelines, dosages, or contraindications unless explicitly supported by the excerpt. Output must match the provided JSON schema exactly.",
                            },
                            {
                                role: "user",
                                content: prompt,
                            },
                        ],
                        response_format: zodResponseFormat(
                            clinicalScenariosBatchSchema,
                            "clinical_scenarios_incremental",
                        ),
                        max_completion_tokens: 4000,
                    },
                )) as OpenAI.Chat.Completions.ChatCompletion;

                const finishReason = response.choices[0]?.finish_reason;
                if (finishReason && finishReason !== "stop") {
                    throw new NonRetriableError(
                        `Clinical scenarios generation failed: model stopped early (finish_reason=${finishReason}).`,
                    );
                }

                const content = response.choices[0]?.message?.content;
                if (!content) {
                    throw new NonRetriableError(
                        "Clinical scenarios generation failed: empty response",
                    );
                }

                try {
                    return clinicalScenariosBatchSchema.parse(JSON.parse(content));
                } catch {
                    const prefix = content.slice(0, 500);
                    const suffix = content.slice(Math.max(0, content.length - 500));
                    throw new NonRetriableError(
                        `Clinical scenarios generation failed: invalid JSON from model. Content length=${content.length}. Prefix=${JSON.stringify(prefix)} Suffix=${JSON.stringify(suffix)}`,
                    );
                }
            } catch (err: any) {
                const maybeStatus =
                    typeof err?.status === "number"
                        ? err.status
                        : typeof err?.response?.status === "number"
                            ? err.response.status
                            : undefined;

                const message = typeof err?.message === "string" ? err.message : "";
                const is400 =
                    typeof maybeStatus === "number" && maybeStatus >= 400 && maybeStatus < 500;

                // Fail fast only for scenario generation + JSON/Zod validation failures
                if (err instanceof NonRetriableError || is400 || message.includes("400")) {
                    throw new NonRetriableError("Scenario Generation Failed");
                }

                throw err;
            }
        })();

        lastBatch = batch;

        const sims = batch.scenarios.map((sc) =>
            maxSimilarityToExisting(sc, existing),
        );
        const maxSim = Math.max(...sims);

        if (maxSim < similarityThreshold) {
            return clinicalScenariosSchema.parse({ scenarios: batch.scenarios });
        }

        lastReason = `Duplicate similarity too high (maxSim=${maxSim.toFixed(2)} >= ${similarityThreshold})`;
        console.warn(
            `[clinicalScenarios] retrying due to duplicates: attempt=${attempt}/${maxAttempts} ${lastReason}`,
        );
    }

    if (!lastBatch) {
        throw new Error(
            "Clinical scenarios generation failed: no output produced after retries",
        );
    }

    throw new Error(
        `Clinical scenarios generation produced near-duplicate cases after ${maxAttempts} attempts. ${lastReason}`,
    );
}

export async function findSupportingSourceQuote(
    step: typeof InngestStep,
    input: Input,
    scenario: {
        vignette: string;
        question: string;
        options: string[];
        correctAnswer: string;
        sourceReference?: string;
    },
    userApiKey?: string,
): Promise<string | null> {
    const timeoutMs = 15_000;

    try {
        if (input.contentType !== "podcast") {
            return null;
        }

        const transcriptText = input.transcript.text ?? "";
        if (!transcriptText || transcriptText.trim().length === 0) {
            return null;
        }

        // Streamline context: extract relevant segments based on sourceReference keywords
        let transcriptExcerpt = "";
        if (scenario.sourceReference && scenario.sourceReference.length > 10) {
            const keywords = scenario.sourceReference
                .toLowerCase()
                .split(/\s+/)
                .filter((w) => w.length > 4)
                .slice(0, 5);

            const sentences = transcriptText.split(/[.!?]+/);
            const relevantSentences = sentences.filter((s) =>
                keywords.some((kw) => s.toLowerCase().includes(kw)),
            );

            transcriptExcerpt = relevantSentences.slice(0, 10).join(". ").slice(0, 8000);
        }

        // Fallback to first 8k chars if no relevant segments found
        if (!transcriptExcerpt || transcriptExcerpt.length < 100) {
            transcriptExcerpt = transcriptText.slice(0, 8000);
        }

        const createCompletion = createBoundCompletion(userApiKey);

        const prompt = `You are verifying that a multiple-choice medical question is supported by the transcript.

TASK:
- Find ONE exact sentence copied verbatim from the transcript excerpt that supports the key medical fact used to justify the correct answer.
- If you cannot find an exact supporting sentence, return null for the sourceQuote field.

RULES:
- The quote must be a single sentence.
- The quote must appear verbatim in the transcript excerpt.
- Return ONLY valid JSON.

QUESTION STEM:
VIGNETTE: ${scenario.vignette}
QUESTION: ${scenario.question}
OPTIONS: ${scenario.options.join(" | ")}
CORRECT ANSWER: ${scenario.correctAnswer}

TRANSCRIPT EXCERPT:
${transcriptExcerpt}`;

        const response = (await step.ai.wrap(
            "verify-clinical-scenario-source-quote",
            createCompletion,
            {
                model: VERIFICATION_MODEL,
                temperature: 0,
                messages: [
                    {
                        role: "system",
                        content:
                            "Return only valid JSON matching the provided schema. If you cannot find an exact verbatim supporting sentence in the transcript excerpt, output sourceQuote as null.",
                    },
                    { role: "user", content: prompt },
                ],
                response_format: zodResponseFormat(verificationResultSchema, "audit_result"),
                max_completion_tokens: 1000,
            },
        )) as OpenAI.Chat.Completions.ChatCompletion;

        const finishReason = response.choices[0]?.finish_reason;
        if (finishReason && finishReason !== "stop") {
            return null;
        }

        const content = response.choices[0]?.message?.content;
        if (!content) return null;

        let parsed: unknown;
        try {
            parsed = JSON.parse(content);
        } catch {
            return null;
        }

        const result = verificationResultSchema.safeParse(parsed);
        if (!result.success || result.data.sourceQuote === null) {
            return null;
        }

        const quote = result.data.sourceQuote.trim();
        if (!quote) return null;

        const normalizedTranscript = transcriptText.toLowerCase();
        if (!normalizedTranscript.includes(quote.toLowerCase())) {
            return null;
        }

        return quote;
    } catch (err: any) {
        // Audit is optional - if it fails or times out, return null instead of throwing
        console.warn("[findSupportingSourceQuote] Audit failed, returning null:", err?.message || err);
        return null;
    }
}

/**
 * Wrapper with 15s timeout - returns null if audit takes too long
 */
export async function findSupportingSourceQuoteWithTimeout(
    step: typeof InngestStep,
    input: Input,
    scenario: {
        vignette: string;
        question: string;
        options: string[];
        correctAnswer: string;
        sourceReference?: string;
    },
    userApiKey?: string,
): Promise<string | null> {
    const timeoutMs = 15_000;

    const timeoutPromise = new Promise<null>((resolve) => {
        setTimeout(() => resolve(null), timeoutMs);
    });

    const auditPromise = findSupportingSourceQuote(step, input, scenario, userApiKey);

    return Promise.race([auditPromise, timeoutPromise]);
}
