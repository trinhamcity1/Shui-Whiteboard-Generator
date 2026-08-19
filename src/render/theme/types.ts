export interface StyleTheme {
  id: string;
  background: string;
  surface: string; // card/panel background
  border: string;
  ink: string;
  inkSoft: string;
  accent: string;
  fontDisplay: string;
  fontBody: string;
  fontMono: string;
  strokeWidth: number;
  /** progressive = the "draws itself on" reveal; instant = whole frame appears at once. */
  drawOnMode: "progressive" | "instant";
}
