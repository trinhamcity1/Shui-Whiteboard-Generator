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

/** How far a prop has spun (degrees) once its drift has actually started — 0 before then, so it doesn't spin while invisible/waiting on its delay. */
export function computePropRotation(frame: number, startFrame: number, delayFrames: number, fps: number, rotateSpeedDegPerSec: number): number {
  const driftStart = startFrame + delayFrames;
  if (frame <= driftStart) return 0;
  return ((frame - driftStart) / fps) * rotateSpeedDegPerSec;
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
  const rotation = computePropRotation(frame, startFrame, delayFrames, fps, prop.rotateSpeedDegPerSec);

  return (
    <div
      style={{
        position: "absolute",
        left: prop.startX * frameWidth + dx,
        top: prop.startY * frameHeight + dy,
        fontSize: prop.sizePx,
        opacity,
        transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
        filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.25))",
      }}
    >
      {PROP_GLYPH[prop.kind]}
    </div>
  );
}

/** Two staggered expanding-ring shockwaves at the beat's entrance — cheap, always-on polish that shouldn't depend on the planner remembering to ask for it. */
function ImpactRings({ startFrame }: { startFrame: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const relativeFrame = frame - startFrame;
  const ringLifeFrames = Math.round(fps * 0.5);

  const ring = (delayFrames: number) => {
    const t = relativeFrame - delayFrames;
    if (t < 0 || t > ringLifeFrames) return null;
    const progress = t / ringLifeFrames;
    const scale = 0.2 + progress * 2.3;
    const opacity = 1 - progress;
    return (
      <div
        key={delayFrames}
        style={{
          position: "absolute",
          left: "50%",
          top: "48%",
          width: 140,
          height: 140,
          borderRadius: "50%",
          border: "3px solid rgba(255,255,255,0.65)",
          transform: `translate(-50%, -50%) scale(${scale})`,
          opacity,
        }}
      />
    );
  };

  return (
    <>
      {ring(0)}
      {ring(Math.round(fps * 0.12))}
    </>
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
  const entranceScale = interpolate(relativeFrame, [0, entranceFrames], [0.4, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const entranceRotation = interpolate(relativeFrame, [0, entranceFrames], [-35, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const productOpacity = interpolate(relativeFrame, [0, Math.round(fps * 0.25)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // A continuous, gentle bob/wobble once the entrance settles — a hero
  // object that goes perfectly still after entering reads as a static
  // product photo with extra steps; a slow idle loop is what actually
  // sells "glossy commercial," not just the entrance itself.
  const idleT = Math.max(0, relativeFrame - entranceFrames) / fps;
  const idleBobY = Math.sin(idleT * Math.PI * 0.9) * 10;
  const idleWobbleDeg = Math.sin(idleT * Math.PI * 0.7) * 3;
  const scale = entranceScale;
  const rotation = entranceRotation + idleWobbleDeg;

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

      <ImpactRings startFrame={startFrame} />

      {spec.cutoutUrl && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "48%",
            width: "56%",
            transform: `translate(-50%, calc(-50% + ${idleBobY}px)) scale(${scale}) rotate(${rotation}deg)`,
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
