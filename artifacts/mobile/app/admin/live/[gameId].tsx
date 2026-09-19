import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text } from '@/components/ThemedText';
import { TextInput } from '@/components/ThemedTextInput';
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
import type { PendingAnswerReview, Question } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useAdminGameSocket } from '@/hooks/useSocket';
import { API_BASE_URL } from '@/lib/apiBase';
import { COPY } from '@workspace/copy';
import { buildAnswerRows, type AnswerBreakdownEntry, type AnswerRow } from '@workspace/live-tally';
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
  QuizCompleteModal,
} from '../../game/[id]';

// Per-question snapshot from /questions/stats: the live answered / correct
// figures and the answer breakdown, refetched as players answer.
type QuestionStat = {
  id: number;
  totalAnswered: number;
  correctCount: number;
  percentCorrect: number | null;
  answerBreakdown?: AnswerBreakdownEntry[];
};

// Ranked players from /results — the same ordering the results screen shows.
type LiveStandingEntry = {
  id: number;
  userId: number;
  userName: string;
  totalScore: number;
  rank: number;
  correctCount: number;
  totalAnswered: number;
};

type LiveResults = {
  participants: LiveStandingEntry[];
  totalQuestions: number;
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

  const [refreshing, setRefreshing] = useState(false);
  // Questions whose correct answer the host chose to reveal in the live
  // results. Everything else shows the live distribution only.
  const [revealedIds, setRevealedIds] = useState<Set<number>>(new Set());
  const toggleReveal = (questionId: number) => {
    setRevealedIds((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) next.delete(questionId); else next.add(questionId);
      return next;
    });
  };
  const [ending, setEnding] = useState(false);
  const [endGameError, setEndGameError] = useState<string | null>(null);
  const [reviewingAnswerId, setReviewingAnswerId] = useState<number | null>(null);

  // ── Host play-along state ──
  const [hostAnswers, setHostAnswers] = useState<Record<number, string>>({});
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [answerError, setAnswerError] = useState('');
  const [hostSkippedIds, setHostSkippedIds] = useState<Set<number>>(new Set());
  // Answers and feedback the host submitted this session, keyed by question id,
  // so a question viewed again renders locked with the feedback shown then.
  const [hostResultById, setHostResultById] = useState<Record<number, { answer: string; result: { isCorrect: boolean; pointsEarned: number; totalScore: number; feedback?: string } }>>({});
  const [completionModalVisible, setCompletionModalVisible] = useState(false);
  const completionAlertShownRef = useRef(false);
  // "Ready for the next question?" popup — opens when the host submits an
  // answer; "Not yet" hides it until they reopen it or answer again.
  const [nextPromptDismissed, setNextPromptDismissed] = useState(true);
  // Locally-monitored question index (mirrors qIndex on web). Play is
  // self-paced: Back/Forward move it freely through every question.
  const [qIndex, setQIndex] = useState(0);
  // Set when the host-answer seed lands, so the view can jump to the first
  // unanswered question once the question list is available.
  const seedJumpRef = useRef(false);

  const { data: games, isLoading: gamesLoading, isError: gamesError } = useListGames();
  const game = games?.find((g) => g.id === gameId);
  const { data: questions } = useListGameQuestions(gameId);
  const { data: participants, refetch: refetchParticipants } = useListGameParticipants(gameId);
  const updateGame = useUpdateGame();

  // ── Rename while live ──
  // The host can change the quiz title after it has gone live. Same PATCH as
  // the games list; players pick the new title up on their next game refetch.
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [titleError, setTitleError] = useState<string | null>(null);
  const [titleSaving, setTitleSaving] = useState(false);

  const startEditTitle = () => {
    if (!game) return;
    setTitleDraft(game.topic ?? '');
    setTitleError(null);
    setEditingTitle(true);
  };

  const cancelEditTitle = () => {
    setEditingTitle(false);
    setTitleError(null);
  };

  const saveTitle = async () => {
    if (!game) return;
    const name = titleDraft.trim();
    if (!name) {
      setTitleError(COPY.admin.renameEmpty);
      return;
    }
    if (name === game.topic) { cancelEditTitle(); return; }
    setTitleSaving(true);
    try {
      await updateGame.mutateAsync({ gameId, data: { topic: name } });
      // Patch the cached list so the header reflects the new name right away.
      qc.setQueryData(
        getListGamesQueryKey(),
        (old: typeof games) => old?.map((g) => (g.id === gameId ? { ...g, topic: name } : g)),
      );
      qc.invalidateQueries({ queryKey: getListGamesQueryKey() });
      cancelEditTitle();
    } catch {
      setTitleError(COPY.admin.renameFailed);
    } finally {
      setTitleSaving(false);
    }
  };

  const baseUrl = API_BASE_URL;
  const {
    data: pendingReviews = [],
    refetch: refetchPendingReviews,
  } = useQuery<PendingAnswerReview[]>({
    queryKey: ['pending-answer-reviews', gameId],
    queryFn: () => fetchAdminJson<PendingAnswerReview[]>(`${baseUrl}/api/games/${gameId}/answers/pending-review`),
    enabled: !isNaN(gameId),
    refetchInterval: 10000,
  });

  const handleReviewAnswer = async (review: PendingAnswerReview, award: boolean) => {
    if (reviewingAnswerId !== null) return;
    setReviewingAnswerId(review.id);
    try {
      const token = await getItem(ADMIN_TOKEN_KEY).catch(() => null);
      const response = await fetch(`${baseUrl}/api/games/${gameId}/answers/${review.id}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ award }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await Promise.all([
        refetchPendingReviews(),
        refetchParticipants(),
        refetchLiveStats(),
        refetchLiveResults(),
      ]);
      qc.invalidateQueries({ queryKey: ['admin-q-stats', gameId] });
    } catch {
      Alert.alert(COPY.adminResults.reviewSaveErrorTitle, COPY.adminResults.reviewSaveErrorBody);
    } finally {
      setReviewingAnswerId(null);
    }
  };

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
              void refetchLiveResults();
            } catch {
              Alert.alert(COPY.common.error, COPY.kick.removeError);
            }
          },
        },
      ],
    );
  };

  // Live per-question results: the persisted snapshot, refetched after every
  // socket event (plus a 10s fallback poll) so the figures and the answer
  // breakdown follow the players as they answer. Same source as the web view.
  const { data: liveStats, refetch: refetchLiveStats } = useQuery<QuestionStat[]>({
    queryKey: ['live-seed-stats', gameId],
    queryFn: () => fetchAdminJson<QuestionStat[]>(`${baseUrl}/api/games/${gameId}/questions/stats`),
    enabled: !isNaN(gameId),
    refetchInterval: 10000,
  });
  const liveStatById = useMemo(
    () => new Map((liveStats ?? []).map((st): [number, QuestionStat] => [st.id, st])),
    [liveStats],
  );

  // Live standings: the ranked results the end-of-game screen shows.
  const { data: liveResults, refetch: refetchLiveResults } = useQuery<LiveResults>({
    queryKey: ['admin-results', gameId],
    queryFn: () => fetchAdminJson<LiveResults>(`${baseUrl}/api/games/${gameId}/results`),
    enabled: !isNaN(gameId),
    refetchInterval: 10000,
  });

  // Answers arrive in bursts; coalesce the server refreshes they trigger into
  // one round of requests per short window instead of one per player.
  const liveRefreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleLiveRefresh = useCallback(() => {
    if (liveRefreshTimer.current) return;
    liveRefreshTimer.current = setTimeout(() => {
      liveRefreshTimer.current = null;
      void refetchParticipants();
      void refetchLiveStats();
      void refetchLiveResults();
    }, 500);
  }, [refetchParticipants, refetchLiveStats, refetchLiveResults]);
  useEffect(() => () => {
    if (liveRefreshTimer.current) clearTimeout(liveRefreshTimer.current);
  }, []);

  const sortedQs: Question[] = [...(questions ?? [])].sort(
    (a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0) || a.id - b.id,
  );
  // First question the host hasn't answered (-1 when every question has one).
  const firstOpenIndex = sortedQs.findIndex((q) => hostAnswers[q.id] === undefined);
  // After the host-answer seed lands, jump the view to the host's first
  // unanswered question (or the last one when everything is answered).
  useEffect(() => {
    if (!seedJumpRef.current || sortedQs.length === 0) return;
    seedJumpRef.current = false;
    setQIndex(firstOpenIndex >= 0 ? firstOpenIndex : sortedQs.length - 1);
  }, [questions, hostAnswers]); // eslint-disable-line react-hooks/exhaustive-deps

  // Real-time updates via Socket.IO: every graded answer refreshes the live
  // results from the server (answers are persisted before the event is
  // emitted, so the refetch always includes the answer that triggered it).
  const onAnswerGraded = useCallback(
    (p: { gameId: number; questionId: number; playerName: string; isCorrect: boolean }) => {
      if (p.gameId !== gameId) return;
      scheduleLiveRefresh();
    },
    [gameId, scheduleLiveRefresh],
  );

  const onAnswerReviewed = useCallback(
    (p: { gameId: number; questionId: number; playerName: string; isCorrect: boolean }) => {
      if (p.gameId !== gameId) return;
      // A review changes an existing answer's correctness and score: refresh
      // the review queue and the live results from the server.
      void refetchPendingReviews();
      scheduleLiveRefresh();
    },
    [gameId, refetchPendingReviews, scheduleLiveRefresh],
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

  useAdminGameSocket(isNaN(gameId) ? null : gameId, { onAnswerGraded, onAnswerReviewed, onGameEnded });

  const totalPlayers = participants?.length ?? 0;

  // ── Host play-along ──
  const playAlong = !!game?.hostPlaysAlong;
  const unansweredForHost = sortedQs.filter((q) => hostAnswers[q.id] === undefined);
  // The playing host answers the question they are viewing, at their own pace.
  const currentPlayingQ = playAlong ? sortedQs[qIndex] : undefined;
  const hostCanSkip = unansweredForHost.length > 1;
  // Host & play: seed the host's own answers from the server once, so questions
  // answered before this screen loaded render locked straight away.
  useEffect(() => {
    if (!playAlong || isNaN(gameId)) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await getItem(ADMIN_TOKEN_KEY).catch(() => null);
        const r = await fetch(`${baseUrl}/api/games/${gameId}/host-answers`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!r.ok) return;
        const rows = await r.json() as { questionId: number; userAnswer: string; isCorrect: boolean; pointsEarned: number; feedback?: string }[];
        if (cancelled || rows.length === 0) return;
        const totalScore = rows.reduce((sum, row) => sum + row.pointsEarned, 0);
        // Answers submitted meanwhile win over the seed. Blank rows (skips) seed
        // hostAnswers only, so they stay answerable.
        setHostAnswers((prev) => ({
          ...Object.fromEntries(rows.map((row): [number, string] => [row.questionId, row.userAnswer])),
          ...prev,
        }));
        setHostResultById((prev) => ({
          ...Object.fromEntries(rows
            .filter((row) => row.userAnswer !== '')
            .map((row): [number, { answer: string; result: { isCorrect: boolean; pointsEarned: number; totalScore: number; feedback?: string } }] => [row.questionId, {
              answer: row.userAnswer,
              result: { isCorrect: row.isCorrect, pointsEarned: row.pointsEarned, totalScore, feedback: row.feedback },
            }])),
          ...prev,
        }));
        // Seeded answers count as acknowledged — never pop the prompt because of them.
        setNextPromptDismissed(true);
        // Self-paced: jump the view to the first question the host hasn't
        // answered yet, once the question list is available.
        seedJumpRef.current = true;
      } catch {
        // Fall back to discovering answers through the 409 on submit.
      }
    })();
    return () => { cancelled = true; };
  }, [gameId, playAlong, baseUrl]); // eslint-disable-line react-hooks/exhaustive-deps
  // On the last question there is nothing left to advance to, so the primary
  // action ends the game instead.
  const isOnLastQuestion = sortedQs.length > 0 && qIndex === sortedQs.length - 1;
  // "Earlier" now means before the host's own progress (their first unanswered
  // question) — used for the look-back banner only; navigation is unrestricted.
  const isViewingEarlier = firstOpenIndex >= 0 && qIndex < firstOpenIndex;
  const canGoBack = qIndex > 0;
  const canGoForward = qIndex < sortedQs.length - 1;
  const viewedQ: Question | undefined = sortedQs[qIndex];
  // Host & play: what the host has on record for the VIEWED question. A blank
  // recorded at the host's own progress is its "Unanswered" feedback; on an
  // earlier question it means skipped, which stays answerable.
  const viewedAnswer = viewedQ ? hostAnswers[viewedQ.id] : undefined;
  const viewedStored = viewedQ ? hostResultById[viewedQ.id] : undefined;
  const viewedResult = viewedStored && (viewedStored.answer !== '' || !isViewingEarlier) ? viewedStored : null;
  const hostFeedback = viewedResult?.result ?? null;
  const pendingAnswer = viewedResult?.answer ?? null;
  const viewedSkipped = !viewedResult && viewedAnswer === '';
  const viewedKnownOnly = !viewedResult && viewedAnswer !== undefined && viewedAnswer !== '';
  // The VIEWED question's record drives the next-question popup.
  const releasedResult = currentPlayingQ ? hostResultById[currentPlayingQ.id] : undefined;
  const releasedAnswer = currentPlayingQ ? hostAnswers[currentPlayingQ.id] : undefined;

  // Self-paced: advancing only moves the host's own view; players advance
  // through the quiz on their own time.
  const releaseNextQuestion = async () => {
    if (isOnLastQuestion) {
      handleEndGame();
      return;
    }
    setQIndex((i) => Math.min(sortedQs.length - 1, i + 1));
  };

  /** Submits the host's answer. On success, sets feedback state; feedback
   *  stays visible until host presses "Next" (advanceToNext). */
  const submitHostAnswer = async (questionId: number, answer: string): Promise<void> => {
    if (!currentPlayingQ || submittingAnswer) return;
    const isLastQuestion = currentPlayingQ.id === sortedQs[sortedQs.length - 1]?.id;
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
        // Already answered (e.g. the seed missed it) — adopt the stored answer
        // and show the answered block so the host can advance.
        const body = await r.json().catch(() => null) as { existingAnswer?: string } | null;
        const existingAnswer = body?.existingAnswer;
        if (existingAnswer !== undefined) {
          setHostAnswers((prev) => ({ ...prev, [questionId]: existingAnswer }));
        }
        return;
      }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json().catch(() => ({})) as { isCorrect?: boolean; pointsEarned?: number; totalScore?: number; feedback?: string };
      // Record the answer and its feedback for this question right away; the
      // feedback stays on record so it still shows if the host looks back.
      const result = {
        isCorrect: data.isCorrect ?? false,
        pointsEarned: data.pointsEarned ?? 0,
        totalScore: data.totalScore ?? 0,
        feedback: data.feedback,
      };
      setHostResultById((prev) => ({ ...prev, [questionId]: { answer, result } }));
      setHostAnswers((prev) => ({ ...prev, [questionId]: answer }));
      // A fresh answer opens the result popup with its advance action.
      setNextPromptDismissed(false);
      if (isLastQuestion && questionId === currentPlayingQ.id && !completionAlertShownRef.current) {
        completionAlertShownRef.current = true;
        setCompletionModalVisible(true);
      }
      void refetchParticipants();
    } catch {
      setAnswerError(COPY.hostPlayAlong.submitAnswerError);
    } finally {
      setSubmittingAnswer(false);
    }
  };

  /** Called when the host presses "Next question" or "See results" after seeing feedback. */
  const advanceToNext = () => {
    // The answer was recorded on submit, and the feedback stays on record so it
    // still shows if the host looks back at this question.
    void releaseNextQuestion();
  };

  // The popup shows the playing host their result with the advance action;
  // a monitoring host has no popup (the question list is always live).
  // Null means there is nothing to advance right now.
  const nextPromptAction: (() => void) | null = (() => {
    if (!playAlong) return null;
    if (!currentPlayingQ) return null;
    if (releasedResult) return advanceToNext;
    if (releasedAnswer !== undefined) return () => void releaseNextQuestion();
    return null;
  })();
  // Wait for the completion modal so two modals never stack on the last question.
  const nextPromptVisible = nextPromptAction !== null && !nextPromptDismissed && !completionModalVisible;
  // What the popup shows above its buttons: the released question's result when
  // the host has just answered or skipped it (verdict, points, AI feedback), or
  // the plain heading when there is nothing to show (monitoring host, or an
  // answer the server holds without feedback). Same wording and colours as the
  // inline feedback block.
  const nextPromptResult = releasedResult?.result ?? null;
  const nextPromptSkipped = releasedResult?.answer === '';
  const nextPromptHeading = nextPromptResult
    ? nextPromptSkipped
      ? COPY.results.skipped
      : nextPromptResult.isCorrect ? COPY.gameplay.feedbackCorrect : COPY.gameplay.feedbackWrongHeading
    : COPY.hostPlayAlong.nextPromptTitle;
  const nextPromptHeadingColor = nextPromptResult
    ? nextPromptSkipped
      ? colors.accent
      : nextPromptResult.isCorrect ? '#00ddff' : '#ff5aa8'
    : colors.foreground;

  /** Renders the appropriate player question component for the playing host. */
  const renderHostQuestion = (q: Question) => {
    // A recorded blank (a skip) does not lock the question — it stays answerable.
    const recorded = hostAnswers[q.id];
    const lockedAnswer = pendingAnswer ?? (recorded !== undefined && recorded !== '' ? recorded : null);
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
      case 'multiple_choice': return <MultipleChoiceQ key={q.id} {...props} feedback={feedbackForComp} />;
      case 'multi_select':    return <MultiSelectQ key={q.id} {...props} />;
      case 'true_false':      return <TrueFalseQ key={q.id} onSubmit={props.onSubmit} disabled={props.disabled} lockedAnswer={props.lockedAnswer} />;
      case 'write_in':        return <WriteInQ key={q.id} onSubmit={props.onSubmit} disabled={props.disabled} lockedAnswer={props.lockedAnswer} />;
      case 'short_response':  return <WriteInQ key={q.id} onSubmit={props.onSubmit} disabled={props.disabled} lockedAnswer={props.lockedAnswer} multiline />;
      case 'ordering':        return <OrderingQ key={q.id} {...props} shuffleItems />;
      case 'slider':          return <SliderQ key={q.id} {...props} />;
      case 'image_recognition': return <ImageRecognitionQ key={q.id} {...props} />;
      case 'image_hotspot':   return <ImageHotspotQ key={q.id} {...props} />;
      case 'matching':        return <MatchingQ key={q.id} {...props} />;
      default:                return null;
    }
  };

  const doEndGame = async () => {
    setEnding(true);
    setEndGameError(null);
    try {
      await updateGame.mutateAsync({ gameId, data: { status: 'completed' } });
      qc.invalidateQueries({ queryKey: getListGamesQueryKey() });
      router.replace(`/admin/results/${gameId}`);
    } catch {
      setEnding(false);
      setEndGameError(COPY.adminLive.endGameError);
    }
  };

  // Confirm before ending — every end-game entry point on both platforms
  // goes through this confirmation.
  const handleEndGame = () => {
    Alert.alert(COPY.adminLive.endGameTitle, COPY.adminLive.endGameBody, [
      { text: COPY.common.cancel, style: 'cancel' },
      { text: COPY.adminLive.endGameConfirm, style: 'destructive', onPress: () => { void doEndGame(); } },
    ]);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchParticipants(), refetchLiveStats(), refetchLiveResults()]);
    setRefreshing(false);
  };

  // Ranked from the live results; until they load, the participant list
  // ordered by score stands in (without the per-player progress line).
  const liveStandings: (Partial<LiveStandingEntry> & { id: number; userId: number; userName: string; totalScore: number; rank: number })[] =
    liveResults
      ? liveResults.participants
      : [...(participants ?? [])]
          .sort((a, b) => (b.totalScore ?? 0) - (a.totalScore ?? 0))
          .map((p, i) => ({ id: p.id, userId: p.userId, userName: p.userName, totalScore: p.totalScore ?? 0, rank: i + 1 }));
  const liveTotalQuestions = liveResults?.totalQuestions ?? sortedQs.length;

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
        <Text style={[s.errorTitle, { color: colors.foreground }]}>{COPY.adminLive.notFoundTitle}</Text>
        <Text style={[s.errorSub, { color: colors.mutedForeground }]}>
          {COPY.adminLive.notFoundBody}
        </Text>
        <Pressable
          style={[s.errorBackBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.back()}
        >
          <Text style={s.errorBackBtnText}>{COPY.adminLive.goBack}</Text>
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
        {editingTitle ? (
          <View style={s.headerCenter}>
            <TextInput
              style={[s.titleInput, { color: colors.foreground, borderColor: colors.primary, backgroundColor: colors.muted }]}
              value={titleDraft}
              onChangeText={(t) => { setTitleDraft(t); setTitleError(null); }}
              autoFocus
              maxLength={120}
              returnKeyType="done"
              editable={!titleSaving}
              onSubmitEditing={saveTitle}
              accessibilityLabel={COPY.gameEditor.quizNamePlaceholder}
            />
            {titleSaving ? (
              <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: 8 }} />
            ) : (
              <>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={COPY.admin.renameSaveLabel}
                  style={[s.titleIconBtn, { backgroundColor: colors.primary + '20' }]}
                  onPress={saveTitle}
                >
                  <Ionicons name="checkmark" size={18} color={colors.primary} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={COPY.admin.renameCancelLabel}
                  style={[s.titleIconBtn, { backgroundColor: colors.muted }]}
                  onPress={cancelEditTitle}
                >
                  <Ionicons name="close" size={18} color={colors.mutedForeground} />
                </Pressable>
              </>
            )}
          </View>
        ) : (
          <>
            <View style={s.headerCenter}>
              <View style={[s.liveDot, { backgroundColor: colors.secondary }]} />
              <Text style={[s.headerTitle, { color: colors.foreground }]} numberOfLines={1}>
                {game.topic}
              </Text>
              {/* Hosts can rename a quiz at any status, including while it is live. */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={COPY.admin.renameLabel}
                style={s.titleEditBtn}
                hitSlop={8}
                onPress={startEditTitle}
              >
                <Ionicons name="pencil-outline" size={15} color={colors.mutedForeground} />
              </Pressable>
            </View>
            <View style={[s.codeChip, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[s.codeText, { color: colors.accent }]}>{game.accessCode}</Text>
            </View>
          </>
        )}
      </View>
      {editingTitle && titleError && (
        <Text style={[s.titleError, { color: colors.destructive }]}>{titleError}</Text>
      )}

      {/* Question answer tracking */}
      <ScrollView
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* ── Host play-along question card ── */}
        {playAlong && (
          <>
            {currentPlayingQ && viewedQ ? (
              <>
                <View style={s.viewNav}>
                  <Text style={[s.sectionLabel, { color: colors.mutedForeground }]}>
                    YOUR QUESTION — {qIndex + 1}/{sortedQs.length}
                  </Text>
                  {/* Back / Forward — move freely through every question */}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={COPY.hostPlayAlong.viewBackLabel}
                    disabled={!canGoBack}
                    onPress={() => setQIndex((i) => Math.max(0, i - 1))}
                    hitSlop={8}
                    style={[s.viewNavBtn, { borderColor: colors.border, opacity: canGoBack ? 1 : 0.3 }]}
                  >
                    <Ionicons name="chevron-back" size={16} color={colors.foreground} />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={COPY.hostPlayAlong.viewForwardLabel}
                    disabled={!canGoForward}
                    onPress={() => setQIndex((i) => Math.min(sortedQs.length - 1, i + 1))}
                    hitSlop={8}
                    style={[s.viewNavBtn, { borderColor: colors.border, opacity: canGoForward ? 1 : 0.3 }]}
                  >
                    <Ionicons name="chevron-forward" size={16} color={colors.foreground} />
                  </Pressable>
                </View>
                {isViewingEarlier && (
                  <View style={[s.viewBanner, { backgroundColor: colors.accent + '18', borderColor: colors.accent + '55' }]}>
                    <Text style={[s.viewBannerText, { color: colors.accent }]}>{COPY.hostPlayAlong.viewingEarlier}</Text>
                    <Pressable accessibilityRole="button" onPress={() => setQIndex(firstOpenIndex)} hitSlop={8}>
                      <Text style={[s.viewBannerLink, { color: colors.accent }]}>{COPY.hostPlayAlong.backToCurrent}</Text>
                    </Pressable>
                  </View>
                )}
                {/* The answer card follows the VIEWED question. Answered → locked with its
                    feedback; skipped → answerable again. Advancing only moves the view. */}
                <View style={[s.qCard, { backgroundColor: colors.card, borderColor: !isViewingEarlier ? colors.primary + '66' : colors.border }]}>
                  <Text style={[s.playMeta, { color: colors.mutedForeground }]}>
                    {COPY.gameplay.ptsLine(viewedQ.points)}
                  </Text>
                  {viewedSkipped && (
                    /* Came back to a skipped question — it can still be answered */
                    <Text style={[s.playMeta, { color: colors.accent }]}>{COPY.gameplay.skippedEarlier}</Text>
                  )}
                  {viewedSkipped && (
                    /* A skip already on record (seeded on load) keeps the
                       advance control reachable without answering first */
                    <Pressable
                      style={[s.reopenBtn, { borderColor: colors.primary, backgroundColor: colors.primary + '22' }]}
                      onPress={() => setNextPromptDismissed(false)}
                    >
                      <Text style={[s.reopenBtnText, { color: colors.primary }]}>
                        {isOnLastQuestion ? COPY.hostPlayAlong.endGameBtn : COPY.hostPlayAlong.nextQuestionBtn}
                      </Text>
                    </Pressable>
                  )}
                  <Text style={[s.playQText, { color: colors.foreground }]}>{viewedQ.questionText}</Text>

                  {renderHostQuestion(viewedQ)}

                  {/* Feedback block — the result shown at submission, with the reopen control */}
                  {hostFeedback && (
                    <View style={[s.feedbackBlock, { backgroundColor: hostFeedback.isCorrect ? '#00ddff18' : '#ff008018', borderColor: hostFeedback.isCorrect ? '#00ddff55' : '#ff008055' }]}>
                      <Text style={[s.feedbackTitle, { color: hostFeedback.isCorrect ? '#00ddff' : '#ff5aa8' }]}>
                        {pendingAnswer === ''
                          ? COPY.results.unanswered
                          : hostFeedback.isCorrect ? COPY.gameplay.feedbackCorrect : COPY.gameplay.feedbackWrong}
                      </Text>
                      <Text style={[s.feedbackPts, { color: colors.mutedForeground }]}>
                        {COPY.adminLive.feedbackPts(hostFeedback.pointsEarned, hostFeedback.totalScore)}
                      </Text>
                      {!!hostFeedback.feedback && (
                        <Text style={[s.feedbackText, { color: colors.mutedForeground }]}>{hostFeedback.feedback}</Text>
                      )}
                      {/* Small reopen control — the advance action itself lives in the popup */}
                      <Pressable
                        style={[s.reopenBtn, { borderColor: hostFeedback.isCorrect ? '#00ddff' : colors.border, backgroundColor: hostFeedback.isCorrect ? '#00ddff22' : colors.card }]}
                        onPress={() => setNextPromptDismissed(false)}
                      >
                        <Text style={[s.reopenBtnText, { color: hostFeedback.isCorrect ? '#00ddff' : colors.foreground }]}>
                          {isOnLastQuestion ? COPY.hostPlayAlong.endGameBtn : COPY.hostPlayAlong.nextQuestionBtn}
                        </Text>
                      </Pressable>
                    </View>
                  )}

                  {/* Already-answered block — the server has this answer (no feedback to show) */}
                  {viewedKnownOnly && (
                    <View style={[s.feedbackBlock, { backgroundColor: colors.accent + '18', borderColor: colors.accent + '55' }]}>
                      <Text style={[s.feedbackTitle, { color: colors.accent }]}>
                        {COPY.hostPlayAlong.alreadyAnsweredMsg}
                      </Text>
                      <Text style={[s.feedbackPts, { color: colors.mutedForeground }]}>
                        {COPY.results.yourAnswer}: {viewedAnswer}
                      </Text>
                      {/* Small reopen control — the advance action itself lives in the popup */}
                      <Pressable
                        style={[s.reopenBtn, { borderColor: colors.accent, backgroundColor: colors.accent + '22' }]}
                        onPress={() => setNextPromptDismissed(false)}
                      >
                        <Text style={[s.reopenBtnText, { color: colors.accent }]}>
                          {isOnLastQuestion ? COPY.hostPlayAlong.endGameBtn : COPY.hostPlayAlong.nextQuestionBtn}
                        </Text>
                      </Pressable>
                    </View>
                  )}

                  {!!answerError && (
                    <Text style={[s.qText, { color: colors.destructive }]}>{answerError}</Text>
                  )}

                  {!hostFeedback && !viewedKnownOnly && hostCanSkip && (
                    <Pressable
                      disabled={submittingAnswer}
                      onPress={() => {
                        setHostSkippedIds((prev) => new Set([...prev, viewedQ.id]));
                        void submitHostAnswer(viewedQ.id, '');
                      }}
                    >
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

        {/* LIVE RESULTS — every question with its live answered figures and answer
            breakdown; the correct answer and correct count appear only after the
            host taps Show answer on that question. Hidden when the host plays
            along: a playing host must not see correctness aggregates mid-game.
            Players advance on their own, so there is no release control here. */}
        {!playAlong && (
          <>
            <View style={s.sectionHead}>
              <Text style={[s.sectionLabel, { color: colors.mutedForeground }]}>{COPY.liveResults.breakdownLabel}</Text>
              <Text style={[s.sectionHint, { color: colors.mutedForeground }]}>{COPY.liveResults.updatesHint}</Text>
            </View>
            {sortedQs.length === 0 ? (
              <Text style={[s.emptyText, { color: colors.mutedForeground }]}>{COPY.adminLive.noQuestions}</Text>
            ) : (
              sortedQs.map((q, idx) => {
                const st = liveStatById.get(q.id);
                const answered = st?.totalAnswered ?? 0;
                const correct = st?.correctCount ?? 0;
                const pct = st?.percentCorrect ?? (answered > 0 ? Math.round((correct / answered) * 100) : 0);
                const progress = totalPlayers > 0 ? Math.min(1, answered / totalPlayers) : 0;
                const revealed = revealedIds.has(q.id);
                return (
                  <View key={q.id} style={[s.qCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={s.qTop}>
                      <Text style={[s.qNum, { color: colors.mutedForeground }]}>Q{idx + 1}</Text>
                      <Text style={[s.qAnswered, { color: colors.foreground }]}>
                        {COPY.adminLive.answeredCount(answered, totalPlayers)}
                      </Text>
                      {revealed && answered > 0 && (
                        <Text style={[s.qCorrect, { color: colors.secondary }]}>
                          {COPY.liveResults.correctPct(correct, pct)}
                        </Text>
                      )}
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ selected: revealed }}
                        onPress={() => toggleReveal(q.id)}
                        hitSlop={6}
                        style={[
                          s.revealBtn,
                          revealed
                            ? { borderColor: colors.border, backgroundColor: 'transparent' }
                            : { borderColor: colors.secondary + '66', backgroundColor: colors.secondary + '18' },
                        ]}
                      >
                        <Text style={[s.revealBtnText, { color: revealed ? colors.mutedForeground : colors.secondary }]}>
                          {revealed ? COPY.liveResults.hideAnswerBtn : COPY.liveResults.showAnswerBtn}
                        </Text>
                      </Pressable>
                    </View>
                    <Text style={[s.qText, { color: colors.foreground }]} numberOfLines={2}>
                      {q.questionText}
                    </Text>
                    {/* Progress bar */}
                    <View style={[s.progressBg, { backgroundColor: colors.border }]}>
                      <View
                        style={[s.progressFill, { backgroundColor: colors.secondary, width: `${Math.round(progress * 100)}%` }]}
                      />
                    </View>
                    {answered > 0 ? (
                      <LiveAnswerRows
                        rows={buildAnswerRows(q, st?.answerBreakdown, 4)}
                        totalAnswered={answered}
                        colors={colors}
                        revealed={revealed}
                      />
                    ) : (
                      <Text style={[s.noAnswers, { color: colors.mutedForeground }]}>{COPY.liveResults.noAnswersYet}</Text>
                    )}
                  </View>
                );
              })
            )}
          </>
        )}

        {/* Manual review queue — only contains answers whose AI grading was unavailable. */}
        {pendingReviews.length > 0 && (
          <>
            <Text style={[s.sectionLabel, { color: colors.mutedForeground }]}>
              {COPY.adminLive.needsReviewLabel(pendingReviews.length)}
            </Text>
            {pendingReviews.map((review) => {
              const isReviewing = reviewingAnswerId === review.id;
              return (
                <View key={review.id} style={[s.reviewCard, { backgroundColor: colors.card, borderColor: colors.accent + '77' }]}>
                  <View style={s.reviewTop}>
                    <View style={[s.reviewBadge, { backgroundColor: colors.accent + '20' }]}>
                      <Ionicons name="sparkles-outline" size={14} color={colors.accent} />
                      <Text style={[s.reviewBadgeText, { color: colors.accent }]}>{COPY.answerReview.aiUnavailable}</Text>
                    </View>
                    <Text style={[s.reviewPlayer, { color: colors.mutedForeground }]}>{review.userName}</Text>
                  </View>
                  <Text style={[s.reviewQuestion, { color: colors.foreground }]}>{review.questionText}</Text>
                  <View style={[s.reviewAnswer, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <Text style={[s.reviewLabel, { color: colors.mutedForeground }]}>{COPY.answerReview.playerAnswerLabel}</Text>
                    <Text style={[s.reviewAnswerText, { color: colors.foreground }]}>{review.userAnswer}</Text>
                  </View>
                  {!!review.rubric && (
                    <View style={s.reviewRubric}>
                      <Text style={[s.reviewLabel, { color: colors.mutedForeground }]}>{COPY.answerReview.rubricLabel}</Text>
                      <Text style={[s.reviewRubricText, { color: colors.mutedForeground }]}>{review.rubric}</Text>
                    </View>
                  )}
                  <Text style={[s.reviewSuggested, { color: colors.mutedForeground }]}>
                    {COPY.answerReview.suggested(review.pointsEarned, review.points)}
                  </Text>
                  <View style={s.reviewActions}>
                    <Pressable
                      disabled={isReviewing}
                      onPress={() => void handleReviewAnswer(review, false)}
                      style={[s.reviewBtn, { borderColor: colors.destructive, backgroundColor: colors.destructive + '14', opacity: isReviewing ? 0.6 : 1 }]}
                    >
                      <Ionicons name="close" size={16} color={colors.destructive} />
                      <Text style={[s.reviewBtnText, { color: colors.destructive }]}>{COPY.answerReview.denyBtn}</Text>
                    </Pressable>
                    <Pressable
                      disabled={isReviewing}
                      onPress={() => void handleReviewAnswer(review, true)}
                      style={[s.reviewBtn, { borderColor: colors.secondary, backgroundColor: colors.secondary + '18', opacity: isReviewing ? 0.6 : 1 }]}
                    >
                      {isReviewing ? <ActivityIndicator size="small" color={colors.secondary} /> : <Ionicons name="checkmark" size={16} color={colors.secondary} />}
                      <Text style={[s.reviewBtnText, { color: colors.secondary }]}>{COPY.answerReview.awardBtn(review.points)}</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </>
        )}

        {/* LIVE STANDINGS — ranked players with live score and progress; tap a
            player to remove them. Score-ranked standings stay hidden while the
            host plays along (a playing host must not see peer scores or ranking). */}
        {!playAlong && (
          <>
            <View style={s.sectionHead}>
              <Text style={[s.sectionLabel, { color: colors.mutedForeground }]}>{COPY.liveResults.standingsLabel}</Text>
              <Text style={[s.sectionHint, { color: colors.mutedForeground }]}>{COPY.liveResults.updatesHint}</Text>
            </View>
            {liveStandings.length === 0 && (
              <Text style={[s.emptyText, { color: colors.mutedForeground }]}>{COPY.liveResults.noPlayers}</Text>
            )}
            {liveStandings.map((p) => {
              const win = p.rank === 1;
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[s.playerRow, { borderColor: colors.border, backgroundColor: win ? colors.primary + '14' : 'transparent' }]}
                  onPress={() => handleKickPlayer(p.userId, p.userName)}
                  activeOpacity={0.7}
                >
                  <Text style={[s.playerRank, { color: win ? colors.primary : colors.mutedForeground }]}>{p.rank}</Text>
                  <View style={s.playerInfo}>
                    <Text style={[s.playerName, { color: colors.foreground }]} numberOfLines={1}>{p.userName}</Text>
                    {p.correctCount !== undefined && p.totalAnswered !== undefined && (
                      <Text style={[s.playerSub, { color: colors.mutedForeground }]}>
                        {COPY.liveResults.playerLine(p.correctCount, p.totalAnswered, liveTotalQuestions)}
                      </Text>
                    )}
                  </View>
                  <Text style={[s.playerScore, { color: win ? colors.foreground : colors.accent }]}>{p.totalScore}</Text>
                  <Ionicons name="close-circle-outline" size={18} color={colors.destructive} style={{ marginLeft: 4 }} />
                </TouchableOpacity>
              );
            })}
          </>
        )}
        {/* While the host plays along, the player list stays score-free (tap to remove). */}
        {playAlong && (participants?.length ?? 0) > 0 && (
          <>
            {participants!.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={[s.playerRow, { borderColor: colors.border }]}
                onPress={() => handleKickPlayer(p.userId, p.userName)}
                activeOpacity={0.7}
              >
                <Ionicons name="person-circle-outline" size={20} color={colors.mutedForeground} />
                <Text style={[s.playerName, { color: colors.foreground }]}>{p.userName}</Text>
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
              <Text style={s.endBtnText}>{COPY.adminLive.endGameBtn}</Text>
            </>
          )}
        </Pressable>
      </View>
      <QuizCompleteModal
        visible={completionModalVisible}
        onDismiss={() => setCompletionModalVisible(false)}
      />
      {/* Result popup — the viewed question's result (or the plain heading) with the
          advance action; advancing only moves the host's own view */}
      <Modal
        visible={nextPromptVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setNextPromptDismissed(true)}
        statusBarTranslucent
      >
        <View style={s.nextPromptOverlay}>
          <View
            accessibilityViewIsModal
            accessibilityRole="alert"
            style={[s.nextPromptCard, { backgroundColor: colors.card, borderColor: colors.primary }]}
          >
            <Text style={[s.nextPromptTitle, { color: nextPromptHeadingColor }]}>
              {nextPromptHeading}
            </Text>
            {nextPromptResult && (
              <>
                {/* Points earned and running total */}
                <Text style={[s.nextPromptPts, { color: colors.mutedForeground }]}>
                  +{nextPromptResult.pointsEarned} {COPY.gameplay.scorePtsSuffix} · {COPY.gameplay.feedbackTotalLabel} {nextPromptResult.totalScore}
                </Text>
                {/* AI feedback (short-response questions) */}
                {!!nextPromptResult.feedback && (
                  <Text style={[s.nextPromptFeedback, { color: colors.mutedForeground }]}>{nextPromptResult.feedback}</Text>
                )}
              </>
            )}
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setNextPromptDismissed(true);
                nextPromptAction?.();
              }}
              style={({ pressed }) => [s.nextPromptBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}
            >
              <Text style={s.nextPromptBtnText}>
                {isOnLastQuestion ? COPY.hostPlayAlong.endGameBtn : COPY.hostPlayAlong.nextQuestionBtn}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => setNextPromptDismissed(true)}
              style={({ pressed }) => [s.nextPromptDismissBtn, { borderColor: colors.border, opacity: pressed ? 0.8 : 1 }]}
            >
              <Text style={[s.nextPromptDismissText, { color: colors.mutedForeground }]}>
                {COPY.hostPlayAlong.nextPromptDismiss}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// Answer distribution rows for one question. Rows come from buildAnswerRows so
// the content is identical to the web live view. Until `revealed`, every row
// renders neutrally so the host sees how players are answering without the
// correct answer being given away.
function LiveAnswerRows({
  rows,
  totalAnswered,
  colors,
  revealed,
}: {
  rows: AnswerRow[];
  totalAnswered: number;
  colors: ReturnType<typeof useColors>;
  revealed: boolean;
}) {
  if (rows.length === 0) {
    return <Text style={[rowStyles.empty, { color: colors.mutedForeground }]}>{COPY.liveResults.noAnswersYet}</Text>;
  }
  return (
    <View style={rowStyles.list}>
      {rows.map((r, i) => {
        const pct = totalAnswered > 0 ? Math.min(100, Math.round((r.count / totalAnswered) * 100)) : 0;
        const correct = revealed && r.isCorrect;
        // Neutral cyan while hidden; after reveal the correct row keeps the
        // accent and the others fall back to muted.
        const tint = correct ? colors.secondary : revealed ? colors.mutedForeground : colors.secondary;
        return (
          <View
            key={`${r.answer}-${i}`}
            accessibilityLabel={correct ? `${COPY.liveResults.correctAnswerLabel}: ${r.label}` : r.label}
            style={[
              rowStyles.row,
              { borderColor: correct ? colors.secondary + '77' : colors.border, backgroundColor: correct ? colors.secondary + '14' : 'transparent' },
            ]}
          >
            <View style={[rowStyles.letter, { borderColor: correct ? colors.secondary : colors.mutedForeground, backgroundColor: correct ? colors.secondary : 'transparent' }]}>
              <Text style={[rowStyles.letterText, { color: correct ? colors.secondaryForeground : colors.mutedForeground }]}>
                {String.fromCharCode(65 + (i % 26))}
              </Text>
            </View>
            <View style={rowStyles.body}>
              <Text style={[rowStyles.label, { color: correct ? colors.foreground : colors.cardForeground }]} numberOfLines={1}>
                {r.label}
              </Text>
              <View style={[rowStyles.barBg, { backgroundColor: colors.border }]}>
                <View style={[rowStyles.barFill, { backgroundColor: tint, width: `${pct}%` }]} />
              </View>
            </View>
            <Text style={[rowStyles.count, { color: correct ? colors.secondary : revealed ? colors.mutedForeground : colors.foreground }]}>
              {COPY.liveResults.answerCount(r.count)}
            </Text>
            {correct && <Ionicons name="checkmark" size={14} color={colors.secondary} />}
          </View>
        );
      })}
    </View>
  );
}

const rowStyles = StyleSheet.create({
  list: { gap: 6, marginTop: 2 },
  empty: { fontSize: 12, fontFamily: 'Manrope_600SemiBold' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 10, paddingVertical: 6, paddingHorizontal: 8 },
  letter: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  letterText: { fontSize: 10, fontFamily: 'Manrope_800ExtraBold' },
  body: { flex: 1, gap: 4 },
  label: { fontSize: 13, fontFamily: 'Manrope_600SemiBold' },
  barBg: { height: 3, borderRadius: 2, overflow: 'hidden' },
  barFill: { height: 3, borderRadius: 2 },
  count: { fontSize: 13, fontFamily: 'Manrope_800ExtraBold', minWidth: 18, textAlign: 'right' },
});

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { alignItems: 'center', justifyContent: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
    backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
    liveDot: { width: 8, height: 8, borderRadius: 4 },
    headerTitle: { flex: 1, fontSize: 18, fontFamily: 'Manrope_700Bold' },
    titleEditBtn: { padding: 2 },
    titleInput: { flex: 1, borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, fontSize: 15, fontFamily: 'Manrope_700Bold' },
    titleIconBtn: { borderRadius: 8, padding: 6 },
    titleError: { fontSize: 12, fontFamily: 'Manrope_600SemiBold', paddingHorizontal: 16, marginBottom: 4 },
    codeChip: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
    codeText: { fontSize: 13, fontFamily: 'Manrope_700Bold', letterSpacing: 2 },
    list: { paddingHorizontal: 16, gap: 10 },
    sectionLabel: { fontSize: 11, fontFamily: 'Manrope_700Bold', letterSpacing: 2, textTransform: 'uppercase', marginTop: 8, marginBottom: 4 },
    sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 },
    sectionHint: { fontSize: 11, fontFamily: 'Manrope_600SemiBold', marginTop: 8, marginBottom: 4 },
    noAnswers: { fontSize: 12, fontFamily: 'Manrope_600SemiBold' },
    revealBtn: { borderWidth: 1, borderRadius: 8, paddingVertical: 4, paddingHorizontal: 10 },
    revealBtnText: { fontSize: 11, fontFamily: 'Manrope_700Bold' },
    playerRank: { width: 20, textAlign: 'center', fontSize: 13, fontFamily: 'Manrope_800ExtraBold' },
    playerInfo: { flex: 1, gap: 1 },
    playerSub: { fontSize: 11, fontFamily: 'Manrope_600SemiBold' },
    emptyText: { fontSize: 14, textAlign: 'center' },
    qCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 8 },
    reviewCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 10 },
    reviewTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    reviewBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 4 },
    reviewBadgeText: { fontSize: 10, fontFamily: 'Manrope_700Bold', letterSpacing: 0.8 },
    reviewPlayer: { fontSize: 13, fontFamily: 'Manrope_600SemiBold', flexShrink: 1 },
    reviewQuestion: { fontSize: 15, fontFamily: 'Manrope_700Bold', lineHeight: 21 },
    reviewAnswer: { borderWidth: 1, borderRadius: 10, padding: 10, gap: 3 },
    reviewLabel: { fontSize: 10, fontFamily: 'Manrope_700Bold', letterSpacing: 1 },
    reviewAnswerText: { fontSize: 14, lineHeight: 20 },
    reviewRubric: { gap: 3 },
    reviewRubricText: { fontSize: 13, lineHeight: 19 },
    reviewSuggested: { fontSize: 12, fontFamily: 'Manrope_600SemiBold' },
    reviewActions: { flexDirection: 'row', gap: 8 },
    reviewBtn: { flex: 1, minHeight: 42, borderWidth: 1, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 8 },
    reviewBtnText: { fontSize: 13, fontFamily: 'Manrope_700Bold' },
    qTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    qNum: { fontSize: 12, fontFamily: 'Manrope_700Bold', width: 24 },
    qAnswered: { flex: 1, fontSize: 13, fontFamily: 'Manrope_600SemiBold' },
    qCorrect: { fontSize: 13, fontFamily: 'Manrope_600SemiBold' },
    qText: { fontSize: 14, lineHeight: 20 },
    playQText: { fontSize: 16, lineHeight: 23, fontFamily: 'Manrope_700Bold' },
    playMeta: { fontSize: 12, fontFamily: 'Manrope_700Bold', alignSelf: 'stretch' },
    answerInput: { borderWidth: 1, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, fontSize: 14 },
    navBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, borderWidth: 1, borderRadius: 12, paddingVertical: 10 }, // kept for future use
    progressBg: { height: 4, borderRadius: 2, overflow: 'hidden' },
    progressFill: { height: 4, borderRadius: 2 },
    playerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1 },
    playerName: { flex: 1, fontSize: 14, fontFamily: 'Manrope_700Bold' },
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
    // Small control that reopens the next-question popup (sits where the old inline advance button was)
    reopenBtn: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14, marginTop: 4 },
    reopenBtnText: { fontSize: 12, fontFamily: 'Manrope_700Bold' },
    // "Ready for the next question?" popup — mirrors quizCompleteStyles in app/game/[id].tsx
    nextPromptOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,.72)', padding: 24 },
    nextPromptCard: { width: '100%', maxWidth: 360, alignItems: 'center', borderWidth: 1.5, borderRadius: 24, padding: 24, gap: 14 },
    nextPromptTitle: { fontSize: 24, fontWeight: '900', fontFamily: 'Manrope_800ExtraBold', textAlign: 'center' },
    nextPromptPts: { fontSize: 13, fontFamily: 'Manrope_600SemiBold', textAlign: 'center' },
    nextPromptFeedback: { fontSize: 13, lineHeight: 18, textAlign: 'center' },
    nextPromptBtn: { width: '100%', minHeight: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
    nextPromptBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
    nextPromptDismissBtn: { width: '100%', minHeight: 46, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    nextPromptDismissText: { fontSize: 14, fontFamily: 'Manrope_600SemiBold' },
    // View-only Back / Forward beside the question indicator, and the looking-back banner
    viewNav: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    viewNavBtn: { width: 28, height: 28, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    viewBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12 },
    viewBannerText: { flex: 1, fontSize: 12, fontFamily: 'Manrope_600SemiBold' },
    viewBannerLink: { fontSize: 12, fontFamily: 'Manrope_700Bold', textDecorationLine: 'underline' },
  });
