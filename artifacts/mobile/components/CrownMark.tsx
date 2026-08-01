/**
 * Native equivalent of the web's Brand.CrownMark SVG.
 * Path data and colours are identical to artifacts/trivia-game/src/components/Brand.tsx.
 */
import React from 'react';
import Svg, { Path, Rect, Circle } from 'react-native-svg';

export function CrownMark({ size = 48 }: { size?: number }) {
  // viewBox is 100×84; scale height proportionally
  const height = Math.round((size * 84) / 100);
  return (
    <Svg width={size} height={height} viewBox="0 0 100 84">
      <Path d="M8,66 L8,26 L30,46 L50,14 L70,46 L92,26 L92,66 Z" fill="#ff0080" />
      <Rect x="8" y="64" width="84" height="14" rx="4" fill="#ff0080" />
      <Circle cx="8"  cy="24" r="6"   fill="#ffe500" />
      <Circle cx="50" cy="12" r="7.5" fill="#ffe500" />
      <Circle cx="92" cy="24" r="6"   fill="#ffe500" />
    </Svg>
  );
}
