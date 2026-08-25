import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { generateSoundEffect } from "../src/sfx/generateSoundEffect";
import { normalizeLoudness } from "../src/sfx/normalizeLoudness";

// A small, reusable sound-effect library, generated once through
// ElevenLabs' Sound Effects API (same account/key as narration TTS) and
// reused free on every render after that — same one-time-cost economics as
// the drawn art library. Starting deliberately small (2 effects) to gauge
// real impact before expanding: a scene-transition whoosh and a positive
// reveal chime for a checkmark decoration.
const SFX_MANIFEST: { id: string; prompt: string; durationSeconds: number }[] = [
  {
    id: "scene-whoosh",
    prompt: "A soft, quick whoosh transition sound effect for a video cut, subtle and clean, no music, no voice",
    durationSeconds: 0.6,
  },
  {
    id: "reveal-chime",
    prompt: "A short, bright, pleasant single bell chime, like a positive notification ding, simple and clean, no music",
    durationSeconds: 0.5,
  },
];

async function main() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY is required.");

  const force = process.argv.includes("--force");
  const sfxDir = path.join(process.cwd(), "public", "sfx");
  fs.mkdirSync(sfxDir, { recursive: true });

  const toGenerate = SFX_MANIFEST.filter((e) => force || !fs.existsSync(path.join(sfxDir, `${e.id}.mp3`)));
  console.log(`Generating sound-effect library: ${toGenerate.length} new effect(s), ${SFX_MANIFEST.length - toGenerate.length} already present and kept as-is.\n`);

  let totalCost = 0;
  for (let i = 0; i < toGenerate.length; i++) {
    const entry = toGenerate[i]!;
    process.stdout.write(`[${i + 1}/${toGenerate.length}] ${entry.id}... `);
    const result = await generateSoundEffect(apiKey, entry.prompt, { durationSeconds: entry.durationSeconds });
    // Two effects generated at wildly different natural loudness for the
    // same Remotion volume prop — normalizing here means every future
    // effect added to this library plays back at a consistent level
    // without needing a hand-tuned volume constant per file. See
    // normalizeLoudness.ts for the measured evidence.
    const normalized = await normalizeLoudness(result.audioBuffer);
    fs.writeFileSync(path.join(sfxDir, `${entry.id}.mp3`), normalized);
    totalCost += result.costUsd;
    console.log("done");
  }

  console.log(`\nGenerated ${toGenerate.length} new effect(s) for $${totalCost.toFixed(4)}.`);
  console.log(`Files: ${sfxDir}`);
}

main().catch((err) => {
  console.error("generate-sfx-library failed:", err);
  process.exitCode = 1;
});
