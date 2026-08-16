import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COPY } from '@workspace/copy';
import { useColors } from '@/hooks/useColors';

export type RunMode = 'hostOnly' | 'hostPlay';

type Props = {
  /** Currently selected mode, or null when nothing is selected yet. */
  value: RunMode | null;
  onSelect: (mode: RunMode) => void;
  /** Called when the host confirms their choice. */
  onContinue: () => void;
};

const OPTIONS: Array<{ mode: RunMode; label: string; desc: string; icon: 'ribbon' | 'people' }> = [
  { mode: 'hostOnly', label: COPY.runMode.hostOnlyLabel, desc: COPY.runMode.hostOnlyDesc, icon: 'ribbon' },
  { mode: 'hostPlay', label: COPY.runMode.hostPlayLabel, desc: COPY.runMode.hostPlayDesc, icon: 'people' },
];

/**
 * Run-mode choice screen — shown immediately after a host creates a game,
 * before the setup success screen. The choice feeds the same
 * host-plays-along flag the old "Play along" checkbox set.
 */
export function RunModeScreen({ value, onSelect, onContinue }: Props) {
  const colors = useColors();

  return (
    <View style={s.container}>
      <Text style={[s.title, { color: colors.foreground }]}>{COPY.runMode.title}</Text>
      <Text style={[s.subtitle, { color: colors.mutedForeground }]}>{COPY.runMode.subtitle}</Text>

      {OPTIONS.map(({ mode, label, desc, icon }) => {
        const selected = value === mode;
        return (
          <Pressable
            key={mode}
            onPress={() => onSelect(mode)}
            style={[
              s.option,
              {
                borderColor: selected ? colors.primary : colors.border,
                backgroundColor: selected ? colors.primary + '14' : colors.card,
              },
            ]}
          >
            <Ionicons
              name={icon}
              size={24}
              color={selected ? colors.primary : colors.mutedForeground}
            />
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={[s.optionLabel, { color: colors.foreground }]}>{label}</Text>
              <Text style={[s.optionDesc, { color: colors.mutedForeground }]}>{desc}</Text>
            </View>
            <Ionicons
              name={selected ? 'checkmark-circle' : 'ellipse-outline'}
              size={22}
              color={selected ? colors.primary : colors.border}
            />
          </Pressable>
        );
      })}

      <Pressable
        style={[s.continueBtn, { backgroundColor: colors.primary, opacity: value === null ? 0.4 : 1 }]}
        onPress={onContinue}
        disabled={value === null}
      >
        <Text style={s.continueText}>{COPY.runMode.continueBtn}</Text>
        <Ionicons name="arrow-forward" size={16} color="#fff" />
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: 12 },
  title: { fontSize: 20, fontFamily: 'Manrope_800ExtraBold', textAlign: 'center', marginTop: 4 },
  subtitle: { fontSize: 13, textAlign: 'center', lineHeight: 18, marginBottom: 6 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 2,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  optionLabel: { fontSize: 15, fontFamily: 'Manrope_700Bold' },
  optionDesc: { fontSize: 13, lineHeight: 18 },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 4,
  },
  continueText: { color: '#fff', fontSize: 15, fontFamily: 'Manrope_700Bold' },
});
