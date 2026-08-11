import type { SceneDocument } from "../schema/scene";

const DRIFT_WARNING_THRESHOLD = 0.1; // 10%

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
