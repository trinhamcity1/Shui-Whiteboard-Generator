import { describe, expect, it } from "vitest";
import { computeKenBurnsScale } from "../src/render/ad/KenBurnsPhoto";
import { wordsRevealedByFrame } from "../src/render/ad/AnimatedCaption";

describe("computeKenBurnsScale", () => {
  it("starts at zoomFrom on the beat's first frame", () => {
    expect(computeKenBurnsScale(0, 0, 90, 1.0, 1.2)).toBeCloseTo(1.0);
  });

  it("reaches zoomTo on the beat's last frame", () => {
    expect(computeKenBurnsScale(90, 0, 90, 1.0, 1.2)).toBeCloseTo(1.2);
  });

  it("interpolates linearly at the midpoint", () => {
    expect(computeKenBurnsScale(45, 0, 90, 1.0, 1.2)).toBeCloseTo(1.1);
  });

  it("clamps before the beat starts", () => {
    expect(computeKenBurnsScale(-10, 0, 90, 1.0, 1.2)).toBeCloseTo(1.0);
  });

  it("clamps after the beat ends", () => {
    expect(computeKenBurnsScale(200, 0, 90, 1.0, 1.2)).toBeCloseTo(1.2);
  });
});

describe("wordsRevealedByFrame", () => {
  it("reveals zero words before the beat starts", () => {
    expect(wordsRevealedByFrame(0, 30, 60, 6)).toBe(0);
  });

  it("reveals all words by the beat's end", () => {
    expect(wordsRevealedByFrame(90, 30, 60, 6)).toBe(6);
  });

  it("reveals roughly half the words at the midpoint", () => {
    expect(wordsRevealedByFrame(60, 30, 60, 6)).toBe(3);
  });

  it("returns 0 for an empty caption", () => {
    expect(wordsRevealedByFrame(60, 30, 60, 0)).toBe(0);
  });
});
