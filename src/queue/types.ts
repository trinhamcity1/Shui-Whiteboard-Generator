export interface RenderJobPayload {
  jobId: string;
}

export interface JobQueue {
  /** Enqueues a render job to run asynchronously. Never blocks on the render itself. */
  enqueueRenderJob(payload: RenderJobPayload): Promise<void>;
}
