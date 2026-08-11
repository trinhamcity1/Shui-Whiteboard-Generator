import React from "react";
import { AbsoluteFill } from "remotion";
import { DrawOn } from "./DrawOn";

export function Quote({
  text,
  attribution,
  startFrame,
}: {
  text: string;
  attribution?: string;
  startFrame: number;
}) {
  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        padding: "0 130px",
        background: "#f7f6f2",
      }}
    >
      <DrawOn startFrame={startFrame}>
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontFamily: "Georgia, serif",
              fontSize: 96,
              lineHeight: 0.4,
              color: "#1c5fd1",
              marginBottom: 12,
            }}
          >
            &ldquo;
          </div>
          <p
            style={{
              fontFamily: "Georgia, serif",
              fontStyle: "italic",
              fontSize: 52,
              fontWeight: 500,
              color: "#1d2624",
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
                fontFamily: "ui-monospace, monospace",
                fontSize: 22,
                color: "#59665f",
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
