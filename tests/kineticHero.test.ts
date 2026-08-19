import { describe, expect, it } from "vitest";
import { AdDocument } from "../src/schema/ad";
import { computePropOffset, computePropRotation } from "../src/render/ad/KineticHero";

const baseDocument = {
  schemaVersion: 2,
  templateId: "problem-solution",
  visualStyle: "kinetic-hero",
  platform: "instagram",
  voice: "voice-id",
  durationSeconds: 10,
  targetAudience: "busy professionals",
  productImages: [{ url: "https://example.com/bottle.jpg" }],
};

describe("AdDocument kinetic-hero beats", () => {
  it("accepts a well-formed kineticHero beat", () => {
    const doc = {
      ...baseDocument,
      beats: [
        {
          id: "hero",
          role: "attention",
          atSeconds: 0,
          durationSeconds: 3,
          kineticHero: {
            productImageIndex: 0,
            backgroundColorFrom: "#6fbf3c",
            backgroundColorTo: "#3f9e1c",
            title: "FRESH ORANGE",
            props: [{ kind: "citrus-slice", startX: 0.2, startY: 0.3, driftAngleDeg: 45, driftDistancePx: 100, sizePx: 48, delaySeconds: 0 }],
          },
        },
        { id: "cta", role: "direction", atSeconds: 3, durationSeconds: 3, ctaLabel: "Shop now" },
      ],
    };
    expect(AdDocument.safeParse(doc).success).toBe(true);
  });

  it("rejects a beat with both photoRef and kineticHero", () => {
    const doc = {
      ...baseDocument,
      beats: [
        {
          id: "bad",
          role: "attention",
          atSeconds: 0,
          durationSeconds: 3,
          photoRef: { imageIndex: 0 },
          kineticHero: {
            productImageIndex: 0,
            backgroundColorFrom: "#000",
            backgroundColorTo: "#111",
            title: "X",
            props: [],
          },
        },
        { id: "cta", role: "direction", atSeconds: 3, durationSeconds: 3, ctaLabel: "Shop now" },
      ],
    };
    expect(AdDocument.safeParse(doc).success).toBe(false);
  });

  it("rejects an unknown prop kind", () => {
    const doc = {
      ...baseDocument,
      beats: [
        {
          id: "hero",
          role: "attention",
          atSeconds: 0,
          durationSeconds: 3,
          kineticHero: {
            productImageIndex: 0,
            backgroundColorFrom: "#000",
            backgroundColorTo: "#111",
            title: "X",
            props: [{ kind: "confetti-cannon", startX: 0.5, startY: 0.5, driftAngleDeg: 0 }],
          },
        },
        { id: "cta", role: "direction", atSeconds: 3, durationSeconds: 3, ctaLabel: "Shop now" },
      ],
    };
    expect(AdDocument.safeParse(doc).success).toBe(false);
  });
});

describe("computePropOffset", () => {
  it("is invisible and undrifted before its delay elapses", () => {
    const { dx, dy, opacity } = computePropOffset(0, 0, 90, 30, 0, 100);
    expect(opacity).toBeCloseTo(0);
    expect(dx).toBeCloseTo(0);
    expect(dy).toBeCloseTo(0);
  });

  it("drifts along a 0deg angle purely on the x axis", () => {
    const { dx, dy } = computePropOffset(90, 0, 90, 0, 0, 100);
    expect(dx).toBeCloseTo(100, 0);
    expect(dy).toBeCloseTo(0, 5);
  });

  it("drifts along a 90deg angle purely on the y axis", () => {
    const { dx, dy } = computePropOffset(90, 0, 90, 0, 90, 100);
    expect(dx).toBeCloseTo(0, 5);
    expect(dy).toBeCloseTo(100, 0);
  });

  it("is fully opaque well after the fade-in window", () => {
    const { opacity } = computePropOffset(90, 0, 90, 0, 0, 100);
    expect(opacity).toBeCloseTo(1);
  });
});

describe("computePropRotation", () => {
  it("stays at 0 before the prop's delay elapses", () => {
    expect(computePropRotation(10, 0, 30, 30, 180)).toBe(0);
  });

  it("accumulates rotation proportional to elapsed time after the delay", () => {
    // 30fps, drift starts at frame 30, rotateSpeed 90deg/s -> at frame 60 (1s after drift start), expect 90deg.
    expect(computePropRotation(60, 0, 30, 30, 90)).toBeCloseTo(90);
  });

  it("never rotates when rotateSpeedDegPerSec is 0", () => {
    expect(computePropRotation(300, 0, 0, 30, 0)).toBe(0);
  });
});
