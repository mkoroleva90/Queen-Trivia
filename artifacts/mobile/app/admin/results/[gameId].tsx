import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';
import { ADMIN_TOKEN_KEY } from '@/context/AdminAuthContext';
import { useColors } from '@/hooks/useColors';

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
  game: { id: number; topic: string; status: string };
  participants: Participant[];
  totalQuestions: number;
};

type QuestionStat = {
  id: number;
  questionText: string;
  questionType: string;
  points: number;
  orderIndex: number;
  totalAnswered: number;
  correctCount: number;
  percentCorrect: number | null;
};

const RANK_COLORS = ['#ffe500', '#aaaaaa', '#cd7f32'];

async function fetchWithAdminToken(url: string) {
  const token = await SecureStore.getItemAsync(ADMIN_TOKEN_KEY).catch(() => null);
  const r = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export default function AdminResultsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { gameId: gameIdStr } = useLocalSearchParams<{ gameId: string }>();
  const gameId = parseInt(gameIdStr ?? '', 10);

  const [showStats, setShowStats] = useState(false);

  const baseUrl = process.env.EXPO_PUBLIC_DOMAIN
    ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
    : '';

  const {
    data: results,
    isLoading: resultsLoading,
    isError: resultsError,
    refetch: refetchResults,
  } = useQuery<GameResults>({
    queryKey: ['admin-results', gameId],
    queryFn: () => fetchWithAdminToken(`${baseUrl}/api/games/${gameId}/results`),
    enabled: !isNaN(gameId),
    retry: 1,
  });

  const {
    data: qStats,
    isLoading: statsLoading,
    isError: statsError,
    refetch: refetchStats,
  } = useQuery<QuestionStat[]>({
    queryKey: ['admin-q-stats', gameId],
    queryFn: () => fetchWithAdminToken(`${baseUrl}/api/games/${gameId}/questions/stats`),
    enabled: !isNaN(gameId),
    retry: 1,
  });

  const s = styles(colors);

  if (resultsLoading) {
    return (
      <View style={[s.container, s.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!results) {
    return (
      <View style={[s.container, s.center, { paddingTop: insets.top, gap: 16 }]}>
        <Ionicons name="alert-circle-outline" size={40} color={colors.destructive} />
        <Text style={[{ color: colors.muted, fontSize: 15, textAlign: 'center', paddingHorizontal: 32 }]}>
          Could not load results. Check your connection and try again.
        </Text>
        <Pressable
          style={[{ backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }]}
          onPress={() => void refetchResults()}
        >
          <Text style={{ color: '#fff', fontFamily: 'Manrope_700Bold', fontSize: 15 }}>Retry</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/admin')} hitSlop={12}>
          <Text style={[{ color: colors.muted, fontSize: 14 }]}>← Back to games</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.push('/admin')} style={s.backBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[s.headerTitle, { color: colors.foreground }]} numberOfLines={1}>
          {results?.game.topic ?? 'Results'}
        </Text>
        <Ionicons name="trophy" size={22} color={colors.accent} />
      </View>

      <ScrollView contentContainerStyle={s.list}>
        {/* Summary card */}
        <View style={[s.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={s.summaryRow}>
            <View style={s.summaryItem}>
              <Text style={[s.summaryNum, { color: colors.primary }]}>
                {results?.participants.length ?? 0}
              </Text>
              <Text style={[s.summaryLabel, { color: colors.muted }]}>Players</Text>
            </View>
            <View style={s.summaryItem}>
              <Text style={[s.summaryNum, { color: colors.secondary }]}>
                {results?.totalQuestions ?? 0}
              </Text>
              <Text style={[s.summaryLabel, { color: colors.muted }]}>Questions</Text>
            </View>
            <View style={s.summaryItem}>
              <Text style={[s.summaryNum, { color: colors.accent }]}>
                {results?.participants[0]?.totalScore ?? 0}
              </Text>
              <Text style={[s.summaryLabel, { color: colors.muted }]}>Top Score</Text>
            </View>
          </View>
        </View>

        {/* Leaderboard */}
        <Text style={[s.sectionLabel, { color: colors.muted }]}>LEADERBOARD</Text>
        {(results?.participants ?? []).map((p) => (
          <View key={p.id} style={[s.playerCard, { backgroundColor: colors.card, borderColor: p.rank <= 3 ? (RANK_COLORS[p.rank - 1] + '44') : colors.border }]}>
            <View style={[s.rankBadge, { backgroundColor: p.rank <= 3 ? RANK_COLORS[p.rank - 1] + '33' : colors.background }]}>
              {p.rank <= 3 ? (
                <Ionicons name="trophy" size={14} color={RANK_COLORS[p.rank - 1]} />
              ) : (
                <Text style={[s.rankNum, { color: colors.muted }]}>#{p.rank}</Text>
              )}
            </View>
            <View style={s.playerInfo}>
              <Text style={[s.playerName, { color: colors.foreground }]}>{p.userName}</Text>
              <Text style={[s.playerSub, { color: colors.muted }]}>
                {p.correctCount}/{results?.totalQuestions ?? p.totalAnswered} correct
              </Text>
            </View>
            <Text style={[s.playerScore, { color: p.rank <= 3 ? RANK_COLORS[p.rank - 1] : colors.foreground }]}>
              {p.totalScore}
            </Text>
          </View>
        ))}

        {/* Per-question breakdown toggle */}
        <Pressable
          style={[s.toggleBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => setShowStats((v) => !v)}
        >
          <Text style={[s.toggleText, { color: colors.foreground }]}>Question Breakdown</Text>
          <Ionicons name={showStats ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} />
        </Pressable>

        {showStats && (
          statsLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 16 }} />
          ) : statsError ? (
            <View style={[s.errorBox, { backgroundColor: colors.destructive + '15', borderColor: colors.destructive + '30' }]}>
              <Ionicons name="alert-circle-outline" size={20} color={colors.destructive} />
              <Text style={[s.errorMsg, { color: colors.destructive }]}>Could not load question breakdown.</Text>
              <Pressable onPress={() => void refetchStats()} style={[s.retrySmall, { borderColor: colors.destructive }]}>
                <Text style={[s.retrySmallText, { color: colors.destructive }]}>Retry</Text>
              </Pressable>
            </View>
          ) : (
            (qStats ?? []).map((q, idx) => (
              <View key={q.id} style={[s.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={s.statTop}>
                  <Text style={[s.statQ, { color: colors.muted }]}>Q{idx + 1}</Text>
                  <Text style={[s.statPts, { color: colors.accent }]}>{q.points}pts</Text>
                </View>
                <Text style={[s.statText, { color: colors.foreground }]} numberOfLines={2}>
                  {q.questionText}
                </Text>
                <View style={s.statRow}>
                  <Text style={[s.statFig, { color: colors.secondary }]}>
                    {q.correctCount}/{q.totalAnswered}
                  </Text>
                  <Text style={[s.statLabel2, { color: colors.muted }]}>correct</Text>
                  {q.percentCorrect !== null && (
                    <View style={[s.pctBadge, { backgroundColor: q.percentCorrect >= 70 ? colors.secondary + '22' : colors.destructive + '22' }]}>
                      <Text style={[s.pctText, { color: q.percentCorrect >= 70 ? colors.secondary : colors.destructive }]}>
                        {q.percentCorrect}%
                      </Text>
                    </View>
                  )}
                </View>
                {q.totalAnswered > 0 && (
                  <View style={[s.progressBg, { backgroundColor: colors.border }]}>
                    <View style={[s.progressFill, { backgroundColor: colors.secondary, width: `${q.percentCorrect ?? 0}%` }]} />
                  </View>
                )}
              </View>
            ))
          )
        )}

        <View style={{ height: insets.bottom + 24 }} />
      </ScrollView>
    </View>
  );
}

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { alignItems: 'center', justifyContent: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
    backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { flex: 1, fontSize: 18, fontFamily: 'Manrope_700Bold' },
    list: { paddingHorizontal: 16, paddingTop: 8, gap: 10 },
    summaryCard: { borderRadius: 16, borderWidth: 1, padding: 20 },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-around' },
    summaryItem: { alignItems: 'center', gap: 4 },
    summaryNum: { fontSize: 28, fontFamily: 'Manrope_800ExtraBold' },
    summaryLabel: { fontSize: 12, fontFamily: 'Manrope_600SemiBold', textTransform: 'uppercase', letterSpacing: 1 },
    sectionLabel: { fontSize: 11, fontFamily: 'Manrope_700Bold', letterSpacing: 2, textTransform: 'uppercase', marginTop: 8, marginBottom: 2 },
    playerCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, padding: 14, gap: 12 },
    rankBadge: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    rankNum: { fontSize: 12, fontFamily: 'Manrope_700Bold' },
    playerInfo: { flex: 1, gap: 2 },
    playerName: { fontSize: 15, fontFamily: 'Manrope_600SemiBold' },
    playerSub: { fontSize: 12 },
    playerScore: { fontSize: 20, fontFamily: 'Manrope_800ExtraBold' },
    toggleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 14, borderWidth: 1, padding: 16, marginTop: 8 },
    toggleText: { fontSize: 15, fontFamily: 'Manrope_600SemiBold' },
    statCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 8 },
    statTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    statQ: { fontSize: 12, fontFamily: 'Manrope_700Bold' },
    statPts: { fontSize: 12, fontFamily: 'Manrope_600SemiBold' },
    statText: { fontSize: 14, lineHeight: 20 },
    statRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    statFig: { fontSize: 16, fontFamily: 'Manrope_700Bold' },
    statLabel2: { fontSize: 13, flex: 1 },
    pctBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
    pctText: { fontSize: 12, fontFamily: 'Manrope_700Bold' },
    progressBg: { height: 4, borderRadius: 2, overflow: 'hidden' },
    progressFill: { height: 4, borderRadius: 2 },
    errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, padding: 14 },
    errorMsg: { flex: 1, fontSize: 13 },
    retrySmall: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
    retrySmallText: { fontSize: 12, fontFamily: 'Manrope_600SemiBold' },
  });
