import type { StyleTheme } from "./types";

const classicWhiteboard: StyleTheme = {
  id: "classic-whiteboard",
  background: "#f7f6f2",
  surface: "#ffffff",
  border: "#1d2624",
  ink: "#1d2624",
  inkSoft: "#59665f",
  accent: "#1c5fd1",
  fontDisplay: "Helvetica, Arial, sans-serif",
  fontBody: "Helvetica, Arial, sans-serif",
  fontMono: "ui-monospace, monospace",
  strokeWidth: 3,
  drawOnMode: "progressive",
};

const fullFrame: StyleTheme = {
  ...classicWhiteboard,
  id: "full-frame",
  drawOnMode: "instant",
};

const THEMES: Record<string, StyleTheme> = {
  [classicWhiteboard.id]: classicWhiteboard,
  [fullFrame.id]: fullFrame,
};

export function getTheme(styleVariant: string): StyleTheme {
  const theme = THEMES[styleVariant];
  if (!theme) {
    console.warn(`Unknown styleVariant "${styleVariant}" — falling back to "classic-whiteboard".`);
    return classicWhiteboard;
  }
  return theme;
}

export const AVAILABLE_STYLE_VARIANTS = Object.keys(THEMES);
