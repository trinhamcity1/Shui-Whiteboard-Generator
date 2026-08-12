import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { DrawOn } from "./DrawOn";
import { useTheme } from "../theme/ThemeContext";

export function ComparisonCards({
  cards,
  startFrame,
}: {
  cards: Array<{ title: string; items: string[] }>;
  startFrame: number;
}) {
  const { fps } = useVideoConfig();
  const theme = useTheme();
  const staggerFrames = Math.round(fps * 0.3);

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        padding: "0 60px",
        background: theme.background,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
        {cards.map((card, i) => (
          <DrawOn key={card.title} startFrame={startFrame + i * staggerFrames}>
            <div
              style={{
                background: theme.surface,
                border: theme.strokeWidth > 0 ? `${theme.strokeWidth}px solid ${theme.border}` : `1px solid ${theme.border}`,
                borderRadius: 12,
                padding: 28,
              }}
            >
              <h3
                style={{
                  fontFamily: theme.fontDisplay,
                  fontSize: 34,
                  fontWeight: 800,
                  color: theme.accent,
                  margin: "0 0 14px",
                }}
              >
                {card.title}
              </h3>
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
                {card.items.map((item) => (
                  <li
                    key={item}
                    style={{
                      fontFamily: theme.fontBody,
                      fontSize: 26,
                      fontWeight: 500,
                      color: theme.ink,
                    }}
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </DrawOn>
        ))}
      </div>
    </AbsoluteFill>
  );
}
