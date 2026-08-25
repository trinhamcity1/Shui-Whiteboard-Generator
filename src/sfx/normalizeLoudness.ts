import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const execFileAsync = promisify(execFile);

/**
 * Two ElevenLabs Sound Effects generations came back at wildly different
 * natural loudness for the same "volume" prop in Remotion — measured RMS
 * showed the chime effect was ~6.4x quieter than the whoosh effect, which
 * is why the chime stayed inaudible/undetectable in a real render even
 * after boosting its Remotion volume prop to match the whoosh. Rather than
 * hand-tune a different volume constant per effect (which breaks again the
 * next time a new effect is generated), normalize every generated file to
 * the same target loudness right after generation, so a single Remotion
 * volume works uniformly across the whole library.
 *
 * Uses ffmpeg's loudnorm filter (EBU R128), one-pass — not as precise as
 * the documented two-pass approach, but these are ~0.5s one-shot effects
 * where "close enough and consistent" matters more than broadcast-spec
 * accuracy. Resolves the ffmpeg binary bundled with @remotion/renderer's
 * platform-specific compositor package rather than requiring a separate
 * ffmpeg install — fine for this one-time, dev-only generation script,
 * which never runs as part of the production render pipeline.
 */
export async function normalizeLoudness(mp3Buffer: Buffer, targetLufs = -16): Promise<Buffer> {
  const ffmpegPath = resolveBundledFfmpeg();
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "sfx-normalize-"));
  const inPath = path.join(tmpDir, "in.mp3");
  const outPath = path.join(tmpDir, "out.mp3");
  try {
    await fs.writeFile(inPath, mp3Buffer);
    await execFileAsync(ffmpegPath, [
      "-y",
      "-i",
      inPath,
      "-af",
      `loudnorm=I=${targetLufs}:TP=-1.5:LRA=11`,
      "-loglevel",
      "error",
      outPath,
    ]);
    return await fs.readFile(outPath);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

function resolveBundledFfmpeg(): string {
  const platformPackages = [
    "@remotion/compositor-linux-x64-gnu",
    "@remotion/compositor-linux-x64-musl",
    "@remotion/compositor-darwin-arm64",
    "@remotion/compositor-darwin-x64",
    "@remotion/compositor-win32-x64-msvc",
  ];
  for (const pkg of platformPackages) {
    try {
      const pkgJsonPath = require.resolve(`${pkg}/package.json`);
      const binName = pkg.includes("win32") ? "ffmpeg.exe" : "ffmpeg";
      return path.join(path.dirname(pkgJsonPath), binName);
    } catch {
      continue;
    }
  }
  throw new Error(
    "Could not find a bundled ffmpeg binary from any @remotion/compositor-* package. " +
      "This helper only works in an environment where @remotion/renderer's platform compositor package is installed.",
  );
}
