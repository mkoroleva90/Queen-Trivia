
import { logger } from "../lib/logger";


const GEMINI_MODELS = [
    "gemini-3.5-flash-lite", // lighter quota bucket — try first
    "gemini-3.5-flash",    // fallback
];


function geminiUrl(model: string) {
 return`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
}


// ─── Shared types──────────────────────────────────────────────────────────────
export type GeminiErrorKind = "rate_limit_minute" | "rate_limit_daily" |"model_unavailable";


export type GeminiGenerateError =
    | { code: "no_api_key" }
    | { code: "api_error"; message: string; kind?: GeminiErrorKind }
    | { code: "parse_error"; message: string }
    | { code: "fetch_failed"; message: string };


interface GeminiApiResponse {
    candidates?: Array<{
        content?: {
         parts?: Array<{ text?: string }>;
        };
    }>;
}


// ─── Shared helpers────────────────────────────────────────────────────────────


function shuffleArray<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i]!, a[j]!] = [a[j]!, a[i]!];
    }
    return a;
}


type RateLimitKind = "per_minute" | "daily";


interface GeminiRawResult {
    ok: true;
    text: string;
}
interface GeminiRawError {
    ok: false;
    error: GeminiGenerateError;
    rateLimitKind?: RateLimitKind;
}


async function callGeminiRaw(
    apiKey: string,
    model: string,
    prompt: string,
    temperature = 0.4,
    maxTokens = 8192,
): Promise<GeminiRawResult | GeminiRawError> {
    let resp: Response;
    try {
     resp = await fetch(`${geminiUrl(model)}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
     body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature, maxOutputTokens: maxTokens },
     }),
    });
} catch (err) {
    logger.warn({ err }, "Gemini API fetch failed");
    return { ok: false, error: { code: "fetch_failed", message: String(err) } };
}


if (resp.status === 429) {
    // Read body to distinguish per-minute vs daily quota exhaustion
    const body = await resp.text().catch(() => "");
    const hasZeroLimit = /limit:\s*0\b/.test(body);
    const isDaily =
     body.includes("per_day") ||
     body.includes("PerDay") ||
     body.includes("daily") ||
     body.includes("free_tier") ||
     body.includes("RESOURCE_EXHAUSTED");
    const rateLimitKind: RateLimitKind = isDaily || hasZeroLimit ? "daily" : "per_minute";
  logger.warn({ model, rateLimitKind, hasZeroLimit, body: body.slice(0, 400) }, "Gemini429");
    return {
     ok: false,
     rateLimitKind,
     error: {
         code: "api_error",
         kind: hasZeroLimit
          ? "model_unavailable"
          : isDaily
           ? "rate_limit_daily"
           : "rate_limit_minute",
         message: hasZeroLimit
      ? "This API key has no quota for this Gemini model (limit is 0) — the model may beretired for new accounts, or the key's project lacks free-tier access."
          : isDaily
           ? "Gemini daily quota exhausted. Please try again after midnight Pacific time."
           : "Too many requests. Please wait a moment and try again.",
     },
    };
}


if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    logger.warn({ status: resp.status, body: body.slice(0, 300) }, "Gemini API error");
    return { ok: false, error: { code: "api_error", message: `HTTP ${resp.status}` } };
}


const data = (await resp.json()) as GeminiApiResponse;
const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    if (!text) {
        return { ok: false, error: { code: "parse_error", message: "Empty response from Gemini" } };
    }


    return { ok: true, text };
}


function stripFences(text: string): string {
    return text
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```\s*$/i, "")
        .trim();
}


// ─── Bulk generation ───────────────────────────────────────────────────────────


export type GeminiQuestionType =
    | "multiple_choice"
    | "true_false"
    | "write_in"
    | "matching"
    | "image_recognition";


export interface GeminiQuestion {
    questionText: string;
    questionType: GeminiQuestionType;
    correctAnswer: string;
    options:
     | { choices: string[] }
     | { pairs: { left: string; right: string }[] }
     | { alternateAnswers: string[] }
     | null;
    imageUrl: string | null;
    points: number;
    orderIndex: number;
    source: string;
    aiGenerated: true;
    verifiedByAdmin: false;
}


export type GeminiGenerateResult =
    | { ok: true; questions: GeminiQuestion[] }
    | { ok: false; error: GeminiGenerateError };


export interface GeminiGenerateOptions {
    topic: string;
    difficulty: "easy" | "medium" | "hard";
    amount: number;
    existingQuestions?: string[];
}


interface RawGeminiQuestion {
    question_type?: unknown;
    question_text?: unknown;
    correct_answer?: unknown;
    options?: unknown;
    acceptable_answers?: unknown;
    left_items?: unknown;
    right_items?: unknown;
    correct_pairs?: unknown;
    image_url?: unknown;
    points?: unknown;
    source?: unknown;
}


const VALID_TYPES = new Set([
    "multiple_choice",
    "true_false",
    "write_in",
    "matching",
    "image_recognition",
]);


function buildBulkPrompt(opts: GeminiGenerateOptions): string {
    const avoid =
     opts.existingQuestions && opts.existingQuestions.length > 0
   ? `\nThe following questions have ALREADY been used. You MUST NOT duplicate, reword, or rephrase ANY of them — do not ask about the same fact, person, event, or statistic even with different wording. Every question you write must cover a genuinely different subtopic or angle:\n${opts.existingQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n")}`
     : "";


// Compute exact counts so the model cannot ignore the mix requirement.
 // Target distribution: 40% MC, 20% TF, 20% write-in, 10% matching, 10% imagerecognition.
// Types are added in priority order so the counts always sum exactly to `total`.
const total = opts.amount;
let remaining = total;
const take = (target: number, enabled = true): number => {
 if (!enabled || remaining <= 0) return 0;
 const n = Math.min(remaining, Math.max(1, Math.round(total * target)));
 remaining -= n;
 return n;
};
const matchCount = take(0.1, total >= 6);
const imgCount = take(0.1, total >= 6);
const tfCount = take(0.2, total >= 2);
const wiCount = take(0.2, total >= 3);
const mcCount = remaining; // everything left; >= 1 for total >= 1 given the caps above
const mcPoints = opts.difficulty === "easy" ? 5 : opts.difficulty === "hard" ? 15 : 10;


const matchingSpec = matchCount > 0
  ? `- ${matchCount} questions with "question_type": "matching"         (4 related pairs toconnect; points: 20)\n`
 : "";
const imageSpec = imgCount > 0
 ? `- ${imgCount} questions with "question_type": "image_recognition" (real WikimediaCommons image URL; points: 15)\n`
 : "";


 return `You are a trivia question writer creating a fun, varied quiz. Generate exactly ${total}trivia questions about "${opts.topic}" at ${opts.difficulty} difficulty level.${avoid}


CRITICAL RULES:
1. Every question and answer MUST be based on verifiable, real-world facts.
2. Include the factual source for each answer (e.g., "Wikipedia: Eiffel Tower" or "Nobel Prizeofficial records, 1921").
3. Do not invent any facts, statistics, dates, names, or events.
4. If you are unsure about a fact, do not include that question.
5. Prefer well-documented historical facts, scientific facts, and publicly verifiableinformation.
6. Avoid recent events from the last 2 years that may have uncertain details.
7. All wrong answers for multiple choice must be plausible but definitively incorrect.
8. Mix the question types throughout the array — do not group all of one type together.


YOU MUST produce EXACTLY this breakdown — no deviations:
- ${mcCount} questions with "question_type": "multiple_choice" (4 options; shuffle socorrect answer is NOT always first; points: ${mcPoints})
- ${tfCount} questions with "question_type": "true_false" (options must be["true","false"]; correct_answer must be "true" or "false"; points: 5)
- ${wiCount} questions with "question_type": "write_in"       (short factual answer — name,date, or place; points: 15)
${matchingSpec}${imageSpec}
QUESTION TYPE FORMATS (use these exact JSON structures):
multiple_choice:
 { "question_type": "multiple_choice", "question_text": "The question?", "correct_answer":"Correct Answer", "options": ["Wrong 1", "Correct Answer", "Wrong 2", "Wrong 3"], "points":${mcPoints}, "source": "Wikipedia: Article Name" }


true_false:
 { "question_type": "true_false", "question_text": "Statement to evaluate.","correct_answer": "true", "options": ["true", "false"], "points": 5, "source": "Source name" }


write_in:
 { "question_type": "write_in", "question_text": "Question requiring a short typed answer?","correct_answer": "Answer", "acceptable_answers": ["Answer", "Alternate spelling"],"points": 15, "source": "Source name" }
${matchCount > 0 ? `
matching (exactly 4 pairs; right_items are the left_items' matches in scrambled order):
 { "question_type": "matching", "question_text": "Match each country to its capital:","left_items": ["France", "Japan", "Brazil", "Egypt"], "right_items": ["Tokyo", "Paris", "Cairo","Brasilia"], "correct_pairs": [{"left": "France", "right": "Paris"}, {"left": "Japan", "right":"Tokyo"}, {"left": "Brazil", "right": "Brasilia"}, {"left": "Egypt", "right": "Cairo"}], "points": 20,"source": "World Atlas" }
` : ""}${imgCount > 0 ? `
image_recognition (ONLY real, well-known Wikimedia Commons URLs of famous subjects— the URL must actually exist; if you cannot recall a real URL exactly, use a differentfamous subject you are sure about):
 { "question_type": "image_recognition", "question_text": "Name this famous landmark:","image_url":"https://upload.wikimedia.org/wikipedia/commons/a/a8/Tour_Eiffel_Wikimedia_Commons.jpg", "correct_answer": "Eiffel Tower", "acceptable_answers": ["Eiffel Tower", "The EiffelTower", "Tour Eiffel"], "points": 15, "source": "Wikimedia Commons" }
` : ""}
Return ONLY a valid JSON array with no other text, no markdown, no code fences.


Topic: ${opts.topic}
Difficulty: ${opts.difficulty}
Total questions required: ${total}`;
}


function parseQuestions(raw: unknown, opts: GeminiGenerateOptions): GeminiQuestion[]{
    if (!Array.isArray(raw)) return [];


    const results: GeminiQuestion[] = [];


    for (let i = 0; i < raw.length; i++) {
     const item = raw[i] as RawGeminiQuestion;
     if (!item || typeof item !== "object") continue;


 const questionType = typeof item.question_type === "string" ? item.question_type.trim() :null;
 const questionText = typeof item.question_text === "string" ? item.question_text.trim() :null;
  const correctAnswer = typeof item.correct_answer === "string" ?item.correct_answer.trim() : null;
     const sourceCitation =
      typeof item.source === "string" && item.source.trim()
       ? item.source.trim()
       : `AI Generated: ${opts.topic}`;
if (!questionType || !VALID_TYPES.has(questionType) || !questionText) continue;


// Matching questions carry their answer in correct_pairs, not correct_answer
if (questionType === "matching") {
    const pairs = parseMatchingPairs(item);
    if (!pairs || pairs.length < 2) continue;
    // correctAnswer format used by the grader: "left:right|..." sorted alphabetically by left
    const answerString = [...pairs]
     .sort((a, b) => a.left.localeCompare(b.left))
     .map((p) => `${p.left}:${p.right}`)
     .join("|");
    results.push({
     questionText,
     questionType: "matching",
     correctAnswer: answerString,
     options: { pairs },
     imageUrl: null,
     points: 20,
     orderIndex: i,
     source: sourceCitation,
     aiGenerated: true,
     verifiedByAdmin: false,
    });
    continue;
}
if (!correctAnswer) continue;


if (questionType === "multiple_choice") {
const rawOpts = Array.isArray(item.options) ? (item.options as unknown[]) : null;
if (!rawOpts || rawOpts.length < 2) continue;


const choices = rawOpts
    .map((c) => String(c).trim())
    .filter(Boolean)
    .slice(0, 4);


if (!choices.includes(correctAnswer)) {
    choices[0] = correctAnswer;
}


const points =
    typeof item.points === "number"
     ? item.points
     : opts.difficulty === "easy"
      ?5
      : opts.difficulty === "hard"
       ? 15
       : 10;


results.push({
  questionText,
  questionType: "multiple_choice",
  correctAnswer,
  options: { choices: shuffleArray(choices) },
  imageUrl: null,
  points,
  orderIndex: i,
  source: sourceCitation,
  aiGenerated: true,
  verifiedByAdmin: false,
 });
} else if (questionType === "true_false") {
 const answer = correctAnswer.toLowerCase() === "false" ? "false" : "true";
 results.push({
  questionText,
  questionType: "true_false",
  correctAnswer: answer,
  options: null,
  imageUrl: null,
  points: 5,
  orderIndex: i,
  source: sourceCitation,
  aiGenerated: true,
  verifiedByAdmin: false,
 });
} else if (questionType === "write_in") {
results.push({
 questionText,
 questionType: "write_in",
 correctAnswer,
 options: buildAlternates(item.acceptable_answers, correctAnswer),
 imageUrl: null,
 points: 15,
 orderIndex: i,
 source: sourceCitation,
 aiGenerated: true,
 verifiedByAdmin: false,
});
} else if (questionType === "image_recognition") {
const imageUrl = normalizeWikimediaUrl(
 typeof item.image_url === "string" ? item.image_url.trim() : "",
);
if (!imageUrl) continue;
results.push({
 questionText,
 questionType: "image_recognition",
 correctAnswer,
 options: buildAlternates(item.acceptable_answers, correctAnswer),
 imageUrl,
 points: 15,
 orderIndex: i,
 source: sourceCitation,
             aiGenerated: true,
             verifiedByAdmin: false,
            });
        }
    }


    return results;
}


function buildAlternates(
    raw: unknown,
    correctAnswer: string,
): { alternateAnswers: string[] } | null {
    if (!Array.isArray(raw)) return null;
    const alternates = raw
        .map((a) => String(a).trim())
        .filter((a) => a && a.toLowerCase() !== correctAnswer.toLowerCase());
    return alternates.length > 0 ? { alternateAnswers: alternates } : null;
}


function parseMatchingPairs(
    item: RawGeminiQuestion,
): { left: string; right: string }[] | null {
    if (!Array.isArray(item.correct_pairs)) return null;
    const pairs: { left: string; right: string }[] = [];
    for (const p of item.correct_pairs as unknown[]) {
        if (!p || typeof p !== "object") continue;
        const left = String((p as { left?: unknown }).left ?? "").trim();
        const right = String((p as { right?: unknown }).right ?? "").trim();
        if (left && right) pairs.push({ left, right });
    }
    return pairs.length > 0 ? pairs.slice(0, 5) : null;
}


/**
* Only accept Wikimedia Commons URLs, and rewrite thumbnail URLs to the
* original file URL (thumb paths frequently 400 for LLM-recalled sizes).
* e.g. .../commons/thumb/a/a8/File.jpg/800px-File.jpg → .../commons/a/a8/File.jpg
*/
function normalizeWikimediaUrl(url: string): string | null {
    if (!/^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\//.test(url)) return null;
    const thumbMatch = url.match(

/^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/thumb\/([^/]+\/[^/]+\/[^/]+)\/[^/]+$/,
    );
 return thumbMatch ?`https://upload.wikimedia.org/wikipedia/commons/${thumbMatch[1]}` : url;
}


/** Verify image URLs actually load; drop image questions with dead links. */
export async function filterValidImageQuestions(
    questions: GeminiQuestion[],
): Promise<GeminiQuestion[]> {
    const checks = await Promise.all(
     questions.map(async (q) => {
         if (q.questionType !== "image_recognition" || !q.imageUrl) return q;
         try {
             const resp = await fetch(q.imageUrl, {
              method: "GET",
              headers: {
               "User-Agent": "TriviaNightApp/1.0 (question image validation)",
               Range: "bytes=0-0",
              },
              signal: AbortSignal.timeout(5000),
             });
             const contentType = resp.headers.get("content-type") ?? "";
             if (resp.ok && contentType.startsWith("image/")) return q;
   logger.warn({ imageUrl: q.imageUrl, status: resp.status }, "Dropping image question:URL not a valid image");
             return null;
         } catch {
             logger.warn({ imageUrl: q.imageUrl }, "Dropping image question: URL unreachable");
             return null;
         }
     }),
    );
    return checks.filter((q): q is GeminiQuestion => q !== null);
}
export async function generateGeminiQuestions(
opts: GeminiGenerateOptions,
): Promise<GeminiGenerateResult> {
const apiKey = process.env.GOOGLE_API_KEY;
if (!apiKey) {
    return { ok: false, error: { code: "no_api_key" } };
}


const prompt = buildBulkPrompt(opts);
let lastError: GeminiGenerateError = { code: "api_error", message: "Not attempted" };


// Cascade through available models; within each model retry once on per-minute limits
for (const model of GEMINI_MODELS) {
    let raw: GeminiRawResult | GeminiRawError = { ok: false, error: lastError };


    for (let attempt = 0; attempt < 2; attempt++) {
        raw = await callGeminiRaw(apiKey, model, prompt, 0.4, 8192);
        if (raw.ok) break;
        lastError = raw.error;
        const isPerMinute = !raw.ok && raw.rateLimitKind === "per_minute";
        if (!isPerMinute || attempt >= 1) break;
        const delay = 25000;
        logger.info({ model, attempt: attempt + 1, delay }, "Gemini per-minute limit, retrying");
        await new Promise((resolve) => setTimeout(resolve, delay));
    }
 if (raw.ok) {
     // success — fall through to parse
     let parsed: unknown;
     try {
         parsed = JSON.parse(stripFences(raw.text));
     } catch {
         logger.warn({ text: raw.text.slice(0, 500) }, "Failed to parse Gemini JSON response");
         return {
          ok: false,
    error: { code: "parse_error", message: "Invalid response format from Gemini. Please tryagain." },
         };
     }
     const questions = parseQuestions(parsed, opts);
     if (questions.length === 0) {
         return {
          ok: false,
     error: { code: "parse_error", message: "No valid questions in Gemini response. Pleasetry again." },
         };
     }
     return { ok: true, questions };
 }


 // If this model hit a daily limit, no point trying it again — but try next model
 const isDaily = !raw.ok && raw.rateLimitKind === "daily";
        logger.warn({ model, isDaily, error: raw.error }, "Gemini model failed, trying next");
        if (!isDaily) break; // non-rate-limit error — don't try further models
    }


    return { ok: false, error: lastError };
}


// ─── Regenerate single question ────────────────────────────────────────────────


export interface RegenerateOpts {
    topic: string;
    difficulty: "easy" | "medium" | "hard";
    questionType: "multiple_choice" | "true_false" | "write_in";
    avoidTexts: string[];
    points: number;
}


export interface RegeneratePreview {
    questionType: "multiple_choice" | "true_false" | "write_in";
    questionText: string;
    correctAnswer: string;
    options: string[] | null;
    points: number;
    source: string;
}
export type RegenerateResult =
    | { ok: true; question: RegeneratePreview }
    | { ok: false; error: GeminiGenerateError };


export async function regenerateSingleQuestion(opts: RegenerateOpts):Promise<RegenerateResult> {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) return { ok: false, error: { code: "no_api_key" } };


    const avoidList = opts.avoidTexts
        .map((t, i) => `  ${i + 1}. "${t}"`)
        .join("\n");

    const prompt = `Generate exactly 1 trivia question about "${opts.topic}" at ${opts.difficulty} difficulty level.

The question type must be: ${opts.questionType}

CRITICAL RULES:
1. The question and answer MUST be based on verifiable, real-world facts
2. Include the factual source for the answer
3. Do not invent any facts, statistics, dates, names, or events
4. The following questions already exist in this game — you MUST NOT duplicate or rephrase any of them:
${avoidList}
5. Pick a DIFFERENT subtopic, fact, or angle about "${opts.topic}" that NONE of the above questions cover. Do not reword any of them — choose an entirely new aspect.

Return ONLY valid JSON with no other text:
{
    "question_type": "${opts.questionType}",
    "question_text": "Your new question here?",
    "correct_answer": "Correct Answer",
    "options": ["Correct Answer", "Wrong 1", "Wrong 2", "Wrong 3"],
    "points": ${opts.points},
    "source": "Source name"
}

For true_false, options should be ["true", "false"].
For write_in, options should be an empty array [].`;


    const raw = await callGeminiRaw(apiKey, GEMINI_MODELS[0]!, prompt, 0.9, 2048);
    if (!raw.ok) return raw;


    let parsed: unknown;
    try {
        parsed = JSON.parse(stripFences(raw.text));
    } catch {
  return { ok: false, error: { code: "parse_error", message: "Could not parse Gemini response" } };
    }


    const q = parsed as RawGeminiQuestion;
    const questionText = typeof q.question_text === "string" ? q.question_text.trim() : null;
 const correctAnswer = typeof q.correct_answer === "string" ? q.correct_answer.trim() :null;
    const questionType = opts.questionType;


    if (!questionText || !correctAnswer) {
 return { ok: false, error: { code: "parse_error", message: "Invalid question structure fromGemini" } };
    }
    let options: string[] | null = null;
    if (questionType === "multiple_choice" && Array.isArray(q.options)) {
        const choices = (q.options as unknown[])
         .map((c) => String(c).trim())
         .filter(Boolean)
         .slice(0, 4);
        if (!choices.includes(correctAnswer)) choices[0] = correctAnswer;
        options = shuffleArray(choices);
    } else if (questionType === "true_false") {
        options = ["true", "false"];
    }


    const points = typeof q.points === "number" ? q.points : opts.points;
    const source =
        typeof q.source === "string" && q.source.trim()
         ? q.source.trim()
         : `AI Generated: ${opts.topic}`;


 return { ok: true, question: { questionType, questionText, correctAnswer, options, points,source } };
}


// ─── Enhance question──────────────────────────────────────────────────────────


export interface EnhanceOpts {
    questionType: string;
    questionText: string;
    correctAnswer: string;
    options: string[];
    source?: string | null;
}


export interface EnhanceData {
    improvedQuestionText: string;
    improvedOptions: string[] | null;
    factCheckResult: "VERIFIED" | "UNCERTAIN" | "LIKELY_INCORRECT";
    factCheckNotes: string;
    suggestedSource: string;
    suggestions: string;
}


export type EnhanceResult =
    | { ok: true; data: EnhanceData }
    | { ok: false; error: GeminiGenerateError };


export async function enhanceQuestion(opts: EnhanceOpts): Promise<EnhanceResult> {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) return { ok: false, error: { code: "no_api_key" } };


    const prompt = `Review this trivia question and suggest improvements:
Question Type: ${opts.questionType}
Question: ${opts.questionText}
Correct Answer: ${opts.correctAnswer}
Options: ${opts.options.length > 0 ? opts.options.join(", ") : "N/A"}
Current Source: ${opts.source || "None provided"}


Please analyze and return JSON with:
{
    "improved_question_text": "Clearer or better worded version of the question",
 "improved_options": ["Better distractor 1", "Better distractor 2", "Better distractor 3","Correct Answer"],
    "fact_check_result": "VERIFIED" or "UNCERTAIN" or "LIKELY_INCORRECT",
    "fact_check_notes": "Explanation of verification, any concerns about accuracy",
    "suggested_source": "A reliable source that confirms this fact",
    "suggestions": "Any other suggestions to improve this question"
}


IMPORTANT:
- Verify the factual accuracy of the correct answer
- If the fact seems wrong or outdated, mark as LIKELY_INCORRECT and explain why
- Suggest better wrong answers that are plausible but clearly incorrect
- Improve question clarity without changing the core fact being tested
- For true_false or write_in, improved_options may be null`;


    const raw = await callGeminiRaw(apiKey, GEMINI_MODELS[0]!, prompt, 0.3, 2048);
    if (!raw.ok) return raw;
let parsed: Record<string, unknown>;
try {
    parsed = JSON.parse(stripFences(raw.text)) as Record<string, unknown>;
} catch {
  return { ok: false, error: { code: "parse_error", message: "Could not parse Gemini response" } };
}


 const fcRaw = String(parsed.fact_check_result ?? "UNCERTAIN").toUpperCase().replace(/\s+/g, "_");
const factCheckResult: EnhanceData["factCheckResult"] =
  fcRaw === "VERIFIED" ? "VERIFIED" : fcRaw === "LIKELY_INCORRECT" ?"LIKELY_INCORRECT" : "UNCERTAIN";


let improvedOptions: string[] | null = null;
 if (Array.isArray(parsed.improved_options) && (parsed.improved_options as unknown[]).length > 0) {
  improvedOptions = (parsed.improved_options as unknown[]).map((o) => String(o).trim()).filter(Boolean);
}


return {
    ok: true,
    data: {
  improvedQuestionText: String(parsed.improved_question_text ?? opts.questionText).trim(),
     improvedOptions,
         factCheckResult,
         factCheckNotes: String(parsed.fact_check_notes ?? "").trim(),
         suggestedSource: String(parsed.suggested_source ?? "").trim(),
         suggestions: String(parsed.suggestions ?? "").trim(),
     },
    };
}


// ─── Fact-check single question ────────────────────────────────────────────────


export interface FactCheckOpts {
    questionText: string;
    correctAnswer: string;
}


export interface FactCheckData {
    verdict: "CORRECT" | "INCORRECT" | "UNCERTAIN";
    confidence: "HIGH" | "MEDIUM" | "LOW";
    explanation: string;
    correctAnswerIfWrong: string | null;
}


export type FactCheckSingleResult =
    | { ok: true; data: FactCheckData }
    | { ok: false; error: GeminiGenerateError };
export async function factCheckSingleQuestion(opts: FactCheckOpts):Promise<FactCheckSingleResult> {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) return { ok: false, error: { code: "no_api_key" } };


    const prompt = `Verify this trivia fact:
Question: ${opts.questionText}
Stated Answer: ${opts.correctAnswer}


Is this factually correct? Return JSON only:
{
    "verdict": "CORRECT" or "INCORRECT" or "UNCERTAIN",
    "confidence": "HIGH" or "MEDIUM" or "LOW",
    "explanation": "Brief explanation of verification",
 "correct_answer_if_wrong": "The actual correct answer if the stated one is wrong, or null ifcorrect"
}`;


    const raw = await callGeminiRaw(apiKey, GEMINI_MODELS[0]!, prompt, 0.2, 1024);
    if (!raw.ok) return raw;


    let parsed: Record<string, unknown>;
    try {
     parsed = JSON.parse(stripFences(raw.text)) as Record<string, unknown>;
    } catch {
  return { ok: false, error: { code: "parse_error", message: "Could not parse Gemini response" } };
    }


    const verdictRaw = String(parsed.verdict ?? "UNCERTAIN").toUpperCase();
    const verdict: FactCheckData["verdict"] =
  verdictRaw === "CORRECT" ? "CORRECT" : verdictRaw === "INCORRECT" ?"INCORRECT" : "UNCERTAIN";


    const confidenceRaw = String(parsed.confidence ?? "LOW").toUpperCase();
    const confidence: FactCheckData["confidence"] =
  confidenceRaw === "HIGH" ? "HIGH" : confidenceRaw === "MEDIUM" ? "MEDIUM" :"LOW";


    return {
        ok: true,
        data: {
         verdict,
         confidence,
         explanation: String(parsed.explanation ?? "").trim(),
         correctAnswerIfWrong:
             parsed.correct_answer_if_wrong && parsed.correct_answer_if_wrong !== "null"
             ? String(parsed.correct_answer_if_wrong).trim()
             : null,
        },
    };
}


