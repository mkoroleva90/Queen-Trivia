/**
 * Text with the app's base font applied.
 *
 * Selects the bundled web font face for each weight and preserves the face in
 * nested text (for example, a colored span inside a bold heading).
 */
import React, { createContext, forwardRef, useContext } from 'react';
import { Text as RNText, StyleSheet, type TextProps } from 'react-native';
import { regularFont, resolveTypography } from '@/constants/typography';

const FontContext = createContext(regularFont);

export const ThemedText = forwardRef<RNText, TextProps>(function ThemedText(
  { style, ...rest },
  ref,
) {
  const inheritedFamily = useContext(FontContext);
  const typography = resolveTypography(StyleSheet.flatten(style), inheritedFamily);
  return (
    <FontContext.Provider value={typography.fontFamily ?? inheritedFamily}>
      <RNText ref={ref} {...rest} style={[style, typography]} />
    </FontContext.Provider>
  );
});

export { ThemedText as Text };
