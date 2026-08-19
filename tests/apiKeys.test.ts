import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { createApiKey, getApiKeyByRawKey, getApiKeyById, listApiKeysForOwner, setApiKeyActive } from "../src/storage/firestore";

const REGISTRY_PATH = path.join(process.cwd(), "style-model-candidates", "api-keys-registry.json");

describe("api key storage", () => {
  beforeEach(() => {
    if (fs.existsSync(REGISTRY_PATH)) fs.rmSync(REGISTRY_PATH);
  });
  afterEach(() => {
    if (fs.existsSync(REGISTRY_PATH)) fs.rmSync(REGISTRY_PATH);
  });

  it("creates a key with a preview derived from the raw key's last 4 characters", async () => {
    const record = await createApiKey("swg_abcdef1234", "owner@example.com");
    expect(record.keyPreview).toBe("1234");
    expect(record.ownerLabel).toBe("owner@example.com");
    expect(record.isActive).toBe(true);
  });

  it("resolves a key by its raw value", async () => {
    await createApiKey("swg_rawkey000", "a@example.com");
    const found = await getApiKeyByRawKey("swg_rawkey000");
    expect(found?.ownerLabel).toBe("a@example.com");
  });

  it("returns null for an unknown raw key", async () => {
    const found = await getApiKeyByRawKey("swg_does_not_exist");
    expect(found).toBeNull();
  });

  it("lists every key sharing an ownerLabel, not other owners' keys", async () => {
    await createApiKey("swg_owner_a_1", "a@example.com");
    await createApiKey("swg_owner_a_2", "a@example.com");
    await createApiKey("swg_owner_b_1", "b@example.com");

    const aKeys = await listApiKeysForOwner("a@example.com");
    expect(aKeys).toHaveLength(2);
    expect(aKeys.every((k) => k.ownerLabel === "a@example.com")).toBe(true);
  });

  it("soft-revokes a key: isActive flips false, the record still resolves by id", async () => {
    const record = await createApiKey("swg_revoke_me", "owner@example.com");
    await setApiKeyActive(record.id, false);

    const found = await getApiKeyById(record.id);
    expect(found?.isActive).toBe(false);
  });
});
