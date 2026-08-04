/**
 * Deterministic pre-screen for prompt-injection attempts in player answers.
 *
 * Legitimate trivia answers never need to talk about instructions, prompts,
 * grading output, or JSON — an answer matching any of these patterns is
 * rejected (scored 0) instead of being sent to the AI grader.
 *
 * Kept in its own module (no external dependencies) so it can be unit-tested
 * with Node's type-stripping test runner.
 */

const INJECTION_PATTERNS: RegExp[] = [
    /\b(?:ignore|disregard|forget|override)\b[\s\S]{0,40}\b(?:instructions?|prompts?|rules?|directives?)\b/i,
    /\b(?:system|developer)\s+(?:prompt|message|instruction)/i,
    /\bnew\s+instructions?\b/i,
    /\byou\s+are\s+(?:now|no\s+longer)\b/i,
    /\brespond\s+(?:only\s+)?with\b/i,
    /\b(?:output|return|reply\s+with)\b[\s\S]{0,40}\bjson\b/i,
    /["']?\bisCorrect\b["']?\s*[:=]/i,
    /["']?\bpointsEarned\b["']?\s*[:=]/i,
    /\bmark\s+(?:this|my|it)\s+(?:as\s+)?correct\b/i,
    /\baward\b[\s\S]{0,30}\bpoints?\b/i,
    /\bfull\s+(?:points|marks|credit)\b/i,
];

export function looksLikePromptInjection(answer: string): boolean {
    return INJECTION_PATTERNS.some((re) => re.test(answer));
}
