import React from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { COPY } from '@workspace/copy';

export default function PrivacyScreen() {
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
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>{COPY.footer.privacyPolicy}</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: botPad + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.lastUpdated, { color: colors.mutedForeground }]}>
          {COPY.legal.lastUpdated}
        </Text>

        {/* Section 1 */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{COPY.legal.privacy.s1Title}</Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            {COPY.legal.privacy.s1Body}
          </Text>
        </View>

        {/* Section 2 */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{COPY.legal.privacy.s2Title}</Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            {COPY.legal.privacy.s2Intro}
          </Text>
          {COPY.legal.privacy.collect.map((item) => (
            <View key={item.label} style={styles.listItem}>
              <Text style={[styles.bullet, { color: colors.mutedForeground }]}>•</Text>
              <Text style={[styles.listBody, { color: colors.mutedForeground }]}>
                <Text style={[styles.strong, { color: colors.foreground }]}>{item.label} </Text>
                {item.body}
              </Text>
            </View>
          ))}
        </View>

        {/* Section 3 */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{COPY.legal.privacy.s3Title}</Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            {COPY.legal.privacy.s3Intro}
          </Text>
          {COPY.legal.privacy.informationUse.map((item) => (
            <View key={item} style={styles.listItem}>
              <Text style={[styles.bullet, { color: colors.mutedForeground }]}>•</Text>
              <Text style={[styles.listBody, { color: colors.mutedForeground }]}>{item}</Text>
            </View>
          ))}
        </View>

        {/* Section 4 */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{COPY.legal.privacy.s4Title}</Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            {COPY.legal.privacy.s4Intro}
          </Text>
          {COPY.legal.privacy.sharing.map((item) => (
            <View key={item.label} style={styles.listItem}>
              <Text style={[styles.bullet, { color: colors.mutedForeground }]}>•</Text>
              <Text style={[styles.listBody, { color: colors.mutedForeground }]}>
                <Text style={[styles.strong, { color: colors.foreground }]}>{item.label} </Text>
                {item.body}
              </Text>
            </View>
          ))}
          <Text style={[styles.body, { color: colors.mutedForeground, marginTop: 8 }]}>
            {COPY.legal.privacy.s4Note}
          </Text>
        </View>

        {/* Section 5 */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{COPY.legal.privacy.s5Title}</Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            {COPY.legal.privacy.s5Body}
          </Text>
        </View>

        {/* Section 6 */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{COPY.legal.privacy.s6Title}</Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            {COPY.legal.privacy.s6Body}
          </Text>
        </View>

        {/* Section 7 */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{COPY.legal.privacy.s7Title}</Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            {COPY.legal.privacy.s7Body}
          </Text>
        </View>

        {/* Section 8 */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{COPY.legal.privacy.s8Title}</Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            {COPY.legal.privacy.s8Body}
          </Text>
          <Text style={[styles.email, { color: colors.primary }]}>{COPY.legal.privacy.email}</Text>
        </View>

        {/* Section 9 */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{COPY.legal.privacy.s9Title}</Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            {COPY.legal.privacy.s9Body}
          </Text>
        </View>

        {/* Section 10 */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{COPY.legal.privacy.s10Title}</Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            {COPY.legal.privacy.s10Prefix}{' '}
            <Text style={{ color: colors.primary }}>{COPY.legal.privacy.email}</Text>.
          </Text>
        </View>

        {/* Footer link to Terms of Service */}
        <Pressable onPress={() => router.push('/terms')} style={styles.footerLink}>
          <Text style={[styles.footerLinkText, { color: colors.primary }]}>{COPY.footer.termsOfService}</Text>
        </Pressable>
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
  strong: { fontWeight: '700', fontFamily: 'Manrope_700Bold' },
  email: { fontSize: 14, marginTop: 6, fontFamily: 'Manrope_600SemiBold' },
  footerLink: { marginTop: 4, marginBottom: 8 },
  footerLinkText: { fontSize: 14, fontFamily: 'Manrope_600SemiBold' },
});
