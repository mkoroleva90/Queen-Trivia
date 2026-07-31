import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import {
  useListGames,
  getListGamesQueryKey,
  useListGameQuestions,
  getListGameQuestionsQueryKey,
  useCreateQuestion,
  useUpdateQuestion,
  useDeleteQuestion,
  useUpdateGame,
} from '@workspace/api-client-react';
import type { Question } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';

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
  // Multiple choice / multi-select
  choices: string[];
  correctAnswer: string;     // MC: single correct choice
  correctChoices: string[];  // multi-select: correct choices
  // True/false
  tfAnswer: 'true' | 'false';
  // Write-in alternates
  alternateAnswers: string;
  // Ordering
  orderedItems: string[];
  // Slider
  sliderMin: string;
  sliderMax: string;
  sliderCorrect: string;
  // Image
  imageUrl: string;
  hotspotX: string; // 0–1 percentage
  hotspotY: string;
  // Matching
  pairs: { left: string; right: string }[];
  // Meta
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
    // correctAnswer is stored as "x,y" in 0–100 range (matching player + grader format).
    // Form state keeps 0–1 fractions for the HotspotPicker.
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
      // Player submits "x,y" as 0–100 percentages; grader parses same format.
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
      // write_in, short_response
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
      break; // always valid
    default:
      if (!form.correctAnswer.trim()) return 'Correct answer is required';
  }
  return null;
}

// ─── QuestionFormModal ────────────────────────────────────────────────────────

function QuestionFormModal({
  visible,
  initial,
  onClose,
  onSave,
  pending,
  title,
}: {
  visible: boolean;
  initial: QForm;
  onClose: () => void;
  onSave: (form: QForm) => void;
  pending: boolean;
  title: string;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState<QForm>(initial);
  const [error, setError] = useState('');

  // Reset form when initial changes (new question vs edit)
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
            <Text style={[s.cancelBtn, { color: colors.muted }]}>Cancel</Text>
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
          <Text style={[s.fieldLabel, { color: colors.muted }]}>QUESTION TYPE</Text>
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
                  color={form.questionType === t ? colors.primary : colors.muted}
                />
                <Text style={[s.typeChipText, { color: form.questionType === t ? colors.primary : colors.muted }]}>
                  {TYPE_LABELS[t]}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Question text */}
          <Text style={[s.fieldLabel, { color: colors.muted }]}>QUESTION</Text>
          <TextInput
            style={[s.textArea, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]}
            value={form.questionText}
            onChangeText={(v) => set('questionText', v)}
            placeholder="Type the question players will see..."
            placeholderTextColor={colors.muted}
            multiline
            numberOfLines={3}
          />

          {/* Type-specific fields */}

          {/* Multiple Choice */}
          {(form.questionType === 'multiple_choice' || form.questionType === 'multi_select') && (
            <>
              <Text style={[s.fieldLabel, { color: colors.muted }]}>
                {form.questionType === 'multi_select' ? 'CHOICES (tap to mark correct)' : 'CHOICES (tap to mark correct)'}
              </Text>
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
                      placeholderTextColor={colors.muted}
                    />
                    {form.choices.length > 2 && (
                      <Pressable onPress={() => set('choices', form.choices.filter((_, j) => j !== i))} hitSlop={8}>
                        <Ionicons name="close-circle" size={18} color={colors.muted} />
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
              <Text style={[s.fieldLabel, { color: colors.muted }]}>CORRECT ANSWER</Text>
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
              <Text style={[s.fieldLabel, { color: colors.muted }]}>CORRECT ANSWER</Text>
              <TextInput
                style={[s.input, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]}
                value={form.correctAnswer}
                onChangeText={(v) => set('correctAnswer', v)}
                placeholder="The exact correct answer"
                placeholderTextColor={colors.muted}
              />
              <Text style={[s.fieldLabel, { color: colors.muted }]}>ALTERNATE ANSWERS (comma-separated)</Text>
              <TextInput
                style={[s.input, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]}
                value={form.alternateAnswers}
                onChangeText={(v) => set('alternateAnswers', v)}
                placeholder="e.g. NYC, The Big Apple"
                placeholderTextColor={colors.muted}
              />
            </>
          )}

          {/* Ordering */}
          {form.questionType === 'ordering' && (
            <>
              <Text style={[s.fieldLabel, { color: colors.muted }]}>ITEMS IN CORRECT ORDER</Text>
              {form.orderedItems.map((item, i) => (
                <View key={i} style={s.choiceRow}>
                  <Text style={[s.choiceLetter, { color: colors.muted }]}>{i + 1}</Text>
                  <TextInput
                    style={[s.choiceInput, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]}
                    value={item}
                    onChangeText={(v) => { const next = [...form.orderedItems]; next[i] = v; set('orderedItems', next); }}
                    placeholder={`Item ${i + 1}`}
                    placeholderTextColor={colors.muted}
                  />
                  <View style={s.orderBtns}>
                    <Pressable disabled={i === 0} onPress={() => {
                      const next = [...form.orderedItems];
                      [next[i - 1], next[i]] = [next[i], next[i - 1]];
                      set('orderedItems', next);
                    }} hitSlop={8}>
                      <Ionicons name="chevron-up" size={18} color={i === 0 ? colors.border : colors.muted} />
                    </Pressable>
                    <Pressable disabled={i === form.orderedItems.length - 1} onPress={() => {
                      const next = [...form.orderedItems];
                      [next[i], next[i + 1]] = [next[i + 1], next[i]];
                      set('orderedItems', next);
                    }} hitSlop={8}>
                      <Ionicons name="chevron-down" size={18} color={i === form.orderedItems.length - 1 ? colors.border : colors.muted} />
                    </Pressable>
                    {form.orderedItems.length > 2 && (
                      <Pressable onPress={() => set('orderedItems', form.orderedItems.filter((_, j) => j !== i))} hitSlop={8}>
                        <Ionicons name="close-circle" size={16} color={colors.muted} />
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
              <Text style={[s.fieldLabel, { color: colors.muted }]}>RANGE & CORRECT VALUE</Text>
              <View style={s.sliderRow}>
                {[
                  { label: 'Min', key: 'sliderMin' as const },
                  { label: 'Max', key: 'sliderMax' as const },
                  { label: 'Answer', key: 'sliderCorrect' as const },
                ].map(({ label, key }) => (
                  <View key={key} style={s.sliderField}>
                    <Text style={[s.sliderLabel, { color: colors.muted }]}>{label}</Text>
                    <TextInput
                      style={[s.sliderInput, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]}
                      value={form[key]}
                      onChangeText={(v) => set(key, v)}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={colors.muted}
                    />
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Matching */}
          {form.questionType === 'matching' && (
            <>
              <Text style={[s.fieldLabel, { color: colors.muted }]}>MATCHING PAIRS</Text>
              {form.pairs.map((pair, i) => (
                <View key={i} style={s.pairRow}>
                  <TextInput
                    style={[s.pairInput, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]}
                    value={pair.left}
                    onChangeText={(v) => { const next = [...form.pairs]; next[i] = { ...next[i], left: v }; set('pairs', next); }}
                    placeholder="Left"
                    placeholderTextColor={colors.muted}
                  />
                  <Ionicons name="arrow-forward" size={16} color={colors.muted} />
                  <TextInput
                    style={[s.pairInput, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]}
                    value={pair.right}
                    onChangeText={(v) => { const next = [...form.pairs]; next[i] = { ...next[i], right: v }; set('pairs', next); }}
                    placeholder="Right"
                    placeholderTextColor={colors.muted}
                  />
                  {form.pairs.length > 2 && (
                    <Pressable onPress={() => set('pairs', form.pairs.filter((_, j) => j !== i))} hitSlop={8}>
                      <Ionicons name="close-circle" size={18} color={colors.muted} />
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
              <Text style={[s.fieldLabel, { color: colors.muted }]}>IMAGE URL</Text>
              <TextInput
                style={[s.input, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]}
                value={form.imageUrl}
                onChangeText={(v) => set('imageUrl', v)}
                placeholder="https://example.com/image.jpg"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                keyboardType="url"
              />
              {form.questionType === 'image_recognition' && (
                <>
                  <Text style={[s.fieldLabel, { color: colors.muted }]}>CORRECT ANSWER</Text>
                  <TextInput
                    style={[s.input, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]}
                    value={form.correctAnswer}
                    onChangeText={(v) => set('correctAnswer', v)}
                    placeholder="What is in the image?"
                    placeholderTextColor={colors.muted}
                  />
                  <Text style={[s.fieldLabel, { color: colors.muted }]}>ALTERNATE ANSWERS (comma-separated)</Text>
                  <TextInput
                    style={[s.input, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]}
                    value={form.alternateAnswers}
                    onChangeText={(v) => set('alternateAnswers', v)}
                    placeholder="Alternate accepted answers"
                    placeholderTextColor={colors.muted}
                  />
                </>
              )}
              {form.questionType === 'image_hotspot' && !!form.imageUrl.trim() && (
                <>
                  <Text style={[s.fieldLabel, { color: colors.muted }]}>TAP IMAGE TO SET HOTSPOT</Text>
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
                <Text style={[s.hint, { color: colors.muted }]}>Enter an image URL above to set the hotspot location.</Text>
              )}
            </>
          )}

          {/* Points & Source */}
          <Text style={[s.fieldLabel, { color: colors.muted }]}>POINTS</Text>
          <TextInput
            style={[s.input, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border, width: 120 }]}
            value={form.points}
            onChangeText={(v) => set('points', v)}
            keyboardType="numeric"
            placeholder="10"
            placeholderTextColor={colors.muted}
          />

          <Text style={[s.fieldLabel, { color: colors.muted }]}>SOURCE (optional)</Text>
          <TextInput
            style={[s.input, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]}
            value={form.source}
            onChangeText={(v) => set('source', v)}
            placeholder="e.g. Wikipedia — Capital cities"
            placeholderTextColor={colors.muted}
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
        {/* Hotspot marker */}
        {size.w > 0 && (
          <View pointerEvents="none" style={[StyleSheet.absoluteFill]}>
            <View style={{
              position: 'absolute',
              left: x * size.w - 12,
              top: y * size.h - 12,
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
  const [deletingId, setDeletingId] = useState<number | null>(null);

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

  const handleReorder = async (idx: number, dir: 'up' | 'down') => {
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sortedQs.length) return;
    const a = sortedQs[idx]!;
    const b = sortedQs[swapIdx]!;
    await Promise.all([
      updateQuestion.mutateAsync({ questionId: a.id, data: { orderIndex: b.orderIndex ?? swapIdx } }),
      updateQuestion.mutateAsync({ questionId: b.id, data: { orderIndex: a.orderIndex ?? idx } }),
    ]);
    invalidate();
  };

  const handleSaveRoomCode = async () => {
    if (!roomCode.trim()) return;
    try {
      await updateGame.mutateAsync({ gameId, data: { accessCode: roomCode.trim().toUpperCase() } });
      qc.invalidateQueries({ queryKey: getListGamesQueryKey() });
      setEditingRoomCode(false);
    } catch {
      // silently ignore for now
    }
  };

  const handleStatusChange = async (status: 'waiting' | 'active' | 'completed') => {
    await updateGame.mutateAsync({ gameId, data: { status } });
    qc.invalidateQueries({ queryKey: getListGamesQueryKey() });
    if (status === 'active') router.push(`/admin/live/${gameId}`);
    if (status === 'completed') router.push(`/admin/results/${gameId}`);
  };

  const s = styles(colors);

  const initialForm = useMemo(
    () => editingQuestion ? formFromQuestion(editingQuestion) : emptyForm(),
    [editingQuestion],
  );

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color={colors.foreground} />
        </Pressable>
        <View style={s.headerCenter}>
          <Text style={[s.headerTitle, { color: colors.foreground }]} numberOfLines={1}>
            {game?.topic ?? 'Game'}
          </Text>
          {game && (
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
        <Ionicons name="key-outline" size={16} color={colors.muted} />
        {editingRoomCode ? (
          <>
            <TextInput
              style={[s.roomInput, { color: colors.foreground, borderColor: colors.primary }]}
              value={roomCode}
              onChangeText={setRoomCode}
              autoCapitalize="characters"
              autoFocus
              placeholder="NEW CODE"
              placeholderTextColor={colors.muted}
              returnKeyType="done"
              onSubmitEditing={handleSaveRoomCode}
            />
            <Pressable onPress={handleSaveRoomCode}>
              <Ionicons name="checkmark-circle" size={22} color={colors.secondary} />
            </Pressable>
            <Pressable onPress={() => setEditingRoomCode(false)}>
              <Ionicons name="close-circle" size={22} color={colors.muted} />
            </Pressable>
          </>
        ) : (
          <>
            <Text style={[s.roomCode, { color: colors.accent }]}>{game?.accessCode ?? '——'}</Text>
            <Pressable onPress={() => { setRoomCode(game?.accessCode ?? ''); setEditingRoomCode(true); }} hitSlop={8}>
              <Ionicons name="pencil" size={16} color={colors.muted} />
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

      {/* Questions */}
      {isLoading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.list}>
          <View style={s.listHeader}>
            <Text style={[s.listTitle, { color: colors.foreground }]}>
              {sortedQs.length} Question{sortedQs.length !== 1 ? 's' : ''}
            </Text>
            <Pressable style={[s.addBtn, { backgroundColor: colors.primary }]} onPress={openAdd}>
              <Ionicons name="add" size={16} color="#fff" />
              <Text style={s.addBtnText}>Add</Text>
            </Pressable>
          </View>

          {sortedQs.length === 0 && (
            <View style={s.emptyBox}>
              <Ionicons name="help-circle-outline" size={40} color={colors.muted} />
              <Text style={[s.emptyText, { color: colors.muted }]}>No questions yet</Text>
              <Pressable style={[s.addBtn, { backgroundColor: colors.primary }]} onPress={openAdd}>
                <Ionicons name="add" size={16} color="#fff" />
                <Text style={s.addBtnText}>Add first question</Text>
              </Pressable>
            </View>
          )}

          {sortedQs.map((q, idx) => {
            const qtype = q.questionType as QType;
            return (
              <View key={q.id} style={[s.qCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={s.qHeader}>
                  <View style={[s.typeTag, { backgroundColor: colors.primary + '22' }]}>
                    <Ionicons name={TYPE_ICONS[qtype] as 'checkmark-circle'} size={12} color={colors.primary} />
                    <Text style={[s.typeTagText, { color: colors.primary }]}>{TYPE_LABELS[qtype]}</Text>
                  </View>
                  <Text style={[s.qPoints, { color: colors.accent }]}>{q.points}pts</Text>
                  <Text style={[s.qNum, { color: colors.muted }]}>#{idx + 1}</Text>
                </View>

                <Text style={[s.qText, { color: colors.foreground }]} numberOfLines={2}>
                  {q.questionText}
                </Text>

                <View style={s.qActions}>
                  {/* Reorder */}
                  <View style={s.reorderBtns}>
                    <Pressable disabled={idx === 0} onPress={() => handleReorder(idx, 'up')} hitSlop={8}>
                      <Ionicons name="chevron-up" size={18} color={idx === 0 ? colors.border : colors.muted} />
                    </Pressable>
                    <Pressable disabled={idx === sortedQs.length - 1} onPress={() => handleReorder(idx, 'down')} hitSlop={8}>
                      <Ionicons name="chevron-down" size={18} color={idx === sortedQs.length - 1 ? colors.border : colors.muted} />
                    </Pressable>
                  </View>

                  <Pressable style={[s.qActionBtn, { borderColor: colors.border }]} onPress={() => openEdit(q)}>
                    <Ionicons name="pencil" size={15} color={colors.foreground} />
                    <Text style={[s.qActionText, { color: colors.foreground }]}>Edit</Text>
                  </Pressable>

                  {deletingId === q.id ? (
                    <ActivityIndicator size="small" color={colors.destructive} />
                  ) : (
                    <Pressable style={[s.qActionBtn, { borderColor: colors.destructive + '44' }]} onPress={() => handleDelete(q.id)}>
                      <Ionicons name="trash-outline" size={15} color={colors.destructive} />
                    </Pressable>
                  )}
                </View>
              </View>
            );
          })}

          <View style={{ height: insets.bottom + 24 }} />
        </ScrollView>
      )}

      {/* Question form modal */}
      <QuestionFormModal
        visible={formOpen}
        initial={initialForm}
        onClose={() => setFormOpen(false)}
        onSave={handleSave}
        pending={createQuestion.isPending || updateQuestion.isPending}
        title={editingQuestion ? 'Edit Question' : 'New Question'}
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
    roomRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 12, borderRadius: 14, borderWidth: 1, padding: 12 },
    roomCode: { flex: 1, fontSize: 15, fontFamily: 'Manrope_700Bold', letterSpacing: 3 },
    roomInput: { flex: 1, fontSize: 15, fontFamily: 'Manrope_700Bold', letterSpacing: 3, borderBottomWidth: 1, paddingVertical: 2 },
    statusActions: { flexDirection: 'row', gap: 6 },
    actionChip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
    actionChipText: { fontSize: 12, fontFamily: 'Manrope_600SemiBold' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    list: { paddingHorizontal: 16, gap: 10 },
    listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
    listTitle: { fontSize: 16, fontFamily: 'Manrope_700Bold' },
    addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
    addBtnText: { color: '#fff', fontSize: 14, fontFamily: 'Manrope_600SemiBold' },
    emptyBox: { alignItems: 'center', gap: 12, paddingVertical: 40 },
    emptyText: { fontSize: 15, fontFamily: 'Manrope_500Medium' },
    qCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 10 },
    qHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    typeTag: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
    typeTagText: { fontSize: 11, fontFamily: 'Manrope_700Bold' },
    qPoints: { marginLeft: 'auto', fontSize: 13, fontFamily: 'Manrope_600SemiBold' },
    qNum: { fontSize: 12 },
    qText: { fontSize: 14, lineHeight: 20 },
    qActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    reorderBtns: { flexDirection: 'row', gap: 2 },
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
    fieldLabel: { fontSize: 11, fontFamily: 'Manrope_700Bold', letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 8 },
    typeScroll: { marginBottom: 4 },
    typeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, marginRight: 8 },
    typeChipText: { fontSize: 13, fontFamily: 'Manrope_600SemiBold' },
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
    saveRow: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
    saveRowText: { color: '#fff', fontSize: 16, fontFamily: 'Manrope_700Bold' },
  });
