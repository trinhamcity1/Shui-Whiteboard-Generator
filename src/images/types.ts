export type ImageProviderName = "recraft" | "flux" | "trained-style";

/** What a provider's raw API call returns, before caching/upload. */
export interface RawGeneratedImage {
  imageBuffer: Buffer;
  contentType: string; // "image/svg+xml" for Recraft, "image/png" for Flux
  widthPx: number;
  heightPx: number;
  costUsd: number;
}

/** What the cache/pipeline layer returns after resolving a concept to a real image. */
export interface GeneratedImage {
  imageUrl: string; // presigned R2 URL
  provider: ImageProviderName;
  costUsd: number; // 0 on a cache hit
  cacheHit: boolean;
  widthPx: number;
  heightPx: number;
}

export interface ImageProvider {
  readonly name: ImageProviderName;
  generate(
    concept: string,
    opts: {
      styleVariant: string;
      orientation: "vertical" | "horizontal";
      /** "cutout" (default): a character/prop meant to be composited over
       * something else — generated against a flat background and run
       * through background removal for real transparency. "scene": a full
       * illustrated backdrop (a ship on the ocean, a forest, a palace
       * interior) shown whole — background removal would strip out the
       * very thing that was asked for, so it's skipped entirely. */
      backgroundMode?: "cutout" | "scene";
    },
  ): Promise<RawGeneratedImage>;
}
