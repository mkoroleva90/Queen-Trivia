// Shared CORS allowlist. Only this app's own Replit domains may make
// credentialed cross-origin requests; everything else is rejected.

const allowedOrigins = new Set<string>(
 [
  ...(process.env.REPLIT_DOMAINS?.split(",") ?? []),
  process.env.REPLIT_DEV_DOMAIN,
 ]
  .filter((d): d is string => Boolean(d))
  .map((d) => `https://${d.trim()}`),
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
