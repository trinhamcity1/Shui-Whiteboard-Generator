import fs from "node:fs";
import path from "node:path";
import { buildCandidatePrompts, buildDiagramCandidatePrompts } from "./candidatePrompts";
import type { StyleCandidate } from "./types";

// Same published fal.ai Flux Schnell rate used by src/images/flux.ts.
const COST_PER_IMAGE_USD = 0.02;

/**
 * Generates `count` storybook-style candidates via Flux Schnell (fal.ai) and
 * writes them to `outDir` as PNGs plus a manifest.json — scratch material for
 * human curation (amendment §3, Plan A step 1-2), not a permanent library
 * asset, so no R2/Firestore write here.
 */
export async function generateCandidates(args: {
  apiKey: string;
  count: number;
  outDir: string;
  pool?: "default" | "diagram";
}): Promise<StyleCandidate[]> {
  const { apiKey, count, outDir, pool = "default" } = args;
  if (!apiKey) {
    throw new Error("generateCandidates requires a fal.ai API key (FLUX_API_KEY).");
  }
  fs.mkdirSync(outDir, { recursive: true });

  const specs = pool === "diagram" ? buildDiagramCandidatePrompts(count) : buildCandidatePrompts(count);
  const candidates: StyleCandidate[] = [];

  for (let i = 0; i < specs.length; i++) {
    const spec = specs[i]!;
    const id = `candidate-${String(i + 1).padStart(4, "0")}`;
    process.stdout.write(`[${i + 1}/${specs.length}] ${id} — ${spec.subject}... `);

    const response = await fetch("https://fal.run/fal-ai/flux/schnell", {
      method: "POST",
      headers: {
        Authorization: `Key ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: spec.prompt,
        image_size: "square_hd",
        num_images: 1,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Candidate generation failed for ${id} (${response.status}): ${body}`);
    }

    const data = (await response.json()) as { images: Array<{ url: string }> };
    const image = data.images[0];
    if (!image) {
      throw new Error(`Candidate generation for ${id} returned no image.`);
    }

    const imageResponse = await fetch(image.url);
    if (!imageResponse.ok) {
      throw new Error(`Failed to download candidate ${id} (${imageResponse.status}).`);
    }
    const buffer = Buffer.from(await imageResponse.arrayBuffer());
    const localPath = path.join(outDir, `${id}.png`);
    fs.writeFileSync(localPath, buffer);

    candidates.push({
      id,
      prompt: spec.prompt,
      subject: spec.subject,
      localPath,
      costUsd: COST_PER_IMAGE_USD,
      generatedAt: new Date().toISOString(),
    });
    console.log("done");
  }

  const manifestPath = path.join(outDir, "manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(candidates, null, 2));

  return candidates;
}
