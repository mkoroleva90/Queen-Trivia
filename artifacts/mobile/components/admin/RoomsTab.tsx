import React from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '@/components/ThemedText';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { COPY } from '@workspace/copy';

const PRIVACY_URL = 'https://queen-trivia.com/privacy';
const TERMS_URL   = 'https://queen-trivia.com/terms';

type Props = { bottomPadding: number };

/**
 * Rooms tab — legal links. Account management (display name, password,
 * sign out, delete account) lives on app/admin/account.tsx, reached from the
 * person icon in the admin header.
 */
export function RoomsTab({ bottomPadding }: Props) {
  const colors = useColors();

  const s = styles(colors);

  return (
    <ScrollView
      style={[s.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[s.body, { paddingBottom: bottomPadding + 24 }]}
      keyboardShouldPersistTaps="handled"
    >
      {/* Legal */}
      <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={s.sectionHeader}>
          <Ionicons name="document-text-outline" size={18} color={colors.primary} />
          <Text style={[s.sectionTitle, { color: colors.foreground }]}>{COPY.account.legalTitle}</Text>
        </View>
        <Pressable
          style={s.legalRow}
          onPress={() => Linking.openURL(PRIVACY_URL)}
        >
          <Text style={[s.legalLink, { color: colors.primary }]}>{COPY.footer.privacyPolicy}</Text>
          <Ionicons name="open-outline" size={15} color={colors.primary} />
        </Pressable>
        <View style={[s.legalDivider, { backgroundColor: colors.border }]} />
        <Pressable
          style={s.legalRow}
          onPress={() => Linking.openURL(TERMS_URL)}
        >
          <Text style={[s.legalLink, { color: colors.primary }]}>{COPY.footer.termsOfService}</Text>
          <Ionicons name="open-outline" size={15} color={colors.primary} />
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    container: { flex: 1 },
    body: { paddingHorizontal: 16, paddingTop: 16, gap: 16 },
    card: { borderRadius: 16, borderWidth: 1, padding: 20, gap: 12 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    sectionTitle: { fontSize: 17, fontFamily: 'Manrope_700Bold' },
    legalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
    legalLink: { fontSize: 15, fontFamily: 'Manrope_600SemiBold' },
    legalDivider: { height: StyleSheet.hairlineWidth },
  });
