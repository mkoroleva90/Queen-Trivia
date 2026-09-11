/**
 * Text with the app's base font applied.
 *
 * React Native doesn't inherit fonts via CSS, so every Text needs a fontFamily.
 * This wrapper puts Manrope_400Regular first in the style array; any fontFamily
 * (or other property) in the caller's `style` overrides it. Import `Text` from
 * here instead of 'react-native' inside artifacts/mobile/app and /components.
 */
import React, { forwardRef } from 'react';
import { Text as RNText, StyleSheet, type TextProps } from 'react-native';

const base = StyleSheet.create({
  text: { fontFamily: 'Manrope_400Regular' },
});

export const ThemedText = forwardRef<RNText, TextProps>(function ThemedText(
  { style, ...rest },
  ref,
) {
  return <RNText ref={ref} {...rest} style={[base.text, style]} />;
});

export { ThemedText as Text };
