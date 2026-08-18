import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderAdJob } from "../src/pipeline/renderAdJob";
import { printJobCost } from "../src/cost/index";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const VOICE_ID = process.env.TTS_VOICE_ID!;

// Forces visualStyle to test the new kinetic-hero look end to end — the
// planner is otherwise free to pick, per adPlanning.ts's guidance.
const AD_REQUEST = {
  mode: "ad" as const,
  businessName: "Insta360",
  businessType: "physical-product",
  productDescription:
    "Insta360 GO 3 — a mini detachable action camera with a flip-out touchscreen for framing selfies and POV shots.",
  productImages: [
    { url: "https://static.bhphoto.com/images/multiple_images/images500x500/1687855733_IMG_2027606.jpg", label: "camera with screen, plain background" },
  ],
  visualStyle: "kinetic-hero" as const,
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
    outputLocation: path.join(outputDir, "ad-kinetic-hero-test.mp4"),
    uploadKey: `local-tests/ad-kinetic-hero-test-${Date.now()}.mp4`,
    audioFileName: "tts-ad-kinetic.mp3",
    inlineImagesForLocalDev: true,
  });

  console.log("   video ->", result.outputLocation);
  if (result.uploadUrl) console.log("   uploaded:", result.uploadUrl);
  if (result.uploadError) console.log("   upload error:", result.uploadError);
  printJobCost(result.jobCost, "insta360-kinetic-hero");

  console.log("\nAd document (for inspection):");
  console.log(JSON.stringify(result.adDocumentDebug, null, 2));
}

main().catch((err) => {
  console.error("FULL ERROR:", err);
  console.error("STACK:", err?.stack);
  process.exit(1);
});
