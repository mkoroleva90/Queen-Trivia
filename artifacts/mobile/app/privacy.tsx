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
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Privacy Policy</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: botPad + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.lastUpdated, { color: colors.mutedForeground }]}>
          Last updated: August 11, 2026
        </Text>

        {/* Section 1 */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>1. Introduction</Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            Queen Trivia ("we", "us", or "our") operates the Queen Trivia mobile and web application
            (the "Service"). This Privacy Policy describes how we collect, use, and share information
            when you use our Service, and your choices regarding that information.
          </Text>
        </View>

        {/* Section 2 */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>2. Information We Collect</Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            We collect the following types of information:
          </Text>
          <View style={styles.listItem}>
            <Text style={[styles.bullet, { color: colors.mutedForeground }]}>•</Text>
            <Text style={[styles.listBody, { color: colors.mutedForeground }]}>
              <Text style={[styles.strong, { color: colors.foreground }]}>Account information: </Text>
              When you register as a host, we collect your email address and a hashed version of your
              password. We never store your password in plain text.
            </Text>
          </View>
          <View style={styles.listItem}>
            <Text style={[styles.bullet, { color: colors.mutedForeground }]}>•</Text>
            <Text style={[styles.listBody, { color: colors.mutedForeground }]}>
              <Text style={[styles.strong, { color: colors.foreground }]}>Game data: </Text>
              Quizzes, questions, and game sessions you create or participate in, including player
              nicknames and answers submitted during games.
            </Text>
          </View>
          <View style={styles.listItem}>
            <Text style={[styles.bullet, { color: colors.mutedForeground }]}>•</Text>
            <Text style={[styles.listBody, { color: colors.mutedForeground }]}>
              <Text style={[styles.strong, { color: colors.foreground }]}>Usage data: </Text>
              Basic technical information such as device type, operating system version, and error
              logs to help us maintain and improve the Service.
            </Text>
          </View>
        </View>

        {/* Section 3 */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>3. How We Use Your Information</Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            We use the information we collect to:
          </Text>
          {[
            'Provide, operate, and maintain the Service',
            'Create and manage your host account',
            'Send account-related emails (verification, password reset)',
            'Diagnose technical issues and improve the Service',
            'Comply with legal obligations',
          ].map((item) => (
            <View key={item} style={styles.listItem}>
              <Text style={[styles.bullet, { color: colors.mutedForeground }]}>•</Text>
              <Text style={[styles.listBody, { color: colors.mutedForeground }]}>{item}</Text>
            </View>
          ))}
        </View>

        {/* Section 4 */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>4. Information Sharing</Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            We do not sell your personal information. We may share your information only in these
            limited circumstances:
          </Text>
          <View style={styles.listItem}>
            <Text style={[styles.bullet, { color: colors.mutedForeground }]}>•</Text>
            <Text style={[styles.listBody, { color: colors.mutedForeground }]}>
              <Text style={[styles.strong, { color: colors.foreground }]}>Service providers: </Text>
              Third-party vendors who help us operate the Service (e.g. transactional email
              delivery), subject to confidentiality obligations.
            </Text>
          </View>
          <View style={styles.listItem}>
            <Text style={[styles.bullet, { color: colors.mutedForeground }]}>•</Text>
            <Text style={[styles.listBody, { color: colors.mutedForeground }]}>
              <Text style={[styles.strong, { color: colors.foreground }]}>Legal requirements: </Text>
              When required by law or to protect the rights and safety of our users or the public.
            </Text>
          </View>
          <Text style={[styles.body, { color: colors.mutedForeground, marginTop: 8 }]}>
            Player nicknames and scores entered during a live game session are visible to other
            participants in that same game session.
          </Text>
        </View>

        {/* Section 5 */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>5. Data Retention</Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            We retain your account information for as long as your account is active. Game session
            data may be retained to provide score history and analytics to hosts. You may request
            deletion of your account and associated data by contacting us at the address below.
          </Text>
        </View>

        {/* Section 6 */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>6. Children's Privacy</Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            The Service is not directed to children under the age of 13. We do not knowingly collect
            personal information from children under 13. If you believe a child has provided us
            personal information, please contact us so we can delete it.
          </Text>
        </View>

        {/* Section 7 */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>7. Security</Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            We take reasonable technical and organizational measures to protect your information.
            Passwords are stored using industry-standard one-way hashing. However, no method of
            transmission or storage is 100% secure, and we cannot guarantee absolute security.
          </Text>
        </View>

        {/* Section 8 */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>8. Your Rights</Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            Depending on your location, you may have the right to access, correct, or delete your
            personal information. To exercise any of these rights, contact us at:
          </Text>
          <Text style={[styles.email, { color: colors.primary }]}>privacy@queen-trivia.com</Text>
        </View>

        {/* Section 9 */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>9. Changes to This Policy</Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            We may update this Privacy Policy from time to time. We will notify registered hosts by
            email or in-app notice when we make material changes. Continued use of the Service after
            changes take effect constitutes acceptance of the updated policy.
          </Text>
        </View>

        {/* Section 10 */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>10. Contact Us</Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            If you have questions about this Privacy Policy, please contact us at{' '}
            <Text style={{ color: colors.primary }}>privacy@queen-trivia.com</Text>.
          </Text>
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
  strong: { fontWeight: '700', fontFamily: 'Manrope_700Bold' },
  email: { fontSize: 14, marginTop: 6, fontFamily: 'Manrope_600SemiBold' },
});
