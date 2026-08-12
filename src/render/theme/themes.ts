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

const chalkboardDark: StyleTheme = {
  id: "chalkboard-dark",
  background: "#1b2620",
  surface: "#233128",
  border: "#f5f0e6",
  ink: "#f5f0e6",
  inkSoft: "#b9c4bb",
  accent: "#f2c14e",
  fontDisplay: "'Comic Sans MS', 'Segoe Print', cursive",
  fontBody: "'Comic Sans MS', 'Segoe Print', cursive",
  fontMono: "ui-monospace, monospace",
  strokeWidth: 3,
  drawOnMode: "progressive",
};

const modernMinimal: StyleTheme = {
  id: "modern-minimal",
  background: "#ffffff",
  surface: "#f4f5f7",
  border: "#e2e5e9",
  ink: "#111827",
  inkSoft: "#6b7280",
  accent: "#2563eb",
  fontDisplay: "Helvetica, Arial, sans-serif",
  fontBody: "Helvetica, Arial, sans-serif",
  fontMono: "ui-monospace, monospace",
  strokeWidth: 0,
  drawOnMode: "progressive",
};

const fullFrame: StyleTheme = {
  ...classicWhiteboard,
  id: "full-frame",
  drawOnMode: "instant",
};

const THEMES: Record<string, StyleTheme> = {
  [classicWhiteboard.id]: classicWhiteboard,
  [chalkboardDark.id]: chalkboardDark,
  [modernMinimal.id]: modernMinimal,
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
