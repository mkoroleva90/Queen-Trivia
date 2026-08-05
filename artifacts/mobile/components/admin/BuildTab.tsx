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
} from '@workspace/api-client-react';
import type { Game, Question } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';

// ─── Constants ────────────────────────────────────────────────────────────────

type Step = 'setup' | 'questions' | 'review';
type Difficulty = 'easy' | 'medium' | 'hard';
type Source = 'ai' | 'opentdb';

type BuildPreload = { topic: string; difficulty: Difficulty };

type SetupResult =
  | { type: 'ai'; imported: number; discarded: number }
  | { type: 'opentdb'; imported: number };

const STEPS: { id: Step; label: string }[] = [
  { id: 'setup', label: 'Setup' },
  { id: 'questions', label: 'Questions' },
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
  easy: 'Easy (5 pts each)',
  medium: 'Medium (10 pts each)',
  hard: 'Hard (15 pts each)',
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
            {DIFF_LABELS[d]}
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
  /** Pre-fills the Setup step when the user arrives from "More options" in the quick-create sheet. */
  preload?: BuildPreload | null;
  /** Called once BuildTab has consumed the preload so the parent can clear it. */
  onClearPreload?: () => void;
};

export function BuildTab({ bottomPadding, preload, onClearPreload }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();

  const [step, setStep] = useState<Step>('setup');
  const [workingGameId, setWorkingGameId] = useState<number | null>(null);

  // ── Setup state
  const [source, setSource] = useState<Source>('ai');
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [brief, setBrief] = useState('');
  const [setupSkipFactCheck, setSetupSkipFactCheck] = useState(false);
  const [setupAmount, setSetupAmount] = useState(10);
  const [setupCategory, setSetupCategory] = useState<number>(9);
  const [setupError, setSetupError] = useState('');
  const [setupResult, setSetupResult] = useState<SetupResult | null>(null);

  // ── Questions state (for adding more after initial import)
  const [aiOpen, setAiOpen] = useState(false);
  const [aiAmount, setAiAmount] = useState(10);
  const [aiBrief, setAiBrief] = useState('');
  const [aiSkipFactCheck, setAiSkipFactCheck] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiResult, setAiResult] = useState<{ imported: number; discarded: number } | null>(null);

  const [tdbOpen, setTdbOpen] = useState(false);
  const [tdbCategory, setTdbCategory] = useState<number>(9);
  const [tdbDifficulty, setTdbDifficulty] = useState<Difficulty>('medium');
  const [tdbAmount, setTdbAmount] = useState(10);
  const [tdbError, setTdbError] = useState('');
  const [tdbResult, setTdbResult] = useState<number | null>(null);

  const [limitMsg, setLimitMsg] = useState<string | null>(null);

  // ── Preload: applied when arriving from "More options" in quick-create ────
  // Resets to the Setup step and populates topic + difficulty so the user
  // never has to retype anything. onClearPreload is called immediately so
  // the parent doesn't re-apply the same values if the tab remounts.
  const onClearPreloadRef = React.useRef(onClearPreload);
  React.useEffect(() => { onClearPreloadRef.current = onClearPreload; });
  React.useEffect(() => {
    if (!preload) return;
    setStep('setup');
    setTopic(preload.topic);
    setDifficulty(preload.difficulty);
    setSource('ai');
    setSetupResult(null);
    setSetupError('');
    setWorkingGameId(null);
    onClearPreloadRef.current?.();
  }, [preload]);

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

  // Derived: setup working state
  const setupWorking = createGame.isPending || generateGemini.isPending || importOpenTdb.isPending;
  const setupWorkingLabel = createGame.isPending
    ? 'Creating game…'
    : generateGemini.isPending
      ? (setupSkipFactCheck ? 'Generating… 10–15 s' : 'Generating & verifying… 15–30 s')
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

  const resetSetup = () => {
    setSetupResult(null);
    setTopic('');
    setBrief('');
    setSetupError('');
    setSetupSkipFactCheck(false);
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
          brief: brief.trim() || null,
          skipFactCheck: setupSkipFactCheck,
        },
      });
      invalidate(game.id);
      setWorkingGameId(game.id);
      setSetupResult({ type: 'ai', imported: result.imported, discarded: result.discarded ?? 0 });
    } catch (err) {
      const msg = extractApiError(err, 'Failed to create game — please retry');
      if (msg.includes('Free plan') || msg.includes('games allowed this month')) {
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
      setSetupResult({ type: 'opentdb', imported: result.imported });
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
          brief: aiBrief.trim() || null,
          skipFactCheck: aiSkipFactCheck,
        },
      });
      invalidate(selectedGame.id);
      setAiResult({ imported: result.imported, discarded: result.discarded ?? 0 });
    } catch (err) {
      const msg = extractApiError(err, 'Generation failed — try again or add questions manually');
      if (msg.includes('Free plan')) {
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

  const handlePublish = async () => {
    if (!selectedGame) return;
    try {
      await updateGame.mutateAsync({ gameId: selectedGame.id, data: { status: 'active' } });
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
            {setupResult ? (
              /* ── Success state ── */
              <View style={s.successContainer}>
                <View style={[s.successCard, { backgroundColor: colors.secondary + '12', borderColor: colors.secondary + '40' }]}>
                  <Ionicons name="checkmark-circle" size={24} color={colors.secondary} />
                  <View style={{ flex: 1, gap: 3 }}>
                    {setupResult.type === 'ai' ? (
                      <>
                        <Text style={[s.successTitle, { color: colors.foreground }]}>
                          {setupResult.imported} question{setupResult.imported === 1 ? '' : 's'} generated
                        </Text>
                        {setupResult.discarded > 0 && (
                          <Text style={[s.successSub, { color: colors.mutedForeground }]}>
                            {setupResult.discarded} discarded by fact-check
                          </Text>
                        )}
                        <Text style={[s.successSub, { color: colors.mutedForeground }]}>
                          Marked as AI-generated — review before going live.
                        </Text>
                      </>
                    ) : (
                      <>
                        <Text style={[s.successTitle, { color: colors.foreground }]}>
                          {setupResult.imported} question{setupResult.imported === 1 ? '' : 's'} imported
                        </Text>
                        <Text style={[s.successSub, { color: colors.mutedForeground }]}>
                          From Open Trivia Database — community-verified.
                        </Text>
                      </>
                    )}
                  </View>
                </View>

                <Pressable
                  style={[s.primaryBtn, { backgroundColor: colors.primary }]}
                  onPress={() => setStep('questions')}
                >
                  <Text style={s.primaryBtnText}>See questions</Text>
                  <Ionicons name="arrow-forward" size={16} color="#fff" />
                </Pressable>

                <Pressable style={s.secondaryLink} onPress={resetSetup}>
                  <Text style={[s.secondaryLinkText, { color: colors.mutedForeground }]}>
                    Create another game
                  </Text>
                </Pressable>
              </View>
            ) : (
              /* ── Setup form ── */
              <>
                <Text style={[s.heading, { color: colors.foreground }]}>Create a new game</Text>
                <Text style={[s.sub, { color: colors.mutedForeground }]}>
                  Choose where questions come from, then we'll build the set for you.
                </Text>

                {/* Source picker */}
                <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Question source</Text>
                <View style={s.sourcePicker}>
                  <Pressable
                    style={[s.sourcePill, {
                      borderColor: source === 'ai' ? AI_COLOR : colors.border,
                      backgroundColor: source === 'ai' ? AI_COLOR + '18' : colors.card,
                    }]}
                    onPress={() => setSource('ai')}
                  >
                    <Ionicons name="sparkles" size={16} color={source === 'ai' ? AI_COLOR : colors.mutedForeground} />
                    <Text style={[s.sourcePillText, { color: source === 'ai' ? AI_COLOR : colors.mutedForeground }]}>
                      Gemini AI
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[s.sourcePill, {
                      borderColor: source === 'opentdb' ? colors.primary : colors.border,
                      backgroundColor: source === 'opentdb' ? colors.primary + '18' : colors.card,
                    }]}
                    onPress={() => setSource('opentdb')}
                  >
                    <Ionicons name="cloud-download-outline" size={16} color={source === 'opentdb' ? colors.primary : colors.mutedForeground} />
                    <Text style={[s.sourcePillText, { color: source === 'opentdb' ? colors.primary : colors.mutedForeground }]} numberOfLines={1}>
                      Open Trivia Database
                    </Text>
                  </Pressable>
                </View>

                {/* ── AI-specific fields ── */}
                {source === 'ai' && (
                  <>
                    <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Topic</Text>
                    <TextInput
                      style={[s.textInput, {
                        backgroundColor: colors.card, color: colors.foreground,
                        borderColor: setupError ? colors.destructive : colors.border,
                      }]}
                      value={topic}
                      onChangeText={(t) => { setTopic(t); setSetupError(''); }}
                      placeholder="e.g. Harry Potter, The Office, 80s Music, Local History…"
                      placeholderTextColor={colors.mutedForeground}
                    />
                    <Text style={[s.helperText, { color: colors.mutedForeground }]}>
                      Gemini AI generates questions on this topic.
                    </Text>

                    <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>
                      Brief <Text style={[s.fieldLabelOpt, { color: colors.mutedForeground }]}>(optional)</Text>
                    </Text>
                    <TextInput
                      style={[s.textInput, s.textArea, {
                        backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border,
                      }]}
                      value={brief}
                      onChangeText={setBrief}
                      placeholder="e.g. Focus on the 1990s. Skip obvious questions. No chart positions."
                      placeholderTextColor={colors.mutedForeground}
                      multiline
                    />

                    <View style={s.switchRow}>
                      <Switch
                        value={setupSkipFactCheck}
                        onValueChange={setSetupSkipFactCheck}
                        trackColor={{ true: AI_COLOR }}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={[s.switchLabel, { color: colors.foreground }]}>Skip fact-check</Text>
                        <Text style={[s.switchHint, { color: colors.mutedForeground }]}>
                          For fiction or family topics — faster, less accurate
                        </Text>
                      </View>
                    </View>
                  </>
                )}

                {/* ── OpenTDB-specific fields ── */}
                {source === 'opentdb' && (
                  <>
                    <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Category</Text>
                    <View style={[s.catList, { borderColor: colors.border, backgroundColor: colors.card }]}>
                      {OPENTDB_CATEGORIES.map((c) => {
                        const active = c.id === setupCategory;
                        return (
                          <Pressable
                            key={c.id}
                            style={[s.catRow, active && { backgroundColor: colors.primary + '18' }]}
                            onPress={() => setSetupCategory(c.id)}
                          >
                            <Text style={[s.catText, { color: active ? colors.primary : colors.foreground }]}>
                              {c.name}
                            </Text>
                            {active && <Ionicons name="checkmark" size={16} color={colors.primary} />}
                          </Pressable>
                        );
                      })}
                    </View>
                  </>
                )}

                {/* ── Shared: Difficulty + Amount ── */}
                <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Difficulty</Text>
                <DifficultyChips value={difficulty} onChange={setDifficulty} colors={colors} />

                <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>
                  Questions to {source === 'ai' ? 'generate' : 'import'}
                </Text>
                <AmountStepper value={setupAmount} onChange={setSetupAmount} colors={colors} />

                {/* Info callout */}
                <View style={[s.callout, {
                  borderColor: source === 'ai' ? AI_COLOR + '40' : colors.primary + '30',
                  backgroundColor: source === 'ai' ? AI_COLOR + '08' : colors.primary + '08',
                }]}>
                  <Ionicons
                    name={source === 'ai' ? 'bulb-outline' : 'server-outline'}
                    size={16}
                    color={source === 'ai' ? AI_COLOR : colors.primary}
                    style={{ marginTop: 1 }}
                  />
                  <View style={{ flex: 1, gap: 2 }}>
                    {source === 'ai' ? (
                      <>
                        <Text style={[s.calloutTitle, { color: source === 'ai' ? AI_COLOR : colors.primary }]}>
                          AI-generated questions
                        </Text>
                        <Text style={[s.calloutBody, { color: colors.mutedForeground }]}>
                          Questions will be marked as AI-generated and unverified. Review them in the Review step before going live.
                        </Text>
                      </>
                    ) : (
                      <>
                        <Text style={[s.calloutTitle, { color: colors.primary }]}>
                          Auto-import from Open Trivia Database
                        </Text>
                        <Text style={[s.calloutBody, { color: colors.mutedForeground }]}>
                          {setupAmount} {difficulty} question{setupAmount === 1 ? '' : 's'} about{' '}
                          <Text style={{ color: colors.foreground, fontFamily: 'Manrope_600SemiBold' }}>
                            {selectedCategory?.name}
                          </Text>{' '}
                          will be fetched from the free, community-verified database.
                        </Text>
                      </>
                    )}
                  </View>
                </View>

                {!!setupError && (
                  <Text style={[s.errorText, { color: colors.destructive }]}>{setupError}</Text>
                )}

                <Pressable
                  style={[s.primaryBtn, {
                    backgroundColor: source === 'ai' ? AI_COLOR : colors.primary,
                    opacity: setupWorking ? 0.75 : 1,
                  }]}
                  onPress={source === 'ai' ? handleCreateAI : handleCreateOpenTdb}
                  disabled={setupWorking}
                >
                  {setupWorking ? (
                    <View style={s.btnRow}>
                      <ActivityIndicator color="#fff" />
                      <Text style={s.primaryBtnText}>{setupWorkingLabel}</Text>
                    </View>
                  ) : source === 'ai' ? (
                    <View style={s.btnRow}>
                      <Ionicons name="sparkles" size={16} color="#fff" />
                      <Text style={s.primaryBtnText}>Create &amp; generate with Gemini</Text>
                    </View>
                  ) : (
                    <View style={s.btnRow}>
                      <Ionicons name="cloud-download-outline" size={16} color="#fff" />
                      <Text style={s.primaryBtnText}>Create &amp; import from Open Trivia Database</Text>
                    </View>
                  )}
                </Pressable>
              </>
            )}
          </View>
        )}

        {/* ── QUESTIONS ── */}
        {step === 'questions' && (
          <View style={s.section}>
            <Text style={[s.heading, { color: colors.foreground }]}>Add questions</Text>
            {editableGames.length === 0 ? (
              <View style={[s.emptyCard, { borderColor: colors.border }]}>
                <Ionicons name="game-controller-outline" size={36} color={colors.mutedForeground} />
                <Text style={[s.emptyTitle, { color: colors.foreground }]}>No editable games</Text>
                <Text style={[s.emptySub, { color: colors.mutedForeground }]}>
                  Create a game in the Setup step first. Completed games are locked.
                </Text>
                <Pressable style={[s.smallBtn, { backgroundColor: colors.primary }]} onPress={() => setStep('setup')}>
                  <Text style={s.smallBtnText}>Go to Setup</Text>
                </Pressable>
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

                {selectedGame && (
                  <View style={s.actionCards}>
                    {/* AI generation */}
                    <Pressable
                      style={[s.actionCard, { borderColor: AI_COLOR + '44', backgroundColor: AI_COLOR + '12' }]}
                      onPress={() => { setAiResult(null); setAiError(''); setAiOpen(true); }}
                    >
                      <Ionicons name="sparkles" size={22} color={AI_COLOR} />
                      <View style={s.actionCardText}>
                        <Text style={[s.actionCardTitle, { color: colors.foreground }]}>Generate with AI</Text>
                        <Text style={[s.actionCardSub, { color: colors.mutedForeground }]}>
                          Gemini writes fact-checked questions on "{selectedGame.topic}"
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
                    </Pressable>

                    {/* OpenTDB import */}
                    <Pressable
                      style={[s.actionCard, { borderColor: colors.primary + '44', backgroundColor: colors.primary + '12' }]}
                      onPress={() => { setTdbResult(null); setTdbError(''); setTdbOpen(true); }}
                    >
                      <Ionicons name="cloud-download-outline" size={22} color={colors.primary} />
                      <View style={s.actionCardText}>
                        <Text style={[s.actionCardTitle, { color: colors.foreground }]}>Import from Open Trivia Database</Text>
                        <Text style={[s.actionCardSub, { color: colors.mutedForeground }]}>
                          Pull community-verified questions by category
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
                    </Pressable>

                    {/* Manual entry */}
                    <Pressable
                      style={[s.actionCard, { borderColor: colors.border, backgroundColor: colors.card }]}
                      onPress={() => router.push(`/admin/${selectedGame.id}`)}
                    >
                      <Ionicons name="create-outline" size={22} color={colors.foreground} />
                      <View style={s.actionCardText}>
                        <Text style={[s.actionCardTitle, { color: colors.foreground }]}>Add manually</Text>
                        <Text style={[s.actionCardSub, { color: colors.mutedForeground }]}>
                          Write your own — all 10 question types supported
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
                    </Pressable>
                  </View>
                )}

                {selectedGame && (
                  <View style={[s.countRow, { borderColor: colors.border }]}>
                    <Ionicons name="help-circle-outline" size={16} color={colors.mutedForeground} />
                    <Text style={[s.countRowText, { color: colors.mutedForeground }]}>
                      {questions.length} {questions.length === 1 ? 'question' : 'questions'} so far
                    </Text>
                    <View style={{ flex: 1 }} />
                    <Pressable onPress={() => setStep('review')} hitSlop={8}>
                      <Text style={[s.linkText, { color: colors.primary }]}>Review →</Text>
                    </Pressable>
                  </View>
                )}
              </>
            )}
          </View>
        )}

        {/* ── REVIEW ── */}
        {step === 'review' && (
          <View style={s.section}>
            <Text style={[s.heading, { color: colors.foreground }]}>Review questions</Text>
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
                      No questions yet — add some in the Questions step.
                    </Text>
                    <Pressable style={[s.smallBtn, { backgroundColor: colors.primary }]} onPress={() => setStep('questions')}>
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
                      {aiResult.imported} question{aiResult.imported === 1 ? '' : 's'} saved
                      {aiResult.discarded > 0 ? ` · ${aiResult.discarded} discarded by fact-check` : ''}
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

                  <View style={sh.switchRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[sh.switchLabel, { color: colors.foreground }]}>Skip fact-check</Text>
                      <Text style={[sh.switchHint, { color: colors.mutedForeground }]}>Faster, but less accurate</Text>
                    </View>
                    <Switch
                      value={aiSkipFactCheck}
                      onValueChange={setAiSkipFactCheck}
                      trackColor={{ true: AI_COLOR }}
                    />
                  </View>

                  {!!aiError && <Text style={[sh.errorText, { color: colors.destructive }]}>{aiError}</Text>}

                  <Pressable
                    style={[sh.sheetBtn, { backgroundColor: AI_COLOR, opacity: generateGemini.isPending ? 0.7 : 1 }]}
                    onPress={handleGenerateAi}
                    disabled={generateGemini.isPending}
                  >
                    {generateGemini.isPending ? (
                      <View style={sh.btnRow}>
                        <ActivityIndicator color="#fff" />
                        <Text style={sh.sheetBtnText}>
                          {aiSkipFactCheck ? 'Generating… 10–15 s' : 'Generating & verifying… 15–30 s'}
                        </Text>
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
              <Text style={[sh.sheetTitle, { color: colors.foreground }]}>Plan limit reached</Text>
            </View>
            <Text style={[sh.sheetSub, { color: colors.mutedForeground }]}>{limitMsg}</Text>
            <Pressable style={[sh.sheetBtn, { backgroundColor: colors.primary }]} onPress={() => setLimitMsg(null)}>
              <Text style={sh.sheetBtnText}>Got it</Text>
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
    sub: { fontSize: 13, lineHeight: 19, marginTop: -6 },
    helperText: { fontSize: 11.5, lineHeight: 16, marginTop: -6 },
    fieldLabel: { fontSize: 12, fontFamily: 'Manrope_600SemiBold', marginTop: 6 },
    fieldLabelOpt: { fontSize: 12, fontFamily: 'Manrope_400Regular' },
    textInput: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
    textArea: { minHeight: 80, textAlignVertical: 'top' },
    errorText: { fontSize: 13 },
    // Source picker
    sourcePicker: { flexDirection: 'row', gap: 8 },
    sourcePill: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 6, borderWidth: 1.5, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 10,
    },
    sourcePillText: { fontSize: 13, fontFamily: 'Manrope_700Bold', flexShrink: 1 },
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
    calloutTitle: { fontSize: 13, fontFamily: 'Manrope_700Bold', marginBottom: 2 },
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
  diffChipText: { fontSize: 12.5, fontFamily: 'Manrope_600SemiBold' },
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
