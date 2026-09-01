---
name: Live gameplay confidentiality
description: Security boundary for player-visible aggregates and scores while a trivia game is active.
---

During an active game, players may see participant identities and their own
score, but must not receive correctness aggregates, other participants' scores,
or ordering derived from hidden scores. Full aggregate and leaderboard data is
available to the owning host during play and to participants after completion.

**Why:** Probe identities can submit different candidate answers and use any
live correctness count, peer-score delta, or score-based ordering change as an
oracle for the unreleased correct answer.

**How to apply:** Gate player-facing results and correctness aggregates on game
completion. If an active participant list remains visible, omit all score fields
and order it by non-score metadata. Derive a player's personal live score only
from that player's own answer records or submit response.