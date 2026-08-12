import type { ImageProvider, ImageProviderName } from "./types";
import { RecraftImageProvider } from "./recraft";
import { FluxImageProvider } from "./flux";

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
    default:
      // Runtime guard: a pre-authored `scenes` request's imageProvider
      // field isn't schema-validated at the API layer the way the
      // script-only path's is, so a caller-supplied bad value should fail
      // clearly here rather than falling through to `undefined`.
      throw new Error(`Unknown image provider "${name}" — expected "recraft" or "flux".`);
  }
}

export function defaultImageProviderName(): ImageProviderName {
  const configured = process.env.IMAGE_PROVIDER;
  if (configured === "recraft" || configured === "flux") return configured;
  return "recraft";
}

export type { ImageProvider, ImageProviderName, GeneratedImage, RawGeneratedImage } from "./types";
