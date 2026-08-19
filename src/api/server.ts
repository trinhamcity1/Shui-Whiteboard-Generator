import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express, { type Express } from "express";
import cors from "cors";
import { requireApiKey } from "./middleware/auth";
import { rateLimit } from "./middleware/rateLimit";
import { errorHandler } from "./middleware/errorHandler";
import { videosRouter } from "./routes/videos";
import { assetsRouter } from "./routes/assets";
import { keysRouter } from "./routes/keys";
import { signupRouter } from "./routes/signup";
import { pricingRouter } from "./routes/pricing";
import { accountRouter } from "./routes/account";
import { echoRouter } from "./routes/echo";
import { internalRouter } from "./routes/internal";
import { DevQueue, setDevQueueHandler, setDevEchoQueueHandler } from "../queue/devQueue";
import { CloudTasksQueue, loadCloudTasksConfigFromEnv } from "../queue/cloudTasksQueue";
import { handleRenderJob } from "./renderHandler";
import { handleEchoTrainingJob } from "./echoTrainHandler";
import type { JobQueue } from "../queue/types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

export function buildServer(): Express {
  const app = express();

  // The web app calls this API from a different origin (its own Vercel/
  // Cloud Run domain, or localhost:3000 in dev) — auth is the x-api-key
  // header, never a cookie, so an allow-listed CORS origin adds no real
  // credential-leak risk the way it would for cookie auth. Defaults to
  // "*" (any origin) when CORS_ALLOWED_ORIGINS isn't set, since a missing
  // config value should fail open to "the web app can't reach the API,
  // some CORS error, come read this comment" rather than a client-side 401
  // wrongly blamed on the request itself.
  const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS?.split(",").map((o) => o.trim());
  app.use(cors({ origin: allowedOrigins ?? true }));

  app.use(express.json({ limit: "2mb" }));

  const useCloudTasks = process.env.CLOUD_TASKS_QUEUE !== undefined;
  const queue: JobQueue = useCloudTasks
    ? new CloudTasksQueue(loadCloudTasksConfigFromEnv())
    : (() => {
        setDevQueueHandler((payload) => handleRenderJob(payload, ROOT));
        setDevEchoQueueHandler((payload) => handleEchoTrainingJob(payload));
        console.log("Queue: DevQueue (in-process, local dev only — set CLOUD_TASKS_QUEUE to use real Cloud Tasks).");
        return new DevQueue();
      })();

  app.get("/healthz", (_req, res) => {
    res.json({ status: "ok" });
  });

  // The one route reachable with no x-api-key — it's how a stranger gets
  // their first one. Its rate limiter is applied inside the router,
  // scoped to just that route (see signup.ts).
  app.use("/v1", signupRouter());
  app.use("/v1", pricingRouter());

  app.use("/v1", requireApiKey, rateLimit, videosRouter(queue));
  app.use("/v1", requireApiKey, rateLimit, assetsRouter());
  app.use("/v1", requireApiKey, rateLimit, keysRouter());
  app.use("/v1", requireApiKey, rateLimit, accountRouter());
  app.use("/v1", requireApiKey, rateLimit, echoRouter(queue));
  app.use(internalRouter(ROOT));

  app.use(errorHandler);

  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT ?? 8080);
  const app = buildServer();
  app.listen(port, () => {
    console.log(`Shui WG API listening on :${port}`);
  });
}
