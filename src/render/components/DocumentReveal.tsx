import React from "react";
import { AbsoluteFill, Img } from "remotion";
import { DrawOn } from "./DrawOn";
import { useTheme } from "../theme/ThemeContext";

export function DocumentReveal({
  imageUrl,
  attribution,
  startFrame,
}: {
  imageUrl: string;
  attribution?: string;
  startFrame: number;
}) {
  const theme = useTheme();
  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        padding: 90,
        background: theme.background,
      }}
    >
      <DrawOn startFrame={startFrame}>
        <div
          style={{
            background: theme.surface,
            border: `3px solid ${theme.border}`,
            borderRadius: 8,
            padding: 16,
            boxShadow: "0 18px 40px rgba(0,0,0,0.18)",
            transform: theme.drawOnMode === "instant" ? undefined : "rotate(-1.5deg)",
          }}
        >
          <Img src={imageUrl} style={{ display: "block", maxWidth: "100%", maxHeight: "70vh" }} />
        </div>
      </DrawOn>
      {attribution ? (
        <p
          style={{
            marginTop: 20,
            fontFamily: theme.fontMono,
            fontSize: 20,
            color: theme.inkSoft,
          }}
        >
          {attribution}
        </p>
      ) : null}
    </AbsoluteFill>
  );
}
