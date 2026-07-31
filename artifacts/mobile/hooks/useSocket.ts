import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';

type ServerToClientEvents = {
  'game:started': (payload: { gameId: number; topic: string }) => void;
  'game:ended': (payload: { gameId: number }) => void;
  'answer:submitted': (payload: {
    gameId: number;
    questionId: number;
    playerName: string;
    isCorrect: boolean;
  }) => void;
  'player:joined': (payload: {
    gameId: number;
    playerName: string;
    participantCount: number;
  }) => void;
};

type ClientToServerEvents = {
  'lobby:join': () => void;
  'game:join': (gameId: number) => void;
};

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let _socket: AppSocket | null = null;

function getSocket(): AppSocket {
  if (!_socket) {
    const domain = process.env.EXPO_PUBLIC_DOMAIN;
    const url = domain ? `https://${domain}` : 'http://localhost:8080';
    _socket = io(url, {
      path: '/api/socket.io',
      autoConnect: false,
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    }) as AppSocket;
  }
  return _socket;
}

export function useLobbySocket(callbacks: {
  onGameStarted?: (p: { gameId: number; topic: string }) => void;
}) {
  const cbRef = useRef(callbacks);
  cbRef.current = callbacks;

  useEffect(() => {
    const socket = getSocket();
    socket.connect();
    socket.emit('lobby:join');

    function onGameStarted(p: { gameId: number; topic: string }) {
      cbRef.current.onGameStarted?.(p);
    }

    socket.on('game:started', onGameStarted);

    return () => {
      socket.off('game:started', onGameStarted);
      socket.disconnect();
    };
  }, []);
}

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
  },
) {
  const cbRef = useRef(callbacks);
  cbRef.current = callbacks;

  useEffect(() => {
    if (!gameId) return;

    const socket = getSocket();
    socket.connect();
    socket.emit('game:join', gameId);

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

    socket.on('answer:submitted', onAnswerSubmitted);
    socket.on('game:ended', onGameEnded);

    return () => {
      socket.off('answer:submitted', onAnswerSubmitted);
      socket.off('game:ended', onGameEnded);
      socket.disconnect();
    };
  }, [gameId]);
}
