import type { JobQueue, RenderJobPayload } from "./types";

type RenderHandler = (payload: RenderJobPayload) => Promise<void>;

let handler: RenderHandler | undefined;

/** Wired up once at server startup to point at the /internal/render logic. */
export function setDevQueueHandler(fn: RenderHandler): void {
  handler = fn;
}

/**
 * Local-dev stand-in for Cloud Tasks: runs the render handler in-process,
 * off the request's call stack, so `generate` still returns immediately
 * the same way it will in production. Not for deployment — Cloud Run
 * instances can be torn down between requests, so an in-process "queue"
 * would silently drop work; CloudTasksQueue is what actually ships.
 */
export class DevQueue implements JobQueue {
  async enqueueRenderJob(payload: RenderJobPayload): Promise<void> {
    if (!handler) {
      throw new Error("DevQueue has no render handler wired up — call setDevQueueHandler() at startup.");
    }
    const activeHandler = handler;
    setImmediate(() => {
      activeHandler(payload).catch((err) => {
        console.error(`DevQueue: render job ${payload.jobId} failed:`, err);
      });
    });
  }
}
