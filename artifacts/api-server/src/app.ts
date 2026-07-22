
import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { sessionMiddleware } from "./lib/session";
import { corsOrigin } from "./lib/cors";


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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(sessionMiddleware);


app.use("/api", router);


export default app;


