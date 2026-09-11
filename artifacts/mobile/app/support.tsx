import React from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '@/components/ThemedText';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { COPY } from '@workspace/copy';

export default function SupportScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>{COPY.footer.support}</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: botPad + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.lastUpdated, { color: colors.mutedForeground }]}>
          {COPY.legal.support.tagline}
        </Text>

        {/* Contact Us */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{COPY.legal.support.contactTitle}</Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            {COPY.legal.support.contactBody}
          </Text>
          <Text style={[styles.email, { color: colors.primary }]}>{COPY.legal.support.email}</Text>
        </View>

        {/* How to Report */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{COPY.legal.support.reportTitle}</Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            {COPY.legal.support.reportBody}
          </Text>
          {COPY.legal.support.reportChecklist.map((item) => (
            <View key={item} style={styles.listItem}>
              <Text style={[styles.bullet, { color: colors.mutedForeground }]}>•</Text>
              <Text style={[styles.listBody, { color: colors.mutedForeground }]}>{item}</Text>
            </View>
          ))}
        </View>

        {/* Host Accounts */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{COPY.legal.support.hostAccountsTitle}</Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            {COPY.legal.support.hostAccountsPrefix}{' '}
            <Text style={{ color: colors.primary }}>{COPY.legal.support.email}</Text>
            {' '}{COPY.legal.support.hostAccountsSuffix}
          </Text>
        </View>

        {/* Content Concerns */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{COPY.legal.support.contentTitle}</Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            {COPY.legal.support.contentPrefix}{' '}
            <Text style={{ color: colors.primary }}>{COPY.legal.support.email}</Text>
            {' '}{COPY.legal.support.contentSuffix}
          </Text>
        </View>

        {/* Footer links */}
        <View style={styles.footerLinks}>
          <Pressable onPress={() => router.push('/privacy')} style={styles.footerLink}>
            <Text style={[styles.footerLinkText, { color: colors.primary }]}>{COPY.footer.privacyPolicy}</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/terms')} style={styles.footerLink}>
            <Text style={[styles.footerLinkText, { color: colors.primary }]}>{COPY.footer.termsOfService}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', fontFamily: 'Manrope_700Bold' },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { paddingHorizontal: 22, paddingTop: 20 },
  lastUpdated: { fontSize: 12, marginBottom: 24 },
  section: { marginBottom: 28 },
  sectionTitle: { fontSize: 17, fontWeight: '700', fontFamily: 'Manrope_700Bold', marginBottom: 10 },
  body: { fontSize: 14, lineHeight: 22 },
  listItem: { flexDirection: 'row', gap: 8, marginTop: 6 },
  bullet: { fontSize: 14, lineHeight: 22 },
  listBody: { flex: 1, fontSize: 14, lineHeight: 22 },
  email: { fontSize: 14, marginTop: 6, fontFamily: 'Manrope_600SemiBold' },
  footerLinks: { flexDirection: 'row', gap: 20, marginTop: 4, marginBottom: 8 },
  footerLink: {},
  footerLinkText: { fontSize: 14, fontFamily: 'Manrope_600SemiBold' },
});
