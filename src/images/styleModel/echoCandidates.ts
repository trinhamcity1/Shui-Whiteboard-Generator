import { fal } from "@fal-ai/client";

const CANDIDATE_ENDPOINT = "fal-ai/flux/dev/image-to-image";
// fal.ai doesn't return real-time billing (same caveat as train.ts's
// trainingCostUsd) — a planning-stage estimate matching trainedStyle.ts's
// dev-tier Flux constant, not a number pulled from a real invoice.
const COST_PER_IMAGE_USD = 0.03;

// Different framings/poses to draw out of each reference — the point is
// variety within the SAME character/style, not a different subject. Kept
// deliberately generic (no subject description) since we don't know what
// the reference actually depicts; strength stays low enough to preserve
// the reference's own likeness/style rather than drifting into a new one.
const VARIATION_PROMPTS = [
  "the same character, in a different pose, plain background",
  "the same character, viewed from a slightly different angle, plain background",
  "the same character, with a different simple gesture, plain background",
];

export interface EchoCandidateResult {
  candidateUrls: string[];
  costUsd: number;
}

/**
 * Generates a larger candidate pool from a customer's 5-10 reference
 * uploads via image-to-image variation — expanding a small reference set
 * into enough material for selectBestEchoCandidates to pick a real training
 * set from. Each reference image yields VARIATION_PROMPTS.length
 * candidates, plus the reference itself is included unchanged (a real photo
 * of the actual style is always a valid training example).
 */
export async function generateEchoCandidates(args: {
  referenceImageUrls: string[];
  falApiKey: string;
}): Promise<EchoCandidateResult> {
  if (!args.falApiKey) throw new Error("generateEchoCandidates requires a fal.ai API key.");
  fal.config({ credentials: args.falApiKey });

  const candidateUrls: string[] = [...args.referenceImageUrls];
  let costUsd = 0;

  for (const referenceUrl of args.referenceImageUrls) {
    for (const prompt of VARIATION_PROMPTS) {
      const result = await fal.subscribe(CANDIDATE_ENDPOINT, {
        input: {
          image_url: referenceUrl,
          prompt,
          strength: 0.8,
          num_images: 1,
        },
        logs: false,
      });
      const data = result.data as { images?: Array<{ url: string }> };
      const image = data.images?.[0];
      if (!image) continue; // one failed variation shouldn't sink the whole batch
      candidateUrls.push(image.url);
      costUsd += COST_PER_IMAGE_USD;
    }
  }

  return { candidateUrls, costUsd };
}
