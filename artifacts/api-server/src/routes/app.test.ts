/**
 * Integration tests for Express app safety nets.
 *
 * Verifies that the *production* app configuration enforces:
 *  - Body size cap: oversized JSON bodies are rejected with 413
 *  - Zod validation: malformed/missing fields on POST /api/auth/login get 400
 *  - Global error handler: unhandled route errors produce 500 JSON
 *
 * Imports from dist/app.mjs (the pre-bundled production module) so that the
 * full middleware stack — express.json limit, /api router mount, globalErrorHandler
 * registration — is exercised exactly as it runs in production.
 *
 * Run with:
 *   node --experimental-strip-types --test src/routes/app.test.ts
 * (Requires dist/app.mjs to exist — run `pnpm run build` first)
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import type { IRouter } from "express";

// Set SESSION_SECRET before the bundle loads — session.ts reads it
// synchronously during module initialisation and throws if absent.
process.env.SESSION_SECRET = "test-secret-for-unit-tests-32chars!!";

// Import from the pre-bundled ESM output so Node doesn't need to resolve the
// workspace TypeScript dependency chain (which uses directory imports that the
// strip-types runner cannot handle).
const { default: app, router } = await import("../../dist/app.mjs") as {
  default: import("express").Express;
  router: IRouter;
};

// Inject a test-only route into the real /api router *before* the global error
// handler — the router is mounted at /api ahead of globalErrorHandler in app.ts,
// so errors thrown here propagate to the production error handler.
(router as IRouter).get("/test-error-trigger", () => {
  throw new Error("deliberate test error");
});

// ── Body-size cap (413) ──────────────────────────────────────────────────────
//
// app.ts registers express.json({ limit: "64kb" }) before any route.
// Sending a body above that limit must return 413 — the globalErrorHandler
// preserves 4xx status codes emitted by body-parser middleware.

describe("body size cap", () => {
  it("rejects a JSON body larger than 64 KB with 413", async () => {
    const bigBody = JSON.stringify({ data: "x".repeat(70 * 1024) });

    const res = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send(bigBody);

    assert.equal(res.status, 413, `expected 413 but got ${res.status}`);
  });

  it("returns a JSON error body (not HTML) for oversized requests", async () => {
    const bigBody = JSON.stringify({ data: "x".repeat(70 * 1024) });

    const res = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send(bigBody);

    assert.ok(
      res.headers["content-type"]?.includes("application/json"),
      `expected JSON content-type but got: ${res.headers["content-type"]}`,
    );
  });
});

// ── Zod validation on POST /api/auth/login (400) ─────────────────────────────
//
// session.ts calls PlayerLoginBody.safeParse(req.body) and returns a 400 JSON
// response when validation fails — before any database interaction.

describe("POST /api/auth/login — Zod validation", () => {
  it("returns 400 JSON for a completely empty body", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({});

    assert.equal(res.status, 400, `expected 400 but got ${res.status}`);
    assert.ok(
      res.headers["content-type"]?.includes("application/json"),
      "validation error must be JSON, not HTML",
    );
    assert.equal(typeof res.body.error, "string");
    assert.ok(res.body.error.length > 0, "error message must be non-empty");
  });

  it("returns 400 JSON when the required 'code' field is absent", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ name: "Alice" });

    assert.equal(res.status, 400, `expected 400 but got ${res.status}`);
    assert.ok(
      res.headers["content-type"]?.includes("application/json"),
      "validation error must be JSON, not HTML",
    );
    assert.equal(typeof res.body.error, "string");
  });

  it("returns 400 JSON when 'code' is the wrong type", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ code: 12345, name: "Alice" }); // code must be a string

    assert.equal(res.status, 400, `expected 400 but got ${res.status}`);
    assert.ok(
      res.headers["content-type"]?.includes("application/json"),
      "validation error must be JSON, not HTML",
    );
  });
});

// ── Global error handler (500) ───────────────────────────────────────────────
//
// Any route that throws must reach the production globalErrorHandler and return
// { error: "Internal server error" } with status 500 — never an HTML stack trace.
// The test route was injected into the real /api router above.

describe("global error handler", () => {
  it('returns { error: "Internal server error" } JSON with status 500', async () => {
    const res = await request(app).get("/api/test-error-trigger");

    assert.equal(res.status, 500, `expected 500 but got ${res.status}`);
    assert.ok(
      res.headers["content-type"]?.includes("application/json"),
      "500 response must be JSON, not HTML",
    );
    assert.deepEqual(res.body, { error: "Internal server error" });
  });

  it("does not leak the internal error message to the caller", async () => {
    const res = await request(app).get("/api/test-error-trigger");

    assert.equal(res.status, 500);
    const body = JSON.stringify(res.body);
    assert.ok(
      !body.includes("deliberate test error"),
      "internal error message must not appear in the response body",
    );
  });
});
