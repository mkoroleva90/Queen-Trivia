
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


// ── Singleton ─────────────────────────────────────────────────────────────────


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
// cannot carry cookies.  The token is passed in socket.handshake.auth.token
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
  void socket.join("lobby");
 });


 socket.on("game:join", (gameId: number) => {
  if (!req.session.userId && !req.session.isAdmin) {
      logger.debug({ socketId: socket.id }, "Unauthenticated game:join rejected");
     return;
 }
  if (!Number.isSafeInteger(gameId) || gameId < 1) {
      logger.debug({ socketId: socket.id, gameId }, "Invalid game:join rejected");
      return;
  }
 if (req.session.isAdmin) {
      const adminAccountId = req.session.adminAccountId;
      if (adminAccountId != null) {
          db.select({ id: gamesTable.id })
              .from(gamesTable)
              .where(
                  and(
                      eq(gamesTable.id, gameId),
                      eq(gamesTable.ownerAdminId, adminAccountId),
                  ),
              )
              .then(([game]) => {
                  if (!game) {
                      logger.debug({ socketId: socket.id, gameId, adminAccountId }, "game:join rejected: not game owner");
                      return;
                  }
                  void socket.join(`game:${gameId}`);
                  void socket.join(`game:host:${gameId}`);
              })
              .catch((err) => {
                  logger.error({ err, socketId: socket.id, gameId, adminAccountId }, "game:join ownership check failed");
              });
          return;
      }
      // Legacy code-based admins remain super-admins for backwards compatibility.
     void socket.join(`game:${gameId}`);
      void socket.join(`game:host:${gameId}`);
     return;
 }
 // Non-admin: verify the caller is a participant of this game
 db.select({ id: gameParticipantsTable.id })
     .from(gameParticipantsTable)
     .where(
         and(
             eq(gameParticipantsTable.gameId, gameId),
             eq(gameParticipantsTable.userId, req.session.userId!),
         ),
     )
     .then(([participant]) => {
         if (!participant) {
             logger.debug({ socketId: socket.id, gameId }, "game:join rejected: not a participant");
             return;
         }
         void socket.join(`game:${gameId}`);
     })
     .catch((err) => {
         logger.error({ err, socketId: socket.id }, "game:join participant check failed");
     });
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


