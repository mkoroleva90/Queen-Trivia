import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COPY } from '@workspace/copy';
import { AdminTabBar, type AdminTab } from '@/components/AdminTabBar';
import { AdminHeader } from '@/components/AdminHeader';
import { GamesTab } from '@/components/admin/GamesTab';
import { BuildTab } from '@/components/admin/BuildTab';
import { ResultsTab } from '@/components/admin/ResultsTab';
import { RoomsTab } from '@/components/admin/RoomsTab';
import { useColors } from '@/hooks/useColors';

const TAB_TITLES: Record<AdminTab, string> = {
  games:   'Games',
  build:   'Build',
  results: 'Results',
  rooms:   COPY.nav.rooms,
};

// Tab bar content height (icon + label + top/bottom padding, before safe-area bottom)
const TAB_BAR_CONTENT_HEIGHT = 58;

export default function AdminHomeScreen() {
  const [activeTab, setActiveTab] = useState<AdminTab>('games');
  const colors = useColors();
  const insets = useSafeAreaInsets();

  // Each tab's ScrollView needs this much bottom padding to clear the tab bar
  const bottomPadding = TAB_BAR_CONTENT_HEIGHT + Math.max(insets.bottom, 8);

  // Navigate to the Build tab so the admin lands directly on the Setup step.
  const handleGoToBuild = useCallback(() => setActiveTab('build'), []);
  const handleExitBuild = useCallback(() => setActiveTab('games'), []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AdminHeader title={TAB_TITLES[activeTab]} isLive={false} />

      <View style={styles.content}>
        {activeTab === 'games'   && <GamesTab   bottomPadding={bottomPadding} onGoToBuild={handleGoToBuild} />}
        {activeTab === 'build'   && <BuildTab    bottomPadding={bottomPadding} onExitBuild={handleExitBuild} />}
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
