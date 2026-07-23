
import { createServer } from "node:http";
import app from "./app";
import { initSocket } from "./lib/socket";
import { logger } from "./lib/logger";
import { bootstrapAccessCodes } from "./lib/bootstrapAccessCodes";


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


