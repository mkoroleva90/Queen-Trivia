import { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COPY } from '@workspace/copy';
import { useColors } from '@/hooks/useColors';

/** Matches the server's CUSTOM_ACCESS_CODE_PATTERN (after uppercasing). */
const JOIN_CODE_PATTERN = /^[A-Z0-9]{6,12}$/;

type Props = {
  /** The game's current (auto-assigned) join code — always pre-filled. */
  initialCode: string;
  /** True while the PATCH request is in flight. */
  saving: boolean;
  /** Server-side field error mapped by the parent (taken / blocked / invalid). */
  error: string | null;
  /** Called with the validated, uppercased code when the host continues. */
  onSubmit: (code: string) => void;
};

/**
 * Join-code choice step — shown after the run-mode screen and before the
 * setup success screen. Saves via the existing PATCH /games/:id (handled by
 * the parent); unchanged codes just continue.
 */
export function JoinCodeScreen({ initialCode, saving, error, onSubmit }: Props) {
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
      <Text style={[s.title, { color: colors.foreground }]}>{COPY.joinCode.title}</Text>
      <Text style={[s.subtitle, { color: colors.mutedForeground }]}>{COPY.joinCode.subtitle}</Text>

      <Text style={[s.inputLabel, { color: colors.mutedForeground }]}>
        {COPY.joinCode.inputLabel.toUpperCase()}
      </Text>
      <TextInput
        style={[s.input, {
          backgroundColor: colors.card,
          color: colors.secondary,
          borderColor: fieldError ? colors.destructive : colors.border,
        }]}
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
      <Text style={[s.helper, { color: fieldError ? colors.destructive : colors.mutedForeground }]}>
        {fieldError ?? COPY.joinCode.helper}
      </Text>

      <Pressable
        style={[s.continueBtn, { backgroundColor: colors.primary, opacity: saving ? 0.6 : 1 }]}
        onPress={handleContinue}
        disabled={saving}
      >
        {saving
          ? <ActivityIndicator color="#fff" />
          : <Ionicons name="arrow-forward" size={16} color="#fff" />}
        <Text style={s.continueText}>{COPY.joinCode.continueBtn}</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: 10 },
  title: { fontSize: 20, fontFamily: 'Manrope_800ExtraBold', textAlign: 'center', marginTop: 4 },
  subtitle: { fontSize: 13, textAlign: 'center', lineHeight: 18, marginBottom: 6 },
  inputLabel: { fontSize: 11, fontFamily: 'Manrope_700Bold', letterSpacing: 1.5, textAlign: 'center' },
  input: {
    borderWidth: 2,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 20,
    fontFamily: 'Manrope_800ExtraBold',
    letterSpacing: 4,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  helper: { fontSize: 12, textAlign: 'center', lineHeight: 17 },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 6,
  },
  continueText: { color: '#fff', fontSize: 15, fontFamily: 'Manrope_700Bold' },
});
