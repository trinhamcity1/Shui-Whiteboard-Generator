import fs from "node:fs";
import path from "node:path";
import type { ImageProvider, ImageProviderName } from "./types";
import { RecraftImageProvider } from "./recraft";
import { FluxImageProvider } from "./flux";
import { TrainedStyleImageProvider } from "./trainedStyle";
import type { StyleModelVersion } from "./styleModel/types";

/** Same pattern as getTheme(styleVariant) — callers never import a concrete provider directly. */
export function getImageProvider(name: ImageProviderName): ImageProvider {
  switch (name) {
    case "recraft": {
      const apiKey = process.env.RECRAFT_API_KEY;
      if (!apiKey) throw new Error("RECRAFT_API_KEY is not set.");
      return new RecraftImageProvider(apiKey);
    }
    case "flux": {
      const apiKey = process.env.FLUX_API_KEY;
      if (!apiKey) throw new Error("FLUX_API_KEY is not set.");
      return new FluxImageProvider(apiKey);
    }
    case "trained-style": {
      const apiKey = process.env.FLUX_API_KEY; // same fal.ai key used for training
      if (!apiKey) throw new Error("FLUX_API_KEY is not set.");
      const versionPath = path.join(process.cwd(), "style-model-candidates", "style-model-version.json");
      if (!fs.existsSync(versionPath)) {
        throw new Error(
          `No trained style model found at ${versionPath} — run "npm run train-style-model -- --step=train" first.`,
        );
      }
      const styleModel = JSON.parse(fs.readFileSync(versionPath, "utf-8")) as StyleModelVersion;
      return new TrainedStyleImageProvider(apiKey, styleModel);
    }
    default:
      // Runtime guard: a pre-authored `scenes` request's imageProvider
      // field isn't schema-validated at the API layer the way the
      // script-only path's is, so a caller-supplied bad value should fail
      // clearly here rather than falling through to `undefined`.
      throw new Error(`Unknown image provider "${name}" — expected "recraft", "flux", or "trained-style".`);
  }
}

export function defaultImageProviderName(): ImageProviderName {
  const configured = process.env.IMAGE_PROVIDER;
  if (configured === "recraft" || configured === "flux" || configured === "trained-style") return configured;
  // Revision-2 Layer 2: the trained style model is now the correct default
  // for any live one-off fallback, so a new imageConcept generation
  // matches the asset library's style instead of reverting to the
  // original disconnected flat-vector Recraft/Flux path.
  return "trained-style";
}

export type { ImageProvider, ImageProviderName, GeneratedImage, RawGeneratedImage } from "./types";
