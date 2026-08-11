import type { NextFunction, Request, Response } from "express";
import { getApiKeyByRawKey } from "../../storage/firestore";
import { ApiError } from "../errors";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      apiKeyId?: string;
    }
  }
}

export async function requireApiKey(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const rawKey = req.header("x-api-key");
  if (!rawKey) {
    next(new ApiError(401, "Missing or invalid x-api-key header."));
    return;
  }

  try {
    const record = await getApiKeyByRawKey(rawKey);
    if (!record || !record.isActive) {
      next(new ApiError(401, "Missing or invalid x-api-key header."));
      return;
    }
    req.apiKeyId = record.id;
    next();
  } catch (err) {
    next(err);
  }
}
