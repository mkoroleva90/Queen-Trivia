import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';

export type AdminTab = 'games' | 'live' | 'build' | 'results' | 'rooms';

const TABS: {
  id: AdminTab;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
}[] = [
  { id: 'games',   label: 'Games',   icon: 'game-controller-outline', iconActive: 'game-controller' },
  { id: 'live',    label: 'Live',    icon: 'radio-outline',            iconActive: 'radio' },
  { id: 'build',   label: 'Build',   icon: 'sparkles-outline',         iconActive: 'sparkles' },
  { id: 'results', label: 'Results', icon: 'bar-chart-outline',        iconActive: 'bar-chart' },
  { id: 'rooms',   label: 'Rooms',   icon: 'key-outline',              iconActive: 'key' },
];

type Props = { active: AdminTab; onChange: (tab: AdminTab) => void };

export function AdminTabBar({ active, onChange }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          paddingBottom: Math.max(insets.bottom, 8),
        },
      ]}
    >
      {TABS.map((tab) => {
        const isActive = active === tab.id;
        const color = isActive ? colors.primary : colors.mutedForeground;
        return (
          <Pressable key={tab.id} style={styles.tab} onPress={() => onChange(tab.id)}>
            {/* Active underline at top of tab bar */}
            <View style={[styles.indicator, { backgroundColor: isActive ? colors.primary : 'transparent' }]} />
            <Ionicons name={isActive ? tab.iconActive : tab.icon} size={22} color={color} />
            <Text style={[styles.label, { color }]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: 1,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 6,
    paddingBottom: 4,
    gap: 3,
    position: 'relative',
  },
  indicator: {
    position: 'absolute',
    top: 0,
    left: '20%',
    right: '20%',
    height: 2,
    borderRadius: 1,
  },
  label: {
    fontSize: 10,
    fontFamily: 'Manrope_600SemiBold',
    letterSpacing: 0.2,
  },
});
