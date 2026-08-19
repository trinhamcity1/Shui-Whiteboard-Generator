import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express, { type Express } from "express";
import { requireApiKey } from "./middleware/auth";
import { rateLimit } from "./middleware/rateLimit";
import { errorHandler } from "./middleware/errorHandler";
import { videosRouter } from "./routes/videos";
import { assetsRouter } from "./routes/assets";
import { keysRouter } from "./routes/keys";
import { signupRouter } from "./routes/signup";
import { internalRouter } from "./routes/internal";
import { DevQueue, setDevQueueHandler } from "../queue/devQueue";
import { CloudTasksQueue, loadCloudTasksConfigFromEnv } from "../queue/cloudTasksQueue";
import { handleRenderJob } from "./renderHandler";
import type { JobQueue } from "../queue/types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

export function buildServer(): Express {
  const app = express();
  app.use(express.json({ limit: "2mb" }));

  const useCloudTasks = process.env.CLOUD_TASKS_QUEUE !== undefined;
  const queue: JobQueue = useCloudTasks
    ? new CloudTasksQueue(loadCloudTasksConfigFromEnv())
    : (() => {
        setDevQueueHandler((payload) => handleRenderJob(payload, ROOT));
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

  app.use("/v1", requireApiKey, rateLimit, videosRouter(queue));
  app.use("/v1", requireApiKey, rateLimit, assetsRouter());
  app.use("/v1", requireApiKey, rateLimit, keysRouter());
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
