import { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COPY } from '@workspace/copy';
import { useColors } from '@/hooks/useColors';

/** Matches the server's CUSTOM_ACCESS_CODE_PATTERN (after uppercasing). */
const JOIN_CODE_PATTERN = /^[A-Z0-9]{8,12}$/;

type Props = {
  /** The game's current (auto-assigned) join code — always pre-filled. */
  initialCode: string;
  /** True while the PATCH request is in flight. */
  saving: boolean;
  /** Server-side field error mapped by the parent (taken / blocked / invalid). */
  error: string | null;
  /** Returns to the previous game-build choice without losing the draft. */
  onBack: () => void;
  /** Called with the validated, uppercased code when the host continues. */
  onSubmit: (code: string) => void;
};

/**
 * Join-code choice step — shown after the run-mode screen and before the
 * "Ready to go live" confirmation. Saves via the existing PATCH /games/:id
 * (handled by the parent); unchanged codes just continue.
 */
export function JoinCodeScreen({ initialCode, saving, error, onBack, onSubmit }: Props) {
  const colors = useColors();
  const [code, setCode] = useState(initialCode);
  const [localError, setLocalError] = useState<string | null>(null);

  const fieldError = localError ?? error;

  const handleContinue = () => {
    const val = code.trim().toUpperCase();
    if (!JOIN_CODE_PATTERN.test(val)) {
      setLocalError(COPY.joinCode.invalidError);
      return;
    }
    setLocalError(null);
    onSubmit(val);
  };

  return (
    <View style={s.container}>
      <Pressable
        style={s.backBtn}
        onPress={onBack}
        disabled={saving}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <Ionicons name="arrow-back" size={18} color="#c5ccda" />
        <Text style={s.backText}>Back</Text>
      </Pressable>

      <Text style={s.title}>{COPY.joinCode.title}</Text>
      <Text style={s.subtitle}>{COPY.joinCode.subtitle}</Text>

      <Text style={s.inputLabel}>{COPY.joinCode.inputLabel.toUpperCase()}</Text>
      <TextInput
        style={[
          s.input,
          fieldError
            ? { borderColor: colors.destructive }
            : { borderColor: '#f5138c' },
        ]}
        value={code}
        onChangeText={(t) => {
          setCode(t.toUpperCase());
          setLocalError(null);
        }}
        onSubmitEditing={handleContinue}
        maxLength={12}
        autoCapitalize="characters"
        autoCorrect={false}
      />
      <Text style={[s.helper, fieldError ? { color: colors.destructive } : null]}>
        {fieldError ?? COPY.joinCode.helper}
      </Text>

      <Pressable
        style={[s.continueBtn, { opacity: saving ? 0.6 : 1 }]}
        onPress={handleContinue}
        disabled={saving}
      >
        {saving && <ActivityIndicator color="#fff" />}
        <Text style={s.continueText}>{COPY.joinCode.continueBtn}</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: 10 },
  backBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  backText: { color: '#c5ccda', fontSize: 14, fontFamily: 'Manrope_700Bold' },
  title: { fontSize: 22, fontFamily: 'Manrope_700Bold', color: '#ffffff', marginTop: 4 },
  subtitle: { fontSize: 13.5, lineHeight: 19, color: '#8b93a4', marginBottom: 8 },
  inputLabel: {
    fontSize: 11,
    fontFamily: 'Manrope_700Bold',
    letterSpacing: 1.3,
    color: '#6b7387',
  },
  input: {
    backgroundColor: '#0f1420',
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 16,
    fontSize: 22,
    fontFamily: 'Manrope_800ExtraBold',
    letterSpacing: 3,
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  helper: { fontSize: 12, lineHeight: 17, color: '#6b7387' },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f5138c',
    borderRadius: 16,
    padding: 16,
    marginTop: 6,
  },
  continueText: { color: '#fff', fontSize: 17, fontFamily: 'Manrope_700Bold' },
});
