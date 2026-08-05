import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
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
import { useColors } from '@/hooks/useColors';
import { useAdminGameSocket } from '@/hooks/useSocket';

type Props = { bottomPadding: number };

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
 * Notes on parity with the web (Admin.tsx → LiveGameView):
 *  - Players drive their own pace; there is no host-advance endpoint yet, so
 *    Prev/Next move the host's *monitored* question locally (same as web).
 *  - Reveal toggles whether the correct answer is highlighted on the host's
 *    screen (the web keeps the correct row always visible; mobile makes it a
 *    toggle so a host projecting their phone can keep it hidden).
 *  - Answer telemetry comes from the same `answer:submitted` socket events.
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

  // Live telemetry: who answered which question, and correct counts.
  const [answeredBy, setAnsweredBy] = useState<Record<number, string[]>>({});
  const [correctCount, setCorrectCount] = useState<Record<number, number>>({});

  // Reset telemetry when the monitored game changes.
  useEffect(() => {
    setQIndex(0);
    setRevealed(false);
    setAnsweredBy({});
    setCorrectCount({});
  }, [gameId]);

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

  const onAnswerSubmitted = useCallback(
    (p: { gameId: number; questionId: number; playerName: string; isCorrect: boolean }) => {
      if (p.gameId !== gameId) return;
      setAnsweredBy((prev) => {
        const cur = prev[p.questionId] ?? [];
        if (cur.includes(p.playerName)) return prev;
        return { ...prev, [p.questionId]: [...cur, p.playerName] };
      });
      if (p.isCorrect) {
        setCorrectCount((prev) => ({ ...prev, [p.questionId]: (prev[p.questionId] ?? 0) + 1 }));
      }
      refetchParticipants();
    },
    [gameId, refetchParticipants],
  );

  const onGameEnded = useCallback(
    (p: { gameId: number }) => {
      if (p.gameId === gameId) {
        qc.invalidateQueries({ queryKey: getListGamesQueryKey() });
      }
    },
    [gameId, qc],
  );

  useAdminGameSocket(gameId, { onAnswerSubmitted, onGameEnded });

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

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchGames(), refetchParticipants()]);
    setRefreshing(false);
  };

  const s = styles(colors);

  if (isLoading) {
    return (
      <View style={[s.container, s.center]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

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

  const parts = participants ?? [];
  const answeredNames = currentQ ? (answeredBy[currentQ.id] ?? []) : [];
  const answeredCount = answeredNames.length;
  const answeredPct = parts.length > 0 ? Math.round((answeredCount / parts.length) * 100) : 0;
  const qCorrect = currentQ ? (correctCount[currentQ.id] ?? 0) : 0;
  const choices: string[] = ((currentQ?.options as { choices?: string[] } | null)?.choices ?? []);
  const standings = [...parts].sort((a, b) => (b.totalScore ?? 0) - (a.totalScore ?? 0)).slice(0, 6);

  return (
    <ScrollView
      contentContainerStyle={[s.list, { paddingBottom: bottomPadding + 16 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      {/* Game picker (only when multiple games are live) */}
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

      {/* Topbar: live badge · title · code · end */}
      <View style={s.topbar}>
        <View style={[s.liveBadge, { backgroundColor: colors.secondary + '18', borderColor: colors.secondary + '55' }]}>
          <View style={[s.liveDot, { backgroundColor: colors.secondary }]} />
          <Text style={[s.liveBadgeText, { color: colors.secondary }]}>LIVE</Text>
        </View>
        <Text style={[s.title, { color: colors.foreground }]} numberOfLines={1}>
          {game!.topic}
        </Text>
        {!!game?.accessCode && (
          <View style={[s.codeChip, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[s.codeText, { color: colors.accent }]}>{game.accessCode}</Text>
          </View>
        )}
      </View>

      {/* Question card */}
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
          {currentQ?.questionText ?? 'Waiting for game to start…'}
        </Text>

        {/* Answer state pill */}
        <View style={s.revealRow}>
          <View
            style={[
              s.revealPill,
              revealed
                ? { backgroundColor: colors.secondary + '18', borderColor: colors.secondary + '55' }
                : { backgroundColor: colors.muted, borderColor: colors.border },
            ]}
          >
            <Ionicons
              name={revealed ? 'eye' : 'eye-off'}
              size={13}
              color={revealed ? colors.secondary : colors.mutedForeground}
            />
            <Text style={[s.revealPillText, { color: revealed ? colors.secondary : colors.mutedForeground }]}>
              {revealed ? 'ANSWER REVEALED' : 'ANSWER HIDDEN'}
            </Text>
          </View>
          <Text style={[s.answeredMeta, { color: colors.mutedForeground }]}>
            {answeredCount}/{parts.length} answered · {answeredPct}%
          </Text>
        </View>

        {/* Options (correct one highlighted only when revealed) */}
        {choices.length > 0 && (
          <View style={s.choices}>
            {choices.map((c, i) => {
              const isCorrect = revealed && currentQ?.correctAnswer === c;
              return (
                <View
                  key={i}
                  style={[
                    s.choiceRow,
                    {
                      borderColor: isCorrect ? colors.secondary + '80' : colors.border,
                      backgroundColor: isCorrect ? colors.secondary + '14' : 'transparent',
                    },
                  ]}
                >
                  <View
                    style={[
                      s.choiceLetter,
                      isCorrect
                        ? { backgroundColor: colors.secondary }
                        : { borderWidth: 1.5, borderColor: colors.border },
                    ]}
                  >
                    <Text style={[s.choiceLetterText, { color: isCorrect ? colors.background : colors.mutedForeground }]}>
                      {String.fromCharCode(65 + i)}
                    </Text>
                  </View>
                  <Text
                    style={[
                      s.choiceText,
                      { color: isCorrect ? colors.foreground : colors.mutedForeground },
                      isCorrect && { fontFamily: 'Manrope_700Bold' },
                    ]}
                    numberOfLines={2}
                  >
                    {c}
                  </Text>
                  {isCorrect && (
                    <Text style={[s.choiceTally, { color: colors.secondary }]}>
                      {qCorrect} ✓
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        )}
        {choices.length === 0 && revealed && !!currentQ?.correctAnswer && (
          <View style={[s.freeAnswer, { borderColor: colors.secondary + '55', backgroundColor: colors.secondary + '12' }]}>
            <Ionicons name="checkmark-circle" size={16} color={colors.secondary} />
            <Text style={[s.freeAnswerText, { color: colors.foreground }]}>{currentQ.correctAnswer}</Text>
            <Text style={[s.choiceTally, { color: colors.secondary }]}>{qCorrect} ✓</Text>
          </View>
        )}
      </View>

      {/* Transport controls */}
      <View style={[s.transport, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Pressable
          disabled={qIndex === 0}
          onPress={() => { setQIndex((i) => Math.max(0, i - 1)); setRevealed(false); }}
          style={({ pressed }) => [
            s.tBtn,
            { borderColor: colors.border, opacity: qIndex === 0 ? 0.4 : pressed ? 0.7 : 1 },
          ]}
        >
          <Ionicons name="chevron-back" size={16} color={colors.mutedForeground} />
          <Text style={[s.tBtnText, { color: colors.mutedForeground }]}>Prev</Text>
        </Pressable>
        <Pressable
          onPress={() => setRevealed((r) => !r)}
          style={({ pressed }) => [
            s.tBtn,
            {
              borderColor: colors.accent + '55',
              backgroundColor: colors.accent + '12',
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Ionicons name={revealed ? 'eye-off-outline' : 'eye-outline'} size={16} color={colors.accent} />
          <Text style={[s.tBtnText, { color: colors.accent }]}>{revealed ? 'Hide' : 'Reveal'}</Text>
        </Pressable>
        <Pressable
          disabled={qIndex >= sortedQs.length - 1}
          onPress={() => { setQIndex((i) => Math.min(sortedQs.length - 1, i + 1)); setRevealed(false); }}
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

      {/* Answered — participant chips with answer status for the current question */}
      <Text style={[s.sectionLabel, { color: colors.mutedForeground }]}>ANSWERED</Text>
      <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[s.progressBg, { backgroundColor: colors.border }]}>
          <View style={[s.progressFill, { backgroundColor: colors.secondary, width: `${answeredPct}%` }]} />
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
                <View
                  style={[
                    s.avatar,
                    { backgroundColor: done ? av : colors.border },
                  ]}
                >
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

      {/* Standings — live leaderboard */}
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

      {/* End game */}
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
    </ScrollView>
  );
}

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { alignItems: 'center', justifyContent: 'center' },
    list: { paddingHorizontal: 16, paddingTop: 8, gap: 12 },
    emptyHeading: { fontSize: 20, fontFamily: 'Manrope_800ExtraBold', textAlign: 'center' },
    emptySub: { fontSize: 14, lineHeight: 21, textAlign: 'center' },
    pickerRow: { gap: 8, paddingBottom: 2 },
    pickerChip: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 7, maxWidth: 220 },
    pickerChipText: { fontSize: 13, fontFamily: 'Manrope_700Bold' },
    topbar: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 20, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 4 },
    liveDot: { width: 7, height: 7, borderRadius: 4 },
    liveBadgeText: { fontSize: 9, fontFamily: 'Manrope_800ExtraBold', letterSpacing: 1.5 },
    title: { flex: 1, fontSize: 17, fontFamily: 'Manrope_800ExtraBold' },
    codeChip: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
    codeText: { fontSize: 13, fontFamily: 'Manrope_700Bold', letterSpacing: 2 },
    card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
    qMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    qMeta: { fontSize: 10, fontFamily: 'Manrope_700Bold', letterSpacing: 2 },
    tag: { borderRadius: 6, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 2 },
    tagText: { fontSize: 9, fontFamily: 'Manrope_700Bold', letterSpacing: 1 },
    qText: { fontSize: 19, lineHeight: 26, fontFamily: 'Manrope_800ExtraBold' },
    revealRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    revealPill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 20, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
    revealPillText: { fontSize: 9, fontFamily: 'Manrope_700Bold', letterSpacing: 1 },
    answeredMeta: { fontSize: 12, fontFamily: 'Manrope_600SemiBold' },
    choices: { gap: 8 },
    choiceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
    choiceLetter: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
    choiceLetterText: { fontSize: 12, fontFamily: 'Manrope_800ExtraBold' },
    choiceText: { flex: 1, fontSize: 14, lineHeight: 19 },
    choiceTally: { fontSize: 13, fontFamily: 'Manrope_800ExtraBold' },
    freeAnswer: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
    freeAnswerText: { flex: 1, fontSize: 14, fontFamily: 'Manrope_700Bold' },
    transport: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 16, borderWidth: 1, padding: 10 },
    tBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
    tBtnText: { fontSize: 13, fontFamily: 'Manrope_700Bold' },
    tBtnPrimary: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10, marginLeft: 'auto' },
    tBtnPrimaryText: { color: '#fff', fontSize: 14, fontFamily: 'Manrope_800ExtraBold' },
    sectionLabel: { fontSize: 11, fontFamily: 'Manrope_700Bold', letterSpacing: 2, marginTop: 4 },
    progressBg: { height: 5, borderRadius: 3, overflow: 'hidden' },
    progressFill: { height: 5, borderRadius: 3 },
    chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    playerChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, borderWidth: 1, paddingLeft: 4, paddingRight: 9, paddingVertical: 4 },
    avatar: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontSize: 9, fontFamily: 'Manrope_800ExtraBold' },
    playerChipName: { fontSize: 12, fontFamily: 'Manrope_600SemiBold' },
    standingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 6, paddingVertical: 7 },
    rank: { width: 16, textAlign: 'center', fontSize: 12, fontFamily: 'Manrope_800ExtraBold' },
    standingName: { flex: 1, fontSize: 14, fontFamily: 'Manrope_700Bold' },
    standingScore: { fontSize: 14, fontFamily: 'Manrope_800ExtraBold' },
    endBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 16, marginTop: 4 },
    endBtnText: { color: '#fff', fontSize: 16, fontFamily: 'Manrope_700Bold' },
  });
