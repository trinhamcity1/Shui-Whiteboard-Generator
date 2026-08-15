import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { useTheme } from "../theme/ThemeContext";

interface DrawOnProps {
  children: React.ReactNode;
  startFrame: number;
  durationInFrames?: number;
  /**
   * Extra styles for DrawOn's own wrapper div — needed when the caller
   * wants to position/size the wrapper itself (e.g. `position: "absolute"`
   * with explicit coordinates) rather than a child inside it. DrawOn
   * always applies a `transform`, which per the CSS spec makes this div a
   * new containing block for any position:absolute descendant — a
   * position:absolute *child* placed inside an unstyled, unsized DrawOn
   * wrapper silently resolves percentage/`bottom` values against that
   * wrapper's auto-sized content box instead of the intended full-frame
   * box, not the composition frame (a real bug hit building the Layer 3
   * composition templates: `bottom` + percentage-height children just
   * failed to render). Passing position/coordinates via this prop puts
   * them on the box that's actually the containing block for everything
   * else, sidestepping the issue entirely.
   */
  style?: React.CSSProperties;
}

/**
 * Fades + rises content in over ~0.4s, standing in for the old SwiftUI
 * "draws itself on" stroke reveal — unless the active theme's
 * `drawOnMode` is "instant" (the full-frame style), in which case content
 * just appears immediately with no reveal animation at all.
 */
export function DrawOn({ children, startFrame, durationInFrames, style }: DrawOnProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = useTheme();

  if (theme.drawOnMode === "instant") {
    return <div style={style}>{children}</div>;
  }

  const revealFrames = durationInFrames ?? Math.round(fps * 0.4);

  const progress = interpolate(frame, [startFrame, startFrame + revealFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        ...style,
        opacity: progress,
        transform: `translateY(${(1 - progress) * 16}px)`,
      }}
    >
      {children}
    </div>
  );
}
