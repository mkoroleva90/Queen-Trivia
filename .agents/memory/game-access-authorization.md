---
name: Game access authorization
description: Durable rule for player game access after retiring cross-game bridging.
---

Only a server-recorded room-code grant or an existing participant record may
authorize a player to join or discover a game. Client session and mobile-token
game-ID claims are not authorization evidence.

**Why:** Session/token claims cannot reliably distinguish a room-code grant from
the retired cross-game bridge, so trusting them lets old or forged client state
cross a game's access-code boundary.

**How to apply:** Any new player-facing game route or live room subscription
must verify one of those server-side records before returning game metadata or
permitting game actions. When adding a convenience transition between games,
model an explicit server-side host grant; never copy access solely because
games share a host. Legacy admin sessions have no tenant identity and may only
manage ownerless migration games.