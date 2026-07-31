import { useColorScheme } from 'react-native';
import colors from '@/constants/colors';

/**
 * Returns the design tokens for the current color scheme.
 * The app is dark-only; this hook still reads the system scheme so a future
 * light mode can be added without touching call sites.
 */
export function useColors() {
  const scheme = useColorScheme();
  const palette = scheme === 'dark' && colors.dark ? colors.dark : colors.light;
  return { ...palette, radius: colors.radius };
}
