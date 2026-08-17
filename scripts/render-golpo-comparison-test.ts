import "dotenv/config";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { renderSceneDocumentJob } from "../src/pipeline/renderJob";
import { printJobCost } from "../src/cost/index";
import { printTimingWarnings } from "../src/render/timing";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const VOICE_ID = process.env.TTS_VOICE_ID ?? "21m00Tcm4TlvDq8ikWAM";

// User-supplied comparison test: two real scripts they used with Golpo,
// run through our real end-to-end pipeline (POST /videos/generate's exact
// code path — this calls the same renderSceneDocumentJob the async worker
// calls) exactly as narrationScript-only input, no hand-holding. This is
// the honest "can our process handle this" test — no visual direction
// text is fed in, since our schema has no field for it; only the words.

const SUPREME_LAW_SCRIPT =
  "One law beats every other law in America. Not the President. Not Congress. Not your state. It's the " +
  "Constitution. Americans call it the supreme law of the land. Supreme means highest. Nothing outranks it. " +
  "Here's why that matters. Your state can pass a law. Congress can pass a law. But if that law goes against " +
  "the Constitution — the courts can throw it out. Every big legal fight in America eventually comes back to " +
  "this one document. So when they ask: what is the supreme law of the land? The Constitution.";

const COLLAPSE_SCRIPT =
  "In the United States, there's a simple but powerful hierarchy of law. At the very top, one document " +
  "outranks every other rule, decision, and statute. It's not a law made by the President, or by Congress, " +
  "or by any state government. It's the Constitution. This principle is called the Supremacy Clause, which " +
  "establishes the Constitution as the \"supreme law of the land.\" This means if any law—federal or " +
  "state—conflicts with the Constitution, the courts can declare it invalid. This powerful check is known as " +
  "judicial review, a concept solidified in the landmark 1803 case Marbury v. Madison. It gives the judicial " +
  "branch the final say on what is and isn't constitutional.";

async function run(id: string, narrationScript: string) {
  const outputDir = path.join(ROOT, "output");
  await fs.mkdir(outputDir, { recursive: true });

  console.log(`\n=== ${id} ===`);
  const result = await renderSceneDocumentJob({
    request: {
      narrationScript,
      voice: VOICE_ID,
      styleVariant: "classic-whiteboard",
      orientation: "vertical",
    },
    apiKey: process.env.ELEVENLABS_API_KEY!,
    rootDir: ROOT,
    outputLocation: path.join(outputDir, `golpo-comparison-${id}.mp4`),
    uploadKey: `local-tests/golpo-comparison-${id}-${Date.now()}.mp4`,
    audioFileName: `tts-${id}.mp3`,
    inlineImagesForLocalDev: true,
    enableLayoutQA: true,
  });

  if (result.sceneDocumentDebug) {
    await fs.writeFile(path.join(outputDir, `golpo-comparison-${id}-scenedoc.json`), JSON.stringify(result.sceneDocumentDebug, null, 2));
  }

  printTimingWarnings(result.timingWarnings);
  console.log(`   video -> ${result.outputLocation}`);
  if (result.uploadUrl) console.log(`   uploaded: ${result.uploadUrl}`);
  if (result.layoutQaLog && result.layoutQaLog.length > 0) {
    console.log("   Layout QA:");
    for (const entry of result.layoutQaLog) {
      console.log(`     action "${entry.actionId}": passed=${entry.passed} adjustmentApplied=${entry.adjustmentApplied}`);
    }
  }
  printJobCost(result.jobCost, id);
}

async function main() {
  await run("supreme-law", SUPREME_LAW_SCRIPT);
  await run("collapse-script", COLLAPSE_SCRIPT);
}

main().catch((err) => {
  console.error("FULL ERROR:", err);
  console.error("STACK:", err?.stack);
  let cause = err?.cause;
  let depth = 0;
  while (cause && depth < 5) {
    console.error(`CAUSE[${depth}]:`, cause?.stack ?? cause);
    cause = cause?.cause;
    depth++;
  }
  process.exit(1);
});
