import React from "react";
import { AbsoluteFill, Img, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { KineticHeroSpec, KineticProp } from "../../schema/ad";
import { AD_TITLE_FONT_FAMILY, adTitleFontFaceCss } from "./adFont";

/**
 * Purpose-built glossy CSS shapes, one per prop kind — replaces an
 * earlier emoji-glyph version. Emoji render as flat OS text characters
 * no matter how many are on screen or how fast they spin; that was the
 * single biggest "this looks cheap" tell against the glossy-commercial
 * reference, more than density or motion ever were. Every shape below is
 * pure CSS (gradients/clip-path/blur), so it costs nothing extra to
 * render and stays fully data-driven from KineticPropKind.
 */
function PropShape({ kind, sizePx }: { kind: KineticProp["kind"]; sizePx: number }) {
  const glow = (color: string) => `drop-shadow(0 0 ${sizePx * 0.35}px ${color})`;

  switch (kind) {
    case "citrus-slice":
      return (
        <div
          style={{
            width: sizePx,
            height: sizePx,
            borderRadius: "50%",
            background:
              "radial-gradient(circle at 32% 28%, #fff3d0 0%, #ffcf5c 18%, #ffb020 55%, #ff8a00 100%)",
            filter: glow("#ffb02088"),
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: "18%",
              borderRadius: "50%",
              background: `repeating-conic-gradient(#fff8e6 0deg 8deg, transparent 8deg 45deg)`,
              opacity: 0.8,
            }}
          />
        </div>
      );
    case "ice-cube":
      return (
        <div
          style={{
            width: sizePx,
            height: sizePx,
            borderRadius: sizePx * 0.18,
            background: "linear-gradient(135deg, #f2fcff 0%, #cdeffa 45%, #8fd8ee 75%, #63c3e0 100%)",
            filter: glow("#8fd8ee99"),
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "10%",
              left: "15%",
              width: "22%",
              height: "70%",
              background: "rgba(255,255,255,0.85)",
              borderRadius: "40%",
              transform: "rotate(20deg)",
            }}
          />
        </div>
      );
    case "leaf":
      return (
        <div
          style={{
            width: sizePx,
            height: sizePx * 1.15,
            borderRadius: "0% 100% 0% 100%",
            background: "linear-gradient(140deg, #d9f2a0 0%, #8fce4e 55%, #4f9e2c 100%)",
            filter: glow("#8fce4e88"),
          }}
        />
      );
    case "petal":
      return (
        <div
          style={{
            width: sizePx,
            height: sizePx * 1.2,
            borderRadius: "0% 100% 0% 100%",
            background: "linear-gradient(140deg, #ffe3f2 0%, #ff9fc6 55%, #ff5fa0 100%)",
            filter: glow("#ff9fc688"),
          }}
        />
      );
    case "droplet":
      return (
        <div
          style={{
            width: sizePx,
            height: sizePx,
            borderRadius: "50% 50% 50% 0%",
            transform: "rotate(-45deg)",
            background: "radial-gradient(circle at 35% 30%, #eaf9ff 0%, #7fd2f2 45%, #2c9bd6 100%)",
            filter: glow("#7fd2f288"),
          }}
        />
      );
    case "bubble":
      return (
        <div
          style={{
            width: sizePx,
            height: sizePx,
            borderRadius: "50%",
            background: "radial-gradient(circle at 32% 28%, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.25) 25%, rgba(180,225,255,0.18) 70%)",
            border: "1.5px solid rgba(255,255,255,0.6)",
            filter: glow("#ffffff55"),
          }}
        />
      );
    case "wisp":
      return (
        <div
          style={{
            width: sizePx * 1.8,
            height: sizePx * 0.5,
            borderRadius: "50%",
            background: "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.85) 50%, rgba(255,255,255,0) 100%)",
            filter: `blur(${sizePx * 0.08}px)`,
          }}
        />
      );
    case "sparkle":
      return (
        <div
          style={{
            width: sizePx,
            height: sizePx,
            clipPath:
              "polygon(50% 0%, 61% 39%, 100% 50%, 61% 61%, 50% 100%, 39% 61%, 0% 50%, 39% 39%)",
            background: "radial-gradient(circle, #fffbe6 0%, #ffe066 55%, #ffc300 100%)",
            filter: glow("#ffe066cc"),
          }}
        />
      );
    case "star-burst":
      return (
        <div
          style={{
            width: sizePx,
            height: sizePx,
            clipPath:
              "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)",
            background: "radial-gradient(circle, #ffffff 0%, #ffe066 40%, #ff9d00 100%)",
            filter: glow("#ffb02099"),
          }}
        />
      );
    case "flame":
      return (
        <div
          style={{
            width: sizePx * 0.75,
            height: sizePx,
            borderRadius: "50% 50% 50% 50% / 60% 60% 40% 40%",
            background: "linear-gradient(180deg, #fff3b0 0%, #ffb020 40%, #ff5a1f 75%, #e0301a 100%)",
            filter: glow("#ff5a1fbb"),
          }}
        />
      );
  }
}

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
        opacity,
        transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
      }}
    >
      <PropShape kind={prop.kind} sizePx={prop.sizePx} />
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
 * The glossy commercial-promo visual style: a layered gradient background
 * (base wash + a bright radial glow centered on the product, for depth),
 * the product's background-removed cutout entering with a spin/scale and
 * a soft color-matched glow halo behind it, floating glossy decorative
 * props bursting outward around it, and a bold kinetic title in a real
 * poster display face — modeled on the real "FRESH ORANGE" juice-bottle
 * reference (solid-color background, spinning bottle entrance, floating
 * citrus/ice/splash props, big drop-shadowed title).
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

  // The halo/glow behind the product pulses very slightly — another cheap,
  // always-on touch that keeps the frame feeling alive instead of static.
  const glowPulse = 0.75 + Math.sin((relativeFrame / fps) * Math.PI * 1.1) * 0.15;

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
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <style>{adTitleFontFaceCss}</style>

      {/* Base wash */}
      <AbsoluteFill style={{ background: `linear-gradient(160deg, ${spec.backgroundColorFrom}, ${spec.backgroundColorTo})` }} />
      {/* Bright spotlight glow centered on the product — this is what gives
          the background depth instead of reading as a flat two-stop swatch. */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 50% 46%, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.08) 30%, transparent 60%)`,
        }}
      />

      {spec.props.map((prop, i) => (
        <PropView key={i} prop={prop} startFrame={startFrame} durationInFrames={durationInFrames} frameWidth={width} frameHeight={height} />
      ))}

      <ImpactRings startFrame={startFrame} />

      {spec.cutoutUrl && (
        <>
          {/* Color-matched glow halo behind the product — pop without it,
              flat against a busy background even after the cutout fix. */}
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "48%",
              width: "62%",
              aspectRatio: "1",
              transform: "translate(-50%, -50%)",
              borderRadius: "50%",
              background: "radial-gradient(circle, #ffffff 0%, #ffffffcc 15%, transparent 70%)",
              opacity: productOpacity * glowPulse,
              filter: "blur(18px)",
            }}
          />
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
        </>
      )}

      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: "10%",
          transform: `translateX(-50%) scale(${titleScale})`,
          opacity: titleOpacity,
          fontFamily: `'${AD_TITLE_FONT_FAMILY}', Helvetica, Arial, sans-serif`,
          fontSize: 64,
          color: "#ffffff",
          textAlign: "center",
          textShadow: "0 4px 0 rgba(0,0,0,0.25), 0 12px 24px rgba(0,0,0,0.35)",
          letterSpacing: 2,
          whiteSpace: "nowrap",
        }}
      >
        {spec.title.toUpperCase()}
      </div>

      {/* Vignette — a flat-lit corner-to-corner gradient is another
          "slideshow," not "commercial" tell; a soft darkening at the edges
          focuses the eye back on the product/title. */}
      <AbsoluteFill
        style={{
          background: "radial-gradient(circle at 50% 50%, transparent 55%, rgba(0,0,0,0.25) 100%)",
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
}
