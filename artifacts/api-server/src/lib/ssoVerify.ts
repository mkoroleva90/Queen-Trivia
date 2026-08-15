/**
 * SSO identity-token verification helpers.
 *
 * Google: verifies the ID token via google-auth-library against one or more
 *   configured OAuth client IDs (GOOGLE_OAUTH_CLIENT_ID_WEB / _IOS / _ANDROID).
 *
 * Apple: verifies the identity token's signature against Apple's public JWK set
 *   (https://appleid.apple.com/auth/keys) via jose, then checks issuer and
 *   audience against APPLE_BUNDLE_ID and/or APPLE_SERVICES_ID.
 *
 * Both functions throw on failure.  Errors carry a `statusCode` property so
 * callers can forward the right HTTP status to the client.
 */

import { OAuth2Client } from "google-auth-library";
import { createRemoteJWKSet, jwtVerify } from "jose";

// ---------------------------------------------------------------------------
// Shared identity shape
// ---------------------------------------------------------------------------

export interface SSOIdentity {
  provider: "google" | "apple";
  /** Permanent stable user ID ('sub' claim). */
  subject: string;
  email: string | null;
  emailVerified: boolean;
  /** Present in Google tokens. Apple never includes it — callers must supply it
   *  from the request body when available. */
  name: string | null;
}

// ---------------------------------------------------------------------------
// Internal error helper
// ---------------------------------------------------------------------------

function ssoErr(message: string, statusCode: number): Error {
  return Object.assign(new Error(message), { statusCode });
}

// ---------------------------------------------------------------------------
// Google
// ---------------------------------------------------------------------------

export async function verifyGoogleToken(idToken: string): Promise<SSOIdentity> {
  const clientIds = [
    process.env["GOOGLE_OAUTH_CLIENT_ID_WEB"],
    process.env["GOOGLE_OAUTH_CLIENT_ID_IOS"],
    process.env["GOOGLE_OAUTH_CLIENT_ID_ANDROID"],
  ].filter((v): v is string => Boolean(v));

  if (clientIds.length === 0) {
    throw ssoErr("Google sign-in is not configured on this server.", 503);
  }

  const client = new OAuth2Client();
  let ticket;
  try {
    ticket = await client.verifyIdToken({ idToken, audience: clientIds });
  } catch {
    throw ssoErr("Invalid Google identity token.", 401);
  }

  const payload = ticket.getPayload();
  if (!payload?.sub) {
    throw ssoErr("Invalid Google identity token.", 401);
  }

  return {
    provider: "google",
    subject: payload.sub,
    email: payload.email ?? null,
    emailVerified: payload.email_verified ?? false,
    name: payload.name ?? null,
  };
}

// ---------------------------------------------------------------------------
// Apple
// ---------------------------------------------------------------------------

const APPLE_ISSUER = "https://appleid.apple.com";
const APPLE_JWKS_URI = "https://appleid.apple.com/auth/keys";

// Module-level singleton — jose handles key rotation automatically.
let _appleJwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function getAppleJwks() {
  if (!_appleJwks) _appleJwks = createRemoteJWKSet(new URL(APPLE_JWKS_URI));
  return _appleJwks;
}

export async function verifyAppleToken(idToken: string): Promise<SSOIdentity> {
  const audiences = [
    process.env["APPLE_BUNDLE_ID"],
    process.env["APPLE_SERVICES_ID"],
  ].filter((v): v is string => Boolean(v));

  if (audiences.length === 0) {
    throw ssoErr("Apple sign-in is not configured on this server.", 503);
  }

  // Verify signature + issuer; check audience manually so we accept either
  // the native bundle ID or the web services ID.
  let payload: Awaited<ReturnType<typeof jwtVerify>>["payload"];
  try {
    ({ payload } = await jwtVerify(idToken, getAppleJwks(), {
      issuer: APPLE_ISSUER,
    }));
  } catch {
    throw ssoErr("Invalid Apple identity token.", 401);
  }

  const aud = Array.isArray(payload.aud) ? payload.aud[0] : payload.aud;
  if (!aud || !audiences.includes(aud)) {
    throw ssoErr("Apple token audience is not recognised.", 401);
  }

  if (typeof payload.sub !== "string" || !payload.sub) {
    throw ssoErr("Apple token is missing subject.", 401);
  }

  const rawVerified = payload["email_verified"];
  const emailVerified = rawVerified === true || rawVerified === "true";

  return {
    provider: "apple",
    subject: payload.sub,
    email: typeof payload.email === "string" ? payload.email : null,
    emailVerified,
    name: null, // Apple never includes the name in the identity token
  };
}
