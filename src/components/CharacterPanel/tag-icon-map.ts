import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  CircleDot,
  Clock,
  Droplets,
  EyeOff,
  Flame,
  Heart,
  Moon,
  Shield,
  Skull,
  Snowflake,
  Sparkles,
  Sun,
  Wind,
  Zap,
} from "lucide-react";

export const TAG_ICON_MAP: Record<string, LucideIcon> = {
  skull: Skull,
  flame: Flame,
  droplets: Droplets,
  snowflake: Snowflake,
  shield: Shield,
  zap: Zap,
  "eye-off": EyeOff,
  sparkles: Sparkles,
  wind: Wind,
  moon: Moon,
  sun: Sun,
  heart: Heart,
  clock: Clock,
  "alert-triangle": AlertTriangle,
};

export const DEFAULT_TAG_ICON: LucideIcon = CircleDot;

export function getTagIcon(iconName?: string): LucideIcon {
  if (!iconName) return DEFAULT_TAG_ICON;
  return TAG_ICON_MAP[iconName] ?? DEFAULT_TAG_ICON;
}
