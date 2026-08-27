import React, { useMemo } from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { SKETCH_COLORS, SKETCH_FONT_FAMILY, sketchFontFaceCss } from "../sketchStyle";
import { CANVAS_WIDTH, RoughRect, NodeLabel, DiagramTitle, SpokeLine, emphasisFill } from "./primitives";
import type { DiagramEdge, DiagramNode } from "../../schema/diagram";

export interface NetworkDiagramProps {
  title: string;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

/** Arbitrary nodes and connections, no hierarchy or sequence implied — a
 * system's components and how they connect, a set of entities and their
 * relationships. Circular placement (not force-directed — out of scope for
 * a hand-drawn whiteboard render) keeps every node the same distance from
 * center so no edge crosses awkwardly close to an unrelated node. */
export function NetworkDiagram({ title, nodes, edges }: NetworkDiagramProps) {
  const { height: canvasHeight } = useVideoConfig();
  const cx = CANVAS_WIDTH / 2;
  const cy = Math.min(canvasHeight, 1400) * 0.52 + 100;
  const radius = Math.min(CANVAS_WIDTH, canvasHeight * 0.6) * 0.36;
  const nodeWidth = 200;
  const nodeHeight = 100;

  const positions = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    nodes.forEach((n, i) => {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / nodes.length;
      map.set(n.id, { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) });
    });
    return map;
  }, [nodes, cx, cy, radius]);

  return (
    <AbsoluteFill style={{ backgroundColor: SKETCH_COLORS.paper }}>
      <style>{sketchFontFaceCss}</style>
      <DiagramTitle title={title} />

      <svg width={CANVAS_WIDTH} height={canvasHeight} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}>
        {edges.map((e, i) => {
          const from = positions.get(e.fromId);
          const to = positions.get(e.toId);
          if (!from || !to) return null;
          return <SpokeLine key={`edge-${i}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} seed={i} />;
        })}
      </svg>

      {nodes.map((n, i) => {
        const pos = positions.get(n.id)!;
        return <RoughRect key={n.id} x={pos.x - nodeWidth / 2} y={pos.y - nodeHeight / 2} width={nodeWidth} height={nodeHeight} fill={emphasisFill(n.emphasis)} instant seed={100 + i} />;
      })}
      {nodes.map((n) => {
        const pos = positions.get(n.id)!;
        return <NodeLabel key={`label-${n.id}`} x={pos.x - nodeWidth / 2 + 8} y={pos.y - nodeHeight / 2 + 6} width={nodeWidth - 16} height={nodeHeight - 12} label={n.label} baseFontSize={20} />;
      })}
      {edges.map((e, i) => {
        if (!e.label) return null;
        const from = positions.get(e.fromId);
        const to = positions.get(e.toId);
        if (!from || !to) return null;
        const midX = (from.x + to.x) / 2;
        const midY = (from.y + to.y) / 2;
        return (
          <div key={`edge-label-${i}`} style={{ position: "absolute", left: midX - 60, top: midY - 12, width: 120, textAlign: "center", fontFamily: SKETCH_FONT_FAMILY, fontSize: 16, color: SKETCH_COLORS.ink, background: SKETCH_COLORS.paper }}>
            {e.label}
          </div>
        );
      })}
    </AbsoluteFill>
  );
}
