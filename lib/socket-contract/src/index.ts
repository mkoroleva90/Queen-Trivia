/**
 * @workspace/socket-contract
 *
 * Single source of truth for the Socket.IO event contract shared by the
 * server, the web app, and the mobile app.
 *
 * Rules:
 *  - Do not add events here that do not exist in the running system.
 *  - Do not change string values — they must stay byte-identical to what the
 *    server and clients already emit / subscribe to, or live gameplay breaks.
 *  - Payload shapes must match what the server actually sends (checked by the
 *    generic safeEmit helper in api-server/src/lib/socket.ts).
 *
 * Removed from all three original copies:
 *  - "player:joined" — was declared in all three type maps but was never
 *    emitted by the server and never subscribed to by either client.
 */

// ── Server → Client ──────────────────────────────────────────────────────────

export type ServerToClientEvents = {
  "game:started": (payload: { gameId: number; topic: string }) => void;
  "game:ended": (payload: { gameId: number }) => void;
  "answer:submitted": (payload: {
    gameId: number;
    questionId: number;
    playerName: string;
    isCorrect: boolean;
  }) => void;
};

// ── Client → Server ──────────────────────────────────────────────────────────

export type ClientToServerEvents = {
  "lobby:join": () => void;
  "game:join": (gameId: number) => void;
};
