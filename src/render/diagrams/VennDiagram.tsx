import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { SKETCH_COLORS, SKETCH_FONT_FAMILY, sketchFontFaceCss } from "../sketchStyle";
import { RoughEllipse, DiagramTitle } from "./primitives";

export interface VennDiagramProps {
  title: string;
  sets: { id: string; label: string }[];
  overlapLabels?: Record<string, string>;
}

const CANVAS_WIDTH = 1000;
const CIRCLE_D = 460;
const CENTER_Y = 700;

/** Set overlap ONLY — never a substitute for a plain 2-way comparison; a
 * Venn with a near-empty overlap is a planner mistake, not a valid
 * rendering of "these are different." Circles render outline-only
 * (ink-first) — set membership is conveyed by region, not by fill color. */
export function VennDiagram({ title, sets, overlapLabels = {} }: VennDiagramProps) {
  const { height: canvasHeight } = useVideoConfig();
  const isThree = sets.length === 3;

  const centers = isThree
    ? [
        { cx: CANVAS_WIDTH / 2 - 130, cy: CENTER_Y - 90 },
        { cx: CANVAS_WIDTH / 2 + 130, cy: CENTER_Y - 90 },
        { cx: CANVAS_WIDTH / 2, cy: CENTER_Y + 150 },
      ]
    : [
        { cx: CANVAS_WIDTH / 2 - 130, cy: CENTER_Y },
        { cx: CANVAS_WIDTH / 2 + 130, cy: CENTER_Y },
      ];

  const labelOffsets = isThree
    ? [
        { x: centers[0]!.cx - 220, y: centers[0]!.cy - 200 },
        { x: centers[1]!.cx + 40, y: centers[1]!.cy - 200 },
        { x: centers[2]!.cx - 90, y: centers[2]!.cy + 220 },
      ]
    : [
        { x: centers[0]!.cx - 300, y: centers[0]!.cy - 30 },
        { x: centers[1]!.cx + 140, y: centers[1]!.cy - 30 },
      ];

  const sortedKey = (ids: string[]) => [...ids].sort().join("+");

  return (
    <AbsoluteFill style={{ backgroundColor: SKETCH_COLORS.paper }}>
      <style>{sketchFontFaceCss}</style>
      <DiagramTitle title={title} />

      {sets.map((s, i) => (
        <RoughEllipse key={s.id} cx={centers[i]!.cx} cy={centers[i]!.cy} width={CIRCLE_D} height={CIRCLE_D} fill="none" instant seed={100 + i} strokeWidth={5} />
      ))}

      {sets.map((s, i) => (
        <div
          key={`label-${s.id}`}
          style={{ position: "absolute", left: labelOffsets[i]!.x, top: labelOffsets[i]!.y, width: 220, textAlign: "center", fontFamily: SKETCH_FONT_FAMILY, fontSize: 26, color: SKETCH_COLORS.ink }}
        >
          {s.label}
        </div>
      ))}

      {!isThree && overlapLabels[sortedKey([sets[0]!.id, sets[1]!.id])] && (
        <div
          style={{
            position: "absolute",
            left: CANVAS_WIDTH / 2 - 90,
            top: CENTER_Y - 20,
            width: 180,
            textAlign: "center",
            fontFamily: SKETCH_FONT_FAMILY,
            fontSize: 20,
            color: SKETCH_COLORS.ink,
          }}
        >
          {overlapLabels[sortedKey([sets[0]!.id, sets[1]!.id])]}
        </div>
      )}

      {isThree && (
        <div
          style={{
            position: "absolute",
            left: CANVAS_WIDTH / 2 - 90,
            top: CENTER_Y + 20,
            width: 180,
            textAlign: "center",
            fontFamily: SKETCH_FONT_FAMILY,
            fontSize: 18,
            color: SKETCH_COLORS.ink,
          }}
        >
          {overlapLabels[sortedKey(sets.map((s) => s.id))] ?? ""}
        </div>
      )}
    </AbsoluteFill>
  );
}
