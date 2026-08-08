import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import {
  useListGames,
  getListGamesQueryKey,
  useUpdateGame,
  useDeleteGame,
  useGetStatsSummary,
} from '@workspace/api-client-react';
import type { Game } from '@workspace/api-client-react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';

type Difficulty = 'easy' | 'medium' | 'hard';
type GameFilter = 'all' | 'live' | 'drafts';

const STATUS_COLORS: Record<string, string> = {
  waiting: '#ffe500',
  active: '#00ddff',
  completed: '#888',
};
const STATUS_LABELS: Record<string, string> = {
  waiting: 'Waiting',
  active: 'Live',
  completed: 'Done',
};

function statusSort(s: string) {
  return s === 'active' ? 0 : s === 'waiting' ? 1 : 2;
}

const FILTERS: { id: GameFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'live', label: 'Live' },
  { id: 'drafts', label: 'Drafts' },
];

type Props = {
  bottomPadding: number;
  /** Called when the user taps "New game" — switches to the Build tab at the Setup step. */
  onGoToBuild?: () => void;
};

export function GamesTab({ bottomPadding, onGoToBuild }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();

  const [gameFilter, setGameFilter] = useState<GameFilter>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [upgradeLimitMsg, setUpgradeLimitMsg] = useState<string | null>(null);
  // Start-game confirmation state
  const [startTarget, setStartTarget] = useState<Game | null>(null);
  const [playAlongPending, setPlayAlongPending] = useState(false);

  const { data: games, isLoading, refetch } = useListGames();
  const { data: stats } = useGetStatsSummary();
  const updateGame = useUpdateGame();
  const deleteGame = useDeleteGame();

  const allGames = [...(games ?? [])].sort((a, b) => statusSort(a.status) - statusSort(b.status));

  const filtered = allGames.filter((g) => {
    if (gameFilter === 'live') return g.status === 'active';
    if (gameFilter === 'drafts') return g.status === 'waiting';
    return true;
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleStatus = async (game: Game, status: 'waiting' | 'active' | 'completed', extra?: { hostPlaysAlong?: boolean }) => {
    try {
      await updateGame.mutateAsync({ gameId: game.id, data: { status, ...extra } });
      qc.invalidateQueries({ queryKey: getListGamesQueryKey() });
    } catch { /* silent */ }
  };

  const confirmStart = async () => {
    if (!startTarget) return;
    const target = startTarget;
    const playAlong = playAlongPending;
    setStartTarget(null);
    setPlayAlongPending(false);
    await handleStatus(target, 'active', playAlong ? { hostPlaysAlong: true } : undefined);
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await deleteGame.mutateAsync({ gameId: id });
      qc.invalidateQueries({ queryKey: getListGamesQueryKey() });
    } catch { /* silent */ } finally { setDeletingId(null); }
  };

  const s = styles(colors);
  const activeCount = stats?.activeGames ?? 0;
  const totalGames = allGames.length;

  return (
    <View style={s.container}>
      {/* Section heading row */}
      <View style={s.sectionRow}>
        <View style={s.headingGroup}>
          <Text style={[s.heading, { color: colors.foreground }]}>Your games</Text>
          {totalGames > 0 && (
            <View style={[s.countBadge, { backgroundColor: colors.muted }]}>
              <Text style={[s.countText, { color: colors.mutedForeground }]}>{totalGames}</Text>
            </View>
          )}
        </View>
        {/* New quiz button */}
        <Pressable
          style={[s.newQuizBtn, { backgroundColor: colors.primary }]}
          onPress={() => onGoToBuild?.()}
        >
          <Ionicons name="add" size={16} color="#fff" />
          <Text style={s.newQuizBtnText}>New game</Text>
        </Pressable>
      </View>

      {/* Filter tabs */}
      <View style={[s.filterRow, { borderBottomColor: colors.border }]}>
        {FILTERS.map((f) => {
          const active = gameFilter === f.id;
          return (
            <Pressable key={f.id} style={s.filterTab} onPress={() => setGameFilter(f.id)}>
              <Text style={[s.filterLabel, { color: active ? colors.foreground : colors.mutedForeground }]}>
                {f.label}
              </Text>
              <View
                style={[
                  s.filterUnderline,
                  { backgroundColor: active ? colors.primary : 'transparent' },
                ]}
              />
            </Pressable>
          );
        })}
        {/* Spacer so underlines don't span full width */}
        <View style={{ flex: 1 }} />
        {activeCount > 0 && (
          <View style={s.liveIndicator}>
            <View style={[s.liveDot, { backgroundColor: colors.secondary }]} />
            <Text style={[s.liveLabel, { color: colors.secondary }]}>
              {activeCount} live
            </Text>
          </View>
        )}
      </View>

      {/* Game list */}
      {isLoading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : filtered.length === 0 ? (
        <ScrollView
          contentContainerStyle={[s.center, { paddingBottom: bottomPadding + 20 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          {allGames.length === 0 ? (
            /* Empty state — dashed card */
            <Pressable
              style={[s.emptyCard, { borderColor: colors.border }]}
              onPress={() => onGoToBuild?.()}
            >
              <View style={[s.emptyCircle, { backgroundColor: colors.muted }]}>
                <Ionicons name="add" size={28} color={colors.mutedForeground} />
              </View>
              <Text style={[s.emptyCardText, { color: colors.foreground }]}>Create new game</Text>
              <Text style={[s.emptyCardSub, { color: colors.mutedForeground }]}>
                Tap to set up your first trivia game
              </Text>
            </Pressable>
          ) : (
            /* Filtered empty */
            <View style={s.center}>
              <Text style={[s.emptyText, { color: colors.mutedForeground }]}>
                No {gameFilter === 'live' ? 'live games' : 'drafts'} right now
              </Text>
            </View>
          )}
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={[s.list, { paddingBottom: bottomPadding + 20 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          {filtered.map((game) => (
            <Pressable
              key={game.id}
              style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => router.push(`/admin/${game.id}`)}
            >
              <View style={s.cardTop}>
                <View style={[s.statusChip, { backgroundColor: (STATUS_COLORS[game.status] ?? '#888') + '22' }]}>
                  <Text style={[s.statusText, { color: STATUS_COLORS[game.status] ?? '#888' }]}>
                    {STATUS_LABELS[game.status] ?? game.status}
                  </Text>
                </View>
                <Text style={[s.cardCode, { color: colors.mutedForeground }]}>
                  {game.accessCode ?? '——'}
                </Text>
              </View>

              <Text style={[s.cardTopic, { color: colors.foreground }]} numberOfLines={2}>
                {game.topic}
              </Text>

              <View style={s.cardMeta}>
                <View style={s.metaItem}>
                  <Ionicons name="help-circle-outline" size={14} color={colors.mutedForeground} />
                  <Text style={[s.metaText, { color: colors.mutedForeground }]}>{game.questionCount ?? 0} questions</Text>
                </View>
                <View style={s.metaItem}>
                  <Ionicons name="people-outline" size={14} color={colors.mutedForeground} />
                  <Text style={[s.metaText, { color: colors.mutedForeground }]}>
                    {(game as Game & { participantCount?: number }).participantCount ?? 0}
                  </Text>
                </View>
                <Text style={[s.metaText, { color: colors.mutedForeground }]}>{game.difficulty ? game.difficulty.charAt(0).toUpperCase() + game.difficulty.slice(1) : '—'}</Text>
              </View>

              {/* Action buttons */}
              <View style={s.cardActions}>
                {game.status === 'waiting' && (
                  <Pressable
                    style={[s.actionBtn, { backgroundColor: colors.secondary + '22', borderColor: colors.secondary + '44' }]}
                    onPress={() => { setPlayAlongPending(false); setStartTarget(game); }}
                  >
                    <Ionicons name="play" size={14} color={colors.secondary} />
                    <Text style={[s.actionText, { color: colors.secondary }]}>Start</Text>
                  </Pressable>
                )}
                {game.status === 'active' && (
                  <>
                    <Pressable
                      style={[s.actionBtn, { backgroundColor: colors.accent + '22', borderColor: colors.accent + '44' }]}
                      onPress={() => router.push(`/admin/live/${game.id}`)}
                    >
                      <Ionicons name="radio" size={14} color={colors.accent} />
                      <Text style={[s.actionText, { color: colors.accent }]}>Live</Text>
                    </Pressable>
                    <Pressable
                      style={[s.actionBtn, { backgroundColor: colors.muted + '22', borderColor: colors.muted + '44' }]}
                      onPress={() => handleStatus(game, 'completed')}
                    >
                      <Ionicons name="flag" size={14} color={colors.mutedForeground} />
                      <Text style={[s.actionText, { color: colors.mutedForeground }]}>End</Text>
                    </Pressable>
                  </>
                )}
                {game.status === 'completed' && (
                  <Pressable
                    style={[s.actionBtn, { backgroundColor: colors.primary + '22', borderColor: colors.primary + '44' }]}
                    onPress={() => router.push(`/admin/results/${game.id}`)}
                  >
                    <Ionicons name="trophy-outline" size={14} color={colors.primary} />
                    <Text style={[s.actionText, { color: colors.primary }]}>Results</Text>
                  </Pressable>
                )}
                {deletingId === game.id ? (
                  <ActivityIndicator size="small" color={colors.destructive} />
                ) : (
                  <Pressable
                    style={[s.actionBtn, { backgroundColor: colors.destructive + '15', borderColor: colors.destructive + '30' }]}
                    onPress={() => handleDelete(game.id)}
                  >
                    <Ionicons name="trash-outline" size={14} color={colors.destructive} />
                  </Pressable>
                )}
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {/* Start-game confirmation Modal */}
      <Modal visible={!!startTarget} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={s.modalOverlay}>
          <Pressable style={s.modalBackdrop} onPress={() => { setStartTarget(null); setPlayAlongPending(false); }} />
          <View style={[s.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 24 }]}>
            <View style={s.sheetHandle} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Ionicons name="play-circle-outline" size={20} color={colors.secondary} />
              <Text style={[s.sheetTitle, { color: colors.foreground }]}>Start game?</Text>
            </View>
            <Text style={{ fontSize: 14, color: colors.mutedForeground, lineHeight: 20, marginBottom: 16 }}>
              {startTarget?.topic}
            </Text>
            {/* Play-along toggle */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 16, backgroundColor: playAlongPending ? colors.primary + '10' : 'transparent' }}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={{ fontSize: 15, fontFamily: 'Manrope_700Bold', color: colors.foreground, marginBottom: 3 }}>Play along</Text>
                <Text style={{ fontSize: 13, color: colors.mutedForeground, lineHeight: 18 }}>
                  Answer questions from this screen — you'll appear in the standings alongside your players
                </Text>
              </View>
              <Switch
                value={playAlongPending}
                onValueChange={setPlayAlongPending}
                trackColor={{ false: colors.border, true: colors.primary + '60' }}
                thumbColor={playAlongPending ? colors.primary : colors.mutedForeground}
              />
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable
                style={[s.sheetBtn, { backgroundColor: colors.muted, flex: 1 }]}
                onPress={() => { setStartTarget(null); setPlayAlongPending(false); }}
              >
                <Text style={[s.sheetBtnText, { color: colors.mutedForeground }]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[s.sheetBtn, { backgroundColor: colors.secondary, flex: 1 }]}
                onPress={confirmStart}
              >
                <Text style={s.sheetBtnText}>Go live</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Free-tier limit Modal */}
      <Modal visible={!!upgradeLimitMsg} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={s.modalOverlay}>
          <Pressable style={s.modalBackdrop} onPress={() => setUpgradeLimitMsg(null)} />
          <View style={[s.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 24 }]}>
            <View style={s.sheetHandle} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Ionicons name="information-circle-outline" size={20} color={colors.secondary} />
              <Text style={[s.sheetTitle, { color: colors.foreground }]}>Monthly Limit Reached</Text>
            </View>
            <Text style={[{ fontSize: 14, lineHeight: 22 }, { color: colors.mutedForeground }]}>
              {upgradeLimitMsg}
            </Text>
            <Pressable
              style={[s.sheetBtn, { backgroundColor: colors.primary }]}
              onPress={() => setUpgradeLimitMsg(null)}
            >
              <Text style={s.sheetBtnText}>Got it</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    // Section heading
    sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14 },
    headingGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    heading: { fontSize: 22, fontFamily: 'Manrope_800ExtraBold' },
    countBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, minWidth: 24, alignItems: 'center' },
    countText: { fontSize: 12, fontFamily: 'Manrope_700Bold' },
    newQuizBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 },
    newQuizBtnText: { color: '#fff', fontSize: 14, fontFamily: 'Manrope_700Bold' },
    // Filters
    filterRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, borderBottomWidth: 1, marginBottom: 4 },
    filterTab: { alignItems: 'center', marginRight: 24, paddingBottom: 0 },
    filterLabel: { fontSize: 14, fontFamily: 'Manrope_600SemiBold', paddingVertical: 10 },
    filterUnderline: { height: 2, borderRadius: 1, width: '100%' },
    liveIndicator: { flexDirection: 'row', alignItems: 'center', gap: 5, marginLeft: 'auto', paddingVertical: 10 },
    liveDot: { width: 6, height: 6, borderRadius: 3 },
    liveLabel: { fontSize: 12, fontFamily: 'Manrope_600SemiBold' },
    // States
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
    emptyCard: {
      borderWidth: 2,
      borderStyle: 'dashed',
      borderRadius: 20,
      padding: 36,
      alignItems: 'center',
      gap: 12,
      width: '100%',
    },
    emptyCircle: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
    emptyCardText: { fontSize: 16, fontFamily: 'Manrope_700Bold' },
    emptyCardSub: { fontSize: 13, textAlign: 'center', lineHeight: 19 },
    emptyText: { fontSize: 15, fontFamily: 'Manrope_600SemiBold' },
    // List / cards
    list: { padding: 16, gap: 12 },
    card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 10 },
    cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    statusChip: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 3 },
    statusText: { fontSize: 12, fontFamily: 'Manrope_700Bold' },
    cardCode: { fontSize: 13, fontFamily: 'Manrope_600SemiBold', letterSpacing: 2 },
    cardTopic: { fontSize: 17, fontFamily: 'Manrope_700Bold', lineHeight: 22 },
    cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaText: { fontSize: 13 },
    cardActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 },
    actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6 },
    actionText: { fontSize: 13, fontFamily: 'Manrope_600SemiBold' },
    // Modals
    modalOverlay: { flex: 1, justifyContent: 'flex-end' },
    modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
    sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 12 },
    sheetHandle: { width: 40, height: 4, backgroundColor: '#444', borderRadius: 2, alignSelf: 'center', marginBottom: 8 },
    sheetTitle: { fontSize: 20, fontFamily: 'Manrope_800ExtraBold', marginBottom: 4 },
    sheetBtn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
    sheetBtnText: { color: '#fff', fontSize: 16, fontFamily: 'Manrope_700Bold' },
  });
