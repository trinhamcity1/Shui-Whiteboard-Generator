import type { ComponentType, SVGProps } from "react";
import {
  ScaleIcon,
  BookOpenIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  XCircleIcon,
  GlobeAltIcon,
  UsersIcon,
  StarIcon,
  AcademicCapIcon,
  ShieldCheckIcon,
  CalendarIcon,
  ChatBubbleLeftRightIcon,
  LightBulbIcon,
  CurrencyDollarIcon,
  HomeIcon,
  MapPinIcon,
  ClockIcon,
  FlagIcon,
  QuestionMarkCircleIcon,
} from "@heroicons/react/24/solid";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

// The fixed icon vocabulary — a scene planner (human or LLM) may only
// reference names from this list. Heroicons (MIT license, see ICONS.md).
export const ICON_REGISTRY: Record<string, IconComponent> = {
  "scale-of-justice": ScaleIcon,
  "book-open": BookOpenIcon,
  "document-text": DocumentTextIcon,
  "check-circle": CheckCircleIcon,
  "x-circle": XCircleIcon,
  globe: GlobeAltIcon,
  users: UsersIcon,
  star: StarIcon,
  "academic-cap": AcademicCapIcon,
  "shield-check": ShieldCheckIcon,
  calendar: CalendarIcon,
  "chat-bubble": ChatBubbleLeftRightIcon,
  "light-bulb": LightBulbIcon,
  "currency-dollar": CurrencyDollarIcon,
  home: HomeIcon,
  "map-pin": MapPinIcon,
  clock: ClockIcon,
  flag: FlagIcon,
};

export const AVAILABLE_ICON_NAMES = Object.keys(ICON_REGISTRY);

export function getIconComponent(name: string): IconComponent {
  const icon = ICON_REGISTRY[name];
  if (!icon) {
    console.warn(`Unknown icon "${name}" — falling back to a generic placeholder icon.`);
    return QuestionMarkCircleIcon;
  }
  return icon;
}

/**
 * Maps the same fixed icon vocabulary onto a hand-drawn library asset —
 * IconCallout renders this image instead of the flat Heroicons badge above,
 * which was the one component in the whole render pipeline that never
 * touched the sketch-style art (a real product-feedback complaint: it read
 * as a generic, "cheap" component next to everything else). The Heroicons
 * registry above stays only as the pre-resolution fallback (previewPlan.ts,
 * any render that hasn't gone through resolveImages yet).
 */
export const ICON_ASSET_ID_MAP: Record<string, string> = {
  "scale-of-justice": "prop-scale-balance",
  "book-open": "prop-book",
  "document-text": "prop-document",
  "check-circle": "prop-checkmark",
  "x-circle": "prop-x-mark",
  globe: "prop-globe",
  users: "prop-two-people",
  star: "prop-star",
  "academic-cap": "prop-graduation-cap",
  "shield-check": "prop-shield",
  calendar: "prop-calendar",
  "chat-bubble": "prop-speech-bubble",
  "light-bulb": "prop-lightbulb",
  "currency-dollar": "prop-dollar-sign",
  home: "prop-house",
  "map-pin": "prop-map-pin",
  clock: "prop-clock",
  flag: "prop-flag",
};
