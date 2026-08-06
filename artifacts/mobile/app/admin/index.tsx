import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AdminTabBar, type AdminTab } from '@/components/AdminTabBar';
import { AdminHeader } from '@/components/AdminHeader';
import { GamesTab } from '@/components/admin/GamesTab';
import { LiveTab } from '@/components/admin/LiveTab';
import { BuildTab } from '@/components/admin/BuildTab';
import { ResultsTab } from '@/components/admin/ResultsTab';
import { RoomsTab } from '@/components/admin/RoomsTab';
import { useColors } from '@/hooks/useColors';

type Difficulty = 'easy' | 'medium' | 'hard';

export type BuildPreload =
  | { mode: 'setup'; topic: string; difficulty: Difficulty }
  | { mode: 'review'; gameId: number };

const TAB_TITLES: Record<AdminTab, string> = {
  games:   'Games',
  live:    'Live',
  build:   'Build',
  results: 'Results',
  rooms:   'Rooms',
};

// Tab bar content height (icon + label + top/bottom padding, before safe-area bottom)
const TAB_BAR_CONTENT_HEIGHT = 58;

export default function AdminHomeScreen() {
  const [activeTab, setActiveTab] = useState<AdminTab>('games');
  const colors = useColors();
  const insets = useSafeAreaInsets();

  // Each tab's ScrollView needs this much bottom padding to clear the tab bar
  const bottomPadding = TAB_BAR_CONTENT_HEIGHT + Math.max(insets.bottom, 8);

  // Preload state — set when the user taps "More options" in the quick-create
  // sheet and cleared by BuildTab once it has consumed the values.
  const [buildPreload, setBuildPreload] = useState<BuildPreload | null>(null);

  const handleMoreOptions = useCallback((topic: string, difficulty: Difficulty) => {
    setBuildPreload({ mode: 'setup', topic, difficulty });
    setActiveTab('build');
  }, []);

  const handleGameReady = useCallback((gameId: number) => {
    setBuildPreload({ mode: 'review', gameId });
    setActiveTab('build');
  }, []);

  const clearBuildPreload = useCallback(() => setBuildPreload(null), []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AdminHeader title={TAB_TITLES[activeTab]} isLive={activeTab === 'live'} />

      <View style={styles.content}>
        {activeTab === 'games'   && <GamesTab   bottomPadding={bottomPadding} onMoreOptions={handleMoreOptions} onGameReady={handleGameReady} />}
        {activeTab === 'live'    && <LiveTab     bottomPadding={bottomPadding} />}
        {activeTab === 'build'   && <BuildTab    bottomPadding={bottomPadding} preload={buildPreload} onClearPreload={clearBuildPreload} />}
        {activeTab === 'results' && <ResultsTab  bottomPadding={bottomPadding} />}
        {activeTab === 'rooms'   && <RoomsTab    bottomPadding={bottomPadding} />}
      </View>

      <AdminTabBar active={activeTab} onChange={setActiveTab} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content:   { flex: 1 },
});
