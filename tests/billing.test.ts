import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { creditAccount, debitAccount, getOrCreateAccount, listLedgerForOwner, setAccountTier } from "../src/storage/firestore";
import { InsufficientCreditsError } from "../src/billing/types";
import {
  assertApiAccess,
  assertEchoAccess,
  assertLengthAllowed,
  assertOrientationAllowed,
  creditsPerMinuteFor,
  estimateRequestMinutes,
  resolveBillingMode,
} from "../src/billing/gate";
import { ApiError } from "../src/api/errors";

const ACCOUNTS_PATH = path.join(process.cwd(), "style-model-candidates", "accounts-registry.json");
const LEDGER_PATH = path.join(process.cwd(), "style-model-candidates", "ledger-registry.json");

describe("credit wallet storage", () => {
  beforeEach(() => {
    if (fs.existsSync(ACCOUNTS_PATH)) fs.rmSync(ACCOUNTS_PATH);
    if (fs.existsSync(LEDGER_PATH)) fs.rmSync(LEDGER_PATH);
  });
  afterEach(() => {
    if (fs.existsSync(ACCOUNTS_PATH)) fs.rmSync(ACCOUNTS_PATH);
    if (fs.existsSync(LEDGER_PATH)) fs.rmSync(LEDGER_PATH);
  });

  it("creates a fresh account defaulting to siltstone with a zero balance", async () => {
    const account = await getOrCreateAccount("new@example.com");
    expect(account.tier).toBe("siltstone");
    expect(account.creditBalance).toBe(0);
  });

  it("credits add to the balance and record a ledger entry", async () => {
    await creditAccount("owner@example.com", 20, "topup");
    const account = await getOrCreateAccount("owner@example.com");
    expect(account.creditBalance).toBe(20);

    const ledger = await listLedgerForOwner("owner@example.com");
    expect(ledger).toHaveLength(1);
    expect(ledger[0]?.type).toBe("credit");
    expect(ledger[0]?.amount).toBe(20);
    expect(ledger[0]?.balanceAfter).toBe(20);
  });

  it("debits subtract from the balance and record a ledger entry", async () => {
    await creditAccount("owner@example.com", 20, "topup");
    const account = await debitAccount("owner@example.com", 7.5, "video:job-1");
    expect(account.creditBalance).toBe(12.5);

    const ledger = await listLedgerForOwner("owner@example.com");
    expect(ledger.some((e) => e.type === "debit" && e.amount === 7.5)).toBe(true);
  });

  it("refuses to debit more than the balance, leaving the balance unchanged", async () => {
    await creditAccount("owner@example.com", 5, "topup");
    await expect(debitAccount("owner@example.com", 10, "video:job-2")).rejects.toThrow(InsufficientCreditsError);

    const account = await getOrCreateAccount("owner@example.com");
    expect(account.creditBalance).toBe(5);
  });

  it("setAccountTier changes the tier without touching the balance (rollover behavior)", async () => {
    await creditAccount("owner@example.com", 30, "topup");
    const updated = await setAccountTier("owner@example.com", "alabaster");
    expect(updated.tier).toBe("alabaster");
    expect(updated.creditBalance).toBe(30);
  });
});

describe("billing gate", () => {
  it("resolveBillingMode reads the topic field, nothing else", () => {
    expect(resolveBillingMode({ topic: "a topic" })).toBe("topic");
    expect(resolveBillingMode({})).toBe("base");
  });

  it("creditsPerMinuteFor returns each tier's base rate", () => {
    expect(creditsPerMinuteFor("siltstone", "base")).toBe(1);
    expect(creditsPerMinuteFor("obsidian", "base")).toBe(1);
    expect(creditsPerMinuteFor("alabaster", "base")).toBe(1);
    expect(creditsPerMinuteFor("pyramidion", "base")).toBe(1);
  });

  it("creditsPerMinuteFor returns each tier's topic rate, per the pricing plan", () => {
    expect(creditsPerMinuteFor("siltstone", "topic")).toBe(1.5);
    expect(creditsPerMinuteFor("alabaster", "topic")).toBe(1.25);
    expect(creditsPerMinuteFor("pyramidion", "topic")).toBe(1.25);
  });

  it("Obsidian has no topic mode at any price", () => {
    expect(() => creditsPerMinuteFor("obsidian", "topic")).toThrow(ApiError);
  });

  it("Obsidian has no direct API access", () => {
    expect(() => assertApiAccess("obsidian")).toThrow(ApiError);
    expect(() => assertApiAccess("siltstone")).not.toThrow();
  });

  it("only Pyramidion has Echo model access", () => {
    expect(() => assertEchoAccess("alabaster")).toThrow(ApiError);
    expect(() => assertEchoAccess("pyramidion")).not.toThrow();
  });

  it("Obsidian is vertical-only", () => {
    expect(() => assertOrientationAllowed("obsidian", "horizontal")).toThrow(ApiError);
    expect(() => assertOrientationAllowed("obsidian", "vertical")).not.toThrow();
    expect(() => assertOrientationAllowed("alabaster", "horizontal")).not.toThrow();
  });

  it("rejects a request estimated to exceed the tier's max length", () => {
    expect(() => assertLengthAllowed("obsidian", 3.5)).toThrow(ApiError); // Obsidian caps at 3 min
    expect(() => assertLengthAllowed("obsidian", 2.9)).not.toThrow();
    expect(() => assertLengthAllowed("pyramidion", 9.9)).not.toThrow(); // Pyramidion caps at 10 min
  });

  it("estimateRequestMinutes prefers an explicit targetDurationSeconds", () => {
    expect(estimateRequestMinutes({ mode: "topic", targetDurationSeconds: 120 })).toBe(2);
  });

  it("estimateRequestMinutes falls back to a word-count estimate from narrationScript", () => {
    const words = new Array(150).fill("word").join(" "); // 150 words / (2.5 wps * 60) = 1 minute
    expect(estimateRequestMinutes({ mode: "base", narrationScript: words })).toBeCloseTo(1, 1);
  });

  it("estimateRequestMinutes defaults topic mode to the script-writer's own ~60s default, never 0", () => {
    expect(estimateRequestMinutes({ mode: "topic" })).toBeCloseTo(1, 1);
  });
});
