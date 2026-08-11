import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { DrawOn } from "./DrawOn";

export function ComparisonCards({
  cards,
  startFrame,
}: {
  cards: Array<{ title: string; items: string[] }>;
  startFrame: number;
}) {
  const { fps } = useVideoConfig();
  const staggerFrames = Math.round(fps * 0.3);

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        padding: "0 60px",
        background: "#f7f6f2",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
        {cards.map((card, i) => (
          <DrawOn key={card.title} startFrame={startFrame + i * staggerFrames}>
            <div
              style={{
                background: "#ffffff",
                border: "2px solid #1d2624",
                borderRadius: 12,
                padding: 28,
              }}
            >
              <h3
                style={{
                  fontFamily: "Helvetica, Arial, sans-serif",
                  fontSize: 34,
                  fontWeight: 800,
                  color: "#1c5fd1",
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
                      fontFamily: "Helvetica, Arial, sans-serif",
                      fontSize: 26,
                      fontWeight: 500,
                      color: "#1d2624",
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
