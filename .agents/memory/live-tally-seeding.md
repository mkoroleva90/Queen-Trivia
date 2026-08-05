---
name: Live tally seeding
description: How to combine a persisted stats snapshot with live socket events without losing or double-counting answers
---

Rule: when a live host view seeds counts from a REST snapshot while also listening to socket events, keep the canonical tallies in a synchronous store held in a ref (`@workspace/live-tally`), not in React state. Dedupe by player name against the merged baseline; buffer pre-seed events and merge atomically.

**Why:** answers are persisted before their socket event is emitted, so the same answer can appear in both the snapshot and the event stream; and React state (`seeded` flags, stale closures) misroutes events that land between the merge and the next commit. Two code reviews rejected naive versions for exactly these races.

**How to apply:** reuse `createTallyStore`/`recordAnswerEvent`/`applySeed` from `lib/live-tally` for any new live-count view (mobile LiveTab, web LiveGameView already do). The stats endpoint returns `answeredBy` names per question to make name-dedup possible.
