import React from "react";
import { AbsoluteFill } from "remotion";
import { DrawOn } from "./DrawOn";
import { useTheme } from "../theme/ThemeContext";

export function TitleCard({ text, startFrame }: { text: string; startFrame: number }) {
  const theme = useTheme();
  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        padding: "0 120px",
        background: theme.background,
      }}
    >
      <DrawOn startFrame={startFrame}>
        <h1
          style={{
            fontFamily: theme.fontDisplay,
            fontSize: 72,
            fontWeight: 800,
            color: theme.ink,
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
