import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';
import type { RenderItemParams } from 'react-native-draggable-flatlist';
import * as SecureStore from 'expo-secure-store';
import {
  useListGames,
  getListGamesQueryKey,
  useListGameQuestions,
  getListGameQuestionsQueryKey,
  useCreateQuestion,
  useUpdateQuestion,
  useDeleteQuestion,
  useUpdateGame,
  useGenerateGeminiQuestions,
  useRegenerateQuestion,
  useEnhanceQuestion,
  useFactCheckQuestion,
  useImportOpenTdbQuestions,
} from '@workspace/api-client-react';
import type {
  Question,
  EnhanceQuestionResult,
  FactCheckSingleResult,
  RegenerateQuestionPreview,
} from '@workspace/api-client-react';
import { ADMIN_TOKEN_KEY } from '@/context/AdminAuthContext';
import { useColors } from '@/hooks/useColors';
import { API_BASE_URL } from '@/lib/apiBase';
import { COPY } from '@workspace/copy';

// ─── Types ────────────────────────────────────────────────────────────────────

type QType =
  | 'multiple_choice' | 'multi_select' | 'true_false'
  | 'write_in' | 'short_response'
  | 'ordering' | 'slider'
  | 'image_recognition' | 'image_hotspot'
  | 'matching';

type QForm = {
  questionText: string;
  questionType: QType;
  points: string;
  choices: string[];
  correctAnswer: string;
  correctChoices: string[];
  tfAnswer: 'true' | 'false';
  alternateAnswers: string;
  orderedItems: string[];
  sliderMin: string;
  sliderMax: string;
  sliderCorrect: string;
  imageUrl: string;
  hotspotX: string;
  hotspotY: string;
  pairs: { left: string; right: string }[];
  source: string;
};

const DEFAULT_POINTS: Record<QType, number> = {
  multiple_choice: 10, multi_select: 10, true_false: 5,
  write_in: 15, short_response: 10, ordering: 15, slider: 10,
  image_recognition: 15, image_hotspot: 15, matching: 20,
};

const TYPE_LABELS: Record<QType, string> = {
  multiple_choice: 'Multiple Choice', multi_select: 'Multi-Select',
  true_false: 'True / False', write_in: 'Write-In',
  short_response: 'Short Response', ordering: 'Ordering',
  slider: 'Slider', image_recognition: 'Image', image_hotspot: 'Image Hotspot',
  matching: 'Matching',
};

const TYPE_ICONS: Record<QType, string> = {
  multiple_choice: 'checkmark-circle', multi_select: 'checkbox',
  true_false: 'toggle', write_in: 'pencil', short_response: 'chatbubble',
  ordering: 'list', slider: 'options', image_recognition: 'image',
  image_hotspot: 'locate', matching: 'git-compare-outline',
};

const ALL_TYPES: QType[] = [
  'multiple_choice', 'multi_select', 'true_false',
  'write_in', 'short_response', 'ordering', 'slider',
  'image_recognition', 'image_hotspot', 'matching',
];

function emptyForm(type: QType = 'multiple_choice'): QForm {
  return {
    questionText: '', questionType: type,
    points: String(DEFAULT_POINTS[type]),
    choices: ['', '', '', ''], correctAnswer: '', correctChoices: [],
    tfAnswer: 'true', alternateAnswers: '',
    orderedItems: ['', '', '', ''],
    sliderMin: '0', sliderMax: '100', sliderCorrect: '50',
    imageUrl: '', hotspotX: '0.5', hotspotY: '0.5',
    pairs: [{ left: '', right: '' }, { left: '', right: '' }, { left: '', right: '' }],
    source: '',
  };
}

function formFromQuestion(q: Question): QForm {
  const opts = q.options as {
    choices?: string[]; pairs?: { left: string; right: string }[];
    alternateAnswers?: string[]; min?: number; max?: number;
  } | null;
  const type = q.questionType as QType;
  const ca = q.correctAnswer ?? '';

  let hotspotX = '0.5'; let hotspotY = '0.5';
  if (type === 'image_hotspot') {
    const parts = ca.split(',').map(Number);
    hotspotX = String((isNaN(parts[0]!) ? 50 : parts[0]!) / 100);
    hotspotY = String((isNaN(parts[1]!) ? 50 : parts[1]!) / 100);
  }

  const optsWithItems = opts as typeof opts & { items?: string[] };

  return {
    questionText: q.questionText,
    questionType: type,
    points: String(q.points),
    choices: opts?.choices?.length ? [...opts.choices, '', ''] : ['', '', '', ''],
    correctAnswer: type === 'matching' || type === 'multi_select' || type === 'image_hotspot' ? '' : ca,
    correctChoices: type === 'multi_select' ? ca.split('|').filter(Boolean) : [],
    tfAnswer: ca === 'false' ? 'false' : 'true',
    alternateAnswers: opts?.alternateAnswers?.join(', ') ?? '',
    orderedItems: type === 'ordering' ? (optsWithItems?.items ?? []) : ['', '', '', ''],
    sliderMin: String(opts?.min ?? 0),
    sliderMax: String(opts?.max ?? 100),
    sliderCorrect: type === 'slider' ? ca : '50',
    imageUrl: q.imageUrl ?? '',
    hotspotX,
    hotspotY,
    pairs: opts?.pairs?.length ? [...opts.pairs, { left: '', right: '' }] : [
      { left: '', right: '' }, { left: '', right: '' }, { left: '', right: '' },
    ],
    source: q.source ?? '',
  };
}

function buildPayload(form: QForm, orderIndex: number) {
  const points = Math.max(1, parseInt(form.points) || DEFAULT_POINTS[form.questionType]);
  const base = {
    questionText: form.questionText.trim(),
    questionType: form.questionType,
    points,
    orderIndex,
    source: form.source.trim() || null,
    factCheckUrl: null as string | null,
    imageUrl: null as string | null,
  };

  switch (form.questionType) {
    case 'multiple_choice': {
      const choices = form.choices.map((c) => c.trim()).filter(Boolean);
      return { ...base, options: { choices }, correctAnswer: form.correctAnswer };
    }
    case 'multi_select': {
      const choices = form.choices.map((c) => c.trim()).filter(Boolean);
      const correct = form.correctChoices.filter((c) => choices.includes(c));
      return { ...base, options: { choices }, correctAnswer: correct.join('|') };
    }
    case 'true_false':
      return { ...base, options: null, correctAnswer: form.tfAnswer };
    case 'ordering': {
      const items = form.orderedItems.map((i) => i.trim()).filter(Boolean);
      return { ...base, options: { items }, correctAnswer: items.join('|') };
    }
    case 'slider':
      return {
        ...base,
        options: { min: Number(form.sliderMin), max: Number(form.sliderMax) },
        correctAnswer: form.sliderCorrect,
      };
    case 'matching': {
      const pairs = form.pairs
        .filter((p) => p.left.trim() && p.right.trim())
        .map((p) => ({ left: p.left.trim(), right: p.right.trim() }));
      const correctAnswer = pairs
        .map((p) => `${p.left}:${p.right}`)
        .sort((a, b) => a.localeCompare(b))
        .join('|');
      return { ...base, options: { pairs }, correctAnswer };
    }
    case 'image_hotspot': {
      const hx = (parseFloat(form.hotspotX) * 100).toFixed(1);
      const hy = (parseFloat(form.hotspotY) * 100).toFixed(1);
      return {
        ...base,
        imageUrl: form.imageUrl.trim() || null,
        options: null,
        correctAnswer: `${hx},${hy}`,
      };
    }
    case 'image_recognition': {
      const alts = form.alternateAnswers.split(',').map((s) => s.trim()).filter(Boolean);
      return {
        ...base,
        imageUrl: form.imageUrl.trim() || null,
        options: alts.length ? { alternateAnswers: alts } : null,
        correctAnswer: form.correctAnswer.trim(),
      };
    }
    default: {
      const alts = form.alternateAnswers.split(',').map((s) => s.trim()).filter(Boolean);
      return {
        ...base,
        options: alts.length ? { alternateAnswers: alts } : null,
        correctAnswer: form.correctAnswer.trim(),
      };
    }
  }
}

function validateForm(form: QForm): string | null {
  if (!form.questionText.trim()) return 'Question text is required';
  switch (form.questionType) {
    case 'multiple_choice': {
      const choices = form.choices.map((c) => c.trim()).filter(Boolean);
      if (choices.length < 2) return 'Add at least two choices';
      if (!form.correctAnswer) return 'Select the correct answer';
      if (!choices.includes(form.correctAnswer)) return 'Correct answer must be one of the choices';
      break;
    }
    case 'multi_select': {
      const choices = form.choices.map((c) => c.trim()).filter(Boolean);
      if (choices.length < 2) return 'Add at least two choices';
      if (form.correctChoices.length === 0) return 'Select at least one correct answer';
      break;
    }
    case 'ordering': {
      const items = form.orderedItems.map((i) => i.trim()).filter(Boolean);
      if (items.length < 2) return 'Add at least two items';
      break;
    }
    case 'slider': {
      const min = Number(form.sliderMin); const max = Number(form.sliderMax);
      const correct = Number(form.sliderCorrect);
      if (isNaN(min) || isNaN(max) || min >= max) return 'Min must be less than Max';
      if (isNaN(correct) || correct < min || correct > max) return 'Correct value must be between min and max';
      break;
    }
    case 'matching': {
      const pairs = form.pairs.filter((p) => p.left.trim() && p.right.trim());
      if (pairs.length < 2) return 'Add at least two complete pairs';
      break;
    }
    case 'image_hotspot':
    case 'image_recognition':
      if (!form.imageUrl.trim()) return 'Image URL is required';
      if (form.questionType === 'image_recognition' && !form.correctAnswer.trim()) return 'Correct answer is required';
      break;
    case 'true_false':
      break;
    default:
      if (!form.correctAnswer.trim()) return 'Correct answer is required';
  }
  return null;
}

// ─── Preview fill: map API response to QForm ─────────────────────────────────

type PreviewResponse = {
  questionType: string;
  questionText: string;
  correctAnswer: string;
  options?: { choices?: string[] } | null;
  points: number;
  source?: string | null;
};

function previewToForm(p: PreviewResponse): QForm {
  const type = (ALL_TYPES.includes(p.questionType as QType) ? p.questionType : 'multiple_choice') as QType;
  const base = emptyForm(type);
  base.questionText = p.questionText;
  base.points = String(p.points);
  base.source = p.source ?? '';
  const choices = p.options?.choices ?? [];
  if (type === 'multiple_choice') {
    base.choices = choices.length ? choices : ['', '', '', ''];
    base.correctAnswer = p.correctAnswer;
  } else if (type === 'true_false') {
    base.tfAnswer = p.correctAnswer === 'false' ? 'false' : 'true';
  } else {
    base.correctAnswer = p.correctAnswer;
  }
  return base;
}

// ─── OpenTDB categories ───────────────────────────────────────────────────────

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

// ─── HotspotPicker ────────────────────────────────────────────────────────────

function HotspotPicker({ imageUrl, x, y, onChange, colors }: {
  imageUrl: string; x: number; y: number;
  onChange: (x: number, y: number) => void;
  colors: ReturnType<typeof useColors>;
}) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  return (
    <View
      style={{ borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      <Pressable
        onPress={(e) => {
          if (size.w && size.h) {
            const px = e.nativeEvent.locationX / size.w;
            const py = e.nativeEvent.locationY / size.h;
            onChange(Math.min(1, Math.max(0, px)), Math.min(1, Math.max(0, py)));
          }
        }}
      >
        <Image source={{ uri: imageUrl }} style={{ width: '100%', aspectRatio: 16 / 9 }} resizeMode="cover" />
        {size.w > 0 && (
          <View pointerEvents="none" style={[StyleSheet.absoluteFill]}>
            <View style={{
              position: 'absolute',
              left: x * size.w - 12, top: y * size.h - 12,
              width: 24, height: 24, borderRadius: 12,
              backgroundColor: colors.primary + 'cc',
              borderWidth: 2, borderColor: '#fff',
            }} />
          </View>
        )}
      </Pressable>
    </View>
  );
}

// ─── QuestionFormModal ────────────────────────────────────────────────────────

function QuestionFormModal({
  visible,
  initial,
  onClose,
  onSave,
  pending,
  title,
  gameId,
  gameTopic,
}: {
  visible: boolean;
  initial: QForm;
  onClose: () => void;
  onSave: (form: QForm) => void;
  pending: boolean;
  title: string;
  gameId: number;
  gameTopic?: string;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState<QForm>(initial);
  const [error, setError] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [upgradeLimitMsg, setUpgradeLimitMsg] = useState('');

  const baseUrl = API_BASE_URL;

  React.useEffect(() => {
    if (visible) { setForm(initial); setError(''); }
  }, [visible, initial]);

  const set = useCallback(<K extends keyof QForm>(k: K, v: QForm[K]) =>
    setForm((f) => ({ ...f, [k]: v })), []);

  const handleSave = () => {
    const err = validateForm(form);
    if (err) { setError(err); return; }
    onSave(form);
  };

  const handleFillWithAI = async () => {
    setAiLoading(true);
    setError('');
    try {
      const token = await SecureStore.getItemAsync(ADMIN_TOKEN_KEY).catch(() => null);
      const validTypes = ['multiple_choice', 'true_false', 'write_in'];
      const qType = validTypes.includes(form.questionType) ? form.questionType : 'multiple_choice';
      const r = await fetch(`${baseUrl}/api/games/${gameId}/questions/generate-preview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ questionType: qType }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `HTTP ${r.status}`);
      }
      const preview = await r.json() as PreviewResponse;
      setForm(previewToForm(preview));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'AI generation failed — try again';
      if (msg.includes('Free plan limit reached')) {
        setUpgradeLimitMsg(msg);
      } else {
        setError(msg);
      }
    } finally {
      setAiLoading(false);
    }
  };

  const s = fStyles(colors);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView
        style={[s.modal, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Modal header */}
        <View style={[s.mHeader, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={[s.cancelBtn, { color: colors.mutedForeground }]}>Cancel</Text>
          </Pressable>
          <Text style={[s.mTitle, { color: colors.foreground }]}>{title}</Text>
          <Pressable onPress={handleSave} disabled={pending} hitSlop={12}>
            {pending ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Text style={[s.saveBtn, { color: colors.primary }]}>Save</Text>
            )}
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={s.mBody} keyboardShouldPersistTaps="handled">
          {/* Type selector */}
          <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Question type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.typeScroll}>
            {ALL_TYPES.map((t) => (
              <Pressable
                key={t}
                onPress={() => set('questionType', t)}
                style={[
                  s.typeChip,
                  {
                    borderColor: form.questionType === t ? colors.primary : colors.border,
                    backgroundColor: form.questionType === t ? colors.primary + '22' : 'transparent',
                  },
                ]}
              >
                <Ionicons
                  name={TYPE_ICONS[t] as 'checkmark-circle'}
                  size={14}
                  color={form.questionType === t ? colors.primary : colors.mutedForeground}
                />
                <Text style={[s.typeChipText, { color: form.questionType === t ? colors.primary : colors.muted }]}>
                  {TYPE_LABELS[t]}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* AI Fill button */}
          <Pressable
            onPress={handleFillWithAI}
            disabled={aiLoading || pending}
            style={[s.aiFillBtn, { borderColor: '#a855f7' + '44', backgroundColor: '#a855f7' + '12' }]}
          >
            {aiLoading ? (
              <ActivityIndicator size="small" color="#a855f7" />
            ) : (
              <Ionicons name="sparkles" size={15} color="#a855f7" />
            )}
            <Text style={[s.aiFillText, { color: '#a855f7' }]}>
              {aiLoading ? 'Generating…' : `Fill with AI${gameTopic ? ` (${gameTopic})` : ''}`}
            </Text>
          </Pressable>

          {/* Free-tier upgrade banner */}
          {!!upgradeLimitMsg && (
            <View style={{ borderRadius: 12, borderWidth: 1, borderColor: '#facc1540', backgroundColor: '#facc1508', padding: 14, gap: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="star" size={16} color="#facc15" />
                <Text style={{ color: '#fcd34d', fontSize: 14, fontFamily: 'Manrope_700Bold' }}>Plan Limit Reached</Text>
              </View>
              <Text style={{ color: '#fcd34d', fontSize: 12, lineHeight: 18 }}>{upgradeLimitMsg}</Text>
              <Text style={{ color: '#fcd34d', fontSize: 12, lineHeight: 18 }}>
                Ask your app administrator to upgrade this account to Pro.
              </Text>
              <Pressable onPress={() => setUpgradeLimitMsg('')} hitSlop={8}>
                <Text style={{ color: '#fcd34d', fontSize: 12, textDecorationLine: 'underline' }}>Dismiss</Text>
              </Pressable>
            </View>
          )}

          {/* Question text */}
          <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Question</Text>
          <TextInput
            style={[s.textArea, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]}
            value={form.questionText}
            onChangeText={(v) => set('questionText', v)}
            placeholder="Type the question players will see..."
            placeholderTextColor={colors.mutedForeground}
            multiline
            numberOfLines={3}
          />

          {/* Multiple Choice / Multi-Select */}
          {(form.questionType === 'multiple_choice' || form.questionType === 'multi_select') && (
            <>
              <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Choices (tap to mark correct)</Text>
              {form.choices.map((choice, i) => {
                const isCorrect = form.questionType === 'multi_select'
                  ? form.correctChoices.includes(choice.trim())
                  : form.correctAnswer === choice.trim() && !!choice.trim();
                return (
                  <View key={i} style={s.choiceRow}>
                    <Pressable
                      onPress={() => {
                        const trimmed = choice.trim();
                        if (!trimmed) return;
                        if (form.questionType === 'multi_select') {
                          const next = isCorrect
                            ? form.correctChoices.filter((c) => c !== trimmed)
                            : [...form.correctChoices, trimmed];
                          set('correctChoices', next);
                        } else {
                          set('correctAnswer', isCorrect ? '' : trimmed);
                        }
                      }}
                      style={[
                        s.choiceBtn,
                        { borderColor: isCorrect ? colors.secondary : colors.border, backgroundColor: isCorrect ? colors.secondary + '22' : 'transparent' },
                      ]}
                    >
                      <Text style={[s.choiceLetter, { color: isCorrect ? colors.secondary : colors.muted }]}>
                        {String.fromCharCode(65 + i)}
                      </Text>
                    </Pressable>
                    <TextInput
                      style={[s.choiceInput, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]}
                      value={choice}
                      onChangeText={(v) => {
                        const next = [...form.choices];
                        const old = choice.trim();
                        next[i] = v;
                        setForm((f) => {
                          const updates: Partial<QForm> = { choices: next };
                          if (f.correctAnswer === old) updates.correctAnswer = v.trim();
                          if (f.correctChoices.includes(old)) {
                            updates.correctChoices = f.correctChoices.map((c) => (c === old ? v.trim() : c));
                          }
                          return { ...f, ...updates };
                        });
                      }}
                      placeholder={`Choice ${String.fromCharCode(65 + i)}`}
                      placeholderTextColor={colors.mutedForeground}
                    />
                    {form.choices.length > 2 && (
                      <Pressable onPress={() => set('choices', form.choices.filter((_, j) => j !== i))} hitSlop={8}>
                        <Ionicons name="close-circle" size={18} color={colors.mutedForeground} />
                      </Pressable>
                    )}
                  </View>
                );
              })}
              {form.choices.length < 6 && (
                <Pressable style={[s.addItemBtn, { borderColor: colors.border }]} onPress={() => set('choices', [...form.choices, ''])}>
                  <Ionicons name="add" size={16} color={colors.primary} />
                  <Text style={[s.addItemText, { color: colors.primary }]}>Add choice</Text>
                </Pressable>
              )}
            </>
          )}

          {/* True / False */}
          {form.questionType === 'true_false' && (
            <>
              <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Correct answer</Text>
              <View style={s.tfRow}>
                {(['true', 'false'] as const).map((v) => (
                  <Pressable
                    key={v}
                    style={[
                      s.tfBtn,
                      {
                        borderColor: form.tfAnswer === v ? colors.secondary : colors.border,
                        backgroundColor: form.tfAnswer === v ? colors.secondary + '22' : 'transparent',
                      },
                    ]}
                    onPress={() => set('tfAnswer', v)}
                  >
                    <Text style={[s.tfBtnText, { color: form.tfAnswer === v ? colors.secondary : colors.muted }]}>
                      {v === 'true' ? 'TRUE ✓' : 'FALSE ✗'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}

          {/* Write-in / Short Response */}
          {(form.questionType === 'write_in' || form.questionType === 'short_response') && (
            <>
              <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Correct answer</Text>
              <TextInput
                style={[s.input, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]}
                value={form.correctAnswer}
                onChangeText={(v) => set('correctAnswer', v)}
                placeholder="The exact correct answer"
                placeholderTextColor={colors.mutedForeground}
              />
              <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Alternate answers (comma-separated)</Text>
              <TextInput
                style={[s.input, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]}
                value={form.alternateAnswers}
                onChangeText={(v) => set('alternateAnswers', v)}
                placeholder="e.g. NYC, The Big Apple"
                placeholderTextColor={colors.mutedForeground}
              />
            </>
          )}

          {/* Ordering */}
          {form.questionType === 'ordering' && (
            <>
              <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Items in correct order</Text>
              {form.orderedItems.map((item, i) => (
                <View key={i} style={s.choiceRow}>
                  <Text style={[s.choiceLetter, { color: colors.mutedForeground }]}>{i + 1}</Text>
                  <TextInput
                    style={[s.choiceInput, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]}
                    value={item}
                    onChangeText={(v) => { const next = [...form.orderedItems]; next[i] = v; set('orderedItems', next); }}
                    placeholder={`Item ${i + 1}`}
                    placeholderTextColor={colors.mutedForeground}
                  />
                  <View style={s.orderBtns}>
                    <Pressable disabled={i === 0} onPress={() => {
                      const next = [...form.orderedItems];
                      [next[i - 1], next[i]] = [next[i], next[i - 1]];
                      set('orderedItems', next);
                    }} hitSlop={8}>
                      <Ionicons name="chevron-up" size={18} color={i === 0 ? colors.border : colors.mutedForeground} />
                    </Pressable>
                    <Pressable disabled={i === form.orderedItems.length - 1} onPress={() => {
                      const next = [...form.orderedItems];
                      [next[i], next[i + 1]] = [next[i + 1], next[i]];
                      set('orderedItems', next);
                    }} hitSlop={8}>
                      <Ionicons name="chevron-down" size={18} color={i === form.orderedItems.length - 1 ? colors.border : colors.mutedForeground} />
                    </Pressable>
                    {form.orderedItems.length > 2 && (
                      <Pressable onPress={() => set('orderedItems', form.orderedItems.filter((_, j) => j !== i))} hitSlop={8}>
                        <Ionicons name="close-circle" size={16} color={colors.mutedForeground} />
                      </Pressable>
                    )}
                  </View>
                </View>
              ))}
              {form.orderedItems.length < 8 && (
                <Pressable style={[s.addItemBtn, { borderColor: colors.border }]} onPress={() => set('orderedItems', [...form.orderedItems, ''])}>
                  <Ionicons name="add" size={16} color={colors.primary} />
                  <Text style={[s.addItemText, { color: colors.primary }]}>Add item</Text>
                </Pressable>
              )}
            </>
          )}

          {/* Slider */}
          {form.questionType === 'slider' && (
            <>
              <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Range & correct value</Text>
              <View style={s.sliderRow}>
                {[
                  { label: 'Min', key: 'sliderMin' as const },
                  { label: 'Max', key: 'sliderMax' as const },
                  { label: 'Answer', key: 'sliderCorrect' as const },
                ].map(({ label, key }) => (
                  <View key={key} style={s.sliderField}>
                    <Text style={[s.sliderLabel, { color: colors.mutedForeground }]}>{label}</Text>
                    <TextInput
                      style={[s.sliderInput, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]}
                      value={form[key]}
                      onChangeText={(v) => set(key, v)}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={colors.mutedForeground}
                    />
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Matching */}
          {form.questionType === 'matching' && (
            <>
              <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Matching pairs</Text>
              {form.pairs.map((pair, i) => (
                <View key={i} style={s.pairRow}>
                  <TextInput
                    style={[s.pairInput, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]}
                    value={pair.left}
                    onChangeText={(v) => { const next = [...form.pairs]; next[i] = { ...next[i]!, left: v }; set('pairs', next); }}
                    placeholder="Left"
                    placeholderTextColor={colors.mutedForeground}
                  />
                  <Ionicons name="arrow-forward" size={16} color={colors.mutedForeground} />
                  <TextInput
                    style={[s.pairInput, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]}
                    value={pair.right}
                    onChangeText={(v) => { const next = [...form.pairs]; next[i] = { ...next[i]!, right: v }; set('pairs', next); }}
                    placeholder="Right"
                    placeholderTextColor={colors.mutedForeground}
                  />
                  {form.pairs.length > 2 && (
                    <Pressable onPress={() => set('pairs', form.pairs.filter((_, j) => j !== i))} hitSlop={8}>
                      <Ionicons name="close-circle" size={18} color={colors.mutedForeground} />
                    </Pressable>
                  )}
                </View>
              ))}
              {form.pairs.length < 6 && (
                <Pressable style={[s.addItemBtn, { borderColor: colors.border }]} onPress={() => set('pairs', [...form.pairs, { left: '', right: '' }])}>
                  <Ionicons name="add" size={16} color={colors.primary} />
                  <Text style={[s.addItemText, { color: colors.primary }]}>Add pair</Text>
                </Pressable>
              )}
            </>
          )}

          {/* Image Recognition / Image Hotspot */}
          {(form.questionType === 'image_recognition' || form.questionType === 'image_hotspot') && (
            <>
              <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Image URL</Text>
              <TextInput
                style={[s.input, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]}
                value={form.imageUrl}
                onChangeText={(v) => set('imageUrl', v)}
                placeholder="https://example.com/image.jpg"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="none"
                keyboardType="url"
              />
              {form.questionType === 'image_recognition' && (
                <>
                  <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Correct answer</Text>
                  <TextInput
                    style={[s.input, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]}
                    value={form.correctAnswer}
                    onChangeText={(v) => set('correctAnswer', v)}
                    placeholder="What is in the image?"
                    placeholderTextColor={colors.mutedForeground}
                  />
                  <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Alternate answers (comma-separated)</Text>
                  <TextInput
                    style={[s.input, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]}
                    value={form.alternateAnswers}
                    onChangeText={(v) => set('alternateAnswers', v)}
                    placeholder="Alternate accepted answers"
                    placeholderTextColor={colors.mutedForeground}
                  />
                </>
              )}
              {form.questionType === 'image_hotspot' && !!form.imageUrl.trim() && (
                <>
                  <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Tap image to set hotspot</Text>
                  <HotspotPicker
                    imageUrl={form.imageUrl.trim()}
                    x={parseFloat(form.hotspotX) || 0.5}
                    y={parseFloat(form.hotspotY) || 0.5}
                    onChange={(x, y) => { set('hotspotX', x.toFixed(4)); set('hotspotY', y.toFixed(4)); }}
                    colors={colors}
                  />
                </>
              )}
              {form.questionType === 'image_hotspot' && !form.imageUrl.trim() && (
                <Text style={[s.hint, { color: colors.mutedForeground }]}>Enter an image URL above to set the hotspot location.</Text>
              )}
            </>
          )}

          {/* Points & Source */}
          <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Points</Text>
          <TextInput
            style={[s.input, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border, width: 120 }]}
            value={form.points}
            onChangeText={(v) => set('points', v)}
            keyboardType="numeric"
            placeholder="10"
            placeholderTextColor={colors.mutedForeground}
          />

          <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Source (optional)</Text>
          <TextInput
            style={[s.input, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]}
            value={form.source}
            onChangeText={(v) => set('source', v)}
            placeholder="e.g. Wikipedia — Capital cities"
            placeholderTextColor={colors.mutedForeground}
          />

          {!!error && (
            <View style={[s.errorRow, { backgroundColor: colors.destructive + '15', borderColor: colors.destructive + '30' }]}>
              <Ionicons name="alert-circle" size={16} color={colors.destructive} />
              <Text style={[s.errorText, { color: colors.destructive }]}>{error}</Text>
            </View>
          )}

          <Pressable
            style={({ pressed }) => [s.saveRow, { backgroundColor: colors.primary, opacity: pressed || pending ? 0.8 : 1 }]}
            onPress={handleSave}
            disabled={pending}
          >
            {pending ? <ActivityIndicator color="#fff" /> : <Text style={s.saveRowText}>Save Question</Text>}
          </Pressable>

          <View style={{ height: insets.bottom + 24 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}


// ─── Free-tier upgrade helpers ────────────────────────────────────────────────

function extractFreeTierLimitMsg(err: unknown): string | null {
  if (!err || typeof err !== 'object') return null;
  const status = 'status' in err ? (err as { status: number }).status : 0;
  if (status !== 429) return null;
  const data = 'data' in err ? (err as { data: unknown }).data : null;
  if (data && typeof data === 'object' && 'error' in data) {
    const msg = String((data as { error: unknown }).error);
    if (msg.includes('Free plan limit reached')) return msg;
  }
  return null;
}

function UpgradeLimitCard({
  msg,
  colors,
  s,
  onClose,
}: {
  msg: string;
  colors: ReturnType<typeof useColors>;
  s: ReturnType<typeof bgStyles>;
  onClose: () => void;
}) {
  return (
    <View style={[s.resultCard, { backgroundColor: '#facc1508', borderColor: '#facc1540' }]}>
      <Ionicons name="star" size={32} color="#facc15" />
      <Text style={[s.resultTitle, { color: '#fcd34d' }]}>Plan Limit Reached</Text>
      <Text style={[s.resultSub, { color: colors.mutedForeground }]}>{msg}</Text>
      <Text style={[s.resultSub, { color: '#fcd34d', marginTop: 2 }]}>
        Ask your app administrator to upgrade this account to Pro.
      </Text>
      <Pressable style={[s.closeResultBtn, { borderColor: '#facc15' }]} onPress={onClose}>
        <Text style={[s.closeResultText, { color: '#fcd34d' }]}>Got it</Text>
      </Pressable>
    </View>
  );
}

// ─── BulkGenerateModal ────────────────────────────────────────────────────────

function BulkGenerateModal({
  visible,
  gameId,
  gameTopic,
  gameDifficulty,
  onClose,
  onGenerated,
}: {
  visible: boolean;
  gameId: number;
  gameTopic: string;
  gameDifficulty: string;
  onClose: () => void;
  onGenerated: (count: number) => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [amount, setAmount] = useState('10');
  const [result, setResult] = useState<{ imported: number; discarded: number } | null>(null);
  const [error, setError] = useState('');
  const [upgradeLimitMsg, setUpgradeLimitMsg] = useState('');
  const generateGemini = useGenerateGeminiQuestions();

  React.useEffect(() => {
    if (visible) {
      setTopic(gameTopic);
      setDifficulty((gameDifficulty as 'easy' | 'medium' | 'hard') ?? 'medium');
      setAmount('10');
      setResult(null);
      setError('');
    }
  }, [visible, gameTopic, gameDifficulty]);

  const handleGenerate = async () => {
    setError('');
    const n = parseInt(amount, 10);
    if (isNaN(n) || n < 1 || n > 20) { setError('Enter a number between 1 and 20'); return; }
    if (!topic.trim()) { setError('Topic is required'); return; }
    try {
      const res = await generateGemini.mutateAsync({
        gameId,
        data: { topic: topic.trim(), difficulty, amount: n, existingQuestions: [] },
      });
      setResult({ imported: res.imported, discarded: res.discarded ?? 0 });
      onGenerated(res.imported);
    } catch (e: unknown) {
      const limitMsg = extractFreeTierLimitMsg(e);
      if (limitMsg) { setUpgradeLimitMsg(limitMsg); return; }
      const msg = e instanceof Error ? e.message : 'Generation failed';
      setError(msg.includes('429') ? 'AI rate limit reached — wait a moment and try again.' : msg);
    }
  };

  const s = bgStyles(colors);

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <View style={s.overlay}>
        <Pressable style={s.backdrop} onPress={onClose} />
        <View style={[s.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 24 }]}>
          <View style={s.handle} />
          <View style={s.sheetHeader}>
            <View style={[s.aiIcon, { backgroundColor: '#a855f7' + '22' }]}>
              <Ionicons name="sparkles" size={20} color="#a855f7" />
            </View>
            <Text style={[s.sheetTitle, { color: colors.foreground }]}>Generate Questions with AI</Text>
          </View>

          {upgradeLimitMsg ? (
            <UpgradeLimitCard msg={upgradeLimitMsg} colors={colors} s={s} onClose={onClose} />
          ) : result ? (
            <View style={[s.resultCard, { backgroundColor: colors.secondary + '15', borderColor: colors.secondary + '30' }]}>
              <Ionicons name="checkmark-circle" size={32} color={colors.secondary} />
              <Text style={[s.resultTitle, { color: colors.secondary }]}>
                {result.imported} question{result.imported !== 1 ? 's' : ''} added
              </Text>
              {result.discarded > 0 && (
                <Text style={[s.resultSub, { color: colors.mutedForeground }]}>
                  {result.discarded} discarded (invalid or duplicate)
                </Text>
              )}
              <Pressable style={[s.closeResultBtn, { borderColor: colors.secondary }]} onPress={onClose}>
                <Text style={[s.closeResultText, { color: colors.secondary }]}>Done</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Topic</Text>
              <TextInput
                style={[s.input, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border }]}
                value={topic}
                onChangeText={(v) => { setTopic(v); setError(''); }}
                placeholder="e.g. 90s Pop Music"
                placeholderTextColor={colors.mutedForeground}
              />

              <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Difficulty</Text>
              <View style={s.diffRow}>
                {(['easy', 'medium', 'hard'] as const).map((d) => (
                  <Pressable
                    key={d}
                    style={[s.diffChip, { borderColor: difficulty === d ? '#a855f7' : colors.border, backgroundColor: difficulty === d ? '#a855f7' + '22' : 'transparent' }]}
                    onPress={() => setDifficulty(d)}
                  >
                    <Text style={[s.diffChipText, { color: difficulty === d ? '#a855f7' : colors.muted }]}>
                      {d === 'easy' ? 'Easy (5 pts)' : d === 'medium' ? 'Medium (10 pts)' : 'Hard (15 pts)'}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Number of questions (1–20)</Text>
              <TextInput
                style={[s.input, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border, width: 100 }]}
                value={amount}
                onChangeText={(v) => { setAmount(v); setError(''); }}
                keyboardType="numeric"
                placeholder="10"
                placeholderTextColor={colors.mutedForeground}
              />

              {!!error && (
                <View style={[s.errorRow, { backgroundColor: colors.destructive + '15', borderColor: colors.destructive + '30' }]}>
                  <Ionicons name="alert-circle" size={14} color={colors.destructive} />
                  <Text style={[s.errorText, { color: colors.destructive }]}>{error}</Text>
                </View>
              )}

              <Pressable
                style={[s.genBtn, { backgroundColor: '#a855f7', opacity: generateGemini.isPending ? 0.7 : 1 }]}
                onPress={handleGenerate}
                disabled={generateGemini.isPending}
              >
                {generateGemini.isPending ? (
                  <>
                    <ActivityIndicator color="#fff" size="small" />
                    <Text style={s.genBtnText}>Generating… this may take a moment</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="sparkles" size={16} color="#fff" />
                    <Text style={s.genBtnText}>Generate</Text>
                  </>
                )}
              </Pressable>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── ImportOpenTdbModal ───────────────────────────────────────────────────────

function ImportOpenTdbModal({
  visible,
  gameId,
  onClose,
  onImported,
}: {
  visible: boolean;
  gameId: number;
  onClose: () => void;
  onImported: (count: number) => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [categoryId, setCategoryId] = useState<number>(9);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [amount, setAmount] = useState('10');
  const [result, setResult] = useState<{ imported: number } | null>(null);
  const [error, setError] = useState('');
  const [categoryOpen, setCategoryOpen] = useState(false);
  const importMutation = useImportOpenTdbQuestions();

  React.useEffect(() => {
    if (visible) {
      setCategoryId(9);
      setDifficulty('medium');
      setAmount('10');
      setResult(null);
      setError('');
      setCategoryOpen(false);
    }
  }, [visible]);

  const handleImport = async () => {
    setError('');
    const n = parseInt(amount, 10);
    if (isNaN(n) || n < 1 || n > 50) { setError('Enter a number between 1 and 50'); return; }
    try {
      const res = await importMutation.mutateAsync({
        gameId,
        data: { categoryId, difficulty, amount: n },
      });
      setResult({ imported: res.imported });
      onImported(res.imported);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Import failed';
      const isNetworkError =
        e instanceof TypeError ||
        msg.toLowerCase().includes('network request failed') ||
        msg.toLowerCase().includes('failed to fetch') ||
        msg.toLowerCase().includes('network error');
      const isTimeoutError =
        (e instanceof Error && e.name === 'AbortError') ||
        msg.toLowerCase().includes('timeout') ||
        msg.toLowerCase().includes('timed out');
      if (isNetworkError || isTimeoutError) {
        setError('No internet connection — check your network and try again.');
      } else if (msg.includes('429') || msg.toLowerCase().includes('rate limit')) {
        setError('Open Trivia DB rate limit reached — wait a few seconds and try again.');
      } else if (msg.includes('422') || msg.toLowerCase().includes('no questions')) {
        setError('No questions available for this combination — try a different difficulty.');
      } else {
        setError(msg);
      }
    }
  };

  const selectedCategory = OPENTDB_CATEGORIES.find((c) => c.id === categoryId);
  const s = bgStyles(colors);

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <View style={s.overlay}>
        <Pressable style={s.backdrop} onPress={onClose} />
        <View style={[s.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 24 }]}>
          <View style={s.handle} />
          <View style={s.sheetHeader}>
            <View style={[s.aiIcon, { backgroundColor: colors.primary + '22' }]}>
              <Ionicons name="cloud-download-outline" size={20} color={colors.primary} />
            </View>
            <Text style={[s.sheetTitle, { color: colors.foreground }]}>Import from Open Trivia DB</Text>
          </View>

          {result ? (
            <View style={[s.resultCard, { backgroundColor: colors.secondary + '15', borderColor: colors.secondary + '30' }]}>
              <Ionicons name="checkmark-circle" size={32} color={colors.secondary} />
              <Text style={[s.resultTitle, { color: colors.secondary }]}>
                {result.imported} question{result.imported !== 1 ? 's' : ''} imported
              </Text>
              <Pressable style={[s.closeResultBtn, { borderColor: colors.secondary }]} onPress={onClose}>
                <Text style={[s.closeResultText, { color: colors.secondary }]}>Done</Text>
              </Pressable>
            </View>
          ) : (
            <>
              {/* Category picker */}
              <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Category</Text>
              <Pressable
                style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, flexDirection: 'row', alignItems: 'center' }]}
                onPress={() => setCategoryOpen((v) => !v)}
              >
                <Text style={[{ flex: 1, fontSize: 15, color: colors.foreground }]}>{selectedCategory?.name ?? 'Select…'}</Text>
                <Ionicons name={categoryOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.mutedForeground} />
              </Pressable>

              {categoryOpen && (
                <ScrollView style={{ maxHeight: 180, borderWidth: 1, borderColor: colors.border, borderRadius: 12 }}>
                  {OPENTDB_CATEGORIES.map((cat) => (
                    <Pressable
                      key={cat.id}
                      style={[
                        { paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
                        categoryId === cat.id && { backgroundColor: colors.primary + '18' },
                      ]}
                      onPress={() => { setCategoryId(cat.id); setCategoryOpen(false); setError(''); }}
                    >
                      <Text style={[{ fontSize: 14, color: categoryId === cat.id ? colors.primary : colors.foreground, fontFamily: categoryId === cat.id ? 'Manrope_600SemiBold' : undefined }]}>
                        {cat.name}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )}

              {/* Difficulty */}
              <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Difficulty</Text>
              <View style={s.diffRow}>
                {(['easy', 'medium', 'hard'] as const).map((d) => (
                  <Pressable
                    key={d}
                    style={[s.diffChip, { borderColor: difficulty === d ? colors.primary : colors.border, backgroundColor: difficulty === d ? colors.primary + '22' : 'transparent' }]}
                    onPress={() => setDifficulty(d)}
                  >
                    <Text style={[s.diffChipText, { color: difficulty === d ? colors.primary : colors.muted }]}>
                      {d === 'easy' ? 'Easy (5 pts)' : d === 'medium' ? 'Medium (10 pts)' : 'Hard (15 pts)'}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Amount */}
              <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Number of questions (1–50)</Text>
              <TextInput
                style={[s.input, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border, width: 100 }]}
                value={amount}
                onChangeText={(v) => { setAmount(v); setError(''); }}
                keyboardType="numeric"
                placeholder="10"
                placeholderTextColor={colors.mutedForeground}
              />

              {!!error && (
                <View style={[s.errorRow, { backgroundColor: colors.destructive + '15', borderColor: colors.destructive + '30' }]}>
                  <Ionicons name="alert-circle" size={14} color={colors.destructive} />
                  <Text style={[s.errorText, { color: colors.destructive }]}>{error}</Text>
                </View>
              )}

              <Pressable
                style={[s.genBtn, { backgroundColor: colors.primary, opacity: importMutation.isPending ? 0.7 : 1 }]}
                onPress={handleImport}
                disabled={importMutation.isPending}
              >
                {importMutation.isPending ? (
                  <>
                    <ActivityIndicator color="#fff" size="small" />
                    <Text style={s.genBtnText}>Importing…</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="cloud-download-outline" size={16} color="#fff" />
                    <Text style={s.genBtnText}>Import</Text>
                  </>
                )}
              </Pressable>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── AIActionMenu ─────────────────────────────────────────────────────────────

type AIAction = 'regenerate' | 'enhance' | 'fact-check';

function AIActionMenu({
  visible,
  question,
  gameId,
  onClose,
  onUpdate,
}: {
  visible: boolean;
  question: Question | null;
  gameId: number;
  onClose: () => void;
  onUpdate: (q: Question) => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [action, setAction] = useState<AIAction | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Results
  const [regenPreview, setRegenPreview] = useState<RegenerateQuestionPreview | null>(null);
  const [enhanceResult, setEnhanceResult] = useState<EnhanceQuestionResult | null>(null);
  const [factCheckResult, setFactCheckResult] = useState<FactCheckSingleResult | null>(null);

  const [upgradeLimitMsg, setUpgradeLimitMsg] = useState('');
  const updateQuestion = useUpdateQuestion();
  const regenerate = useRegenerateQuestion();
  const enhance = useEnhanceQuestion();
  const factCheck = useFactCheckQuestion();

  React.useEffect(() => {
    if (!visible) {
      setAction(null);
      setRegenPreview(null);
      setEnhanceResult(null);
      setFactCheckResult(null);
      setError('');
    }
  }, [visible]);

  if (!question) return null;

  const runAction = async (a: AIAction) => {
    setAction(a);
    setLoading(true);
    setError('');
    setRegenPreview(null);
    setEnhanceResult(null);
    setFactCheckResult(null);
    try {
      if (a === 'regenerate') {
        const res = await regenerate.mutateAsync({ gameId, questionId: question.id, data: {} });
        setRegenPreview(res);
      } else if (a === 'enhance') {
        const res = await enhance.mutateAsync({ gameId, questionId: question.id });
        setEnhanceResult(res);
      } else {
        const res = await factCheck.mutateAsync({ gameId, questionId: question.id });
        setFactCheckResult(res);
      }
    } catch (e: unknown) {
      const limitMsg = extractFreeTierLimitMsg(e);
      if (limitMsg) { setUpgradeLimitMsg(limitMsg); return; }
      const msg = e instanceof Error ? e.message : 'Request failed';
      setError(msg.includes('429') ? 'Rate limit reached — wait a moment and try again.' : msg);
    } finally {
      setLoading(false);
    }
  };

  const applyRegenerate = async () => {
    if (!regenPreview) return;
    setLoading(true);
    try {
      const updated = await updateQuestion.mutateAsync({
        questionId: question.id,
        data: {
          questionType: regenPreview.questionType as Parameters<typeof updateQuestion.mutateAsync>[0]['data']['questionType'],
          questionText: regenPreview.questionText,
          correctAnswer: regenPreview.correctAnswer,
          // Wrap string[] choices; if null (true_false / write_in), pass null — do NOT
          // fall back to the old question's options, which may be from a different type.
          options: regenPreview.options?.length
            ? { choices: regenPreview.options }
            : null,
          points: regenPreview.points,
          source: regenPreview.source || undefined,
        },
      });
      onUpdate(updated);
      onClose();
    } catch {
      setError('Failed to apply — please retry.');
    } finally {
      setLoading(false);
    }
  };

  const applyEnhance = async () => {
    if (!enhanceResult) return;
    setLoading(true);
    try {
      const opts = enhanceResult.improvedOptions?.length
        ? { choices: enhanceResult.improvedOptions }
        : (question.options as Record<string, unknown> | null);
      const updated = await updateQuestion.mutateAsync({
        questionId: question.id,
        data: {
          questionText: enhanceResult.improvedQuestionText,
          options: opts,
          source: enhanceResult.suggestedSource || (question.source ?? undefined),
        },
      });
      onUpdate(updated);
      onClose();
    } catch {
      setError('Failed to apply — please retry.');
    } finally {
      setLoading(false);
    }
  };

  const s = bgStyles(colors);

  const verdictColor = factCheckResult
    ? factCheckResult.verdict === 'CORRECT' ? colors.secondary
      : factCheckResult.verdict === 'INCORRECT' ? colors.destructive
      : colors.accent
    : colors.muted;

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <View style={s.overlay}>
        <Pressable style={s.backdrop} onPress={onClose} />
        <View style={[s.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 24 }]}>
          <View style={s.handle} />

          {/* Menu header */}
          <View style={s.sheetHeader}>
            <View style={[s.aiIcon, { backgroundColor: '#a855f7' + '22' }]}>
              <Ionicons name="sparkles" size={18} color="#a855f7" />
            </View>
            <Text style={[s.sheetTitle, { color: colors.foreground }]} numberOfLines={2}>
              AI Tools
            </Text>
          </View>
          <Text style={[s.questionPreview, { color: colors.mutedForeground }]} numberOfLines={2}>
            {question.questionText}
          </Text>

          {/* Action selection */}
          {!action && (
            <View style={s.actionList}>
              {[
                { id: 'regenerate' as AIAction, icon: 'refresh', label: 'Regenerate', desc: 'Replace with a new AI-written question on the same topic' },
                { id: 'enhance' as AIAction, icon: 'sparkles', label: 'Enhance', desc: 'Improve wording, fix options, add a source suggestion' },
                { id: 'fact-check' as AIAction, icon: 'shield-checkmark-outline', label: 'Fact-Check', desc: 'Verify the question and correct answer with AI' },
              ].map(({ id, icon, label, desc }) => (
                <Pressable
                  key={id}
                  style={[s.actionItem, { borderColor: colors.border }]}
                  onPress={() => runAction(id)}
                >
                  <Ionicons name={icon as 'refresh'} size={20} color="#a855f7" />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.actionLabel, { color: colors.foreground }]}>{label}</Text>
                    <Text style={[s.actionDesc, { color: colors.mutedForeground }]}>{desc}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
                </Pressable>
              ))}
            </View>
          )}

          {/* Loading */}
          {action && loading && (
            <View style={s.loadingBox}>
              <ActivityIndicator color="#a855f7" size="large" />
              <Text style={[s.loadingText, { color: colors.mutedForeground }]}>
                {action === 'regenerate' ? 'Generating new question…'
                  : action === 'enhance' ? 'Enhancing question…'
                  : 'Fact-checking…'}
              </Text>
            </View>
          )}

          {/* Free-tier upgrade */}
          {!!upgradeLimitMsg && (
            <UpgradeLimitCard msg={upgradeLimitMsg} colors={colors} s={s} onClose={onClose} />
          )}

          {/* Error */}
          {!upgradeLimitMsg && !!error && (
            <View style={[s.errorRow, { backgroundColor: colors.destructive + '15', borderColor: colors.destructive + '30', margin: 4 }]}>
              <Ionicons name="alert-circle" size={14} color={colors.destructive} />
              <Text style={[s.errorText, { color: colors.destructive }]}>{error}</Text>
            </View>
          )}

          {/* Regenerate result */}
          {action === 'regenerate' && !loading && regenPreview && (
            <ScrollView style={{ maxHeight: 300 }} contentContainerStyle={{ gap: 12, paddingVertical: 4 }}>
              <View style={[s.previewCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Text style={[s.previewLabel, { color: colors.mutedForeground }]}>NEW QUESTION</Text>
                <Text style={[s.previewText, { color: colors.foreground }]}>{regenPreview.questionText}</Text>
                <Text style={[s.previewLabel, { color: colors.mutedForeground }]}>Correct answer</Text>
                <Text style={[s.previewAnswer, { color: colors.secondary }]}>{regenPreview.correctAnswer}</Text>
                {regenPreview.options && Array.isArray(regenPreview.options) && regenPreview.options.length > 0 && (
                  <>
                    <Text style={[s.previewLabel, { color: colors.mutedForeground }]}>OPTIONS</Text>
                    {(regenPreview.options as unknown as string[]).map((o, i) => (
                      <Text key={i} style={[s.previewOption, { color: colors.foreground }]}>• {o}</Text>
                    ))}
                  </>
                )}
              </View>
              <View style={s.applyRow}>
                <Pressable style={[s.discardBtn, { borderColor: colors.border }]} onPress={onClose}>
                  <Text style={[s.discardText, { color: colors.mutedForeground }]}>Discard</Text>
                </Pressable>
                <Pressable style={[s.applyBtn, { backgroundColor: '#a855f7' }]} onPress={applyRegenerate} disabled={loading}>
                  <Ionicons name="checkmark" size={16} color="#fff" />
                  <Text style={s.applyText}>Apply</Text>
                </Pressable>
              </View>
            </ScrollView>
          )}

          {/* Enhance result */}
          {action === 'enhance' && !loading && enhanceResult && (
            <ScrollView style={{ maxHeight: 320 }} contentContainerStyle={{ gap: 12, paddingVertical: 4 }}>
              <View style={[s.previewCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Text style={[s.previewLabel, { color: colors.mutedForeground }]}>IMPROVED QUESTION</Text>
                <Text style={[s.previewText, { color: colors.foreground }]}>{enhanceResult.improvedQuestionText}</Text>
                {enhanceResult.improvedOptions && enhanceResult.improvedOptions.length > 0 && (
                  <>
                    <Text style={[s.previewLabel, { color: colors.mutedForeground }]}>IMPROVED OPTIONS</Text>
                    {enhanceResult.improvedOptions.map((o, i) => (
                      <Text key={i} style={[s.previewOption, { color: colors.foreground }]}>• {o}</Text>
                    ))}
                  </>
                )}
                {!!enhanceResult.factCheckNotes && (
                  <>
                    <Text style={[s.previewLabel, { color: colors.mutedForeground }]}>NOTES</Text>
                    <Text style={[s.previewOption, { color: colors.mutedForeground }]}>{enhanceResult.factCheckNotes}</Text>
                  </>
                )}
                {!!enhanceResult.suggestedSource && (
                  <>
                    <Text style={[s.previewLabel, { color: colors.mutedForeground }]}>SUGGESTED SOURCE</Text>
                    <Text style={[s.previewOption, { color: colors.accent }]}>{enhanceResult.suggestedSource}</Text>
                  </>
                )}
              </View>
              <View style={s.applyRow}>
                <Pressable style={[s.discardBtn, { borderColor: colors.border }]} onPress={onClose}>
                  <Text style={[s.discardText, { color: colors.mutedForeground }]}>Discard</Text>
                </Pressable>
                <Pressable style={[s.applyBtn, { backgroundColor: '#a855f7' }]} onPress={applyEnhance} disabled={loading}>
                  <Ionicons name="checkmark" size={16} color="#fff" />
                  <Text style={s.applyText}>Apply</Text>
                </Pressable>
              </View>
            </ScrollView>
          )}

          {/* Fact-check result */}
          {action === 'fact-check' && !loading && factCheckResult && (
            <ScrollView style={{ maxHeight: 320 }} contentContainerStyle={{ gap: 12, paddingVertical: 4 }}>
              <View style={[s.previewCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <View style={[s.verdictRow, { backgroundColor: verdictColor + '22' }]}>
                  <Ionicons
                    name={factCheckResult.verdict === 'CORRECT' ? 'checkmark-circle' : factCheckResult.verdict === 'INCORRECT' ? 'close-circle' : 'help-circle'}
                    size={22}
                    color={verdictColor}
                  />
                  <Text style={[s.verdictText, { color: verdictColor }]}>
                    {factCheckResult.verdict.charAt(0).toUpperCase() + factCheckResult.verdict.slice(1)}
                    {' · '}
                    {factCheckResult.confidence} confidence
                  </Text>
                </View>
                <Text style={[s.previewLabel, { color: colors.mutedForeground }]}>EXPLANATION</Text>
                <Text style={[s.previewText, { color: colors.foreground }]}>{factCheckResult.explanation}</Text>
                {!!factCheckResult.correctAnswerIfWrong && (
                  <>
                    <Text style={[s.previewLabel, { color: colors.mutedForeground }]}>CORRECT ANSWER SHOULD BE</Text>
                    <Text style={[s.previewAnswer, { color: colors.secondary }]}>{factCheckResult.correctAnswerIfWrong}</Text>
                  </>
                )}
                {!!factCheckResult.groundingUrl && (
                  <>
                    <Text style={[s.previewLabel, { color: colors.mutedForeground }]}>SOURCE</Text>
                    <Text style={[s.previewOption, { color: colors.accent }]} numberOfLines={2}>{factCheckResult.groundingUrl}</Text>
                  </>
                )}
              </View>
              <Pressable style={[s.applyBtn, { backgroundColor: colors.primary, alignSelf: 'flex-end' }]} onPress={onClose}>
                <Text style={s.applyText}>Done</Text>
              </Pressable>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── GameDetail screen ────────────────────────────────────────────────────────

export default function GameDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const { gameId: gameIdStr } = useLocalSearchParams<{ gameId: string }>();
  const gameId = parseInt(gameIdStr ?? '', 10);

  const [formOpen, setFormOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [editingRoomCode, setEditingRoomCode] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [editingTopic, setEditingTopic] = useState(false);
  const [topicInput, setTopicInput] = useState('');
  const [topicError, setTopicError] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [aiMenuQuestion, setAiMenuQuestion] = useState<Question | null>(null);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [playAlong, setPlayAlong] = useState(false);

  const { data: games } = useListGames();
  const game = useMemo(() => games?.find((g) => g.id === gameId), [games, gameId]);
  const { data: questions, isLoading } = useListGameQuestions(gameId);
  const createQuestion = useCreateQuestion();
  const updateQuestion = useUpdateQuestion();
  const deleteQuestion = useDeleteQuestion();
  const updateGame = useUpdateGame();

  const sortedQs: Question[] = useMemo(
    () => [...(questions ?? [])].sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0)),
    [questions],
  );

  // Optimistic local order for immediate feedback during drags
  const [localQs, setLocalQs] = useState<Question[]>([]);
  const isSyncing = useRef(false);

  // Keep local list in sync with server data unless we're mid-sync
  React.useEffect(() => {
    if (!isSyncing.current) setLocalQs(sortedQs);
  }, [sortedQs]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getListGameQuestionsQueryKey(gameId) });
    qc.invalidateQueries({ queryKey: getListGamesQueryKey() });
  };

  const openAdd = () => { setEditingQuestion(null); setFormOpen(true); };
  const openEdit = (q: Question) => { setEditingQuestion(q); setFormOpen(true); };

  const handleSave = async (form: QForm) => {
    const orderIndex = editingQuestion
      ? (editingQuestion.orderIndex ?? sortedQs.length)
      : sortedQs.length;
    const payload = buildPayload(form, orderIndex);
    try {
      if (editingQuestion) {
        await updateQuestion.mutateAsync({ questionId: editingQuestion.id, data: payload });
      } else {
        await createQuestion.mutateAsync({ gameId, data: payload });
      }
      invalidate();
      setFormOpen(false);
    } catch {
      // error handled in modal
    }
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await deleteQuestion.mutateAsync({ questionId: id });
      invalidate();
    } finally {
      setDeletingId(null);
    }
  };

  const handleDragEnd = async ({ data }: { data: Question[] }) => {
    setLocalQs(data);
    isSyncing.current = true;
    try {
      const changed = data
        .map((q, idx) => ({ q, newIdx: idx }))
        .filter(({ q, newIdx }) => (q.orderIndex ?? 0) !== newIdx);
      await Promise.all(
        changed.map(({ q, newIdx }) =>
          updateQuestion.mutateAsync({ questionId: q.id, data: { orderIndex: newIdx } }),
        ),
      );
      invalidate();
    } finally {
      isSyncing.current = false;
    }
  };

  const handleSaveTopic = async () => {
    const trimmed = topicInput.trim();
    if (!trimmed) { setTopicError('Quiz name cannot be empty'); return; }
    setTopicError('');
    try {
      await updateGame.mutateAsync({ gameId, data: { topic: trimmed } });
      qc.invalidateQueries({ queryKey: getListGamesQueryKey() });
      setEditingTopic(false);
    } catch {
      setTopicError('Failed to save — try again');
    }
  };

  const handleSaveRoomCode = async () => {
    if (!roomCode.trim()) return;
    try {
      await updateGame.mutateAsync({ gameId, data: { accessCode: roomCode.trim().toUpperCase() } });
      qc.invalidateQueries({ queryKey: getListGamesQueryKey() });
      setEditingRoomCode(false);
    } catch {
      // silently ignore
    }
  };

  const handleStatusChange = async (status: 'waiting' | 'active' | 'completed') => {
    await updateGame.mutateAsync({
      gameId,
      data: status === 'active' ? { status, hostPlaysAlong: playAlong } : { status },
    });
    qc.invalidateQueries({ queryKey: getListGamesQueryKey() });
    if (status === 'active') router.push(`/admin/live/${gameId}`);
    if (status === 'completed') router.push(`/admin/results/${gameId}`);
  };

  const handleConfirmDelete = (id: number) => {
    Alert.alert('Delete Question', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => handleDelete(id) },
    ]);
  };

  const s = styles(colors);

  const initialForm = useMemo(
    () => editingQuestion ? formFromQuestion(editingQuestion) : emptyForm(),
    [editingQuestion],
  );

  const renderItem = useCallback(
    ({ item: q, drag, isActive, getIndex }: RenderItemParams<Question>) => {
      const idx = getIndex() ?? 0;
      const qtype = q.questionType as QType;
      return (
        <ScaleDecorator activeScale={0.97}>
          <View
            style={[
              s.qCard,
              {
                backgroundColor: isActive ? colors.card + 'ee' : colors.card,
                borderColor: isActive ? colors.primary + '88' : colors.border,
                opacity: isActive ? 0.95 : 1,
              },
            ]}
          >
            <View style={s.qHeader}>
              {/* Drag handle — long press to drag */}
              <Pressable onLongPress={drag} delayLongPress={150} hitSlop={6} style={s.dragHandle}>
                <Ionicons name="reorder-two" size={20} color={colors.mutedForeground} />
              </Pressable>

              <View style={[s.typeTag, { backgroundColor: colors.primary + '22' }]}>
                <Ionicons name={TYPE_ICONS[qtype] as 'checkmark-circle'} size={12} color={colors.primary} />
                <Text style={[s.typeTagText, { color: colors.primary }]}>{TYPE_LABELS[qtype]}</Text>
              </View>
              <Text style={[s.qPoints, { color: colors.accent }]}>{q.points}pts</Text>
              <Text style={[s.qNum, { color: colors.mutedForeground }]}>#{idx + 1}</Text>
            </View>

            <Text style={[s.qText, { color: colors.foreground }]} numberOfLines={2}>
              {q.questionText}
            </Text>

            <View style={s.qActions}>
              {/* AI menu */}
              <Pressable
                style={[s.aiChip, { borderColor: '#a855f7' + '44', backgroundColor: '#a855f7' + '15' }]}
                onPress={() => setAiMenuQuestion(q)}
              >
                <Ionicons name="sparkles" size={13} color="#a855f7" />
                <Text style={[s.aiChipText, { color: '#a855f7' }]}>AI</Text>
              </Pressable>

              <Pressable style={[s.qActionBtn, { borderColor: colors.border }]} onPress={() => openEdit(q)}>
                <Ionicons name="pencil" size={15} color={colors.foreground} />
                <Text style={[s.qActionText, { color: colors.foreground }]}>Edit</Text>
              </Pressable>

              {deletingId === q.id ? (
                <ActivityIndicator size="small" color={colors.destructive} />
              ) : (
                <Pressable style={[s.qActionBtn, { borderColor: colors.destructive + '44' }]} onPress={() => handleConfirmDelete(q.id)}>
                  <Ionicons name="trash-outline" size={15} color={colors.destructive} />
                </Pressable>
              )}
            </View>
          </View>
        </ScaleDecorator>
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [colors, deletingId],
  );

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color={colors.foreground} />
        </Pressable>
        <View style={s.headerCenter}>
          {editingTopic ? (
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <TextInput
                  style={[s.headerTitle, { color: colors.foreground, borderBottomWidth: 1, borderBottomColor: colors.primary, flex: 1, paddingVertical: 2 }]}
                  value={topicInput}
                  onChangeText={(v) => { setTopicInput(v); setTopicError(''); }}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleSaveTopic}
                  placeholderTextColor={colors.mutedForeground}
                  placeholder="Quiz name"
                />
                <Pressable onPress={handleSaveTopic} hitSlop={8} disabled={updateGame.isPending}>
                  {updateGame.isPending
                    ? <ActivityIndicator size="small" color={colors.secondary} />
                    : <Ionicons name="checkmark-circle" size={22} color={colors.secondary} />}
                </Pressable>
                <Pressable onPress={() => { setEditingTopic(false); setTopicError(''); }} hitSlop={8}>
                  <Ionicons name="close-circle" size={22} color={colors.mutedForeground} />
                </Pressable>
              </View>
              {topicError ? (
                <Text style={{ color: colors.destructive, fontSize: 11, marginTop: 2 }}>{topicError}</Text>
              ) : null}
            </View>
          ) : (
            <Pressable
              onPress={() => { setTopicInput(game?.topic ?? ''); setTopicError(''); setEditingTopic(true); }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 }}
              hitSlop={8}
            >
              <Text style={[s.headerTitle, { color: colors.foreground, flex: 1 }]} numberOfLines={1}>
                {game?.topic ?? 'Game'}
              </Text>
              <Ionicons name="pencil" size={14} color={colors.mutedForeground} />
            </Pressable>
          )}
          {game && !editingTopic && (
            <View style={[s.statusBadge, { backgroundColor: (game.status === 'active' ? colors.secondary : game.status === 'completed' ? colors.muted : colors.accent) + '22' }]}>
              <Text style={[s.statusText, { color: game.status === 'active' ? colors.secondary : game.status === 'completed' ? colors.muted : colors.accent }]}>
                {game.status}
              </Text>
            </View>
          )}
        </View>
        {game?.status === 'active' && (
          <Pressable onPress={() => router.push(`/admin/live/${gameId}`)} style={[s.liveBtn, { backgroundColor: colors.secondary + '22' }]}>
            <Ionicons name="radio" size={16} color={colors.secondary} />
            <Text style={[s.liveBtnText, { color: colors.secondary }]}>Live</Text>
          </Pressable>
        )}
      </View>

      {/* Room code row */}
      <View style={[s.roomRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Ionicons name="key-outline" size={16} color={colors.mutedForeground} />
        {editingRoomCode ? (
          <>
            <TextInput
              style={[s.roomInput, { color: colors.foreground, borderColor: colors.primary }]}
              value={roomCode}
              onChangeText={setRoomCode}
              autoCapitalize="characters"
              autoFocus
              placeholder="NEW CODE"
              placeholderTextColor={colors.mutedForeground}
              returnKeyType="done"
              onSubmitEditing={handleSaveRoomCode}
            />
            <Pressable onPress={handleSaveRoomCode}>
              <Ionicons name="checkmark-circle" size={22} color={colors.secondary} />
            </Pressable>
            <Pressable onPress={() => setEditingRoomCode(false)}>
              <Ionicons name="close-circle" size={22} color={colors.mutedForeground} />
            </Pressable>
          </>
        ) : (
          <>
            <Text style={[s.roomCode, { color: colors.accent }]}>{game?.accessCode ?? '——'}</Text>
            <Pressable onPress={() => { setRoomCode(game?.accessCode ?? ''); setEditingRoomCode(true); }} hitSlop={8}>
              <Ionicons name="pencil" size={16} color={colors.mutedForeground} />
            </Pressable>
          </>
        )}

        <View style={s.statusActions}>
          {game?.status === 'waiting' && (
            <Pressable style={[s.actionChip, { backgroundColor: colors.secondary + '22' }]} onPress={() => handleStatusChange('active')}>
              <Ionicons name="play" size={14} color={colors.secondary} />
              <Text style={[s.actionChipText, { color: colors.secondary }]}>Start</Text>
            </Pressable>
          )}
          {game?.status === 'active' && (
            <Pressable style={[s.actionChip, { backgroundColor: colors.destructive + '22' }]} onPress={() => handleStatusChange('completed')}>
              <Ionicons name="flag" size={14} color={colors.destructive} />
              <Text style={[s.actionChipText, { color: colors.destructive }]}>End</Text>
            </Pressable>
          )}
          {game?.status === 'completed' && (
            <Pressable style={[s.actionChip, { backgroundColor: colors.primary + '22' }]} onPress={() => router.push(`/admin/results/${gameId}`)}>
              <Ionicons name="trophy-outline" size={14} color={colors.primary} />
              <Text style={[s.actionChipText, { color: colors.primary }]}>Results</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Play-along toggle — only for waiting games, full-width row below room-code bar */}
      {game?.status === 'waiting' && (
        <Pressable
          style={[s.playAlongRow, { borderColor: playAlong ? colors.primary + '55' : colors.border, backgroundColor: playAlong ? colors.primary + '10' : 'transparent' }]}
          onPress={() => setPlayAlong((v) => !v)}
          accessibilityRole="switch"
          accessibilityState={{ checked: playAlong }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontFamily: 'Manrope_700Bold', color: colors.foreground }}>{COPY.hostPlayAlong.playAlongLabel}</Text>
            <Text style={{ fontSize: 11, color: colors.mutedForeground, lineHeight: 15, marginTop: 2 }}>{COPY.hostPlayAlong.playAlongDesc}</Text>
          </View>
          <Switch
            value={playAlong}
            onValueChange={setPlayAlong}
            trackColor={{ false: colors.border, true: colors.primary + '88' }}
            thumbColor={playAlong ? colors.primary : colors.mutedForeground}
          />
        </Pressable>
      )}

      {/* AI Generate + Add row */}
      <View style={[s.toolbarRow, { borderBottomColor: colors.border }]}>
        <Text style={[s.listTitle, { color: colors.foreground }]}>
          {localQs.length} Question{localQs.length !== 1 ? 's' : ''}
        </Text>
        <View style={s.toolbarActions}>
          <Pressable
            style={[s.genAiBtn, { borderColor: colors.primary + '55', backgroundColor: colors.primary + '15' }]}
            onPress={() => setImportOpen(true)}
          >
            <Ionicons name="cloud-download-outline" size={14} color={colors.primary} />
            <Text style={[s.genAiBtnText, { color: colors.primary }]}>Open Trivia Database</Text>
          </Pressable>
          <Pressable
            style={[s.genAiBtn, { borderColor: '#a855f7' + '55', backgroundColor: '#a855f7' + '15' }]}
            onPress={() => setGenerateOpen(true)}
          >
            <Ionicons name="sparkles" size={14} color="#a855f7" />
            <Text style={[s.genAiBtnText, { color: '#a855f7' }]}>AI Generate</Text>
          </Pressable>
          <Pressable style={[s.addBtn, { backgroundColor: colors.primary }]} onPress={openAdd}>
            <Ionicons name="add" size={16} color="#fff" />
            <Text style={s.addBtnText}>Add</Text>
          </Pressable>
        </View>
      </View>

      {/* Questions list */}
      {isLoading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : localQs.length === 0 ? (
        <View style={s.emptyBox}>
          <Ionicons name="help-circle-outline" size={40} color={colors.mutedForeground} />
          <Text style={[s.emptyText, { color: colors.mutedForeground }]}>No questions yet</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable style={[s.addBtn, { backgroundColor: '#a855f7' }]} onPress={() => setGenerateOpen(true)}>
              <Ionicons name="sparkles" size={14} color="#fff" />
              <Text style={s.addBtnText}>AI Generate</Text>
            </Pressable>
            <Pressable style={[s.addBtn, { backgroundColor: colors.primary }]} onPress={openAdd}>
              <Ionicons name="add" size={16} color="#fff" />
              <Text style={s.addBtnText}>Add manually</Text>
            </Pressable>
          </View>
          <Text style={[{ color: colors.mutedForeground, fontSize: 12, marginTop: 4 }]}>
            Long-press any question card to drag and reorder
          </Text>
        </View>
      ) : (
        <DraggableFlatList
          data={localQs}
          keyExtractor={(item) => String(item.id)}
          onDragEnd={handleDragEnd}
          renderItem={renderItem}
          contentContainerStyle={s.list}
          ListFooterComponent={<View style={{ height: insets.bottom + 24 }} />}
        />
      )}

      {/* Question form modal */}
      <QuestionFormModal
        visible={formOpen}
        initial={initialForm}
        onClose={() => setFormOpen(false)}
        onSave={handleSave}
        pending={createQuestion.isPending || updateQuestion.isPending}
        title={editingQuestion ? 'Edit Question' : 'New Question'}
        gameId={gameId}
        gameTopic={game?.topic}
      />

      {/* Bulk AI generate modal */}
      <BulkGenerateModal
        visible={generateOpen}
        gameId={gameId}
        gameTopic={game?.topic ?? ''}
        gameDifficulty={game?.difficulty ?? 'medium'}
        onClose={() => setGenerateOpen(false)}
        onGenerated={() => { invalidate(); }}
      />

      {/* OpenTDB import modal */}
      <ImportOpenTdbModal
        visible={importOpen}
        gameId={gameId}
        onClose={() => setImportOpen(false)}
        onImported={() => { invalidate(); }}
      />

      {/* Per-question AI action menu */}
      <AIActionMenu
        visible={!!aiMenuQuestion}
        question={aiMenuQuestion}
        gameId={gameId}
        onClose={() => setAiMenuQuestion(null)}
        onUpdate={() => { invalidate(); setAiMenuQuestion(null); }}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 10 },
    backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    headerCenter: { flex: 1, gap: 4 },
    headerTitle: { fontSize: 18, fontFamily: 'Manrope_700Bold' },
    statusBadge: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
    statusText: { fontSize: 11, fontFamily: 'Manrope_700Bold', textTransform: 'uppercase' },
    liveBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
    liveBtnText: { fontSize: 13, fontFamily: 'Manrope_700Bold' },
    roomRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 8, borderRadius: 14, borderWidth: 1, padding: 12 },
    roomCode: { flex: 1, fontSize: 15, fontFamily: 'Manrope_700Bold', letterSpacing: 3 },
    roomInput: { flex: 1, fontSize: 15, fontFamily: 'Manrope_700Bold', letterSpacing: 3, borderBottomWidth: 1, paddingVertical: 2 },
    playAlongRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8 },
    statusActions: { flexDirection: 'row', gap: 6 },
    actionChip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
    actionChipText: { fontSize: 12, fontFamily: 'Manrope_600SemiBold' },
    toolbarRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
    listTitle: { fontSize: 15, fontFamily: 'Manrope_700Bold' },
    toolbarActions: { flexDirection: 'row', gap: 8 },
    genAiBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 7 },
    genAiBtnText: { fontSize: 13, fontFamily: 'Manrope_600SemiBold' },
    addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
    addBtnText: { color: '#fff', fontSize: 13, fontFamily: 'Manrope_600SemiBold' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    emptyBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingVertical: 40 },
    emptyText: { fontSize: 15, fontFamily: 'Manrope_500Medium' },
    list: { paddingHorizontal: 16, paddingTop: 10, gap: 10 },
    qCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 10 },
    qHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    dragHandle: { padding: 2 },
    typeTag: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
    typeTagText: { fontSize: 11, fontFamily: 'Manrope_700Bold' },
    qPoints: { marginLeft: 'auto', fontSize: 13, fontFamily: 'Manrope_600SemiBold' },
    qNum: { fontSize: 12 },
    qText: { fontSize: 14, lineHeight: 20 },
    qActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    aiChip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 5 },
    aiChipText: { fontSize: 12, fontFamily: 'Manrope_700Bold' },
    qActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5 },
    qActionText: { fontSize: 13, fontFamily: 'Manrope_600SemiBold' },
  });

const fStyles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    modal: { flex: 1 },
    mHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1 },
    cancelBtn: { fontSize: 16 },
    mTitle: { fontSize: 17, fontFamily: 'Manrope_700Bold' },
    saveBtn: { fontSize: 16, fontFamily: 'Manrope_700Bold' },
    mBody: { paddingHorizontal: 20, paddingTop: 20, gap: 10 },
    fieldLabel: { fontSize: 12, fontFamily: 'Manrope_600SemiBold', letterSpacing: 0, marginTop: 8 },
    typeScroll: { marginBottom: 4 },
    typeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, marginRight: 8 },
    typeChipText: { fontSize: 13, fontFamily: 'Manrope_600SemiBold' },
    aiFillBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 10, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 16 },
    aiFillText: { fontSize: 14, fontFamily: 'Manrope_600SemiBold' },
    textArea: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 15, minHeight: 80, textAlignVertical: 'top' },
    input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
    choiceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    choiceBtn: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
    choiceLetter: { fontSize: 13, fontFamily: 'Manrope_700Bold' },
    choiceInput: { flex: 1, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
    addItemBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 10, padding: 10, borderStyle: 'dashed' },
    addItemText: { fontSize: 14, fontFamily: 'Manrope_600SemiBold' },
    tfRow: { flexDirection: 'row', gap: 12 },
    tfBtn: { flex: 1, borderWidth: 2, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
    tfBtnText: { fontSize: 16, fontFamily: 'Manrope_700Bold' },
    orderBtns: { flexDirection: 'row', gap: 4 },
    sliderRow: { flexDirection: 'row', gap: 10 },
    sliderField: { flex: 1, gap: 4 },
    sliderLabel: { fontSize: 11, fontFamily: 'Manrope_600SemiBold', textAlign: 'center' },
    sliderInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 10, fontSize: 15, textAlign: 'center' },
    pairRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    pairInput: { flex: 1, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 10, fontSize: 14 },
    hint: { fontSize: 13, fontStyle: 'italic', textAlign: 'center', paddingVertical: 16 },
    errorRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 10, padding: 12 },
    errorText: { flex: 1, fontSize: 13 },
    saveRow: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
    saveRowText: { color: '#fff', fontSize: 16, fontFamily: 'Manrope_700Bold' },
  });

const bgStyles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'flex-end' },
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
    sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, gap: 14, maxHeight: '90%' },
    handle: { width: 40, height: 4, backgroundColor: '#555', borderRadius: 2, alignSelf: 'center', marginBottom: 4 },
    sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    aiIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    sheetTitle: { flex: 1, fontSize: 18, fontFamily: 'Manrope_700Bold' },
    questionPreview: { fontSize: 13, lineHeight: 18, marginTop: -6 },
    fieldLabel: { fontSize: 12, fontFamily: 'Manrope_600SemiBold', letterSpacing: 0 },
    input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
    diffRow: { flexDirection: 'row', gap: 8 },
    diffChip: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
    diffChipText: { fontSize: 14, fontFamily: 'Manrope_600SemiBold' },
    errorRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 10, padding: 12 },
    errorText: { flex: 1, fontSize: 13 },
    genBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, paddingVertical: 14, marginTop: 4 },
    genBtnText: { color: '#fff', fontSize: 15, fontFamily: 'Manrope_700Bold' },
    resultCard: { borderWidth: 1, borderRadius: 16, padding: 20, alignItems: 'center', gap: 8 },
    resultTitle: { fontSize: 20, fontFamily: 'Manrope_800ExtraBold', textAlign: 'center' },
    resultSub: { fontSize: 13, textAlign: 'center' },
    closeResultBtn: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 10, marginTop: 4 },
    closeResultText: { fontSize: 15, fontFamily: 'Manrope_600SemiBold' },
    // AI action menu
    actionList: { gap: 8 },
    actionItem: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, padding: 14 },
    actionLabel: { fontSize: 15, fontFamily: 'Manrope_600SemiBold' },
    actionDesc: { fontSize: 12, marginTop: 2, lineHeight: 16 },
    loadingBox: { alignItems: 'center', gap: 12, paddingVertical: 24 },
    loadingText: { fontSize: 14 },
    // Results
    previewCard: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 8 },
    previewLabel: { fontSize: 10, fontFamily: 'Manrope_700Bold', letterSpacing: 1.5, textTransform: 'uppercase' },
    previewText: { fontSize: 14, lineHeight: 20 },
    previewAnswer: { fontSize: 14, fontFamily: 'Manrope_600SemiBold' },
    previewOption: { fontSize: 13, lineHeight: 18 },
    verdictRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, padding: 10 },
    verdictText: { flex: 1, fontSize: 14, fontFamily: 'Manrope_600SemiBold' },
    applyRow: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
    discardBtn: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10 },
    discardText: { fontSize: 14, fontFamily: 'Manrope_600SemiBold' },
    applyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10 },
    applyText: { color: '#fff', fontSize: 14, fontFamily: 'Manrope_700Bold' },
  });
