
import rateLimit from "express-rate-limit";
import type { Request } from "express";

const isDev = process.env["NODE_ENV"] !== "production";

function isLoopback(req: Request): boolean {
  const ip = req.ip ?? "";
  return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
}

export const authRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Too many attempts. Please try again later." },
    skipSuccessfulRequests: false,
    // Skip rate-limiting for loopback requests in development so smoke tests
    // and local scripts can exercise all endpoints without hitting the limit.
    skip: (req) => isDev && isLoopback(req),
});


