import React from "react";
import { roughGenerator, drawableToPaths } from "./roughPath";
import { RevealPath } from "./RevealPath";
import { SKETCH_LINE, SKETCH_COLORS, SKETCH_LAYOUT } from "../sketchStyle";

interface BoxProps {
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
  fill?: string;
  startFrame?: number;
  instant?: boolean;
  seed?: number;
}

function FillThenStroke({
  fillPoints,
  strokeDrawable,
  fill,
  startFrame,
  instant,
}: {
  fillPoints?: [number, number][];
  fillColor?: string;
  strokeDrawable: ReturnType<typeof roughGenerator.polygon>;
  fill?: string;
  startFrame: number;
  instant?: boolean;
}) {
  const paths = drawableToPaths(strokeDrawable);
  return (
    <g>
      {fill &&
        fillPoints &&
        (() => {
          const fillDrawable = roughGenerator.polygon(fillPoints, { fill, fillStyle: "solid", stroke: "none" });
          return drawableToPaths(fillDrawable)
            .filter((p) => p.fill)
            .map((p, i) => <path key={`fill-${i}`} d={p.d} fill={p.fill} stroke="none" />);
        })()}
      {paths.map((p, i) => (
        <RevealPath key={i} d={p.d} stroke={p.stroke} strokeWidth={p.strokeWidth} startFrame={startFrame} revealFrames={20} instant={instant} />
      ))}
    </g>
  );
}

/** A tapered ribbon-banner hexagon (pointed left/right ends) — the title device (Part I §6). */
export function BannerRibbon({ x, y, width, height, color = SKETCH_COLORS.ink, fill = SKETCH_COLORS.panelFill, startFrame = 0, instant, seed = 1 }: BoxProps) {
  const notch = width * SKETCH_LAYOUT.ribbonNotchRatio;
  const yc = y + height / 2;
  const points: [number, number][] = [
    [x + notch, y],
    [x + width - notch, y],
    [x + width, yc],
    [x + width - notch, y + height],
    [x + notch, y + height],
    [x, yc],
  ];
  const drawable = roughGenerator.polygon(points, {
    stroke: color,
    strokeWidth: SKETCH_LINE.strokeWidthThick,
    roughness: SKETCH_LINE.roughness,
    bowing: SKETCH_LINE.bowing,
    seed,
  });
  return <FillThenStroke fillPoints={points} strokeDrawable={drawable} fill={fill} startFrame={startFrame} instant={instant} />;
}

/** A curled-top-and-bottom parchment scroll — documents, constitutions. */
export function Scroll({ x, y, width, height, color = SKETCH_COLORS.ink, fill = SKETCH_COLORS.earth.parchment, startFrame = 0, instant, seed = 1, hasSeal = false }: BoxProps & { hasSeal?: boolean }) {
  const curl = height * 0.12;
  const points: [number, number][] = [
    [x, y + curl],
    [x + width, y + curl],
    [x + width, y + height - curl],
    [x, y + height - curl],
  ];
  const bodyDrawable = roughGenerator.rectangle(x, y + curl, width, height - curl * 2, {
    stroke: color,
    strokeWidth: SKETCH_LINE.strokeWidthThick,
    roughness: SKETCH_LINE.roughness,
    bowing: SKETCH_LINE.bowing,
    seed,
  });
  const topCurl = roughGenerator.ellipse(x + width / 2, y + curl, width, curl * 2, {
    stroke: color,
    fill,
    fillStyle: "solid",
    strokeWidth: SKETCH_LINE.strokeWidthThin * 1.5,
    roughness: SKETCH_LINE.roughness,
    seed: seed + 1,
  });
  const bottomCurl = roughGenerator.ellipse(x + width / 2, y + height - curl, width, curl * 2, {
    stroke: color,
    fill,
    fillStyle: "solid",
    strokeWidth: SKETCH_LINE.strokeWidthThin * 1.5,
    roughness: SKETCH_LINE.roughness,
    seed: seed + 2,
  });

  return (
    <g>
      <path d={drawableToPaths(topCurl).find((p) => p.fill)?.d} fill={fill} stroke="none" />
      <path d={drawableToPaths(bottomCurl).find((p) => p.fill)?.d} fill={fill} stroke="none" />
      <rect x={x} y={y + curl} width={width} height={height - curl * 2} fill={fill} stroke="none" />
      {drawableToPaths(bodyDrawable).map((p, i) => (
        <RevealPath key={`b${i}`} d={p.d} stroke={p.stroke} strokeWidth={p.strokeWidth} startFrame={startFrame} revealFrames={22} instant={instant} />
      ))}
      {drawableToPaths(topCurl)
        .filter((p) => !p.fill)
        .map((p, i) => (
          <RevealPath key={`t${i}`} d={p.d} stroke={p.stroke} strokeWidth={p.strokeWidth} startFrame={startFrame} revealFrames={14} instant={instant} />
        ))}
      {drawableToPaths(bottomCurl)
        .filter((p) => !p.fill)
        .map((p, i) => (
          <RevealPath key={`bc${i}`} d={p.d} stroke={p.stroke} strokeWidth={p.strokeWidth} startFrame={startFrame} revealFrames={14} instant={instant} />
        ))}
      {hasSeal && (
        <circle
          cx={x + width - 28}
          cy={y + height - curl - 14}
          r={14}
          fill={SKETCH_COLORS.signalRed}
          stroke={color}
          strokeWidth={1.5}
          opacity={instant ? 1 : undefined}
        />
      )}
    </g>
  );
}

/** A cloud-shaped bubble with trailing dots — thinking, not speaking. */
export function ThoughtBubble({ x, y, width, height, color = SKETCH_COLORS.ink, fill = SKETCH_COLORS.panelFill, startFrame = 0, instant, seed = 1 }: BoxProps) {
  const drawable = roughGenerator.ellipse(x + width / 2, y + height / 2, width, height, {
    stroke: color,
    strokeWidth: SKETCH_LINE.strokeWidthThin * 1.6,
    roughness: SKETCH_LINE.roughness * 1.3,
    bowing: SKETCH_LINE.bowing,
    seed,
  });
  const tailY = y + height + 10;
  return (
    <g>
      <ellipse cx={x + width / 2} cy={y + height / 2} rx={width / 2} ry={height / 2} fill={fill} stroke="none" />
      {drawableToPaths(drawable)
        .filter((p) => !p.fill)
        .map((p, i) => (
          <RevealPath key={i} d={p.d} stroke={p.stroke} strokeWidth={p.strokeWidth} startFrame={startFrame} revealFrames={18} instant={instant} />
        ))}
      <circle cx={x + width / 2 - 18} cy={tailY} r={7} fill={fill} stroke={color} strokeWidth={1.5} opacity={instant ? 1 : undefined} />
      <circle cx={x + width / 2 - 30} cy={tailY + 12} r={4} fill={fill} stroke={color} strokeWidth={1.2} opacity={instant ? 1 : undefined} />
    </g>
  );
}

/** A rounded bubble with a pointed tail — speaking. */
export function SpeechBubble({ x, y, width, height, color = SKETCH_COLORS.ink, fill = SKETCH_COLORS.panelFill, startFrame = 0, instant, seed = 1 }: BoxProps) {
  const drawable = roughGenerator.rectangle(x, y, width, height, {
    stroke: color,
    strokeWidth: SKETCH_LINE.strokeWidthThin * 1.6,
    roughness: SKETCH_LINE.roughness,
    bowing: SKETCH_LINE.bowing,
    seed,
  });
  const tailPoints: [number, number][] = [
    [x + width / 2 - 14, y + height],
    [x + width / 2 - 24, y + height + 20],
    [x + width / 2 + 4, y + height],
  ];
  const tailDrawable = roughGenerator.polygon(tailPoints, { stroke: color, fill, fillStyle: "solid", strokeWidth: SKETCH_LINE.strokeWidthThin * 1.4, roughness: SKETCH_LINE.roughness, seed: seed + 1 });
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={fill} stroke="none" />
      <path d={drawableToPaths(tailDrawable).find((p) => p.fill)?.d} fill={fill} stroke="none" />
      {drawableToPaths(drawable).map((p, i) => (
        <RevealPath key={`r${i}`} d={p.d} stroke={p.stroke} strokeWidth={p.strokeWidth} startFrame={startFrame} revealFrames={16} instant={instant} />
      ))}
      {drawableToPaths(tailDrawable)
        .filter((p) => !p.fill)
        .map((p, i) => (
          <RevealPath key={`t${i}`} d={p.d} stroke={p.stroke} strokeWidth={p.strokeWidth} startFrame={startFrame + 10} revealFrames={8} instant={instant} />
        ))}
    </g>
  );
}

/** A wobble-edged rectangular frame — a container with no meaning beyond "here's a grouped area." */
export function WobbleFrame({ x, y, width, height, color = SKETCH_COLORS.ink, fill, startFrame = 0, instant, seed = 1 }: BoxProps) {
  const points: [number, number][] = [
    [x, y],
    [x + width, y],
    [x + width, y + height],
    [x, y + height],
  ];
  const drawable = roughGenerator.polygon(points, {
    stroke: color,
    strokeWidth: SKETCH_LINE.strokeWidthThick,
    roughness: SKETCH_LINE.roughness,
    bowing: SKETCH_LINE.bowing,
    seed,
  });
  return <FillThenStroke fillPoints={points} strokeDrawable={drawable} fill={fill} startFrame={startFrame} instant={instant} />;
}

/** An irregular torn-paper edge along the bottom of a rectangular region — the "broken law" style beat. */
export function TornPaperEdge({ x, y, width, height, color = SKETCH_COLORS.ink, fill = SKETCH_COLORS.paper, startFrame = 0, instant, seed = 1 }: BoxProps) {
  const teeth = 10;
  const toothW = width / teeth;
  const points: [number, number][] = [[x, y]];
  for (let i = 0; i <= teeth; i++) {
    const tx = x + i * toothW;
    const ty = y + height + (i % 2 === 0 ? 0 : -height * 0.12);
    points.push([tx, ty]);
  }
  points.push([x + width, y]);
  const drawable = roughGenerator.polygon(points, {
    stroke: color,
    strokeWidth: SKETCH_LINE.strokeWidthThin * 1.6,
    roughness: SKETCH_LINE.roughness * 1.5,
    bowing: SKETCH_LINE.bowing,
    seed,
  });
  return <FillThenStroke fillPoints={points} strokeDrawable={drawable} fill={fill} startFrame={startFrame} instant={instant} />;
}
