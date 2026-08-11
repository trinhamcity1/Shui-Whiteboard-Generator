import React from "react";
import { AbsoluteFill, Img, interpolate, useCurrentFrame } from "remotion";

export function FullBleedGraphic({ imageUrl, startFrame }: { imageUrl: string; startFrame: number }) {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [startFrame, startFrame + 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ background: "#1d2624" }}>
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
