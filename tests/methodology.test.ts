import { describe, it, expect } from "vitest";
import { PLANNING_METHODOLOGY_RULES, SCRIPTWRITING_METHODOLOGY_RULES } from "../src/schema/methodology";
import { buildSystemPrompt as buildPlanningPrompt } from "../src/schema/planning";
import { buildSystemPrompt as buildScriptWritingPrompt } from "../src/schema/scriptWriting";

describe("Phase 6 methodology — planning.ts", () => {
  const prompt = buildPlanningPrompt(60);

  it("includes the full methodology rules block verbatim", () => {
    expect(prompt).toContain(PLANNING_METHODOLOGY_RULES);
  });

  it("covers retrieval practice, chunking, signaling, and contrast", () => {
    expect(prompt).toContain("RETRIEVAL PRACTICE");
    expect(prompt).toContain("CHUNKING");
    expect(prompt).toContain("SIGNALING / CUEING");
    expect(prompt).toContain("CONTRAST");
  });

  it("ties signaling/cueing to the phase-07 emphasis field, not decoration for its own sake", () => {
    expect(prompt).toContain('"emphasis":"positive"/"negative"');
  });

  it("ties contrast to the comparison diagram kind and rules out venn for a misconception pair", () => {
    expect(prompt).toContain('"comparison" sketchDiagram kind');
    expect(prompt).toContain("venn");
  });
});

describe("Phase 6 methodology — scriptWriting.ts", () => {
  const prompt = buildScriptWritingPrompt(60);

  it("includes the full methodology rules block verbatim", () => {
    expect(prompt).toContain(SCRIPTWRITING_METHODOLOGY_RULES);
  });

  it("covers concrete framing and the narrative hook", () => {
    expect(prompt).toContain("CONCRETE, SPECIFIC FRAMING");
    expect(prompt).toContain("NARRATIVE HOOK");
  });
});
