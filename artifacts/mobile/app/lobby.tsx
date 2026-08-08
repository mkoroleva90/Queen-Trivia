import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import {
  getListGamesQueryKey,
  useJoinGame,
  useListGames,
} from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { useLobbySocket } from '@/hooks/useSocket';
import { API_BASE_URL } from '@/lib/apiBase';

const AVATAR_COLORS = ['#ff0080', '#00ddff', '#8b5cf6', '#22c55e', '#f97316'];
function avatarColor(i: number) { return AVATAR_COLORS[i % AVATAR_COLORS.length] ?? '#ff0080'; }

type Game = {
  id: number;
  topic: string;
  difficulty: string;
  questionCount: number;
  status: 'waiting' | 'active' | 'completed';
  accessCode: string | null;
  brief?: string | null;
};

function difficultyColor(d: string, colors: ReturnType<typeof useColors>) {
  if (d === 'easy') return colors.secondary;
  if (d === 'hard') return colors.primary;
  return colors.accent;
}

function StatusBadge({ status }: { status: string }) {
  const colors = useColors();
  const config = {
    active: { bg: 'rgba(255,0,128,.15)', border: 'rgba(255,0,128,.4)', text: '#ff5aa8', label: 'LIVE' },
    waiting: { bg: 'rgba(255,229,0,.1)', border: 'rgba(255,229,0,.35)', text: '#ffe500', label: 'WAITING' },
    completed: { bg: 'rgba(139,150,170,.1)', border: 'rgba(139,150,170,.2)', text: colors.mutedForeground, label: 'DONE' },
  }[status] ?? { bg: colors.muted, border: colors.border, text: colors.mutedForeground, label: status.toUpperCase() };

  return (
    <View style={[styles.badge, { backgroundColor: config.bg, borderColor: config.border }]}>
      {status === 'active' && <View style={[styles.liveDot, { backgroundColor: config.text }]} />}
      <Text style={[styles.badgeText, { color: config.text }]}>{config.label}</Text>
    </View>
  );
}

function GameCard({ game, onPress, joining }: { game: Game; onPress: () => void; joining: boolean }) {
  const colors = useColors();
  const isActive = game.status === 'active';
  const isCompleted = game.status === 'completed';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.gameCard,
        {
          backgroundColor: isActive ? 'rgba(255,0,128,.1)' : colors.card,
          borderColor: isActive ? 'rgba(255,0,128,.4)' : colors.border,
          opacity: pressed ? 0.88 : 1,
        },
      ]}
    >
      <View style={styles.gameCardHeader}>
        <StatusBadge status={game.status} />
        <Text style={[styles.diffChip, { color: difficultyColor(game.difficulty, colors) }]}>
          {game.difficulty}
        </Text>
      </View>

      <Text style={[styles.gameTopic, { color: colors.foreground }]} numberOfLines={2}>
        {game.topic}
      </Text>
      <Text style={[styles.gameMeta, { color: colors.mutedForeground }]}>
        {game.questionCount} {game.questionCount === 1 ? 'question' : 'questions'}
      </Text>

      <View style={[styles.gameCardCta, { backgroundColor: isActive ? '#ffe500' : isCompleted ? colors.muted : colors.primary, opacity: joining ? 0.6 : 1 }]}>
        {joining ? (
          <ActivityIndicator color={isActive ? '#0a0510' : '#ffffff'} size="small" />
        ) : (
          <Text style={[styles.gameCardCtaText, { color: isActive ? '#0a0510' : '#ffffff' }]}>
            {isActive ? '▶  Play Now' : isCompleted ? 'View Results' : 'Join Game →'}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

function JoinModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const colors = useColors();
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  const baseUrl = API_BASE_URL;

  const handleSubmit = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) { setError('Enter a room code'); return; }
    setError('');
    setPending(true);
    try {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: trimmed }),
      });
      if (res.status === 401) { setError("That code isn't right — try again"); return; }
      if (!res.ok) { setError('Something went wrong — please retry'); return; }
      const data = (await res.json()) as { id: number; name: string; gameId: number | null };
      if (data.gameId) {
        try {
          const joinRes = await fetch(`${baseUrl}/api/games/${data.gameId}/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          });
          if (joinRes.ok || joinRes.status === 409) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onClose();
            router.push(`/game/${data.gameId}`);
            return;
          }
        } catch { /* fall through */ }
      }
      onClose();
    } catch {
      setError('Connection error — please retry');
    } finally {
      setPending(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={[styles.modalSheet, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => {}}>
          <View style={[styles.modalHandle, { backgroundColor: colors.muted }]} />
          <Text style={[styles.modalTitle, { color: colors.foreground }]}>Join another game</Text>
          <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>
            Enter the room code your host shared.
          </Text>
          <TextInput
            style={[styles.modalInput, { backgroundColor: colors.background, color: colors.foreground, borderColor: error ? colors.destructive : colors.secondary }]}
            value={code}
            onChangeText={(t) => { setCode(t); setError(''); }}
            placeholder="ROOM CODE"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="go"
            onSubmitEditing={handleSubmit}
            autoFocus
            maxLength={12}
          />
          {error ? <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text> : null}
          <Pressable
            onPress={handleSubmit}
            disabled={pending}
            style={[styles.modalBtn, { backgroundColor: colors.secondary, opacity: pending ? 0.7 : 1 }]}
          >
            {pending ? <ActivityIndicator color={colors.secondaryForeground} size="small" /> : (
              <Text style={[styles.modalBtnText, { color: colors.secondaryForeground }]}>Join →</Text>
            )}
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function LobbyScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const [showJoinModal, setShowJoinModal] = useState(false);

  const { data: games, isLoading, refetch, isRefetching } = useListGames(undefined, {
    query: { queryKey: getListGamesQueryKey(), refetchInterval: 8000 },
  });

  const joinGame = useJoinGame();

  useLobbySocket({
    onGameStarted: () => {
      queryClient.invalidateQueries({ queryKey: getListGamesQueryKey() });
    },
  });

  const sortedGames = useMemo(() => {
    if (!games) return [];
    const order = { active: 0, waiting: 1, completed: 2 };
    return [...games].sort((a, b) => (order[a.status as keyof typeof order] ?? 3) - (order[b.status as keyof typeof order] ?? 3));
  }, [games]);

  const handleGamePress = (game: Game) => {
    if (!user) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (game.status === 'completed') {
      router.push(`/results/${game.id}`);
      return;
    }
    joinGame.mutate({ gameId: game.id, data: {} }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListGamesQueryKey() });
        router.push(`/game/${game.id}`);
      },
      onError: () => {
        router.push(`/game/${game.id}`);
      },
    });
  };

  const handleLogout = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await logout();
    router.replace('/');
  };

  if (!user) return null;

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>THE LOBBY</Text>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
            Playing as <Text style={{ color: colors.secondary, fontWeight: '700' }}>{user.name}</Text>
          </Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={() => setShowJoinModal(true)}
            style={[styles.joinBtn, { backgroundColor: 'rgba(255,229,0,.1)', borderColor: 'rgba(255,229,0,.3)' }]}
          >
            <Ionicons name="add" size={16} color={colors.accent} />
            <Text style={[styles.joinBtnText, { color: colors.accent }]}>Join</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn} hitSlop={8}>
            <Ionicons name="log-out-outline" size={20} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : sortedGames.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="game-controller-outline" size={48} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No games yet</Text>
          <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
            Your host hasn't created a game yet. Check back soon.
          </Text>
        </View>
      ) : (
        <FlatList
          data={sortedGames}
          keyExtractor={(g) => String(g.id)}
          contentContainerStyle={[styles.listContent, { paddingBottom: botPad + 80 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }
          renderItem={({ item }) => (
            <GameCard
              game={item as Game}
              joining={joinGame.isPending && joinGame.variables?.gameId === item.id}
              onPress={() => handleGamePress(item as Game)}
            />
          )}
        />
      )}

      {/* Floating join button */}
      <View style={[styles.fab, { bottom: botPad + 20 }]}>
        <TouchableOpacity
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowJoinModal(true); }}
          style={[styles.fabBtn, { backgroundColor: colors.primary }]}
        >
          <Ionicons name="add" size={28} color="#ffffff" />
        </TouchableOpacity>
      </View>

      <JoinModal visible={showJoinModal} onClose={() => setShowJoinModal(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 22, paddingBottom: 16, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  headerLeft: { flex: 1 },
  headerTitle: { fontSize: 30, fontWeight: '900', letterSpacing: -0.5, fontFamily: 'Manrope_800ExtraBold' },
  headerSub: { fontSize: 14, fontWeight: '500', marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  joinBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1 },
  joinBtnText: { fontSize: 12, fontWeight: '700' },
  logoutBtn: { padding: 4 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  emptyTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  listContent: { padding: 16, gap: 14 },
  gameCard: { borderRadius: 20, padding: 18, borderWidth: 1.5, gap: 10 },
  gameCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 1.5 },
  diffChip: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  gameTopic: { fontSize: 22, fontWeight: '800', lineHeight: 26, fontFamily: 'Manrope_800ExtraBold' },
  gameMeta: { fontSize: 13, fontWeight: '500' },
  gameCardCta: { height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  gameCardCtaText: { fontSize: 14, fontWeight: '800', letterSpacing: 0.5 },
  fab: { position: 'absolute', right: 22 },
  fabBtn: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', shadowColor: '#ff0080', shadowOpacity: 0.5, shadowRadius: 12, elevation: 8 },
  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,.5)' },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, borderWidth: 1, borderBottomWidth: 0, gap: 14 },
  modalHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 8 },
  modalTitle: { fontSize: 20, fontWeight: '800', fontFamily: 'Manrope_800ExtraBold' },
  modalSub: { fontSize: 14, fontWeight: '500' },
  modalInput: { height: 60, borderRadius: 14, borderWidth: 2, fontSize: 24, fontWeight: '800', textAlign: 'center', letterSpacing: 4, paddingHorizontal: 16 },
  errorText: { fontSize: 13, fontWeight: '500' },
  modalBtn: { height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  modalBtnText: { fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },
});
