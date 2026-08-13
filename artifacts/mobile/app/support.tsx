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
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Support</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: botPad + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.lastUpdated, { color: colors.mutedForeground }]}>
          We're here to help
        </Text>

        {/* Contact Us */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Contact Us</Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            For any questions, issues, or feedback about Queen Trivia, reach out to us directly
            by email. We aim to respond within one business day.
          </Text>
          <Text style={[styles.email, { color: colors.primary }]}>support@queen-trivia.com</Text>
        </View>

        {/* How to Report */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>How to Report a Problem</Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            If you've encountered a bug, an unexpected error, or inappropriate content in a game,
            please include the following in your message so we can investigate quickly:
          </Text>
          {[
            'A brief description of what happened and what you expected to happen',
            'The game code or topic name, if relevant',
            'The device and app version you were using',
            'Any error messages you saw on screen',
          ].map((item) => (
            <View key={item} style={styles.listItem}>
              <Text style={[styles.bullet, { color: colors.mutedForeground }]}>•</Text>
              <Text style={[styles.listBody, { color: colors.mutedForeground }]}>{item}</Text>
            </View>
          ))}
        </View>

        {/* Host Accounts */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Host Accounts</Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            If you're having trouble with your host account — such as a missing verification email,
            a password reset that didn't arrive, or difficulty signing in — email us at{' '}
            <Text style={{ color: colors.primary }}>support@queen-trivia.com</Text>
            {' '}with your registered email address and we'll get you sorted.
          </Text>
        </View>

        {/* Content Concerns */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Content Concerns</Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            Queen Trivia includes a content filter to prevent offensive material from appearing in
            games. If you see something that slipped through, please report it to{' '}
            <Text style={{ color: colors.primary }}>support@queen-trivia.com</Text>
            {' '}and we'll review it promptly.
          </Text>
        </View>

        {/* Footer links */}
        <View style={styles.footerLinks}>
          <Pressable onPress={() => router.push('/privacy')} style={styles.footerLink}>
            <Text style={[styles.footerLinkText, { color: colors.primary }]}>Privacy Policy</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/terms')} style={styles.footerLink}>
            <Text style={[styles.footerLinkText, { color: colors.primary }]}>Terms of Service</Text>
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
