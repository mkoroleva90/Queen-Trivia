
import { io, type Socket } from "socket.io-client";


// ── Typed event maps (mirror server) ─────────────────────────────────────────


export type ServerToClientEvents = {
    "game:started": (payload: { gameId: number; topic: string }) => void;
    "game:ended": (payload: { gameId: number }) => void;
    "answer:submitted": (payload: {
     gameId: number;
     questionId: number;
     playerName: string;
     isCorrect: boolean;
    }) => void;
    "player:joined": (payload: {
     gameId: number;
     playerName: string;
     participantCount: number;
 }) => void;
};


export type ClientToServerEvents = {
 "lobby:join": () => void;
 "game:join": (gameId: number) => void;
};


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


