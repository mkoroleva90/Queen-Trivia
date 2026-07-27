/**
 * Unit tests for grading utilities.
 * Run with:  node --experimental-strip-types --test src/lib/grading.test.ts
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalize, surnameOf, gradeAnswer } from "./grading.ts";

// ─── normalize ────────────────────────────────────────────────────────────────

describe("normalize", () => {
    it("lowercases and trims", () => {
        assert.equal(normalize("  Newton  "), "newton");
    });

    it("collapses internal whitespace", () => {
        assert.equal(normalize("New   Coke"), "new coke");
    });

    it("strips trailing punctuation", () => {
        assert.equal(normalize("Newton."), "newton");
        assert.equal(normalize("Newton,"), "newton");
        assert.equal(normalize("R101!"), "r101");
    });

    it("strips mid-string punctuation", () => {
        assert.equal(normalize("My.MP3.com"), "mymp3com");
    });

    it("strips citation markers [1]", () => {
        assert.equal(normalize("Newton[1]"), "newton");
        assert.equal(normalize("Newton[i]"), "newton");
    });

    it("strips diacritics", () => {
        assert.equal(normalize("Renée"), "renee");
        assert.equal(normalize("café"), "cafe");
    });

    it("drops leading article 'the'", () => {
        assert.equal(normalize("the Zune"), "zune");
        assert.equal(normalize("The Zune"), "zune");
    });

    it("drops leading article 'a'", () => {
        assert.equal(normalize("a Newton"), "newton");
    });

    it("drops leading article 'an'", () => {
        assert.equal(normalize("an Apple"), "apple");
    });

    it("does not drop articles mid-string", () => {
        assert.equal(normalize("Athe Newton"), "athe newton");
    });
});

// ─── surnameOf ────────────────────────────────────────────────────────────────

describe("surnameOf", () => {
    it("returns null for single-word names", () => {
        assert.equal(surnameOf("newton"), null);
    });

    it("returns last word for multi-word names", () => {
        assert.equal(surnameOf("steve jobs"), "jobs");
        assert.equal(surnameOf("isaac newton"), "newton");
    });
});

// ─── gradeAnswer — write_in ───────────────────────────────────────────────────

describe("gradeAnswer write_in", () => {
    const grade = (user: string, correct: string, alts: string[] = []) =>
        gradeAnswer("write_in", user, correct, 15, alts);

    it("accepts exact match", async () => {
        assert.equal((await grade("Pippin", "Pippin")).isCorrect, true);
    });

    it("accepts case-insensitive match", async () => {
        assert.equal((await grade("pippin", "Pippin")).isCorrect, true);
        assert.equal((await grade("PIPPIN", "Pippin")).isCorrect, true);
    });

    it("accepts match with trailing punctuation", async () => {
        assert.equal((await grade("Newton.", "Newton")).isCorrect, true);
    });

    it("accepts match with leading article 'the'", async () => {
        assert.equal((await grade("the Zune", "Zune")).isCorrect, true);
    });

    it("accepts match with leading article 'a'", async () => {
        assert.equal((await grade("a Newton", "Newton")).isCorrect, true);
    });

    it("accepts match with accented input", async () => {
        // player types the accented form; correct answer has no accent
        assert.equal((await grade("Renée Fleming", "Renee Fleming")).isCorrect, true);
    });

    it("accepts match with citation marker", async () => {
        assert.equal((await grade("Newton[1]", "Newton")).isCorrect, true);
    });

    it("accepts surname alone when correct answer is full name", async () => {
        assert.equal((await grade("Jobs", "Steve Jobs")).isCorrect, true);
        assert.equal((await grade("jobs", "Steve Jobs")).isCorrect, true);
    });

    it("awards full points when correct", async () => {
        assert.equal((await grade("Pippin", "Pippin")).pointsEarned, 15);
    });

    it("rejects a wrong answer", async () => {
        assert.equal((await grade("Zune", "Pippin")).isCorrect, false);
        assert.equal((await grade("Zune", "Pippin")).pointsEarned, 0);
    });

    it("does not accept first name alone", async () => {
        assert.equal((await grade("Steve", "Steve Jobs")).isCorrect, false);
    });

    it("accepts a valid alternate answer", async () => {
        assert.equal((await grade("Apple Pippin", "Pippin", ["Apple Pippin", "Bandai Pippin"])).isCorrect, true);
    });

    it("accepts alternate with trailing punctuation", async () => {
        assert.equal((await grade("Apple Pippin.", "Pippin", ["Apple Pippin"])).isCorrect, true);
    });
});

// ─── gradeAnswer — multiple_choice / true_false ──────────────────────────────

describe("gradeAnswer multiple_choice", () => {
    const grade = (user: string, correct: string) =>
        gradeAnswer("multiple_choice", user, correct, 10, []);

    it("accepts exact match", async () => {
        assert.equal((await grade("New Coke", "New Coke")).isCorrect, true);
    });

    it("rejects wrong answer", async () => {
        assert.equal((await grade("Coke II", "New Coke")).isCorrect, false);
    });

    it("is case-insensitive", async () => {
        assert.equal((await grade("new coke", "New Coke")).isCorrect, true);
    });
});

// ─── gradeAnswer — matching ───────────────────────────────────────────────────

describe("gradeAnswer matching", () => {
    const correct = "France:Paris|Japan:Tokyo|Brazil:Brasilia";

    it("full match awards full points", async () => {
        const r = await gradeAnswer("matching", correct, correct, 20, []);
        assert.equal(r.isCorrect, true);
        assert.equal(r.pointsEarned, 20);
    });

    it("partial match awards partial points", async () => {
        const partial = "France:Paris|Japan:Tokyo|Brazil:WrongCity";
        const r = await gradeAnswer("matching", partial, correct, 20, []);
        assert.equal(r.isCorrect, false);
        assert.equal(r.pointsEarned, Math.floor((2 / 3) * 20));
    });

    it("matching is case-insensitive", async () => {
        const lower = "france:paris|japan:tokyo|brazil:brasilia";
        const r = await gradeAnswer("matching", lower, correct, 20, []);
        assert.equal(r.isCorrect, true);
    });

    it("matching tolerates punctuation in pair values", async () => {
        // e.g. a value with a hyphen stripped by normalize
        const c = "DMC-12:Automotive";
        const u = "DMC12:Automotive";
        const r = await gradeAnswer("matching", u, c, 20, []);
        assert.equal(r.isCorrect, true);
    });
});
