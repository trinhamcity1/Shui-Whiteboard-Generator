// Shapes an imageConcept into a provider prompt that matches the active
// StyleTheme, so illustrations look like they belong in the same video as
// the typographic components around them, not a mismatched sticker.
const STYLE_PROMPT_PREFIX: Record<string, string> = {
  "classic-whiteboard": "simple black-and-white whiteboard-style line illustration of:",
  "chalkboard-dark": "chalk-drawn illustration on a dark chalkboard background of:",
  "modern-minimal": "clean flat minimal geometric illustration of:",
  "full-frame": "simple black-and-white whiteboard-style line illustration of:",
};

export function buildImagePrompt(concept: string, styleVariant: string): string {
  const prefix = STYLE_PROMPT_PREFIX[styleVariant] ?? STYLE_PROMPT_PREFIX["classic-whiteboard"]!;
  return `${prefix} ${concept}`;
}
