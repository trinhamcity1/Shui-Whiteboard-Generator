import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { useTheme } from "../theme/ThemeContext";

interface DrawOnProps {
  children: React.ReactNode;
  startFrame: number;
  durationInFrames?: number;
}

/**
 * Fades + rises content in over ~0.4s, standing in for the old SwiftUI
 * "draws itself on" stroke reveal — unless the active theme's
 * `drawOnMode` is "instant" (the full-frame style), in which case content
 * just appears immediately with no reveal animation at all.
 */
export function DrawOn({ children, startFrame, durationInFrames }: DrawOnProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = useTheme();

  if (theme.drawOnMode === "instant") {
    return <div>{children}</div>;
  }

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
