/**
 * Answer grading utilities.
 * Exported so they can be unit-tested independently of the Express router.
 */

import { gradeWithAI } from "../services/geminiApi.ts";

/**
 * Normalise a string for answer comparison:
 *  1. Strip citation markers like [1] or [i]
 *  2. Decompose unicode and drop diacritical marks  (Renée → renee)
 *  3. Lowercase
 *  4. Strip all punctuation / special characters    (Newton. → newton)
 *  5. Collapse whitespace
 *  6. Drop a leading article (the / a / an)         (the Zune → zune)
 */
export function normalize(value: string): string {
    return value
        .trim()
        // 1. citation markers anywhere in the string
        .replace(/\[\w+\]/g, " ")
        // 2. decompose unicode then strip combining diacritical marks (U+0300–U+036F)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        // 3. lowercase
        .toLowerCase()
        // 4. drop everything that is not a letter, digit, or space
        .replace(/[^a-z0-9 ]/g, "")
        // 5. collapse runs of whitespace
        .replace(/\s+/g, " ")
        .trim()
        // 6. strip a leading article
        .replace(/^(?:the|an?) /, "");
}

/**
 * If the normalised correct answer contains two or more words, return the
 * last word (surname / key term).  Otherwise return null.
 *
 * Allows "Jobs" to match "Steve Jobs", "Wozniak" to match "Steve Wozniak", etc.
 */
export function surnameOf(normalizedCorrect: string): string | null {
    const parts = normalizedCorrect.split(" ");
    return parts.length >= 2 ? parts[parts.length - 1]! : null;
}

export async function gradeAnswer(
    questionType: string,
    userAnswer: string,
    correctAnswer: string,
    points: number,
    alternates: string[],
    questionOptions?: Record<string, unknown> | null,
    questionText?: string,
): Promise<{ isCorrect: boolean; pointsEarned: number; feedback?: string }> {
    // ── Short response: AI-graded ─────────────────────────────────────────
    if (questionType === "short_response") {
        const opts    = questionOptions as { rubric?: string } | null;
        return gradeWithAI({
            questionText: questionText ?? "",
            correctAnswer,
            rubric: opts?.rubric,
            userAnswer,
            points,
        });
    }

    // ── Matching: pair-by-pair partial credit ──────────────────────────────
    if (questionType === "matching") {
        const parsePairs = (ans: string): Record<string, string> =>
            ans.split("|").reduce<Record<string, string>>((acc, pair) => {
                const idx = pair.indexOf(":");
                if (idx === -1) return acc;
                acc[normalize(pair.slice(0, idx))] = normalize(pair.slice(idx + 1));
                return acc;
            }, {});

        const correctPairs = parsePairs(correctAnswer);
        const userPairs = parsePairs(userAnswer);
        const total = Object.keys(correctPairs).length;
        if (total === 0) return { isCorrect: true, pointsEarned: points };

        let correctCount = 0;
        for (const [left, right] of Object.entries(userPairs)) {
            if (correctPairs[left] === right) correctCount++;
        }
        const isCorrect = correctCount === total;
        const pointsEarned = Math.floor((correctCount / total) * points);
        return { isCorrect, pointsEarned };
    }

    // ── Image hotspot: Euclidean distance vs radiusPercent ───────────────
    if (questionType === "image_hotspot") {
        const opts         = questionOptions as { radiusPercent?: number } | null;
        const radiusPercent = typeof opts?.radiusPercent === "number" ? opts.radiusPercent : 10;
        const parseCoord   = (s: string): { x: number; y: number } | null => {
            const parts = s.split(",").map(Number);
            if (parts.length < 2 || isNaN(parts[0]!) || isNaN(parts[1]!)) return null;
            return { x: parts[0]!, y: parts[1]! };
        };
        const user    = parseCoord(userAnswer);
        const correct = parseCoord(correctAnswer);
        if (!user || !correct) return { isCorrect: false, pointsEarned: 0 };
        const dist    = Math.sqrt((user.x - correct.x) ** 2 + (user.y - correct.y) ** 2);
        const isCorrect = dist <= radiusPercent;
        return { isCorrect, pointsEarned: isCorrect ? points : 0 };
    }

    // ── Slider: proximity-based partial credit ────────────────────────────
    if (questionType === "slider") {
        const opts      = questionOptions as { tolerance?: number } | null;
        const tolerance = typeof opts?.tolerance === "number" ? opts.tolerance : 0;
        const userVal   = parseFloat(userAnswer);
        const corrVal   = parseFloat(correctAnswer);
        if (isNaN(userVal) || isNaN(corrVal)) return { isCorrect: false, pointsEarned: 0 };
        const distance = Math.abs(userVal - corrVal);
        if (distance <= tolerance) return { isCorrect: true, pointsEarned: points };
        const falloff = tolerance * 2; // range from tolerance → tolerance*3 → 0 pts
        if (falloff <= 0) return { isCorrect: false, pointsEarned: 0 };
        const ratio = Math.min(1, (distance - tolerance) / falloff);
        return { isCorrect: false, pointsEarned: Math.max(0, Math.floor((1 - ratio) * points)) };
    }

    // ── Ordering: positional partial credit ───────────────────────────────
    if (questionType === "ordering") {
        const correctItems = correctAnswer.split("|").map((v) => v.trim()).filter(Boolean);
        const userItems    = userAnswer.split("|").map((v) => v.trim()).filter(Boolean);
        const total = correctItems.length;
        if (total === 0) return { isCorrect: true, pointsEarned: points };
        let correctPositions = 0;
        for (let i = 0; i < total; i++) {
            if (normalize(userItems[i] ?? "") === normalize(correctItems[i] ?? "")) {
                correctPositions++;
            }
        }
        const isCorrect    = correctPositions === total;
        const pointsEarned = Math.floor((correctPositions / total) * points);
        return { isCorrect, pointsEarned };
    }

    // ── Multi-select: exact set match, all-or-nothing ────────────────────
    if (questionType === "multi_select") {
        const parseSet = (s: string): Set<string> =>
            new Set(s.split("|").map((v) => normalize(v)).filter(Boolean));
        const correctSet = parseSet(correctAnswer);
        const userSet    = parseSet(userAnswer);
        const isCorrect  =
            correctSet.size === userSet.size &&
            [...correctSet].every((v) => userSet.has(v));
        return { isCorrect, pointsEarned: isCorrect ? points : 0 };
    }

    // ── All other types: fuzzy string match ───────────────────────────────
    const normUser    = normalize(userAnswer);
    const normCorrect = normalize(correctAnswer);
    const surname     = surnameOf(normCorrect);

    const isCorrect =
        normUser === normCorrect ||
        alternates.some((alt) => normUser === normalize(alt)) ||
        (surname !== null && normUser === surname);

    return { isCorrect, pointsEarned: isCorrect ? points : 0 };
}
