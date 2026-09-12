/**
 * Unit tests for the Apple audience configuration gate in verifyAppleToken.
 * Run with:  node --experimental-strip-types --test src/lib/ssoVerify.test.ts
 */
import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { verifyAppleToken } from "./ssoVerify.ts";

const APPLE_AUD_VARS = [
  "APPLE_CLIENT_ID_IOS",
  "APPLE_CLIENT_ID_WEB",
  "APPLE_BUNDLE_ID",
  "APPLE_SERVICES_ID",
] as const;

function clearAppleAudVars() {
  for (const n of APPLE_AUD_VARS) delete process.env[n];
}

describe("verifyAppleToken — audience configuration gate", () => {
  afterEach(clearAppleAudVars);

  it("throws 503 when no Apple audience env var is set", async () => {
    clearAppleAudVars();
    await assert.rejects(
      () => verifyAppleToken("not-a-jwt"),
      (err: any) => err.statusCode === 503,
    );
  });

  it("passes the config gate when the documented APPLE_CLIENT_ID_IOS is set", async () => {
    clearAppleAudVars();
    process.env["APPLE_CLIENT_ID_IOS"] = "com.example.app";
    // Gate passes; the malformed token then fails to parse -> 401, NOT 503.
    // "not-a-jwt" has no dots, so jose rejects it before any JWKS network fetch.
    await assert.rejects(
      () => verifyAppleToken("not-a-jwt"),
      (err: any) => err.statusCode === 401,
    );
  });

  it("passes the config gate when the documented APPLE_CLIENT_ID_WEB is set", async () => {
    clearAppleAudVars();
    process.env["APPLE_CLIENT_ID_WEB"] = "com.example.web";
    await assert.rejects(
      () => verifyAppleToken("not-a-jwt"),
      (err: any) => err.statusCode === 401,
    );
  });
});
