/**
 * Candidate subjects for Plan A style-model training (amendment §3).
 *
 * Deliberately broader than the final ~20-asset v1 manifest — a LoRA trained
 * on only "judge, officer, voter" would overfit to civics-specific shapes
 * rather than learning the *style* itself. These subjects span characters,
 * poses, and generic objects so the trained model generalizes to whatever
 * Tier 2 set gets built next.
 */

const STYLE_CLAUSE =
  "Warm, painterly storybook illustration. Soft gouache-textured brushwork with visible " +
  "hand-painted texture, warm earthy color palette (ochre, terracotta, sage green, cream), " +
  "atmospheric soft lighting, gentle painterly depth with a softly blended background wash. " +
  "Expressive, warm, simplified faces with real personality — not blank or geometric. " +
  "Rounded, friendly character proportions. Standalone illustration, plain warm cream " +
  "background, no text, no lettering, no watermark.";

const CHARACTER_SUBJECTS: Array<{ label: string; description: string }> = [
  { label: "narrator, explaining", description: "a friendly narrator character, one hand raised mid-explanation, facing forward" },
  { label: "narrator, pointing", description: "a friendly narrator character pointing off to the side, three-quarter view" },
  { label: "narrator, thinking", description: "a friendly narrator character with a hand on their chin, thoughtful expression" },
  { label: "narrator, celebrating", description: "a friendly narrator character smiling with arms raised in celebration" },
  { label: "teacher at a desk", description: "a warm, approachable teacher character seated at a small desk" },
  { label: "professional, standing", description: "a professional-casual adult character standing, arms relaxed at their sides" },
  { label: "student, reading", description: "a young student character reading an open book" },
  { label: "official figure, addressing", description: "a formally dressed official character mid-address, one arm gesturing outward" },
  { label: "official figure, saluting", description: "a formally dressed official character in a respectful salute pose" },
  { label: "citizen, casting a vote", description: "an everyday adult character placing a folded paper into a slotted box" },
  { label: "elder figure, explaining", description: "a warm elder character gesturing while explaining something" },
  { label: "child, curious", description: "a small child character looking up with wide, curious eyes" },
];

const PROP_SUBJECTS: Array<{ label: string; description: string }> = [
  { label: "checkmark", description: "a bold hand-painted checkmark symbol" },
  { label: "arrow", description: "a curved directional arrow" },
  { label: "lightbulb", description: "a glowing lightbulb, idea symbol" },
  { label: "open book", description: "an open storybook with visible painterly pages" },
  { label: "clock", description: "a simple round clock face" },
  { label: "bar chart", description: "a small stylized bar chart with three bars" },
  { label: "magnifying glass", description: "a magnifying glass" },
  { label: "gear", description: "a single mechanical gear" },
  { label: "ballot box", description: "a wooden ballot box with a coin slot" },
  { label: "government building", description: "a small domed government building with columns" },
  { label: "gavel", description: "a wooden judge's gavel resting on its block" },
  { label: "scroll", description: "an unrolled parchment scroll" },
  { label: "signpost", description: "a wooden signpost with two blank arrow signs" },
  { label: "briefcase", description: "a simple leather briefcase" },
  { label: "map", description: "a folded paper map" },
];

export interface CandidatePromptSpec {
  subject: string;
  prompt: string;
}

/**
 * Builds `count` candidate prompts by cycling through the character/prop
 * subject pools (roughly 60/40 characters-to-props, matching the eventual
 * asset library's own mix) so a large batch still stays within the fixed
 * subject vocabulary rather than drifting into unrelated imagery.
 */
export function buildCandidatePrompts(count: number): CandidatePromptSpec[] {
  const specs: CandidatePromptSpec[] = [];
  for (let i = 0; i < count; i++) {
    const useCharacter = i % 5 < 3; // 3 of every 5 = characters, 2 = props
    const pool = useCharacter ? CHARACTER_SUBJECTS : PROP_SUBJECTS;
    const entry = pool[i % pool.length]!;
    specs.push({
      subject: entry.label,
      prompt: `${STYLE_CLAUSE} Subject: ${entry.description}.`,
    });
  }
  return specs;
}
