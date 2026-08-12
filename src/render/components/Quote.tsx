import React from "react";
import { AbsoluteFill } from "remotion";
import { DrawOn } from "./DrawOn";
import { useTheme } from "../theme/ThemeContext";

export function Quote({
  text,
  attribution,
  startFrame,
}: {
  text: string;
  attribution?: string;
  startFrame: number;
}) {
  const theme = useTheme();
  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        padding: "0 130px",
        background: theme.background,
      }}
    >
      <DrawOn startFrame={startFrame}>
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontFamily: "Georgia, serif",
              fontSize: 96,
              lineHeight: 0.4,
              color: theme.accent,
              marginBottom: 12,
            }}
          >
            &ldquo;
          </div>
          <p
            style={{
              fontFamily: theme.fontDisplay,
              fontStyle: "italic",
              fontSize: 52,
              fontWeight: 500,
              color: theme.ink,
              lineHeight: 1.3,
              margin: 0,
            }}
          >
            {text}
          </p>
          {attribution ? (
            <p
              style={{
                marginTop: 26,
                fontFamily: theme.fontMono,
                fontSize: 22,
                color: theme.inkSoft,
              }}
            >
              — {attribution}
            </p>
          ) : null}
        </div>
      </DrawOn>
    </AbsoluteFill>
  );
}
