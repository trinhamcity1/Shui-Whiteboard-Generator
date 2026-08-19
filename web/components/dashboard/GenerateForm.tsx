"use client";

import { useState } from "react";
import { generateVideo, ApiRequestError, type AccountResponse, type EchoModelSummary } from "@/lib/api";

// Mirrors src/render/theme/themes.ts's AVAILABLE_STYLE_VARIANTS — kept in
// sync by hand for now since there's no public endpoint to read it from.
const STYLE_VARIANTS = ["classic-whiteboard", "full-frame"];

export function GenerateForm({
  apiKey,
  account,
  echoModels,
  onQueued,
}: {
  apiKey: string;
  account: AccountResponse;
  echoModels: EchoModelSummary[];
  onQueued: () => void;
}) {
  const [mode, setMode] = useState<"script" | "topic">(account.topicCreditsPerMinute === null ? "script" : "topic");
  const [text, setText] = useState("");
  const [voice, setVoice] = useState("");
  const [styleVariant, setStyleVariant] = useState(STYLE_VARIANTS[0]!);
  const [orientation, setOrientation] = useState<"vertical" | "horizontal">("vertical");
  const [echoModelId, setEchoModelId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const readyEchoModels = echoModels.filter((m) => m.status === "ready");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      const result = await generateVideo(apiKey, {
        voice,
        styleVariant,
        orientation: account.verticalOnly ? "vertical" : orientation,
        ...(mode === "topic" ? { topic: text } : { narrationScript: text }),
        ...(echoModelId ? { echoModelId } : {}),
      });
      setSuccess(`Queued — job ${result.job_id}`);
      setText("");
      onQueued();
    } catch (err) {
      setError(err instanceof ApiRequestError ? String(err.detail ?? err.message) : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-paper-raised p-6">
      <h2 className="font-display text-lg font-semibold text-ink">Generate a video</h2>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => setMode("script")}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${mode === "script" ? "bg-ink text-paper" : "border border-line-strong text-ink-soft"}`}
        >
          My own script
        </button>
        <button
          type="button"
          onClick={() => setMode("topic")}
          disabled={account.topicCreditsPerMinute === null}
          title={account.topicCreditsPerMinute === null ? "Not available on your plan" : undefined}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${mode === "topic" ? "bg-ink text-paper" : "border border-line-strong text-ink-soft"} disabled:opacity-40`}
        >
          Just a topic
        </button>
      </div>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
        <textarea
          required
          rows={4}
          placeholder={mode === "topic" ? "e.g. how to best rescue a drowning person" : "Paste your full narration script…"}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="rounded-lg border border-line-strong bg-paper px-4 py-2.5 text-sm text-ink outline-none focus:border-ink"
        />

        <div className="grid grid-cols-2 gap-3">
          <input
            type="text"
            required
            placeholder="Voice ID (ElevenLabs)"
            value={voice}
            onChange={(e) => setVoice(e.target.value)}
            className="rounded-lg border border-line-strong bg-paper px-4 py-2.5 text-sm text-ink outline-none focus:border-ink"
          />
          <select
            value={styleVariant}
            onChange={(e) => setStyleVariant(e.target.value)}
            className="rounded-lg border border-line-strong bg-paper px-4 py-2.5 text-sm text-ink outline-none focus:border-ink"
          >
            {STYLE_VARIANTS.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>

        {!account.verticalOnly && (
          <div className="flex gap-2">
            {(["vertical", "horizontal"] as const).map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => setOrientation(o)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${orientation === o ? "bg-ink text-paper" : "border border-line-strong text-ink-soft"}`}
              >
                {o}
              </button>
            ))}
          </div>
        )}

        {account.echoAccess && readyEchoModels.length > 0 && (
          <select
            value={echoModelId}
            onChange={(e) => setEchoModelId(e.target.value)}
            className="rounded-lg border border-line-strong bg-paper px-4 py-2.5 text-sm text-ink outline-none focus:border-ink"
          >
            <option value="">Shared illustration library</option>
            {readyEchoModels.map((m) => (
              <option key={m.id} value={m.id}>
                Echo style — {m.triggerWord ?? m.id.slice(0, 8)}
              </option>
            ))}
          </select>
        )}

        {error && <p className="text-sm text-accent">{error}</p>}
        {success && <p className="text-sm text-ink-soft">{success}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink transition hover:opacity-90 disabled:opacity-60"
        >
          {submitting ? "Queuing…" : "Generate"}
        </button>
      </form>
    </div>
  );
}
