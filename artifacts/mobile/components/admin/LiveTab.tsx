import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  type AppStateStatus,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';
import { ADMIN_TOKEN_KEY } from '@/context/AdminAuthContext';
import {
  useListGames,
  getListGamesQueryKey,
  useListGameQuestions,
  getListGameQuestionsQueryKey,
  useListGameParticipants,
  getListGameParticipantsQueryKey,
  useUpdateGame,
} from '@workspace/api-client-react';
import type { Question } from '@workspace/api-client-react';
import { COPY } from '@workspace/copy';
import {
  createTallyStore,
  recordAnswerEvent,
  applySeed,
  resetTallyStore,
  type TallyStore,
} from '@workspace/live-tally';
import { useColors } from '@/hooks/useColors';
import { useAdminGameSocket } from '@/hooks/useSocket';
import { API_BASE_URL } from '@/lib/apiBase';

type Props = { bottomPadding: number };

type QuestionStat = {
  id: number;
  totalAnswered: number;
  correctCount: number;
  answeredBy?: string[];
};

async function fetchAdminJson<T>(url: string): Promise<T> {
  const token = await SecureStore.getItemAsync(ADMIN_TOKEN_KEY).catch(() => null);
  const r = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json() as Promise<T>;
}

const AVATAR_COLORS: [string, string][] = [
  ['#ff0080', '#fff'],
  ['#00ddff', '#08222a'],
  ['#ffe500', '#241f00'],
  ['#35d07f', '#08130c'],
  ['#a78bfa', '#1d1436'],
  ['#fb923c', '#2b1503'],
];

/**
 * Live tab — real-time host control panel matching the web's Live section.
 *
 * Parity notes (web: Admin.tsx → LiveGameView):
 *  - Prev/Next move the host's *monitored* question locally (same as web —
 *    no host-advance endpoint exists; players drive their own pace).
 *  - Reveal toggles whether the correct answer is highlighted on the host's
 *    screen (the web always shows the correct row; mobile makes it a toggle
 *    so a host projecting their phone can keep it hidden).
 *  - Room code shown is the global trivia access code from settings (same as
 *    web), not the per-game access code.
 *
 * Resilience features (mobile-specific):
 *  - Connection indicator banner when the socket drops (screen lock, network
 *    switch, etc.). A disconnected host does NOT end the game — players keep
 *    answering independently.
 *  - AppState listener: when the app returns to the foreground the tally
 *    store resets to buffering mode, participants + seed stats are refetched,
 *    and the seed→live merge runs again so the host sees accurate counts
 *    without missing any answers received while backgrounded.
 */
export function LiveTab({ bottomPadding }: Props) {
  const colors = useColors();
  const qc = useQueryClient();

  const { data: games, isLoading, refetch: refetchGames } = useListGames();
  const activeGames = useMemo(
    () => (games ?? []).filter((g) => g.status === 'active'),
    [games],
  );

  // Selected active game (host can switch when several are live).
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const game =
    activeGames.find((g) => g.id === selectedId) ?? activeGames[0] ?? null;
  const gameId = game?.id ?? null;

  // Host-monitored question index + reveal state (client-side, like the web).
  const [qIndex, setQIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);

  // Play-along: host answer tracking
  const [hostAnswers, setHostAnswers] = useState<Record<number, string>>({});
  const [hostAnswerInput, setHostAnswerInput] = useState('');
  const [submittingHostAnswer, setSubmittingHostAnswer] = useState(false);
  const [skipConfirmForQ, setSkipConfirmForQ] = useState<{ id: number; direction: 'prev' | 'next' } | null>(null);

  const submitHostAnswer = async (questionId: number, answer: string) => {
    if (!game || submittingHostAnswer || hostAnswers[questionId] !== undefined) return;
    if (!answer.trim()) return;
    setSubmittingHostAnswer(true);
    try {
      const token = await SecureStore.getItemAsync(ADMIN_TOKEN_KEY).catch(() => null);
      const res = await fetch(`${API_BASE_URL}/api/games/${game.id}/host-answer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ questionId, userAnswer: answer }),
      });
      if (res.ok) {
        setHostAnswers((prev) => ({ ...prev, [questionId]: answer }));
        setHostAnswerInput('');
      }
    } catch {
      // non-critical
    } finally {
      setSubmittingHostAnswer(false);
    }
  };

  // Record an explicit skip (empty answer = 0 pts) then navigate.
  const submitSkipAndNavigate = async (questionId: number, direction: 'prev' | 'next') => {
    setSkipConfirmForQ(null);
    if (game) {
      try {
        const token = await SecureStore.getItemAsync(ADMIN_TOKEN_KEY).catch(() => null);
        const res = await fetch(`${API_BASE_URL}/api/games/${game.id}/host-answer`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ questionId, userAnswer: '' }),
        });
        if (res.ok) setHostAnswers((prev) => ({ ...prev, [questionId]: '' }));
      } catch { /* non-critical */ }
    }
    if (direction === 'next') { setQIndex((i) => Math.min(sortedQs.length - 1, i + 1)); setRevealed(false); }
    else { setQIndex((i) => Math.max(0, i - 1)); setRevealed(false); }
  };

  // ── Connection state ─────────────────────────────────────────────────────
  // Start optimistically connected (avoid flicker on first load).
  const [socketConnected, setSocketConnected] = useState(true);
  const [reconnectedFlash, setReconnectedFlash] = useState(false);
  const hasDisconnectedRef = useRef(false);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Live telemetry ───────────────────────────────────────────────────────
  // The synchronous TallyStore (in a ref) is the single source of truth: it
  // buffers pre-seed socket events, merges the persisted snapshot atomically,
  // and dedupes per player name — so events arriving in the seed→live
  // transition window are never lost or double-counted. React state below is
  // only a render mirror of the store's snapshots.
  const tallyStore = useRef<TallyStore>(createTallyStore());
  const [answeredBy, setAnsweredBy] = useState<Record<number, string[]>>({});
  const [correctCount, setCorrectCount] = useState<Record<number, number>>({});
  const syncTallies = useCallback(() => {
    setAnsweredBy({ ...tallyStore.current.answeredBy });
    setCorrectCount({ ...tallyStore.current.correctCount });
  }, []);

  // Reset telemetry when the monitored game changes.
  useEffect(() => {
    setQIndex(0);
    setRevealed(false);
    resetTallyStore(tallyStore.current);
    setAnsweredBy({});
    setCorrectCount({});
    setHostAnswers({});
    setHostAnswerInput('');
  }, [gameId]);

  // Clear the write-in input when the host moves to a different question.
  useEffect(() => {
    setHostAnswerInput('');
  }, [qIndex]);

  const baseUrl = API_BASE_URL;

  // ── Seed tallies from persisted answers ─────────────────────────────────
  // Opening this tab mid-game shows correct totals immediately; socket events
  // then increment on top. staleTime: Infinity means the query only re-runs
  // when explicitly invalidated (e.g. on app foreground).
  const { data: seedStats } = useQuery<QuestionStat[]>({
    queryKey: ['live-tab-seed-stats', gameId],
    queryFn: () => fetchAdminJson<QuestionStat[]>(`${baseUrl}/api/games/${gameId}/questions/stats`),
    enabled: gameId != null,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (!seedStats || gameId == null) return;
    if (applySeed(tallyStore.current, seedStats)) syncTallies();
  }, [seedStats, gameId, syncTallies]);

  // ── Data queries ─────────────────────────────────────────────────────────
  const { data: questions } = useListGameQuestions(gameId ?? 0, {
    query: {
      enabled: gameId != null,
      queryKey: getListGameQuestionsQueryKey(gameId ?? 0),
    },
  });
  const { data: participants, refetch: refetchParticipants } = useListGameParticipants(
    gameId ?? 0,
    {
      query: {
        enabled: gameId != null,
        refetchInterval: 10000,
        queryKey: getListGameParticipantsQueryKey(gameId ?? 0),
      },
    },
  );
  const updateGame = useUpdateGame();

  const sortedQs: Question[] = useMemo(
    () => [...(questions ?? [])].sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0)),
    [questions],
  );
  const currentQ = sortedQs[Math.min(qIndex, Math.max(sortedQs.length - 1, 0))];

  // ── AppState: restore state when app returns from background ─────────────
  // Resets the tally store to buffering mode and refetches fresh seed data
  // so any answers missed while the screen was locked are included.
  // qIndex is intentionally NOT reset — the host stays on the same question.
  useEffect(() => {
    const handler = (nextState: AppStateStatus) => {
      if (nextState === 'active' && gameId != null) {
        resetTallyStore(tallyStore.current);
        setAnsweredBy({});
        setCorrectCount({});
        void refetchGames();
        void refetchParticipants();
        qc.invalidateQueries({ queryKey: ['live-tab-seed-stats', gameId] });
      }
    };
    const sub = AppState.addEventListener('change', handler);
    return () => sub.remove();
  }, [gameId, refetchGames, refetchParticipants, qc]);

  // ── Socket callbacks ─────────────────────────────────────────────────────
  const onAnswerSubmitted = useCallback(
    (p: { gameId: number; questionId: number; playerName: string; isCorrect: boolean }) => {
      if (p.gameId !== gameId) return;
      if (recordAnswerEvent(tallyStore.current, p.questionId, p.playerName, p.isCorrect)) {
        syncTallies();
      }
      refetchParticipants();
    },
    [gameId, syncTallies, refetchParticipants],
  );

  const onGameEnded = useCallback(
    (p: { gameId: number }) => {
      if (p.gameId === gameId) {
        qc.invalidateQueries({ queryKey: getListGamesQueryKey() });
      }
    },
    [gameId, qc],
  );

  const onSocketConnect = useCallback(() => {
    setSocketConnected(true);
    if (hasDisconnectedRef.current) {
      // Was previously disconnected — flash a "reconnected" banner briefly
      setReconnectedFlash(true);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = setTimeout(() => setReconnectedFlash(false), 3000);
      hasDisconnectedRef.current = false;
    }
  }, []);

  const onSocketDisconnect = useCallback(() => {
    setSocketConnected(false);
    setReconnectedFlash(false);
    hasDisconnectedRef.current = true;
  }, []);

  useAdminGameSocket(gameId, {
    onAnswerSubmitted,
    onGameEnded,
    onConnect: onSocketConnect,
    onDisconnect: onSocketDisconnect,
  });

  // ── End game ─────────────────────────────────────────────────────────────
  const [ending, setEnding] = useState(false);
  const handleEndGame = async () => {
    if (gameId == null) return;
    setEnding(true);
    try {
      await updateGame.mutateAsync({ gameId, data: { status: 'completed' } });
      qc.invalidateQueries({ queryKey: getListGamesQueryKey() });
    } finally {
      setEnding(false);
    }
  };

  // ── Pull-to-refresh ───────────────────────────────────────────────────────
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchGames(), refetchParticipants()]);
    setRefreshing(false);
  };

  const s = styles(colors);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={[s.container, s.center]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  // ── Empty: no live game ───────────────────────────────────────────────────
  if (activeGames.length === 0) {
    return (
      <ScrollView
        contentContainerStyle={[s.center, { flexGrow: 1, paddingBottom: bottomPadding, gap: 14, paddingHorizontal: 36 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <Ionicons name="radio-outline" size={52} color={colors.mutedForeground} />
        <Text style={[s.emptyHeading, { color: colors.foreground }]}>No game is live right now</Text>
        <Text style={[s.emptySub, { color: colors.mutedForeground }]}>
          Go to Games to launch one. Pull down to refresh.
        </Text>
      </ScrollView>
    );
  }

  // ── Derived values ────────────────────────────────────────────────────────
  const parts = participants ?? [];
  const answeredNames = currentQ ? (answeredBy[currentQ.id] ?? []) : [];
  const answeredCount = answeredNames.length;
  const answeredPct = parts.length > 0 ? Math.round((answeredCount / parts.length) * 100) : 0;
  const qCorrect = currentQ ? (correctCount[currentQ.id] ?? 0) : 0;
  const choices: string[] = ((currentQ?.options as { choices?: string[] } | null)?.choices ?? []);
  const standings = [...parts].sort((a, b) => (b.totalScore ?? 0) - (a.totalScore ?? 0)).slice(0, 6);

  // Suppress correct-answer reveals until the host has submitted their own answer (play-along mode).
  const hostAnsweredCurrent = currentQ !== undefined && hostAnswers[currentQ.id] !== undefined;
  const hostPlayingAndUnanswered = !!(game?.hostPlaysAlong && currentQ && !hostAnsweredCurrent);
  // When playing along: hide until host answers, then auto-reveal regardless of the manual toggle.
  // When play-along is off: respect the manual `revealed` toggle exactly as before.
  const effectiveRevealed = hostPlayingAndUnanswered ? false : (hostAnsweredCurrent && game?.hostPlaysAlong ? true : revealed);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <ScrollView
      contentContainerStyle={[s.list, { paddingBottom: bottomPadding + 16 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      {/* ── Connection status banners ── */}
      {!socketConnected && (
        <View style={[s.connBanner, { backgroundColor: colors.destructive + '15', borderColor: colors.destructive + '30' }]}>
          <ActivityIndicator size="small" color={colors.destructive} style={{ transform: [{ scale: 0.7 }] }} />
          <View style={{ flex: 1 }}>
            <Text style={[s.connBannerTitle, { color: colors.destructive }]}>
              Reconnecting…
            </Text>
            <Text style={[s.connBannerSub, { color: colors.destructive + 'cc' }]}>
              Players can still answer — live updates paused on this screen
            </Text>
          </View>
        </View>
      )}
      {reconnectedFlash && socketConnected && (
        <View style={[s.connBanner, { backgroundColor: colors.secondary + '15', borderColor: colors.secondary + '30' }]}>
          <Ionicons name="wifi" size={15} color={colors.secondary} />
          <Text style={[s.connBannerTitle, { color: colors.secondary }]}>
            Connected — live updates resumed
          </Text>
        </View>
      )}

      {/* ── Game picker (only when multiple games are live) ── */}
      {activeGames.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.pickerRow}>
          {activeGames.map((g) => {
            const sel = g.id === game?.id;
            return (
              <Pressable
                key={g.id}
                onPress={() => setSelectedId(g.id)}
                style={[
                  s.pickerChip,
                  {
                    backgroundColor: sel ? colors.primary + '22' : colors.card,
                    borderColor: sel ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={[s.pickerChipText, { color: sel ? colors.primary : colors.mutedForeground }]}
                  numberOfLines={1}
                >
                  {g.topic}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {/* ── Topbar: LIVE badge · topic + player count · room code ── */}
      <View style={s.topbar}>
        <View style={[s.liveBadge, { backgroundColor: colors.secondary + '18', borderColor: colors.secondary + '55' }]}>
          <View style={[s.liveDot, { backgroundColor: colors.secondary }]} />
          <Text style={[s.liveBadgeText, { color: colors.secondary }]}>LIVE</Text>
        </View>
        <View style={s.titleGroup}>
          <Text style={[s.title, { color: colors.foreground }]} numberOfLines={1}>
            {game!.topic}
          </Text>
          <Text style={[s.playerCountText, { color: colors.mutedForeground }]}>
            {parts.length} player{parts.length !== 1 ? 's' : ''}
          </Text>
        </View>
      </View>

      {/* ── Question card ── */}
      <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={s.qMetaRow}>
          <Text style={[s.qMeta, { color: colors.mutedForeground }]}>
            QUESTION {sortedQs.length ? qIndex + 1 : 0} / {sortedQs.length || '?'}
          </Text>
          {!!currentQ?.questionType && (
            <View style={[s.tag, { backgroundColor: colors.accent + '15', borderColor: colors.accent + '40' }]}>
              <Text style={[s.tagText, { color: colors.accent }]}>{currentQ.questionType.toUpperCase()}</Text>
            </View>
          )}
          {currentQ?.points != null && (
            <View style={[s.tag, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '40' }]}>
              <Text style={[s.tagText, { color: colors.primary }]}>{currentQ.points} PTS</Text>
            </View>
          )}
        </View>

        <Text style={[s.qText, { color: colors.foreground }]}>
          {currentQ?.questionText ?? 'Waiting for questions to load…'}
        </Text>

        {/* Answer reveal pill + answered count */}
        <View style={s.revealRow}>
          <View
            style={[
              s.revealPill,
              effectiveRevealed
                ? { backgroundColor: colors.secondary + '18', borderColor: colors.secondary + '55' }
                : { backgroundColor: colors.muted, borderColor: colors.border },
            ]}
          >
            <Ionicons
              name={effectiveRevealed ? 'eye' : 'eye-off'}
              size={13}
              color={effectiveRevealed ? colors.secondary : colors.mutedForeground}
            />
            <Text style={[s.revealPillText, { color: effectiveRevealed ? colors.secondary : colors.mutedForeground }]}>
              {effectiveRevealed ? 'ANSWER REVEALED' : 'ANSWER HIDDEN'}
            </Text>
          </View>
          <Text style={[s.answeredMeta, { color: colors.mutedForeground }]}>
            {answeredCount}/{parts.length} answered · {answeredPct}%
          </Text>
        </View>

        {/* YOUR ANSWER label — only when host is playing along and hasn't answered this MC question yet */}
        {hostPlayingAndUnanswered && choices.length > 0 && (
          <Text style={{ fontSize: 10, fontFamily: 'Manrope_700Bold', color: colors.mutedForeground, letterSpacing: 1.5, marginTop: 12, marginBottom: 2 }}>
            {COPY.hostPlayAlong.yourAnswerPrompt}
          </Text>
        )}

        {/* Multiple-choice options */}
        {choices.length > 0 && (
          <View style={s.choices}>
            {choices.map((c, i) => {
              const isCorrect = effectiveRevealed && currentQ?.correctAnswer === c;
              const hostPicked = game?.hostPlaysAlong && currentQ && hostAnswers[currentQ.id] === c;
              const hostAnswered = game?.hostPlaysAlong && currentQ && hostAnswers[currentQ.id] !== undefined;
              const canPick = !!(game?.hostPlaysAlong && currentQ && !hostAnswered && !submittingHostAnswer);
              return (
                <Pressable
                  key={i}
                  onPress={canPick ? () => submitHostAnswer(currentQ!.id, c) : undefined}
                  style={({ pressed }) => [
                    s.choiceRow,
                    {
                      borderColor: isCorrect ? colors.secondary + '80' : hostPicked ? colors.primary + '80' : colors.border,
                      backgroundColor: isCorrect ? colors.secondary + '14' : hostPicked ? colors.primary + '14' : 'transparent',
                      opacity: canPick && pressed ? 0.65 : 1,
                    },
                  ]}
                >
                  <View
                    style={[
                      s.choiceLetter,
                      isCorrect
                        ? { backgroundColor: colors.secondary }
                        : hostPicked
                          ? { backgroundColor: colors.primary }
                          : { borderWidth: 1.5, borderColor: colors.border },
                    ]}
                  >
                    <Text style={[s.choiceLetterText, { color: (isCorrect || hostPicked) ? colors.background : colors.mutedForeground }]}>
                      {String.fromCharCode(65 + i)}
                    </Text>
                  </View>
                  <Text
                    style={[
                      s.choiceText,
                      { color: (isCorrect || hostPicked) ? colors.foreground : colors.mutedForeground },
                      (isCorrect || hostPicked) && { fontFamily: 'Manrope_700Bold' },
                    ]}
                    numberOfLines={2}
                  >
                    {c}
                  </Text>
                  {hostPicked && !isCorrect && (
                    <Text style={{ fontSize: 10, fontFamily: 'Manrope_700Bold', color: colors.primary }}>YOUR PICK</Text>
                  )}
                  {isCorrect && (
                    <Text style={[s.choiceTally, { color: colors.secondary }]}>
                      {qCorrect} ✓
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Skip button — only when host is playing along on an unanswered MC question */}
        {hostPlayingAndUnanswered && choices.length > 0 && (
          <Pressable
            onPress={() => setSkipConfirmForQ({ id: currentQ!.id, direction: 'next' })}
            style={{ alignItems: 'center', paddingVertical: 8 }}
          >
            <Text style={{ fontSize: 12, fontFamily: 'Manrope_600SemiBold', color: colors.mutedForeground }}>
              {COPY.hostPlayAlong.skipBtn}
            </Text>
          </Pressable>
        )}

        {/* Play-along: not-answered badge when host explicitly skipped this MC question */}
        {game?.hostPlaysAlong && currentQ && hostAnswers[currentQ.id] === '' && choices.length > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border }}>
            <Text style={{ fontSize: 10, fontFamily: 'Manrope_700Bold', color: colors.mutedForeground, letterSpacing: 1 }}>— Not answered · 0 pts</Text>
          </View>
        )}

        {/* Free-text / other question types — show answer when revealed */}
        {choices.length === 0 && effectiveRevealed && !!currentQ?.correctAnswer && (
          <View style={[s.freeAnswer, { borderColor: colors.secondary + '55', backgroundColor: colors.secondary + '12' }]}>
            <Ionicons name="checkmark-circle" size={16} color={colors.secondary} />
            <Text style={[s.freeAnswerText, { color: colors.foreground }]}>{currentQ.correctAnswer}</Text>
            <Text style={[s.choiceTally, { color: colors.secondary }]}>{qCorrect} ✓</Text>
          </View>
        )}

        {/* Host play-along answer input for non-MC question types */}
        {game?.hostPlaysAlong && currentQ && choices.length === 0 && (
          hostAnswers[currentQ.id] !== undefined ? (
            hostAnswers[currentQ.id] === '' ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
                <Text style={{ fontSize: 10, fontFamily: 'Manrope_700Bold', color: colors.mutedForeground, letterSpacing: 1 }}>— Not answered · 0 pts</Text>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
                <Text style={{ fontSize: 10, fontFamily: 'Manrope_700Bold', color: colors.secondary, letterSpacing: 1 }}>✓ YOUR ANSWER</Text>
                <Text style={{ fontSize: 14, color: colors.foreground, flex: 1 }}>{hostAnswers[currentQ.id]}</Text>
              </View>
            )
          ) : currentQ.questionType === 'true_false' ? (
            <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
              <Text style={{ fontSize: 10, fontFamily: 'Manrope_700Bold', color: colors.mutedForeground, letterSpacing: 1.5, marginBottom: 8 }}>YOUR ANSWER</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {['True', 'False'].map((opt) => (
                  <Pressable
                    key={opt}
                    disabled={submittingHostAnswer}
                    onPress={() => submitHostAnswer(currentQ.id, opt.toLowerCase())}
                    style={({ pressed }) => ({
                      flex: 1, alignItems: 'center', paddingVertical: 10,
                      borderRadius: 12, borderWidth: 1, borderColor: colors.border,
                      backgroundColor: pressed ? colors.accent + '20' : 'transparent',
                      opacity: submittingHostAnswer ? 0.4 : 1,
                    })}
                  >
                    <Text style={{ fontSize: 14, fontFamily: 'Manrope_600SemiBold', color: colors.mutedForeground }}>{opt}</Text>
                  </Pressable>
                ))}
              </View>
              <Pressable
                onPress={() => setSkipConfirmForQ({ id: currentQ.id, direction: 'next' })}
                style={{ alignItems: 'center', paddingVertical: 8, marginTop: 4 }}
              >
                <Text style={{ fontSize: 12, fontFamily: 'Manrope_600SemiBold', color: colors.mutedForeground }}>{COPY.hostPlayAlong.skipBtn}</Text>
              </Pressable>
            </View>
          ) : (
            <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
              <Text style={{ fontSize: 10, fontFamily: 'Manrope_700Bold', color: colors.mutedForeground, letterSpacing: 1.5, marginBottom: 8 }}>YOUR ANSWER</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput
                  value={hostAnswerInput}
                  onChangeText={setHostAnswerInput}
                  onSubmitEditing={() => submitHostAnswer(currentQ.id, hostAnswerInput)}
                  placeholder="Type your answer…"
                  placeholderTextColor={colors.mutedForeground + '88'}
                  editable={!submittingHostAnswer}
                  style={{ flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, color: colors.foreground, fontSize: 14 }}
                />
                <Pressable
                  disabled={!hostAnswerInput.trim() || submittingHostAnswer}
                  onPress={() => submitHostAnswer(currentQ.id, hostAnswerInput)}
                  style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, backgroundColor: colors.accent + '20', borderWidth: 1, borderColor: colors.accent + '50', opacity: (!hostAnswerInput.trim() || submittingHostAnswer) ? 0.4 : 1 }}
                >
                  <Text style={{ fontSize: 13, fontFamily: 'Manrope_700Bold', color: colors.accent }}>Submit</Text>
                </Pressable>
              </View>
              <Pressable
                onPress={() => setSkipConfirmForQ({ id: currentQ.id, direction: 'next' })}
                style={{ alignItems: 'center', paddingVertical: 8, marginTop: 4 }}
              >
                <Text style={{ fontSize: 12, fontFamily: 'Manrope_600SemiBold', color: colors.mutedForeground }}>{COPY.hostPlayAlong.skipBtn}</Text>
              </Pressable>
            </View>
          )
        )}

        {/* Unanswered reminder — visible when host plays along but hasn't answered */}
        {game?.hostPlaysAlong && currentQ && hostAnswers[currentQ.id] === undefined && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10 }}>
            <Ionicons name="warning-outline" size={12} color={colors.primary + 'cc'} />
            <Text style={{ fontSize: 11, fontFamily: 'Manrope_600SemiBold', color: colors.primary + 'cc' }}>{COPY.hostPlayAlong.unansweredBadge}</Text>
          </View>
        )}
      </View>

      {/* ── Transport controls ── */}
      <View style={[s.transport, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Pressable
          disabled={qIndex === 0}
          onPress={() => {
            if (game?.hostPlaysAlong && currentQ && hostAnswers[currentQ.id] === undefined) {
              setSkipConfirmForQ({ id: currentQ.id, direction: 'prev' });
            } else {
              setQIndex((i) => Math.max(0, i - 1)); setRevealed(false);
            }
          }}
          style={({ pressed }) => [
            s.tBtn,
            { borderColor: colors.border, opacity: qIndex === 0 ? 0.4 : pressed ? 0.7 : 1 },
          ]}
        >
          <Ionicons name="chevron-back" size={16} color={colors.mutedForeground} />
          <Text style={[s.tBtnText, { color: colors.mutedForeground }]}>Prev</Text>
        </Pressable>
        <Pressable
          onPress={hostPlayingAndUnanswered ? undefined : () => setRevealed((r) => !r)}
          style={({ pressed }) => [
            s.tBtn,
            {
              borderColor: colors.accent + '55',
              backgroundColor: colors.accent + '12',
              opacity: hostPlayingAndUnanswered ? 0.3 : pressed ? 0.7 : 1,
            },
          ]}
        >
          <Ionicons name={effectiveRevealed ? 'eye-off-outline' : 'eye-outline'} size={16} color={colors.accent} />
          <Text style={[s.tBtnText, { color: colors.accent }]}>{effectiveRevealed ? 'Hide' : 'Reveal'}</Text>
        </Pressable>
        <Pressable
          disabled={qIndex >= sortedQs.length - 1}
          onPress={() => {
            if (game?.hostPlaysAlong && currentQ && hostAnswers[currentQ.id] === undefined) {
              setSkipConfirmForQ({ id: currentQ.id, direction: 'next' });
            } else {
              setQIndex((i) => Math.min(sortedQs.length - 1, i + 1)); setRevealed(false);
            }
          }}
          style={({ pressed }) => [
            s.tBtnPrimary,
            {
              backgroundColor: colors.primary,
              opacity: qIndex >= sortedQs.length - 1 ? 0.4 : pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text style={s.tBtnPrimaryText}>Next</Text>
          <Ionicons name="chevron-forward" size={16} color="#fff" />
        </Pressable>
      </View>

      {/* Skip-question confirmation modal */}
      <Modal visible={skipConfirmForQ !== null} animationType="fade" transparent presentationStyle="overFullScreen">
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <Pressable style={{ position: 'absolute', inset: 0 } as any} onPress={() => setSkipConfirmForQ(null)} />
          <View style={{ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 20, padding: 24, width: '100%', maxWidth: 360, zIndex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Ionicons name="warning-outline" size={20} color={colors.primary} />
              <Text style={{ fontSize: 16, fontFamily: 'Manrope_800ExtraBold', color: colors.foreground }}>
                {COPY.hostPlayAlong.skipDialogTitle}
              </Text>
            </View>
            <Text style={{ fontSize: 14, color: colors.mutedForeground, lineHeight: 20, marginBottom: 20 }}>
              {COPY.hostPlayAlong.skipDialogBody}
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable
                onPress={() => setSkipConfirmForQ(null)}
                style={({ pressed }) => ({
                  flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12,
                  borderWidth: 1, borderColor: colors.border,
                  backgroundColor: pressed ? colors.muted : 'transparent',
                })}
              >
                <Text style={{ fontSize: 14, fontFamily: 'Manrope_700Bold', color: colors.mutedForeground }}>{COPY.hostPlayAlong.skipDialogGoBack}</Text>
              </Pressable>
              <Pressable
                onPress={() => skipConfirmForQ && submitSkipAndNavigate(skipConfirmForQ.id, skipConfirmForQ.direction)}
                style={({ pressed }) => ({
                  flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12,
                  backgroundColor: pressed ? colors.primary + 'cc' : colors.primary,
                })}
              >
                <Text style={{ fontSize: 14, fontFamily: 'Manrope_700Bold', color: '#fff' }}>{COPY.hostPlayAlong.skipDialogSkip}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── ANSWERED — participant chips with answer status ── */}
      <Text style={[s.sectionLabel, { color: colors.mutedForeground }]}>ANSWERED</Text>
      <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[s.progressBg, { backgroundColor: colors.border }]}>
          <View
            style={[s.progressFill, {
              backgroundColor: colors.secondary,
              width: answeredPct > 0 ? `${answeredPct}%` : 0,
            }]}
          />
        </View>
        <View style={s.chipWrap}>
          {parts.length === 0 && (
            <Text style={[s.emptySub, { color: colors.mutedForeground }]}>No players yet</Text>
          )}
          {parts.map((p, idx) => {
            const done = answeredNames.includes(p.userName);
            const [av, avtx] = AVATAR_COLORS[idx % AVATAR_COLORS.length];
            return (
              <View
                key={p.id}
                style={[
                  s.playerChip,
                  {
                    borderColor: done ? colors.secondary + '50' : colors.border,
                    backgroundColor: done ? colors.secondary + '12' : 'transparent',
                    opacity: done ? 1 : 0.55,
                  },
                ]}
              >
                <View style={[s.avatar, { backgroundColor: done ? av : colors.border }]}>
                  <Text style={[s.avatarText, { color: done ? avtx : colors.mutedForeground }]}>
                    {p.userName.substring(0, 1).toUpperCase()}
                  </Text>
                </View>
                <Text style={[s.playerChipName, { color: done ? colors.foreground : colors.mutedForeground }]}>
                  {p.userName}
                </Text>
                {done && <Ionicons name="checkmark" size={12} color={colors.secondary} />}
              </View>
            );
          })}
        </View>
      </View>

      {/* ── STANDINGS — live leaderboard (top 6) ── */}
      <Text style={[s.sectionLabel, { color: colors.mutedForeground }]}>STANDINGS · TOP 6</Text>
      <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {standings.length === 0 && (
          <Text style={[s.emptySub, { color: colors.mutedForeground, textAlign: 'center' }]}>No players yet</Text>
        )}
        {standings.map((p, i) => {
          const [av, avtx] = AVATAR_COLORS[i % AVATAR_COLORS.length];
          const win = i === 0;
          return (
            <View key={p.id} style={[s.standingRow, win && { backgroundColor: colors.primary + '10', borderRadius: 10 }]}>
              <Text style={[s.rank, { color: win ? colors.primary : colors.mutedForeground }]}>{i + 1}</Text>
              <View style={[s.avatar, { backgroundColor: av }]}>
                <Text style={[s.avatarText, { color: avtx }]}>{p.userName.substring(0, 1).toUpperCase()}</Text>
              </View>
              <Text
                style={[s.standingName, { color: colors.foreground }, win && { fontFamily: 'Manrope_800ExtraBold' }]}
                numberOfLines={1}
              >
                {p.userName}
              </Text>
              <Text style={[s.standingScore, { color: win ? colors.foreground : colors.mutedForeground }]}>
                {p.totalScore}
              </Text>
            </View>
          );
        })}
      </View>

      {/* ── End game ── */}
      <Pressable
        style={({ pressed }) => [
          s.endBtn,
          { backgroundColor: colors.destructive, opacity: pressed || ending ? 0.8 : 1 },
        ]}
        onPress={handleEndGame}
        disabled={ending}
      >
        {ending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="flag" size={18} color="#fff" />
            <Text style={s.endBtnText}>End game</Text>
          </>
        )}
      </Pressable>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { alignItems: 'center', justifyContent: 'center' },
    list: { paddingHorizontal: 16, paddingTop: 8, gap: 12 },
    emptyHeading: { fontSize: 20, fontFamily: 'Manrope_800ExtraBold', textAlign: 'center' },
    emptySub: { fontSize: 14, lineHeight: 21, textAlign: 'center' },
    // Connection banners
    connBanner: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    },
    connBannerTitle: { fontSize: 13, fontFamily: 'Manrope_700Bold' },
    connBannerSub: { fontSize: 11.5, lineHeight: 16, marginTop: 1 },
    // Game picker
    pickerRow: { gap: 8, paddingBottom: 2 },
    pickerChip: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 7, maxWidth: 220 },
    pickerChipText: { fontSize: 13, fontFamily: 'Manrope_700Bold' },
    // Topbar
    topbar: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    liveBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      borderRadius: 20, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 4,
    },
    liveDot: { width: 7, height: 7, borderRadius: 4 },
    liveBadgeText: { fontSize: 9, fontFamily: 'Manrope_800ExtraBold', letterSpacing: 1.5 },
    titleGroup: { flex: 1, gap: 1 },
    title: { fontSize: 16, fontFamily: 'Manrope_800ExtraBold' },
    playerCountText: { fontSize: 11.5, fontFamily: 'Manrope_600SemiBold' },
    codeChip: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4, alignItems: 'center' },
    codeLabel: { fontSize: 8, fontFamily: 'Manrope_700Bold', letterSpacing: 1 },
    codeText: { fontSize: 14, fontFamily: 'Manrope_800ExtraBold', letterSpacing: 2 },
    // Question card
    card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
    qMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    qMeta: { fontSize: 10, fontFamily: 'Manrope_700Bold', letterSpacing: 2 },
    tag: { borderRadius: 6, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 2 },
    tagText: { fontSize: 9, fontFamily: 'Manrope_700Bold', letterSpacing: 1 },
    qText: { fontSize: 19, lineHeight: 26, fontFamily: 'Manrope_800ExtraBold' },
    revealRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    revealPill: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      borderRadius: 20, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4,
    },
    revealPillText: { fontSize: 9, fontFamily: 'Manrope_700Bold', letterSpacing: 1 },
    answeredMeta: { fontSize: 12, fontFamily: 'Manrope_600SemiBold' },
    choices: { gap: 8 },
    choiceRow: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10,
    },
    choiceLetter: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
    choiceLetterText: { fontSize: 12, fontFamily: 'Manrope_800ExtraBold' },
    choiceText: { flex: 1, fontSize: 14, lineHeight: 19 },
    choiceTally: { fontSize: 13, fontFamily: 'Manrope_800ExtraBold' },
    freeAnswer: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10,
    },
    freeAnswerText: { flex: 1, fontSize: 14, fontFamily: 'Manrope_700Bold' },
    // Transport controls
    transport: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      borderRadius: 16, borderWidth: 1, padding: 10,
    },
    tBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10,
    },
    tBtnText: { fontSize: 13, fontFamily: 'Manrope_700Bold' },
    tBtnPrimary: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10, marginLeft: 'auto',
    },
    tBtnPrimaryText: { color: '#fff', fontSize: 14, fontFamily: 'Manrope_800ExtraBold' },
    // Answered panel
    sectionLabel: { fontSize: 11, fontFamily: 'Manrope_700Bold', letterSpacing: 2, marginTop: 4 },
    progressBg: { height: 5, borderRadius: 3, overflow: 'hidden' },
    progressFill: { height: 5, borderRadius: 3 },
    chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    playerChip: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      borderRadius: 20, borderWidth: 1, paddingLeft: 4, paddingRight: 9, paddingVertical: 4,
    },
    avatar: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontSize: 9, fontFamily: 'Manrope_800ExtraBold' },
    playerChipName: { fontSize: 12, fontFamily: 'Manrope_600SemiBold' },
    // Standings
    standingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 6, paddingVertical: 7 },
    rank: { width: 16, textAlign: 'center', fontSize: 12, fontFamily: 'Manrope_800ExtraBold' },
    standingName: { flex: 1, fontSize: 14, fontFamily: 'Manrope_700Bold' },
    standingScore: { fontSize: 14, fontFamily: 'Manrope_800ExtraBold' },
    // End game
    endBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 8, borderRadius: 14, paddingVertical: 16, marginTop: 4,
    },
    endBtnText: { color: '#fff', fontSize: 16, fontFamily: 'Manrope_700Bold' },
  });
