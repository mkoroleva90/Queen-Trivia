import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import {
  getGetGameQueryKey,
  getListGameParticipantsQueryKey,
  getListGameQuestionsQueryKey,
  getListUserAnswersQueryKey,
  useGetGame,
  useListGameParticipants,
  useListGameQuestions,
  useListUserAnswers,
  useSubmitAnswer,
} from '@workspace/api-client-react';
import type { Question } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { useGameSocket } from '@/hooks/useSocket';
import { COPY } from '@workspace/copy';

// ─── Types ────────────────────────────────────────────────────────────────────

type Feedback = {
  isCorrect: boolean;
  pointsEarned: number;
  totalScore: number;
  timeTaken: string;
  correctAnswer?: string;
  feedback?: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

const CHOICE_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

// ─── Multiple Choice ──────────────────────────────────────────────────────────

function MultipleChoiceQ({
  question, onSubmit, disabled, lockedAnswer, feedback,
}: { question: Question; onSubmit: (a: string) => void; disabled: boolean; lockedAnswer: string | null; feedback: Feedback | null }) {
  const colors = useColors();
  const opts = question.options as { choices?: string[] } | null;
  const choices = opts?.choices ?? [];
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => { setSelected(null); }, [question.id]);
  const answered = !!lockedAnswer;

  return (
    <View style={styles.choicesContainer}>
      {choices.map((choice, i) => {
        const isLocked       = lockedAnswer === choice;
        const isCorrectChoice = isLocked && !!feedback?.isCorrect;
        const isWrongChoice   = isLocked && feedback !== null && !feedback.isCorrect;
        const isDimmed = answered && !isLocked;
        const isSel = !answered && selected === choice;

        let bg = 'rgba(255,255,255,.04)';
        let border = 'rgba(255,255,255,.1)';
        let badgeBg = 'transparent';
        let badgeText = colors.mutedForeground;
        let trailing: React.ReactNode = null;

        if (isCorrectChoice) { bg = 'rgba(0,221,255,.15)'; border = '#00ddff'; badgeBg = '#00ddff'; badgeText = '#0a0510'; trailing = <Ionicons name="checkmark" size={18} color="#00ddff" />; }
        else if (isWrongChoice) { bg = 'rgba(255,0,128,.15)'; border = colors.primary; badgeBg = colors.primary; badgeText = '#fff'; trailing = <Ionicons name="close" size={18} color={colors.primary} />; }
        else if (isSel) { bg = 'rgba(255,0,128,.12)'; border = colors.primary; badgeBg = colors.primary; badgeText = '#fff'; }

        return (
          <TouchableOpacity
            key={choice}
            activeOpacity={0.85}
            disabled={disabled || answered}
            onPress={() => setSelected(choice)}
            style={[styles.choiceBtn, { backgroundColor: bg, borderColor: border, opacity: isDimmed ? 0.45 : 1 }]}
          >
            <View style={[styles.choiceBadge, { backgroundColor: badgeBg, borderColor: badgeText === colors.mutedForeground ? 'rgba(255,255,255,.3)' : badgeBg }]}>
              <Text style={[styles.choiceBadgeText, { color: badgeText }]}>{CHOICE_LABELS[i]}</Text>
            </View>
            <Text style={[styles.choiceText, { color: colors.foreground }]}>{choice}</Text>
            {trailing}
          </TouchableOpacity>
        );
      })}
      {!answered && selected && !disabled && (
        <TouchableOpacity
          onPress={() => onSubmit(selected)}
          style={[styles.confirmBtn, { backgroundColor: colors.primary }]}
        >
          <Text style={styles.confirmBtnText}>Confirm: {selected}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Multi-Select ─────────────────────────────────────────────────────────────

function MultiSelectQ({
  question, onSubmit, disabled, lockedAnswer,
}: { question: Question; onSubmit: (a: string) => void; disabled: boolean; lockedAnswer: string | null }) {
  const colors = useColors();
  const opts = question.options as { choices?: string[] } | null;
  const choices = opts?.choices ?? [];
  const [selected, setSelected] = useState<string[]>([]);
  useEffect(() => { setSelected([]); }, [question.id]);
  const answered = !!lockedAnswer;
  const lockedSet = answered ? new Set(lockedAnswer.split('|').map((s) => s.trim())) : new Set<string>();

  return (
    <View style={styles.choicesContainer}>
      <Text style={[styles.hint, { color: colors.mutedForeground }]}>{COPY.gameplay.hintSelectAll}</Text>
      {choices.map((choice, i) => {
        const isLocked = lockedSet.has(choice);
        const isDimmed = answered && !isLocked;
        const isSel = !answered && selected.includes(choice);

        let bg = 'rgba(255,255,255,.04)';
        let border = 'rgba(255,255,255,.1)';

        if (answered && isLocked) { bg = 'rgba(0,221,255,.15)'; border = '#00ddff'; }
        else if (isSel) { bg = 'rgba(0,221,255,.12)'; border = colors.secondary; }

        return (
          <TouchableOpacity
            key={choice}
            activeOpacity={0.85}
            disabled={disabled || answered}
            onPress={() => setSelected((prev) => prev.includes(choice) ? prev.filter((c) => c !== choice) : [...prev, choice])}
            style={[styles.choiceBtn, { backgroundColor: bg, borderColor: border, opacity: isDimmed ? 0.45 : 1 }]}
          >
            <View style={[styles.choiceBadge, { backgroundColor: isSel || (answered && isLocked) ? colors.secondary : 'transparent', borderColor: 'rgba(255,255,255,.3)' }]}>
              <Text style={[styles.choiceBadgeText, { color: isSel || (answered && isLocked) ? colors.secondaryForeground : colors.mutedForeground }]}>{CHOICE_LABELS[i]}</Text>
            </View>
            <Text style={[styles.choiceText, { color: colors.foreground }]}>{choice}</Text>
            {answered && isLocked && <Ionicons name="checkmark" size={18} color={colors.secondary} />}
          </TouchableOpacity>
        );
      })}
      {!answered && selected.length > 0 && (
        <TouchableOpacity
          onPress={() => onSubmit([...selected].sort().join('|'))}
          style={[styles.confirmBtn, { backgroundColor: colors.primary }]}
        >
          <Text style={styles.confirmBtnText}>Confirm {selected.length} selection{selected.length !== 1 ? 's' : ''}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── True/False ───────────────────────────────────────────────────────────────

function TrueFalseQ({
  onSubmit, disabled, lockedAnswer,
}: { onSubmit: (a: string) => void; disabled: boolean; lockedAnswer: string | null }) {
  const colors = useColors();
  const answered = !!lockedAnswer;

  return (
    <View style={styles.tfContainer}>
      {(['true', 'false'] as const).map((val) => {
        const isLocked = lockedAnswer === val;
        const isDimmed = answered && !isLocked;
        const cfg = val === 'true'
          ? { bg: 'rgba(0,221,255,.15)', border: colors.secondary, label: COPY.gameplay.tfTrue, icon: 'checkmark-circle' as const }
          : { bg: 'rgba(255,0,128,.15)', border: colors.primary, label: COPY.gameplay.tfFalse, icon: 'close-circle' as const };

        return (
          <TouchableOpacity
            key={val}
            activeOpacity={0.85}
            disabled={disabled || answered}
            onPress={() => onSubmit(val)}
            style={[
              styles.tfBtn,
              { backgroundColor: isLocked ? cfg.bg : 'rgba(255,255,255,.04)', borderColor: isLocked ? cfg.border : 'rgba(255,255,255,.1)', opacity: isDimmed ? 0.4 : 1 },
            ]}
          >
            <Ionicons name={cfg.icon} size={28} color={isLocked ? cfg.border : colors.mutedForeground} />
            <Text style={[styles.tfLabel, { color: isLocked ? cfg.border : colors.foreground }]}>{cfg.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Write-In / Short Response ────────────────────────────────────────────────

function WriteInQ({
  onSubmit, disabled, lockedAnswer, multiline = false,
}: { onSubmit: (a: string) => void; disabled: boolean; lockedAnswer: string | null; multiline?: boolean }) {
  const colors = useColors();
  const [value, setValue] = useState('');
  useEffect(() => { setValue(''); }, [disabled]);
  const answered = !!lockedAnswer;

  return (
    <View style={styles.writeInContainer}>
      <TextInput
        style={[
          styles.writeInInput,
          { backgroundColor: colors.card, color: colors.foreground, borderColor: answered ? colors.muted : colors.secondary },
          multiline && { height: 120, textAlignVertical: 'top' },
        ]}
        value={answered ? lockedAnswer : value}
        onChangeText={setValue}
        placeholder={multiline ? 'Your answer...' : 'Type your answer'}
        placeholderTextColor={colors.mutedForeground}
        editable={!answered && !disabled}
        multiline={multiline}
        returnKeyType={multiline ? 'default' : 'done'}
        onSubmitEditing={!multiline ? () => value.trim() && onSubmit(value.trim()) : undefined}
      />
      {!answered && (
        <TouchableOpacity
          onPress={() => value.trim() && onSubmit(value.trim())}
          disabled={!value.trim() || disabled}
          style={[styles.confirmBtn, { backgroundColor: colors.secondary, opacity: !value.trim() ? 0.5 : 1 }]}
        >
          <Text style={[styles.confirmBtnText, { color: colors.secondaryForeground }]}>{COPY.gameplay.btnLockItIn}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Ordering ─────────────────────────────────────────────────────────────────

function OrderingQ({
  question, onSubmit, disabled, lockedAnswer,
}: { question: Question; onSubmit: (a: string) => void; disabled: boolean; lockedAnswer: string | null }) {
  const colors = useColors();
  const opts = question.options as { items?: string[] } | null;
  const correct = opts?.items ?? [];
  const [items, setItems] = useState<string[]>(() => shuffle(correct));
  useEffect(() => { setItems(shuffle(correct)); }, [question.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const answered = !!lockedAnswer;
  const display = answered ? lockedAnswer.split('|').map((s) => s.trim()).filter(Boolean) : items;

  const moveUp = (idx: number) => {
    if (idx === 0 || answered) return;
    Haptics.selectionAsync();
    const next = [...items];
    [next[idx - 1], next[idx]] = [next[idx]!, next[idx - 1]!];
    setItems(next);
  };

  const moveDown = (idx: number) => {
    if (idx === items.length - 1 || answered) return;
    Haptics.selectionAsync();
    const next = [...items];
    [next[idx], next[idx + 1]] = [next[idx + 1]!, next[idx]!];
    setItems(next);
  };

  return (
    <View style={styles.choicesContainer}>
      <Text style={[styles.hint, { color: colors.mutedForeground }]}>{COPY.gameplay.hintArrangeOrder}</Text>
      {display.map((item, i) => (
        <View
          key={item}
          style={[styles.orderItem, { backgroundColor: 'rgba(255,255,255,.04)', borderColor: 'rgba(255,255,255,.1)' }]}
        >
          <View style={[styles.orderNum, { backgroundColor: 'rgba(255,255,255,.08)' }]}>
            <Text style={[styles.orderNumText, { color: colors.mutedForeground }]}>{i + 1}</Text>
          </View>
          <Text style={[styles.choiceText, { color: colors.foreground, flex: 1 }]}>{item}</Text>
          {!answered && (
            <View style={styles.orderControls}>
              <TouchableOpacity onPress={() => moveUp(i)} disabled={i === 0} hitSlop={6}>
                <Ionicons name="chevron-up" size={20} color={i === 0 ? colors.muted : colors.mutedForeground} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => moveDown(i)} disabled={i === items.length - 1} hitSlop={6}>
                <Ionicons name="chevron-down" size={20} color={i === items.length - 1 ? colors.muted : colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      ))}
      {!answered && (
        <TouchableOpacity
          onPress={() => onSubmit(items.join('|'))}
          disabled={disabled}
          style={[styles.confirmBtn, { backgroundColor: colors.accent }]}
        >
          <Text style={[styles.confirmBtnText, { color: colors.accentForeground }]}>{COPY.gameplay.btnLockInOrder}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Slider ───────────────────────────────────────────────────────────────────

function SliderQ({
  question, onSubmit, disabled, lockedAnswer,
}: { question: Question; onSubmit: (a: string) => void; disabled: boolean; lockedAnswer: string | null }) {
  const colors = useColors();
  const opts = question.options as { min?: number; max?: number; step?: number; unit?: string } | null;
  const min = opts?.min ?? 0;
  const max = opts?.max ?? 100;
  const step = opts?.step ?? 1;
  const unit = opts?.unit ?? '';
  const [value, setValue] = useState(Math.round((min + max) / 2));
  const trackWidth = useRef(280);
  const answered = !!lockedAnswer;
  const displayVal = answered ? Number(lockedAnswer) : value;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !answered && !disabled,
      onMoveShouldSetPanResponder: () => !answered && !disabled,
      onPanResponderMove: (_, gs) => {
        const ratio = Math.min(1, Math.max(0, gs.moveX / trackWidth.current));
        const raw = min + ratio * (max - min);
        const stepped = Math.round(raw / step) * step;
        setValue(Math.min(max, Math.max(min, stepped)));
      },
    }),
  ).current;

  const ratio = (displayVal - min) / (max - min);

  return (
    <View style={styles.sliderContainer}>
      <Text style={[styles.sliderValue, { color: colors.foreground }]}>
        {displayVal}{unit ? ` ${unit}` : ''}
      </Text>
      <View
        style={styles.sliderTrack}
        onLayout={(e) => { trackWidth.current = e.nativeEvent.layout.width; }}
        {...panResponder.panHandlers}
      >
        <View style={[styles.sliderFill, { width: `${ratio * 100}%` as unknown as number, backgroundColor: colors.accent }]} />
        <View style={[styles.sliderKnob, { left: `${ratio * 100}%` as unknown as number, backgroundColor: colors.accent, borderColor: colors.background }]} />
      </View>
      <View style={styles.sliderLabels}>
        <Text style={[styles.sliderLabel, { color: colors.mutedForeground }]}>{min}{unit}</Text>
        <Text style={[styles.sliderLabel, { color: colors.mutedForeground }]}>{max}{unit}</Text>
      </View>
      {!answered && (
        <TouchableOpacity
          onPress={() => onSubmit(String(value))}
          disabled={disabled}
          style={[styles.confirmBtn, { backgroundColor: colors.accent }]}
        >
          <Text style={[styles.confirmBtnText, { color: colors.accentForeground }]}>Submit: {value}{unit}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Image Recognition (text answer) ─────────────────────────────────────────

function ImageRecognitionQ({
  question, onSubmit, disabled, lockedAnswer,
}: { question: Question; onSubmit: (a: string) => void; disabled: boolean; lockedAnswer: string | null }) {
  const colors = useColors();
  const [answer, setAnswer] = useState(lockedAnswer ?? '');
  const answered = !!lockedAnswer;

  return (
    <View style={styles.writeInContainer}>
      {question.imageUrl ? (
        <Image
          source={{ uri: question.imageUrl }}
          style={{ width: '100%', height: 180, borderRadius: 14 }}
          resizeMode="cover"
        />
      ) : (
        <View style={{ width: '100%', height: 120, borderRadius: 14, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="image-outline" size={36} color={colors.mutedForeground} />
        </View>
      )}
      <Text style={[styles.hint, { color: colors.mutedForeground }]}>{COPY.gameplay.hintTypeBelow}</Text>
      <TextInput
        style={[styles.writeInInput, {
          backgroundColor: colors.card,
          color: colors.foreground,
          borderColor: answered ? colors.secondary : colors.border,
        }]}
        value={answer}
        onChangeText={setAnswer}
        placeholder="Your answer…"
        placeholderTextColor={colors.mutedForeground}
        editable={!disabled && !answered}
        returnKeyType="done"
        onSubmitEditing={() => { if (answer.trim() && !answered) onSubmit(answer.trim()); }}
      />
      {!answered && (
        <TouchableOpacity
          onPress={() => { if (answer.trim()) onSubmit(answer.trim()); }}
          disabled={disabled || !answer.trim()}
          style={[styles.confirmBtn, { backgroundColor: colors.secondary, opacity: (!answer.trim() || disabled) ? 0.5 : 1 }]}
        >
          <Text style={styles.confirmBtnText}>{COPY.gameplay.btnLockItIn}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Image Hotspot ────────────────────────────────────────────────────────────

function ImageHotspotQ({
  question, onSubmit, disabled, lockedAnswer,
}: { question: Question; onSubmit: (a: string) => void; disabled: boolean; lockedAnswer: string | null }) {
  const colors = useColors();
  const [pin, setPin] = useState<{ x: number; y: number } | null>(null);
  const imgSize = useRef({ w: 0, h: 0 });
  const answered = !!lockedAnswer;

  const lockedPin = answered
    ? (() => {
        const [x, y] = lockedAnswer.split(',').map(Number);
        return isNaN(x) || isNaN(y) ? null : { x: x / 100, y: y / 100 };
      })()
    : null;

  const displayPin = lockedPin ?? pin;

  const handlePress = (e: { nativeEvent: { locationX: number; locationY: number } }) => {
    if (disabled || answered) return;
    const { locationX, locationY } = e.nativeEvent;
    const { w, h } = imgSize.current;
    if (!w || !h) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPin({ x: locationX / w, y: locationY / h });
  };

  return (
    <View style={styles.hotspotContainer}>
      <Text style={[styles.hint, { color: colors.mutedForeground }]}>{COPY.gameplay.hintTapImage}</Text>
      <TouchableOpacity
        activeOpacity={1}
        onPress={handlePress as never}
        style={styles.hotspotImage}
        onLayout={(e) => {
          imgSize.current = { w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height };
        }}
      >
        {question.imageUrl ? (
          <Image source={{ uri: question.imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' }]}>
            <Ionicons name="image-outline" size={40} color={colors.mutedForeground} />
          </View>
        )}
        {displayPin && (
          <View style={[styles.hotspotPin, { left: displayPin.x * imgSize.current.w - 12, top: displayPin.y * imgSize.current.h - 12, backgroundColor: answered ? colors.accent : colors.primary }]} />
        )}
      </TouchableOpacity>
      {!answered && pin && (
        <TouchableOpacity
          onPress={() => onSubmit(`${(pin.x * 100).toFixed(1)},${(pin.y * 100).toFixed(1)}`)}
          disabled={disabled}
          style={[styles.confirmBtn, { backgroundColor: colors.primary }]}
        >
          <Text style={styles.confirmBtnText}>{COPY.gameplay.btnConfirmLocation}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Matching ────────────────────────────────────────────────────────────────

function MatchingQ({
  question, onSubmit, disabled, lockedAnswer,
}: { question: Question; onSubmit: (a: string) => void; disabled: boolean; lockedAnswer: string | null }) {
  const colors = useColors();
  const opts = question.options as { pairs?: { left: string; right: string }[] } | null;
  const pairs = opts?.pairs ?? [];
  const leftItems = pairs.map((p) => p.left);
  const rightItems = useMemo(() => shuffle(pairs.map((p) => p.right)), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [matched, setMatched] = useState<Record<string, string>>({});
  const answered = !!lockedAnswer;

  const handleLeft = (item: string) => {
    if (answered || disabled) return;
    setSelectedLeft(item === selectedLeft ? null : item);
    Haptics.selectionAsync();
  };

  const handleRight = (item: string) => {
    if (answered || disabled || !selectedLeft) return;
    const existing = Object.entries(matched).find(([, v]) => v === item);
    const next = { ...matched };
    if (existing) delete next[existing[0]];
    next[selectedLeft] = item;
    setMatched(next);
    setSelectedLeft(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const allMatched = Object.keys(matched).length === leftItems.length;

  return (
    <View style={styles.matchContainer}>
      <Text style={[styles.hint, { color: colors.mutedForeground }]}>{COPY.gameplay.hintMatchPairs}</Text>
      <View style={styles.matchColumns}>
        <View style={styles.matchColumn}>
          {leftItems.map((item) => {
            const isSelected = selectedLeft === item;
            const isMatched = !!matched[item];
            return (
              <TouchableOpacity
                key={item}
                onPress={() => handleLeft(item)}
                style={[
                  styles.matchItem,
                  { borderColor: isSelected ? colors.accent : isMatched ? colors.secondary : 'rgba(255,255,255,.1)', backgroundColor: isSelected ? 'rgba(255,229,0,.1)' : isMatched ? 'rgba(0,221,255,.1)' : 'rgba(255,255,255,.04)' },
                ]}
              >
                <Text style={[styles.matchItemText, { color: colors.foreground }]}>{item}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={styles.matchColumn}>
          {rightItems.map((item) => {
            const isMatched = Object.values(matched).includes(item);
            return (
              <TouchableOpacity
                key={item}
                onPress={() => handleRight(item)}
                style={[
                  styles.matchItem,
                  { borderColor: isMatched ? colors.secondary : 'rgba(255,255,255,.1)', backgroundColor: isMatched ? 'rgba(0,221,255,.1)' : 'rgba(255,255,255,.04)' },
                ]}
              >
                <Text style={[styles.matchItemText, { color: colors.foreground }]}>{item}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
      {!answered && allMatched && (
        <TouchableOpacity
          onPress={() => onSubmit(leftItems.map((l) => `${l}:${matched[l]}`).join('|'))}
          disabled={disabled}
          style={[styles.confirmBtn, { backgroundColor: colors.secondary }]}
        >
          <Text style={[styles.confirmBtnText, { color: colors.secondaryForeground }]}>{COPY.gameplay.btnLockInMatches}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Feedback Overlay ─────────────────────────────────────────────────────────

function FeedbackCard({ feedback, onNext, isLast }: { feedback: Feedback; onNext: () => void; isLast: boolean }) {
  const colors = useColors();
  return (
    <View style={[styles.feedbackCard, { backgroundColor: feedback.isCorrect ? 'rgba(0,221,255,.12)' : 'rgba(255,0,128,.12)', borderColor: feedback.isCorrect ? colors.secondary : colors.primary }]}>
      <View style={styles.feedbackRow}>
        <Ionicons
          name={feedback.isCorrect ? 'checkmark-circle' : 'close-circle'}
          size={32}
          color={feedback.isCorrect ? colors.secondary : colors.primary}
        />
        <View>
          <Text style={[styles.feedbackTitle, { color: feedback.isCorrect ? colors.secondary : colors.primary }]}>
            {feedback.isCorrect ? COPY.gameplay.feedbackCorrect : COPY.gameplay.feedbackWrong}
          </Text>
          <Text style={[styles.feedbackPoints, { color: colors.foreground }]}>
            +{feedback.pointsEarned} pts · {feedback.timeTaken}s
          </Text>
        </View>
        <Text style={[styles.feedbackScore, { color: colors.accent }]}>{feedback.totalScore}</Text>
      </View>
      {feedback.correctAnswer && !feedback.isCorrect && (
        <Text style={[styles.feedbackCorrect, { color: colors.mutedForeground }]}>
          Correct: <Text style={{ color: colors.secondary }}>{feedback.correctAnswer}</Text>
        </Text>
      )}
      {feedback.feedback && (
        <Text style={[styles.feedbackAI, { color: colors.mutedForeground }]}>{feedback.feedback}</Text>
      )}
      <TouchableOpacity
        onPress={onNext}
        style={[styles.feedbackBtn, { backgroundColor: feedback.isCorrect ? colors.secondary : colors.muted }]}
      >
        <Text style={[styles.feedbackBtnText, { color: feedback.isCorrect ? colors.secondaryForeground : colors.foreground }]}>
          {isLast ? COPY.gameplay.feedbackSeeResults : COPY.gameplay.feedbackNext}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function GamePlayScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const gameId = Number(id);
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id ?? 0;
  const queryClient = useQueryClient();
  const questionStartRef = useRef(Date.now());

  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [lockedAnswer, setLockedAnswer] = useState<string | null>(null);
  const [skippedIds, setSkippedIds] = useState<Set<number>>(new Set());
  const [skipConfirm, setSkipConfirm] = useState(false);

  const { data: game } = useGetGame(gameId, {
    query: { enabled: !!gameId, queryKey: getGetGameQueryKey(gameId), refetchInterval: 10000 },
  });
  const { data: questions } = useListGameQuestions(gameId, {
    query: { enabled: !!gameId, queryKey: getListGameQuestionsQueryKey(gameId), refetchInterval: 10000 },
  });
  const { data: myAnswers } = useListUserAnswers(gameId, userId, {
    query: { enabled: !!gameId && !!userId, queryKey: getListUserAnswersQueryKey(gameId, userId), refetchInterval: 5000 },
  });
  const { data: participants } = useListGameParticipants(gameId, {
    query: { enabled: !!gameId, queryKey: getListGameParticipantsQueryKey(gameId), refetchInterval: 8000 },
  });

  const submitAnswer = useSubmitAnswer();

  useGameSocket(gameId || null, {
    onAnswerSubmitted: () => {
      queryClient.invalidateQueries({ queryKey: getListGameParticipantsQueryKey(gameId) });
    },
    onGameEnded: () => {
      setTimeout(() => router.replace(`/results/${gameId}`), 1000);
    },
  });

  const sorted = useMemo(
    () => [...(questions ?? [])].sort((a, b) => a.orderIndex - b.orderIndex),
    [questions],
  );
  const answeredIds = useMemo(() => new Set((myAnswers ?? []).map((a) => a.questionId)), [myAnswers]);
  const unanswered = sorted.filter((q) => !answeredIds.has(q.id));
  const current = unanswered.find((q) => !skippedIds.has(q.id)) ?? unanswered[0];
  const answeredCount = sorted.filter((q) => answeredIds.has(q.id)).length;
  const total = sorted.length;
  const isLastQuestion = !!current && sorted.indexOf(current) === total - 1;
  const canSkip = unanswered.length > 1;
  const myScore = participants?.find((p) => p.userId === userId)?.totalScore ?? 0;

  useEffect(() => {
    if (current?.id) {
      questionStartRef.current = Date.now();
      setFeedback(null);
      setLockedAnswer(null);
    }
  }, [current?.id]);

  // Navigate to results if game is completed and all answered
  useEffect(() => {
    if (game?.status === 'completed' && !current && answeredCount === total && total > 0) {
      router.replace(`/results/${gameId}`);
    }
  }, [game?.status, current, answeredCount, total, gameId, router]);

  const handleSubmit = (answer: string) => {
    if (!current || !answer.trim() || submitAnswer.isPending) return;
    const timeTaken = ((Date.now() - questionStartRef.current) / 1000).toFixed(1);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    submitAnswer.mutate(
      { gameId, data: { questionId: current.id, userAnswer: answer } },
      {
        onSuccess: (res) => {
          const r = res as typeof res & { correctAnswer?: string; feedback?: string };
          setFeedback({
            isCorrect: res.isCorrect,
            pointsEarned: res.pointsEarned,
            totalScore: res.totalScore,
            timeTaken,
            correctAnswer: r.correctAnswer,
            feedback: r.feedback,
          });
          setLockedAnswer(answer);
          Haptics.notificationAsync(res.isCorrect ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error);
          queryClient.invalidateQueries({ queryKey: getListGameParticipantsQueryKey(gameId) });
        },
        onError: (err: unknown) => {
          const status = err && typeof err === 'object' && 'status' in err ? (err as { status: number }).status : 0;
          if (status === 409) { handleNext(); return; }
          const errData = err && typeof err === 'object' && 'data' in err ? (err as { data: unknown }).data : null;
          const apiMsg = errData && typeof errData === 'object' && 'error' in errData ? String((errData as { error: unknown }).error) : null;
          const errCode = errData && typeof errData === 'object' && 'code' in errData ? String((errData as { code: unknown }).code) : null;
          if (errCode === 'content_filtered' && apiMsg) {
            Alert.alert('Answer not submitted', apiMsg);
          }
        },
      },
    );
  };

  const handleNext = () => {
    if (isLastQuestion || !current) {
      router.replace(`/results/${gameId}`);
      return;
    }
    queryClient.invalidateQueries({ queryKey: getListUserAnswersQueryKey(gameId, userId) });
    setFeedback(null);
    setLockedAnswer(null);
  };

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  if (!current && answeredCount === 0 && total === 0) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: topPad, paddingBottom: botPad }]}>
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 80 }} />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.gameHeader, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity
          onPress={() => {
            if (current && !lockedAnswer) {
              Alert.alert(
                'Leave game?',
                "You'll lose your progress on the current question. You can rejoin with a room code.",
                [
                  { text: 'Stay', style: 'cancel' },
                  { text: 'Leave', style: 'destructive', onPress: () => router.replace('/') },
                ],
              );
            } else {
              router.replace('/');
            }
          }}
          hitSlop={12}
        >
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.gameHeaderCenter}>
          <Text style={[styles.gameHeaderTitle, { color: colors.foreground }]} numberOfLines={1}>
            {game?.topic ?? '…'}
          </Text>
          <Text style={[styles.gameHeaderMeta, { color: colors.mutedForeground }]}>
            {answeredCount}/{total} · {myScore} pts
          </Text>
        </View>
        <View style={styles.progressPill}>
          <View style={[styles.progressFill, { width: `${total > 0 ? (answeredCount / total) * 100 : 0}%` as unknown as number, backgroundColor: colors.primary }]} />
        </View>
      </View>

      {/* Skip confirmation modal */}
      <Modal visible={skipConfirm} transparent animationType="fade" onRequestClose={() => setSkipConfirm(false)}>
        <View style={styles.skipOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSkipConfirm(false)} />
          <View style={[styles.skipDialog, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.skipDialogTitle, { color: colors.foreground }]}>
              {COPY.gameplay.skipDialogTitle}
            </Text>
            <Text style={[styles.skipDialogBody, { color: colors.mutedForeground }]}>
              {COPY.gameplay.skipDialogBody}
            </Text>
            <View style={styles.skipDialogBtns}>
              <TouchableOpacity
                onPress={() => setSkipConfirm(false)}
                style={[styles.skipDialogBtnOutline, { borderColor: colors.border }]}
              >
                <Text style={[styles.skipDialogBtnText, { color: colors.mutedForeground }]}>
                  {COPY.gameplay.skipDialogGoBack}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  if (current) setSkippedIds((prev) => new Set([...prev, current.id]));
                  setSkipConfirm(false);
                }}
                style={styles.skipDialogBtnConfirm}
              >
                <Text style={styles.skipDialogBtnConfirmText}>{COPY.gameplay.skipDialogConfirm}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <ScrollView
        contentContainerStyle={[styles.gameContent, { paddingBottom: botPad + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {!current ? (
          /* All questions answered */
          <View style={styles.doneState}>
            <Ionicons name="trophy" size={64} color={colors.accent} />
            <Text style={[styles.doneTitle, { color: colors.foreground }]}>{COPY.gameplay.allDoneTitle}</Text>
            <Text style={[styles.doneSub, { color: colors.mutedForeground }]}>
              {COPY.gameplay.allDoneSub}
            </Text>
            <TouchableOpacity
              onPress={() => router.replace(`/results/${gameId}`)}
              style={[styles.confirmBtn, { backgroundColor: colors.accent, marginTop: 8 }]}
            >
              <Text style={[styles.confirmBtnText, { color: colors.accentForeground }]}>{COPY.gameplay.allDoneViewResults}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Question header */}
            <View style={styles.questionMeta}>
              <Text style={[styles.questionNum, { color: colors.mutedForeground }]}>
                Q{sorted.indexOf(current) + 1}
              </Text>
              <Text style={[styles.questionType, { color: colors.mutedForeground }]}>
                {current.questionType.replace(/_/g, ' ')}  ·  {current.points} pts
              </Text>
            </View>

            <Text style={[styles.questionText, { color: colors.foreground }]}>
              {current.questionText}
            </Text>

            {/* Question renderer */}
            <View style={styles.questionBody}>
              {current.questionType === 'multiple_choice' && (
                <MultipleChoiceQ question={current} onSubmit={handleSubmit} disabled={submitAnswer.isPending} lockedAnswer={lockedAnswer} feedback={feedback} />
              )}
              {current.questionType === 'multi_select' && (
                <MultiSelectQ question={current} onSubmit={handleSubmit} disabled={submitAnswer.isPending} lockedAnswer={lockedAnswer} />
              )}
              {current.questionType === 'true_false' && (
                <TrueFalseQ onSubmit={handleSubmit} disabled={submitAnswer.isPending} lockedAnswer={lockedAnswer} />
              )}
              {(current.questionType === 'write_in') && (
                <WriteInQ onSubmit={handleSubmit} disabled={submitAnswer.isPending} lockedAnswer={lockedAnswer} />
              )}
              {current.questionType === 'short_response' && (
                <WriteInQ onSubmit={handleSubmit} disabled={submitAnswer.isPending} lockedAnswer={lockedAnswer} multiline />
              )}
              {current.questionType === 'ordering' && (
                <OrderingQ question={current} onSubmit={handleSubmit} disabled={submitAnswer.isPending} lockedAnswer={lockedAnswer} />
              )}
              {current.questionType === 'slider' && (
                <SliderQ question={current} onSubmit={handleSubmit} disabled={submitAnswer.isPending} lockedAnswer={lockedAnswer} />
              )}
              {current.questionType === 'image_hotspot' && (
                <ImageHotspotQ question={current} onSubmit={handleSubmit} disabled={submitAnswer.isPending} lockedAnswer={lockedAnswer} />
              )}
              {current.questionType === 'image_recognition' && (
                <ImageRecognitionQ question={current} onSubmit={handleSubmit} disabled={submitAnswer.isPending} lockedAnswer={lockedAnswer} />
              )}
              {current.questionType === 'matching' && (
                <MatchingQ question={current} onSubmit={handleSubmit} disabled={submitAnswer.isPending} lockedAnswer={lockedAnswer} />
              )}
            </View>

            {/* Skip button — shown when unanswered and more questions remain */}
            {!feedback && !lockedAnswer && canSkip && (
              <TouchableOpacity
                onPress={() => setSkipConfirm(true)}
                style={styles.skipBtn}
              >
                <Text style={[styles.skipBtnText, { color: colors.mutedForeground }]}>
                  {COPY.gameplay.skipBtn}
                </Text>
              </TouchableOpacity>
            )}

            {/* Feedback */}
            {feedback && (
              <FeedbackCard feedback={feedback} onNext={handleNext} isLast={isLastQuestion} />
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  gameHeader: { paddingHorizontal: 18, paddingBottom: 12, gap: 8 },
  gameHeaderTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  gameHeaderCenter: { flex: 1, paddingHorizontal: 12 },
  gameHeaderTitle: { fontSize: 16, fontWeight: '700', letterSpacing: -0.3 },
  gameHeaderMeta: { fontSize: 12, fontWeight: '500', marginTop: 1 },
  progressPill: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,.08)', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
  gameContent: { paddingHorizontal: 18, paddingTop: 8, gap: 20 },
  questionMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  questionNum: { fontSize: 11, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase' },
  questionType: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  questionText: { fontSize: 22, fontWeight: '800', lineHeight: 30, letterSpacing: -0.4, fontFamily: 'Manrope_800ExtraBold' },
  questionBody: { gap: 10 },
  hint: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase' },
  // Choices
  choicesContainer: { gap: 10 },
  choiceBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, padding: 14, borderWidth: 1 },
  choiceBadge: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  choiceBadgeText: { fontSize: 13, fontWeight: '700' },
  choiceText: { flex: 1, fontSize: 15, fontWeight: '600', lineHeight: 20 },
  confirmBtn: { height: 54, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  confirmBtnText: { fontSize: 14, fontWeight: '800', color: '#ffffff', letterSpacing: 0.5 },
  // True/False
  tfContainer: { flexDirection: 'row', gap: 12 },
  tfBtn: { flex: 1, height: 80, borderRadius: 18, alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5 },
  tfLabel: { fontSize: 16, fontWeight: '800', letterSpacing: 1 },
  // Write-in
  writeInContainer: { gap: 12 },
  writeInInput: { borderRadius: 14, borderWidth: 1.5, padding: 16, fontSize: 16, fontWeight: '600', height: 60 },
  // Ordering
  orderItem: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, padding: 13, borderWidth: 1 },
  orderNum: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  orderNumText: { fontSize: 13, fontWeight: '700' },
  orderControls: { flexDirection: 'column', gap: 2 },
  // Slider
  sliderContainer: { gap: 16 },
  sliderValue: { fontSize: 40, fontWeight: '900', textAlign: 'center', fontFamily: 'Manrope_800ExtraBold' },
  sliderTrack: { height: 8, backgroundColor: 'rgba(255,255,255,.1)', borderRadius: 4, position: 'relative' },
  sliderFill: { height: '100%', borderRadius: 4 },
  sliderKnob: { width: 24, height: 24, borderRadius: 12, position: 'absolute', top: -8, marginLeft: -12, borderWidth: 3, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 4, elevation: 4 },
  sliderLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  sliderLabel: { fontSize: 12, fontWeight: '600' },
  // Hotspot
  hotspotContainer: { gap: 12 },
  hotspotImage: { height: 220, borderRadius: 14, overflow: 'hidden', position: 'relative' },
  hotspotPin: { position: 'absolute', width: 24, height: 24, borderRadius: 12, borderWidth: 3, borderColor: '#ffffff' },
  // Matching
  matchContainer: { gap: 12 },
  matchColumns: { flexDirection: 'row', gap: 10 },
  matchColumn: { flex: 1, gap: 8 },
  matchItem: { borderRadius: 12, padding: 12, borderWidth: 1, alignItems: 'center' },
  matchItemText: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  // Feedback
  feedbackCard: { borderRadius: 18, padding: 18, borderWidth: 1.5, gap: 12, marginTop: 8 },
  feedbackRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  feedbackTitle: { fontSize: 20, fontWeight: '900', fontFamily: 'Manrope_800ExtraBold' },
  feedbackPoints: { fontSize: 14, fontWeight: '600', marginTop: 1 },
  feedbackScore: { fontSize: 28, fontWeight: '900', marginLeft: 'auto', fontFamily: 'Manrope_800ExtraBold' },
  feedbackCorrect: { fontSize: 14, fontWeight: '500' },
  feedbackAI: { fontSize: 13, fontWeight: '500', fontStyle: 'italic' },
  feedbackBtn: { height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  feedbackBtnText: { fontSize: 14, fontWeight: '800' },
  // Done
  doneState: { alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 60 },
  doneTitle: { fontSize: 32, fontWeight: '900', fontFamily: 'Manrope_800ExtraBold' },
  doneSub: { fontSize: 15, fontWeight: '500', textAlign: 'center' },
  // Skip
  skipBtn: { alignItems: 'center', paddingVertical: 12 },
  skipBtnText: { fontSize: 13, fontWeight: '600' },
  skipOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  skipDialog: { width: '100%', maxWidth: 360, borderRadius: 20, borderWidth: 1, padding: 22, gap: 14 },
  skipDialogTitle: { fontSize: 17, fontWeight: '800' },
  skipDialogBody: { fontSize: 14, lineHeight: 21 },
  skipDialogBtns: { flexDirection: 'row', gap: 10, paddingTop: 4 },
  skipDialogBtnOutline: { flex: 1, height: 46, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  skipDialogBtnText: { fontSize: 14, fontWeight: '600' },
  skipDialogBtnConfirm: { flex: 1, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,229,0,.18)', borderWidth: 1, borderColor: 'rgba(255,229,0,.4)' },
  skipDialogBtnConfirmText: { fontSize: 14, fontWeight: '700', color: '#ffe500' },
});
