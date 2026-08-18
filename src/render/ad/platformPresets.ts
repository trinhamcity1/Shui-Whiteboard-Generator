import type { AdPlatform } from "../../schema/ad";

export interface PlatformPreset {
  width: number;
  height: number;
  fps: number;
}

// TikTok/Reels/Stories are all full-vertical 9:16; Facebook feed and X both
// skew toward a squarer/landscape-friendlier frame in practice, so they get
// their own preset rather than being forced into 9:16 too.
const PRESETS: Record<AdPlatform, PlatformPreset> = {
  tiktok: { width: 1080, height: 1920, fps: 30 },
  instagram: { width: 1080, height: 1920, fps: 30 },
  facebook: { width: 1080, height: 1080, fps: 30 },
  x: { width: 1920, height: 1080, fps: 30 },
};

export function getPlatformPreset(platform: AdPlatform): PlatformPreset {
  return PRESETS[platform];
}
