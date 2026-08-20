import assert from "node:assert/strict";
import test from "node:test";
import {
    canUseSurplusFallback,
    computeTypeCounts,
    evaluateQuestionMixOutcome,
    parseQuestions,
} from "./geminiApi.ts";

function countTotal(counts: ReturnType<typeof computeTypeCounts>): number {
    return Object.values(counts).reduce((sum, count) => sum + count, 0);
}

function emptyCounts() {
    return {
        mcCount: 0,
        tfCount: 0,
        wiCount: 0,
        matchCount: 0,
        imgCount: 0,
        orderingCount: 0,
        multiSelectCount: 0,
        sliderCount: 0,
        shortResponseCount: 0,
    };
}

function varietyTotal(counts: ReturnType<typeof computeTypeCounts>): number {
    return counts.wiCount
        + counts.matchCount
        + counts.orderingCount
        + counts.multiSelectCount
        + counts.sliderCount
        + counts.shortResponseCount;
}

test("computeTypeCounts reserves a 3:2:2 core and fills the remainder from variety", () => {
    const five = computeTypeCounts(5);
    assert.equal(five.mcCount, 2);
    assert.equal(five.tfCount, 1);
    assert.equal(five.imgCount, 1);
    assert.equal(varietyTotal(five), 1);

    const ten = computeTypeCounts(10);
    assert.equal(ten.mcCount, 3);
    assert.equal(ten.tfCount, 2);
    assert.equal(ten.imgCount, 2);
    assert.equal(varietyTotal(ten), 3);

    const fifteen = computeTypeCounts(15);
    assert.equal(fifteen.mcCount, 5);
    assert.equal(fifteen.tfCount, 3);
    assert.equal(fifteen.imgCount, 3);
    assert.equal(varietyTotal(fifteen), 4);

    const twenty = computeTypeCounts(20);
    assert.equal(twenty.mcCount, 6);
    assert.equal(twenty.tfCount, 4);
    assert.equal(twenty.imgCount, 4);
    assert.equal(varietyTotal(twenty), 6);
});

test("computeTypeCounts always sums exactly to the requested total", () => {
    for (let total = 0; total <= 40; total++) {
        assert.equal(countTotal(computeTypeCounts(total)), total);
    }
});

test("a full variety pool uses every specialist type before repeating one", () => {
    const counts = computeTypeCounts(20);
    assert.equal(counts.wiCount, 1);
    assert.equal(counts.matchCount, 1);
    assert.equal(counts.orderingCount, 1);
    assert.equal(counts.multiSelectCount, 1);
    assert.equal(counts.sliderCount, 1);
    assert.equal(counts.shortResponseCount, 1);
});

test("surplus fallback never masks missing multiple-choice or true/false core slots", () => {
    assert.equal(canUseSurplusFallback({
        ...emptyCounts(),
        imgCount: 2,
    }), true);
    assert.equal(canUseSurplusFallback({
        ...emptyCounts(),
        orderingCount: 1,
    }), true);
    assert.equal(canUseSurplusFallback({
        ...emptyCounts(),
        mcCount: 1,
    }), false);
    assert.equal(canUseSurplusFallback({
        ...emptyCounts(),
        tfCount: 1,
        imgCount: 1,
    }), false);
});

test("an exact target mix can return successfully without fallback", () => {
    const targets = computeTypeCounts(10);
    const outcome = evaluateQuestionMixOutcome(targets, targets, emptyCounts());
    assert.equal(outcome.canReturnSuccess, true);
    assert.equal(outcome.fallbackAllowed, false);
    assert.equal(outcome.fallbackSlots, 0);
});

test("surplus questions cannot mask a missing fixed core type", () => {
    const targets = computeTypeCounts(10);
    const outcome = evaluateQuestionMixOutcome(targets, {
        ...targets,
        tfCount: 0,
    }, {
        ...emptyCounts(),
        mcCount: 20,
    });
    assert.equal(outcome.canReturnSuccess, false);
    assert.equal(outcome.fallbackAllowed, false);
    assert.equal(outcome.missingCounts.tfCount, targets.tfCount);
});

test("valid surplus can fill an unresolved non-core type shortfall", () => {
    const targets = computeTypeCounts(10);
    const selected = {
        ...targets,
        imgCount: 0,
    };
    const outcome = evaluateQuestionMixOutcome(targets, selected, {
        ...emptyCounts(),
        mcCount: targets.imgCount,
    });
    assert.equal(outcome.canReturnSuccess, true);
    assert.equal(outcome.fallbackAllowed, true);
    assert.equal(outcome.fallbackSlots, targets.imgCount);
});

test("parser normalizes ordering, multi-select, slider, and short-response contracts", () => {
    const questions = parseQuestions([
        {
            question_type: "ordering",
            question_text: "Put these in order",
            items: ["First", "Second", "Third", "Fourth"],
            source: "History source",
        },
        {
            question_type: "multi_select",
            question_text: "Choose the prime numbers",
            options: ["2", "3", "4", "5"],
            correct_options: ["2", "3", "5"],
            source: "Math source",
        },
        {
            question_type: "slider",
            question_text: "How many kilometres?",
            correct_answer: "6650",
            min: 4000,
            max: 9000,
            step: 50,
            unit: "km",
            tolerance: 250,
            source: "Geography source",
        },
        {
            question_type: "short_response",
            question_text: "Why does the Moon show one face?",
            correct_answer: "Tidal locking",
            rubric: "Mention tidal locking or synchronous rotation.",
            max_words: 25,
            source: "NASA",
        },
    ], { topic: "science", difficulty: "medium", amount: 4 });

    assert.equal(questions.length, 4);
    assert.deepEqual(questions[0]?.options, { items: ["First", "Second", "Third", "Fourth"] });
    assert.equal(questions[0]?.correctAnswer, "First|Second|Third|Fourth");
    assert.equal(questions[1]?.correctAnswer, "2|3|5");
    assert.deepEqual(
        [...((questions[1]?.options as { choices: string[] }).choices)].sort(),
        ["2", "3", "4", "5"],
    );
    assert.deepEqual(questions[2]?.options, {
        min: 4000, max: 9000, step: 50, unit: "km", tolerance: 250,
    });
    assert.equal(questions[2]?.correctAnswer, "6650");
    assert.deepEqual(questions[3]?.options, {
        rubric: "Mention tidal locking or synchronous rotation.", maxWords: 25,
    });
});

test("parser drops host-built image_hotspot and malformed specialist payloads", () => {
    const questions = parseQuestions([
        {
            question_type: "image_hotspot",
            question_text: "This must not be accepted",
            correct_answer: "50,50",
        },
        {
            question_type: "slider",
            question_text: "Invalid range",
            correct_answer: "12",
            min: 20,
            max: 10,
            step: 1,
            tolerance: 1,
        },
        {
            question_type: "ordering",
            question_text: "Too few ordering items",
            items: ["First", "Second", "Third"],
        },
        {
            question_type: "ordering",
            question_text: "Duplicate ordering items",
            items: ["First", "Second", "Second", "Fourth"],
        },
        {
            question_type: "multi_select",
            question_text: "Too many selected answers",
            options: ["A", "B", "C", "D", "E"],
            correct_options: ["A", "B", "C", "D"],
        },
        {
            question_type: "slider",
            question_text: "Endpoint answer",
            correct_answer: "0",
            min: 0,
            max: 100,
            step: 1,
            tolerance: 1,
        },
        {
            question_type: "short_response",
            question_text: "Missing rubric",
            correct_answer: "Answer",
        },
    ], { topic: "science", difficulty: "medium", amount: 3 });
    assert.deepEqual(questions, []);
});