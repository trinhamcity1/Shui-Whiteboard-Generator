import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderAdJob } from "../src/pipeline/renderAdJob";
import { printJobCost } from "../src/cost/index";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const VOICE_ID = process.env.TTS_VOICE_ID!;

// Real, publicly fetchable B&H product photos — the fifth bhphotovideo.com
// URL the user gave 403s on a direct server-side fetch (hotlink
// protection), confirmed via curl before wiring this up, so it's dropped
// rather than fed into the planner to fail later mid-render.
const AD_REQUEST = {
  mode: "ad" as const,
  businessName: "Insta360",
  businessType: "physical-product",
  productDescription:
    "Insta360 GO 3 — a mini detachable action camera. The camera pod pops off its magnetic mount so you can " +
    "clip it to a t-shirt, a hat, or just hold it in your hand for a true POV shot. Good for runners, bikers, " +
    "and hikers who want to capture content and save memories from trips without carrying a full camera rig.",
  productImages: [
    { url: "https://static.bhphoto.com/images/multiple_images/images500x500/1687855733_IMG_2027606.jpg", label: "front lens" },
    { url: "https://static.bhphoto.com/images/multiple_images/images500x500/1687855733_IMG_2027607.jpg", label: "mounted on clip" },
    { url: "https://static.bhphoto.com/images/multiple_images/images500x500/1687855733_IMG_2027617.jpg", label: "mounted, angle 2" },
    { url: "https://static.bhphoto.com/images/multiple_images/images500x500/1768916595_IMG_2027609.jpg", label: "mounted, angle 3" },
  ],
  platform: "instagram" as const,
  durationSeconds: "auto" as const,
  voice: VOICE_ID,
};

async function main() {
  const outputDir = path.join(ROOT, "output");
  const result = await renderAdJob({
    request: AD_REQUEST,
    ownerApiKeyId: "local-test-key",
    apiKey: process.env.ELEVENLABS_API_KEY!,
    rootDir: ROOT,
    outputLocation: path.join(outputDir, "ad-insta360-test.mp4"),
    uploadKey: `local-tests/ad-insta360-test-${Date.now()}.mp4`,
    audioFileName: "tts-ad-insta360.mp3",
    inlineImagesForLocalDev: true,
  });

  console.log("   video ->", result.outputLocation);
  if (result.uploadUrl) console.log("   uploaded:", result.uploadUrl);
  if (result.uploadError) console.log("   upload error:", result.uploadError);
  printJobCost(result.jobCost, "insta360-ad");

  console.log("\nAd document (for inspection):");
  console.log(JSON.stringify(result.adDocumentDebug, null, 2));
}

main().catch((err) => {
  console.error("FULL ERROR:", err);
  console.error("STACK:", err?.stack);
  process.exit(1);
});
