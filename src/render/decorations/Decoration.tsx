import React from "react";
import { useVideoConfig } from "remotion";
import { Arrow } from "./Arrow";
import { XMark, Checkmark, RadiatingStrokes, CircledScribble, UnderlineSwash, Sparkle, MotionDashes } from "./EmphasisMarks";
import { BannerRibbon, Scroll, ThoughtBubble, SpeechBubble, WobbleFrame, TornPaperEdge } from "./Containers";
import { GroundTufts, Bushes, ShadowEllipse } from "./Environmental";
import type { DecorationSpec } from "../../schema/scene";
import { SKETCH_COLORS } from "../sketchStyle";

/**
 * Dispatches one DecorationSpec (the planner/schema-level description) to
 * its concrete SVG component. This is the only place that needs to know
 * both the schema shape and the component prop shapes — every decoration
 * component itself stays a plain, schema-agnostic React component
 * (Part I/Workstream 2: owned, recolorable, parameterized primitives).
 */
export function Decoration({ spec, instant }: { spec: DecorationSpec; instant?: boolean }) {
  const { fps } = useVideoConfig();
  const startFrame = Math.round((spec.revealAtSeconds ?? 0) * fps);
  const x = spec.x ?? 0;
  const y = spec.y ?? 0;

  switch (spec.kind) {
    case "arrowCurved":
    case "arrowStraight":
    case "arrowJagged":
    case "arrowDashed":
      return (
        <Arrow
          from={{ x, y }}
          to={{ x: spec.toX ?? x + 100, y: spec.toY ?? y }}
          color={spec.color ?? SKETCH_COLORS.signalRed}
          variant={spec.kind === "arrowCurved" ? "curved" : spec.kind === "arrowStraight" ? "straight" : spec.kind === "arrowJagged" ? "jagged" : "dashed"}
          startFrame={startFrame}
          instant={instant}
        />
      );
    case "xMark":
      return <XMark x={x} y={y} size={spec.size} color={spec.color} startFrame={startFrame} instant={instant} />;
    case "checkmark":
      return <Checkmark x={x} y={y} size={spec.size} color={spec.color} startFrame={startFrame} instant={instant} />;
    case "radiatingStrokes":
      return <RadiatingStrokes x={x} y={y} size={spec.size} color={spec.color} startFrame={startFrame} instant={instant} />;
    case "circledScribble":
      return <CircledScribble x={x} y={y} size={spec.size} color={spec.color} startFrame={startFrame} instant={instant} />;
    case "underlineSwash":
      return <UnderlineSwash x={x} y={y} width={spec.width ?? 100} color={spec.color} startFrame={startFrame} instant={instant} />;
    case "sparkle":
      return <Sparkle x={x} y={y} size={spec.size} color={spec.color} startFrame={startFrame} instant={instant} />;
    case "motionDashes":
      return <MotionDashes x={x} y={y} size={spec.size} color={spec.color} startFrame={startFrame} instant={instant} />;
    case "bannerRibbon":
      return <BannerRibbon x={x} y={y} width={spec.width ?? 200} height={spec.height ?? 70} color={spec.color} fill={spec.fill} startFrame={startFrame} instant={instant} />;
    case "scroll":
      return <Scroll x={x} y={y} width={spec.width ?? 160} height={spec.height ?? 220} color={spec.color} fill={spec.fill} hasSeal={spec.hasSeal} startFrame={startFrame} instant={instant} />;
    case "thoughtBubble":
      return <ThoughtBubble x={x} y={y} width={spec.width ?? 160} height={spec.height ?? 100} color={spec.color} fill={spec.fill} startFrame={startFrame} instant={instant} />;
    case "speechBubble":
      return <SpeechBubble x={x} y={y} width={spec.width ?? 160} height={spec.height ?? 90} color={spec.color} fill={spec.fill} startFrame={startFrame} instant={instant} />;
    case "wobbleFrame":
      return <WobbleFrame x={x} y={y} width={spec.width ?? 200} height={spec.height ?? 140} color={spec.color} fill={spec.fill} startFrame={startFrame} instant={instant} />;
    case "tornPaperEdge":
      return <TornPaperEdge x={x} y={y} width={spec.width ?? 300} height={spec.height ?? 30} color={spec.color} fill={spec.fill} startFrame={startFrame} instant={instant} />;
    case "groundTufts":
      return <GroundTufts x={x} y={y} width={spec.width ?? 200} color={spec.color} startFrame={startFrame} instant={instant} />;
    case "bushes":
      return <Bushes x={x} y={y} width={spec.width ?? 200} color={spec.color} startFrame={startFrame} instant={instant} />;
    case "shadowEllipse":
      return <ShadowEllipse x={x} y={y} width={spec.width ?? 120} color={spec.color} />;
    default:
      return null;
  }
}

/** Renders a list of decorations inside an absolutely-positioned full-bleed SVG overlay — the standard way any scene/template overlays its decoration set on top of its own content. */
export function DecorationLayer({ decorations, width = 1080, height = 1920, instant }: { decorations?: DecorationSpec[]; width?: number; height?: number; instant?: boolean }) {
  if (!decorations || decorations.length === 0) return null;
  return (
    <svg width={width} height={height} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }} viewBox={`0 0 ${width} ${height}`}>
      {decorations.map((d, i) => (
        <Decoration key={i} spec={d} instant={instant} />
      ))}
    </svg>
  );
}
