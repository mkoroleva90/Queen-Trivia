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

export default function TermsScreen() {
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
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Terms of Service</Text>
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
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>1. Acceptance of Terms</Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            By creating an account or using Queen Trivia (the "Service"), you agree to be bound by
            these Terms of Service ("Terms"). If you do not agree, do not use the Service. These Terms
            apply to all hosts, players, and visitors.
          </Text>
        </View>

        {/* Section 2 */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>2. The Service</Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            Queen Trivia provides a platform for creating and hosting live trivia games. Hosts create
            quizzes and manage game sessions; players join using a room code and participate via their
            device. We reserve the right to modify or discontinue the Service at any time with
            reasonable notice.
          </Text>
        </View>

        {/* Section 3 */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>3. Accounts</Text>
          {[
            'You must provide a valid email address when registering and verify it before signing in.',
            'You are responsible for maintaining the confidentiality of your password and for all activity that occurs under your account.',
            'You must notify us immediately of any unauthorized use of your account.',
            'You must be at least 13 years old to create an account.',
          ].map((item) => (
            <View key={item} style={styles.listItem}>
              <Text style={[styles.bullet, { color: colors.mutedForeground }]}>•</Text>
              <Text style={[styles.listBody, { color: colors.mutedForeground }]}>{item}</Text>
            </View>
          ))}
        </View>

        {/* Section 4 */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>4. Acceptable Use</Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            You agree not to use the Service to:
          </Text>
          {[
            'Post or transmit content that is unlawful, harmful, threatening, abusive, defamatory, or otherwise objectionable',
            'Harass, intimidate, or discriminate against any person or group',
            'Violate any applicable law or regulation',
            'Interfere with or disrupt the integrity or performance of the Service',
            'Attempt to gain unauthorized access to any part of the Service',
            'Use automated tools to scrape, crawl, or otherwise extract data from the Service without our consent',
          ].map((item) => (
            <View key={item} style={styles.listItem}>
              <Text style={[styles.bullet, { color: colors.mutedForeground }]}>•</Text>
              <Text style={[styles.listBody, { color: colors.mutedForeground }]}>{item}</Text>
            </View>
          ))}
        </View>

        {/* Section 5 */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>5. Content</Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            You retain ownership of any quiz content you create. By submitting content to the Service,
            you grant us a non-exclusive, royalty-free license to store, display, and deliver that
            content as necessary to operate the Service. You are solely responsible for ensuring your
            content does not infringe third-party intellectual property rights or violate applicable
            laws.
          </Text>
        </View>

        {/* Section 6 */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>6. Termination</Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            We may suspend or terminate your account at any time for violations of these Terms or for
            any other reason at our discretion. You may delete your account at any time by contacting
            us. Provisions of these Terms that by their nature should survive termination shall
            survive.
          </Text>
        </View>

        {/* Section 7 */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>7. Disclaimer of Warranties</Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS
            OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR
            NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR
            FREE OF HARMFUL COMPONENTS.
          </Text>
        </View>

        {/* Section 8 */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>8. Limitation of Liability</Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE SHALL NOT BE LIABLE FOR ANY INDIRECT,
            INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING OUT OF OR RELATED TO YOUR
            USE OF THE SERVICE, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
          </Text>
        </View>

        {/* Section 9 */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>9. Governing Law</Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            These Terms are governed by and construed in accordance with applicable law. Any disputes
            arising under these Terms shall be resolved through binding arbitration or in a court of
            competent jurisdiction.
          </Text>
        </View>

        {/* Section 10 */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>10. Changes to These Terms</Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            We may update these Terms from time to time. We will notify registered hosts by email or
            in-app notice of material changes. Continued use of the Service after changes take effect
            constitutes acceptance of the updated Terms.
          </Text>
        </View>

        {/* Section 11 */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>11. Contact Us</Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            Questions about these Terms? Contact us at{' '}
            <Text style={{ color: colors.primary }}>legal@queen-trivia.com</Text>.
          </Text>
        </View>

        {/* Footer link to Privacy Policy */}
        <Pressable onPress={() => router.push('/privacy')} style={styles.footerLink}>
          <Text style={[styles.footerLinkText, { color: colors.primary }]}>Privacy Policy</Text>
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
  footerLink: { marginTop: 4, marginBottom: 8 },
  footerLinkText: { fontSize: 14, fontFamily: 'Manrope_600SemiBold' },
});
