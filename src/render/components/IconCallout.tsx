import React from "react";
import { AbsoluteFill } from "remotion";
import { DrawOn } from "./DrawOn";
import { useTheme } from "../theme/ThemeContext";
import { getIconComponent } from "../icons/registry";

export function IconCallout({ icon, text, startFrame }: { icon: string; text: string; startFrame: number }) {
  const theme = useTheme();
  const IconComponent = getIconComponent(icon);

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        padding: "0 100px",
        background: theme.background,
      }}
    >
      <DrawOn startFrame={startFrame}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 28 }}>
          <div
            style={{
              width: 120,
              height: 120,
              borderRadius: 999,
              background: theme.accent,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 28,
            }}
          >
            <IconComponent style={{ width: "100%", height: "100%", color: theme.background }} />
          </div>
          <p
            style={{
              fontFamily: theme.fontDisplay,
              fontSize: 48,
              fontWeight: 700,
              color: theme.ink,
              textAlign: "center",
              lineHeight: 1.3,
              margin: 0,
            }}
          >
            {text}
          </p>
        </div>
      </DrawOn>
    </AbsoluteFill>
  );
}
