import React, { useMemo } from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { SKETCH_COLORS, sketchFontFaceCss } from "../sketchStyle";
import { CANVAS_WIDTH, RoughRect, NodeLabel, DiagramTitle, SpokeLine, emphasisFill } from "./primitives";
import type { DiagramNode } from "../../schema/diagram";

export interface TreeDiagramProps {
  title: string;
  nodes: (DiagramNode & { parentId?: string })[];
}

const LEVEL_HEIGHT = 200;
const TOP_Y = 220;
const NODE_HEIGHT = 110;

/** Branching parent-child hierarchy with a VARYING number of children per
 * node — an org chart, a taxonomy. Distinct from `pyramid` (a fixed linear
 * stack of ranked tiers, no branching). */
export function TreeDiagram({ title, nodes }: TreeDiagramProps) {
  const { height: canvasHeight } = useVideoConfig();

  const { levels, positions } = useMemo(() => {
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const depthOf = new Map<string, number>();
    const resolveDepth = (id: string, guard = 0): number => {
      if (depthOf.has(id)) return depthOf.get(id)!;
      const node = byId.get(id);
      if (!node?.parentId || !byId.has(node.parentId) || guard > 20) {
        depthOf.set(id, 0);
        return 0;
      }
      const d = resolveDepth(node.parentId, guard + 1) + 1;
      depthOf.set(id, d);
      return d;
    };
    nodes.forEach((n) => resolveDepth(n.id));

    const levelGroups = new Map<number, DiagramNode[]>();
    nodes.forEach((n) => {
      const d = depthOf.get(n.id)!;
      if (!levelGroups.has(d)) levelGroups.set(d, []);
      levelGroups.get(d)!.push(n);
    });
    const levels = [...levelGroups.entries()].sort(([a], [b]) => a - b);

    const positions = new Map<string, { x: number; y: number }>();
    levels.forEach(([depth, levelNodes]) => {
      const y = TOP_Y + depth * LEVEL_HEIGHT;
      const gap = CANVAS_WIDTH / (levelNodes.length + 1);
      levelNodes.forEach((n, i) => positions.set(n.id, { x: gap * (i + 1), y }));
    });
    return { levels, positions };
  }, [nodes]);

  const nodeWidth = Math.min(240, CANVAS_WIDTH / Math.max(...levels.map(([, g]) => g.length), 1) - 30);
  const canvasHeightUsed = TOP_Y + levels.length * LEVEL_HEIGHT + 100;

  return (
    <AbsoluteFill style={{ backgroundColor: SKETCH_COLORS.paper }}>
      <style>{sketchFontFaceCss}</style>
      <DiagramTitle title={title} />
      <svg width={CANVAS_WIDTH} height={Math.max(canvasHeight, canvasHeightUsed)} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}>
        {nodes.map((n) => {
          if (!n.parentId) return null;
          const from = positions.get(n.parentId);
          const to = positions.get(n.id);
          if (!from || !to) return null;
          return <SpokeLine key={`edge-${n.id}`} x1={from.x} y1={from.y + NODE_HEIGHT / 2} x2={to.x} y2={to.y - NODE_HEIGHT / 2} seed={n.id.length} />;
        })}
      </svg>
      {nodes.map((n, i) => {
        const pos = positions.get(n.id)!;
        return <RoughRect key={n.id} x={pos.x - nodeWidth / 2} y={pos.y - NODE_HEIGHT / 2} width={nodeWidth} height={NODE_HEIGHT} fill={emphasisFill(n.emphasis)} instant seed={100 + i} />;
      })}
      {nodes.map((n) => {
        const pos = positions.get(n.id)!;
        return <NodeLabel key={`label-${n.id}`} x={pos.x - nodeWidth / 2 + 10} y={pos.y - NODE_HEIGHT / 2 + 6} width={nodeWidth - 20} height={NODE_HEIGHT - 12} label={n.label} baseFontSize={22} />;
      })}
    </AbsoluteFill>
  );
}
