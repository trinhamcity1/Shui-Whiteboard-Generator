import React from "react";
import { AbsoluteFill, Img, interpolate, useCurrentFrame } from "remotion";
import { useTheme } from "../theme/ThemeContext";

/** caption is optional — a short label burned over the image so a viewer can
 * follow along without relying on audio alone (e.g. "THE CONSTITUTION"). A
 * solid backing panel keeps it legible over any image content underneath,
 * same discipline as the composition templates' caption cards. */
export function FullBleedGraphic({
  imageUrl,
  caption,
  startFrame,
  imageWidthPx,
  imageHeightPx,
}: {
  imageUrl: string;
  caption?: string;
  startFrame: number;
  imageWidthPx?: number;
  imageHeightPx?: number;
}) {
  const frame = useCurrentFrame();
  const theme = useTheme();
  const instant = theme.drawOnMode === "instant";
  const opacity = instant
    ? 1
    : interpolate(frame, [startFrame, startFrame + 15], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });

  // A real render put a narrow character cutout (narrator-confident,
  // 134x383 — aspect 0.35) through this component: objectFit "cover" scales
  // to fill BOTH dimensions of the tall 1080x1920 canvas, and an image this
  // much narrower than the canvas needs an 8x scale-up to cover the width
  // alone, which pushed the scaled height to ~3100px and center-cropped
  // away the top third — decapitating the character on screen, plus
  // visibly blurring a small source image blown up 8x. "Cover" is correct
  // for genuine full-scene concept art (usually landscape/square, a small
  // edge crop is harmless); a character-shaped cutout needs the whole
  // figure visible instead, grounded at the bottom like a real full-bleed
  // character shot. 0.62 sits between the canvas's own 0.5625 aspect and
  // the narrowest normal full-scene asset seen in the library, so this
  // only triggers for something meaningfully narrower than the canvas.
  const isCharacterShaped =
    imageWidthPx !== undefined && imageHeightPx !== undefined && imageWidthPx / imageHeightPx < 0.62;

  return (
    // theme.background (the paper tone), not theme.ink — the trained model
    // frequently returns a character cutout with a transparent margin
    // rather than a true full-frame scene, and objectFit "cover" doesn't
    // crop that margin away entirely; ink (a near-black stroke color, not
    // a backdrop) showed through it as a jarring black frame. Paper
    // matches what every other component in the style uses as its ground.
    <AbsoluteFill style={{ background: theme.background }}>
      <Img
        src={imageUrl}
        style={
          isCharacterShaped
            ? {
                width: "100%",
                height: "100%",
                objectFit: "contain",
                objectPosition: "center bottom",
                opacity,
              }
            : {
                width: "100%",
                height: "100%",
                objectFit: "cover",
                opacity,
              }
        }
      />
      {caption && (
        <div
          style={{
            position: "absolute",
            left: "8%",
            right: "8%",
            bottom: 100,
            textAlign: "center",
            fontFamily: theme.fontMono,
            fontSize: 34,
            color: theme.ink,
            background: theme.surface,
            border: `3px solid ${theme.border}`,
            borderRadius: 12,
            padding: "16px 24px",
            opacity,
          }}
        >
          {caption}
        </div>
      )}
    </AbsoluteFill>
  );
}
