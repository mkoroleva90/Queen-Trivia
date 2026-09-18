/**
 * Pure tally logic shared by the mobile Live tab and the web LiveGameView.
 *
 * Problem: when a host opens a live panel mid-game, tallies must be seeded
 * from persisted answers (the stats endpoint), while socket events arriving
 * before the seed resolves are buffered. The same answer can appear in BOTH
 * the persisted snapshot and the buffer (answers are persisted before their
 * socket event is emitted), so the merge must dedupe per player name — never
 * add the buffer blindly on top of the baseline.
 */

export type QuestionSeedStat = {
  id: number;
  correctCount: number;
  answeredBy?: string[];
};

export type TallyBuffer = {
  /** questionId → player names whose events arrived pre-seed (deduped) */
  answeredBy: Record<number, string[]>;
  /** questionId → names among the buffered ones that answered correctly */
  correctNames: Record<number, string[]>;
};

export function emptyBuffer(): TallyBuffer {
  return { answeredBy: {}, correctNames: {} };
}

/** Record a pre-seed socket event into the buffer (deduped by player name). */
export function bufferEvent(
  buf: TallyBuffer,
  questionId: number,
  playerName: string,
  isCorrect: boolean,
): void {
  const names = buf.answeredBy[questionId] ?? [];
  if (names.includes(playerName)) return;
  buf.answeredBy[questionId] = [...names, playerName];
  if (isCorrect) {
    buf.correctNames[questionId] = [...(buf.correctNames[questionId] ?? []), playerName];
  }
}

export type MergedTallies = {
  answeredBy: Record<number, string[]>;
  correctCount: Record<number, number>;
};

/**
 * Merge the persisted baseline with buffered pre-seed events.
 *
 * A buffered event only contributes (name chip AND correct count) when its
 * player name is absent from the persisted `answeredBy` baseline for that
 * question — otherwise the answer was already included in the snapshot.
 */
export function mergeSeedWithBuffer(
  seedStats: QuestionSeedStat[],
  buf: TallyBuffer,
): MergedTallies {
  const answeredBy: Record<number, string[]> = {};
  const correctCount: Record<number, number> = {};

  for (const st of seedStats) {
    const baseline = st.answeredBy ?? [];
    const names = [...baseline];
    let correct = st.correctCount ?? 0;
    const bufCorrect = buf.correctNames[st.id] ?? [];
    for (const n of buf.answeredBy[st.id] ?? []) {
      if (baseline.includes(n)) continue; // already counted in the snapshot
      names.push(n);
      if (bufCorrect.includes(n)) correct += 1;
    }
    answeredBy[st.id] = names;
    correctCount[st.id] = correct;
  }

  // Buffered questions the stats response didn't cover (e.g. question added
  // after the snapshot) — count them from the buffer alone.
  for (const [qidStr, names] of Object.entries(buf.answeredBy)) {
    const qid = Number(qidStr);
    if (qid in answeredBy) continue;
    answeredBy[qid] = [...names];
    correctCount[qid] = (buf.correctNames[qid] ?? []).length;
  }

  return { answeredBy, correctCount };
}

// ─── Synchronous tally store ────────────────────────────────────────────────
//
// React state updates are asynchronous, so a socket handler that branches on
// a `seeded` state variable can misroute events that arrive between the merge
// and the next render (they'd be buffered forever), and post-seed dedupe
// against stale state can double-count duplicates. The store below is the
// single synchronous source of truth (held in a ref); components mirror its
// snapshots into React state purely for rendering.

export type TallyStore = {
  phase: "buffering" | "live";
  buffer: TallyBuffer;
  answeredBy: Record<number, string[]>;
  correctCount: Record<number, number>;
};

export function createTallyStore(): TallyStore {
  return { phase: "buffering", buffer: emptyBuffer(), answeredBy: {}, correctCount: {} };
}

/**
 * Record a socket answer event. Synchronous and idempotent per player name:
 * duplicates (retries/reconnects) never double-count regardless of timing.
 * Returns true when the visible tallies changed (i.e. a rerender is needed).
 */
export function recordAnswerEvent(
  store: TallyStore,
  questionId: number,
  playerName: string,
  isCorrect: boolean,
): boolean {
  if (store.phase === "buffering") {
    bufferEvent(store.buffer, questionId, playerName, isCorrect);
    return false; // nothing visible until the seed merge
  }
  const names = store.answeredBy[questionId] ?? [];
  if (names.includes(playerName)) return false; // already counted (seed or earlier event)
  store.answeredBy[questionId] = [...names, playerName];
  if (isCorrect) {
    store.correctCount[questionId] = (store.correctCount[questionId] ?? 0) + 1;
  }
  return true;
}

/**
 * Apply the persisted stats snapshot: merges baseline + buffered events
 * (name-deduped) and atomically switches the store to live mode. Any event
 * arriving after this call — even before the next render — is routed by
 * `recordAnswerEvent` against the merged baseline, so nothing is lost or
 * double-counted. Idempotent: repeat calls after going live are ignored.
 */
export function applySeed(store: TallyStore, seedStats: QuestionSeedStat[]): boolean {
  if (store.phase === "live") return false;
  const merged = mergeSeedWithBuffer(seedStats, store.buffer);
  store.answeredBy = merged.answeredBy;
  store.correctCount = merged.correctCount;
  store.buffer = emptyBuffer();
  store.phase = "live";
  return true;
}

/** Reset when the monitored game changes. */
export function resetTallyStore(store: TallyStore): void {
  store.phase = "buffering";
  store.buffer = emptyBuffer();
  store.answeredBy = {};
  store.correctCount = {};
}

// ─── Live answer breakdown ──────────────────────────────────────────────────
//
// The host's live results show, per question, how the submitted answers are
// distributed. Both platforms build the rows through this helper so the
// content is identical: choice questions list every choice (zero counts
// included) in the order the players saw them; every other type lists the
// distinct submitted answers, most chosen first.

export type AnswerBreakdownEntry = {
  answer: string;
  count: number;
  isCorrect: boolean;
};

export type AnswerRow = {
  /** Raw stored answer (matches what players submitted). */
  answer: string;
  /** What to display — the raw answer, except true/false which reads "True" / "False". */
  label: string;
  count: number;
  isCorrect: boolean;
};

/** Question types whose answer is exactly one of a fixed list of choices. */
const CHOICE_QUESTION_TYPES = new Set(["multiple_choice", "true_false", "image_recognition"]);

/**
 * Build the rows of the live answer breakdown for one question.
 *
 * - `choices` is the fixed list the players pick from (multiple choice and
 *   image questions store it in `options.choices`; true/false is always
 *   `["true", "false"]`). For these types every choice is a row, the count
 *   coming from the breakdown, and the correct one is flagged by comparing
 *   with `correctAnswer`.
 * - For every other type the breakdown entries themselves are the rows,
 *   ordered by count, capped at `limit`.
 */
export function buildAnswerRows(
  question: { questionType: string; correctAnswer?: string | null; options?: unknown },
  breakdown: AnswerBreakdownEntry[] | undefined,
  limit = 6,
): AnswerRow[] {
  const entries = breakdown ?? [];
  if (CHOICE_QUESTION_TYPES.has(question.questionType)) {
    const choices = choicesFor(question);
    if (choices.length > 0) {
      const counts = new Map<string, number>();
      for (const e of entries) counts.set(e.answer, (counts.get(e.answer) ?? 0) + e.count);
      const rows: AnswerRow[] = choices.map((choice) => ({
        answer: choice,
        label: labelFor(question.questionType, choice),
        count: counts.get(choice) ?? 0,
        isCorrect: question.correctAnswer != null && choice === question.correctAnswer,
      }));
      // Answers outside the choice list (legacy data) still deserve a row.
      for (const e of entries) {
        if (!choices.includes(e.answer)) {
          rows.push({ answer: e.answer, label: labelFor(question.questionType, e.answer), count: e.count, isCorrect: e.isCorrect });
        }
      }
      return rows;
    }
  }
  return [...entries]
    .sort((a, b) => b.count - a.count || a.answer.localeCompare(b.answer))
    .slice(0, limit)
    .map((e) => ({ answer: e.answer, label: labelFor(question.questionType, e.answer), count: e.count, isCorrect: e.isCorrect }));
}

function labelFor(questionType: string, answer: string): string {
  if (questionType === "true_false") {
    if (answer === "true") return "True";
    if (answer === "false") return "False";
  }
  return answer;
}

function choicesFor(question: { questionType: string; options?: unknown }): string[] {
  if (question.questionType === "true_false") return ["true", "false"];
  const options = question.options;
  if (options && typeof options === "object" && "choices" in options) {
    const choices = (options as { choices?: unknown }).choices;
    if (Array.isArray(choices)) return choices.filter((c): c is string => typeof c === "string");
  }
  return [];
}
