import React from "react";
import { Img, interpolate, useCurrentFrame } from "remotion";
import type { PhotoRef } from "../../schema/ad";

/**
 * Pure math, split out so it's unit-testable without mounting Remotion —
 * linear interpolation from zoomFrom to zoomTo across the beat's own
 * frame range, clamped at both ends so a frame outside [startFrame,
 * startFrame+durationInFrames) never extrapolates past the intended zoom.
 */
export function computeKenBurnsScale(
  frame: number,
  startFrame: number,
  durationInFrames: number,
  zoomFrom: number,
  zoomTo: number,
): number {
  return interpolate(frame, [startFrame, startFrame + durationInFrames], [zoomFrom, zoomTo], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

interface KenBurnsPhotoProps {
  src: string;
  photoRef: PhotoRef;
  startFrame: number;
  durationInFrames: number;
}

/**
 * Animates a slow push-in (or pull-out) on a real, user-uploaded product
 * photo — no image generation, no API call, just a CSS transform
 * interpolated frame-by-frame. This is the entire "Ken Burns" cost: pure
 * client-side math, priced the same as any other render second.
 */
export function KenBurnsPhoto({ src, photoRef, startFrame, durationInFrames }: KenBurnsPhotoProps) {
  const frame = useCurrentFrame();
  const scale = computeKenBurnsScale(frame, startFrame, durationInFrames, photoRef.zoomFrom, photoRef.zoomTo);
  const { x, y } = photoRef.focalPoint;

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <Img
        src={src}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: `${x * 100}% ${y * 100}%`,
          transform: `scale(${scale})`,
          transformOrigin: `${x * 100}% ${y * 100}%`,
        }}
      />
    </div>
  );
}
