import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

type Props = { bottomPadding: number };

/**
 * Live tab — placeholder for Pass 2.
 * Will show the active game scoreboard, real-time question control,
 * and participant list for the currently running game.
 */
export function LiveTab({ bottomPadding }: Props) {
  const colors = useColors();
  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingBottom: bottomPadding }]}>
      <View style={[styles.pill, { backgroundColor: colors.secondary + '18', borderColor: colors.secondary + '40' }]}>
        <Text style={[styles.pillText, { color: colors.secondary }]}>Coming in Pass 2</Text>
      </View>
      <Ionicons name="radio-outline" size={52} color={colors.mutedForeground} />
      <Text style={[styles.heading, { color: colors.foreground }]}>Live Game Control</Text>
      <Text style={[styles.sub, { color: colors.mutedForeground }]}>
        Real-time scoreboard, question pacing, and participant management will be built here in the next pass.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 36 },
  pill: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 5 },
  pillText: { fontSize: 12, fontFamily: 'Manrope_700Bold', letterSpacing: 0.5 },
  heading: { fontSize: 20, fontFamily: 'Manrope_800ExtraBold', textAlign: 'center' },
  sub: { fontSize: 14, lineHeight: 21, textAlign: 'center' },
});
