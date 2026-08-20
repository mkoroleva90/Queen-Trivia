import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useListGames,
  getListGamesQueryKey,
  useListGameQuestions,
  getListGameQuestionsQueryKey,
  useCreateGame,
  useUpdateGame,
  useDeleteQuestion,
  useGenerateGeminiQuestions,
  useImportOpenTdbQuestions,
  useRegenerateQuestion,
  useEnhanceQuestion,
  useUpdateQuestion,
} from '@workspace/api-client-react';
import type { Game, Question, EnhanceQuestionResult, RegenerateQuestionPreview } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { RunModeScreen, type RunMode } from '@/components/admin/RunModeScreen';
import { JoinCodeScreen } from '@/components/admin/JoinCodeScreen';
import { COPY } from '@workspace/copy';
import { CrownMark } from '@/components/CrownMark';
import { API_BASE_URL } from '@/lib/apiBase';

// ─── Constants ────────────────────────────────────────────────────────────────

type Step = 'setup' | 'review';
type Difficulty = 'easy' | 'medium' | 'hard';
type Source = 'ai' | 'opentdb';

type SetupResult =
  | { type: 'ai'; imported: number; game: Game }
  | { type: 'opentdb'; imported: number; game: Game };

const STEPS: { id: Step; label: string }[] = [
  { id: 'setup', label: 'Setup' },
  { id: 'review', label: 'Review' },
];

const OPENTDB_CATEGORIES = [
  { id: 9, name: 'General Knowledge' },
  { id: 10, name: 'Books' },
  { id: 11, name: 'Film' },
  { id: 12, name: 'Music' },
  { id: 14, name: 'Television' },
  { id: 15, name: 'Video Games' },
  { id: 17, name: 'Science & Nature' },
  { id: 21, name: 'Sports' },
  { id: 22, name: 'Geography' },
  { id: 23, name: 'History' },
  { id: 25, name: 'Art' },
  { id: 26, name: 'Celebrities' },
  { id: 27, name: 'Animals' },
  { id: 28, name: 'Vehicles' },
] as const;

const DIFF_LABELS: Record<Difficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

const TYPE_ICONS: Record<string, string> = {
  multiple_choice: 'checkmark-circle', multi_select: 'checkbox',
  true_false: 'toggle', write_in: 'pencil', short_response: 'chatbubble',
  ordering: 'list', slider: 'options', image_recognition: 'image',
  image_hotspot: 'locate', matching: 'git-compare-outline',
};

const TYPE_LABELS: Record<string, string> = {
  multiple_choice: 'Multiple Choice', multi_select: 'Multi-Select',
  true_false: 'True / False', write_in: 'Write-In',
  short_response: 'Short Response', ordering: 'Ordering',
  slider: 'Slider', image_recognition: 'Image', image_hotspot: 'Image Hotspot',
  matching: 'Matching',
};

const AI_COLOR = '#a855f7';

/**
 * Maps a PATCH /games/:id join-code failure to the shared field-level message,
 * chosen by the server's machine-readable error code / status (never raw text).
 * Must stay identical to the web mapping in Admin.tsx.
 */
function mapJoinCodeError(err: unknown): string {
  const data = err && typeof err === 'object' && 'data' in err ? (err as { data: unknown }).data : null;
  const code = data && typeof data === 'object' && 'code' in data ? String((data as { code: unknown }).code) : null;
  const status = err && typeof err === 'object' && 'status' in err ? (err as { status: number }).status : 0;
  if (code === 'content_filtered') return COPY.contentFilter.accessCode;
  if (code === 'code_taken' || status === 409) return COPY.joinCode.takenError;
  return COPY.joinCode.invalidError;
}

function extractApiError(err: unknown, fallback: string): string {
  if (err && typeof err === 'object') {
    const data = 'data' in err ? (err as { data: unknown }).data : null;
    if (data && typeof data === 'object' && 'error' in data) {
      return String((data as { error: unknown }).error);
    }
    if (err instanceof Error && err.message) return err.message;
  }
  return fallback;
}

// ─── Shared small pieces ──────────────────────────────────────────────────────

function DifficultyChips({ value, onChange, colors }: {
  value: Difficulty; onChange: (d: Difficulty) => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={sh.diffRow}>
      {(['easy', 'medium', 'hard'] as Difficulty[]).map((d) => (
        <Pressable
          key={d}
          style={[sh.diffChip, {
            borderColor: value === d ? colors.primary : colors.border,
            backgroundColor: value === d ? colors.primary + '22' : 'transparent',
          }]}
          onPress={() => onChange(d)}
        >
          <Text style={[sh.diffChipText, { color: value === d ? colors.primary : colors.mutedForeground }]}>
            {d.charAt(0).toUpperCase() + d.slice(1)}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function AmountStepper({ value, onChange, max = 20, colors }: {
  value: number; onChange: (n: number) => void; max?: number;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={sh.stepperRow}>
      <Pressable
        style={[sh.stepperBtn, { borderColor: colors.border }]}
        onPress={() => onChange(Math.max(1, value - 1))}
      >
        <Ionicons name="remove" size={18} color={colors.foreground} />
      </Pressable>
      <Text style={[sh.stepperValue, { color: colors.foreground }]}>{value}</Text>
      <Pressable
        style={[sh.stepperBtn, { borderColor: colors.border }]}
        onPress={() => onChange(Math.min(max, value + 1))}
      >
        <Ionicons name="add" size={18} color={colors.foreground} />
      </Pressable>
      <Text style={[sh.stepperHint, { color: colors.mutedForeground }]}>questions (max {max})</Text>
    </View>
  );
}

function GamePicker({ games, selectedId, onSelect, colors }: {
  games: Game[]; selectedId: number | null;
  onSelect: (id: number) => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={sh.gamePickerRow}>
      {games.map((g) => {
        const active = g.id === selectedId;
        return (
          <Pressable
            key={g.id}
            style={[sh.gameChip, {
              borderColor: active ? colors.primary : colors.border,
              backgroundColor: active ? colors.primary + '22' : colors.card,
            }]}
            onPress={() => onSelect(g.id)}
          >
            {g.status === 'active' && <View style={[sh.gameChipDot, { backgroundColor: colors.secondary }]} />}
            <Text
              style={[sh.gameChipText, { color: active ? colors.primary : colors.foreground }]}
              numberOfLines={1}
            >
              {g.topic}
            </Text>
            <Text style={[sh.gameChipCount, { color: colors.mutedForeground }]}>
              {g.questionCount ?? 0} questions
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// ─── BuildTab ─────────────────────────────────────────────────────────────────

type Props = {
  bottomPadding: number;
};

export function BuildTab({ bottomPadding }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();

  const [step, setStep] = useState<Step>('setup');
  const [workingGameId, setWorkingGameId] = useState<number | null>(null);

  // ── Setup state
  const [source, setSource] = useState<Source>('opentdb');
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [brief, setBrief] = useState('');
  const [setupAmount, setSetupAmount] = useState(10);
  const [setupCategory, setSetupCategory] = useState<number>(9);
  const [catOpen, setCatOpen] = useState(false);
  const [difficultyOpen, setDifficultyOpen] = useState(false);
  const [amountOpen, setAmountOpen] = useState(false);
  const [setupError, setSetupError] = useState('');
  const [setupResult, setSetupResult] = useState<SetupResult | null>(null);
  const [playAlong, setPlayAlong] = useState(false);
  const [runMode, setRunMode] = useState<RunMode | null>(null);
  const [runModeChosen, setRunModeChosen] = useState(false);
  const [joinCodeChosen, setJoinCodeChosen] = useState(false);
  const [joinCodeError, setJoinCodeError] = useState<string | null>(null);
  const [showQuestionReview, setShowQuestionReview] = useState(false);

  // ── Questions state (for adding more after initial import)
  const [aiOpen, setAiOpen] = useState(false);
  const [aiAmount, setAiAmount] = useState(10);
  const [aiBrief, setAiBrief] = useState('');
  const [aiSkipFactCheck, setAiSkipFactCheck] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiResult, setAiResult] = useState<{ imported: number } | null>(null);

  const [tdbOpen, setTdbOpen] = useState(false);
  const [tdbCategory, setTdbCategory] = useState<number>(9);
  const [tdbDifficulty, setTdbDifficulty] = useState<Difficulty>('medium');
  const [tdbAmount, setTdbAmount] = useState(10);
  const [tdbError, setTdbError] = useState('');
  const [tdbResult, setTdbResult] = useState<number | null>(null);

  const [limitMsg, setLimitMsg] = useState<string | null>(null);
  const [buildPlayAlong, setBuildPlayAlong] = useState(false);

  // ── Regen state (Review step)
  const [regenQ, setRegenQ] = useState<Question | null>(null);
  const [regenOpen, setRegenOpen] = useState(false);
  const [regenPreview, setRegenPreview] = useState<RegenerateQuestionPreview | null>(null);
  const [regenLoading, setRegenLoading] = useState(false);
  const [regenError, setRegenError] = useState('');

  // ── Enhance state (Review step)
  const [enhQ, setEnhQ] = useState<Question | null>(null);
  const [enhOpen, setEnhOpen] = useState(false);
  const [enhResult, setEnhResult] = useState<EnhanceQuestionResult | null>(null);
  const [enhLoading, setEnhLoading] = useState(false);
  const [enhError, setEnhError] = useState('');

  // ── Regen All state (Review step)
  const [regenAllConfirmOpen, setRegenAllConfirmOpen] = useState(false);
  const [regenAllLoading, setRegenAllLoading] = useState(false);
  const [regenAllError, setRegenAllError] = useState('');


  // ── Data & mutations
  const { data: games = [] } = useListGames();
  const editableGames = useMemo(
    () => games.filter((g) => g.status === 'waiting' || g.status === 'active'),
    [games],
  );
  const selectedGame = games.find((g) => g.id === workingGameId) ?? null;

  useEffect(() => {
    if (workingGameId === null && editableGames.length > 0) {
      setWorkingGameId(editableGames[0]!.id);
    }
  }, [editableGames, workingGameId]);

  const { data: questions = [] } = useListGameQuestions(workingGameId ?? 0, {
    query: {
      queryKey: getListGameQuestionsQueryKey(workingGameId ?? 0),
      enabled: workingGameId !== null,
    },
  });

  const createGame = useCreateGame();
  const updateGame = useUpdateGame();
  const deleteQuestion = useDeleteQuestion();
  const generateGemini = useGenerateGeminiQuestions();
  const importOpenTdb = useImportOpenTdbQuestions();
  const regenerateQuestion = useRegenerateQuestion();
  const enhanceQuestion = useEnhanceQuestion();
  const updateQuestion = useUpdateQuestion();

  // Derived: setup working state
  const setupWorking = createGame.isPending || generateGemini.isPending || importOpenTdb.isPending;
  const setupWorkingLabel = createGame.isPending
    ? 'Creating game…'
    : generateGemini.isPending
      ? 'Generating questions…'
      : importOpenTdb.isPending
        ? 'Importing questions…'
        : 'Working…';

  const selectedCategory = OPENTDB_CATEGORIES.find((c) => c.id === setupCategory);


  const invalidate = (gameId?: number | null) => {
    qc.invalidateQueries({ queryKey: getListGamesQueryKey() });
    if (gameId != null) {
      qc.invalidateQueries({ queryKey: getListGameQuestionsQueryKey(gameId) });
    }
  };

  const handleJoinCodeSubmit = async (code: string) => {
    if (!setupResult) return;
    setJoinCodeError(null);
    if (code === (setupResult.game.accessCode ?? '')) {
      setJoinCodeChosen(true);
      setShowQuestionReview(false);
      setStep('review');
      return;
    }
    try {
      const updated = await updateGame.mutateAsync({
        gameId: setupResult.game.id,
        data: { accessCode: code },
      });
      setSetupResult({ ...setupResult, game: { ...setupResult.game, accessCode: updated.accessCode ?? code } });
      qc.invalidateQueries({ queryKey: getListGamesQueryKey() });
      setJoinCodeChosen(true);
      setShowQuestionReview(false);
      setStep('review');
    } catch (err) {
      setJoinCodeError(mapJoinCodeError(err));
    }
  };

  const goLive = async () => {
    if (!setupResult) return;
    setSetupError('');
    try {
      await updateGame.mutateAsync({
        gameId: setupResult.game.id,
        data: { status: 'active', hostPlaysAlong: playAlong },
      });
      qc.invalidateQueries({ queryKey: getListGamesQueryKey() });
      router.push(`/admin/live/${setupResult.game.id}`);
    } catch (err) {
      setSetupError(extractApiError(err, 'Could not go live — please retry'));
    }
  };

  const resetSetup = () => {
    setSetupResult(null);
    setPlayAlong(false);
    setRunMode(null);
    setRunModeChosen(false);
    setJoinCodeChosen(false);
    setJoinCodeError(null);
    setShowQuestionReview(false);
    setCatOpen(false);
    setDifficultyOpen(false);
    setAmountOpen(false);
    setTopic('');
    setBrief('');
    setSetupError('');
    setSetupAmount(10);
    setSetupCategory(9);
  };

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleCreateAI = async () => {
    if (!topic.trim()) { setSetupError('Enter a topic'); return; }
    setSetupError('');
    try {
      const game = await createGame.mutateAsync({
        data: { topic: topic.trim(), difficulty, createdByAdmin: true, brief: brief.trim() || null },
      });
      const result = await generateGemini.mutateAsync({
        gameId: game.id,
        data: {
          topic: topic.trim(),
          difficulty,
          amount: setupAmount,
          brief: brief.trim() || undefined,
        },
      });
      invalidate(game.id);
      setWorkingGameId(game.id);
      setSetupResult({ type: 'ai', imported: result.imported, game });
      setShowQuestionReview(false);
      // If the content filter removed some questions, tell the host.
      if (result.contentFilteredCount && result.contentFilteredCount > 0 && result.contentFilteredMessage) {
        setSetupError(result.contentFilteredMessage);
      }
    } catch (err) {
      const msg = extractApiError(err, 'Failed to create game — please retry');
      if (msg.includes('Monthly limit reached')) {
        setLimitMsg(msg);
      } else {
        setSetupError(msg);
      }
    }
  };

  const handleCreateOpenTdb = async () => {
    setSetupError('');
    try {
      const catName = selectedCategory?.name ?? 'General Knowledge';
      const game = await createGame.mutateAsync({
        data: { topic: catName, difficulty, createdByAdmin: true },
      });
      const result = await importOpenTdb.mutateAsync({
        gameId: game.id,
        data: { categoryId: setupCategory, difficulty, amount: setupAmount },
      });
      invalidate(game.id);
      setWorkingGameId(game.id);
      setSetupResult({ type: 'opentdb', imported: result.imported, game });
      setShowQuestionReview(false);
    } catch (err) {
      setSetupError(extractApiError(err, 'Could not import questions — please retry'));
    }
  };

  const handleGenerateAi = async () => {
    if (!selectedGame) return;
    setAiError('');
    setAiResult(null);
    try {
      const result = await generateGemini.mutateAsync({
        gameId: selectedGame.id,
        data: {
          topic: selectedGame.topic,
          difficulty: (selectedGame.difficulty ?? 'medium') as Difficulty,
          amount: aiAmount,
          brief: aiBrief.trim() || undefined,
        },
      });
      invalidate(selectedGame.id);
      setAiResult({ imported: result.imported });
      // If the content filter removed some questions, tell the host.
      if (result.contentFilteredCount && result.contentFilteredCount > 0 && result.contentFilteredMessage) {
        setAiError(result.contentFilteredMessage);
      }
    } catch (err) {
      const msg = extractApiError(err, 'Generation failed — try again or add questions manually');
      if (msg.includes('Monthly limit reached')) {
        setAiOpen(false);
        setLimitMsg(msg);
      } else {
        setAiError(msg);
      }
    }
  };

  const handleImportTdb = async () => {
    if (!selectedGame) return;
    setTdbError('');
    setTdbResult(null);
    try {
      const result = await importOpenTdb.mutateAsync({
        gameId: selectedGame.id,
        data: { categoryId: tdbCategory, difficulty: tdbDifficulty, amount: tdbAmount },
      });
      invalidate(selectedGame.id);
      setTdbResult(result.imported);
    } catch (err) {
      setTdbError(extractApiError(err, 'Could not fetch questions from Open Trivia Database'));
    }
  };

  const handleDeleteQuestion = (q: Question) => {
    deleteQuestion.mutate(
      { questionId: q.id },
      { onSuccess: () => invalidate(workingGameId) },
    );
  };

  const handleOpenRegen = (q: Question) => {
    setRegenQ(q);
    setRegenPreview(null);
    setRegenError('');
    setRegenLoading(false);
    setRegenOpen(true);
  };

  const handleGeneratePreview = async () => {
    if (!regenQ || !selectedGame) return;
    setRegenError('');
    setRegenLoading(true);
    setRegenPreview(null);
    try {
      const result = await regenerateQuestion.mutateAsync({
        gameId: selectedGame.id,
        questionId: regenQ.id,
        data: {},
      });
      setRegenPreview(result);
    } catch (err) {
      setRegenError(extractApiError(err, 'Regeneration failed — try again'));
    } finally {
      setRegenLoading(false);
    }
  };

  const handleAcceptRegen = async () => {
    if (!regenQ || !regenPreview) return;
    try {
      await updateQuestion.mutateAsync({
        questionId: regenQ.id,
        data: {
          questionType: regenPreview.questionType as Parameters<typeof updateQuestion.mutateAsync>[0]['data']['questionType'],
          questionText: regenPreview.questionText,
          correctAnswer: regenPreview.correctAnswer,
          options: regenPreview.options?.length ? { choices: regenPreview.options } : null,
          points: regenPreview.points,
        },
      });
      invalidate(workingGameId);
      setRegenOpen(false);
    } catch (err) {
      setRegenError(extractApiError(err, 'Could not save regenerated question'));
    }
  };

  const handleOpenEnhance = (q: Question) => {
    setEnhQ(q);
    setEnhResult(null);
    setEnhError('');
    setEnhLoading(false);
    setEnhOpen(true);
  };

  const handleEnhance = async () => {
    if (!enhQ || !selectedGame) return;
    setEnhError('');
    setEnhLoading(true);
    setEnhResult(null);
    try {
      const result = await enhanceQuestion.mutateAsync({
        gameId: selectedGame.id,
        questionId: enhQ.id,
      });
      setEnhResult(result);
    } catch (err) {
      setEnhError(extractApiError(err, 'Enhancement failed — try again'));
    } finally {
      setEnhLoading(false);
    }
  };

  const handleApplyEnhance = async () => {
    if (!enhQ || !enhResult) return;
    try {
      const opts = enhResult.improvedOptions?.length
        ? { choices: enhResult.improvedOptions }
        : (enhQ.options as Record<string, unknown> | null);
      await updateQuestion.mutateAsync({
        questionId: enhQ.id,
        data: {
          questionText: enhResult.improvedQuestionText,
          options: opts,
          source: enhResult.suggestedSource || (enhQ.source ?? undefined),
        },
      });
      invalidate(workingGameId);
      setEnhOpen(false);
    } catch (err) {
      setEnhError(extractApiError(err, 'Could not save enhanced question'));
    }
  };

  const handleRegenAll = async () => {
    if (!selectedGame || questions.length === 0) return;
    setRegenAllLoading(true);
    setRegenAllError('');
    try {
      // Delete all AI-generated questions
      const aiQs = questions.filter((q) => q.aiGenerated);
      for (const q of aiQs) {
        await deleteQuestion.mutateAsync({ questionId: q.id });
      }
      // Regenerate
      await generateGemini.mutateAsync({
        gameId: selectedGame.id,
        data: {
          topic: selectedGame.topic,
          difficulty: (selectedGame.difficulty as Difficulty) ?? 'medium',
          amount: Math.max(aiQs.length, 10),
        },
      });
      invalidate(selectedGame.id);
      setRegenAllConfirmOpen(false);
    } catch (err) {
      setRegenAllError(extractApiError(err, 'Regeneration failed — try again'));
      setRegenAllLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!selectedGame) return;
    try {
      await updateGame.mutateAsync({ gameId: selectedGame.id, data: { status: 'active', hostPlaysAlong: buildPlayAlong } });
      invalidate(selectedGame.id);
    } catch { /* surfaced through unchanged status */ }
  };

  const s = styles(colors);
  const sheetPadBottom = insets.bottom + 24;

  // ── Review: derive source summary
  const aiQCount = questions.filter((q) => q.aiGenerated).length;
  const tdbQCount = questions.filter((q) => !q.aiGenerated && q.source === 'opentdb').length;
  const manualQCount = questions.length - aiQCount - tdbQCount;
  const totalPoints = questions.reduce((sum, q) => sum + (q.points ?? 0), 0);
  const sourceParts: string[] = [];
  if (aiQCount > 0) sourceParts.push('Gemini AI');
  if (tdbQCount > 0) sourceParts.push('Open Trivia Database');
  if (manualQCount > 0) sourceParts.push('Manual');
  const sourceLabel = sourceParts.join(' · ') || '—';

  const renderReadyToGoLive = () => {
    if (!setupResult) return null;

    return (
      <View style={s.successContainer}>
        <View style={s.rtglCheckCircle}>
          <Ionicons name="checkmark" size={30} color="#19d2ed" />
        </View>
        <Text style={s.rtglTitle}>{COPY.readyToGoLive.title}</Text>

        {/* Join-code summary row */}
        <View style={s.rtglCodeRow}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={s.rtglRowLabel}>{COPY.readyToGoLive.joinLabel.toUpperCase()}</Text>
            <Text style={s.rtglCodeValue}>{setupResult.game.accessCode}</Text>
          </View>
          <Pressable
            onPress={() => {
              setJoinCodeChosen(false);
              setShowQuestionReview(false);
              setStep('setup');
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={COPY.readyToGoLive.editLink}
          >
            <Ionicons name="pencil-outline" size={19} color="#19d2ed" />
          </Pressable>
        </View>

        {/* Mode summary row */}
        <View style={s.rtglModeRow}>
          <View style={s.rtglModeTile}>
            <CrownMark size={22} color="#f5138c" />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={s.rtglModeTitle}>
              {playAlong ? COPY.runMode.hostPlayLabel : COPY.runMode.hostOnlyLabel}
            </Text>
            <Text style={s.rtglModeDesc}>
              {playAlong ? COPY.readyToGoLive.hostPlayDescMobile : COPY.readyToGoLive.hostOnlyDesc}
            </Text>
          </View>
          <Pressable
            onPress={() => {
              setRunModeChosen(false);
              setShowQuestionReview(false);
              setStep('setup');
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={COPY.readyToGoLive.changeLink}
          >
            <Ionicons name="pencil-outline" size={19} color="#19d2ed" />
          </Pressable>
        </View>

        <Pressable
          style={s.rtglOutlineBtn}
          onPress={() => setShowQuestionReview(true)}
        >
          <Text style={s.rtglOutlineBtnText}>{COPY.readyToGoLive.reviewBtn}</Text>
        </Pressable>

        <Pressable
          style={[s.rtglGoLiveBtn, { opacity: updateGame.isPending ? 0.6 : 1 }]}
          onPress={goLive}
          disabled={updateGame.isPending}
        >
          <Ionicons name="play" size={16} color="#fff" />
          <Text style={s.rtglGoLiveText}>
            {updateGame.isPending ? 'Going live…' : COPY.readyToGoLive.goLiveBtn}
          </Text>
        </Pressable>

        {!!setupError && (
          <Text style={[s.helperText, { color: colors.destructive }]}>{setupError}</Text>
        )}
      </View>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={s.container}>
      {/* Step segmented control */}
      <View style={[s.segment, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {STEPS.map((st) => {
          const active = step === st.id;
          return (
            <Pressable
              key={st.id}
              style={[s.segmentBtn, active && { backgroundColor: colors.muted }]}
              onPress={() => setStep(st.id)}
            >
              <Text style={[s.segmentText, { color: active ? colors.foreground : colors.mutedForeground }]}>
                {st.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={[s.body, { paddingBottom: bottomPadding + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── SETUP ── */}
        {step === 'setup' && (
          <View style={s.section}>
            {!runModeChosen ? (
              /* ── Run-mode choice (shown before the success screen) ── */
              <RunModeScreen
                value={runMode}
                onSelect={setRunMode}
                onContinue={() => {
                  setPlayAlong(runMode === 'hostPlay');
                  setRunModeChosen(true);
                  if (setupResult) {
                    setShowQuestionReview(false);
                    setStep('review');
                  }
                }}
              />
            ) : setupResult && !joinCodeChosen ? (
              /* ── Join-code choice (after run mode, before the success screen) ── */
              <JoinCodeScreen
                initialCode={setupResult.game.accessCode ?? ''}
                saving={updateGame.isPending}
                error={joinCodeError}
                onSubmit={handleJoinCodeSubmit}
              />
            ) : (
              /* ── Setup form ── */
              <>
                <View style={s.setupCard}>
                  <Text style={s.setupTitle}>Create a new game</Text>

                  <Text style={s.setupLabel}>Category</Text>
                  <View style={s.setupSelectGroup}>
                    <Pressable
                      style={s.setupSelect}
                      onPress={() => {
                        setCatOpen((o) => !o);
                        setDifficultyOpen(false);
                        setAmountOpen(false);
                      }}
                    >
                      <Text style={s.setupSelectText} numberOfLines={1}>
                        {source === 'ai'
                          ? 'Custom topic — Gemini AI generates questions'
                          : selectedCategory?.name ?? 'Select a category'}
                      </Text>
                      <Ionicons name={catOpen ? 'chevron-up' : 'chevron-down'} size={22} color="#8b93a4" />
                    </Pressable>
                    {catOpen && (
                      <View style={s.setupOptions}>
                        <Pressable
                          style={[s.setupOption, source === 'ai' && s.setupOptionActive]}
                          onPress={() => {
                            setSource('ai');
                            // AI offers 5/10/15 only — clamp a leftover OpenTDB 20 selection.
                            if (setupAmount > 15) setSetupAmount(15);
                            setCatOpen(false);
                          }}
                        >
                          <Text style={s.setupOptionText}>Custom topic — Gemini AI generates questions</Text>
                          {source === 'ai' && <Ionicons name="checkmark" size={18} color="#f5138c" />}
                        </Pressable>
                        {OPENTDB_CATEGORIES.map((c) => {
                          const active = source === 'opentdb' && c.id === setupCategory;
                          return (
                            <Pressable
                              key={c.id}
                              style={[s.setupOption, active && s.setupOptionActive]}
                              onPress={() => {
                                setSource('opentdb');
                                setSetupCategory(c.id);
                                setCatOpen(false);
                              }}
                            >
                              <Text style={s.setupOptionText}>{c.name}</Text>
                              {active && <Ionicons name="checkmark" size={18} color="#f5138c" />}
                            </Pressable>
                          );
                        })}
                      </View>
                    )}
                  </View>
                  <Text style={s.setupHint}>
                    {source === 'ai'
                      ? 'Questions are generated by Gemini AI.'
                      : 'Questions are pulled from Open Trivia Database.'}
                  </Text>

                  {/* ── Custom topic fields ── */}
                  {source === 'ai' && (
                    <>
                      <Text style={s.setupLabel}>Topic</Text>
                      <TextInput
                        style={[s.setupInput, { borderColor: setupError ? colors.destructive : colors.border }]}
                        value={topic}
                        onChangeText={(t) => { setTopic(t); setSetupError(''); }}
                        placeholder="e.g. Harry Potter, The Office, 80s Music, Local History…"
                        placeholderTextColor={colors.mutedForeground}
                      />

                      <Text style={s.setupLabel}>
                        Brief <Text style={s.fieldLabelOpt}>(optional)</Text>
                      </Text>
                      <TextInput
                        style={[s.setupInput, s.setupTextArea, { borderColor: colors.border }]}
                        value={brief}
                        onChangeText={setBrief}
                        placeholder="e.g. Focus on the 1990s. Players are experts — skip the obvious. No chart position questions."
                        placeholderTextColor={colors.mutedForeground}
                        multiline
                        maxLength={2000}
                      />
                    </>
                  )}

                  <View style={s.setupSplitRow}>
                    <View style={s.setupHalfField}>
                      <Text style={s.setupLabel}>Difficulty</Text>
                      <Pressable
                        style={s.setupSelect}
                        onPress={() => {
                          setDifficultyOpen((o) => !o);
                          setCatOpen(false);
                          setAmountOpen(false);
                        }}
                      >
                        <Text style={s.setupSelectText} numberOfLines={1}>{DIFF_LABELS[difficulty]}</Text>
                        <Ionicons name={difficultyOpen ? 'chevron-up' : 'chevron-down'} size={22} color="#8b93a4" />
                      </Pressable>
                      {difficultyOpen && (
                        <View style={s.setupOptions}>
                          {(['easy', 'medium', 'hard'] as Difficulty[]).map((d) => (
                            <Pressable
                              key={d}
                              style={[s.setupOption, difficulty === d && s.setupOptionActive]}
                              onPress={() => { setDifficulty(d); setDifficultyOpen(false); }}
                            >
                              <Text style={s.setupOptionText}>{DIFF_LABELS[d]}</Text>
                              {difficulty === d && <Ionicons name="checkmark" size={18} color="#f5138c" />}
                            </Pressable>
                          ))}
                        </View>
                      )}
                    </View>

                    <View style={s.setupHalfField}>
                      <Text style={s.setupLabel}>Questions to Import</Text>
                      <Pressable
                        style={s.setupSelect}
                        onPress={() => {
                          setAmountOpen((o) => !o);
                          setCatOpen(false);
                          setDifficultyOpen(false);
                        }}
                      >
                        <Text style={s.setupSelectText} numberOfLines={1}>{setupAmount} questions</Text>
                        <Ionicons name={amountOpen ? 'chevron-up' : 'chevron-down'} size={22} color="#8b93a4" />
                      </Pressable>
                      {amountOpen && (
                        <View style={s.setupOptions}>
                          {([5, 10, 15, 20] as const)
                            .filter((n) => source !== 'ai' || n !== 20)
                            .map((n) => (
                              <Pressable
                                key={n}
                                style={[s.setupOption, setupAmount === n && s.setupOptionActive]}
                                onPress={() => { setSetupAmount(n); setAmountOpen(false); }}
                              >
                                <Text style={s.setupOptionText}>{n} questions</Text>
                                {setupAmount === n && <Ionicons name="checkmark" size={18} color="#f5138c" />}
                              </Pressable>
                            ))}
                        </View>
                      )}
                    </View>
                  </View>

                  {!!setupError && (
                    <Text style={[s.errorText, { color: colors.destructive }]}>{setupError}</Text>
                  )}

                  <Pressable
                    style={[s.setupSaveBtn, { opacity: setupWorking ? 0.75 : 1 }]}
                    onPress={source === 'ai' ? handleCreateAI : handleCreateOpenTdb}
                    disabled={setupWorking}
                  >
                    {setupWorking ? (
                      <View style={s.btnRow}>
                        <ActivityIndicator color="#fff" />
                        <Text style={s.primaryBtnText}>{setupWorkingLabel}</Text>
                      </View>
                    ) : (
                      <View style={s.btnRow}>
                        <Ionicons name={source === 'ai' ? 'sparkles' : 'cloud-download-outline'} size={19} color="#fff" />
                        <Text style={s.setupSaveBtnText}>{source === 'ai' ? 'Create Game' : 'Save Game'}</Text>
                      </View>
                    )}
                  </Pressable>
                </View>
              </>
            )}
          </View>
        )}

        {/* ── REVIEW ── */}
        {step === 'review' && (
          <View style={s.section}>
            {setupResult && !showQuestionReview ? (
              renderReadyToGoLive()
            ) : (
              <>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 0 }}>
              <Text style={[s.heading, { color: colors.foreground, marginBottom: 0 }]}>Review questions</Text>
              {selectedGame && questions.filter((q) => q.aiGenerated).length > 0 && (
                <Pressable
                  style={[s.smallBtn, { backgroundColor: colors.muted, paddingHorizontal: 10, marginTop: 0 }]}
                  onPress={() => { setRegenAllError(''); setRegenAllConfirmOpen(true); }}
                >
                  <Text style={[s.smallBtnText, { color: colors.mutedForeground }]}>Regen all</Text>
                </Pressable>
              )}
            </View>
            {editableGames.length === 0 ? (
              <View style={[s.emptyCard, { borderColor: colors.border }]}>
                <Ionicons name="checkmark-done-outline" size={36} color={colors.mutedForeground} />
                <Text style={[s.emptyTitle, { color: colors.foreground }]}>Nothing to review</Text>
                <Text style={[s.emptySub, { color: colors.mutedForeground }]}>
                  Create a game and add questions first.
                </Text>
              </View>
            ) : (
              <>
                <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Select game</Text>
                <GamePicker
                  games={editableGames}
                  selectedId={workingGameId}
                  onSelect={setWorkingGameId}
                  colors={colors}
                />

                {/* Summary card */}
                {selectedGame && questions.length > 0 && (
                  <View style={[s.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[s.summaryTopic, { color: colors.foreground }]} numberOfLines={2}>
                      {selectedGame.topic}
                    </Text>
                    <View style={s.summaryMeta}>
                      <View style={s.summaryMetaItem}>
                        <Ionicons name="layers-outline" size={13} color={colors.mutedForeground} />
                        <Text style={[s.summaryMetaText, { color: colors.mutedForeground }]}>{sourceLabel}</Text>
                      </View>
                      <View style={s.summaryMetaItem}>
                        <Ionicons name="speedometer-outline" size={13} color={colors.mutedForeground} />
                        <Text style={[s.summaryMetaText, { color: colors.mutedForeground }]}>
                          {selectedGame.difficulty
                            ? DIFF_LABELS[selectedGame.difficulty as Difficulty] ?? selectedGame.difficulty
                            : '—'}
                        </Text>
                      </View>
                      <View style={s.summaryMetaItem}>
                        <Ionicons name="help-circle-outline" size={13} color={colors.mutedForeground} />
                        <Text style={[s.summaryMetaText, { color: colors.mutedForeground }]}>
                          {questions.length} question{questions.length === 1 ? '' : 's'} · {totalPoints} pts total
                        </Text>
                      </View>
                    </View>
                  </View>
                )}

                {selectedGame && questions.length === 0 && (
                  <View style={[s.emptyCard, { borderColor: colors.border }]}>
                    <Ionicons name="help-circle-outline" size={32} color={colors.mutedForeground} />
                    <Text style={[s.emptySub, { color: colors.mutedForeground }]}>
                      No questions yet — add some from the game detail screen.
                    </Text>
                    <Pressable style={[s.smallBtn, { backgroundColor: colors.primary }]} onPress={() => router.push(`/admin/${selectedGame.id}`)}>
                      <Text style={s.smallBtnText}>Add questions</Text>
                    </Pressable>
                  </View>
                )}

                {selectedGame && [...questions]
                  .sort((a, b) => a.orderIndex - b.orderIndex)
                  .map((q, idx) => (
                    <View key={q.id} style={[s.qCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <View style={[s.qIndex, { backgroundColor: colors.muted }]}>
                        <Text style={[s.qIndexText, { color: colors.mutedForeground }]}>{idx + 1}</Text>
                      </View>
                      <View style={s.qBody}>
                        <Text style={[s.qText, { color: colors.foreground }]} numberOfLines={2}>
                          {q.questionText}
                        </Text>
                        <View style={s.qMeta}>
                          <Ionicons
                            name={(TYPE_ICONS[q.questionType] ?? 'help-circle') as 'help-circle'}
                            size={12}
                            color={colors.mutedForeground}
                          />
                          <Text style={[s.qMetaText, { color: colors.mutedForeground }]}>
                            {TYPE_LABELS[q.questionType] ?? q.questionType} · {q.points} pts
                            {q.aiGenerated ? ' · AI' : q.source === 'opentdb' ? ' · Open Trivia Database' : ''}
                          </Text>
                        </View>
                      </View>
                      {q.aiGenerated && (
                        <Pressable hitSlop={8} style={s.qAction} onPress={() => handleOpenRegen(q)}>
                          <Ionicons name="refresh-outline" size={15} color={colors.primary} />
                        </Pressable>
                      )}
                      {q.aiGenerated && (
                        <Pressable hitSlop={8} style={s.qAction} onPress={() => handleOpenEnhance(q)}>
                          <Ionicons name="sparkles" size={15} color={AI_COLOR} />
                        </Pressable>
                      )}
                      <Pressable
                        hitSlop={8}
                        style={s.qAction}
                        onPress={() => router.push(`/admin/${selectedGame.id}`)}
                      >
                        <Ionicons name="pencil" size={16} color={colors.mutedForeground} />
                      </Pressable>
                      <Pressable hitSlop={8} style={s.qAction} onPress={() => handleDeleteQuestion(q)}>
                        <Ionicons name="trash-outline" size={16} color={colors.destructive} />
                      </Pressable>
                    </View>
                  ))}

                {selectedGame && questions.length > 0 && (
                  selectedGame.status === 'waiting' ? (
                    <>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 12, backgroundColor: buildPlayAlong ? colors.primary + '10' : 'transparent' }}>
                        <View style={{ flex: 1, marginRight: 12 }}>
                          <Text style={{ fontSize: 15, fontFamily: 'Manrope_700Bold', color: colors.foreground, marginBottom: 3 }}>{COPY.hostPlayAlong.playAlongLabel}</Text>
                          <Text style={{ fontSize: 13, color: colors.mutedForeground, lineHeight: 18 }}>{COPY.hostPlayAlong.playAlongDesc}</Text>
                        </View>
                        <Switch
                          value={buildPlayAlong}
                          onValueChange={setBuildPlayAlong}
                          trackColor={{ false: colors.border, true: colors.primary + '60' }}
                          thumbColor={buildPlayAlong ? colors.primary : colors.mutedForeground}
                        />
                      </View>
                      <Pressable
                        style={[s.primaryBtn, { backgroundColor: colors.secondary, opacity: updateGame.isPending ? 0.7 : 1 }]}
                        onPress={handlePublish}
                        disabled={updateGame.isPending}
                      >
                        {updateGame.isPending
                          ? <ActivityIndicator color="#0a1019" />
                          : (
                            <View style={s.btnRow}>
                              <Ionicons name="play" size={16} color="#0a1019" />
                              <Text style={[s.primaryBtnText, { color: '#0a1019' }]}>Publish &amp; go live</Text>
                            </View>
                          )}
                      </Pressable>
                    </>
                  ) : (
                    <View style={[s.liveBanner, { backgroundColor: colors.secondary + '15', borderColor: colors.secondary + '40' }]}>
                      <View style={[s.liveBannerDot, { backgroundColor: colors.secondary }]} />
                      <Text style={[s.liveBannerText, { color: colors.secondary }]}>
                        This game is live — changes save instantly
                      </Text>
                    </View>
                  )
                )}
              </>
            )}
              </>
            )}
          </View>
        )}
      </ScrollView>

      {/* ── AI generation sheet (Questions step) ── */}
      <Modal visible={aiOpen} animationType="slide" transparent presentationStyle="overFullScreen">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={sh.modalOverlay}>
            <Pressable style={sh.modalBackdrop} onPress={() => !generateGemini.isPending && setAiOpen(false)} />
            <View style={[sh.sheet, { backgroundColor: colors.card, paddingBottom: sheetPadBottom }]}>
              <View style={sh.sheetHandle} />
              <View style={sh.sheetTitleRow}>
                <Ionicons name="sparkles" size={20} color={AI_COLOR} />
                <Text style={[sh.sheetTitle, { color: colors.foreground }]}>Generate with AI</Text>
              </View>

              {aiResult ? (
                <>
                  <View style={[sh.resultBox, { borderColor: colors.secondary + '40', backgroundColor: colors.secondary + '12' }]}>
                    <Ionicons name="checkmark-circle" size={20} color={colors.secondary} />
                    <Text style={[sh.resultText, { color: colors.foreground }]}>
                      {aiResult.imported} question{aiResult.imported === 1 ? '' : 's'} generated
                    </Text>
                  </View>
                  <Pressable style={[sh.sheetBtn, { backgroundColor: colors.primary }]} onPress={() => setAiOpen(false)}>
                    <Text style={sh.sheetBtnText}>Done</Text>
                  </Pressable>
                  <Pressable style={sh.secondaryLink} onPress={() => setAiResult(null)}>
                    <Text style={[sh.secondaryLinkText, { color: colors.mutedForeground }]}>Generate more</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={[sh.sheetSub, { color: colors.mutedForeground }]}>
                    Topic: {selectedGame?.topic} · {selectedGame?.difficulty}
                  </Text>

                  <Text style={[sh.fieldLabel, { color: colors.mutedForeground }]}>How many</Text>
                  <AmountStepper value={aiAmount} onChange={setAiAmount} colors={colors} />

                  <Text style={[sh.fieldLabel, { color: colors.mutedForeground }]}>Brief (optional)</Text>
                  <TextInput
                    style={[sh.textInput, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border }]}
                    value={aiBrief}
                    onChangeText={setAiBrief}
                    placeholder="Extra guidance for the AI"
                    placeholderTextColor={colors.mutedForeground}
                  />


                  {!!aiError && <Text style={[sh.errorText, { color: colors.destructive }]}>{aiError}</Text>}

                  <Pressable
                    style={[sh.sheetBtn, { backgroundColor: AI_COLOR, opacity: generateGemini.isPending ? 0.7 : 1 }]}
                    onPress={handleGenerateAi}
                    disabled={generateGemini.isPending}
                  >
                    {generateGemini.isPending ? (
                      <View style={sh.btnRow}>
                        <ActivityIndicator color="#fff" />
                        <Text style={sh.sheetBtnText}>Generating questions…</Text>
                      </View>
                    ) : (
                      <Text style={sh.sheetBtnText}>Generate {aiAmount} questions</Text>
                    )}
                  </Pressable>
                </>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── OpenTDB import sheet (Questions step) ── */}
      <Modal visible={tdbOpen} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={sh.modalOverlay}>
          <Pressable style={sh.modalBackdrop} onPress={() => !importOpenTdb.isPending && setTdbOpen(false)} />
          <View style={[sh.sheet, { backgroundColor: colors.card, paddingBottom: sheetPadBottom, maxHeight: '85%' }]}>
            <View style={sh.sheetHandle} />
            <View style={sh.sheetTitleRow}>
              <Ionicons name="cloud-download-outline" size={20} color={colors.primary} />
              <Text style={[sh.sheetTitle, { color: colors.foreground }]}>Import from Open Trivia Database</Text>
            </View>

            {tdbResult !== null ? (
              <>
                <View style={[sh.resultBox, { borderColor: colors.secondary + '40', backgroundColor: colors.secondary + '12' }]}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.secondary} />
                  <Text style={[sh.resultText, { color: colors.foreground }]}>
                    {tdbResult} question{tdbResult === 1 ? '' : 's'} imported
                  </Text>
                </View>
                <Pressable style={[sh.sheetBtn, { backgroundColor: colors.primary }]} onPress={() => setTdbOpen(false)}>
                  <Text style={sh.sheetBtnText}>Done</Text>
                </Pressable>
                <Pressable style={sh.secondaryLink} onPress={() => setTdbResult(null)}>
                  <Text style={[sh.secondaryLinkText, { color: colors.mutedForeground }]}>Import more</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={[sh.fieldLabel, { color: colors.mutedForeground }]}>Category</Text>
                <ScrollView style={sh.catList} showsVerticalScrollIndicator={false}>
                  {OPENTDB_CATEGORIES.map((c) => {
                    const active = c.id === tdbCategory;
                    return (
                      <Pressable
                        key={c.id}
                        style={[sh.catRow, active && { backgroundColor: colors.primary + '18' }]}
                        onPress={() => setTdbCategory(c.id)}
                      >
                        <Text style={[sh.catText, { color: active ? colors.primary : colors.foreground }]}>
                          {c.name}
                        </Text>
                        {active && <Ionicons name="checkmark" size={16} color={colors.primary} />}
                      </Pressable>
                    );
                  })}
                </ScrollView>

                <Text style={[sh.fieldLabel, { color: colors.mutedForeground }]}>Difficulty</Text>
                <DifficultyChips value={tdbDifficulty} onChange={setTdbDifficulty} colors={colors} />

                <Text style={[sh.fieldLabel, { color: colors.mutedForeground }]}>How many</Text>
                <AmountStepper value={tdbAmount} onChange={setTdbAmount} colors={colors} />

                {!!tdbError && <Text style={[sh.errorText, { color: colors.destructive }]}>{tdbError}</Text>}

                <Pressable
                  style={[sh.sheetBtn, { backgroundColor: colors.primary, opacity: importOpenTdb.isPending ? 0.7 : 1 }]}
                  onPress={handleImportTdb}
                  disabled={importOpenTdb.isPending}
                >
                  {importOpenTdb.isPending
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={sh.sheetBtnText}>Import {tdbAmount} questions</Text>}
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ── Free-tier limit sheet ── */}
      <Modal visible={!!limitMsg} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={sh.modalOverlay}>
          <Pressable style={sh.modalBackdrop} onPress={() => setLimitMsg(null)} />
          <View style={[sh.sheet, { backgroundColor: colors.card, paddingBottom: sheetPadBottom }]}>
            <View style={sh.sheetHandle} />
            <View style={sh.sheetTitleRow}>
              <Ionicons name="information-circle-outline" size={20} color={colors.secondary} />
              <Text style={[sh.sheetTitle, { color: colors.foreground }]}>Monthly limit reached</Text>
            </View>
            <Text style={[sh.sheetSub, { color: colors.mutedForeground }]}>{limitMsg}</Text>
            <Pressable style={[sh.sheetBtn, { backgroundColor: colors.primary }]} onPress={() => setLimitMsg(null)}>
              <Text style={sh.sheetBtnText}>Got it</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ── Regen modal (Review step) ── */}
      <Modal visible={regenOpen} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={sh.modalOverlay}>
          <Pressable style={sh.modalBackdrop} onPress={() => !regenLoading && setRegenOpen(false)} />
          <View style={[sh.sheet, { backgroundColor: colors.card, paddingBottom: sheetPadBottom }]}>
            <View style={sh.sheetHandle} />
            <View style={sh.sheetTitleRow}>
              <Ionicons name="refresh-outline" size={20} color={colors.primary} />
              <Text style={[sh.sheetTitle, { color: colors.foreground }]}>Regenerate question</Text>
            </View>

            {regenQ && (
              <Text style={[sh.sheetSub, { color: colors.mutedForeground }]} numberOfLines={2}>
                {regenQ.questionText}
              </Text>
            )}

            {regenPreview ? (
              <>
                <View style={[sh.resultBox, { borderColor: colors.primary + '40', backgroundColor: colors.primary + '10' }]}>
                  <Text style={[sh.fieldLabel, { color: colors.mutedForeground, marginBottom: 2 }]}>New question</Text>
                  <Text style={[sh.resultText, { color: colors.foreground }]}>{regenPreview.questionText}</Text>
                  <Text style={[sh.fieldLabel, { color: colors.mutedForeground, marginTop: 8, marginBottom: 2 }]}>Answer</Text>
                  <Text style={[sh.resultText, { color: colors.secondary }]}>{regenPreview.correctAnswer}</Text>
                </View>
                {!!regenError && <Text style={[sh.errorText, { color: colors.destructive }]}>{regenError}</Text>}
                <Pressable style={[sh.sheetBtn, { backgroundColor: colors.secondary }]} onPress={handleAcceptRegen}>
                  <Text style={[sh.sheetBtnText, { color: '#0a1019' }]}>Accept</Text>
                </Pressable>
                <Pressable style={[sh.sheetBtn, { backgroundColor: colors.muted }]} onPress={handleGeneratePreview} disabled={regenLoading}>
                  {regenLoading ? <ActivityIndicator color={colors.foreground} /> : <Text style={[sh.sheetBtnText, { color: colors.foreground }]}>Retry</Text>}
                </Pressable>
              </>
            ) : (
              <>
                {!!regenError && <Text style={[sh.errorText, { color: colors.destructive }]}>{regenError}</Text>}
                <Pressable style={[sh.sheetBtn, { backgroundColor: colors.primary, opacity: regenLoading ? 0.7 : 1 }]} onPress={handleGeneratePreview} disabled={regenLoading}>
                  {regenLoading ? <ActivityIndicator color="#fff" /> : <Text style={sh.sheetBtnText}>Generate</Text>}
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ── Enhance modal (Review step) ── */}
      <Modal visible={enhOpen} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={sh.modalOverlay}>
          <Pressable style={sh.modalBackdrop} onPress={() => !enhLoading && setEnhOpen(false)} />
          <View style={[sh.sheet, { backgroundColor: colors.card, paddingBottom: sheetPadBottom }]}>
            <View style={sh.sheetHandle} />
            <View style={sh.sheetTitleRow}>
              <Ionicons name="sparkles" size={20} color={AI_COLOR} />
              <Text style={[sh.sheetTitle, { color: colors.foreground }]}>Enhance question</Text>
            </View>

            {enhResult ? (
              <>
                {enhResult.improvedQuestionText && (
                  <View style={[sh.resultBox, { borderColor: AI_COLOR + '40', backgroundColor: AI_COLOR + '10', marginBottom: 8 }]}>
                    <Text style={[sh.fieldLabel, { color: colors.mutedForeground, marginBottom: 2 }]}>Improved question</Text>
                    <Text style={[{ fontSize: 14, color: colors.foreground, lineHeight: 20 }]}>{enhResult.improvedQuestionText}</Text>
                  </View>
                )}
                {enhResult.improvedOptions && enhResult.improvedOptions.length > 0 && (
                  <View style={[sh.resultBox, { borderColor: colors.secondary + '40', backgroundColor: colors.secondary + '10', marginBottom: 8 }]}>
                    <Text style={[sh.fieldLabel, { color: colors.mutedForeground, marginBottom: 2 }]}>Improved options</Text>
                    {enhResult.improvedOptions.map((opt, i) => (
                      <Text key={i} style={[{ fontSize: 13, color: i === 0 ? colors.secondary : colors.foreground, lineHeight: 20 }]}>
                        {i === 0 ? '✓ ' : '• '}{opt}
                      </Text>
                    ))}
                  </View>
                )}
                {!!enhError && <Text style={[sh.errorText, { color: colors.destructive }]}>{enhError}</Text>}
                <Pressable style={[sh.sheetBtn, { backgroundColor: colors.secondary }]} onPress={handleApplyEnhance}>
                  <Text style={[sh.sheetBtnText, { color: '#0a1019' }]}>Apply improvements</Text>
                </Pressable>
                <Pressable style={sh.secondaryLink} onPress={() => setEnhOpen(false)}>
                  <Text style={[sh.secondaryLinkText, { color: colors.mutedForeground }]}>Keep original</Text>
                </Pressable>
              </>
            ) : (
              <>
                {enhQ && (
                  <Text style={[sh.sheetSub, { color: colors.mutedForeground }]} numberOfLines={2}>
                    {enhQ.questionText}
                  </Text>
                )}
                {!!enhError && <Text style={[sh.errorText, { color: colors.destructive }]}>{enhError}</Text>}
                <Pressable style={[sh.sheetBtn, { backgroundColor: AI_COLOR, opacity: enhLoading ? 0.7 : 1 }]} onPress={handleEnhance} disabled={enhLoading}>
                  {enhLoading ? <ActivityIndicator color="#fff" /> : <Text style={sh.sheetBtnText}>Enhance with AI</Text>}
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ── Regen All confirm modal ── */}
      <Modal visible={regenAllConfirmOpen} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={sh.modalOverlay}>
          <Pressable style={sh.modalBackdrop} onPress={() => !regenAllLoading && setRegenAllConfirmOpen(false)} />
          <View style={[sh.sheet, { backgroundColor: colors.card, paddingBottom: sheetPadBottom }]}>
            <View style={sh.sheetHandle} />
            <Text style={[sh.sheetTitle, { color: colors.foreground }]}>Regenerate all AI questions?</Text>
            <Text style={[sh.sheetSub, { color: colors.mutedForeground }]}>
              All {questions.filter((q) => q.aiGenerated).length} AI-generated questions will be deleted and new ones generated for this game.
            </Text>
            {!!regenAllError && <Text style={[sh.errorText, { color: colors.destructive }]}>{regenAllError}</Text>}
            <Pressable
              style={[sh.sheetBtn, { backgroundColor: colors.primary, opacity: regenAllLoading ? 0.7 : 1 }]}
              onPress={handleRegenAll}
              disabled={regenAllLoading}
            >
              {regenAllLoading
                ? <ActivityIndicator color="#fff" />
                : <Text style={sh.sheetBtnText}>Regenerate all</Text>}
            </Pressable>
            <Pressable style={sh.secondaryLink} onPress={() => setRegenAllConfirmOpen(false)} disabled={regenAllLoading}>
              <Text style={[sh.secondaryLinkText, { color: colors.mutedForeground }]}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    segment: {
      flexDirection: 'row', margin: 16, marginBottom: 4, padding: 4,
      borderRadius: 12, borderWidth: 1, gap: 4,
    },
    segmentBtn: { flex: 1, borderRadius: 8, paddingVertical: 9, alignItems: 'center' },
    segmentText: { fontSize: 14, fontFamily: 'Manrope_700Bold' },
    body: { padding: 16 },
    section: { gap: 12 },
    heading: { fontSize: 20, fontFamily: 'Manrope_800ExtraBold' },
    setupCard: {
      width: '100%',
      backgroundColor: '#0d1523',
      borderWidth: 1,
      borderColor: '#25324d',
      borderRadius: 26,
      padding: 24,
      gap: 14,
    },
    setupTitle: {
      color: '#f8f9ff',
      fontSize: 28,
      lineHeight: 34,
      fontFamily: 'Manrope_800ExtraBold',
      marginBottom: 14,
    },
    setupLabel: {
      color: '#f4f6ff',
      fontSize: 16,
      lineHeight: 22,
      fontFamily: 'Manrope_600SemiBold',
    },
    setupSelectGroup: { gap: 8 },
    setupSelect: {
      minHeight: 62,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      backgroundColor: '#0d1523',
      borderWidth: 1,
      borderColor: '#202d49',
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 13,
    },
    setupSelectText: {
      flex: 1,
      color: '#f4f6ff',
      fontSize: 17,
      fontFamily: 'Manrope_500Medium',
    },
    setupHint: {
      color: '#9da6bc',
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 16,
    },
    setupInput: {
      minHeight: 58,
      color: '#f4f6ff',
      backgroundColor: '#0d1523',
      borderWidth: 1,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 13,
      fontSize: 16,
    },
    setupTextArea: { minHeight: 104, textAlignVertical: 'top' },
    setupSplitRow: { flexDirection: 'row', gap: 14 },
    setupHalfField: { flex: 1, gap: 8 },
    setupOptions: {
      backgroundColor: '#0b121f',
      borderWidth: 1,
      borderColor: '#25324d',
      borderRadius: 14,
      overflow: 'hidden',
    },
    setupOption: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 11,
    },
    setupOptionActive: { backgroundColor: 'rgba(245,19,140,0.13)' },
    setupOptionText: {
      flex: 1,
      color: '#e8ebf4',
      fontSize: 14,
      fontFamily: 'Manrope_500Medium',
    },
    setupSaveBtn: {
      minHeight: 62,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f5138c',
      borderRadius: 14,
      marginTop: 18,
      paddingHorizontal: 18,
      paddingVertical: 16,
    },
    setupSaveBtnText: { color: '#fff', fontSize: 20, fontFamily: 'Manrope_700Bold' },
    helperText: { fontSize: 11.5, lineHeight: 16, marginTop: -6 },
    fieldLabel: { fontSize: 12, fontFamily: 'Manrope_600SemiBold', marginTop: 6 },
    fieldLabelOpt: { fontSize: 12, fontFamily: 'Manrope_400Regular' },
    textInput: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
    textArea: { minHeight: 80, textAlignVertical: 'top' },
    errorText: { fontSize: 13 },
    // Switch
    switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
    switchLabel: { fontSize: 14, fontFamily: 'Manrope_600SemiBold' },
    switchHint: { fontSize: 12, lineHeight: 16 },
    // OpenTDB category list
    catList: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
    catRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11,
    },
    catText: { fontSize: 14, fontFamily: 'Manrope_600SemiBold' },
    // Info callout
    callout: {
      flexDirection: 'row', gap: 10, borderWidth: 1, borderRadius: 12, padding: 14, marginTop: 2,
    },
    calloutBody: { fontSize: 12.5, lineHeight: 18 },
    // Button
    primaryBtn: {
      borderRadius: 12, paddingVertical: 14,
      alignItems: 'center', justifyContent: 'center', marginTop: 6,
    },
    primaryBtnText: { color: '#fff', fontSize: 16, fontFamily: 'Manrope_700Bold' },
    btnRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    secondaryLink: { alignItems: 'center', paddingVertical: 8 },
    secondaryLinkText: { fontSize: 14, fontFamily: 'Manrope_600SemiBold' },
    // Success state
    successContainer: { gap: 12 },
    successCard: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 12,
      borderWidth: 1, borderRadius: 14, padding: 16,
    },
    successTitle: { fontSize: 15, fontFamily: 'Manrope_700Bold' },
    successSub: { fontSize: 12.5, lineHeight: 17 },
    // "Ready to go live" confirmation
    rtglCheckCircle: {
      width: 62, height: 62, borderRadius: 31, borderWidth: 3, borderColor: '#19d2ed',
      alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginTop: 4,
    },
    rtglTitle: {
      fontSize: 24, fontFamily: 'Manrope_800ExtraBold', color: '#ffffff', textAlign: 'center',
    },
    rtglSubtitle: {
      fontSize: 13.5, lineHeight: 19, color: '#8b93a4', textAlign: 'center', marginBottom: 6,
    },
    rtglCodeRow: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: '#0f1420', borderWidth: 1, borderColor: '#1e2431',
      borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    },
    rtglRowLabel: {
      fontSize: 11, fontFamily: 'Manrope_700Bold', letterSpacing: 1.3, color: '#6b7387',
    },
    rtglCodeValue: {
      fontSize: 20, fontFamily: 'Manrope_800ExtraBold', letterSpacing: 2.4, color: '#ffde17',
    },
    rtglModeRow: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: 'rgba(245,19,140,0.10)', borderWidth: 1, borderColor: 'rgba(245,19,140,0.45)',
      borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    },
    rtglModeTile: {
      width: 40, height: 40, borderRadius: 11, backgroundColor: 'rgba(245,19,140,0.22)',
      alignItems: 'center', justifyContent: 'center',
    },
    rtglModeTitle: { fontSize: 15, fontFamily: 'Manrope_700Bold', color: '#ffffff' },
    rtglModeDesc: { fontSize: 13, lineHeight: 18, color: '#9aa3b2' },
    rtglOutlineBtn: {
      alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#2b3446',
      borderRadius: 16, padding: 15, marginTop: 6,
    },
    rtglOutlineBtnText: { fontSize: 15, fontFamily: 'Manrope_700Bold', color: '#ffffff' },
    rtglGoLiveBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      backgroundColor: '#f5138c', borderRadius: 16, padding: 16,
    },
    rtglGoLiveText: { color: '#fff', fontSize: 17, fontFamily: 'Manrope_700Bold' },
    // Review summary card
    summaryCard: {
      borderWidth: 1, borderRadius: 14, padding: 16, gap: 10,
    },
    summaryTopic: { fontSize: 17, fontFamily: 'Manrope_800ExtraBold', lineHeight: 22 },
    summaryMeta: { gap: 6 },
    summaryMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    summaryMetaText: { fontSize: 12.5, fontFamily: 'Manrope_600SemiBold' },
    // Empty state
    emptyCard: {
      borderWidth: 2, borderStyle: 'dashed', borderRadius: 20, padding: 32,
      alignItems: 'center', gap: 10, marginTop: 8,
    },
    emptyTitle: { fontSize: 16, fontFamily: 'Manrope_700Bold' },
    emptySub: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
    smallBtn: { borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10, marginTop: 4 },
    smallBtnText: { color: '#fff', fontSize: 14, fontFamily: 'Manrope_700Bold' },
    // Action cards
    actionCards: { gap: 10, marginTop: 4 },
    actionCard: {
      flexDirection: 'row', alignItems: 'center', gap: 14,
      borderWidth: 1, borderRadius: 16, padding: 16,
    },
    actionCardText: { flex: 1, gap: 2 },
    actionCardTitle: { fontSize: 15, fontFamily: 'Manrope_700Bold' },
    actionCardSub: { fontSize: 12.5, lineHeight: 17 },
    countRow: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      borderTopWidth: 1, paddingTop: 14, marginTop: 6,
    },
    countRowText: { fontSize: 13, fontFamily: 'Manrope_600SemiBold' },
    linkText: { fontSize: 14, fontFamily: 'Manrope_700Bold' },
    // Review question cards
    qCard: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      borderWidth: 1, borderRadius: 14, padding: 12,
    },
    qIndex: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
    qIndexText: { fontSize: 12, fontFamily: 'Manrope_700Bold' },
    qBody: { flex: 1, gap: 3 },
    qText: { fontSize: 14, fontFamily: 'Manrope_600SemiBold', lineHeight: 19 },
    qMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    qMetaText: { fontSize: 11.5 },
    qAction: { padding: 6 },
    liveBanner: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      borderWidth: 1, borderRadius: 12, padding: 14, marginTop: 8,
    },
    liveBannerDot: { width: 8, height: 8, borderRadius: 4 },
    liveBannerText: { fontSize: 13, fontFamily: 'Manrope_700Bold' },
  });

// Shared styles for sheets and small controls (theme-independent shapes)
const sh = StyleSheet.create({
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 12 },
  sheetHandle: { width: 40, height: 4, backgroundColor: '#444', borderRadius: 2, alignSelf: 'center', marginBottom: 8 },
  sheetTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sheetTitle: { fontSize: 20, fontFamily: 'Manrope_800ExtraBold' },
  sheetSub: { fontSize: 13, lineHeight: 20 },
  sheetBtn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  sheetBtnText: { color: '#fff', fontSize: 16, fontFamily: 'Manrope_700Bold' },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  secondaryLink: { alignItems: 'center', paddingVertical: 6 },
  secondaryLinkText: { fontSize: 14, fontFamily: 'Manrope_600SemiBold' },
  fieldLabel: { fontSize: 12, fontFamily: 'Manrope_600SemiBold', marginTop: 4 },
  textInput: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  errorText: { fontSize: 13 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  switchLabel: { fontSize: 14, fontFamily: 'Manrope_600SemiBold' },
  switchHint: { fontSize: 12 },
  resultBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderRadius: 12, padding: 14,
  },
  resultText: { flex: 1, fontSize: 14, fontFamily: 'Manrope_600SemiBold', lineHeight: 20 },
  // Difficulty chips
  diffRow: { flexDirection: 'row', gap: 8 },
  diffChip: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  diffChipText: { fontSize: 12.5, fontFamily: 'Manrope_600SemiBold', textAlign: 'center' },
  // Stepper
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepperBtn: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stepperValue: { fontSize: 18, fontFamily: 'Manrope_800ExtraBold', minWidth: 28, textAlign: 'center' },
  stepperHint: { fontSize: 12 },
  // Game picker
  gamePickerRow: { gap: 8, paddingVertical: 2 },
  gameChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    maxWidth: 240,
  },
  gameChipDot: { width: 6, height: 6, borderRadius: 3 },
  gameChipText: { fontSize: 14, fontFamily: 'Manrope_700Bold', flexShrink: 1 },
  gameChipCount: { fontSize: 11.5 },
  // OpenTDB categories (in sheet)
  catList: { maxHeight: 200, marginTop: 2 },
  catRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
  },
  catText: { fontSize: 14, fontFamily: 'Manrope_600SemiBold' },
});
