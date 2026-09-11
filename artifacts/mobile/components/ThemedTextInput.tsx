/**
 * TextInput with the app's base font applied.
 *
 * Mirrors ThemedText: Manrope_400Regular goes first in the style array and any
 * fontFamily (or other property) in the caller's `style` overrides it. Import
 * `TextInput` from here instead of 'react-native' inside artifacts/mobile/app
 * and /components.
 */
import React, { forwardRef } from 'react';
import { TextInput as RNTextInput, StyleSheet, type TextInputProps } from 'react-native';

const base = StyleSheet.create({
  input: { fontFamily: 'Manrope_400Regular' },
});

export const ThemedTextInput = forwardRef<RNTextInput, TextInputProps>(function ThemedTextInput(
  { style, ...rest },
  ref,
) {
  return <RNTextInput ref={ref} {...rest} style={[base.input, style]} />;
});

export { ThemedTextInput as TextInput };
