/**
 * Global Express error handler.
 *
 * Must be registered after all routes in the Express app. Catches any
 * unhandled async/sync route error and returns a clean JSON response instead
 * of Express's default HTML error page, which could leak stack traces to clients.
 *
 * Preserves 4xx HTTP status codes set by middleware (e.g. 413 from the body
 * size cap) so callers receive the correct status. All 5xx or unknown errors
 * are normalised to 500 with a generic message to avoid leaking internals.
 */

import type { NextFunction, Request, Response } from "express";
import { logger } from "./logger.ts";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function globalErrorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  logger.error({ err }, "Unhandled route error");
  const httpErr = err as { status?: number; statusCode?: number };
  const status =
    typeof httpErr?.status === "number" ? httpErr.status :
    typeof httpErr?.statusCode === "number" ? httpErr.statusCode : 500;
  if (status >= 400 && status < 500) {
    const message = (err as Error)?.message ?? "Request error";
    res.status(status).json({ error: message });
  } else {
    res.status(500).json({ error: "Internal server error" });
  }
}
