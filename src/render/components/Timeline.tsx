import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { DrawOn } from "./DrawOn";

export function Timeline({
  entries,
  startFrame,
}: {
  entries: Array<{ year: number; label: string }>;
  startFrame: number;
}) {
  const { fps } = useVideoConfig();
  const staggerFrames = Math.round(fps * 0.4);

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        padding: "0 90px",
        background: "#f7f6f2",
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
            background: "#cdd5d3",
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
                  background: "#1c5fd1",
                  border: "4px solid #f7f6f2",
                  boxShadow: "0 0 0 3px #1c5fd1",
                  flexShrink: 0,
                  marginTop: 4,
                  zIndex: 1,
                }}
              />
              <div>
                <div
                  style={{
                    fontFamily: "ui-monospace, monospace",
                    fontSize: 28,
                    fontWeight: 700,
                    color: "#1c5fd1",
                  }}
                >
                  {entry.year}
                </div>
                <div
                  style={{
                    fontFamily: "Helvetica, Arial, sans-serif",
                    fontSize: 36,
                    fontWeight: 600,
                    color: "#1d2624",
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
