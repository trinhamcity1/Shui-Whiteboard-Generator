export interface RenderJobPayload {
  jobId: string;
}

export interface EchoTrainingJobPayload {
  echoModelId: string;
}

export interface JobQueue {
  /** Enqueues a render job to run asynchronously. Never blocks on the render itself. */
  enqueueRenderJob(payload: RenderJobPayload): Promise<void>;
  /** Enqueues an Echo model (re)training job to run asynchronously — same reasoning as enqueueRenderJob, just a different long-running real-money operation. */
  enqueueEchoTrainingJob(payload: EchoTrainingJobPayload): Promise<void>;
}
