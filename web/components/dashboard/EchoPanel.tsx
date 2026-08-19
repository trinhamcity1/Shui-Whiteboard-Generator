"use client";

import { useEffect, useState } from "react";
import { createEchoModel, fetchEchoModels, retrainEchoModel, ApiRequestError, type EchoModelSummary } from "@/lib/api";

const STATUS_LABEL: Record<EchoModelSummary["status"], string> = {
  pending: "Queued",
  generating_candidates: "Generating variations…",
  selecting: "Selecting best images…",
  training: "Training…",
  ready: "Ready",
  failed: "Failed",
};

export function EchoPanel({
  apiKey,
  models,
  onChange,
}: {
  apiKey: string;
  models: EchoModelSummary[];
  onChange: () => void;
}) {
  const [files, setFiles] = useState<FileList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Polls while any model is still in progress.
  useEffect(() => {
    if (!models.some((m) => m.status !== "ready" && m.status !== "failed")) return;
    const interval = setInterval(onChange, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [models]);

  async function handleTrain(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!files || files.length < 5 || files.length > 10) {
      setError("Upload 5–10 reference images.");
      return;
    }
    setSubmitting(true);
    try {
      await createEchoModel(apiKey, Array.from(files));
      setFiles(null);
      onChange();
    } catch (err) {
      setError(err instanceof ApiRequestError ? String(err.detail ?? err.message) : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRetrain(id: string, retrainFiles: FileList | null) {
    setError(null);
    try {
      await retrainEchoModel(apiKey, id, retrainFiles ? Array.from(retrainFiles) : []);
      onChange();
    } catch (err) {
      setError(err instanceof ApiRequestError ? String(err.detail ?? err.message) : "Something went wrong.");
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-paper-raised p-6">
      <h2 className="font-display text-lg font-semibold text-ink">Echo — your custom style</h2>
      <p className="mt-1 text-sm text-ink-soft">
        Upload 5–10 images of your own character or art style. Shui-WG generates variations, picks the best set, and
        trains a model on it — then you can generate videos in your own style.
      </p>

      <form onSubmit={handleTrain} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          onChange={(e) => setFiles(e.target.files)}
          className="text-sm text-ink-soft"
        />
        <button
          type="submit"
          disabled={submitting}
          className="shrink-0 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition hover:opacity-90 disabled:opacity-60"
        >
          {submitting ? "Uploading…" : "Train new model"}
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-accent">{error}</p>}

      <div className="mt-5 divide-y divide-line">
        {models.length === 0 ? (
          <p className="py-3 text-sm text-ink-faint">No Echo models yet.</p>
        ) : (
          models.map((model) => (
            <div key={model.id} className="flex items-center justify-between gap-4 py-3">
              <div>
                <p className="text-sm text-ink">{model.triggerWord ?? model.id.slice(0, 8)}</p>
                <p className="text-xs text-ink-faint">
                  {STATUS_LABEL[model.status]} · {model.retrainCount} retrain{model.retrainCount === 1 ? "" : "s"}
                </p>
                {model.errorMessage && <p className="mt-1 text-xs text-accent">{model.errorMessage}</p>}
              </div>
              {(model.status === "ready" || model.status === "failed") && (
                <label className="shrink-0 cursor-pointer text-xs font-semibold text-ink underline underline-offset-4">
                  Retrain
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    multiple
                    className="hidden"
                    onChange={(e) => handleRetrain(model.id, e.target.files)}
                  />
                </label>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
