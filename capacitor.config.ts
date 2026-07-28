import type { CapacitorConfig } from "@capacitor/cli";

// ─── Hosted Web App Model ──────────────────────────────────────────────────
//
// Trivia Night uses a live Postgres-backed Express server + Socket.io for
// real-time multiplayer.  Bundling static assets into the native shell would
// break those features, so the WebView loads from the deployed Replit URL
// instead (server.url).
//
// Before building in Xcode you MUST set CAPACITOR_SERVER_URL to your
// production deployment URL, e.g.:
//
//   CAPACITOR_SERVER_URL=https://trivia-night.replit.app npx cap sync ios
//
// Get the URL from the "Deploy" tab in Replit after publishing.
//
// webDir still points at the Vite build output — Capacitor uses it as a
// fallback / reference, and cap sync copies it in case server.url is absent.
// ──────────────────────────────────────────────────────────────────────────

const serverUrl = process.env["CAPACITOR_SERVER_URL"];

const config: CapacitorConfig = {
  appId: "com.trivianight.app",
  appName: "Trivia Night",

  // Vite writes its production build here (see artifacts/trivia-game/vite.config.ts)
  webDir: "artifacts/trivia-game/dist/public",

  server: {
    // ⚠️  Replace with your actual Replit deployment URL before Xcode build.
    //    If the env var is not set the value is left undefined, which causes
    //    Capacitor to fall back to serving from webDir (local assets only —
    //    real-time features will not work).
    url: serverUrl,

    // Force HTTPS — Capacitor blocks cleartext HTTP on iOS by default anyway.
    cleartext: false,

    // Use the standard capacitor:// scheme for local-asset requests.
    // (Only relevant when server.url is not set / as fallback.)
    androidScheme: "https",
  },

  ios: {
    // Respect the iOS safe-area insets so content doesn't hide behind
    // the notch / Dynamic Island.
    contentInset: "automatic",

    // Scroll behaviour matching native feel.
    scrollEnabled: true,
  },
};

export default config;
