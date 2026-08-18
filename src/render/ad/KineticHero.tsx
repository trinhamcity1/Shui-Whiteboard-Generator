import React from "react";
import { AbsoluteFill, Img, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { KineticHeroSpec, KineticProp } from "../../schema/ad";

const PROP_GLYPH: Record<KineticProp["kind"], string> = {
  "citrus-slice": "\u{1F34A}",
  "ice-cube": "\u{1F9CA}",
  leaf: "\u{1F343}",
  droplet: "\u{1F4A7}",
  sparkle: "✨",
  bubble: "\u{1FAE7}",
  wisp: "\u{1F4A8}",
  "star-burst": "\u{1F31F}",
  petal: "\u{1F338}",
  flame: "\u{1F525}",
};

/**
 * Pure math for a prop's current (x, y) offset in pixels — split out for
 * unit testing the same way computeKenBurnsScale is. A prop fades/drifts
 * outward from its start position along driftAngleDeg, holding once it
 * reaches driftDistancePx, mirroring the reference video's "burst outward
 * from center, then settle" motion.
 */
export function computePropOffset(
  frame: number,
  startFrame: number,
  durationInFrames: number,
  delayFrames: number,
  driftAngleDeg: number,
  driftDistancePx: number,
): { dx: number; dy: number; opacity: number } {
  const driftStart = startFrame + delayFrames;
  const driftEnd = driftStart + Math.round(durationInFrames * 0.6);
  const progress = interpolate(frame, [driftStart, driftEnd], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = interpolate(frame, [driftStart, driftStart + Math.round(durationInFrames * 0.15)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const angleRad = (driftAngleDeg * Math.PI) / 180;
  return {
    dx: Math.cos(angleRad) * driftDistancePx * progress,
    dy: Math.sin(angleRad) * driftDistancePx * progress,
    opacity,
  };
}

function PropView({ prop, startFrame, durationInFrames, frameWidth, frameHeight }: {
  prop: KineticProp;
  startFrame: number;
  durationInFrames: number;
  frameWidth: number;
  frameHeight: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const delayFrames = Math.round(prop.delaySeconds * fps);
  const { dx, dy, opacity } = computePropOffset(frame, startFrame, durationInFrames, delayFrames, prop.driftAngleDeg, prop.driftDistancePx);

  return (
    <div
      style={{
        position: "absolute",
        left: prop.startX * frameWidth + dx,
        top: prop.startY * frameHeight + dy,
        fontSize: prop.sizePx,
        opacity,
        transform: "translate(-50%, -50%)",
        filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.25))",
      }}
    >
      {PROP_GLYPH[prop.kind]}
    </div>
  );
}

interface KineticHeroProps {
  spec: KineticHeroSpec;
  startFrame: number;
  durationInFrames: number;
}

/**
 * The glossy commercial-promo visual style: a gradient background, the
 * product's background-removed cutout entering with a spin/scale, floating
 * decorative props bursting outward around it, and a bold kinetic title —
 * modeled on the real "FRESH ORANGE" juice-bottle reference (solid-color
 * background, spinning bottle entrance, floating citrus/ice/splash props,
 * big drop-shadowed title).
 */
export function KineticHero({ spec, startFrame, durationInFrames }: KineticHeroProps) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const relativeFrame = frame - startFrame;

  const entranceFrames = Math.round(fps * 0.6);
  const scale = interpolate(relativeFrame, [0, entranceFrames], [0.4, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const rotation = interpolate(relativeFrame, [0, entranceFrames], [-35, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const productOpacity = interpolate(relativeFrame, [0, Math.round(fps * 0.25)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const titleDelayFrames = entranceFrames + Math.round(fps * 0.15);
  const titleOpacity = interpolate(relativeFrame, [titleDelayFrames, titleDelayFrames + Math.round(fps * 0.3)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const titleScale = interpolate(relativeFrame, [titleDelayFrames, titleDelayFrames + Math.round(fps * 0.3)], [0.7, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(160deg, ${spec.backgroundColorFrom}, ${spec.backgroundColorTo})`,
        overflow: "hidden",
      }}
    >
      {spec.props.map((prop, i) => (
        <PropView key={i} prop={prop} startFrame={startFrame} durationInFrames={durationInFrames} frameWidth={width} frameHeight={height} />
      ))}

      {spec.cutoutUrl && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "48%",
            width: "56%",
            transform: `translate(-50%, -50%) scale(${scale}) rotate(${rotation}deg)`,
            opacity: productOpacity,
            filter: "drop-shadow(0 20px 30px rgba(0,0,0,0.35))",
          }}
        >
          <Img src={spec.cutoutUrl} style={{ width: "100%", display: "block" }} />
        </div>
      )}

      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: "10%",
          transform: `translateX(-50%) scale(${titleScale})`,
          opacity: titleOpacity,
          fontFamily: "Helvetica, Arial, sans-serif",
          fontWeight: 900,
          fontSize: 56,
          color: "#ffffff",
          textAlign: "center",
          textShadow: "0 4px 0 rgba(0,0,0,0.25), 0 10px 20px rgba(0,0,0,0.3)",
          letterSpacing: 1,
          whiteSpace: "nowrap",
        }}
      >
        {spec.title.toUpperCase()}
      </div>
    </AbsoluteFill>
  );
}
