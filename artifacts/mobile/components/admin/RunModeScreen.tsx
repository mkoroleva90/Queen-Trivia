import { View, Text, Pressable, StyleSheet } from 'react-native';
import { COPY } from '@workspace/copy';
import { CrownMark } from '@/components/CrownMark';

export type RunMode = 'hostOnly' | 'hostPlay';

type Props = {
  /** Currently selected mode, or null when nothing is selected yet. */
  value: RunMode | null;
  onSelect: (mode: RunMode) => void;
  /** Called when the host confirms their choice. */
  onContinue: () => void;
};

const OPTIONS: Array<{ mode: RunMode; label: string; desc: string }> = [
  { mode: 'hostOnly', label: COPY.runMode.hostOnlyLabel, desc: COPY.runMode.hostOnlyDesc },
  { mode: 'hostPlay', label: COPY.runMode.hostPlayLabel, desc: COPY.runMode.hostPlayDesc },
];

/**
 * Run-mode choice screen — shown immediately after a host creates a game,
 * before the join-code step. Design-handoff "1c" treatment: stacked
 * radio-list rows with a full-width Continue button.
 */
export function RunModeScreen({ value, onSelect, onContinue }: Props) {
  return (
    <View style={s.container}>
      <View style={{ gap: 6 }}>
        <Text style={s.title}>{COPY.runMode.title}</Text>
        <Text style={s.subtitle}>{COPY.runMode.subtitle}</Text>
      </View>

      <View style={s.list}>
        {OPTIONS.map(({ mode, label, desc }) => {
          const selected = value === mode;
          return (
            <Pressable
              key={mode}
              onPress={() => onSelect(mode)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={[
                s.row,
                selected
                  ? {
                      backgroundColor: 'rgba(245,19,140,0.10)',
                      borderColor: '#f5138c',
                      shadowColor: '#f5138c',
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: 0.35,
                      shadowRadius: 5,
                      elevation: 4,
                    }
                  : { backgroundColor: '#12151f', borderColor: '#232a38' },
              ]}
            >
              <View
                style={[
                  s.iconTile,
                  { backgroundColor: selected ? 'rgba(245,19,140,0.22)' : 'rgba(25,210,237,0.12)' },
                ]}
              >
                <CrownMark size={24} color={selected ? '#f5138c' : '#19d2ed'} />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={s.rowLabel}>{label}</Text>
                <Text style={s.rowDesc}>{desc}</Text>
              </View>
              <View style={[s.radioRing, selected ? s.radioRingSelected : null]}>
                {selected && <View style={s.radioDot} />}
              </View>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        style={[s.continueBtn, { opacity: value === null ? 0.4 : 1 }]}
        onPress={onContinue}
        disabled={value === null}
      >
        <Text style={s.continueText}>{COPY.runMode.continueBtn}</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: 20 },
  title: {
    fontSize: 21,
    fontFamily: 'Manrope_700Bold',
    color: '#ffffff',
    marginTop: 4,
  },
  subtitle: { fontSize: 13, lineHeight: 18, color: '#8b93a4' },
  list: { gap: 14 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    borderWidth: 1.5,
    borderRadius: 18,
    padding: 16,
  },
  iconTile: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: { fontSize: 16, fontFamily: 'Manrope_700Bold', color: '#ffffff' },
  rowDesc: { fontSize: 12.5, lineHeight: 17.5, color: '#8b93a4' },
  radioRing: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#39414f',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioRingSelected: { borderColor: '#f5138c', backgroundColor: '#f5138c' },
  radioDot: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: '#ffffff' },
  continueBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5138c',
    borderRadius: 16,
    padding: 16,
  },
  continueText: { color: '#fff', fontSize: 17, fontFamily: 'Manrope_700Bold' },
});
