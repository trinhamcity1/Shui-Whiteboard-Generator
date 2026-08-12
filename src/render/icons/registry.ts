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
