import React from "react";
import { AbsoluteFill } from "remotion";
import { DrawOn } from "./DrawOn";

export function TitleCard({ text, startFrame }: { text: string; startFrame: number }) {
  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        padding: "0 120px",
        background: "#f7f6f2",
      }}
    >
      <DrawOn startFrame={startFrame}>
        <h1
          style={{
            fontFamily: "Helvetica, Arial, sans-serif",
            fontSize: 72,
            fontWeight: 800,
            color: "#1d2624",
            textAlign: "center",
            lineHeight: 1.15,
          }}
        >
          {text}
        </h1>
      </DrawOn>
    </AbsoluteFill>
  );
}
