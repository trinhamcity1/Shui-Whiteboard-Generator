import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { DrawOn } from "./DrawOn";
import { useTheme } from "../theme/ThemeContext";

export function BulletList({ items, startFrame }: { items: string[]; startFrame: number }) {
  const { fps } = useVideoConfig();
  const theme = useTheme();
  const staggerFrames = Math.round(fps * 0.35);

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        padding: "0 110px",
        background: theme.background,
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
                  background: theme.accent,
                  marginTop: 12,
                  flexShrink: 0,
                }}
              />
              <p
                style={{
                  fontFamily: theme.fontBody,
                  fontSize: 44,
                  fontWeight: 600,
                  color: theme.ink,
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
