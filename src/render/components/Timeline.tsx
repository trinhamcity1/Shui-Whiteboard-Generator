import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { DrawOn } from "./DrawOn";
import { useTheme } from "../theme/ThemeContext";

export function Timeline({
  entries,
  startFrame,
}: {
  entries: Array<{ year: number; label: string }>;
  startFrame: number;
}) {
  const { fps } = useVideoConfig();
  const theme = useTheme();
  const staggerFrames = Math.round(fps * 0.4);

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        padding: "0 90px",
        background: theme.background,
      }}
    >
      <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 44 }}>
        <div
          style={{
            position: "absolute",
            left: 11,
            top: 12,
            bottom: 12,
            width: 3,
            background: theme.border,
            opacity: 0.4,
          }}
        />
        {entries.map((entry, i) => (
          <DrawOn key={`${entry.year}-${entry.label}`} startFrame={startFrame + i * staggerFrames}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 24 }}>
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 999,
                  background: theme.accent,
                  border: `4px solid ${theme.background}`,
                  boxShadow: `0 0 0 3px ${theme.accent}`,
                  flexShrink: 0,
                  marginTop: 4,
                  zIndex: 1,
                }}
              />
              <div>
                <div
                  style={{
                    fontFamily: theme.fontMono,
                    fontSize: 28,
                    fontWeight: 700,
                    color: theme.accent,
                  }}
                >
                  {entry.year}
                </div>
                <div
                  style={{
                    fontFamily: theme.fontBody,
                    fontSize: 36,
                    fontWeight: 600,
                    color: theme.ink,
                  }}
                >
                  {entry.label}
                </div>
              </div>
            </div>
          </DrawOn>
        ))}
      </div>
    </AbsoluteFill>
  );
}
