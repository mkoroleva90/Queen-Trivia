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
