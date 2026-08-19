import assert from "node:assert/strict";
import test from "node:test";
import {
    canUseSurplusFallback,
    computeTypeCounts,
    evaluateQuestionMixOutcome,
} from "./geminiApi.ts";

test("computeTypeCounts uses the required largest-remainder outcomes", () => {
    assert.deepEqual(computeTypeCounts(5), {
        mcCount: 2,
        tfCount: 1,
        wiCount: 1,
        matchCount: 0,
        imgCount: 1,
    });
    assert.deepEqual(computeTypeCounts(10), {
        mcCount: 3,
        tfCount: 2,
        wiCount: 2,
        matchCount: 1,
        imgCount: 2,
    });
    assert.deepEqual(computeTypeCounts(15), {
        mcCount: 5,
        tfCount: 3,
        wiCount: 3,
        matchCount: 1,
        imgCount: 3,
    });
    assert.deepEqual(computeTypeCounts(20), {
        mcCount: 6,
        tfCount: 4,
        wiCount: 4,
        matchCount: 2,
        imgCount: 4,
    });
});

test("computeTypeCounts always sums exactly to the requested total", () => {
    for (let total = 0; total <= 40; total++) {
        const counts = computeTypeCounts(total);
        assert.equal(
            counts.mcCount + counts.tfCount + counts.wiCount + counts.matchCount + counts.imgCount,
            total,
        );
    }
});

test("surplus fallback is limited to unresolved image lookup slots", () => {
    assert.equal(canUseSurplusFallback({
        mcCount: 0,
        tfCount: 0,
        wiCount: 0,
        matchCount: 0,
        imgCount: 2,
    }), true);

    assert.equal(canUseSurplusFallback({
        mcCount: 0,
        tfCount: 1,
        wiCount: 0,
        matchCount: 0,
        imgCount: 0,
    }), false);

    assert.equal(canUseSurplusFallback({
        mcCount: 0,
        tfCount: 1,
        wiCount: 0,
        matchCount: 0,
        imgCount: 1,
    }), false);
});

test("an exact target mix can return successfully without fallback", () => {
    const targets = computeTypeCounts(10);
    const outcome = evaluateQuestionMixOutcome(targets, targets, {
        mcCount: 0,
        tfCount: 0,
        wiCount: 0,
        matchCount: 0,
        imgCount: 0,
    });
    assert.equal(outcome.canReturnSuccess, true);
    assert.equal(outcome.fallbackAllowed, false);
    assert.equal(outcome.fallbackSlots, 0);
});

test("surplus multiple choice cannot mask missing required non-image types", () => {
    const outcome = evaluateQuestionMixOutcome(computeTypeCounts(10), {
        mcCount: 3,
        tfCount: 0,
        wiCount: 0,
        matchCount: 0,
        imgCount: 0,
    }, {
        mcCount: 17,
        tfCount: 0,
        wiCount: 0,
        matchCount: 0,
        imgCount: 0,
    });
    assert.equal(outcome.canReturnSuccess, false);
    assert.equal(outcome.fallbackAllowed, false);
    assert.deepEqual(outcome.missingCounts, {
        mcCount: 0,
        tfCount: 2,
        wiCount: 2,
        matchCount: 1,
        imgCount: 2,
    });
});

test("valid surplus can explicitly fill an unrecoverable image-only shortfall", () => {
    const outcome = evaluateQuestionMixOutcome(computeTypeCounts(10), {
        mcCount: 3,
        tfCount: 2,
        wiCount: 2,
        matchCount: 1,
        imgCount: 0,
    }, {
        mcCount: 2,
        tfCount: 0,
        wiCount: 0,
        matchCount: 0,
        imgCount: 0,
    });
    assert.equal(outcome.canReturnSuccess, true);
    assert.equal(outcome.fallbackAllowed, true);
    assert.equal(outcome.fallbackSlots, 2);
});