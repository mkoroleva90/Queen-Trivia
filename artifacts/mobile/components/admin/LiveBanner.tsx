import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COPY } from '@workspace/copy';
import { getItem, setItem } from '@/lib/storage';

/** Storage key prefix for the one-time "Host & play" live-screen banner (per game). */
const LIVE_BANNER_DISMISSED_KEY = 'qt.liveBannerDismissed';

/**
 * First-run reassurance banner for the live control screen. Render it only
 * when the game has hostPlaysAlong — it hides itself once dismissed (the
 * dismissal is persisted per game, so it never reappears for that game).
 */
export function LiveBanner({ gameId }: { gameId: number }) {
  // Start hidden until the persisted flag is read, so it never flashes for
  // hosts who already dismissed it.
  const [visible, setVisible] = useState(false);
  const storageKey = `${LIVE_BANNER_DISMISSED_KEY}.${gameId}`;

  useEffect(() => {
    let cancelled = false;
    setVisible(false);
    getItem(storageKey)
      .then((v) => { if (!cancelled && v !== '1') setVisible(true); })
      .catch(() => { /* stay hidden on storage errors */ });
    return () => { cancelled = true; };
  }, [storageKey]);

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    setItem(storageKey, '1').catch(() => { /* ignore */ });
  };

  return (
    <View style={s.banner}>
      <View style={s.infoCircle}>
        <Ionicons name="information" size={16} color="#f5138c" />
      </View>
      <Text style={s.text}>{COPY.liveBanner.text}</Text>
      <Pressable onPress={dismiss} hitSlop={10} accessibilityLabel="Dismiss">
        <Text style={s.close}>×</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    // RN core has no linear-gradient; use the banner's dominant magenta tint.
    backgroundColor: 'rgba(245,19,140,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(245,19,140,0.4)',
    borderRadius: 14,
    paddingTop: 13,
    paddingBottom: 13,
    paddingLeft: 14,
    paddingRight: 12,
  },
  infoCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(245,19,140,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, fontSize: 13, fontFamily: 'Manrope_600SemiBold', color: '#ffffff' },
  close: { fontSize: 17, color: '#8b93a4', lineHeight: 20 },
});
