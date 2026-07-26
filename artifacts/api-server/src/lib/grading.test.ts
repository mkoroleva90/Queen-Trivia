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
        assert.equal(normalize("[2] Newton"), "newton");
    });

    it("strips accents / diacritics", () => {
        assert.equal(normalize("Renée"), "renee");
        assert.equal(normalize("Citroën"), "citroen");
        assert.equal(normalize("naïve"), "naive");
    });

    it("strips leading article 'the'", () => {
        assert.equal(normalize("The Zune"), "zune");
        assert.equal(normalize("the Zune"), "zune");
    });

    it("strips leading article 'a'", () => {
        assert.equal(normalize("a Newton"), "newton");
    });

    it("strips leading article 'an'", () => {
        assert.equal(normalize("an Edsel"), "edsel");
    });

    it("does not strip 'the' mid-string", () => {
        assert.equal(normalize("Return of the Jedi"), "return of the jedi");
    });

    it("does not strip 'a' when it is the whole word mid-string", () => {
        // 'a' as an article only stripped when it is the first token
        assert.equal(normalize("Once a Year"), "once a year");
    });
});

// ─── surnameOf ────────────────────────────────────────────────────────────────

describe("surnameOf", () => {
    it("returns the last word of a multi-word string", () => {
        assert.equal(surnameOf("steve jobs"), "jobs");
        assert.equal(surnameOf("new coke"), "coke");
    });

    it("returns null for a single word", () => {
        assert.equal(surnameOf("newton"), null);
    });

    it("returns null for an empty string", () => {
        assert.equal(surnameOf(""), null);
    });
});

// ─── gradeAnswer — write_in ───────────────────────────────────────────────────

describe("gradeAnswer write_in", () => {
    const grade = (user: string, correct: string, alts: string[] = []) =>
        gradeAnswer("write_in", user, correct, 15, alts);

    it("accepts exact match", () => {
        assert.equal(grade("Pippin", "Pippin").isCorrect, true);
    });

    it("accepts case-insensitive match", () => {
        assert.equal(grade("pippin", "Pippin").isCorrect, true);
        assert.equal(grade("PIPPIN", "Pippin").isCorrect, true);
    });

    it("accepts match with trailing punctuation", () => {
        assert.equal(grade("Newton.", "Newton").isCorrect, true);
    });

    it("accepts match with leading article 'the'", () => {
        assert.equal(grade("the Zune", "Zune").isCorrect, true);
    });

    it("accepts match with leading article 'a'", () => {
        assert.equal(grade("a Newton", "Newton").isCorrect, true);
    });

    it("accepts match with accented input", () => {
        // player types the accented form; correct answer has no accent
        assert.equal(grade("Renée Fleming", "Renee Fleming").isCorrect, true);
    });

    it("accepts match with citation marker", () => {
        assert.equal(grade("Newton[1]", "Newton").isCorrect, true);
    });

    it("accepts surname alone when correct answer is full name", () => {
        assert.equal(grade("Jobs", "Steve Jobs").isCorrect, true);
        assert.equal(grade("jobs", "Steve Jobs").isCorrect, true);
    });

    it("awards full points when correct", () => {
        assert.equal(grade("Pippin", "Pippin").pointsEarned, 15);
    });

    it("rejects a wrong answer", () => {
        assert.equal(grade("Zune", "Pippin").isCorrect, false);
        assert.equal(grade("Zune", "Pippin").pointsEarned, 0);
    });

    it("does not accept first name alone", () => {
        assert.equal(grade("Steve", "Steve Jobs").isCorrect, false);
    });

    it("accepts a valid alternate answer", () => {
        assert.equal(grade("Apple Pippin", "Pippin", ["Apple Pippin", "Bandai Pippin"]).isCorrect, true);
    });

    it("accepts alternate with trailing punctuation", () => {
        assert.equal(grade("Apple Pippin.", "Pippin", ["Apple Pippin"]).isCorrect, true);
    });
});

// ─── gradeAnswer — multiple_choice / true_false ──────────────────────────────

describe("gradeAnswer multiple_choice", () => {
    const grade = (user: string, correct: string) =>
        gradeAnswer("multiple_choice", user, correct, 10, []);

    it("accepts exact match", () => {
        assert.equal(grade("New Coke", "New Coke").isCorrect, true);
    });

    it("rejects wrong answer", () => {
        assert.equal(grade("Coke II", "New Coke").isCorrect, false);
    });

    it("is case-insensitive", () => {
        assert.equal(grade("new coke", "New Coke").isCorrect, true);
    });
});

// ─── gradeAnswer — matching ───────────────────────────────────────────────────

describe("gradeAnswer matching", () => {
    const correct = "France:Paris|Japan:Tokyo|Brazil:Brasilia";

    it("full match awards full points", () => {
        const r = gradeAnswer("matching", correct, correct, 20, []);
        assert.equal(r.isCorrect, true);
        assert.equal(r.pointsEarned, 20);
    });

    it("partial match awards partial points", () => {
        const partial = "France:Paris|Japan:Tokyo|Brazil:WrongCity";
        const r = gradeAnswer("matching", partial, correct, 20, []);
        assert.equal(r.isCorrect, false);
        assert.equal(r.pointsEarned, Math.floor((2 / 3) * 20));
    });

    it("matching is case-insensitive", () => {
        const lower = "france:paris|japan:tokyo|brazil:brasilia";
        const r = gradeAnswer("matching", lower, correct, 20, []);
        assert.equal(r.isCorrect, true);
    });

    it("matching tolerates punctuation in pair values", () => {
        // e.g. a value with a hyphen stripped by normalize
        const c = "DMC-12:Automotive";
        const u = "DMC12:Automotive";
        const r = gradeAnswer("matching", u, c, 20, []);
        assert.equal(r.isCorrect, true);
    });
});
