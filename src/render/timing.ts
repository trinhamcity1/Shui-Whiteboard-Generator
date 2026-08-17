import type { SceneDocument } from "../schema/scene";
import type { WordTiming } from "../tts/types";
import { WORDS_PER_SECOND } from "../schema/planning";

const DRIFT_WARNING_THRESHOLD = 0.1; // 10%

function normalizeWord(word: string): string {
  return word.toLowerCase().replace(/[^a-z0-9']/g, "");
}

/**
 * A first version of this function (kept only in git history) mapped each
 * action's atSeconds to an assumed word index via a flat WORDS_PER_SECOND
 * rate, on the theory that the planner authors timestamps against that
 * same rate. Real render evidence disproved it: the planner budgets scene
 * duration by feel (how much a beat "needs"), not word count, so the rate
 * assumption drifted unevenly across a video — small in the middle,
 * enormous by the end, where a rounding-based tail fix once stretched a
 * single closing scene to a 20-second frozen frame while the real audio
 * kept talking through several more scenes' worth of content.
 *
 * The real fix: every action now carries coversText, the literal
 * substring of the narration it illustrates (see planning.ts's prompt).
 * Real timing no longer needs to be inferred — it's looked up directly by
 * finding that exact word sequence inside ElevenLabs' real per-word
 * timestamps. Falls back to the old rate estimate only for an action
 * with no coversText (a pre-authored, non-planner SceneDocument) or a
 * span that genuinely can't be located.
 */
export function realignSceneTiming(sceneDocument: SceneDocument, wordTimings: WordTiming[] | undefined): void {
  if (!wordTimings || wordTimings.length === 0) return;

  const lastWordEnd = wordTimings[wordTimings.length - 1]!.endSeconds;
  const realWords = wordTimings.map((w) => normalizeWord(w.word));

  const rateBasedRange = (action: SceneDocument["actions"][number]): { start: number; end: number } => {
    const startWordIndex = Math.max(0, Math.min(Math.round(action.atSeconds * WORDS_PER_SECOND), wordTimings.length - 1));
    const endWordIndex = Math.round((action.atSeconds + action.durationSeconds) * WORDS_PER_SECOND);
    const realStart = wordTimings[startWordIndex]!.startSeconds;
    const realEnd = endWordIndex >= wordTimings.length ? lastWordEnd : wordTimings[Math.max(0, endWordIndex)]!.endSeconds;
    return { start: realStart, end: realEnd };
  };

  // Best contiguous window starting at or after `cursor` whose words match
  // spanWords — not a strict exact match, since a voice model can expand a
  // contraction or a number differently than it was typed. Requires most
  // (not all) words to agree so a minor mismatch doesn't reject a
  // genuinely correct match, and only ever searches forward, which keeps
  // every action's span in the same order the narration script itself is
  // in (the planner is explicitly told to author coversText that way).
  const findSpan = (spanWords: string[], cursor: number): { startIndex: number; endIndex: number } | null => {
    if (spanWords.length === 0) return null;
    let bestIndex = -1;
    let bestScore = 0;
    for (let i = cursor; i <= realWords.length - spanWords.length; i++) {
      let matches = 0;
      for (let k = 0; k < spanWords.length; k++) {
        if (realWords[i + k] === spanWords[k]) matches++;
      }
      const score = matches / spanWords.length;
      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
        if (score === 1) break; // can't do better than a perfect match
      }
    }
    if (bestIndex === -1 || bestScore < 0.6) return null;
    return { startIndex: bestIndex, endIndex: bestIndex + spanWords.length - 1 };
  };

  let cursor = 0;
  for (const action of sceneDocument.actions) {
    const spanWords = (action.coversText ?? "")
      .split(/\s+/)
      .map(normalizeWord)
      .filter((w) => w.length > 0);

    const match = findSpan(spanWords, cursor);
    if (match) {
      action.atSeconds = wordTimings[match.startIndex]!.startSeconds;
      action.durationSeconds = Math.max(0.5, wordTimings[match.endIndex]!.endSeconds - action.atSeconds);
      cursor = match.endIndex + 1;
    } else {
      // No coversText, or it couldn't be located — fall back to the rate
      // estimate for this one action only, and still advance the cursor by
      // the same estimate so a later action's real search doesn't start
      // from before this (unmatched) one.
      const { start, end } = rateBasedRange(action);
      action.atSeconds = start;
      action.durationSeconds = Math.max(0.5, end - start);
      const estimatedEndIndex = Math.round((start + action.durationSeconds) * WORDS_PER_SECOND);
      cursor = Math.max(cursor, Math.min(estimatedEndIndex, realWords.length - 1));
    }
  }

  // Even exact word-span matching can leave the very last action ending a
  // little short of the real audio's last word (the closing narration
  // after its last matched word, e.g. trailing punctuation-only content) —
  // stretch (never shrink) only that one action so the video never runs
  // out of picture before the narration actually stops.
  const finalAction = sceneDocument.actions[sceneDocument.actions.length - 1];
  if (finalAction) {
    const finalActionEnd = finalAction.atSeconds + finalAction.durationSeconds;
    if (finalActionEnd < lastWordEnd) {
      finalAction.durationSeconds = lastWordEnd - finalAction.atSeconds;
    }
  }
}

export interface TimingCheckResult {
  warnings: string[];
  sceneEndSeconds: number;
}

/**
 * Compares a SceneDocument's authored timing against the real narration
 * duration from TTS. Never throws — a mistimed scene should still render
 * and warn loudly, not crash a job outright (a caller-authored
 * SceneDocument that only fails at the tail end is still mostly usable).
 */
export function checkSceneTiming(sceneDocument: SceneDocument, audioDurationSeconds: number): TimingCheckResult {
  const warnings: string[] = [];

  let sceneEndSeconds = 0;
  for (const action of sceneDocument.actions) {
    const actionEnd = action.atSeconds + action.durationSeconds;
    sceneEndSeconds = Math.max(sceneEndSeconds, actionEnd);

    if (actionEnd > audioDurationSeconds + 0.5) {
      warnings.push(
        `Action "${action.id}" (${action.type}) runs until ${actionEnd.toFixed(1)}s, past the ${audioDurationSeconds.toFixed(
          1,
        )}s narration.`,
      );
    }
  }

  const drift = Math.abs(sceneEndSeconds - audioDurationSeconds) / Math.max(audioDurationSeconds, 0.001);
  if (drift > DRIFT_WARNING_THRESHOLD) {
    warnings.push(
      `Scene duration (${sceneEndSeconds.toFixed(1)}s) drifts ${(drift * 100).toFixed(
        0,
      )}% from narration duration (${audioDurationSeconds.toFixed(1)}s) — the SceneDocument and the real narration may have drifted apart.`,
    );
  }

  return { warnings, sceneEndSeconds };
}

export function printTimingWarnings(warnings: string[]): void {
  for (const warning of warnings) {
    console.warn(`⚠️  Timing: ${warning}`);
  }
}
