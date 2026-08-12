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

let cachedClient: { client: S3Client; config: R2Config } | undefined;

function buildClient(config: R2Config): S3Client {
  if (cachedClient && cachedClient.config === config) return cachedClient.client;
  const client = new S3Client({
    region: "auto",
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
  cachedClient = { client, config };
  return client;
}

const DEFAULT_EXPIRY_SECONDS = 60 * 60 * 24 * 7;

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
  const body = fs.readFileSync(args.localFilePath);
  return uploadBufferToR2({ ...args, buffer: body, contentType: "video/mp4" });
}

/** Same as uploadRenderToR2, but for in-memory bytes (e.g. a generated image). */
export async function uploadBufferToR2(args: {
  buffer: Buffer;
  key: string;
  contentType: string;
  config?: R2Config;
  expiresInSeconds?: number;
}): Promise<{ url: string; key: string }> {
  const config = args.config ?? loadR2ConfigFromEnv();
  const client = buildClient(config);

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucketName,
      Key: args.key,
      Body: args.buffer,
      ContentType: args.contentType,
    }),
  );

  const url = await getPresignedUrlForKey({ key: args.key, config, expiresInSeconds: args.expiresInSeconds });
  return { url, key: args.key };
}

/**
 * Regenerates a fresh presigned GET URL for an object that's already in
 * the bucket — used on a cache hit, since a URL presigned at upload time
 * may have long since expired by the time the same image is reused.
 */
export async function getPresignedUrlForKey(args: {
  key: string;
  config?: R2Config;
  expiresInSeconds?: number;
}): Promise<string> {
  const config = args.config ?? loadR2ConfigFromEnv();
  const client = buildClient(config);
  return getSignedUrl(client, new GetObjectCommand({ Bucket: config.bucketName, Key: args.key }), {
    expiresIn: args.expiresInSeconds ?? DEFAULT_EXPIRY_SECONDS,
  });
}
