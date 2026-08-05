import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useListGames } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';

type Props = { bottomPadding: number };

function formatDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Results tab — list of completed games with score history.
 * Tap a game to open the full leaderboard + question breakdown screen.
 */
export function ResultsTab({ bottomPadding }: Props) {
  const colors = useColors();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const { data: games, isLoading, isError, refetch } = useListGames();

  const completed = (games ?? [])
    .filter((g) => g.status === 'completed')
    .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const s = styles(colors);

  return (
    <View style={s.container}>
      {/* Section heading */}
      <View style={s.sectionRow}>
        <View style={s.headingGroup}>
          <Text style={[s.heading, { color: colors.foreground }]}>Game results</Text>
          {completed.length > 0 && (
            <View style={[s.countBadge, { backgroundColor: colors.muted }]}>
              <Text style={[s.countText, { color: colors.mutedForeground }]}>{completed.length}</Text>
            </View>
          )}
        </View>
      </View>
      <Text style={[s.subheading, { color: colors.mutedForeground }]}>
        Leaderboards and question analytics for completed games.
      </Text>

      {isLoading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : isError ? (
        <View style={s.center}>
          <Ionicons name="alert-circle-outline" size={40} color={colors.destructive} />
          <Text style={[s.emptyText, { color: colors.mutedForeground }]}>
            Could not load games. Check your connection.
          </Text>
          <Pressable
            style={[s.retryBtn, { backgroundColor: colors.primary }]}
            onPress={() => void refetch()}
          >
            <Text style={s.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : completed.length === 0 ? (
        <ScrollView
          contentContainerStyle={[s.center, { paddingBottom: bottomPadding + 20 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          <View style={[s.emptyCircle, { backgroundColor: colors.muted }]}>
            <Ionicons name="trophy-outline" size={28} color={colors.mutedForeground} />
          </View>
          <Text style={[s.emptyTitle, { color: colors.foreground }]}>No completed games yet</Text>
          <Text style={[s.emptyText, { color: colors.mutedForeground }]}>
            Finish a game to see its leaderboard and score history here.
          </Text>
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={[s.list, { paddingBottom: bottomPadding + 20 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          {completed.map((game) => (
            <Pressable
              key={game.id}
              style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => router.push(`/admin/results/${game.id}`)}
            >
              <View style={[s.trophyBadge, { backgroundColor: colors.primary + '18' }]}>
                <Ionicons name="trophy" size={18} color={colors.primary} />
              </View>
              <View style={s.cardInfo}>
                <Text style={[s.cardTopic, { color: colors.foreground }]} numberOfLines={1}>
                  {game.topic}
                </Text>
                <View style={s.cardMeta}>
                  {!!formatDate(game.createdAt) && (
                    <View style={s.metaItem}>
                      <Ionicons name="calendar-outline" size={13} color={colors.mutedForeground} />
                      <Text style={[s.metaText, { color: colors.mutedForeground }]}>
                        {formatDate(game.createdAt)}
                      </Text>
                    </View>
                  )}
                  <View style={s.metaItem}>
                    <Ionicons name="people-outline" size={13} color={colors.mutedForeground} />
                    <Text style={[s.metaText, { color: colors.mutedForeground }]}>
                      {game.participantCount ?? 0} player{(game.participantCount ?? 0) !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  <View style={s.metaItem}>
                    <Ionicons name="help-circle-outline" size={13} color={colors.mutedForeground} />
                    <Text style={[s.metaText, { color: colors.mutedForeground }]}>
                      {game.questionCount ?? 0} Qs
                    </Text>
                  </View>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 18 },
    headingGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    heading: { fontSize: 22, fontFamily: 'Manrope_800ExtraBold' },
    countBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, minWidth: 24, alignItems: 'center' },
    countText: { fontSize: 12, fontFamily: 'Manrope_700Bold' },
    subheading: { fontSize: 13, lineHeight: 19, paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
    emptyCircle: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
    emptyTitle: { fontSize: 16, fontFamily: 'Manrope_700Bold' },
    emptyText: { fontSize: 13, textAlign: 'center', lineHeight: 19 },
    retryBtn: { borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12, marginTop: 4 },
    retryText: { color: '#fff', fontFamily: 'Manrope_700Bold', fontSize: 15 },
    list: { paddingHorizontal: 16, gap: 10 },
    card: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, padding: 14, gap: 12 },
    trophyBadge: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
    cardInfo: { flex: 1, gap: 4 },
    cardTopic: { fontSize: 15, fontFamily: 'Manrope_700Bold' },
    cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaText: { fontSize: 12 },
  });
