import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import {
  getListGameQuestionsQueryKey,
  getListUserAnswersQueryKey,
  useListGameQuestions,
  useListUserAnswers,
} from '@workspace/api-client-react';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { API_BASE_URL } from '@/lib/apiBase';
import { COPY } from '@workspace/copy';

const RANK_COLORS = ['#ff0080', '#00ddff', '#8b5cf6', '#22c55e', '#f97316'];
function rankColor(i: number) { return RANK_COLORS[i % RANK_COLORS.length] ?? '#ff0080'; }

type Participant = {
  id: number;
  userId: number;
  userName: string;
  totalScore: number;
  rank: number;
  correctCount: number;
  totalAnswered: number;
};

type GameResults = {
  game: { id: number; topic: string; difficulty: string; questionCount: number; status: string };
  participants: Participant[];
  totalQuestions: number;
};

const baseUrl = API_BASE_URL;

export default function ResultsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const gameId = Number(id);
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id ?? 0;
  const [expandBreakdown, setExpandBreakdown] = useState(false);

  const { data: results, isLoading, isError, refetch } = useQuery<GameResults>({
    queryKey: ['game-results', gameId],
    queryFn: async () => {
      const r = await fetch(`${baseUrl}/api/games/${gameId}/results`);
      if (!r.ok) throw new Error('Failed to load results');
      return r.json() as Promise<GameResults>;
    },
    enabled: !!gameId,
    refetchInterval: 15000,
  });

  const { data: questions = [] } = useListGameQuestions(gameId, {
    query: { enabled: !!gameId, queryKey: getListGameQuestionsQueryKey(gameId) },
  });
  const { data: myAnswers = [] } = useListUserAnswers(gameId, userId, {
    query: { enabled: !!gameId && !!userId, queryKey: getListUserAnswersQueryKey(gameId, userId) },
  });

  const sortedQuestions = useMemo(() => [...questions].sort((a, b) => a.orderIndex - b.orderIndex), [questions]);
  const answerMap = useMemo(() => new Map(myAnswers.map((a) => [a.questionId, a])), [myAnswers]);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad }]}>
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 80 }} />
      </View>
    );
  }

  if (isError || !results) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad }]}>
        <View style={[styles.header, { paddingTop: topPad + 8 }]}>
          <TouchableOpacity onPress={() => router.replace('/')} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color={colors.foreground} />
          </TouchableOpacity>
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.mutedForeground} />
          <Text style={[styles.errorTitle, { color: colors.foreground }]}>Couldn't load results</Text>
          <Text style={[styles.errorSub, { color: colors.mutedForeground }]}>
            Something went wrong fetching the game results.
          </Text>
          <TouchableOpacity
            onPress={() => refetch()}
            style={[styles.retryBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.retryBtnText, { color: '#fff' }]}>Try again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const { game, participants, totalQuestions } = results;
  const sortedParticipants = [...participants].sort((a, b) => a.rank - b.rank);
  const me = participants.find((p) => p.userId === userId);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity onPress={() => router.replace('/')} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <Text style={[styles.headerLabel, { color: colors.mutedForeground }]}>{COPY.results.headerLabel}</Text>
          <Text style={[styles.headerGame, { color: colors.foreground }]} numberOfLines={1}>
            {game.topic}
          </Text>
          <Text style={[styles.headerMeta, { color: colors.mutedForeground }]}>
            {totalQuestions} question{totalQuestions !== 1 ? 's' : ''} · {participants.length} player{participants.length !== 1 ? 's' : ''}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: botPad + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* My Score Card */}
        {me && (
          <View style={[styles.myScoreCard, { backgroundColor: 'rgba(255,229,0,.08)', borderColor: 'rgba(255,229,0,.3)' }]}>
            <View>
              <Text style={[styles.myRank, { color: colors.accent }]}>#{me.rank}</Text>
              <Text style={[styles.myName, { color: colors.foreground }]}>{me.userName}</Text>
              <Text style={[styles.myAccuracy, { color: colors.mutedForeground }]}>
                {me.correctCount}/{totalQuestions} correct
              </Text>
            </View>
            <Text style={[styles.myScore, { color: colors.accent }]}>{me.totalScore}</Text>
          </View>
        )}

        {/* Leaderboard */}
        <View style={[styles.leaderboard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {sortedParticipants.length === 0 ? (
            <View style={styles.emptyLeaderboard}>
              <Text style={[styles.emptyLeaderboardText, { color: colors.mutedForeground }]}>
                No scores to show yet
              </Text>
            </View>
          ) : sortedParticipants.map((p, i) => {
            const isWinner = p.rank === 1;
            const isMe = p.userId === userId;
            return (
              <View
                key={p.userId}
                style={[
                  styles.leaderRow,
                  { borderBottomColor: colors.border },
                  i === sortedParticipants.length - 1 && { borderBottomWidth: 0 },
                  isWinner && { backgroundColor: 'rgba(255,0,128,.1)' },
                  isMe && { boxShadow: undefined },
                ]}
              >
                <Text style={[styles.rankNum, { color: isMe ? colors.accent : isWinner ? colors.primary : colors.mutedForeground, width: 28 }]}>
                  {p.rank}
                </Text>
                <View style={[styles.avatar, { backgroundColor: rankColor(i), width: isWinner ? 36 : 30, height: isWinner ? 36 : 30, borderRadius: isWinner ? 18 : 15 }]}>
                  <Text style={[styles.avatarText, { fontSize: isWinner ? 14 : 12 }]}>
                    {p.userName.trim().charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text style={[styles.playerName, { color: isMe ? colors.accent : colors.foreground, fontSize: isWinner ? 16 : 15 }]} numberOfLines={1}>
                  {p.userName}{isMe && !isWinner ? ' (you)' : ''}
                </Text>
                <Text style={[styles.playerScore, { color: isMe ? colors.accent : colors.foreground, fontSize: isWinner ? 17 : 15 }]}>
                  {p.totalScore}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Question Breakdown */}
        {sortedQuestions.length > 0 && (
          <View style={[styles.breakdownCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TouchableOpacity
              onPress={() => setExpandBreakdown((v) => !v)}
              style={styles.breakdownHeader}
            >
              <Ionicons name="bar-chart" size={16} color={colors.mutedForeground} />
              <Text style={[styles.breakdownTitle, { color: colors.foreground }]}>{COPY.results.breakdown}</Text>
              <Ionicons name={expandBreakdown ? 'chevron-up' : 'chevron-down'} size={16} color={colors.mutedForeground} />
            </TouchableOpacity>

            {expandBreakdown && sortedQuestions.map((q, i) => {
              const myAns = answerMap.get(q.id);
              const status = !myAns ? 'unanswered' : myAns.isCorrect ? 'correct' : myAns.pointsEarned > 0 ? 'partial' : 'wrong';
              const missed = status === 'wrong' || status === 'partial' || status === 'unanswered';
              const statusIcon = { correct: 'checkmark-circle', partial: 'remove-circle', wrong: 'close-circle', unanswered: 'ellipse-outline' }[status];
              const statusColor = { correct: '#22c55e', partial: '#f59e0b', wrong: '#ef4444', unanswered: colors.muted }[status];
              const correctAnswer = myAns?.correctAnswer ?? q.correctAnswer;

              return (
                <View
                  key={q.id}
                  style={[
                    styles.qRow,
                    { borderTopColor: colors.border },
                    missed && { backgroundColor: 'rgba(239,68,68,.04)', borderLeftWidth: 3, borderLeftColor: 'rgba(239,68,68,.65)' },
                  ]}
                >
                  {/* ── Question header ── */}
                  <View style={styles.qRowInner}>
                    <Text style={[styles.qNum, { color: colors.mutedForeground }]}>Q{i + 1}</Text>
                    {/* Full wrapping — no numberOfLines so nothing gets cut off on phone */}
                    <Text style={[styles.qText, { color: colors.foreground }]}>{q.questionText}</Text>
                    <Ionicons name={statusIcon as never} size={20} color={statusColor} style={styles.qStatusIcon} />
                  </View>

                  {/* ── Answer detail — only for missed / unanswered ── */}
                  {missed && (
                    <View style={styles.qAnswerDetail}>
                      {myAns && (
                        <View style={styles.qAnswerRow}>
                          <Text style={[styles.qAnswerLabel, { color: 'rgba(248,113,113,.7)' }]}>{COPY.results.yourAnswer}</Text>
                          <Text style={[styles.qAnswerValue, { color: 'rgba(248,113,113,.55)', textDecorationLine: 'line-through' }]}>
                            {myAns.userAnswer}
                          </Text>
                        </View>
                      )}
                      {!!correctAnswer && (
                        <View style={styles.qAnswerRow}>
                          <Text style={[styles.qAnswerLabel, { color: 'rgba(52,211,153,.8)' }]}>{COPY.results.correctAnswer}</Text>
                          <Text style={[styles.qAnswerValue, { color: '#34d399', fontWeight: '700' }]}>
                            {correctAnswer}
                          </Text>
                        </View>
                      )}
                      {status === 'unanswered' && (
                        <Text style={[styles.qUnanswered, { color: colors.mutedForeground }]}>
                          {COPY.results.unanswered}
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Back to Lobby */}
        <TouchableOpacity
          onPress={() => router.replace('/')}
          style={[styles.backBtn, { backgroundColor: colors.accent }]}
        >
          <Text style={[styles.backBtnText, { color: colors.accentForeground }]}>{COPY.results.playAgain}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 18, paddingBottom: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headerTitle: { flex: 1 },
  headerLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 2.5, textTransform: 'uppercase' },
  headerGame: { fontSize: 22, fontWeight: '900', marginTop: 2, fontFamily: 'Manrope_800ExtraBold' },
  headerMeta: { fontSize: 13, fontWeight: '500', marginTop: 2 },
  content: { paddingHorizontal: 18, gap: 16, paddingTop: 4 },
  myScoreCard: { borderRadius: 18, padding: 20, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  myRank: { fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  myName: { fontSize: 20, fontWeight: '800', marginTop: 2 },
  myAccuracy: { fontSize: 13, fontWeight: '500', marginTop: 2 },
  myScore: { fontSize: 40, fontWeight: '900', fontFamily: 'Manrope_800ExtraBold' },
  leaderboard: { borderRadius: 16, overflow: 'hidden', borderWidth: 1 },
  leaderRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 14, gap: 12, borderBottomWidth: 1 },
  rankNum: { fontWeight: '800', fontSize: 15, textAlign: 'center' },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#ffffff', fontWeight: '800' },
  playerName: { flex: 1, fontWeight: '700' },
  playerScore: { fontWeight: '800', tabularNums: true } as never,
  breakdownCard: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  breakdownHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 16 },
  breakdownTitle: { flex: 1, fontSize: 15, fontWeight: '700' },
  qRow: { borderTopWidth: 1 },
  // Non-expandable question header row
  qRowInner: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  qNum: { fontSize: 11, fontWeight: '700', width: 24, paddingTop: 1 },
  // Full wrapping text — no line clamp so phone screens never truncate
  qText: { flex: 1, fontSize: 13, fontWeight: '500', lineHeight: 19 },
  qStatusIcon: { marginTop: 1 },
  // Answer detail shown inline for wrong / unanswered — left-indented to align with question text
  qAnswerDetail: { paddingLeft: 48, paddingRight: 16, paddingBottom: 13, gap: 6 },
  qAnswerRow: { gap: 3 },
  qAnswerLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase' },
  qAnswerValue: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  qUnanswered: { fontSize: 12, fontStyle: 'italic' },
  backBtn: { height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  backBtnText: { fontSize: 16, fontWeight: '800' },
  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 12 },
  errorTitle: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  errorSub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  retryBtn: { marginTop: 8, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14 },
  retryBtnText: { fontSize: 15, fontWeight: '700' },
  emptyLeaderboard: { paddingVertical: 32, alignItems: 'center' },
  emptyLeaderboardText: { fontSize: 14, fontWeight: '500' },
});
