/**
 * Socket.IO hooks with explicit role-scoped token resolution.
 *
 * Two separate singleton connections are maintained:
 *  - Player socket → reads PLAYER_TOKEN_KEY only (no admin bleed)
 *  - Admin socket  → reads ADMIN_TOKEN_KEY only  (no player bleed)
 *
 * Room joins (`game:join`, `lobby:join`) are emitted from the `connect`
 * event so they fire after the authenticated handshake completes and are
 * automatically retried on every reconnect.
 *
 * Player screens use `useLobbySocket` / `useGameSocket`.
 * Admin screens use `useAdminGameSocket`.
 */
import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';
import { PLAYER_TOKEN_KEY } from '@/context/AuthContext';
import { ADMIN_TOKEN_KEY } from '@/context/AdminAuthContext';
import { API_BASE_URL } from '@/lib/apiBase';

// ─── Typed event maps ─────────────────────────────────────────────────────────

import type { ServerToClientEvents, ClientToServerEvents } from '@workspace/socket-contract';

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// ─── Socket factories ─────────────────────────────────────────────────────────

function makeSocketUrl() {
  return API_BASE_URL;
}

const BASE_OPTS = {
  path: '/api/socket.io',
  autoConnect: false,
  transports: ['polling', 'websocket'] as ('polling' | 'websocket')[],
  reconnection: true,
  reconnectionAttempts: Infinity,   // keep trying indefinitely (phone goes in pocket)
  reconnectionDelay: 1000,
  reconnectionDelayMax: 8000,
};

// Player-only socket: always reads the player token. Never picks up admin token.
let _playerSocket: AppSocket | null = null;

function getPlayerSocket(): AppSocket {
  if (!_playerSocket) {
    _playerSocket = io(makeSocketUrl(), {
      ...BASE_OPTS,
      auth: (cb: (data: Record<string, string>) => void) => {
        SecureStore.getItemAsync(PLAYER_TOKEN_KEY)
          .then((t) => cb({ token: t ?? '' }))
          .catch(() => cb({}));
      },
    }) as AppSocket;
  }
  return _playerSocket;
}

// Admin-only socket: always reads the admin token. Never picks up player token.
let _adminSocket: AppSocket | null = null;

function getAdminSocket(): AppSocket {
  if (!_adminSocket) {
    _adminSocket = io(makeSocketUrl(), {
      ...BASE_OPTS,
      auth: (cb: (data: Record<string, string>) => void) => {
        SecureStore.getItemAsync(ADMIN_TOKEN_KEY)
          .then((t) => cb({ token: t ?? '' }))
          .catch(() => cb({}));
      },
    }) as AppSocket;
  }
  return _adminSocket;
}

// ─── Player hooks ─────────────────────────────────────────────────────────────

/**
 * Player-scoped lobby socket.
 * `lobby:join` is emitted on every successful connection so reconnects
 * automatically re-enter the lobby room.
 */
export function useLobbySocket(callbacks: {
  onGameStarted?: (p: { gameId: number; topic: string }) => void;
}) {
  const cbRef = useRef(callbacks);
  cbRef.current = callbacks;

  useEffect(() => {
    const socket = getPlayerSocket();

    function onConnect() {
      socket.emit('lobby:join');
    }

    function onGameStarted(p: { gameId: number; topic: string }) {
      cbRef.current.onGameStarted?.(p);
    }

    socket.on('connect', onConnect);
    socket.on('game:started', onGameStarted);

    // If already connected, join immediately.
    if (socket.connected) {
      socket.emit('lobby:join');
    } else {
      socket.connect();
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('game:started', onGameStarted);
      socket.disconnect();
    };
  }, []);
}

/**
 * Player-scoped game socket.
 * `game:join` is emitted from the `connect` event so it fires after the
 * authenticated handshake and is retried on every reconnect.
 */
export function useGameSocket(
  gameId: number | null,
  callbacks: {
    onAnswerSubmitted?: (p: {
      gameId: number;
      questionId: number;
      playerName: string;
      isCorrect: boolean;
    }) => void;
    onGameEnded?: (p: { gameId: number }) => void;
    onPlayerKicked?: (p: { gameId: number; userId: number }) => void;
  },
) {
  const cbRef = useRef(callbacks);
  cbRef.current = callbacks;

  useEffect(() => {
    if (!gameId) return;

    const socket = getPlayerSocket();

    function onConnect() {
      socket.emit('game:join', gameId!);
    }

    function onAnswerSubmitted(p: {
      gameId: number;
      questionId: number;
      playerName: string;
      isCorrect: boolean;
    }) {
      cbRef.current.onAnswerSubmitted?.(p);
    }

    function onGameEnded(p: { gameId: number }) {
      if (p.gameId === gameId) cbRef.current.onGameEnded?.(p);
    }

    function onPlayerKicked(p: { gameId: number; userId: number }) {
      if (p.gameId === gameId) cbRef.current.onPlayerKicked?.(p);
    }

    socket.on('connect', onConnect);
    socket.on('answer:submitted', onAnswerSubmitted);
    socket.on('game:ended', onGameEnded);
    socket.on('player:kicked', onPlayerKicked);

    if (socket.connected) {
      socket.emit('game:join', gameId);
    } else {
      socket.connect();
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('answer:submitted', onAnswerSubmitted);
      socket.off('game:ended', onGameEnded);
      socket.off('player:kicked', onPlayerKicked);
      socket.disconnect();
    };
  }, [gameId]);
}

// ─── Admin hooks ──────────────────────────────────────────────────────────────

/**
 * Admin-scoped game socket.
 * Uses the admin-only socket singleton. `game:join` is emitted from the
 * `connect` event so it fires after the authenticated handshake and is
 * retried on every reconnect.
 *
 * `onConnect` / `onDisconnect` are called on every connection state change
 * so the UI can show a "Reconnecting…" banner while the phone is backgrounded
 * or the network switches between wi-fi and cellular.
 *
 * Note: a host disconnecting does NOT end or corrupt the game — players
 * submit answers independently and the game continues on the server.
 */
export function useAdminGameSocket(
  gameId: number | null,
  callbacks: {
    onAnswerSubmitted?: (p: {
      gameId: number;
      questionId: number;
      playerName: string;
      isCorrect: boolean;
    }) => void;
    onGameEnded?: (p: { gameId: number }) => void;
    /** Called every time the socket (re)connects. */
    onConnect?: () => void;
    /** Called every time the socket loses its connection. */
    onDisconnect?: () => void;
  },
) {
  const cbRef = useRef(callbacks);
  cbRef.current = callbacks;

  useEffect(() => {
    if (!gameId) return;

    const socket = getAdminSocket();

    function onConnect() {
      socket.emit('game:join', gameId!);
      cbRef.current.onConnect?.();
    }

    function onDisconnect() {
      cbRef.current.onDisconnect?.();
    }

    function onAnswerSubmitted(p: {
      gameId: number;
      questionId: number;
      playerName: string;
      isCorrect: boolean;
    }) {
      cbRef.current.onAnswerSubmitted?.(p);
    }

    function onGameEnded(p: { gameId: number }) {
      if (p.gameId === gameId) cbRef.current.onGameEnded?.(p);
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('answer:submitted', onAnswerSubmitted);
    socket.on('game:ended', onGameEnded);

    if (socket.connected) {
      socket.emit('game:join', gameId);
    } else {
      socket.connect();
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('answer:submitted', onAnswerSubmitted);
      socket.off('game:ended', onGameEnded);
      socket.disconnect();
    };
  }, [gameId]);
}
