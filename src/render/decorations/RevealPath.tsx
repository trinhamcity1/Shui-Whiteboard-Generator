import React, { useEffect, useRef, useState } from "react";
import { continueRender, delayRender, interpolate, useCurrentFrame } from "remotion";

export interface RevealPathProps {
  d: string;
  stroke: string;
  strokeWidth: number;
  fill?: string;
  /** Frame (relative to this component's own Sequence) the stroke starts drawing at. */
  startFrame: number;
  /** How many frames the draw-on takes — a full-canvas arrow draws slower than a small checkmark. */
  revealFrames?: number;
  /** Skips the stroke-reveal and just shows the finished path — for a still/instant context. */
  instant?: boolean;
}

/**
 * Renders one rough.js-generated path with a real "being drawn before your
 * eyes" stroke reveal, via stroke-dashoffset animated from the path's own
 * measured length down to 0 — the single biggest step toward the genre's
 * signature feel (revision-3 doc, Workstream 2), and something rough.js's
 * own SVG renderer doesn't give us for free since it manages its own DOM
 * internally.
 *
 * Length is measured via a real getTotalLength() call once on mount, the
 * same pattern SketchDiagram already uses to wait on font load — but with
 * a real bug fixed along the way: calling continueRender() synchronously
 * inside the measuring effect resolves Remotion's render-wait before
 * React's *next* render (the one with the now-known length, and therefore
 * the correct dashoffset) has actually committed and painted. The capture
 * ends up grabbing whatever was on screen at continueRender() — the
 * pre-measurement frame, which (with no dasharray applied yet) is the
 * fully-drawn path — so every "mid-reveal" frame silently rendered as
 * fully drawn regardless of the actual current frame. Fixed with two
 * effects: the first measures and stores the length; continueRender is
 * only called from a second effect that depends on that stored length,
 * i.e. after the corrected dashoffset render has committed. The
 * pre-measurement paint is also now invisible (opacity 0) rather than a
 * plain solid stroke, so there's no visible flash of the wrong state
 * either, belt and suspenders.
 */
export function RevealPath({ d, stroke, strokeWidth, fill, startFrame, revealFrames = 18, instant }: RevealPathProps) {
  const pathRef = useRef<SVGPathElement>(null);
  const [length, setLength] = useState<number | null>(instant ? 0 : null);
  const [handle] = useState(() => (instant ? null : delayRender("Measuring decoration path length for stroke reveal")));
  const continuedRef = useRef(false);
  const frame = useCurrentFrame();

  useEffect(() => {
    if (instant) return;
    const measured = pathRef.current?.getTotalLength() ?? 0;
    setLength(measured);
    // Only ever needs to run once — `d` is static for a given decoration instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (instant || length === null || continuedRef.current) return;
    continuedRef.current = true;
    if (handle !== null) continueRender(handle);
  }, [instant, length, handle]);

  const measuring = !instant && length === null;
  const dashoffset =
    instant || length === null
      ? 0
      : interpolate(frame, [startFrame, startFrame + revealFrames], [length, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

  return (
    <path
      ref={pathRef}
      d={d}
      stroke={stroke}
      strokeWidth={strokeWidth}
      fill={fill ?? "none"}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={
        instant
          ? undefined
          : measuring
            ? { opacity: 0 }
            : { strokeDasharray: length ?? 0, strokeDashoffset: dashoffset }
      }
    />
  );
}
