import type { SceneDocument } from "../schema/scene";
import type { WordTiming } from "../tts/types";
import { WORDS_PER_SECOND } from "../schema/planning";

const DRIFT_WARNING_THRESHOLD = 0.1; // 10%

/**
 * Caught on a real render (Trojan War test): the planner assigns every
 * action's atSeconds/durationSeconds against its own pre-TTS word-count
 * ESTIMATE (WORDS_PER_SECOND), authored before the real audio exists.
 * Real speech doesn't run at a flat rate — punctuation, clause length, and
 * the voice model's own pacing all vary it — so that estimate routinely
 * drifts from the real narration (17% short on that test). Nothing
 * corrected for the gap afterward: every scene fires early relative to
 * the real (slower) audio throughout, and the final stretch of the video
 * played out as blank silence after the last scene's Sequence ended while
 * the real audio kept talking past it — both symptoms a viewer would
 * describe as "the picture doesn't match what's being said."
 *
 * The real fix, not just a wider warning: ElevenLabs already returns
 * real per-word timestamps (`wordTimings`), completely unused until now
 * except to compute total duration. Since every action's atSeconds/
 * durationSeconds was chosen against the SAME flat-rate estimate the
 * planner always uses, "word index" is the one thing the estimate and
 * the real timing agree on — map each action's estimated timestamp to
 * the word index it implies, then look up that word's REAL timestamp
 * and use it instead. This tracks the actual pacing of the real audio
 * (pauses, long words, punctuation) instead of assuming a flat rate,
 * and by construction the last action's end now lands exactly on the
 * real audio's last word — no more trailing silence with nothing on
 * screen.
 */
export function realignSceneTiming(sceneDocument: SceneDocument, wordTimings: WordTiming[] | undefined): void {
  if (!wordTimings || wordTimings.length === 0) return;

  const lastWordEnd = wordTimings[wordTimings.length - 1]!.endSeconds;
  const startTimeForWordIndex = (wordIndex: number): number => {
    const clamped = Math.max(0, Math.min(wordIndex, wordTimings.length - 1));
    return wordTimings[clamped]!.startSeconds;
  };
  const endTimeForWordIndex = (wordIndex: number): number => {
    if (wordIndex >= wordTimings.length) return lastWordEnd;
    const clamped = Math.max(0, wordIndex);
    return wordTimings[clamped]!.endSeconds;
  };

  for (const action of sceneDocument.actions) {
    const startWordIndex = Math.round(action.atSeconds * WORDS_PER_SECOND);
    const endWordIndex = Math.round((action.atSeconds + action.durationSeconds) * WORDS_PER_SECOND);
    const realStart = startTimeForWordIndex(startWordIndex);
    const realEnd = endTimeForWordIndex(endWordIndex);
    action.atSeconds = realStart;
    // A degenerate/out-of-order mapping (two estimated timestamps landing
    // on the same real word) should never collapse a scene to zero-length
    // and disappear — floor it to something still watchable.
    action.durationSeconds = Math.max(0.5, realEnd - realStart);
  }

  // The rounded word-index mapping can still leave the very last action
  // ending a little short of the real audio's last word — stretch (never
  // shrink) only that one action so the video never runs out of picture
  // before the narration actually stops.
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
