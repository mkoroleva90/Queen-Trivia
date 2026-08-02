import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import {
  useListGames,
  getListGamesQueryKey,
  useCreateGame,
  useUpdateGame,
  useDeleteGame,
  useGetStatsSummary,
} from '@workspace/api-client-react';
import type { Game } from '@workspace/api-client-react';
import { useAdminAuth } from '@/context/AdminAuthContext';
import { useColors } from '@/hooks/useColors';

type Difficulty = 'easy' | 'medium' | 'hard';

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

function statusSort(status: string) {
  return status === 'active' ? 0 : status === 'waiting' ? 1 : 2;
}

export default function AdminHomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const { logoutAdmin } = useAdminAuth();

  const [createOpen, setCreateOpen] = useState(false);
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [createError, setCreateError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const { data: games, isLoading, refetch } = useListGames();
  const { data: stats } = useGetStatsSummary();
  const createGame = useCreateGame();
  const updateGame = useUpdateGame();
  const deleteGame = useDeleteGame();

  const sorted = [...(games ?? [])].sort(
    (a, b) => statusSort(a.status) - statusSort(b.status),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleCreate = async () => {
    if (!topic.trim()) { setCreateError('Enter a topic'); return; }
    setCreateError('');
    try {
      await createGame.mutateAsync({ data: { topic: topic.trim(), difficulty, createdByAdmin: true } });
      qc.invalidateQueries({ queryKey: getListGamesQueryKey() });
      setCreateOpen(false);
      setTopic('');
      setDifficulty('medium');
    } catch {
      setCreateError('Failed to create game — please retry');
    }
  };

  const handleStatus = async (game: Game, status: 'waiting' | 'active' | 'completed') => {
    try {
      await updateGame.mutateAsync({ gameId: game.id, data: { status } });
      qc.invalidateQueries({ queryKey: getListGamesQueryKey() });
    } catch {
      // silently ignore
    }
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await deleteGame.mutateAsync({ gameId: id });
      qc.invalidateQueries({ queryKey: getListGamesQueryKey() });
    } catch {
      // silently ignore
    } finally {
      setDeletingId(null);
    }
  };

  const s = styles(colors);

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={[s.headerTitle, { color: colors.foreground }]}>Games</Text>
          {stats && (
            <Text style={[s.headerSub, { color: colors.mutedForeground }]}>
              {stats.activeGames} live · {stats.totalPlayers} players
            </Text>
          )}
        </View>
        <View style={s.headerActions}>
          <Pressable
            style={[s.iconBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => setCreateOpen(true)}
          >
            <Ionicons name="add" size={22} color={colors.primary} />
          </Pressable>
          <Pressable
            style={[s.iconBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push('/admin/settings')}
          >
            <Ionicons name="settings-outline" size={20} color={colors.muted} />
          </Pressable>
          <Pressable
            style={[s.iconBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={logoutAdmin}
          >
            <Ionicons name="log-out-outline" size={20} color={colors.muted} />
          </Pressable>
        </View>
      </View>

      {/* Game list */}
      {isLoading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : sorted.length === 0 ? (
        <View style={s.center}>
          <Ionicons name="game-controller-outline" size={48} color={colors.muted} />
          <Text style={[s.emptyText, { color: colors.mutedForeground }]}>No games yet</Text>
          <Pressable style={[s.emptyBtn, { backgroundColor: colors.primary }]} onPress={() => setCreateOpen(true)}>
            <Text style={s.emptyBtnText}>Create your first game</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          {sorted.map((game) => (
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
                  <Ionicons name="help-circle-outline" size={14} color={colors.muted} />
                  <Text style={[s.metaText, { color: colors.mutedForeground }]}>{game.questionCount ?? 0} Qs</Text>
                </View>
                <View style={s.metaItem}>
                  <Ionicons name="people-outline" size={14} color={colors.muted} />
                  <Text style={[s.metaText, { color: colors.mutedForeground }]}>
                    {(game as Game & { participantCount?: number }).participantCount ?? 0}
                  </Text>
                </View>
                <Text style={[s.metaText, { color: colors.mutedForeground }]}>{game.difficulty}</Text>
              </View>

              {/* Action buttons */}
              <View style={s.cardActions}>
                {game.status === 'waiting' && (
                  <Pressable
                    style={[s.actionBtn, { backgroundColor: colors.secondary + '22', borderColor: colors.secondary + '44' }]}
                    onPress={() => handleStatus(game, 'active')}
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
                      <Ionicons name="flag" size={14} color={colors.muted} />
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

      {/* Create Game Modal */}
      <Modal visible={createOpen} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={s.modalOverlay}>
          <Pressable style={s.modalBackdrop} onPress={() => setCreateOpen(false)} />
          <View style={[s.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 24 }]}>
            <View style={s.sheetHandle} />
            <Text style={[s.sheetTitle, { color: colors.foreground }]}>New Game</Text>

            <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Topic</Text>
            <TextInput
              style={[s.textInput, { backgroundColor: colors.background, color: colors.foreground, borderColor: createError ? colors.destructive : colors.border }]}
              value={topic}
              onChangeText={(t) => { setTopic(t); setCreateError(''); }}
              placeholder="e.g. 90s Pop Music"
              placeholderTextColor={colors.muted}
              autoFocus
              returnKeyType="next"
            />

            <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Difficulty</Text>
            <View style={s.diffRow}>
              {(['easy', 'medium', 'hard'] as Difficulty[]).map((d) => (
                <Pressable
                  key={d}
                  style={[s.diffChip, { borderColor: difficulty === d ? colors.primary : colors.border, backgroundColor: difficulty === d ? colors.primary + '22' : 'transparent' }]}
                  onPress={() => setDifficulty(d)}
                >
                  <Text style={[s.diffChipText, { color: difficulty === d ? colors.primary : colors.muted }]}>
                    {d.charAt(0).toUpperCase() + d.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>

            {!!createError && <Text style={[s.errorText, { color: colors.destructive }]}>{createError}</Text>}

            <Pressable
              style={[s.sheetBtn, { backgroundColor: colors.primary }]}
              onPress={handleCreate}
              disabled={createGame.isPending}
            >
              {createGame.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.sheetBtnText}>Create Game</Text>
              )}
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
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
    headerTitle: { fontSize: 26, fontFamily: 'Manrope_800ExtraBold' },
    headerSub: { fontSize: 13, marginTop: 2 },
    headerActions: { flexDirection: 'row', gap: 8 },
    iconBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
    emptyText: { fontSize: 16, fontFamily: 'Manrope_600SemiBold' },
    emptyBtn: { borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12 },
    emptyBtnText: { color: '#fff', fontFamily: 'Manrope_700Bold', fontSize: 15 },
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
    // Modal
    modalOverlay: { flex: 1, justifyContent: 'flex-end' },
    modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
    sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 12 },
    sheetHandle: { width: 40, height: 4, backgroundColor: '#444', borderRadius: 2, alignSelf: 'center', marginBottom: 8 },
    sheetTitle: { fontSize: 20, fontFamily: 'Manrope_800ExtraBold', marginBottom: 4 },
    fieldLabel: { fontSize: 12, fontFamily: 'Manrope_600SemiBold', letterSpacing: 1, textTransform: 'uppercase' },
    textInput: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
    diffRow: { flexDirection: 'row', gap: 8 },
    diffChip: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
    diffChipText: { fontSize: 14, fontFamily: 'Manrope_600SemiBold' },
    errorText: { fontSize: 13 },
    sheetBtn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
    sheetBtnText: { color: '#fff', fontSize: 16, fontFamily: 'Manrope_700Bold' },
  });
