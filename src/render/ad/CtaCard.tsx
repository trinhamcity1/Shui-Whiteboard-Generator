import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";

interface CtaCardProps {
  label: string;
  startFrame: number;
}

/** The Direction beat's payoff — a single, unmissable button-shaped call to action, never a plain text line. */
export function CtaCard({ label, startFrame }: CtaCardProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // A gentle pulse so a static end card still reads as "tap me," not a
  // frozen frame — subtle, not a distraction from the label itself.
  const pulse = 1 + 0.03 * Math.sin(((frame - startFrame) / fps) * Math.PI * 2);
  const opacity = interpolate(frame, [startFrame, startFrame + Math.round(fps * 0.2)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        bottom: "22%",
        transform: `translateX(-50%) scale(${pulse})`,
        opacity,
        background: "#1c5fd1",
        color: "#ffffff",
        borderRadius: 999,
        padding: "18px 44px",
        fontFamily: "Helvetica, Arial, sans-serif",
        fontWeight: 800,
        fontSize: 30,
        boxShadow: "0 8px 22px rgba(0,0,0,0.4)",
      }}
    >
      {label}
    </div>
  );
}
