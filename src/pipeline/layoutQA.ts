import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { renderStill } from "@remotion/renderer";
import type { VideoConfig } from "remotion";
import type { SceneAction, SceneDocument } from "../schema/scene";
import type { SceneInputProps } from "../render/Root";

const MODEL = "claude-haiku-4-5-20251001";
const INPUT_COST_PER_MTOK_USD = 0.8;
const OUTPUT_COST_PER_MTOK_USD = 4.0;

export interface LayoutQALogEntry {
  actionId: string;
  passed: boolean;
  issues: string[];
  adjustmentApplied: boolean;
  costUsd: number;
}

interface LayoutAdjustmentInstruction {
  kind: "shiftSlot" | "scaleSlot" | "dropDecoration";
  slotName?: string;
  offsetX?: number;
  offsetY?: number;
  scaleMultiplier?: number;
  decorationIndex?: number;
}

/**
 * Revision-3 Workstream 4: the in-house answer to "balanced like Golpo,"
 * reusing the vision-LLM pattern the Layer 2 quarantine gate already
 * proved. For every composed scene (a "composition" or "sketchDiagram"
 * action — the ones with real collision/crowding risk), renders one still
 * frame, sends it to a vision model against a layout rubric, and applies
 * AT MOST ONE bounded correction — never a loop, so cost and latency stay
 * predictable. The correction vocabulary is deliberately narrow: nudge
 * one slot's position/scale, or drop one decoration — never rewrite
 * content or template structure.
 */
export async function runLayoutQA(args: {
  sceneDocument: SceneDocument;
  bundleLocation: string;
  composition: VideoConfig;
  inputProps: SceneInputProps;
  fps: number;
  apiKey?: string;
}): Promise<LayoutQALogEntry[]> {
  const composedActions = args.sceneDocument.actions.filter(
    (action) => action.type === "composition" || action.type === "sketchDiagram",
  );
  if (composedActions.length === 0) return [];

  const entries: LayoutQALogEntry[] = [];

  for (const action of composedActions) {
    const midFrame = Math.round((action.atSeconds + action.durationSeconds / 2) * args.fps);
    const tmpPath = path.join(os.tmpdir(), `layout-qa-${action.id}-${Date.now()}.png`);

    await renderStill({
      composition: args.composition,
      serveUrl: args.bundleLocation,
      output: tmpPath,
      frame: midFrame,
      inputProps: args.inputProps,
    });
    const buffer = await fs.readFile(tmpPath);
    await fs.unlink(tmpPath).catch(() => {});

    const critique = await critiqueLayout(buffer, { apiKey: args.apiKey });
    let adjustmentApplied = false;

    if (!critique.passed && critique.adjustment) {
      adjustmentApplied = applyAdjustment(action, critique.adjustment);
    }

    entries.push({
      actionId: action.id,
      passed: critique.passed,
      issues: critique.issues,
      adjustmentApplied,
      costUsd: critique.costUsd,
    });
  }

  return entries;
}

interface CritiqueResult {
  passed: boolean;
  issues: string[];
  adjustment: LayoutAdjustmentInstruction | null;
  costUsd: number;
}

async function critiqueLayout(imageBuffer: Buffer, opts: { apiKey?: string }): Promise<CritiqueResult> {
  const apiKey = opts.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set — required for the layout QA loop.");

  const client = new Anthropic({ apiKey });
  const system = `You are a layout QA reviewer for a whiteboard-style video frame. Check this rubric:
- No two elements overlap/collide in a way that hides content.
- Nothing crowds against the frame edges with zero margin.
- No large dead/empty zone where a viewer's eye has nothing to land on.
- The frame uses roughly 60-70% canvas coverage with deliberate breathing room, not more, not much less.
- There is a clear focal hierarchy — one dominant element, not several competing equally.
- A viewer can tell what to look at first, second, third (a discernible reading path).
- Decoration count (arrows, marks, banners, etc.) is reasonable (roughly 0-6), not a wall of doodles.

Respond with ONLY a JSON object:
{"passed": boolean, "issues": string[], "adjustment": null | {"kind": "shiftSlot"|"scaleSlot"|"dropDecoration",
"slotName": string | null, "offsetX": number | null, "offsetY": number | null, "scaleMultiplier": number | null,
"decorationIndex": number | null}}
If passed is true, issues should be empty and adjustment null. If passed is false, give the ONE single most
impactful adjustment — never more than one — that would most improve the frame. "shiftSlot"/"scaleSlot" need
your best guess at the slot's name (a label visible near the element, or a reasonable guess like "left"/
"backdrop"/"character"/"panel1" if unknown); "dropDecoration" needs decorationIndex, your best guess at which
decoration (0-indexed, in the order they'd naturally be listed) is the least essential to remove.`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 400,
    system,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/png", data: imageBuffer.toString("base64") } },
          { type: "text", text: "Review this frame against the layout rubric." },
        ],
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  const rawText = textBlock && "text" in textBlock ? textBlock.text : "{}";
  const costUsd =
    (response.usage.input_tokens / 1_000_000) * INPUT_COST_PER_MTOK_USD +
    (response.usage.output_tokens / 1_000_000) * OUTPUT_COST_PER_MTOK_USD;

  try {
    const fenceMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
    const parsed = JSON.parse(fenceMatch ? fenceMatch[1]! : rawText) as {
      passed: boolean;
      issues: string[];
      adjustment: {
        kind: "shiftSlot" | "scaleSlot" | "dropDecoration";
        slotName: string | null;
        offsetX: number | null;
        offsetY: number | null;
        scaleMultiplier: number | null;
        decorationIndex: number | null;
      } | null;
    };
    const adjustment: LayoutAdjustmentInstruction | null = parsed.adjustment
      ? {
          kind: parsed.adjustment.kind,
          slotName: parsed.adjustment.slotName ?? undefined,
          offsetX: parsed.adjustment.offsetX ?? undefined,
          offsetY: parsed.adjustment.offsetY ?? undefined,
          scaleMultiplier: parsed.adjustment.scaleMultiplier ?? undefined,
          decorationIndex: parsed.adjustment.decorationIndex ?? undefined,
        }
      : null;
    return { passed: !!parsed.passed, issues: parsed.issues ?? [], adjustment, costUsd };
  } catch {
    // Malformed response — fail open (treat as passed) rather than block the render on a parsing hiccup.
    return { passed: true, issues: [], adjustment: null, costUsd };
  }
}

/** Mutates the action in place per one bounded instruction. Returns whether anything was actually applied — a
 * "shiftSlot"/"scaleSlot" instruction naming a slot that doesn't exist on this action is a no-op, not an error. */
function applyAdjustment(action: SceneAction, instruction: LayoutAdjustmentInstruction): boolean {
  if (instruction.kind === "dropDecoration") {
    if (!action.decorations || instruction.decorationIndex === undefined) return false;
    if (instruction.decorationIndex < 0 || instruction.decorationIndex >= action.decorations.length) return false;
    action.decorations.splice(instruction.decorationIndex, 1);
    return true;
  }

  if (!action.composition || !instruction.slotName) return false;
  const slot = action.composition.slots[instruction.slotName];
  if (!slot) return false;

  if (instruction.kind === "shiftSlot") {
    slot.layoutAdjustment = {
      ...slot.layoutAdjustment,
      offsetX: instruction.offsetX ?? slot.layoutAdjustment?.offsetX,
      offsetY: instruction.offsetY ?? slot.layoutAdjustment?.offsetY,
    };
    return instruction.offsetX !== undefined || instruction.offsetY !== undefined;
  }

  if (instruction.kind === "scaleSlot") {
    if (instruction.scaleMultiplier === undefined) return false;
    slot.layoutAdjustment = { ...slot.layoutAdjustment, scaleMultiplier: instruction.scaleMultiplier };
    return true;
  }

  return false;
}
