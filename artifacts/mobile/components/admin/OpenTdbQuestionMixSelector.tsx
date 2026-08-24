import { Ionicons } from '@expo/vector-icons';
import { COPY } from '@workspace/copy';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

export type OpenTdbImportMode = 'standard' | 'extended' | 'surprise';

type Props = {
  value: OpenTdbImportMode | null;
  onSelect: (mode: OpenTdbImportMode) => void;
};

const OPTIONS: Array<{ value: OpenTdbImportMode; label: string }> = [
  { value: 'standard', label: COPY.openTdbQuestionMix.standard },
  { value: 'extended', label: COPY.openTdbQuestionMix.extended },
  { value: 'surprise', label: COPY.openTdbQuestionMix.surprise },
];

export function OpenTdbQuestionMixSelector({ value, onSelect }: Props) {
  const colors = useColors();

  return (
    <View style={s.container}>
      <Text style={[s.title, { color: colors.foreground }]}>{COPY.openTdbQuestionMix.title}</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel={COPY.openTdbQuestionMix.title} style={s.list}>
        {OPTIONS.map(({ value: optionValue, label }) => {
          const selected = value === optionValue;
          return (
            <Pressable
              key={optionValue}
              testID={`open-tdb-mix-${optionValue}`}
              onPress={() => onSelect(optionValue)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={[
                s.option,
                {
                  backgroundColor: selected ? colors.primary + '18' : colors.card,
                  borderColor: selected ? colors.primary : colors.border,
                },
              ]}
            >
              <View
                style={[
                  s.radio,
                  {
                    borderColor: selected ? colors.primary : colors.mutedForeground,
                    backgroundColor: selected ? colors.primary : 'transparent',
                  },
                ]}
              >
                {selected && <Ionicons name="checkmark" size={14} color={colors.primaryForeground} />}
              </View>
              <Text style={[s.label, { color: colors.foreground }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
      {value === null && (
        <Text accessibilityRole="alert" style={[s.hint, { color: colors.mutedForeground }]}>
          {COPY.openTdbQuestionMix.hint}
        </Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: 10 },
  title: { fontSize: 16, lineHeight: 22, fontFamily: 'Manrope_600SemiBold' },
  list: { gap: 10 },
  option: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { flex: 1, fontSize: 14, lineHeight: 19, fontFamily: 'Manrope_500Medium' },
  hint: { fontSize: 13, lineHeight: 18 },
});