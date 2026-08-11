import fs from "node:fs";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  endpoint: string;
}

export function loadR2ConfigFromEnv(): R2Config {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME;
  const endpoint = process.env.R2_ENDPOINT;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName || !endpoint) {
    throw new Error(
      "Missing R2 configuration. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_ENDPOINT in .env.",
    );
  }

  return { accountId, accessKeyId, secretAccessKey, bucketName, endpoint };
}

function buildClient(config: R2Config): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

/**
 * Uploads a local file to shui-wg's R2 bucket and returns a presigned GET
 * URL — works regardless of whether the bucket has public access enabled,
 * so Phase 0/1 don't need to also configure R2 public-bucket settings just
 * to get a usable URL back.
 */
export async function uploadRenderToR2(args: {
  localFilePath: string;
  key: string;
  config?: R2Config;
  expiresInSeconds?: number;
}): Promise<{ url: string; key: string }> {
  const config = args.config ?? loadR2ConfigFromEnv();
  const client = buildClient(config);
  const body = fs.readFileSync(args.localFilePath);

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucketName,
      Key: args.key,
      Body: body,
      ContentType: "video/mp4",
    }),
  );

  const url = await getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: config.bucketName, Key: args.key }),
    { expiresIn: args.expiresInSeconds ?? 60 * 60 * 24 * 7 },
  );

  return { url, key: args.key };
}
