// Shapes an imageConcept into a provider prompt that matches the active
// StyleTheme, so illustrations look like they belong in the same video as
// the typographic components around them, not a mismatched sticker.
const STYLE_PROMPT_PREFIX: Record<string, string> = {
  "classic-whiteboard": "simple black-and-white whiteboard-style line illustration of:",
  "chalkboard-dark": "chalk-drawn illustration on a dark chalkboard background of:",
  "modern-minimal": "clean flat minimal geometric illustration of:",
  "full-frame": "simple black-and-white whiteboard-style line illustration of:",
  // Not a shipped StyleTheme — an experimental prompt for quality testing
  // (see scripts/render-illustration-comparison.ts). A video using this
  // styleVariant falls back to classic-whiteboard's typography/colors
  // (with the usual "unknown styleVariant" console warning), since only
  // the image-prompt vocabulary has an entry for it, not a real theme.
  "vivid-lesson":
    "vibrant, richly colored educational illustration in a warm modern flat-illustration style, like a " +
    "high-quality animated explainer video or children's educational book — clear visual storytelling with " +
    "a single obvious focal subject, inviting color palette, soft depth and lighting, clean uncluttered " +
    "background, digital illustration, high detail, no text or letters in the image:",
};

export function buildImagePrompt(concept: string, styleVariant: string): string {
  const prefix = STYLE_PROMPT_PREFIX[styleVariant] ?? STYLE_PROMPT_PREFIX["classic-whiteboard"]!;
  return `${prefix} ${concept}`;
}
