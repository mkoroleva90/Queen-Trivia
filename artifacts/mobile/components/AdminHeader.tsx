import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ThemedText';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CrownMark } from './CrownMark';
import { useColors } from '@/hooks/useColors';
import { useAdminAuth } from '@/context/AdminAuthContext';
import { COPY } from '@workspace/copy';

type Props = {
  /** Short section title shown next to the crown — e.g. "Games", "Live" */
  title: string;
  /** Show a pink LIVE pill next to the title */
  isLive?: boolean;
};

/**
 * Fixed top header used across all five admin tab sections.
 * Mirrors the web app's mobile header: crown + title left, logout right.
 */
export function AdminHeader({ title, isLive }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { logoutAdmin } = useAdminAuth();

  return (
    <View
      style={[
        styles.header,
        {
          paddingTop: insets.top + 10,
          backgroundColor: colors.background,
          borderBottomColor: colors.border,
        },
      ]}
    >
      {/* Left: crown + title */}
      <View style={styles.left}>
        <CrownMark size={20} />
        <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
        {isLive && (
          <View style={[styles.livePill, { backgroundColor: colors.primary }]}>
            <Text style={styles.livePillText}>{COPY.admin.livePill}</Text>
          </View>
        )}
      </View>

      {/* Right: account + logout */}
      <View style={styles.right}>
        <Pressable
          onPress={() => router.push('/admin/account')}
          hitSlop={12}
          style={styles.logoutBtn}
          accessibilityRole="button"
          accessibilityLabel={COPY.nav.rooms}
        >
          <Ionicons name="person-circle-outline" size={24} color={colors.mutedForeground} />
        </Pressable>
        <Pressable onPress={logoutAdmin} hitSlop={12} style={styles.logoutBtn}>
          <Ionicons name="log-out-outline" size={22} color={colors.mutedForeground} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  title: {
    fontSize: 17,
    fontFamily: 'Manrope_700Bold',
  },
  livePill: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  livePillText: {
    color: '#fff',
    fontSize: 9,
    fontFamily: 'Manrope_800ExtraBold',
    letterSpacing: 1,
  },
  logoutBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
