import React from "react";
import { roughGenerator, drawableToPaths } from "./roughPath";
import { RevealPath } from "./RevealPath";
import { SKETCH_LINE, SKETCH_COLORS } from "../sketchStyle";

interface GroundProps {
  x: number;
  y: number;
  width: number;
  color?: string;
  startFrame?: number;
  instant?: boolean;
  seed?: number;
}

/** Small grass tufts along a ground line — what makes a character/prop sit ON the board instead of floating. */
export function GroundTufts({ x, y, width, color = SKETCH_COLORS.leafGreen, startFrame = 0, instant, seed = 1 }: GroundProps) {
  const count = Math.max(3, Math.round(width / 40));
  const paths: React.ReactNode[] = [];
  for (let i = 0; i < count; i++) {
    const tx = x + (i + 0.5) * (width / count);
    const drawable = roughGenerator.linearPath(
      [
        [tx - 6, y],
        [tx - 2, y - 10],
        [tx, y],
        [tx + 3, y - 12],
        [tx + 6, y],
      ],
      { stroke: color, strokeWidth: SKETCH_LINE.strokeWidthThin * 1.5, roughness: SKETCH_LINE.roughness, seed: seed + i },
    );
    for (const p of drawableToPaths(drawable)) {
      paths.push(<RevealPath key={i} d={p.d} stroke={p.stroke} strokeWidth={p.strokeWidth} startFrame={startFrame} revealFrames={10} instant={instant} />);
    }
  }
  return <g>{paths}</g>;
}

/** A row of simple rounded bush shapes along a ground line. */
export function Bushes({ x, y, width, color = SKETCH_COLORS.leafGreen, startFrame = 0, instant, seed = 1 }: GroundProps) {
  const count = Math.max(1, Math.round(width / 90));
  const bushW = width / count;
  const elements: React.ReactNode[] = [];
  for (let i = 0; i < count; i++) {
    const cx = x + i * bushW + bushW / 2;
    const r = bushW * 0.42;
    const drawable = roughGenerator.ellipse(cx, y - r * 0.7, r * 2, r * 1.4, {
      stroke: SKETCH_COLORS.ink,
      fill: color,
      fillStyle: SKETCH_LINE.fillStyle,
      strokeWidth: SKETCH_LINE.strokeWidthThin * 1.4,
      roughness: SKETCH_LINE.roughness,
      seed: seed + i,
    });
    const paths = drawableToPaths(drawable);
    const fillPath = paths.find((p) => p.fill);
    if (fillPath) elements.push(<path key={`f${i}`} d={fillPath.d} fill={color} stroke="none" opacity={instant ? 1 : undefined} />);
    for (const p of paths.filter((p) => !p.fill)) {
      elements.push(<RevealPath key={`s${i}`} d={p.d} stroke={p.stroke} strokeWidth={p.strokeWidth} startFrame={startFrame + i * 4} revealFrames={14} instant={instant} />);
    }
  }
  return <g>{elements}</g>;
}

/** A small flat shadow ellipse under a character/prop — grounds it visually against the paper. */
export function ShadowEllipse({ x, y, width, color = "rgba(29,29,27,0.14)" }: { x: number; y: number; width: number; color?: string }) {
  return <ellipse cx={x} cy={y} rx={width / 2} ry={width / 7} fill={color} stroke="none" />;
}
