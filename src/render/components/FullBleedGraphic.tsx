import React from "react";
import { AbsoluteFill, Img, interpolate, useCurrentFrame } from "remotion";
import { useTheme } from "../theme/ThemeContext";

/** caption is optional — a short label burned over the image so a viewer can
 * follow along without relying on audio alone (e.g. "THE CONSTITUTION"). A
 * solid backing panel keeps it legible over any image content underneath,
 * same discipline as the composition templates' caption cards. */
export function FullBleedGraphic({
  imageUrl,
  caption,
  startFrame,
}: {
  imageUrl: string;
  caption?: string;
  startFrame: number;
}) {
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
      {caption && (
        <div
          style={{
            position: "absolute",
            left: "8%",
            right: "8%",
            bottom: 100,
            textAlign: "center",
            fontFamily: theme.fontMono,
            fontSize: 34,
            color: theme.ink,
            background: theme.surface,
            border: `3px solid ${theme.border}`,
            borderRadius: 12,
            padding: "16px 24px",
            opacity,
          }}
        >
          {caption}
        </div>
      )}
    </AbsoluteFill>
  );
}
