import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { PromoBadge as PromoBadgeSpec } from "../../schema/ad";

interface PromoBadgeProps {
  badge: PromoBadgeSpec;
  startFrame: number;
}

/** A discount/offer callout — deliberately loud (high-contrast, slight pop-in) since Direction beats are the ones that must not be missed. */
export function PromoBadge({ badge, startFrame }: PromoBadgeProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = interpolate(frame, [startFrame, startFrame + Math.round(fps * 0.25)], [0.7, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = interpolate(frame, [startFrame, startFrame + Math.round(fps * 0.15)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        top: "8%",
        left: "50%",
        transform: `translateX(-50%) scale(${scale})`,
        opacity,
        background: "#e03131",
        color: "#ffffff",
        borderRadius: 14,
        padding: "14px 26px",
        textAlign: "center",
        fontFamily: "Helvetica, Arial, sans-serif",
        boxShadow: "0 6px 18px rgba(0,0,0,0.35)",
      }}
    >
      <div style={{ fontSize: 28, fontWeight: 800 }}>{badge.description}</div>
      {badge.code && (
        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: 1, marginTop: 4 }}>CODE: {badge.code}</div>
      )}
    </div>
  );
}
