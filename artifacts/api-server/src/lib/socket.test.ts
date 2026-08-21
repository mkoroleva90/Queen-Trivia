import { createServer } from "node:http";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import pg from "pg";
import type { IRouter } from "express";
import {
  io as createClient,
  type Socket,
} from "../../../trivia-game/node_modules/socket.io-client/build/esm/index.js";

process.env.SESSION_SECRET = "test-secret-for-unit-tests-32chars!!";

const {
  default: app,
  router,
  initSocket,
  safeEmit,
} = await import("../../dist/app.mjs") as {
  default: import("express").Express;
  router: IRouter;
  initSocket: (server: import("node:http").Server) => import("socket.io").Server;
  safeEmit: (
    room: string,
    event: "game:ended",
    payload: { gameId: number },
  ) => void;
};

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set to run socket.test.ts");
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// This route exists only in the integration-test process. It creates an
// email-authenticated host session without exercising the unrelated login flow.
(router as IRouter).post("/test-set-socket-admin-session", (req, res): void => {
  const adminAccountId = (req.body as { adminAccountId?: unknown })?.adminAccountId;
  if (!Number.isSafeInteger(adminAccountId) || adminAccountId <= 0) {
    res.status(400).json({ error: "adminAccountId is required" });
    return;
  }
  req.session.isAdmin = true;
  req.session.adminAccountId = adminAccountId;
  req.session.save(() => res.json({ ok: true }));
});

// Simulates a pre-email-auth legacy cookie. It has no tenant identity and must
// not receive events from a game owned by an email-authenticated host.
(router as IRouter).post("/test-set-legacy-socket-admin-session", (req, res): void => {
  req.session.isAdmin = true;
  req.session.adminAccountId = undefined;
  req.session.save(() => res.json({ ok: true }));
});

function listen(server: import("node:http").Server): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Socket test server did not expose a TCP port"));
        return;
      }
      resolve(address.port);
    });
  });
}

function connect(port: number, cookie: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const client = createClient(`http://127.0.0.1:${port}`, {
      path: "/api/socket.io",
      transports: ["websocket"],
      extraHeaders: { Cookie: cookie },
      timeout: 1_000,
    });
    client.once("connect", () => resolve(client));
    client.once("connect_error", reject);
  });
}

async function waitFor(
  predicate: () => boolean,
  timeoutMs = 1_000,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return predicate();
}

describe("Socket.IO host game-room ownership", () => {
  let httpServer: import("node:http").Server;
  let ioServer: import("socket.io").Server;
  let port: number;
  let ownGameId: number;
  let foreignGameId: number;
  let ownerCookie: string;
  let ownerSocket: Socket;
  let foreignSocket: Socket;
  let legacySocket: Socket;
  let ownerAdminId: number;
  let foreignAdminId: number;

  before(async () => {
    const suffix = `${process.pid}-${Date.now()}`;
    const owners = await pool.query<{ id: number }>(
      `INSERT INTO admin_accounts (email, email_verified)
       VALUES ($1, true), ($2, true)
       RETURNING id`,
      [`__test__socket_owner_${suffix}@example.test`, `__test__socket_foreign_${suffix}@example.test`],
    );
    ownerAdminId = owners.rows[0]!.id;
    foreignAdminId = owners.rows[1]!.id;

    const games = await pool.query<{ id: number }>(
      `INSERT INTO games
        (topic, difficulty, question_count, status, access_code, created_by_admin, owner_admin_id)
       VALUES
        ($1, 'easy', 0, 'active', $2, true, $3),
        ($4, 'easy', 0, 'active', $5, true, $6)
       RETURNING id`,
      [
        "Socket owner game",
        `TSOCKA${suffix}`,
        ownerAdminId,
        "Socket foreign game",
        `TSOCKB${suffix}`,
        foreignAdminId,
      ],
    );
    ownGameId = games.rows[0]!.id;
    foreignGameId = games.rows[1]!.id;

    const agent = request.agent(app);
    const session = await agent
      .post("/api/test-set-socket-admin-session")
      .send({ adminAccountId: ownerAdminId });
    assert.equal(session.status, 200);
    ownerCookie = session.headers["set-cookie"]![0]!.split(";")[0]!;

    httpServer = createServer(app);
    ioServer = initSocket(httpServer);
    port = await listen(httpServer);
    ownerSocket = await connect(port, ownerCookie);

    const foreignAgent = request.agent(app);
    const foreignSession = await foreignAgent
      .post("/api/test-set-socket-admin-session")
      .send({ adminAccountId: foreignAdminId });
    assert.equal(foreignSession.status, 200);
    const foreignCookie = foreignSession.headers["set-cookie"]![0]!.split(";")[0]!;
    foreignSocket = await connect(port, foreignCookie);

    const legacyAgent = request.agent(app);
    const legacySession = await legacyAgent.post("/api/test-set-legacy-socket-admin-session");
    assert.equal(legacySession.status, 200);
    const legacyCookie = legacySession.headers["set-cookie"]![0]!.split(";")[0]!;
    legacySocket = await connect(port, legacyCookie);
  });

  after(async () => {
    ownerSocket?.disconnect();
    foreignSocket?.disconnect();
    legacySocket?.disconnect();
    await new Promise<void>((resolve) => ioServer.close(() => resolve()));
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    await pool.query("DELETE FROM games WHERE id = ANY($1)", [[ownGameId, foreignGameId]]);
    await pool.query("DELETE FROM admin_accounts WHERE id = ANY($1)", [[ownerAdminId, foreignAdminId]]);
    await pool.end();
  });

  it("admits a host to its owned game room and delivers its live events", async () => {
    ownerSocket.emit("game:join", ownGameId);
    const joined = await waitFor(() =>
      ioServer.sockets.adapter.rooms.get(`game:${ownGameId}`)?.has(ownerSocket.id) ?? false,
    );
    assert.equal(joined, true, "host must join its own game room");

    const received = new Promise<{ gameId: number }>((resolve) => {
      ownerSocket.once("game:ended", resolve);
    });
    safeEmit(`game:${ownGameId}`, "game:ended", { gameId: ownGameId });
    assert.deepEqual(await received, { gameId: ownGameId });
  });

  it("returns summary totals for only the authenticated host's games", async () => {
    const stats = await request(app)
      .get("/api/stats/summary")
      .set("Cookie", ownerCookie);

    assert.equal(stats.status, 200);
    assert.deepEqual(stats.body, {
      totalGames: 1,
      activeGames: 1,
      totalPlayers: 0,
      totalAnswers: 0,
    });
  });

  it("places admins in tenant-specific lobbies instead of a global room", async () => {
    ownerSocket.emit("lobby:join");
    legacySocket.emit("lobby:join");
    const joined = await waitFor(() =>
      (ioServer.sockets.adapter.rooms.get(`lobby:host:${ownerAdminId}`)?.has(ownerSocket.id) ?? false)
      && (ioServer.sockets.adapter.rooms.get("lobby:legacy")?.has(legacySocket.id) ?? false),
    );

    assert.equal(joined, true, "admin lobby subscriptions must be tenant-specific");
    assert.equal(
      ioServer.sockets.adapter.rooms.get("lobby")?.has(ownerSocket.id) ?? false,
      false,
      "a host must not join the former global lobby",
    );
  });

  it("rejects a host from another tenant's room and withholds its live events", async () => {
    ownerSocket.emit("game:join", foreignGameId);
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(
      ioServer.sockets.adapter.rooms.get(`game:${foreignGameId}`)?.has(ownerSocket.id) ?? false,
      false,
      "host must not join a game owned by another account",
    );

    let received = false;
    ownerSocket.once("game:ended", () => {
      received = true;
    });
    foreignSocket.emit("game:join", foreignGameId);
    const foreignJoined = await waitFor(() =>
      ioServer.sockets.adapter.rooms.get(`game:${foreignGameId}`)?.has(foreignSocket.id) ?? false,
    );
    assert.equal(foreignJoined, true, "owning host must join its game room");

    safeEmit(`game:${foreignGameId}`, "game:ended", { gameId: foreignGameId });
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(received, false, "foreign host must not receive another tenant's live events");
  });

  it("rejects a legacy admin from an owned tenant's live and host rooms", async () => {
    legacySocket.emit("game:join", foreignGameId);
    await new Promise((resolve) => setTimeout(resolve, 100));

    assert.equal(
      ioServer.sockets.adapter.rooms.get(`game:${foreignGameId}`)?.has(legacySocket.id) ?? false,
      false,
      "legacy admin must not join another host's live room",
    );
    assert.equal(
      ioServer.sockets.adapter.rooms.get(`game:host:${foreignGameId}`)?.has(legacySocket.id) ?? false,
      false,
      "legacy admin must not join another host's private event room",
    );
  });
});