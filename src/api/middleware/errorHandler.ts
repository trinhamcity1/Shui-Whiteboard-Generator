import type { ErrorRequestHandler } from "express";
import { ApiError } from "../errors";
import { SceneValidationError } from "../../schema/scene";
import { InsufficientCreditsError } from "../../billing/types";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({ detail: err.detail });
    return;
  }

  if (err instanceof InsufficientCreditsError) {
    res.status(402).json({
      detail: `Insufficient credits: this needs ${err.required.toFixed(2)}, your account has ${err.available.toFixed(2)}.`,
    });
    return;
  }

  if (err instanceof SceneValidationError) {
    res.status(422).json({ detail: err.issues });
    return;
  }

  if (err instanceof SyntaxError && "body" in err) {
    res.status(400).json({ detail: "Malformed JSON body." });
    return;
  }

  if (typeof err === "object" && err !== null && "type" in err && err.type === "entity.too.large") {
    res.status(413).json({ detail: "Request body too large." });
    return;
  }

  console.error("Unexpected error:", err);
  res.status(500).json({ detail: "Internal server error." });
};
