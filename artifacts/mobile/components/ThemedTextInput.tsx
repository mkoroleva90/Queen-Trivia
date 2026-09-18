/**
 * TextInput with the app's base font applied.
 *
 * Uses the same bundled Manrope face/weight selection as ThemedText.
 */
import React, { forwardRef } from 'react';
import { TextInput as RNTextInput, StyleSheet, type TextInputProps } from 'react-native';
import { resolveTypography } from '@/constants/typography';

export const ThemedTextInput = forwardRef<RNTextInput, TextInputProps>(function ThemedTextInput(
  { style, ...rest },
  ref,
) {
  return <RNTextInput ref={ref} {...rest} style={[style, resolveTypography(StyleSheet.flatten(style))]} />;
});

export { ThemedTextInput as TextInput };
