import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';
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
import { useAdminGameSocket } from '@/hooks/useSocket';
import { API_BASE_URL } from '@/lib/apiBase';

type AnswerCounts = Record<number, number>; // questionId → total submitted

type QuestionStat = {
  id: number;
  totalAnswered: number;
  correctCount: number;
};

async function fetchAdminJson<T>(url: string): Promise<T> {
  const token = await SecureStore.getItemAsync(ADMIN_TOKEN_KEY).catch(() => null);
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

  const { data: games } = useListGames();
  const game = games?.find((g) => g.id === gameId);
  const { data: questions } = useListGameQuestions(gameId);
  const { data: participants, refetch: refetchParticipants } = useListGameParticipants(gameId);
  const updateGame = useUpdateGame();

  const baseUrl = API_BASE_URL;

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

  const handleEndGame = async () => {
    setEnding(true);
    try {
      await updateGame.mutateAsync({ gameId, data: { status: 'completed' } });
      qc.invalidateQueries({ queryKey: getListGamesQueryKey() });
      router.replace(`/admin/results/${gameId}`);
    } catch {
      setEnding(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refetchParticipants();
    setRefreshing(false);
  };

  const s = styles(colors);

  if (!game) {
    return (
      <View style={[s.container, s.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.primary} />
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

        {/* Players */}
        {(participants?.length ?? 0) > 0 && (
          <>
            <Text style={[s.sectionLabel, { color: colors.mutedForeground }]}>PLAYERS IN GAME</Text>
            {participants!.map((p) => (
              <View key={p.id} style={[s.playerRow, { borderColor: colors.border }]}>
                <Ionicons name="person-circle-outline" size={20} color={colors.mutedForeground} />
                <Text style={[s.playerName, { color: colors.foreground }]}>{p.userName}</Text>
                <Text style={[s.playerScore, { color: colors.accent }]}>{p.totalScore} pts</Text>
              </View>
            ))}
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* End Game button */}
      <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
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
    progressBg: { height: 4, borderRadius: 2, overflow: 'hidden' },
    progressFill: { height: 4, borderRadius: 2 },
    playerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1 },
    playerName: { flex: 1, fontSize: 14 },
    playerScore: { fontSize: 14, fontFamily: 'Manrope_700Bold' },
    footer: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#222' },
    endBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 16 },
    endBtnText: { color: '#fff', fontSize: 16, fontFamily: 'Manrope_700Bold' },
  });
