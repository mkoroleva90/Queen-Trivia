
import { createServer } from "node:http";
import app from "./app.ts";
import { initSocket } from "./lib/socket.ts";
import { logger } from "./lib/logger.ts";
import { bootstrapAccessCodes } from "./lib/bootstrapAccessCodes.ts";

// ── Startup guard: SESSION_SECRET must be set to a non-default value ─────────
// Checked here (at boot) so the process dies before accepting any traffic,
// rather than failing on the first token sign/verify.
const _sessionSecret = process.env.SESSION_SECRET;
if (!_sessionSecret || _sessionSecret === "dev-fallback-secret") {
  logger.fatal(
    "FATAL: SESSION_SECRET is missing or set to the insecure fallback value. " +
      "Set a strong random secret before starting the server.",
  );
  process.exit(1);
}


const rawPort = process.env["PORT"];


if (!rawPort) {
    throw new Error(
     "PORT environment variable is required but was not provided.",
    );
}


const port = Number(rawPort);


if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Invalid PORT value: "${rawPort}"`);
}


const httpServer = createServer(app);


initSocket(httpServer);


httpServer.on("error", (err) => {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
});


// Seed/rotate access codes BEFORE accepting any traffic, so there is no
// window where publicly documented default codes can authenticate.
async function start(): Promise<void> {
	await bootstrapAccessCodes();
	httpServer.listen(port, () => {
		logger.info({ port }, "Server listening");
	});
}

start().catch((err) => {
	logger.error({ err }, "Failed to bootstrap access codes");
	process.exit(1);
});


