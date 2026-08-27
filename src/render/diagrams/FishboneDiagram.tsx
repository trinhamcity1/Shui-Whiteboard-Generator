import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { SKETCH_COLORS, SKETCH_LINE, SKETCH_FONT_FAMILY, sketchFontFaceCss } from "../sketchStyle";
import { roughGenerator, drawableToPaths } from "../decorations/roughPath";
import { RevealPath } from "../decorations/RevealPath";
import { CANVAS_WIDTH, RoughRect, SpokeLine, DiagramTitle } from "./primitives";

export interface FishboneDiagramProps {
  title: string;
  effect: string;
  categories: { label: string; causes: string[] }[];
}

const SPINE_Y = 900;
const SPINE_LEFT = 100;
const SPINE_RIGHT = 780;

/** One effect, several categories of contributing causes — "why did X
 * happen" content. Not a simple sequence (flowchart) or a single
 * cause->effect pair (a plain arrow decoration handles that). */
export function FishboneDiagram({ title, effect, categories }: FishboneDiagramProps) {
  const { height: canvasHeight } = useVideoConfig();
  const spineDrawable = roughGenerator.line(SPINE_LEFT, SPINE_Y, SPINE_RIGHT, SPINE_Y, {
    stroke: SKETCH_COLORS.ink,
    strokeWidth: SKETCH_LINE.strokeWidthThick,
    roughness: SKETCH_LINE.roughness,
    bowing: SKETCH_LINE.bowing,
  });

  const top = categories.filter((_, i) => i % 2 === 0);
  const bottom = categories.filter((_, i) => i % 2 === 1);
  const branchGap = (SPINE_RIGHT - SPINE_LEFT - 100) / Math.max(top.length, bottom.length, 1);

  return (
    <AbsoluteFill style={{ backgroundColor: SKETCH_COLORS.paper }}>
      <style>{sketchFontFaceCss}</style>
      <DiagramTitle title={title} />

      <svg width={CANVAS_WIDTH} height={Math.max(canvasHeight, SPINE_Y + 200)} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}>
        {drawableToPaths(spineDrawable).map((p, i) => (
          <RevealPath key={i} d={p.d} stroke={p.stroke} strokeWidth={p.strokeWidth} startFrame={0} instant />
        ))}
        {top.map((cat, i) => {
          const branchX = SPINE_LEFT + 80 + i * branchGap;
          return <SpokeLine key={`top-${cat.label}`} x1={branchX} y1={SPINE_Y - 220} x2={branchX + 140} y2={SPINE_Y} seed={i} />;
        })}
        {bottom.map((cat, i) => {
          const branchX = SPINE_LEFT + 80 + i * branchGap;
          return <SpokeLine key={`bottom-${cat.label}`} x1={branchX} y1={SPINE_Y + 220} x2={branchX + 140} y2={SPINE_Y} seed={i + 50} />;
        })}
      </svg>

      {top.map((cat, i) => {
        const branchX = SPINE_LEFT + 80 + i * branchGap;
        return (
          <div key={`top-label-${cat.label}`} style={{ position: "absolute", left: branchX - 100, top: SPINE_Y - 320, width: 260, textAlign: "center" }}>
            <div style={{ fontFamily: SKETCH_FONT_FAMILY, fontSize: 24, color: SKETCH_COLORS.ink, marginBottom: 6 }}>{cat.label}</div>
            {cat.causes.map((c) => (
              <div key={c} style={{ fontFamily: SKETCH_FONT_FAMILY, fontSize: 16, color: SKETCH_COLORS.ink, opacity: 0.8 }}>
                {c}
              </div>
            ))}
          </div>
        );
      })}
      {bottom.map((cat, i) => {
        const branchX = SPINE_LEFT + 80 + i * branchGap;
        return (
          <div key={`bottom-label-${cat.label}`} style={{ position: "absolute", left: branchX - 100, top: SPINE_Y + 40, width: 260, textAlign: "center" }}>
            <div style={{ fontFamily: SKETCH_FONT_FAMILY, fontSize: 24, color: SKETCH_COLORS.ink, marginBottom: 6 }}>{cat.label}</div>
            {cat.causes.map((c) => (
              <div key={c} style={{ fontFamily: SKETCH_FONT_FAMILY, fontSize: 16, color: SKETCH_COLORS.ink, opacity: 0.8 }}>
                {c}
              </div>
            ))}
          </div>
        );
      })}

      <RoughRect x={SPINE_RIGHT} y={SPINE_Y - 60} width={200} height={120} instant seed={999} />
      <div style={{ position: "absolute", left: SPINE_RIGHT + 10, top: SPINE_Y - 40, width: 180, height: 80, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", fontFamily: SKETCH_FONT_FAMILY, fontSize: 22, color: SKETCH_COLORS.ink }}>
        {effect}
      </div>
    </AbsoluteFill>
  );
}
