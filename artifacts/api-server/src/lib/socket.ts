
import { Server as SocketIOServer } from "socket.io";
import type { Server as HTTPServer } from "node:http";
import type { Request, Response } from "express";
import type { NextFunction } from "express";
import { eq, and } from "drizzle-orm";
import { db, gameParticipantsTable, gamesTable } from "@workspace/db";
import { logger } from "./logger.ts";
import { sessionMiddleware } from "./session.ts";
import { corsOrigin, isOriginAllowed } from "./cors.ts";
import { injectMobileSession } from "./mobileAuth.ts";
import type { ServerToClientEvents, ClientToServerEvents } from "@workspace/socket-contract";

export type { ServerToClientEvents, ClientToServerEvents };

type IO = SocketIOServer<ClientToServerEvents, ServerToClientEvents>;

let io: IO | null = null;

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
        }
        return;
      }

      // Non-admin: verify the caller is a participant of this game.
      try {
        const [participant] = await db
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
      } catch (err) {
        logger.error({ err, socketId: socket.id, gameId }, "game:join participant check failed");
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
 * Disconnect active host sockets when their persisted browser sessions are
 * revoked. Socket.IO snapshots req.session at handshake time, so deleting the
 * session-store row alone cannot remove an already joined socket from private
 * game and lobby rooms.
 */
export function revokeAdminSockets(options: {
  adminAccountId?: number | null;
  adminEmail?: string | null;
  exceptSessionId?: string;
}): void {
  if (!io) return;

  for (const socket of io.sockets.sockets.values()) {
    const req = socket.request as Request;
    if (
      (
        (options.adminAccountId != null
          && req.session?.adminAccountId === options.adminAccountId)
        || (options.adminEmail != null
          && req.session?.adminEmail === options.adminEmail)
      )
      && req.sessionID !== options.exceptSessionId
    ) {
      socket.disconnect(true);
    }
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