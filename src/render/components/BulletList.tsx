import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { DrawOn } from "./DrawOn.js";

export function BulletList({ items, startFrame }: { items: string[]; startFrame: number }) {
  const { fps } = useVideoConfig();
  const staggerFrames = Math.round(fps * 0.35);

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        padding: "0 110px",
        background: "#f7f6f2",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 36 }}>
        {items.map((item, i) => (
          <DrawOn key={item} startFrame={startFrame + i * staggerFrames}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 20 }}>
              <div
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 999,
                  background: "#1c5fd1",
                  marginTop: 12,
                  flexShrink: 0,
                }}
              />
              <p
                style={{
                  fontFamily: "Helvetica, Arial, sans-serif",
                  fontSize: 44,
                  fontWeight: 600,
                  color: "#1d2624",
                  lineHeight: 1.3,
                  margin: 0,
                }}
              >
                {item}
              </p>
            </div>
          </DrawOn>
        ))}
      </div>
    </AbsoluteFill>
  );
}
