import React from "react";
import { AbsoluteFill, Img, interpolate, useCurrentFrame } from "remotion";
import { useTheme } from "../theme/ThemeContext";

export function FullBleedGraphic({ imageUrl, startFrame }: { imageUrl: string; startFrame: number }) {
  const frame = useCurrentFrame();
  const theme = useTheme();
  const instant = theme.drawOnMode === "instant";
  const opacity = instant
    ? 1
    : interpolate(frame, [startFrame, startFrame + 15], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });

  return (
    <AbsoluteFill style={{ background: theme.ink }}>
      <Img
        src={imageUrl}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          opacity,
        }}
      />
    </AbsoluteFill>
  );
}
