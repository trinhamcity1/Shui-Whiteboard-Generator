import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";

interface DrawOnProps {
  children: React.ReactNode;
  startFrame: number;
  durationInFrames?: number;
}

/**
 * Fades + rises content in over ~0.4s, standing in for the old SwiftUI
 * "draws itself on" stroke reveal until a real hand-drawn animation
 * exists in the component library (Phase 1).
 */
export function DrawOn({ children, startFrame, durationInFrames }: DrawOnProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const revealFrames = durationInFrames ?? Math.round(fps * 0.4);

  const progress = interpolate(frame, [startFrame, startFrame + revealFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        opacity: progress,
        transform: `translateY(${(1 - progress) * 16}px)`,
      }}
    >
      {children}
    </div>
  );
}
