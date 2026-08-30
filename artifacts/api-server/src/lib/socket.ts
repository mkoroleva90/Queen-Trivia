
import { Server as SocketIOServer } from "socket.io";
import { createAdapter } from "@socket.io/postgres-adapter";
import type { Server as HTTPServer } from "node:http";
import type { Request, Response } from "express";
import type { NextFunction } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, gameParticipantsTable, gamesTable, pool } from "@workspace/db";
import { logger } from "./logger.ts";
import { sessionMiddleware } from "./session.ts";
import { corsOrigin, isOriginAllowed } from "./cors.ts";
import { injectMobileSession } from "./mobileAuth.ts";
import type { ServerToClientEvents, ClientToServerEvents } from "@workspace/socket-contract";

export type { ServerToClientEvents, ClientToServerEvents };

type IO = SocketIOServer<ClientToServerEvents, ServerToClientEvents>;

let io: IO | null = null;

const GAME_JOIN_WINDOW_MS = 10_000;
export function initSocket(server: HTTPServer): IO {
  io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(server, {
    path: "/api/socket.io",
    cors: { origin: corsOrigin, credentials: true },
    // Reject handshakes from untrusted origins outright (not just omit CORS
    // headers) so no authenticated socket channel exists cross-origin.
    allowRequest: (req, callback) => {
      const origin = req.headers.origin;
      if (!isOriginAllowed(origin)) {
        logger.debug({ origin }, "Socket handshake rejected: disallowed origin");
        callback("Origin not allowed", false);
        return;
      }
      callback(null, true);
    },
    transports: ["polling", "websocket"],
  });
  io.adapter(createAdapter(pool));

  io.use((socket, next) => {
    sessionMiddleware(
      socket.request as Request,
      {} as Response,
      next as NextFunction,
    );
  });

  // Inject mobile Bearer-token auth for Expo/React Native clients that
  // cannot carry cookies. The token is passed in socket.handshake.auth.token
  // (set by useSocket.ts on every connect/reconnect).
  io.use(async (socket, next) => {
    const token = (socket.handshake.auth as { token?: string })?.token;
    if (token) {
      const req = socket.request as Request;
      // Temporarily set the Authorization header so injectMobileSession can
      // validate the HMAC token and populate req.session identically to HTTP.
      req.headers.authorization = `Bearer ${token}`;
      await new Promise<void>((resolve) => {
        void injectMobileSession(req, {} as Response, () => resolve());
      });
    }
    next();
  });

  io.on("connection", (socket) => {
    logger.debug({ socketId: socket.id }, "Socket connected");

    const req = socket.request as Request;
    socket.data.userId = req.session.userId;
    socket.data.isAdmin = req.session.isAdmin === true;
    socket.data.adminAccountId = req.session.adminAccountId;
    socket.data.adminEmail = req.session.adminEmail;
    socket.data.sessionId = req.sessionID;

    const recentGameJoinAt: number[] = [];
    const pendingGameJoins = new Set<number>();
    let inFlightGameJoins = 0;

    function reserveGameJoin(gameId: number): boolean {
      // A room join is idempotent. Avoid even rate-limit accounting for the
      // normal repeated emit that can happen during a reconnect/render cycle.
      if (socket.rooms.has(`game:${gameId}`) || pendingGameJoins.has(gameId)) {
        return false;
      }

      const now = Date.now();
      while (recentGameJoinAt[0] !== undefined && recentGameJoinAt[0] <= now - GAME_JOIN_WINDOW_MS) {
        recentGameJoinAt.shift();
      }
      if (
        inFlightGameJoins >= GAME_JOIN_MAX_IN_FLIGHT
        || recentGameJoinAt.length >= GAME_JOIN_MAX_REQUESTS
      ) {
        return false;
      }

      recentGameJoinAt.push(now);
      pendingGameJoins.add(gameId);
      inFlightGameJoins += 1;
      return true;
    }

    function releaseGameJoin(gameId: number): void {
      pendingGameJoins.delete(gameId);
      inFlightGameJoins = Math.max(0, inFlightGameJoins - 1);
    }

    socket.on("lobby:join", () => {
      if (!req.session.userId && !req.session.isAdmin) {
        logger.debug({ socketId: socket.id }, "Unauthenticated lobby:join rejected");
        return;
      }
      if (!req.session.isAdmin) {
        // Players are notified through their authorized game room, never a
        // platform-wide lobby that could disclose another host's activity.
        return;
      }
      const adminAccountId = req.session.adminAccountId;
      void socket.join(
        adminAccountId == null ? "lobby:legacy" : `lobby:host:${adminAccountId}`,
      );
    });

    socket.on("game:join", async (gameId: number) => {
      if (!req.session.userId && !req.session.isAdmin) {
        logger.debug({ socketId: socket.id }, "Unauthenticated game:join rejected");
        return;
      }
      if (!Number.isSafeInteger(gameId) || gameId <= 0) {
        logger.debug({ socketId: socket.id, gameId }, "game:join rejected: invalid game ID");
        return;
      }
      if (!reserveGameJoin(gameId)) {
        logger.debug({ socketId: socket.id, gameId }, "game:join rejected: rate or concurrency limit");
        return;
      }

      if (req.session.isAdmin) {
        const adminAccountId = req.session.adminAccountId;
        try {
          const [game] = await db
            .select({ ownerAdminId: gamesTable.ownerAdminId })
            .from(gamesTable)
            .where(eq(gamesTable.id, gameId))
            .limit(1);

          // A legacy cookie has no tenant identity. It may observe only
          // ownerless migration games, matching assertGameOwnership; it must
          // never subscribe to a room belonging to an email-auth host.
          const canJoin = game != null && (
            adminAccountId == null
              ? game.ownerAdminId == null
              : game.ownerAdminId != null && game.ownerAdminId === adminAccountId
          );
          if (!canJoin) {
            logger.debug({ socketId: socket.id, gameId, adminAccountId }, "game:join rejected: host does not own game");
            return;
          }

          await socket.join(`game:${gameId}`);
          await socket.join(`game:host:${gameId}`);
        } catch (err) {
          logger.error({ err, socketId: socket.id, gameId, adminAccountId }, "game:join host ownership check failed");
        } finally {
          releaseGameJoin(gameId);
        }
        return;
      }

      // Non-admin: serialize the final membership check and room admission with
      // the kick transaction across every replica. Without the PostgreSQL
      // advisory lock, a remote kick could enumerate sockets just before this
      // handler joins the room using a stale participant lookup.
      try {
        if (revokedPlayerGameKeys.has(playerGameKey(gameId, req.session.userId!))) {
          logger.debug({ socketId: socket.id, gameId }, "game:join rejected: player was removed");
          return;
        }
        await withPlayerGameLock(playerGameKey(gameId, req.session.userId!), async () => {
          if (revokedPlayerGameKeys.has(playerGameKey(gameId, req.session.userId!))) {
            logger.debug({ socketId: socket.id, gameId }, "game:join rejected: player was removed during lookup");
            return;
          }
          await db.transaction(async (tx) => {
            await tx.execute(
              sql`SELECT pg_advisory_xact_lock(${gameId}, ${req.session.userId!})`,
            );
            const [participant] = await tx
              .select({ id: gameParticipantsTable.id })
              .from(gameParticipantsTable)
              .where(
                and(
                  eq(gameParticipantsTable.gameId, gameId),
                  eq(gameParticipantsTable.userId, req.session.userId!),
                ),
              )
              .limit(1);
            if (!participant) {
              logger.debug({ socketId: socket.id, gameId }, "game:join rejected: not a participant");
              return;
            }
            await socket.join(`game:${gameId}`);
          });
        });
      } catch (err) {
        logger.error({ err, socketId: socket.id, gameId }, "game:join participant check failed");
      } finally {
        releaseGameJoin(gameId);
      }
    });

    socket.on("disconnect", () => {
      logger.debug({ socketId: socket.id }, "Socket disconnected");
    });
  });

  return io;
}

export function getIo(): IO {
  if (!io) throw new Error("Socket.io not initialized — call initSocket first");
  return io;
}

/**
 * Revoke a player's existing subscription after a host removes them.
 *
 * The kick event is sent directly before leaving the room so the official
 * client can update its UI, but an untrusted client cannot ignore the event
 * and remain subscribed to subsequent game activity.
 */
export async function revokePlayerFromGame(gameId: number, userId: number): Promise<void> {
  const key = playerGameKey(gameId, userId);
  revokedPlayerGameKeys.add(key);

  const activeIo = io;
  if (!activeIo) return;

  try {
    await withPlayerGameLock(key, async () => {
      const sockets = await activeIo.in(`game:${gameId}`).fetchSockets();
      await Promise.all(
        sockets
          .filter((socket) => socket.data.userId === userId)
          .map(async (socket) => {
            socket.emit("player:kicked", { gameId, userId });
            await socket.leave(`game:${gameId}`);
          }),
      );
    });
  } catch (err) {
    logger.error({ err, gameId, userId }, "Failed to revoke kicked player's socket room");
  }
}

/**
 * Disconnect active host sockets when their persisted browser sessions are
 * revoked. Socket.IO snapshots req.session at handshake time, so deleting the
 * session-store row alone cannot remove an already joined socket from private
 * game and lobby rooms.
 */
export async function revokeAdminSockets(options: {
  adminAccountId?: number | null;
  adminEmail?: string | null;
  exceptSessionId?: string;
}): Promise<void> {
  const activeIo = io;
  if (!activeIo) return;

  try {
    // With the PostgreSQL adapter this includes RemoteSocket instances from
    // every autoscale replica, not only sockets in the current process.
    const sockets = await activeIo.fetchSockets();
    for (const socket of sockets) {
      if (
        (
          (options.adminAccountId != null
            && socket.data.adminAccountId === options.adminAccountId)
          || (options.adminEmail != null
            && socket.data.adminEmail === options.adminEmail)
        )
        && socket.data.sessionId !== options.exceptSessionId
      ) {
        socket.disconnect(true);
      }
    }
  } catch (err) {
    logger.error({ err, ...options }, "Failed to revoke host sockets");
    throw err;
  }
}

/** Extracts the payload type for a given server-to-client event. */
type PayloadOf<E extends keyof ServerToClientEvents> =
  ServerToClientEvents[E] extends (payload: infer P) => void ? P : never;

/** Emit without crashing if socket not initialized (safe for edge cases). */
export function safeEmit<E extends keyof ServerToClientEvents>(
  room: string,
  event: E,
  payload: PayloadOf<E>,
): void {
  try {
    // Using `any` here because socket.io's overloaded emit generics don't
    // play nicely with our conditional type extraction in strict mode.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (getIo().to(room) as any).emit(event, payload);
  } catch {
    // Socket not initialized — silently skip
  }
}

const GAME_JOIN_MAX_IN_FLIGHT = 2;

function playerGameKey(gameId: number, userId: number): string {
  return `${gameId}:${userId}`;
}

const revokedPlayerGameKeys = new Set<string>();

const playerGameLockTails = new Map<string, Promise<void>>();

const GAME_JOIN_MAX_REQUESTS = 10;

/**
 * Serialize room-admission and revocation transitions for one player/game
 * pair. Database reads stay outside this lock; only the security-sensitive
 * check-and-join / remove-from-room transition needs to be atomic.
 */
async function withPlayerGameLock<T>(
  key: string,
  operation: () => Promise<T>,
): Promise<T> {
  const previous = playerGameLockTails.get(key) ?? Promise.resolve();
  let releaseCurrent!: () => void;
  const current = new Promise<void>((resolve) => {
    releaseCurrent = resolve;
  });
  const tail = previous.catch(() => undefined).then(() => current);
  playerGameLockTails.set(key, tail);

  await previous.catch(() => undefined);
  try {
    return await operation();
  } finally {
    releaseCurrent();
    if (playerGameLockTails.get(key) === tail) {
      playerGameLockTails.delete(key);
    }
  }
}
