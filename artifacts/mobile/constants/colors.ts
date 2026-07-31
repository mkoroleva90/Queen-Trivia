/**
 * Design tokens synced from the sibling web artifact (artifacts/trivia-game/src/index.css).
 * The app is dark-only to match the web app's aesthetic.
 * Primary: hot pink #ff0080, Secondary: neon cyan #00ddff, Accent: electric yellow #ffe500
 */

const colors = {
  light: {
    // Aliases
    text: '#f9f9fa',
    tint: '#ff0080',

    background: '#0d0f15',
    foreground: '#f9f9fa',

    card: '#0b1120',
    cardForeground: '#f9f9fa',

    primary: '#ff0080',
    primaryForeground: '#ffffff',

    secondary: '#00ddff',
    secondaryForeground: '#041016',

    muted: '#1a2035',
    mutedForeground: '#8896aa',

    accent: '#ffe500',
    accentForeground: '#041016',

    destructive: '#ff3366',
    destructiveForeground: '#ffffff',

    border: '#1a2035',
    input: '#1a2035',
  },

  dark: {
    text: '#f9f9fa',
    tint: '#ff0080',

    background: '#0d0f15',
    foreground: '#f9f9fa',

    card: '#0b1120',
    cardForeground: '#f9f9fa',

    primary: '#ff0080',
    primaryForeground: '#ffffff',

    secondary: '#00ddff',
    secondaryForeground: '#041016',

    muted: '#1a2035',
    mutedForeground: '#8896aa',

    accent: '#ffe500',
    accentForeground: '#041016',

    destructive: '#ff3366',
    destructiveForeground: '#ffffff',

    border: '#1a2035',
    input: '#1a2035',
  },

  radius: 14,
};

export default colors;
