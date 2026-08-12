import React, { createContext, useContext } from "react";
import type { StyleTheme } from "./types";
import { getTheme } from "./themes";

const ThemeContext = createContext<StyleTheme | null>(null);

export function ThemeProvider({ styleVariant, children }: { styleVariant: string; children: React.ReactNode }) {
  const theme = getTheme(styleVariant);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): StyleTheme {
  const theme = useContext(ThemeContext);
  if (!theme) {
    throw new Error("useTheme() called outside a <ThemeProvider>.");
  }
  return theme;
}
