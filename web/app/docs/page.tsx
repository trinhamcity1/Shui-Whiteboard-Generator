import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

function Code({ children }: { children: string }) {
  return (
    <pre className="mt-3 overflow-x-auto rounded-lg border border-line bg-ink p-4 text-xs leading-relaxed text-paper">
      <code>{children}</code>
    </pre>
  );
}

function Endpoint({
  method,
  path,
  children,
}: {
  method: string;
  path: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-line py-8 first:border-t-0 first:pt-0">
      <div className="flex items-center gap-3">
        <span className="rounded bg-ink px-2 py-1 text-xs font-bold text-paper">{method}</span>
        <code className="text-sm text-ink">{path}</code>
      </div>
      <div className="mt-3 text-sm leading-relaxed text-ink-soft">{children}</div>
    </div>
  );
}

export default function DocsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <section className="mx-auto max-w-3xl px-6 pt-16 pb-8">
          <h1 className="font-display text-4xl font-semibold text-ink">API reference</h1>
          <p className="mt-4 text-ink-soft">
            Every authenticated request needs an <code className="text-ink">x-api-key</code> header — get one from{" "}
            <code className="text-ink">/v1/signup</code> or your dashboard.
          </p>
        </section>

        <section className="mx-auto max-w-3xl px-6 pb-24">
          <Endpoint method="POST" path="/v1/signup">
            <p>The one unauthenticated route — how you get your first API key.</p>
            <Code>{`curl -X POST https://api.shui-wg.com/v1/signup \\
  -H "Content-Type: application/json" \\
  -d '{"email":"you@example.com"}'

# -> { "apiKey": "swg_...", "email": "...", "warning": "Save this key now — it will never be shown again." }`}</Code>
          </Endpoint>

          <Endpoint method="GET" path="/v1/account">
            <p>Your plan, credit balance, and feature limits.</p>
          </Endpoint>

          <Endpoint method="GET" path="/v1/account/ledger">
            <p>Every credit and debit on your account, most recent first.</p>
          </Endpoint>

          <Endpoint method="GET / POST / DELETE" path="/v1/keys">
            <p>List, create, or revoke API keys — every key sharing your signup email is the same account.</p>
          </Endpoint>

          <Endpoint method="POST" path="/v1/videos/generate">
            <p>
              Supply exactly one of <code className="text-ink">scenes</code>, <code className="text-ink">narrationScript</code>, or{" "}
              <code className="text-ink">topic</code>. Returns a <code className="text-ink">job_id</code> immediately — the video
              renders asynchronously.
            </p>
            <Code>{`# Bring your own script — follows it exactly, only plans the visuals.
curl -X POST https://api.shui-wg.com/v1/videos/generate \\
  -H "x-api-key: $API_KEY" -H "Content-Type: application/json" \\
  -d '{
    "narrationScript": "Drowning almost never looks like it does in movies...",
    "voice": "<elevenlabs-voice-id>",
    "styleVariant": "classic-whiteboard",
    "orientation": "vertical"
  }'

# Just a topic — writes the script for you too (not available on every plan).
curl -X POST https://api.shui-wg.com/v1/videos/generate \\
  -H "x-api-key: $API_KEY" -H "Content-Type: application/json" \\
  -d '{
    "topic": "how to best rescue a drowning person",
    "voice": "<elevenlabs-voice-id>",
    "styleVariant": "classic-whiteboard",
    "targetDurationSeconds": 60
  }'

# -> { "job_id": "...", "status": "queued" }`}</Code>
            <p className="mt-3">
              Optional fields: <code className="text-ink">echoModelId</code> (use your own trained style instead of
              the shared library — Pyramidion only).
            </p>
          </Endpoint>

          <Endpoint method="GET" path="/v1/videos">
            <p>List your videos, most recent first.</p>
          </Endpoint>

          <Endpoint method="GET" path="/v1/videos/:id">
            <p>
              Poll for status: <code className="text-ink">queued</code> → <code className="text-ink">rendering</code> →{" "}
              <code className="text-ink">ready</code> (with a <code className="text-ink">result_url</code>) or{" "}
              <code className="text-ink">failed</code>.
            </p>
          </Endpoint>

          <Endpoint method="POST" path="/v1/echo/models">
            <p>
              Pyramidion only. Multipart upload, 5–10 reference images under the field name{" "}
              <code className="text-ink">references</code>. Kicks off training asynchronously.
            </p>
            <Code>{`curl -X POST https://api.shui-wg.com/v1/echo/models \\
  -H "x-api-key: $API_KEY" \\
  -F "references=@ref1.png" -F "references=@ref2.png" -F "references=@ref3.png" \\
  -F "references=@ref4.png" -F "references=@ref5.png"`}</Code>
          </Endpoint>

          <Endpoint method="GET" path="/v1/echo/models / /v1/echo/models/:id">
            <p>List or check on your trained models.</p>
          </Endpoint>

          <Endpoint method="POST" path="/v1/echo/models/:id/retrain">
            <p>Retrains from scratch — deletes the prior model entirely. New reference images are optional.</p>
          </Endpoint>

          <Endpoint method="GET" path="/v1/pricing">
            <p>Public, unauthenticated — the live tier table.</p>
          </Endpoint>
        </section>
      </main>
      <Footer />
    </div>
  );
}
