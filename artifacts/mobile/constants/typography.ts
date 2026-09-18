import type { TextStyle } from 'react-native';

// These aliases load the exact OTF files used by the web app, not Google Fonts'
// newer Manrope release. Keep aliases stable for existing screen styles.
export const manropeByWeight: Record<number, string> = {
  100: 'Manrope_100Thin',
  200: 'Manrope_100Thin',
  300: 'Manrope_300Light',
  400: 'Manrope_400Regular',
  500: 'Manrope_500Medium',
  600: 'Manrope_600SemiBold',
  700: 'Manrope_700Bold',
  800: 'Manrope_800ExtraBold',
  900: 'Manrope_800ExtraBold',
};

export const regularFont = manropeByWeight[400];

export function resolveTypography(
  style: Pick<TextStyle, 'fontFamily' | 'fontWeight'> = {},
  inheritedFamily = regularFont,
): Pick<TextStyle, 'fontFamily' | 'fontWeight'> {
  const family = style.fontFamily ?? inheritedFamily;
  const isManrope = family === 'Manrope' || Object.values(manropeByWeight).includes(family);
  // Preserve deliberate non-brand fonts, such as error-detail monospace.
  if (!isManrope) return { fontFamily: family, fontWeight: style.fontWeight };

  const weight = style.fontWeight === 'bold' ? 700
    : style.fontWeight === 'normal' ? 400
    : Number(style.fontWeight);
  const fontFamily = style.fontWeight != null
    ? manropeByWeight[Math.max(100, Math.min(900, Math.round(weight / 100) * 100))]
    : family === 'Manrope' ? regularFont : family;

  // Each alias is already a weighted font face. Avoid synthetic bolding or an
  // unavailable system weight replacing the bundled face on iOS/Expo web.
  return { fontFamily: fontFamily ?? regularFont, fontWeight: 'normal' };
}