/**
 * Sign in with Apple token endpoints — authorization-code exchange and
 * refresh-token revocation.
 *
 * Both operations authenticate to Apple with a short-lived client-secret JWT
 * (ES256) built from:
 *   APPLE_TEAM_ID      — Apple Developer team ID (JWT `iss`)
 *   APPLE_KEY_ID       — key ID of the Sign in with Apple private key (`kid`)
 *   APPLE_PRIVATE_KEY  — the .p8 private key, PEM text (literal "\n" allowed)
 * and the client ID the authorization was issued to:
 *   APPLE_CLIENT_ID_IOS — native app bundle ID (mobile route)
 *   APPLE_CLIENT_ID_WEB — Services ID (web route)
 *
 * Nothing here throws. Every failure is logged as a warning and reported via
 * the return value so sign-in and account deletion are never blocked.
 */

import { importPKCS8, SignJWT } from "jose";
import { logger } from "./logger.ts";

const APPLE_TOKEN_URL = "https://appleid.apple.com/auth/token";
const APPLE_REVOKE_URL = "https://appleid.apple.com/auth/revoke";
const APPLE_AUDIENCE = "https://appleid.apple.com";

/** Must match the redirectURI the web client passes to AppleID.auth.init. */
export const APPLE_WEB_REDIRECT_URI = "https://queen-trivia.com/auth/apple/callback";

export type AppleClientPlatform = "ios" | "web";

/** Client ID for the given platform, or null when not configured. */
export function getAppleClientId(platform: AppleClientPlatform): string | null {
  const value =
    platform === "ios"
      ? process.env["APPLE_CLIENT_ID_IOS"]
      : process.env["APPLE_CLIENT_ID_WEB"];
  return value?.trim() || null;
}

/**
 * Build the client_secret JWT Apple requires on its token endpoints.
 * Returns null (after logging) when any signing input is missing or invalid.
 */
async function buildAppleClientSecret(clientId: string): Promise<string | null> {
  const teamId = process.env["APPLE_TEAM_ID"]?.trim();
  const keyId = process.env["APPLE_KEY_ID"]?.trim();
  const rawKey = process.env["APPLE_PRIVATE_KEY"];

  if (!teamId || !keyId || !rawKey) {
    logger.warn(
      {
        hasTeamId: Boolean(teamId),
        hasKeyId: Boolean(keyId),
        hasPrivateKey: Boolean(rawKey),
      },
      "Apple client secret cannot be built — APPLE_TEAM_ID, APPLE_KEY_ID or APPLE_PRIVATE_KEY is not set.",
    );
    return null;
  }

  try {
    // Secrets UIs often store the PEM with literal backslash-n sequences.
    const pem = rawKey.replace(/\\n/g, "\n").trim();
    const privateKey = await importPKCS8(pem, "ES256");
    return await new SignJWT({})
      .setProtectedHeader({ alg: "ES256", kid: keyId })
      .setIssuer(teamId)
      .setIssuedAt()
      .setExpirationTime("5m")
      .setAudience(APPLE_AUDIENCE)
      .setSubject(clientId)
      .sign(privateKey);
  } catch (err) {
    logger.warn({ err }, "Apple client secret could not be signed — check APPLE_PRIVATE_KEY.");
    return null;
  }
}

async function postAppleForm(
  url: string,
  form: Record<string, string>,
): Promise<{ ok: boolean; status: number; body: string }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(form).toString(),
  });
  const body = await res.text();
  return { ok: res.ok, status: res.status, body };
}

/**
 * Exchange a Sign in with Apple authorization code for tokens and return the
 * refresh token, or null when the exchange could not be completed.
 */
export async function exchangeAppleAuthorizationCode(params: {
  authorizationCode: string;
  platform: AppleClientPlatform;
}): Promise<string | null> {
  const { authorizationCode, platform } = params;
  const clientId = getAppleClientId(platform);
  if (!clientId) {
    logger.warn(
      { platform },
      "Apple authorization code not exchanged — APPLE_CLIENT_ID_IOS / APPLE_CLIENT_ID_WEB is not set.",
    );
    return null;
  }

  const clientSecret = await buildAppleClientSecret(clientId);
  if (!clientSecret) return null;

  try {
    const form: Record<string, string> = {
      client_id: clientId,
      client_secret: clientSecret,
      code: authorizationCode,
      grant_type: "authorization_code",
    };
    // Apple requires the redirect URI used by the web JS flow; native apps
    // authorise without one.
    if (platform === "web") form["redirect_uri"] = APPLE_WEB_REDIRECT_URI;

    const { ok, status, body } = await postAppleForm(APPLE_TOKEN_URL, form);
    if (!ok) {
      logger.warn(
        { platform, status, body: body.slice(0, 300) },
        "Apple authorization code exchange failed — continuing sign-in without a refresh token.",
      );
      return null;
    }

    const parsed = JSON.parse(body) as { refresh_token?: unknown };
    if (typeof parsed.refresh_token !== "string" || !parsed.refresh_token) {
      logger.warn({ platform }, "Apple token response did not include a refresh_token.");
      return null;
    }
    return parsed.refresh_token;
  } catch (err) {
    logger.warn({ err, platform }, "Apple authorization code exchange threw — continuing sign-in.");
    return null;
  }
}

/**
 * Revoke a stored Apple refresh token. The provider link does not record which
 * client ID issued the grant, so each configured client ID is tried in turn
 * until Apple accepts the revocation. Returns true on success.
 */
export async function revokeAppleRefreshToken(refreshToken: string): Promise<boolean> {
  const platforms: AppleClientPlatform[] = ["ios", "web"];
  const clientIds = platforms
    .map((p) => getAppleClientId(p))
    .filter((v): v is string => Boolean(v));

  if (clientIds.length === 0) {
    logger.warn("Apple token not revoked — no APPLE_CLIENT_ID_IOS / APPLE_CLIENT_ID_WEB configured.");
    return false;
  }

  for (const clientId of clientIds) {
    const clientSecret = await buildAppleClientSecret(clientId);
    if (!clientSecret) return false;

    try {
      const { ok, status, body } = await postAppleForm(APPLE_REVOKE_URL, {
        client_id: clientId,
        client_secret: clientSecret,
        token: refreshToken,
        token_type_hint: "refresh_token",
      });
      if (ok) return true;
      logger.warn(
        { clientId, status, body: body.slice(0, 300) },
        "Apple token revocation rejected for this client ID.",
      );
    } catch (err) {
      logger.warn({ err, clientId }, "Apple token revocation request threw.");
    }
  }

  return false;
}
