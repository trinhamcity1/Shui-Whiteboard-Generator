import { describe, expect, it } from "vitest";
import { cacheKeyFor } from "../src/images/cache";

describe("cacheKeyFor", () => {
  it("produces the same key for equivalent concepts (case/whitespace-insensitive)", () => {
    const a = cacheKeyFor("recraft", "classic-whiteboard", "a wooden ballot box");
    const b = cacheKeyFor("recraft", "classic-whiteboard", "  A Wooden Ballot Box  ");
    expect(a).toBe(b);
  });

  it("produces different keys for different providers", () => {
    const a = cacheKeyFor("recraft", "classic-whiteboard", "a ballot box");
    const b = cacheKeyFor("flux", "classic-whiteboard", "a ballot box");
    expect(a).not.toBe(b);
  });

  it("produces different keys for different style variants", () => {
    const a = cacheKeyFor("recraft", "classic-whiteboard", "a ballot box");
    const b = cacheKeyFor("recraft", "full-frame", "a ballot box");
    expect(a).not.toBe(b);
  });

  it("produces different keys for different concepts", () => {
    const a = cacheKeyFor("recraft", "classic-whiteboard", "a ballot box");
    const b = cacheKeyFor("recraft", "classic-whiteboard", "a gear icon");
    expect(a).not.toBe(b);
  });
});
