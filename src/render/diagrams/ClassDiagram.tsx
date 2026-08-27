import React, { useMemo } from "react";
import { AbsoluteFill } from "remotion";
import { SKETCH_COLORS, SKETCH_LINE, SKETCH_FONT_FAMILY, sketchFontFaceCss } from "../sketchStyle";
import { roughGenerator, drawableToPaths } from "../decorations/roughPath";
import { RevealPath } from "../decorations/RevealPath";
import { SpokeLine, CANVAS_WIDTH, RoughRect, DiagramTitle } from "./primitives";

export interface ClassDiagramProps {
  title: string;
  classes: { id: string; name: string; attributes?: string[] }[];
  relationships: { fromClassId: string; toClassId: string; label?: string }[];
}

const TOP = 240;
const COLS = 2;
const BOX_WIDTH = 380;
const BOX_HEADER = 60;
const ROW_HEIGHT = 34;
const COL_GAP = 60;
const ROW_GAP = 80;

/** A data model / system's entities and structural relationships — NOT a
 * flow of events over time (that's sequenceDiagram). Technical content
 * only. */
export function ClassDiagram({ title, classes, relationships }: ClassDiagramProps) {
  const positions = useMemo(() => {
    const map = new Map<string, { x: number; y: number; height: number }>();
    let x0 = (CANVAS_WIDTH - (COLS * BOX_WIDTH + (COLS - 1) * COL_GAP)) / 2;
    let currentY = TOP;
    let maxHeightInRow = 0;
    classes.forEach((c, i) => {
      const col = i % COLS;
      const height = BOX_HEADER + (c.attributes?.length ?? 0) * ROW_HEIGHT + 20;
      const x = x0 + col * (BOX_WIDTH + COL_GAP);
      map.set(c.id, { x, y: currentY, height });
      maxHeightInRow = Math.max(maxHeightInRow, height);
      if (col === COLS - 1 || i === classes.length - 1) {
        currentY += maxHeightInRow + ROW_GAP;
        maxHeightInRow = 0;
      }
    });
    return map;
  }, [classes]);

  const canvasHeight = Math.max(...[...positions.values()].map((p) => p.y + p.height)) + 100;

  return (
    <AbsoluteFill style={{ backgroundColor: SKETCH_COLORS.paper }}>
      <style>{sketchFontFaceCss}</style>
      <DiagramTitle title={title} />

      <svg width={CANVAS_WIDTH} height={canvasHeight} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}>
        {relationships.map((r, i) => {
          const from = positions.get(r.fromClassId);
          const to = positions.get(r.toClassId);
          if (!from || !to) return null;
          return (
            <SpokeLine
              key={`rel-${i}`}
              x1={from.x + BOX_WIDTH / 2}
              y1={from.y + from.height / 2}
              x2={to.x + BOX_WIDTH / 2}
              y2={to.y + to.height / 2}
              seed={i}
            />
          );
        })}
      </svg>

      {classes.map((c) => {
        const pos = positions.get(c.id)!;
        return <RoughRect key={c.id} x={pos.x} y={pos.y} width={BOX_WIDTH} height={pos.height} instant seed={c.id.length} />;
      })}
      {classes.map((c) => {
        const pos = positions.get(c.id)!;
        const dividerDrawable = roughGenerator.line(pos.x, pos.y + BOX_HEADER, pos.x + BOX_WIDTH, pos.y + BOX_HEADER, {
          stroke: SKETCH_COLORS.ink,
          strokeWidth: SKETCH_LINE.strokeWidthThin,
          roughness: SKETCH_LINE.roughness,
          bowing: SKETCH_LINE.bowing,
        });
        return (
          <React.Fragment key={`content-${c.id}`}>
            <div style={{ position: "absolute", left: pos.x, top: pos.y, width: BOX_WIDTH, height: BOX_HEADER, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SKETCH_FONT_FAMILY, fontSize: 24, color: SKETCH_COLORS.ink }}>
              {c.name}
            </div>
            {(c.attributes?.length ?? 0) > 0 && (
              <svg width={CANVAS_WIDTH} height={canvasHeight} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}>
                {drawableToPaths(dividerDrawable).map((p, i) => (
                  <RevealPath key={i} d={p.d} stroke={p.stroke} strokeWidth={p.strokeWidth} startFrame={0} instant />
                ))}
              </svg>
            )}
            {(c.attributes ?? []).map((attr, i) => (
              <div key={attr} style={{ position: "absolute", left: pos.x + 16, top: pos.y + BOX_HEADER + 8 + i * ROW_HEIGHT, width: BOX_WIDTH - 32, fontFamily: SKETCH_FONT_FAMILY, fontSize: 18, color: SKETCH_COLORS.ink }}>
                {attr}
              </div>
            ))}
          </React.Fragment>
        );
      })}
    </AbsoluteFill>
  );
}
