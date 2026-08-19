import "dotenv/config";
import crypto from "node:crypto";
import { createApiKey } from "../src/storage/firestore";

// Usage: npm run create-api-key -- "shui-backend"
async function main() {
  const ownerLabel = process.argv[2];
  if (!ownerLabel) {
    console.error('Usage: npm run create-api-key -- "<owner-label>"');
    process.exitCode = 1;
    return;
  }

  const rawKey = `swg_${crypto.randomBytes(24).toString("hex")}`;
  await createApiKey(rawKey, ownerLabel);

  console.log(`\nCreated API key for "${ownerLabel}". Save this now — it is not stored anywhere retrievable:\n`);
  console.log(`  ${rawKey}\n`);
}

main().catch((err) => {
  console.error("create-api-key failed:", err);
  process.exitCode = 1;
});
