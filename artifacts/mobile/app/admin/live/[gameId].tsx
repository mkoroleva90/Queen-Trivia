import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getItem } from '@/lib/storage';
import { ADMIN_TOKEN_KEY } from '@/context/AdminAuthContext';
import {
  useListGames,
  getListGamesQueryKey,
  useListGameQuestions,
  useListGameParticipants,
  useUpdateGame,
} from '@workspace/api-client-react';
import type { Question } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { LiveBanner } from '@/components/admin/LiveBanner';
import { useAdminGameSocket } from '@/hooks/useSocket';
import { API_BASE_URL } from '@/lib/apiBase';
import { COPY } from '@workspace/copy';
import {
  MultipleChoiceQ,
  MultiSelectQ,
  TrueFalseQ,
  WriteInQ,
  OrderingQ,
  SliderQ,
  ImageRecognitionQ,
  ImageHotspotQ,
  MatchingQ,
} from '../../game/[id]';

type AnswerCounts = Record<number, number>; // questionId → total submitted

type QuestionStat = {
  id: number;
  totalAnswered: number;
  correctCount: number;
};

async function fetchAdminJson<T>(url: string): Promise<T> {
  const token = await getItem(ADMIN_TOKEN_KEY).catch(() => null);
  const r = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json() as Promise<T>;
}

export default function AdminLiveScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const { gameId: gameIdStr } = useLocalSearchParams<{ gameId: string }>();
  const gameId = parseInt(gameIdStr ?? '', 10);

  const [answerCounts, setAnswerCounts] = useState<AnswerCounts>({});
  const [correctCounts, setCorrectCounts] = useState<AnswerCounts>({});
  // Track whether we've seeded from persisted stats.
  const [seeded, setSeeded] = useState(false);
  // Buffer socket events that arrive before the initial stats seed resolves.
  // When the seed arrives, we apply baseline + buffer so no events are lost.
  const preSeedBuffer = useRef<{ answers: AnswerCounts; corrects: AnswerCounts }>({
    answers: {},
    corrects: {},
  });
  const [refreshing, setRefreshing] = useState(false);
  const [ending, setEnding] = useState(false);
  const [endGameError, setEndGameError] = useState<string | null>(null);

  // ── Host play-along state ──
  const [hostAnswers, setHostAnswers] = useState<Record<number, string>>({});
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [answerError, setAnswerError] = useState('');
  const [hostSkippedIds, setHostSkippedIds] = useState<Set<number>>(new Set());
  const [hostFeedback, setHostFeedback] = useState<{ isCorrect: boolean; pointsEarned: number; totalScore: number; feedback?: string } | null>(null);
  // Answer submitted to API but not yet acknowledged by host via "Next" press.
  const [pendingAnswer, setPendingAnswer] = useState<string | null>(null);

  const { data: games, isLoading: gamesLoading, isError: gamesError } = useListGames();
  const game = games?.find((g) => g.id === gameId);
  const { data: questions } = useListGameQuestions(gameId);
  const { data: participants, refetch: refetchParticipants } = useListGameParticipants(gameId);
  const updateGame = useUpdateGame();

  const baseUrl = API_BASE_URL;

  const handleKickPlayer = (userId: number, userName: string) => {
    Alert.alert(
      COPY.kick.confirmTitle,
      `"${userName}" ${COPY.kick.confirmBody}`,
      [
        { text: COPY.kick.confirmCancel, style: 'cancel' },
        {
          text: COPY.kick.confirmRemove,
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await getItem(ADMIN_TOKEN_KEY).catch(() => null);
              const r = await fetch(`${baseUrl}/api/games/${gameId}/participants/${userId}`, {
                method: 'DELETE',
                headers: token ? { Authorization: `Bearer ${token}` } : {},
              });
              if (!r.ok) throw new Error(`HTTP ${r.status}`);
              void refetchParticipants();
            } catch {
              Alert.alert('Error', COPY.kick.removeError);
            }
          },
        },
      ],
    );
  };

  // Fetch persisted per-question stats to seed the answer counts on mount.
  // After seeding, socket events increment incrementally from the baseline.
  const { data: seedStats } = useQuery<QuestionStat[]>({
    queryKey: ['live-seed-stats', gameId],
    queryFn: () => fetchAdminJson<QuestionStat[]>(`${baseUrl}/api/games/${gameId}/questions/stats`),
    enabled: !isNaN(gameId),
    staleTime: Infinity, // seed once on mount; socket events keep it live
  });

  // Apply persisted baseline + any pre-seed socket events (additive, not max).
  // Events buffered in preSeedBuffer before stats resolved are added on top so
  // no answer is lost regardless of which resolves first.
  useEffect(() => {
    if (!seedStats || seeded) return;
    const buf = preSeedBuffer.current;
    const answers: AnswerCounts = {};
    const corrects: AnswerCounts = {};
    for (const s of seedStats) {
      answers[s.id] = s.totalAnswered + (buf.answers[s.id] ?? 0);
      corrects[s.id] = s.correctCount + (buf.corrects[s.id] ?? 0);
    }
    setAnswerCounts(answers);
    setCorrectCounts(corrects);
    setSeeded(true);
  }, [seedStats, seeded]);

  const sortedQs: Question[] = [...(questions ?? [])].sort(
    (a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0),
  );

  // Real-time answer tracking via Socket.IO.
  // Before the persisted seed resolves, events go into a ref buffer so they
  // can be applied additively on top of the baseline without being overwritten.
  // After seeding, events increment React state directly.
  const onAnswerSubmitted = useCallback(
    (p: { gameId: number; questionId: number; playerName: string; isCorrect: boolean }) => {
      if (p.gameId !== gameId) return;
      if (!seeded) {
        // Buffer pre-seed events in the ref — no state update needed yet.
        preSeedBuffer.current.answers[p.questionId] =
          (preSeedBuffer.current.answers[p.questionId] ?? 0) + 1;
        if (p.isCorrect) {
          preSeedBuffer.current.corrects[p.questionId] =
            (preSeedBuffer.current.corrects[p.questionId] ?? 0) + 1;
        }
      } else {
        setAnswerCounts((prev) => ({ ...prev, [p.questionId]: (prev[p.questionId] ?? 0) + 1 }));
        if (p.isCorrect) {
          setCorrectCounts((prev) => ({ ...prev, [p.questionId]: (prev[p.questionId] ?? 0) + 1 }));
        }
      }
      refetchParticipants();
    },
    [gameId, seeded, refetchParticipants],
  );

  const onGameEnded = useCallback(
    (p: { gameId: number }) => {
      if (p.gameId === gameId) {
        qc.invalidateQueries({ queryKey: getListGamesQueryKey() });
        router.replace(`/admin/results/${gameId}`);
      }
    },
    [gameId, qc, router],
  );

  useAdminGameSocket(isNaN(gameId) ? null : gameId, { onAnswerSubmitted, onGameEnded });

  const totalPlayers = participants?.length ?? 0;

  // ── Host play-along ──
  const playAlong = !!game?.hostPlaysAlong;
  const unansweredForHost = sortedQs.filter((q) => hostAnswers[q.id] === undefined);
  const currentPlayingQ = playAlong
    ? (unansweredForHost.find((q) => !hostSkippedIds.has(q.id)) ?? unansweredForHost[0])
    : undefined;
  const hostCanSkip = unansweredForHost.length > 1;

  /** Submits the host's answer. On success, sets feedback state; feedback
   *  stays visible until host presses "Next" (advanceToNext). */
  const submitHostAnswer = async (questionId: number, answer: string): Promise<void> => {
    if (!currentPlayingQ || submittingAnswer) return;
    setSubmittingAnswer(true);
    setAnswerError('');
    try {
      const token = await getItem(ADMIN_TOKEN_KEY).catch(() => null);
      const r = await fetch(`${baseUrl}/api/games/${gameId}/host-answer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ questionId, userAnswer: answer }),
      });
      if (r.status === 409) {
        // Already answered — adopt existing answer and advance without feedback.
        const body = await r.json().catch(() => null) as { existingAnswer?: string } | null;
        setHostAnswers((prev) => ({ ...prev, [questionId]: body?.existingAnswer ?? '' }));
        return;
      }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json().catch(() => ({})) as { isCorrect?: boolean; pointsEarned?: number; totalScore?: number; feedback?: string };
      // Don't update hostAnswers yet — done by advanceToNext so feedback stays visible.
      setPendingAnswer(answer);
      setHostFeedback({
        isCorrect: data.isCorrect ?? false,
        pointsEarned: data.pointsEarned ?? 0,
        totalScore: data.totalScore ?? 0,
        feedback: data.feedback,
      });
      void refetchParticipants();
    } catch {
      setAnswerError('Could not submit your answer — please retry');
    } finally {
      setSubmittingAnswer(false);
    }
  };

  /** Called when the host presses "Next question" or "See results" after seeing feedback. */
  const advanceToNext = () => {
    if (currentPlayingQ && pendingAnswer !== null) {
      setHostAnswers((prev) => ({ ...prev, [currentPlayingQ.id]: pendingAnswer }));
    }
    setPendingAnswer(null);
    setHostFeedback(null);
  };

  /** Renders the appropriate player question component for the playing host. */
  const renderHostQuestion = (q: Question) => {
    const lockedAnswer = pendingAnswer ?? (hostAnswers[q.id] ?? null);
    const isLocked = lockedAnswer !== null;
    // Pass feedback to components that use it for correct/wrong coloring.
    const feedbackForComp = hostFeedback && isLocked ? {
      isCorrect: hostFeedback.isCorrect,
      pointsEarned: hostFeedback.pointsEarned,
      totalScore: hostFeedback.totalScore,
      timeTaken: '—',
      feedback: hostFeedback.feedback,
    } : null;
    const props = {
      question: q,
      disabled: submittingAnswer || isLocked,
      lockedAnswer,
      onSubmit: (answer: string) => { void submitHostAnswer(q.id, answer); },
    };
    switch (q.questionType) {
      case 'multiple_choice': return <MultipleChoiceQ {...props} feedback={feedbackForComp} />;
      case 'multi_select':    return <MultiSelectQ {...props} />;
      case 'true_false':      return <TrueFalseQ onSubmit={props.onSubmit} disabled={props.disabled} lockedAnswer={props.lockedAnswer} />;
      case 'write_in':        return <WriteInQ onSubmit={props.onSubmit} disabled={props.disabled} lockedAnswer={props.lockedAnswer} />;
      case 'short_response':  return <WriteInQ onSubmit={props.onSubmit} disabled={props.disabled} lockedAnswer={props.lockedAnswer} multiline />;
      case 'ordering':        return <OrderingQ key={q.id} {...props} />;
      case 'slider':          return <SliderQ key={q.id} {...props} />;
      case 'image_recognition': return <ImageRecognitionQ {...props} />;
      case 'image_hotspot':   return <ImageHotspotQ key={q.id} {...props} />;
      case 'matching':        return <MatchingQ key={q.id} {...props} />;
      default:                return null;
    }
  };

  const handleEndGame = async () => {
    setEnding(true);
    setEndGameError(null);
    try {
      await updateGame.mutateAsync({ gameId, data: { status: 'completed' } });
      qc.invalidateQueries({ queryKey: getListGamesQueryKey() });
      router.replace(`/admin/results/${gameId}`);
    } catch {
      setEnding(false);
      setEndGameError('Failed to end the game. Please try again.');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refetchParticipants();
    setRefreshing(false);
  };

  const s = styles(colors);

  if (gamesLoading) {
    return (
      <View style={[s.container, s.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (gamesError || !game) {
    return (
      <View style={[s.container, s.center, { paddingTop: insets.top }]}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.mutedForeground} />
        <Text style={[s.errorTitle, { color: colors.foreground }]}>Game not found</Text>
        <Text style={[s.errorSub, { color: colors.mutedForeground }]}>
          This game may have ended or is no longer available.
        </Text>
        <Pressable
          style={[s.errorBackBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.back()}
        >
          <Text style={s.errorBackBtnText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color={colors.foreground} />
        </Pressable>
        <View style={s.headerCenter}>
          <View style={[s.liveDot, { backgroundColor: colors.secondary }]} />
          <Text style={[s.headerTitle, { color: colors.foreground }]} numberOfLines={1}>
            {game.topic}
          </Text>
        </View>
        <View style={[s.codeChip, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[s.codeText, { color: colors.accent }]}>{game.accessCode}</Text>
        </View>
      </View>

      {/* Stats bar */}
      <View style={[s.statsBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={s.statItem}>
          <Text style={[s.statNum, { color: colors.secondary }]}>{totalPlayers}</Text>
          <Text style={[s.statLabel, { color: colors.mutedForeground }]}>Players</Text>
        </View>
        <View style={[s.statDivider, { backgroundColor: colors.border }]} />
        <View style={s.statItem}>
          <Text style={[s.statNum, { color: colors.accent }]}>
            {Object.values(answerCounts).reduce((a, b) => a + b, 0)}
          </Text>
          <Text style={[s.statLabel, { color: colors.mutedForeground }]}>Answers</Text>
        </View>
        <View style={[s.statDivider, { backgroundColor: colors.border }]} />
        <View style={s.statItem}>
          <Text style={[s.statNum, { color: colors.primary }]}>{sortedQs.length}</Text>
          <Text style={[s.statLabel, { color: colors.mutedForeground }]}>Questions</Text>
        </View>
      </View>

      {/* Question answer tracking */}
      <ScrollView
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* ── First-run reassurance banner (Host & play only) ── */}
        {playAlong && <LiveBanner gameId={gameId} />}
        {/* ── Host play-along question card ── */}
        {playAlong && (
          <>
            {currentPlayingQ ? (
              <>
                <Text style={[s.sectionLabel, { color: colors.mutedForeground }]}>
                  YOUR QUESTION — {sortedQs.findIndex((q) => q.id === currentPlayingQ.id) + 1}/{sortedQs.length}
                </Text>
                <View style={[s.qCard, { backgroundColor: colors.card, borderColor: colors.primary + '66' }]}>
                  <Text style={[s.playMeta, { color: colors.mutedForeground }]}>
                    {currentPlayingQ.questionType.replace(/_/g, ' ')} · {currentPlayingQ.points} pts
                  </Text>
                  <Text style={[s.playQText, { color: colors.foreground }]}>{currentPlayingQ.questionText}</Text>

                  {renderHostQuestion(currentPlayingQ)}

                  {/* Feedback block — visible after submission, until host presses Next */}
                  {hostFeedback && (
                    <View style={[s.feedbackBlock, { backgroundColor: hostFeedback.isCorrect ? '#00ddff18' : '#ff008018', borderColor: hostFeedback.isCorrect ? '#00ddff55' : '#ff008055' }]}>
                      <Text style={[s.feedbackTitle, { color: hostFeedback.isCorrect ? '#00ddff' : '#ff5aa8' }]}>
                        {hostFeedback.isCorrect ? COPY.gameplay.feedbackCorrect : COPY.gameplay.feedbackWrong}
                      </Text>
                      <Text style={[s.feedbackPts, { color: colors.mutedForeground }]}>
                        +{hostFeedback.pointsEarned} pts · total {hostFeedback.totalScore}
                      </Text>
                      {!!hostFeedback.feedback && (
                        <Text style={[s.feedbackText, { color: colors.mutedForeground }]}>{hostFeedback.feedback}</Text>
                      )}
                      <Pressable
                        style={[s.choiceBtn, { borderColor: hostFeedback.isCorrect ? '#00ddff' : colors.border, backgroundColor: hostFeedback.isCorrect ? '#00ddff22' : colors.card, marginTop: 4 }]}
                        onPress={advanceToNext}
                      >
                        <Text style={[s.choiceText, { color: hostFeedback.isCorrect ? '#00ddff' : colors.foreground, textAlign: 'center' }]}>
                          {unansweredForHost.length > 1 ? COPY.hostPlayAlong.nextQuestionBtn : COPY.hostPlayAlong.seeResultsBtn}
                        </Text>
                      </Pressable>
                    </View>
                  )}

                  {!!answerError && (
                    <Text style={[s.qText, { color: colors.destructive }]}>{answerError}</Text>
                  )}

                  {!hostFeedback && hostCanSkip && (
                    <Pressable onPress={() => setHostSkippedIds((prev) => new Set([...prev, currentPlayingQ.id]))}>
                      <Text style={[s.playMeta, { color: colors.mutedForeground, textAlign: 'center', paddingVertical: 4 }]}>
                        {COPY.hostPlayAlong.skipBtn}
                      </Text>
                    </Pressable>
                  )}
                </View>
              </>
            ) : (
              <View style={[s.qCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[s.playQText, { color: colors.secondary }]}>
                  {COPY.hostPlayAlong.allAnsweredMsg}
                </Text>
              </View>
            )}
          </>
        )}

        {/* ANSWER PROGRESS — hidden when host is playing along */}
        {!playAlong && (
          <>
            <Text style={[s.sectionLabel, { color: colors.mutedForeground }]}>ANSWER PROGRESS</Text>
            {sortedQs.length === 0 ? (
              <Text style={[s.emptyText, { color: colors.mutedForeground }]}>No questions in this game.</Text>
            ) : (
              sortedQs.map((q, idx) => {
                const total = answerCounts[q.id] ?? 0;
                const correct = correctCounts[q.id] ?? 0;
                const pct = totalPlayers > 0 ? total / totalPlayers : 0;
                return (
                  <View key={q.id} style={[s.qCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={s.qTop}>
                      <Text style={[s.qNum, { color: colors.mutedForeground }]}>Q{idx + 1}</Text>
                      <Text style={[s.qAnswered, { color: colors.foreground }]}>
                        {total}/{totalPlayers} answered
                      </Text>
                      {total > 0 && (
                        <Text style={[s.qCorrect, { color: colors.secondary }]}>
                          {correct} correct
                        </Text>
                      )}
                    </View>
                    <Text style={[s.qText, { color: colors.foreground }]} numberOfLines={2}>
                      {q.questionText}
                    </Text>
                    {/* Progress bar */}
                    <View style={[s.progressBg, { backgroundColor: colors.border }]}>
                      <View
                        style={[s.progressFill, { backgroundColor: colors.secondary, width: `${Math.round(pct * 100)}%` }]}
                      />
                    </View>
                  </View>
                );
              })
            )}
          </>
        )}

        {/* Players */}
        {(participants?.length ?? 0) > 0 && (
          <>
            <Text style={[s.sectionLabel, { color: colors.mutedForeground }]}>PLAYERS IN GAME</Text>
            {participants!.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={[s.playerRow, { borderColor: colors.border }]}
                onPress={() => handleKickPlayer(p.userId, p.userName)}
                activeOpacity={0.7}
              >
                <Ionicons name="person-circle-outline" size={20} color={colors.mutedForeground} />
                <Text style={[s.playerName, { color: colors.foreground }]}>{p.userName}</Text>
                <Text style={[s.playerScore, { color: colors.accent }]}>{p.totalScore} pts</Text>
                <Ionicons name="close-circle-outline" size={18} color={colors.destructive} style={{ marginLeft: 4 }} />
              </TouchableOpacity>
            ))}
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* End Game button */}
      <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
        {endGameError && (
          <Text style={[s.endGameError, { color: colors.destructive }]}>{endGameError}</Text>
        )}
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
              <Text style={s.endBtnText}>End Game</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { alignItems: 'center', justifyContent: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
    backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
    liveDot: { width: 8, height: 8, borderRadius: 4 },
    headerTitle: { flex: 1, fontSize: 18, fontFamily: 'Manrope_700Bold' },
    codeChip: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
    codeText: { fontSize: 13, fontFamily: 'Manrope_700Bold', letterSpacing: 2 },
    statsBar: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 12, borderRadius: 14, borderWidth: 1, padding: 16 },
    statItem: { flex: 1, alignItems: 'center', gap: 2 },
    statNum: { fontSize: 24, fontFamily: 'Manrope_800ExtraBold' },
    statLabel: { fontSize: 11, fontFamily: 'Manrope_600SemiBold', textTransform: 'uppercase', letterSpacing: 1 },
    statDivider: { width: 1, marginVertical: 4 },
    list: { paddingHorizontal: 16, gap: 10 },
    sectionLabel: { fontSize: 11, fontFamily: 'Manrope_700Bold', letterSpacing: 2, textTransform: 'uppercase', marginTop: 8, marginBottom: 4 },
    emptyText: { fontSize: 14, textAlign: 'center' },
    qCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 8 },
    qTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    qNum: { fontSize: 12, fontFamily: 'Manrope_700Bold', width: 24 },
    qAnswered: { flex: 1, fontSize: 13, fontFamily: 'Manrope_600SemiBold' },
    qCorrect: { fontSize: 13, fontFamily: 'Manrope_600SemiBold' },
    qText: { fontSize: 14, lineHeight: 20 },
    playQText: { fontSize: 16, lineHeight: 23, fontFamily: 'Manrope_700Bold' },
    playMeta: { fontSize: 12, fontFamily: 'Manrope_700Bold', alignSelf: 'stretch' },
    choiceBtn: { borderWidth: 1, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14 },
    choiceText: { fontSize: 14, fontFamily: 'Manrope_600SemiBold' },
    answerInput: { borderWidth: 1, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, fontSize: 14 },
    navBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, borderWidth: 1, borderRadius: 12, paddingVertical: 10 }, // kept for future use
    progressBg: { height: 4, borderRadius: 2, overflow: 'hidden' },
    progressFill: { height: 4, borderRadius: 2 },
    playerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1 },
    playerName: { flex: 1, fontSize: 14 },
    playerScore: { fontSize: 14, fontFamily: 'Manrope_700Bold' },
    footer: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#222' },
    endBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 16 },
    endBtnText: { color: '#fff', fontSize: 16, fontFamily: 'Manrope_700Bold' },
    endGameError: { fontSize: 13, fontFamily: 'Manrope_600SemiBold', textAlign: 'center', marginBottom: 8 },
    errorTitle: { fontSize: 20, fontFamily: 'Manrope_800ExtraBold', textAlign: 'center' },
    errorSub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
    errorBackBtn: { marginTop: 8, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14 },
    errorBackBtnText: { color: '#fff', fontSize: 15, fontFamily: 'Manrope_700Bold' },
    feedbackBlock: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 8, marginTop: 4 },
    feedbackTitle: { fontSize: 15, fontFamily: 'Manrope_800ExtraBold' },
    feedbackPts: { fontSize: 13, fontFamily: 'Manrope_600SemiBold' },
    feedbackText: { fontSize: 13, lineHeight: 18 },
  });
