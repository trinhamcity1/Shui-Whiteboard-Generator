import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { SKETCH_COLORS, SKETCH_FONT_FAMILY, sketchFontFaceCss } from "../sketchStyle";
import { Arrow } from "../decorations";
import { CANVAS_WIDTH, RoughRect, DiagramTitle } from "./primitives";

export interface MatrixDiagramProps {
  title: string;
  xAxisLabel: string;
  yAxisLabel: string;
  quadrants: { label: string; description?: string }[];
}

const GRID_TOP = 260;
const GRID_SIZE = 760;
const AXIS_MARGIN = 90;

/** A genuine two-axis classification — urgency x importance, federal x
 * state jurisdiction. Needs exactly two independent dimensions; four
 * unrelated categories with no real axes is `radial`, not this. */
export function MatrixDiagram({ title, xAxisLabel, yAxisLabel, quadrants }: MatrixDiagramProps) {
  const { height: canvasHeight } = useVideoConfig();
  const gridLeft = CANVAS_WIDTH / 2 - GRID_SIZE / 2 + AXIS_MARGIN / 2;
  const gridTop = GRID_TOP + AXIS_MARGIN / 2;
  const cellSize = (GRID_SIZE - AXIS_MARGIN) / 2;

  const cellRects = [
    { x: gridLeft, y: gridTop, q: quadrants[0]! },
    { x: gridLeft + cellSize, y: gridTop, q: quadrants[1]! },
    { x: gridLeft, y: gridTop + cellSize, q: quadrants[2]! },
    { x: gridLeft + cellSize, y: gridTop + cellSize, q: quadrants[3]! },
  ];

  return (
    <AbsoluteFill style={{ backgroundColor: SKETCH_COLORS.paper }}>
      <style>{sketchFontFaceCss}</style>
      <DiagramTitle title={title} />

      <svg width={CANVAS_WIDTH} height={canvasHeight} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}>
        <Arrow from={{ x: gridLeft - 30, y: gridTop + cellSize * 2 }} to={{ x: gridLeft - 30, y: gridTop - 10 }} color={SKETCH_COLORS.ink} variant="straight" strokeWidth={4} instant />
        <Arrow from={{ x: gridLeft - 10, y: gridTop + cellSize * 2 + 30 }} to={{ x: gridLeft + cellSize * 2, y: gridTop + cellSize * 2 + 30 }} color={SKETCH_COLORS.ink} variant="straight" strokeWidth={4} instant />
      </svg>
      <div
        style={{
          position: "absolute",
          left: gridLeft - 70,
          top: gridTop + cellSize - 20,
          width: 200,
          transform: "rotate(-90deg)",
          transformOrigin: "left center",
          textAlign: "center",
          fontFamily: SKETCH_FONT_FAMILY,
          fontSize: 24,
          color: SKETCH_COLORS.ink,
        }}
      >
        {yAxisLabel}
      </div>
      <div
        style={{
          position: "absolute",
          left: gridLeft,
          top: gridTop + cellSize * 2 + 45,
          width: cellSize * 2,
          textAlign: "center",
          fontFamily: SKETCH_FONT_FAMILY,
          fontSize: 24,
          color: SKETCH_COLORS.ink,
        }}
      >
        {xAxisLabel}
      </div>

      {cellRects.map((c, i) => (
        <RoughRect key={i} x={c.x} y={c.y} width={cellSize} height={cellSize} instant seed={100 + i} />
      ))}
      {cellRects.map((c, i) => (
        <div key={`text-${i}`} style={{ position: "absolute", left: c.x + 16, top: c.y + 16, width: cellSize - 32, height: cellSize - 32, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center" }}>
          <div style={{ fontFamily: SKETCH_FONT_FAMILY, fontSize: 26, color: SKETCH_COLORS.ink, marginBottom: c.q.description ? 8 : 0 }}>{c.q.label}</div>
          {c.q.description && <div style={{ fontFamily: SKETCH_FONT_FAMILY, fontSize: 18, color: SKETCH_COLORS.ink, opacity: 0.75 }}>{c.q.description}</div>}
        </div>
      ))}
    </AbsoluteFill>
  );
}
