import React from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { CrownMark } from '@/components/CrownMark';
import { COPY } from '@workspace/copy';

const SUPPORT_URL = 'https://queen-trivia.com/support';

interface LinkRowProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  sublabel: string;
  accentColor: string;
  onPress: () => void;
  externalIcon?: boolean;
  loading?: boolean;
}

function LinkRow({ icon, label, sublabel, accentColor, onPress, externalIcon = false, loading = false }: LinkRowProps) {
  const colors = useColors();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.75 : 1 },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: accentColor + '22' }]}>
        <Ionicons name={icon} size={22} color={accentColor} />
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, { color: colors.foreground }]}>{label}</Text>
        <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>{sublabel}</Text>
      </View>
      {loading ? (
        <ActivityIndicator size="small" color={colors.mutedForeground} />
      ) : (
        <Ionicons name={externalIcon ? 'open-outline' : 'chevron-forward'} size={18} color={colors.mutedForeground} />
      )}
    </Pressable>
  );
}

function SupportRow({ icon, label, sublabel, accentColor, url }: Omit<LinkRowProps, 'onPress' | 'externalIcon' | 'loading'> & { url: string }) {
  const colors = useColors();
  const [loading, setLoading] = React.useState(false);

  const handlePress = async () => {
    setLoading(true);
    try {
      await WebBrowser.openBrowserAsync(url, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
        toolbarColor: colors.background,
        controlsColor: accentColor,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinkRow
      icon={icon}
      label={label}
      sublabel={sublabel}
      accentColor={accentColor}
      onPress={handlePress}
      externalIcon
      loading={loading}
    />
  );
}

export default function AboutScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad, paddingBottom: botPad }]}>
      {/* Back */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>About</Text>
        <View style={styles.backBtn} />
      </View>

      <View style={styles.body}>
        {/* Branding */}
        <View style={styles.brand}>
          <CrownMark size={48} />
          <Text style={[styles.appName, { color: colors.foreground }]}>
            <Text style={{ color: colors.accent }}>QUEEN</Text>{' '}
            <Text style={{ color: colors.primary }}>TRIVIA</Text>
          </Text>
        </View>

        {/* Links */}
        <View style={styles.section}>
          <Text style={[styles.sectionHeader, { color: colors.mutedForeground }]}>LEGAL & SUPPORT</Text>
          <LinkRow
            icon="shield-checkmark-outline"
            label={COPY.footer.privacyPolicy}
            sublabel="How we handle your data"
            accentColor={colors.primary}
            onPress={() => router.push('/privacy')}
          />
          <SupportRow
            icon="chatbubble-ellipses-outline"
            label={COPY.footer.support}
            sublabel="Get help or report an issue"
            accentColor={colors.secondary}
            url={SUPPORT_URL}
          />
        </View>
      </View>
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
  },
  headerTitle: { fontSize: 17, fontWeight: '700', fontFamily: 'Manrope_700Bold' },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, paddingHorizontal: 22, paddingTop: 24, gap: 32 },
  brand: { alignItems: 'center', gap: 12 },
  appName: { fontSize: 28, fontWeight: '900', letterSpacing: -1, fontFamily: 'Manrope_800ExtraBold' },
  section: { gap: 10 },
  sectionHeader: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, marginBottom: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  iconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { fontSize: 16, fontWeight: '700', fontFamily: 'Manrope_700Bold' },
  rowSub: { fontSize: 13, fontWeight: '400' },
});
