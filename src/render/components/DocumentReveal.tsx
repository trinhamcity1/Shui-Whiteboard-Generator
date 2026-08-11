import React from "react";
import { AbsoluteFill, Img } from "remotion";
import { DrawOn } from "./DrawOn";

export function DocumentReveal({
  imageUrl,
  attribution,
  startFrame,
}: {
  imageUrl: string;
  attribution?: string;
  startFrame: number;
}) {
  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        padding: 90,
        background: "#f7f6f2",
      }}
    >
      <DrawOn startFrame={startFrame}>
        <div
          style={{
            background: "#ffffff",
            border: "3px solid #1d2624",
            borderRadius: 8,
            padding: 16,
            boxShadow: "0 18px 40px rgba(0,0,0,0.18)",
            transform: "rotate(-1.5deg)",
          }}
        >
          <Img src={imageUrl} style={{ display: "block", maxWidth: "100%", maxHeight: "70vh" }} />
        </div>
      </DrawOn>
      {attribution ? (
        <p
          style={{
            marginTop: 20,
            fontFamily: "ui-monospace, monospace",
            fontSize: 20,
            color: "#59665f",
          }}
        >
          {attribution}
        </p>
      ) : null}
    </AbsoluteFill>
  );
}
