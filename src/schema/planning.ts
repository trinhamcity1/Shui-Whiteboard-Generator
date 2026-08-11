import type { SceneAction } from "./scene";

/**
 * Plans a SceneAction[] from a plain narration script via an LLM call
 * against the fixed SceneActionType/icon vocabulary. Real implementation
 * is Phase 3's concern — stubbed here so the schema and pipeline already
 * accommodate the script-only path.
 */
export function planScenesFromScript(_narrationScript: string): SceneAction[] {
  throw new Error("planScenesFromScript is not implemented until Phase 3.");
}
