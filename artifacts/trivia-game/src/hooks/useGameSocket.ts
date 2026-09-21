
import { useEffect, useRef } from "react";
import { getSocket, type ServerToClientEvents } from "../lib/socket";
// ── useLobbySocket ─────────────────────────────────────────────────────────


export function useLobbySocket(callbacks: {
  onGameStarted?: (p: ServerToClientEvents["game:started"] extends (p: infer P) => void ? P: never) => void;
}) {
 const cbRef = useRef(callbacks);
 cbRef.current = callbacks;


 useEffect(() => {
  const socket = getSocket();
  socket.connect();
  socket.emit("lobby:join");


  function onGameStarted(p: { gameId: number; topic: string }) {
       cbRef.current.onGameStarted?.(p);
  }


  socket.on("game:started", onGameStarted);


  return () => {
       socket.off("game:started", onGameStarted);
       socket.disconnect();
  };
 }, []);
}


// ── useGameSocket ──────────────────────────────────────────────────────────


export function useGameSocket(
    gameId: number | null,
    callbacks: {
     onAnswerSubmitted?: (p: {
         gameId: number;
         questionId: number;
         playerName: string;
     }) => void;
     onAnswerGraded?: (p: {
         gameId: number;
         questionId: number;
         playerName: string;
         isCorrect: boolean;
     }) => void;
     /** Host room only — a manual review resolved an answer's correctness. */
     onAnswerReviewed?: (p: {
         gameId: number;
         questionId: number;
         playerName: string;
         isCorrect: boolean;
     }) => void;
     onGameEnded?: (p: { gameId: number }) => void;
     onPlayerKicked?: (p: { gameId: number; userId: number }) => void;
    },
){
    const cbRef = useRef(callbacks);
    cbRef.current = callbacks;


    useEffect(() => {
     if (!gameId) return;


     const socket = getSocket();

     // Re-join the game room on every (re)connect. Socket.IO room membership
     // is lost when the transport drops, so a single emit on mount would leave
     // the client silently out of the room after any reconnect — it would then
     // miss game:ended / player:kicked. Mirrors the mobile useSocket hook.
     function onConnect() {
         socket.emit("game:join", gameId!);
     }

     function onAnswerSubmitted(p: {
         gameId: number;
         questionId: number;
         playerName: string;
     }) {
         cbRef.current.onAnswerSubmitted?.(p);
     }
     function onAnswerGraded(p: {
         gameId: number;
         questionId: number;
         playerName: string;
         isCorrect: boolean;
     }) {
         cbRef.current.onAnswerGraded?.(p);
     }


     function onAnswerReviewed(p: {
         gameId: number;
         questionId: number;
         playerName: string;
         isCorrect: boolean;
     }) {
         if (p.gameId === gameId) cbRef.current.onAnswerReviewed?.(p);
     }

     function onGameEnded(p: { gameId: number }) {
         if (p.gameId === gameId) cbRef.current.onGameEnded?.(p);
     }

     function onPlayerKicked(p: { gameId: number; userId: number }) {
         if (p.gameId === gameId) cbRef.current.onPlayerKicked?.(p);
     }

     socket.on("connect", onConnect);
     socket.on("answer:submitted", onAnswerSubmitted);
     socket.on("answer:graded", onAnswerGraded);
     socket.on("answer:reviewed", onAnswerReviewed);
     socket.on("game:ended", onGameEnded);
     socket.on("player:kicked", onPlayerKicked);

     if (socket.connected) {
         socket.emit("game:join", gameId);
     } else {
         socket.connect();
     }


     return () => {
         socket.off("connect", onConnect);
         socket.off("answer:submitted", onAnswerSubmitted);
          socket.off("answer:graded", onAnswerGraded);
         socket.off("answer:reviewed", onAnswerReviewed);
         socket.off("game:ended", onGameEnded);
         socket.off("player:kicked", onPlayerKicked);
         socket.disconnect();
     };
    }, [gameId]);
}


