import { CloudTasksClient } from "@google-cloud/tasks";
import type { JobQueue, RenderJobPayload } from "./types";

export interface CloudTasksConfig {
  projectId: string;
  location: string;
  queueName: string;
  renderUrl: string; // e.g. https://<cloud-run-url>/internal/render
  serviceAccountEmail: string; // invokes the internal endpoint via OIDC
}

export function loadCloudTasksConfigFromEnv(): CloudTasksConfig {
  const projectId = process.env.FIRESTORE_PROJECT_ID; // same GCP project
  const location = process.env.CLOUD_TASKS_LOCATION;
  const queueName = process.env.CLOUD_TASKS_QUEUE;
  const renderUrl = process.env.INTERNAL_RENDER_URL;
  const serviceAccountEmail = process.env.CLOUD_TASKS_INVOKER_SERVICE_ACCOUNT;

  if (!projectId || !location || !queueName || !renderUrl || !serviceAccountEmail) {
    throw new Error(
      "Missing Cloud Tasks configuration. Set FIRESTORE_PROJECT_ID, CLOUD_TASKS_LOCATION, CLOUD_TASKS_QUEUE, INTERNAL_RENDER_URL, CLOUD_TASKS_INVOKER_SERVICE_ACCOUNT.",
    );
  }

  return { projectId, location, queueName, renderUrl, serviceAccountEmail };
}

/**
 * Real, GCP-native async queue for production. The `/internal/render`
 * endpoint it targets is not part of the public API surface — it's only
 * reachable by Cloud Tasks' own service account via OIDC token auth, per
 * the Phase 2 design.
 */
export class CloudTasksQueue implements JobQueue {
  private client = new CloudTasksClient();

  constructor(private config: CloudTasksConfig) {}

  async enqueueRenderJob(payload: RenderJobPayload): Promise<void> {
    const parent = this.client.queuePath(this.config.projectId, this.config.location, this.config.queueName);

    await this.client.createTask({
      parent,
      task: {
        httpRequest: {
          httpMethod: "POST",
          url: this.config.renderUrl,
          headers: { "Content-Type": "application/json" },
          body: Buffer.from(JSON.stringify(payload)).toString("base64"),
          oidcToken: {
            serviceAccountEmail: this.config.serviceAccountEmail,
          },
        },
      },
    });
  }
}
