
import { logger } from "../lib/logger.ts";
import { decodeHtml } from "../lib/decodeHtml.ts";


const OPENTDB_BASE = "https://opentdb.com";


// ─── Session token cache ──────────────────────────────────────────────────────


let sessionToken: string | null = null;
let tokenFetchedAt: number | null = null;
const TOKEN_TTL_MS = 6 * 60 * 60 * 1000;


async function getSessionToken(): Promise<string | null> {
    if (
        sessionToken &&
        tokenFetchedAt &&
        Date.now() - tokenFetchedAt < TOKEN_TTL_MS
    ){
        return sessionToken;
    }
    try {
        const resp = await fetch(
         `${OPENTDB_BASE}/api_token.php?command=request`,
        );
        const data = (await resp.json()) as {
            response_code: number;
            token: string;
        };
        if (data.response_code === 0 && data.token) {
            sessionToken = data.token;
            tokenFetchedAt = Date.now();
            return sessionToken;
        }
    } catch (err) {
        logger.warn({ err }, "Failed to fetch OpenTDB session token");
    }
    return null;
}


async function resetSessionToken(): Promise<void> {
    if (!sessionToken) return;
    try {
        await fetch(
            `${OPENTDB_BASE}/api_token.php?command=reset&token=${sessionToken}`,
        );
        tokenFetchedAt = Date.now();
    } catch {
        sessionToken = null;
        tokenFetchedAt = null;
    }
}
// ─── Internal types ───────────────────────────────────────────────────────────


interface RawOpenTdbResult {
    category: string;
    type: "multiple" | "boolean";
    difficulty: "easy" | "medium" | "hard";
    question: string;
    correct_answer: string;
    incorrect_answers: string[];
}


interface RawOpenTdbResponse {
    response_code: number;
    results?: RawOpenTdbResult[];
}


// ─── Public types ─────────────────────────────────────────────────────────────


export interface OpenTdbQuestion {
    questionText: string;
    questionType: "multiple_choice" | "true_false";
    correctAnswer: string;
    options: { choices: string[] } | null;
    points: number;
    orderIndex: number;
    source: string;
}


export type FetchQuestionsError =
    | { code: "rate_limited" }
    | { code: "no_results" }
    | { code: "invalid_params" }
    | { code: "fetch_failed"; message: string };


export type FetchQuestionsResult =
    | { ok: true; questions: OpenTdbQuestion[] }
    | { ok: false; error: FetchQuestionsError };


export interface FetchQuestionsOptions {
    amount: number;
    categoryId?: number;
    difficulty?: "easy" | "medium" | "hard";
}


// ─── Helpers──────────────────────────────────────────────────────────────────


function shuffleArray<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
     const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}


const POINTS_MAP: Record<string, number> = { easy: 5, medium: 10, hard: 15 };


function mapResult(r: RawOpenTdbResult, index: number): OpenTdbQuestion {
    const questionText = decodeHtml(r.question);
    const correctAnswer = decodeHtml(r.correct_answer);
    const incorrectAnswers = r.incorrect_answers.map(decodeHtml);
    const points = POINTS_MAP[r.difficulty] ?? 10;


    if (r.type === "boolean") {
        return {
         questionText,
         questionType: "true_false",
         correctAnswer: correctAnswer.toLowerCase(),
         options: null,
         points,
         orderIndex: index,
         source: "opentdb",
        };
    }


    const choices = shuffleArray([correctAnswer, ...incorrectAnswers]);
    return {
     questionText,
     questionType: "multiple_choice",
     correctAnswer,
     options: { choices },
     points,
     orderIndex: index,
     source: "opentdb",
    };
}


// ─── Public API ───────────────────────────────────────────────────────────────


export async function fetchOpenTdbQuestions(
    opts: FetchQuestionsOptions,
    _retried = false,
): Promise<FetchQuestionsResult> {
    const token = await getSessionToken();


    const params = new URLSearchParams({ amount: String(opts.amount) });
    if (opts.categoryId) params.set("category", String(opts.categoryId));
    if (opts.difficulty) params.set("difficulty", opts.difficulty);
    if (token) params.set("token", token);


    let resp: Response;
    try {
    resp = await fetch(`${OPENTDB_BASE}/api.php?${params.toString()}`);
} catch (err) {
    return {
     ok: false,
     error: { code: "fetch_failed", message: String(err) },
    };
}


if (!resp.ok) {
    return {
     ok: false,
     error: { code: "fetch_failed", message: `HTTP ${resp.status}` },
    };
}


const data = (await resp.json()) as RawOpenTdbResponse;


switch (data.response_code) {
    case 0:
     return {
         ok: true,
         questions: (data.results ?? []).map(mapResult),
     };
    case 1:
     return { ok: false, error: { code: "no_results" } };
    case 2:
return { ok: false, error: { code: "invalid_params" } };
case 3:
// Token not found — clear and retry once without token
if (!_retried) {
    sessionToken = null;
    tokenFetchedAt = null;
    return fetchOpenTdbQuestions(opts, true);
}
return { ok: false, error: { code: "fetch_failed", message: "Token error" } };
case 4:
// Token exhausted — reset and retry once
if (!_retried) {
    await resetSessionToken();
    return fetchOpenTdbQuestions(opts, true);
}
return { ok: false, error: { code: "no_results" } };
case 5:
return { ok: false, error: { code: "rate_limited" } };
default:
return {
    ok: false,
    error: {
     code: "fetch_failed",
     message: `Unknown response code: ${data.response_code}`,
    },
};
    }
}


