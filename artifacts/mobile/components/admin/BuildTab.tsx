import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

type Props = { bottomPadding: number };

/**
 * Build tab — placeholder for Pass 2.
 * Will surface the full quiz-building wizard: Setup → Questions → Review,
 * Gemini AI generation, and OpenTDB import — matching the web Build section.
 */
export function BuildTab({ bottomPadding }: Props) {
  const colors = useColors();
  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingBottom: bottomPadding }]}>
      <View style={[styles.pill, { backgroundColor: colors.accent + '18', borderColor: colors.accent + '40' }]}>
        <Text style={[styles.pillText, { color: colors.accent }]}>Coming in Pass 2</Text>
      </View>
      <Ionicons name="sparkles-outline" size={52} color={colors.mutedForeground} />
      <Text style={[styles.heading, { color: colors.foreground }]}>Build a Quiz</Text>
      <Text style={[styles.sub, { color: colors.mutedForeground }]}>
        The full quiz wizard — Setup, AI question generation, OpenTDB import, and Review — will be built here in the next pass.
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
