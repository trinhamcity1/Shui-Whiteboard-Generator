import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";

/**
 * How many of a caption's words should be "revealed" (highlighted) by a
 * given frame — pure function, unit-testable without mounting Remotion.
 * v1 approximation: words are spaced evenly across the beat's duration,
 * same as the scene planner's own WORDS_PER_SECOND estimate before TTS
 * realignment exists for ad beats too. Good enough for a first cut; a
 * real per-word ElevenLabs timestamp realignment (mirroring
 * realignSceneTiming) is the natural next upgrade once this is validated
 * on a real render.
 */
export function wordsRevealedByFrame(frame: number, startFrame: number, durationInFrames: number, wordCount: number): number {
  if (wordCount === 0) return 0;
  const progress = interpolate(frame, [startFrame, startFrame + durationInFrames], [0, wordCount], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return Math.floor(progress);
}

interface AnimatedCaptionProps {
  text: string;
  startFrame: number;
  durationInFrames: number;
  style: "word-highlight" | "sentence" | "none";
  highlightColor?: string;
}

/** TikTok-style burned-in captions: word-by-word highlight, or the whole sentence at once, or nothing. */
export function AnimatedCaption({ text, startFrame, durationInFrames, style, highlightColor = "#f2c14e" }: AnimatedCaptionProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (style === "none" || !text) return null;

  const words = text.split(/\s+/).filter(Boolean);
  const revealed = style === "sentence" ? words.length : wordsRevealedByFrame(frame, startFrame, durationInFrames, words.length);

  const opacity = interpolate(frame, [startFrame, startFrame + Math.round(fps * 0.15)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        left: "6%",
        right: "6%",
        bottom: "12%",
        textAlign: "center",
        fontFamily: "Helvetica, Arial, sans-serif",
        fontWeight: 800,
        fontSize: 52,
        lineHeight: 1.2,
        color: "#ffffff",
        textShadow: "0 2px 8px rgba(0,0,0,0.6)",
        opacity,
      }}
    >
      {words.map((word, i) => (
        <span key={i} style={{ color: style === "word-highlight" && i < revealed ? highlightColor : "#ffffff", marginRight: 10 }}>
          {word}
        </span>
      ))}
    </div>
  );
}
