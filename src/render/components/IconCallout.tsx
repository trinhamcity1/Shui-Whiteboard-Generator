import React from "react";
import { AbsoluteFill } from "remotion";
import { DrawOn } from "./DrawOn";

// Phase 1 ships a generic placeholder badge instead of a real icon set —
// Phase 3 swaps this for a real icon vocabulary (Heroicons/Phosphor) keyed
// by the same `icon` name string, so callers don't need to change anything.
export function IconCallout({ icon, text, startFrame }: { icon: string; text: string; startFrame: number }) {
  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        padding: "0 100px",
        background: "#f7f6f2",
      }}
    >
      <DrawOn startFrame={startFrame}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 28 }}>
          <div
            style={{
              width: 120,
              height: 120,
              borderRadius: 999,
              background: "#1c5fd1",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "ui-monospace, monospace",
              fontSize: 20,
              fontWeight: 700,
              color: "#f7f6f2",
              textTransform: "uppercase",
              letterSpacing: "0.02em",
              textAlign: "center",
              padding: 12,
            }}
          >
            {icon.slice(0, 2)}
          </div>
          <p
            style={{
              fontFamily: "Helvetica, Arial, sans-serif",
              fontSize: 48,
              fontWeight: 700,
              color: "#1d2624",
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
