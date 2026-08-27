import React, { useMemo } from "react";
import { AbsoluteFill, Img, useVideoConfig } from "remotion";
import { SKETCH_COLORS, SKETCH_LAYOUT, SKETCH_LINE, SKETCH_FONT_FAMILY, sketchFontFaceCss } from "../sketchStyle";
import { Arrow } from "../decorations";
import { roughGenerator, drawableToPaths } from "../decorations/roughPath";
import { RevealPath } from "../decorations/RevealPath";
import { CANVAS_WIDTH, RoughRect, RoughEllipse, SpokeLine, DiagramTitle, NodeLabel, emphasisFill } from "./primitives";
import type { DiagramNode, NodeSequenceKind } from "../../schema/diagram";

/**
 * One rendering engine for six diagram kinds that are all fundamentally
 * "arrange N labeled nodes via a layout, optionally connect them":
 * pyramid/funnel/flowchart share the "stack" layout, cycle uses "ring",
 * radial uses "hub", comparison uses "row". Kept as distinct schema `kind`
 * values (see diagram.ts) because the PLANNER picks based on semantic
 * intent even where the visual layout ends up shared.
 */

export interface NodeSequenceDiagramProps {
  kind: NodeSequenceKind;
  title: string;
  topLabel?: string;
  bottomBanner?: string;
  centerLabel?: string; // radial only
  nodes: DiagramNode[];
  isCyclical?: boolean; // flowchart only
  leftCharacterSrc?: string;
  rightCharacterSrc?: string;
}

const STACK_WIDTH = 600;
const TIER_HEIGHT_MIN = 120;
const TIER_HEIGHT_MAX = 280;
const TIER_GAP_MIN = 26;
const TIER_GAP_MAX = 90;
const BOTTOM_RESERVE = 260;
const TITLE_BOTTOM = 100;
const TOP_LABEL_GAP_ABOVE = 45;
const TOP_LABEL_HEIGHT = 90;
const TOP_LABEL_GAP_BELOW = 40;
const FUNNEL_BOTTOM_WIDTH_RATIO = 0.45; // funnel narrows to this fraction of STACK_WIDTH at its last node

function StackLayout({ kind, title, topLabel, bottomBanner, nodes, isCyclical, leftCharacterSrc, rightCharacterSrc }: NodeSequenceDiagramProps) {
  const { height: canvasHeight } = useVideoConfig();
  const taper = kind === "funnel";

  const topLabelBoxTop = TITLE_BOTTOM + TOP_LABEL_GAP_ABOVE;
  const stackTopY = topLabel ? topLabelBoxTop + TOP_LABEL_HEIGHT + TOP_LABEL_GAP_BELOW : 230;
  const availableHeight = Math.max(0, canvasHeight - stackTopY - BOTTOM_RESERVE);
  const perTier = nodes.length > 0 ? availableHeight / nodes.length : 0;
  const tierHeight = Math.min(TIER_HEIGHT_MAX, Math.max(TIER_HEIGHT_MIN, perTier * 0.62));
  const tierGap = Math.min(TIER_GAP_MAX, Math.max(TIER_GAP_MIN, perTier * 0.3));
  const stackHeightUncentered = nodes.length * tierHeight + Math.max(0, nodes.length - 1) * tierGap;
  const leftoverHeight = Math.max(0, availableHeight - stackHeightUncentered);
  const stackStartY = stackTopY + leftoverHeight / 2;
  const stackHeight = stackHeightUncentered;
  const baseY = stackStartY + stackHeight;

  const characterHeightBasis = Math.min(stackHeight, 700);
  const characterHeight = characterHeightBasis * SKETCH_LAYOUT.characterToPyramidHeightRatio;
  const characterMaxWidth = Math.max(60, (CANVAS_WIDTH - STACK_WIDTH) / 2 - 20);
  const characterTop = stackStartY + (stackHeight - characterHeight) / 2;

  const tiers = useMemo(
    () =>
      nodes.map((node, i) => {
        const y0 = stackStartY + i * (tierHeight + tierGap);
        const y1 = y0 + tierHeight;
        const widthAtTop = taper ? STACK_WIDTH - ((STACK_WIDTH - STACK_WIDTH * FUNNEL_BOTTOM_WIDTH_RATIO) * i) / nodes.length : STACK_WIDTH;
        const widthAtBottom = taper
          ? STACK_WIDTH - ((STACK_WIDTH - STACK_WIDTH * FUNNEL_BOTTOM_WIDTH_RATIO) * (i + 1)) / nodes.length
          : STACK_WIDTH;
        return { node, y0, y1, widthAtTop, widthAtBottom, cx: CANVAS_WIDTH / 2 };
      }),
    [nodes, stackStartY, tierHeight, tierGap, taper],
  );

  return (
    <>
      {topLabel && (
        <>
          <RoughRect x={CANVAS_WIDTH / 2 - STACK_WIDTH / 2} y={topLabelBoxTop} width={STACK_WIDTH} height={TOP_LABEL_HEIGHT} instant seed={10} />
          <NodeLabel x={CANVAS_WIDTH / 2 - STACK_WIDTH / 2} y={topLabelBoxTop} width={STACK_WIDTH} height={TOP_LABEL_HEIGHT} label={topLabel} baseFontSize={26} />
          {tiers.length > 0 && (
            <svg width={CANVAS_WIDTH} height={canvasHeight} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}>
              <Arrow from={{ x: CANVAS_WIDTH / 2, y: topLabelBoxTop + TOP_LABEL_HEIGHT }} to={{ x: CANVAS_WIDTH / 2, y: tiers[0]!.y0 }} color={SKETCH_COLORS.accentArrow} variant="straight" instant />
            </svg>
          )}
        </>
      )}

      <svg width={CANVAS_WIDTH} height={canvasHeight} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}>
        {tiers.map((t, i) => {
          if (taper) {
            // Trapezoid — the one shape family exception, and only because
            // a shrinking width IS the meaning for a funnel (a narrowing
            // quantity), unlike the old pyramid's taper which claimed a
            // ranking width doesn't convey.
            const cx = t.cx;
            const points: [number, number][] = [
              [cx - t.widthAtTop / 2, t.y0],
              [cx + t.widthAtTop / 2, t.y0],
              [cx + t.widthAtBottom / 2, t.y1],
              [cx - t.widthAtBottom / 2, t.y1],
            ];
            return <TrapezoidFill key={t.node.id} points={points} fill={emphasisFill(t.node.emphasis)} seed={100 + i} />;
          }
          return null;
        })}
        {!taper &&
          tiers.map((t, i) => <RoughRect key={t.node.id} x={t.cx - STACK_WIDTH / 2} y={t.y0} width={STACK_WIDTH} height={tierHeight} fill={emphasisFill(t.node.emphasis)} seed={100 + i} instant />)}
        {tiers.slice(0, -1).map((t, i) => {
          const next = tiers[i + 1]!;
          return <Arrow key={`arrow-${t.node.id}`} from={{ x: t.cx, y: t.y1 }} to={{ x: next.cx, y: next.y0 }} color={SKETCH_COLORS.accentArrow} variant="straight" instant seed={500 + i} />;
        })}
        {isCyclical && tiers.length > 1 && (
          <Arrow
            from={{ x: tiers[tiers.length - 1]!.cx + STACK_WIDTH / 2, y: tiers[tiers.length - 1]!.y0 + (tiers[tiers.length - 1]!.y1 - tiers[tiers.length - 1]!.y0) / 2 }}
            to={{ x: tiers[0]!.cx + STACK_WIDTH / 2, y: tiers[0]!.y0 + (tiers[0]!.y1 - tiers[0]!.y0) / 2 }}
            color={SKETCH_COLORS.accentArrow}
            variant="curved"
            curvature={0.35}
            instant
            seed={900}
          />
        )}
      </svg>

      {tiers.map((t) => (
        <React.Fragment key={t.node.id}>
          <NodeLabel
            x={t.cx - STACK_WIDTH / 2 + 40}
            y={t.y0}
            width={STACK_WIDTH - 80 - (t.node.insetImageUrl ? tierHeight * 0.7 + 16 : 0)}
            height={t.y1 - t.y0}
            label={t.node.label}
            baseFontSize={34}
          />
          {t.node.insetImageUrl && (
            <Img
              src={t.node.insetImageUrl}
              style={{
                position: "absolute",
                left: t.cx + STACK_WIDTH / 2 - tierHeight * 0.7 - 24,
                top: (t.y0 + t.y1) / 2 - (tierHeight * 0.7) / 2,
                width: tierHeight * 0.7,
                height: tierHeight * 0.7,
                objectFit: "contain",
              }}
            />
          )}
        </React.Fragment>
      ))}

      {bottomBanner && (
        <>
          <svg width={CANVAS_WIDTH} height={canvasHeight} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}>
            <rect x={CANVAS_WIDTH / 2 - 320} y={baseY + 30} width={640} height={70} fill={SKETCH_COLORS.panelFill} stroke={SKETCH_COLORS.ink} strokeWidth={5} />
          </svg>
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: baseY + 30 + 22,
              textAlign: "center",
              fontFamily: SKETCH_FONT_FAMILY,
              fontSize: 28,
              color: SKETCH_COLORS.ink,
            }}
          >
            {bottomBanner}
          </div>
        </>
      )}

      {leftCharacterSrc && (
        <Img
          src={leftCharacterSrc}
          style={{ position: "absolute", left: 20, top: characterTop, maxHeight: characterHeight, maxWidth: characterMaxWidth, width: "auto", height: "auto" }}
        />
      )}
      {rightCharacterSrc && kind === "pyramid" && (
        <Img
          src={rightCharacterSrc}
          style={{ position: "absolute", right: 20, top: characterTop, maxHeight: characterHeight, maxWidth: characterMaxWidth, width: "auto", height: "auto" }}
        />
      )}
    </>
  );
}

/** Trapezoid fill+stroke for funnel — the one non-rectangular node shape in
 * this library, and only because the taper itself is the meaning. */
function TrapezoidFill({ points, fill, seed }: { points: [number, number][]; fill: string; seed: number }) {
  const fillDrawable = roughGenerator.polygon(points, { fill, fillStyle: SKETCH_LINE.fillStyle, stroke: "none", seed: seed + 500 });
  const strokeDrawable = roughGenerator.polygon(points, { stroke: SKETCH_COLORS.ink, strokeWidth: SKETCH_LINE.strokeWidthThick, roughness: SKETCH_LINE.roughness, bowing: SKETCH_LINE.bowing, seed });
  return (
    <g>
      {drawableToPaths(fillDrawable)
        .filter((p) => p.fill)
        .map((p, i) => (
          <path key={`f${i}`} d={p.d} fill={p.fill} stroke="none" />
        ))}
      {drawableToPaths(strokeDrawable).map((p, i) => (
        <RevealPath key={`s${i}`} d={p.d} stroke={p.stroke} strokeWidth={p.strokeWidth} startFrame={0} instant />
      ))}
    </g>
  );
}

function RingLayout({ title, nodes }: NodeSequenceDiagramProps) {
  const { height: canvasHeight } = useVideoConfig();
  const cx = CANVAS_WIDTH / 2;
  const cy = Math.min(canvasHeight, 1400) * 0.52 + 100;
  const radius = Math.min(CANVAS_WIDTH, canvasHeight * 0.6) * 0.36;
  const nodeSize = Math.max(140, Math.min(220, (2 * Math.PI * radius) / nodes.length - 40));

  const positions = nodes.map((node, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / nodes.length;
    return { node, x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle), angle };
  });

  return (
    <>
      <svg width={CANVAS_WIDTH} height={canvasHeight} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}>
        {positions.map((p, i) => {
          const next = positions[(i + 1) % positions.length]!;
          // Shrink each end toward the node's own edge so the arrow doesn't
          // visually originate/terminate inside the filled ellipse.
          const dx = next.x - p.x;
          const dy = next.y - p.y;
          const dist = Math.hypot(dx, dy) || 1;
          const fromX = p.x + (dx / dist) * (nodeSize / 2 + 10);
          const fromY = p.y + (dy / dist) * (nodeSize / 2 + 10);
          const toX = next.x - (dx / dist) * (nodeSize / 2 + 10);
          const toY = next.y - (dy / dist) * (nodeSize / 2 + 10);
          return <Arrow key={`ring-arrow-${p.node.id}`} from={{ x: fromX, y: fromY }} to={{ x: toX, y: toY }} color={SKETCH_COLORS.accentArrow} variant="curved" curvature={0.22} instant seed={500 + i} />;
        })}
      </svg>
      {positions.map((p, i) => (
        <RoughEllipse key={p.node.id} cx={p.x} cy={p.y} width={nodeSize} height={nodeSize} fill={emphasisFill(p.node.emphasis)} instant seed={100 + i} />
      ))}
      {positions.map((p) => (
        <NodeLabel key={`label-${p.node.id}`} x={p.x - nodeSize / 2 + 12} y={p.y - nodeSize / 2 + 12} width={nodeSize - 24} height={nodeSize - 24} label={p.node.label} baseFontSize={24} />
      ))}
      {title && <div style={{ position: "absolute", left: cx - 200, top: cy - 30, width: 400, textAlign: "center", fontFamily: SKETCH_FONT_FAMILY, fontSize: 26, color: SKETCH_COLORS.ink }}>{title}</div>}
    </>
  );
}

function HubLayout({ centerLabel, nodes }: NodeSequenceDiagramProps) {
  const { height: canvasHeight } = useVideoConfig();
  const cx = CANVAS_WIDTH / 2;
  const cy = Math.min(canvasHeight, 1400) * 0.5 + 100;
  const hubSize = 220;
  const spokeRadius = Math.min(CANVAS_WIDTH, canvasHeight * 0.55) * 0.4;
  const nodeWidth = 220;
  const nodeHeight = Math.max(90, Math.min(140, (2 * Math.PI * spokeRadius) / nodes.length - 30));

  const positions = nodes.map((node, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / nodes.length;
    return { node, x: cx + spokeRadius * Math.cos(angle), y: cy + spokeRadius * Math.sin(angle) };
  });

  return (
    <>
      <svg width={CANVAS_WIDTH} height={canvasHeight} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}>
        {positions.map((p) => (
          <SpokeLine key={`spoke-${p.node.id}`} x1={cx} y1={cy} x2={p.x} y2={p.y} seed={p.node.id.length} />
        ))}
      </svg>
      <RoughEllipse cx={cx} cy={cy} width={hubSize} height={hubSize} fill={SKETCH_COLORS.panelFill} instant seed={1} strokeWidth={6} />
      {centerLabel && <NodeLabel x={cx - hubSize / 2 + 16} y={cy - hubSize / 2 + 16} width={hubSize - 32} height={hubSize - 32} label={centerLabel} baseFontSize={24} />}
      {positions.map((p, i) => (
        <RoughRect key={p.node.id} x={p.x - nodeWidth / 2} y={p.y - nodeHeight / 2} width={nodeWidth} height={nodeHeight} fill={emphasisFill(p.node.emphasis)} instant seed={100 + i} />
      ))}
      {positions.map((p) => (
        <NodeLabel key={`label-${p.node.id}`} x={p.x - nodeWidth / 2 + 10} y={p.y - nodeHeight / 2 + 6} width={nodeWidth - 20} height={nodeHeight - 12} label={p.node.label} baseFontSize={22} />
      ))}
    </>
  );
}

function RowLayout({ nodes }: NodeSequenceDiagramProps) {
  const { height: canvasHeight } = useVideoConfig();
  const top = 260;
  const height = Math.min(canvasHeight - top - 260, 900);
  const gap = 40;
  const width = Math.min(420, (CANVAS_WIDTH - 80 - gap * (nodes.length - 1)) / nodes.length);
  const totalWidth = nodes.length * width + (nodes.length - 1) * gap;
  const startX = (CANVAS_WIDTH - totalWidth) / 2;

  const boxes = nodes.map((node, i) => ({ node, x: startX + i * (width + gap), y: top }));

  return (
    <>
      {boxes.map((b, i) => (
        <RoughRect key={b.node.id} x={b.x} y={b.y} width={width} height={height} fill={emphasisFill(b.node.emphasis)} instant seed={100 + i} />
      ))}
      {boxes.map((b) => (
        <NodeLabel key={`label-${b.node.id}`} x={b.x + 20} y={b.y + height / 2 - 60} width={width - 40} height={120} label={b.node.label} baseFontSize={28} />
      ))}
      {boxes.length === 2 && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: top + height / 2,
            transform: "translate(-50%, -50%) rotate(-6deg)",
            width: 108,
            height: 108,
            borderRadius: "50%",
            border: `3px solid ${SKETCH_COLORS.ink}`,
            outline: `3px solid ${SKETCH_COLORS.panelFill}`,
            outlineOffset: 5,
            boxShadow: `0 4px 0 ${SKETCH_COLORS.ink}`,
            background: SKETCH_COLORS.signalRed,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: SKETCH_FONT_FAMILY,
            fontSize: 34,
            letterSpacing: 1,
            color: SKETCH_COLORS.panelFill,
          }}
        >
          VS
        </div>
      )}
    </>
  );
}

export function NodeSequenceDiagram(props: NodeSequenceDiagramProps) {
  const layout = props.kind === "cycle" ? "ring" : props.kind === "radial" ? "hub" : props.kind === "comparison" ? "row" : "stack";
  return (
    <AbsoluteFill style={{ backgroundColor: SKETCH_COLORS.paper }}>
      <style>{sketchFontFaceCss}</style>
      {/* Ring layout writes its title inside the ring itself (matching the
          reference "Creative Process" circular-diagram convention) — a
          second top-of-frame title would just duplicate it. */}
      {layout !== "ring" && <DiagramTitle title={props.title} />}
      {layout === "stack" && <StackLayout {...props} />}
      {layout === "ring" && <RingLayout {...props} />}
      {layout === "hub" && <HubLayout {...props} />}
      {layout === "row" && <RowLayout {...props} />}
    </AbsoluteFill>
  );
}
