import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes/index.ts";
import { logger } from "./lib/logger.ts";
import { sessionMiddleware } from "./lib/session.ts";
import { corsOrigin } from "./lib/cors.ts";
import { injectMobileSession } from "./lib/mobileAuth.ts";
import { globalErrorHandler } from "./lib/globalErrorHandler.ts";
export { initSocket, revokeAdminSockets, revokePlayerFromGame, safeEmit } from "./lib/socket.ts";

// Export for integration tests: the router is mounted at /api before the
// global error handler, so test routes added to it will have 500-handling.
export { globalErrorHandler, router };


const app: Express = express();


// Trust the Replit reverse proxy so express-rate-limit can read real client IPs
app.set("trust proxy", 1);


app.use(
 pinoHttp({
  logger,
  serializers: {
      req(req) {
          return {
           id: req.id,
           method: req.method,
           url: req.url?.split("?")[0],
          };
      },
      res(res) {
          return {
           statusCode: res.statusCode,
          };
      },
     },
 }),
);
// Restrict CORS to this app's own origins only. Reflecting arbitrary origins
// with credentials enabled would let any malicious site make authenticated
// requests using a visitor's session cookie.
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json({ limit: "64kb" }));
app.use(express.urlencoded({ extended: true }));
app.use(sessionMiddleware);
// Evaluate any Bearer token on every request. For admin tokens this runs before
// honoring a cookie session, so revoked (post-password-change) tokens cannot
// fall back to cookie-derived admin access.
// Must run after sessionMiddleware so req.session is available.
app.use(injectMobileSession);

app.use("/api", router);

// Global error handler — must be registered after all routes.
app.use(globalErrorHandler);

export default app;

