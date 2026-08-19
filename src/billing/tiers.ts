export type TierId = "siltstone" | "obsidian" | "alabaster" | "pyramidion";

export interface TierConfig {
  id: TierId;
  name: string;
  /** null = pay-as-you-go, no recurring subscription. */
  monthlyPriceUsd: number | null;
  /** Credits granted per billing period (0 for the pay-as-you-go tier — those credits come from top-ups instead). */
  monthlyCredits: number;
  /** Credits per minute for the scenes/narrationScript input modes. */
  baseCreditsPerMinute: number;
  /** Credits per minute for the topic input mode; null = topic mode not available on this tier. */
  topicCreditsPerMinute: number | null;
  maxLengthMinutes: number;
  apiAccess: boolean;
  uiAccess: boolean;
  verticalOnly: boolean;
  echoAccess: boolean;
}

// Pulled directly from the pricing plan document (shui-wg-pricing-plan.pdf)
// — see that doc for the real-cost margin check behind these numbers.
export const TIER_CONFIGS: Record<TierId, TierConfig> = {
  siltstone: {
    id: "siltstone",
    name: "Siltstone",
    monthlyPriceUsd: null,
    monthlyCredits: 0,
    baseCreditsPerMinute: 1,
    topicCreditsPerMinute: 1.5,
    maxLengthMinutes: 5,
    apiAccess: true,
    uiAccess: false,
    verticalOnly: false,
    echoAccess: false,
  },
  obsidian: {
    id: "obsidian",
    name: "Obsidian",
    monthlyPriceUsd: 20,
    monthlyCredits: 20,
    baseCreditsPerMinute: 1,
    topicCreditsPerMinute: null,
    maxLengthMinutes: 3,
    apiAccess: false,
    uiAccess: true,
    verticalOnly: true,
    echoAccess: false,
  },
  alabaster: {
    id: "alabaster",
    name: "Alabaster",
    monthlyPriceUsd: 50,
    monthlyCredits: 52.5,
    baseCreditsPerMinute: 1,
    topicCreditsPerMinute: 1.25,
    maxLengthMinutes: 5,
    apiAccess: true,
    uiAccess: true,
    verticalOnly: false,
    echoAccess: false,
  },
  pyramidion: {
    id: "pyramidion",
    name: "Pyramidion",
    monthlyPriceUsd: 200,
    monthlyCredits: 220,
    baseCreditsPerMinute: 1,
    topicCreditsPerMinute: 1.25,
    maxLengthMinutes: 10,
    apiAccess: true,
    uiAccess: true,
    verticalOnly: false,
    echoAccess: true,
  },
};

export function getTierConfig(tier: TierId): TierConfig {
  const config = TIER_CONFIGS[tier];
  if (!config) throw new Error(`Unknown billing tier "${tier}".`);
  return config;
}

/** Echo model training costs, in credits — Pyramidion-exclusive, drawn from the same wallet as video minutes. Dollar-equivalent at Pyramidion's $200/220 = $0.9091/credit rate: 22 credits = $20.00, 11 credits = $10.00. */
export const ECHO_TRAIN_CREDITS = 22;
export const ECHO_RETRAIN_CREDITS = 11;
