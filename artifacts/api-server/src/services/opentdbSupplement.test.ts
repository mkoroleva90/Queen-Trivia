import assert from "node:assert/strict";
import test from "node:test";
import type { GeminiQuestion } from "./geminiApi.ts";
import type { OpenTdbQuestion } from "./triviaApi.ts";
import {
    computeExtendedVarietyTargets,
    mergeSupplementedQuestions,
    parseOpenTdbImportMode,
    splitOpenTdbAndAiCounts,
    SURPRISE_VARIETY_TYPES,
} from "./opentdbSupplement.ts";
import { computeVarietyOnlyTypeCounts } from "./geminiApi.ts";

test("OpenTDB imports default to standard mode and reject unknown modes", () => {
    assert.equal(parseOpenTdbImportMode(undefined), "standard");
    assert.equal(parseOpenTdbImportMode("standard"), "standard");
    assert.equal(parseOpenTdbImportMode("extended"), "extended");
    assert.equal(parseOpenTdbImportMode("surprise"), "surprise");
    assert.equal(parseOpenTdbImportMode("ai-only"), null);
    assert.equal(parseOpenTdbImportMode(123), null);
});

test("extended and surprise use exact OpenTDB-favoring split checkpoints", () => {
    const extended = [
        [10, 7, 3], [15, 11, 4], [20, 14, 6], [25, 18, 7], [30, 21, 9],
    ] as const;
    const surprise = [
        [10, 6, 4], [15, 9, 6], [20, 12, 8], [25, 15, 10], [30, 18, 12],
    ] as const;

    for (const [total, openTdbCount, aiCount] of extended) {
        assert.deepEqual(splitOpenTdbAndAiCounts(total, 0.3), { openTdbCount, aiCount });
    }
    for (const [total, openTdbCount, aiCount] of surprise) {
        assert.deepEqual(splitOpenTdbAndAiCounts(total, 0.4), { openTdbCount, aiCount });
    }
});

test("extended variety targets use the fixed even largest-remainder allocation", () => {
    assert.deepEqual(computeExtendedVarietyTargets(3), {
        write_in: 1, ordering: 1, multi_select: 1,
    });
    assert.deepEqual(computeExtendedVarietyTargets(4), {
        write_in: 2, ordering: 1, multi_select: 1,
    });
    assert.deepEqual(computeExtendedVarietyTargets(7), {
        write_in: 3, ordering: 2, multi_select: 2,
    });
    assert.deepEqual(computeExtendedVarietyTargets(9), {
        write_in: 3, ordering: 3, multi_select: 3,
    });
});

test("surprise targets stay specialist-only, capped at two, and vary across runs", () => {
    const signatures = new Set<string>();
    for (let run = 0; run < 20; run++) {
        const targets = computeVarietyOnlyTypeCounts(8, SURPRISE_VARIETY_TYPES, 2);
        const entries = Object.entries(targets);
        assert.equal(entries.reduce((sum, [, count]) => sum + (count ?? 0), 0), 8);
        assert.ok(entries.every(([type, count]) =>
            SURPRISE_VARIETY_TYPES.includes(type as typeof SURPRISE_VARIETY_TYPES[number])
            && count !== undefined
            && count <= 2,
        ));
        assert.equal("multiple_choice" in targets, false);
        assert.equal("true_false" in targets, false);
        assert.equal("image_recognition" in targets, false);
        signatures.add(entries.sort(([a], [b]) => a.localeCompare(b)).map(([type, count]) => `${type}:${count}`).join(","));
    }
    assert.ok(signatures.size > 1, "surprise generation should not use one fixed specialist set");
});

function openTdbQuestion(index: number): OpenTdbQuestion {
    return {
        questionText: `OpenTDB question ${index}`,
        questionType: "multiple_choice",
        correctAnswer: "Correct",
        options: { choices: ["Correct", "A", "B", "C"] },
        points: 10,
        orderIndex: index,
        source: "opentdb",
    };
}

function aiQuestion(index: number): GeminiQuestion {
    return {
        questionText: `AI write-in ${index}`,
        questionType: "write_in",
        correctAnswer: "Answer",
        options: null,
        imageUrl: null,
        factCheckUrl: null,
        points: 15,
        orderIndex: index,
        source: "AI Generated: Geography",
        aiGenerated: true,
        verifiedByAdmin: false,
    };
}

test("AI shortfalls can be backfilled without losing the requested total or adding images", () => {
    const combined = mergeSupplementedQuestions(
        Array.from({ length: 7 }, (_, index) => openTdbQuestion(index)),
        [aiQuestion(1), aiQuestion(2)],
        [openTdbQuestion(8)],
        10,
    );

    assert.ok(combined);
    assert.equal(combined.length, 10);
    assert.equal(combined.filter((question) => "aiGenerated" in question).length, 2);
    assert.equal(combined.filter((question) => question.source === "opentdb").length, 8);
    assert.deepEqual(combined.map((question) => question.orderIndex).sort((a, b) => a - b), [
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
    ]);
    assert.equal(combined.some((question) => question.questionType === "image_recognition"), false);
});
