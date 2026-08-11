import "dotenv/config";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { printJobCost, type JobCost } from "../src/cost/index";
import { printTimingWarnings } from "../src/render/timing";
import { renderSceneDocumentJob } from "../src/pipeline/renderJob";
import type { SceneDocumentRequest } from "../src/pipeline/resolveSceneDocument";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const VOICE_ID = process.env.TTS_VOICE_ID ?? "21m00Tcm4TlvDq8ikWAM";

// Five real, varied citizenship-exam scripts — different lengths, different
// content, exercising every action type built in Phase 1. Phase 1's verify
// checklist calls for a batch like this, not just one repeated test case.
const JOBS: Array<{ name: string; request: SceneDocumentRequest }> = [
  {
    name: "bill-of-rights",
    request: {
      scenes: {
        schemaVersion: 1,
        narrationScript:
          "The Constitution can be changed. When we change the Constitution, we call it an amendment. " +
          "The Founding Fathers wrote the first ten amendments together. We call these first ten amendments " +
          "the Bill of Rights. The Bill of Rights protects your basic freedoms as an American, like freedom " +
          "of speech, freedom of religion, and the right to a fair trial.",
        voice: VOICE_ID,
        styleVariant: "classic-whiteboard",
        orientation: "vertical",
        actions: [
          { id: "title", type: "titleCard", atSeconds: 0, durationSeconds: 4, text: "The Bill of Rights" },
          {
            id: "facts",
            type: "bulletList",
            atSeconds: 4,
            durationSeconds: 10,
            items: [
              "The first 10 amendments to the Constitution",
              "Protects freedom of speech and religion",
              "Guarantees the right to a fair trial",
            ],
          },
          {
            id: "callout",
            type: "iconCallout",
            atSeconds: 14,
            durationSeconds: 6,
            icon: "scale-of-justice",
            text: "Written by the Founding Fathers",
          },
          {
            id: "timeline",
            type: "timeline",
            atSeconds: 20,
            durationSeconds: 6,
            timelineEntries: [{ year: 1791, label: "Bill of Rights ratified" }],
          },
        ],
      },
    },
  },
  {
    name: "branches-of-government",
    request: {
      scenes: {
        schemaVersion: 1,
        narrationScript:
          "The United States government has three branches, so that no single part becomes too powerful. " +
          "The legislative branch makes the laws. The executive branch carries out the laws. The judicial " +
          "branch decides if laws follow the Constitution. This system is called checks and balances.",
        voice: VOICE_ID,
        styleVariant: "classic-whiteboard",
        orientation: "vertical",
        actions: [
          { id: "title", type: "titleCard", atSeconds: 0, durationSeconds: 4, text: "Three Branches of Government" },
          {
            id: "cards",
            type: "comparisonCards",
            atSeconds: 4,
            durationSeconds: 14,
            comparisonCards: [
              { title: "Legislative", items: ["Makes the laws", "Congress: Senate + House"] },
              { title: "Executive", items: ["Carries out the laws", "The President"] },
              { title: "Judicial", items: ["Interprets the laws", "The Supreme Court"] },
            ],
          },
          {
            id: "quote",
            type: "quote",
            atSeconds: 18,
            durationSeconds: 6,
            text: "Checks and balances keep any one branch from becoming too powerful.",
          },
        ],
      },
    },
  },
  {
    name: "declaration-of-independence",
    request: {
      scenes: {
        schemaVersion: 1,
        narrationScript:
          "The Declaration of Independence announced that the thirteen American colonies were now independent " +
          "from Great Britain. It was adopted on July 4th, 1776. Thomas Jefferson was its main author.",
        voice: VOICE_ID,
        styleVariant: "classic-whiteboard",
        orientation: "vertical",
        actions: [
          { id: "title", type: "titleCard", atSeconds: 0, durationSeconds: 4, text: "The Declaration of Independence" },
          {
            id: "timeline",
            type: "timeline",
            atSeconds: 4,
            durationSeconds: 6,
            timelineEntries: [{ year: 1776, label: "Declared independence from Great Britain" }],
          },
          {
            id: "quote",
            type: "quote",
            atSeconds: 10,
            durationSeconds: 6,
            text: "All men are created equal.",
            attribution: "Declaration of Independence, 1776",
          },
        ],
      },
    },
  },
  {
    name: "the-american-flag",
    request: {
      scenes: {
        schemaVersion: 1,
        narrationScript:
          "The American flag has 13 stripes for the original 13 colonies, and 50 stars, one for each state today.",
        voice: VOICE_ID,
        styleVariant: "classic-whiteboard",
        orientation: "vertical",
        actions: [
          { id: "title", type: "titleCard", atSeconds: 0, durationSeconds: 3, text: "The American Flag" },
          {
            id: "facts",
            type: "bulletList",
            atSeconds: 3,
            durationSeconds: 7,
            items: ["13 stripes for the original 13 colonies", "50 stars, one for each state"],
          },
        ],
      },
    },
  },
  {
    name: "becoming-a-citizen",
    request: {
      scenes: {
        schemaVersion: 1,
        narrationScript:
          "Becoming a U.S. citizen through naturalization takes several steps. First, you file an application. " +
          "Next, you attend a biometrics appointment. Then you take the civics and English test in an interview. " +
          "Finally, if approved, you take the Oath of Allegiance and become a citizen.",
        voice: VOICE_ID,
        styleVariant: "classic-whiteboard",
        orientation: "vertical",
        actions: [
          { id: "title", type: "titleCard", atSeconds: 0, durationSeconds: 4, text: "Becoming a U.S. Citizen" },
          {
            id: "steps",
            type: "bulletList",
            atSeconds: 4,
            durationSeconds: 12,
            items: [
              "File an application",
              "Attend a biometrics appointment",
              "Take the civics and English test",
              "Take the Oath of Allegiance",
            ],
          },
          {
            id: "callout",
            type: "iconCallout",
            atSeconds: 16,
            durationSeconds: 5,
            icon: "flag",
            text: "Welcome, new citizen!",
          },
        ],
      },
    },
  },
];

async function main() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY is not set. Fill it in .env before running this script.");
  }

  const outputDir = path.join(ROOT, "output", "batch");
  await fs.mkdir(outputDir, { recursive: true });

  const results: Array<{ name: string; cost: JobCost }> = [];

  for (const [i, job] of JOBS.entries()) {
    console.log(`\n[${i + 1}/${JOBS.length}] ${job.name}`);
    const result = await renderSceneDocumentJob({
      request: job.request,
      apiKey,
      rootDir: ROOT,
      outputLocation: path.join(outputDir, `${job.name}.mp4`),
      uploadKey: `local-tests/batch/${job.name}-${Date.now()}.mp4`,
      audioFileName: `tts-audio-${job.name}.mp3`,
    });

    printTimingWarnings(result.timingWarnings);
    console.log(`   -> ${result.outputLocation}`);
    console.log(result.uploadUrl ? `   uploaded: ${result.uploadUrl}` : `   ⚠️  upload failed: ${result.uploadError}`);
    printJobCost(result.jobCost, job.name);

    results.push({ name: job.name, cost: result.jobCost });
  }

  console.log("\n=== Batch summary ===");
  for (const r of results) {
    console.log(`  ${r.name.padEnd(28)} $${r.cost.totalCostUsd.toFixed(4)}`);
  }
  const total = results.reduce((sum, r) => sum + r.cost.totalCostUsd, 0);
  console.log(`  ${"TOTAL".padEnd(28)} $${total.toFixed(4)}`);
  console.log(`  ${"AVERAGE".padEnd(28)} $${(total / results.length).toFixed(4)}`);
}

main().catch((err) => {
  console.error("render-batch failed:", err);
  process.exitCode = 1;
});
