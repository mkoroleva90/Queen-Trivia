import { test } from "node:test";
import assert from "node:assert/strict";
import {
  emptyBuffer,
  bufferEvent,
  mergeSeedWithBuffer,
  createTallyStore,
  recordAnswerEvent,
  applySeed,
  resetTallyStore,
} from "./index.ts";

test("seed only: baseline passes through unchanged", () => {
  const merged = mergeSeedWithBuffer(
    [{ id: 1, correctCount: 2, answeredBy: ["Ana", "Bo", "Cy"] }],
    emptyBuffer(),
  );
  assert.deepEqual(merged.answeredBy[1], ["Ana", "Bo", "Cy"]);
  assert.equal(merged.correctCount[1], 2);
});

test("race: answer present in snapshot AND buffered event is not double-counted", () => {
  // Ana's answer was persisted before the stats query ran, so the snapshot
  // already includes her (correctCount 1). Her socket event then arrived
  // pre-seed and was buffered. She must be counted exactly once.
  const buf = emptyBuffer();
  bufferEvent(buf, 1, "Ana", true);
  const merged = mergeSeedWithBuffer(
    [{ id: 1, correctCount: 1, answeredBy: ["Ana"] }],
    buf,
  );
  assert.deepEqual(merged.answeredBy[1], ["Ana"]);
  assert.equal(merged.correctCount[1], 1);
});

test("race mix: only buffered players missing from the snapshot are added", () => {
  const buf = emptyBuffer();
  bufferEvent(buf, 1, "Ana", true); // already in snapshot → ignored
  bufferEvent(buf, 1, "Dee", true); // new correct → +1
  bufferEvent(buf, 1, "Eli", false); // new wrong → chip only
  const merged = mergeSeedWithBuffer(
    [{ id: 1, correctCount: 1, answeredBy: ["Ana", "Bo"] }],
    buf,
  );
  assert.deepEqual(merged.answeredBy[1], ["Ana", "Bo", "Dee", "Eli"]);
  assert.equal(merged.correctCount[1], 2);
});

test("duplicate buffered events for the same player are deduped", () => {
  const buf = emptyBuffer();
  bufferEvent(buf, 1, "Ana", true);
  bufferEvent(buf, 1, "Ana", true); // socket retry / reconnect duplicate
  const merged = mergeSeedWithBuffer([{ id: 1, correctCount: 0, answeredBy: [] }], buf);
  assert.deepEqual(merged.answeredBy[1], ["Ana"]);
  assert.equal(merged.correctCount[1], 1);
});

test("buffered question missing from the snapshot is kept", () => {
  const buf = emptyBuffer();
  bufferEvent(buf, 9, "Ana", true);
  bufferEvent(buf, 9, "Bo", false);
  const merged = mergeSeedWithBuffer([{ id: 1, correctCount: 0, answeredBy: [] }], buf);
  assert.deepEqual(merged.answeredBy[9], ["Ana", "Bo"]);
  assert.equal(merged.correctCount[9], 1);
});

test("snapshot without answeredBy list still seeds correct counts", () => {
  const merged = mergeSeedWithBuffer([{ id: 1, correctCount: 3 }], emptyBuffer());
  assert.deepEqual(merged.answeredBy[1], []);
  assert.equal(merged.correctCount[1], 3);
});

// ─── TallyStore: atomic snapshot/socket handoff ─────────────────────────────

test("store: event arriving immediately after applySeed (before any rerender) is applied, not lost", () => {
  const store = createTallyStore();
  // Pre-seed event buffered
  recordAnswerEvent(store, 1, "Ana", true);
  // Snapshot already contains Ana (persist-before-emit race)
  applySeed(store, [{ id: 1, correctCount: 1, answeredBy: ["Ana"] }]);
  // Event lands right after the merge, before React would commit `seeded`.
  // With the synchronous store there is no stale-closure window: it is
  // routed against the merged baseline immediately.
  const changed = recordAnswerEvent(store, 1, "Bo", true);
  assert.equal(changed, true);
  assert.deepEqual(store.answeredBy[1], ["Ana", "Bo"]);
  assert.equal(store.correctCount[1], 2);
});

test("store: duplicate post-seed events for the same player never double-count", () => {
  const store = createTallyStore();
  applySeed(store, [{ id: 1, correctCount: 0, answeredBy: [] }]);
  assert.equal(recordAnswerEvent(store, 1, "Ana", true), true);
  // Duplicate delivered before any render/commit — deduped synchronously.
  assert.equal(recordAnswerEvent(store, 1, "Ana", true), false);
  assert.equal(recordAnswerEvent(store, 1, "Ana", true), false);
  assert.deepEqual(store.answeredBy[1], ["Ana"]);
  assert.equal(store.correctCount[1], 1);
});

test("store: post-seed event for a player already in the snapshot is ignored", () => {
  const store = createTallyStore();
  applySeed(store, [{ id: 1, correctCount: 1, answeredBy: ["Ana"] }]);
  assert.equal(recordAnswerEvent(store, 1, "Ana", true), false);
  assert.equal(store.correctCount[1], 1);
});

test("store: applySeed is idempotent once live", () => {
  const store = createTallyStore();
  applySeed(store, [{ id: 1, correctCount: 1, answeredBy: ["Ana"] }]);
  recordAnswerEvent(store, 1, "Bo", true);
  // A second (late/refetched) seed application must not clobber live counts.
  assert.equal(applySeed(store, [{ id: 1, correctCount: 1, answeredBy: ["Ana"] }]), false);
  assert.deepEqual(store.answeredBy[1], ["Ana", "Bo"]);
  assert.equal(store.correctCount[1], 2);
});

test("store: reset returns to buffering for a new game", () => {
  const store = createTallyStore();
  applySeed(store, [{ id: 1, correctCount: 1, answeredBy: ["Ana"] }]);
  resetTallyStore(store);
  assert.equal(store.phase, "buffering");
  assert.equal(recordAnswerEvent(store, 2, "Bo", true), false); // buffered
  applySeed(store, [{ id: 2, correctCount: 0, answeredBy: [] }]);
  assert.deepEqual(store.answeredBy[2], ["Bo"]);
  assert.equal(store.correctCount[2], 1);
});
