import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CrownMark } from './CrownMark';
import { useColors } from '@/hooks/useColors';
import { useAdminAuth } from '@/context/AdminAuthContext';

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
            <Text style={styles.livePillText}>LIVE</Text>
          </View>
        )}
      </View>

      {/* Right: logout */}
      <Pressable onPress={logoutAdmin} hitSlop={12} style={styles.logoutBtn}>
        <Ionicons name="log-out-outline" size={22} color={colors.mutedForeground} />
      </Pressable>
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
