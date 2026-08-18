import { describe, expect, it } from "vitest";
import { AdDocument, AdRequestSchema, durationTierLabel, parseAdDocument } from "../src/schema/ad";

const validRequest = {
  mode: "ad",
  businessName: "Riverside Coffee Co.",
  businessType: "local-business",
  productDescription: "Small-batch cold brew, delivered same-day in the metro area",
  productImages: [{ url: "https://example.com/bag.jpg", label: "product front" }],
  platform: "instagram",
  durationSeconds: "auto",
  voice: "voice-id",
};

const validDocument = {
  schemaVersion: 2,
  templateId: "problem-solution",
  platform: "instagram",
  voice: "voice-id",
  durationSeconds: 10,
  targetAudience: "busy professionals",
  productImages: [{ url: "https://example.com/bag.jpg" }],
  beats: [
    { id: "hook", role: "attention", atSeconds: 0, durationSeconds: 3, text: "Still waiting in line?" },
    { id: "cta", role: "direction", atSeconds: 3, durationSeconds: 3, ctaLabel: "Order now" },
  ],
};

describe("AdRequestSchema", () => {
  it("accepts a well-formed request", () => {
    expect(AdRequestSchema.safeParse(validRequest).success).toBe(true);
  });

  it("rejects a request with no product images", () => {
    const result = AdRequestSchema.safeParse({ ...validRequest, productImages: [] });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown platform", () => {
    const result = AdRequestSchema.safeParse({ ...validRequest, platform: "snapchat" });
    expect(result.success).toBe(false);
  });

  it("accepts an explicit numeric duration", () => {
    const result = AdRequestSchema.safeParse({ ...validRequest, durationSeconds: 15 });
    expect(result.success).toBe(true);
  });
});

describe("AdDocument schema", () => {
  it("accepts a well-formed document", () => {
    expect(AdDocument.safeParse(validDocument).success).toBe(true);
  });

  it("rejects a beat with none of text/photoRef/promoBadge/ctaLabel", () => {
    const malformed = { ...validDocument, beats: [{ id: "a", role: "attention", atSeconds: 0, durationSeconds: 3 }] };
    expect(AdDocument.safeParse(malformed).success).toBe(false);
  });

  it("rejects a direction beat with no ctaLabel or promoBadge", () => {
    const malformed = {
      ...validDocument,
      beats: [{ id: "a", role: "direction", atSeconds: 0, durationSeconds: 3, text: "just narration" }],
    };
    expect(AdDocument.safeParse(malformed).success).toBe(false);
  });

  it("rejects an out-of-range photoRef.imageIndex shape (negative)", () => {
    const malformed = {
      ...validDocument,
      beats: [
        {
          id: "a",
          role: "attention",
          atSeconds: 0,
          durationSeconds: 3,
          photoRef: { imageIndex: -1 },
        },
      ],
    };
    expect(AdDocument.safeParse(malformed).success).toBe(false);
  });

  it("parseAdDocument throws AdValidationError on bad input", () => {
    expect(() => parseAdDocument({ schemaVersion: 2 })).toThrow();
  });
});

describe("durationTierLabel", () => {
  it("maps a bumper-length duration to the under-6s tier", () => {
    expect(durationTierLabel(4)).toMatch(/Under 6s/);
  });

  it("maps a Stories/TikTok-length duration to the 6-15s tier", () => {
    expect(durationTierLabel(10)).toMatch(/6-15s/);
  });

  it("maps a feed-length duration to the 15-30s tier", () => {
    expect(durationTierLabel(25)).toMatch(/15-30s/);
  });

  it("maps a long duration to the 30s+ tier", () => {
    expect(durationTierLabel(45)).toMatch(/30s\+/);
  });
});
