// Shared CORS allowlist. Only this app's own Replit domains may make
// credentialed cross-origin requests; everything else is rejected.
//
// capacitor://localhost — the origin used by Capacitor's native WebView when
// loading local assets (fallback / dev mode without server.url set).
// ionic://localhost   — legacy alias used by some Capacitor versions on iOS.
// In the hosted-web-app (server.url) model the WebView sends the deployment
// origin instead, which is already covered by REPLIT_DOMAINS.  We include
// the native schemes here so local / offline testing still works without
// requiring a deployed build.
const CAPACITOR_SCHEMES = ["capacitor://localhost", "ionic://localhost"];

const allowedOrigins = new Set<string>(
 [
  ...(process.env.REPLIT_DOMAINS?.split(",") ?? []),
  process.env.REPLIT_DEV_DOMAIN,
  // Expo web preview runs on its own subdomain — must be allowlisted so
  // browser fetch calls from the Expo canvas iframe are not CORS-blocked.
  process.env.REPLIT_EXPO_DEV_DOMAIN,
 ]
  .filter((d): d is string => Boolean(d))
  .map((d) => `https://${d.trim()}`)
  .concat(CAPACITOR_SCHEMES),
);

/** True when the request Origin is absent (same-origin/non-browser) or allowlisted. */
export function isOriginAllowed(origin: string | undefined): boolean {
 return !origin || allowedOrigins.has(origin);
}

export function corsOrigin(
 origin: string | undefined,
 callback: (err: Error | null, allow?: boolean) => void,
): void {
 if (isOriginAllowed(origin)) {
  callback(null, true);
 } else {
  callback(null, false);
 }
}
