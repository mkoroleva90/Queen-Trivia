/**
 * Native equivalent of the web's Brand.CrownMark SVG.
 * Path data and colours are identical to artifacts/trivia-game/src/components/Brand.tsx.
 */
import React from 'react';
import Svg, { Path, Rect, Circle } from 'react-native-svg';

export function CrownMark({ size = 48, color }: { size?: number; color?: string }) {
  // viewBox is 100×84; scale height proportionally
  const height = Math.round((size * 84) / 100);
  // When a tint color is given, render the whole glyph monochrome (design-
  // handoff cyan/magenta crown tiles); otherwise keep the brand colors.
  const crown = color ?? '#ff0080';
  const gems = color ?? '#ffe500';
  return (
    <Svg width={size} height={height} viewBox="0 0 100 84">
      <Path d="M8,66 L8,26 L30,46 L50,14 L70,46 L92,26 L92,66 Z" fill={crown} />
      <Rect x="8" y="64" width="84" height="14" rx="4" fill={crown} />
      <Circle cx="8"  cy="24" r="6"   fill={gems} />
      <Circle cx="50" cy="12" r="7.5" fill={gems} />
      <Circle cx="92" cy="24" r="6"   fill={gems} />
    </Svg>
  );
}
