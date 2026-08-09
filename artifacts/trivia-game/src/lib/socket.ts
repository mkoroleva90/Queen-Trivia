
import { io, type Socket } from "socket.io-client";
import type { ServerToClientEvents, ClientToServerEvents } from "@workspace/socket-contract";

// Re-export so existing imports of these types from this module keep working.
export type { ServerToClientEvents, ClientToServerEvents };

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;


// ── Lazy singleton — connect() is called per-hook, disconnect() per-unmount ──


let _socket: AppSocket | null = null;


export function getSocket(): AppSocket {
 if (!_socket) {
     _socket = io({
      path: "/api/socket.io",
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      transports: ["polling", "websocket"],
     });
    }
    return _socket;
}

