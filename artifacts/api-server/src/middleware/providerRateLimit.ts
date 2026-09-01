
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { Request } from "express";
import { PgRateLimitStore } from "./pgRateLimitStore.ts";

function providerKey(namespace: string): (req: Request) => string {
 return (req) => {
  const adminAccountId = req.session.adminAccountId;
  if (typeof adminAccountId === "number" && Number.isSafeInteger(adminAccountId) && adminAccountId > 0) {
   return `provider:${namespace}:admin:${adminAccountId}`;
  }
  return `provider:${namespace}:ip:${ipKeyGenerator(req.ip ?? "0.0.0.0")}`;
 };
}

/**
* Strict limit for the bulk Gemini question-generation endpoint.
* Each call may retry across multiple models and consume significant quota.
* 5 requests per 10 minutes per authenticated host account.
* PostgreSQL keeps the counter consistent across all deployed replicas.
*/
export const geminiGenerateRateLimit = rateLimit({
 windowMs: 10 * 60 * 1000,
 limit: 5,
 standardHeaders: "draft-8",
 legacyHeaders: false,
 message: { error: "Too many generation requests. Please wait before generating again." },
 store: new PgRateLimitStore(false),
 keyGenerator: providerKey("gemini-generate"),
});


/**
* Moderate limit for single-question Gemini operations (regenerate, enhance, fact-check).
* 20 requests per 10 minutes per authenticated host account.
*/
export const geminiOperationRateLimit = rateLimit({
 windowMs: 10 * 60 * 1000,
 limit: 20,
 standardHeaders: "draft-8",
 legacyHeaders: false,
 message: { error: "Too many AI requests. Please wait before trying again." },
 store: new PgRateLimitStore(false),
 keyGenerator: providerKey("gemini-operation"),
});


/**
* Limit for the OpenTDB import endpoint.
* Prevents scripted upstream fetches and DB insert floods.
* 10 requests per 10 minutes per authenticated host account.
*/
export const opentdbRateLimit = rateLimit({
 windowMs: 10 * 60 * 1000,
 limit: 10,
 standardHeaders: "draft-8",
 legacyHeaders: false,
 message: { error: "Too many import requests. Please wait before importing again." },
 store: new PgRateLimitStore(false),
 keyGenerator: providerKey("opentdb-import"),
});


