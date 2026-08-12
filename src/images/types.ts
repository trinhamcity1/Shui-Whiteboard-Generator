export type ImageProviderName = "recraft" | "flux";

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
    opts: { styleVariant: string; orientation: "vertical" | "horizontal" },
  ): Promise<RawGeneratedImage>;
}
