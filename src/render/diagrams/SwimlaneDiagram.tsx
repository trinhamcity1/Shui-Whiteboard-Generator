import React, { useMemo } from "react";
import { AbsoluteFill } from "remotion";
import { SKETCH_COLORS, SKETCH_LINE, SKETCH_FONT_FAMILY, sketchFontFaceCss } from "../sketchStyle";
import { roughGenerator, drawableToPaths } from "../decorations/roughPath";
import { RevealPath } from "../decorations/RevealPath";
import { Arrow } from "../decorations";
import { CANVAS_WIDTH, RoughRect, NodeLabel, DiagramTitle, emphasisFill } from "./primitives";
import type { DiagramEdge, DiagramNode } from "../../schema/diagram";

export interface SwimlaneDiagramProps {
  title: string;
  lanes: { id: string; label: string }[];
  nodes: (DiagramNode & { laneId: string })[];
  edges: DiagramEdge[];
}

const LANE_TOP = 220;
const LANE_HEIGHT = 300;
const NODE_WIDTH = 220;
const NODE_HEIGHT = 120;

/** A process split across multiple actors/departments — each lane is one
 * actor's responsibility. Use when WHO does each step matters as much as
 * the step itself ("how a bill becomes law": Congress's lane, the
 * President's lane, the Courts' lane). */
export function SwimlaneDiagram({ title, lanes, nodes, edges }: SwimlaneDiagramProps) {
  const canvasHeight = LANE_TOP + lanes.length * LANE_HEIGHT + 100;

  const positions = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    lanes.forEach((lane, laneIndex) => {
      const laneNodes = nodes.filter((n) => n.laneId === lane.id);
      const gap = CANVAS_WIDTH / (laneNodes.length + 1);
      laneNodes.forEach((n, i) => {
        map.set(n.id, { x: gap * (i + 1), y: LANE_TOP + laneIndex * LANE_HEIGHT + LANE_HEIGHT / 2 });
      });
    });
    return map;
  }, [lanes, nodes]);

  return (
    <AbsoluteFill style={{ backgroundColor: SKETCH_COLORS.paper }}>
      <style>{sketchFontFaceCss}</style>
      <DiagramTitle title={title} />

      <svg width={CANVAS_WIDTH} height={canvasHeight} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}>
        {lanes.map((lane, i) => {
          const y = LANE_TOP + i * LANE_HEIGHT;
          const drawable = roughGenerator.line(0, y, CANVAS_WIDTH, y, {
            stroke: SKETCH_COLORS.ink,
            strokeWidth: SKETCH_LINE.strokeWidthThin * 1.5,
            roughness: SKETCH_LINE.roughness,
            bowing: SKETCH_LINE.bowing,
          });
          return drawableToPaths(drawable).map((p, j) => <RevealPath key={`lane-${i}-${j}`} d={p.d} stroke={p.stroke} strokeWidth={p.strokeWidth} startFrame={0} instant />);
        })}
        {edges.map((e, i) => {
          const from = positions.get(e.fromId);
          const to = positions.get(e.toId);
          if (!from || !to) return null;
          return <Arrow key={`edge-${i}`} from={from} to={to} color={SKETCH_COLORS.accentArrow} variant="curved" curvature={0.15} instant seed={i} />;
        })}
      </svg>

      {lanes.map((lane, i) => (
        <div
          key={lane.id}
          style={{
            position: "absolute",
            left: 20,
            top: LANE_TOP + i * LANE_HEIGHT + 10,
            fontFamily: SKETCH_FONT_FAMILY,
            fontSize: 22,
            color: SKETCH_COLORS.ink,
            fontWeight: "bold" as const,
          }}
        >
          {lane.label}
        </div>
      ))}

      {nodes.map((n, i) => {
        const pos = positions.get(n.id)!;
        return <RoughRect key={n.id} x={pos.x - NODE_WIDTH / 2} y={pos.y - NODE_HEIGHT / 2} width={NODE_WIDTH} height={NODE_HEIGHT} fill={emphasisFill(n.emphasis)} instant seed={100 + i} />;
      })}
      {nodes.map((n) => {
        const pos = positions.get(n.id)!;
        return <NodeLabel key={`label-${n.id}`} x={pos.x - NODE_WIDTH / 2 + 10} y={pos.y - NODE_HEIGHT / 2 + 8} width={NODE_WIDTH - 20} height={NODE_HEIGHT - 16} label={n.label} baseFontSize={20} />;
      })}
    </AbsoluteFill>
  );
}
