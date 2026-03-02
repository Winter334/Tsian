import {
  Boxes,
  FlaskConical,
  Gem,
  ScrollText,
  Shield,
  Star,
  Sword,
  Swords,
  Users,
  Wand2,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

const ICON_SIZE_CLASS_MAP = {
  sm: "w-3.5 h-3.5",
  md: "w-4 h-4",
} as const;

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  combat: Swords,
  magic: Wand2,
  survival: Shield,
  social: Users,
  craft: Wrench,
  weapon: Sword,
  armor: Shield,
  accessory: Gem,
  consumable: FlaskConical,
  material: Boxes,
  quest: ScrollText,
};

type CategoryIconSize = keyof typeof ICON_SIZE_CLASS_MAP;

interface GetCategoryIconOptions {
  /**
   * 当 category 为 misc 时使用的图标。
   * misc 在不同上下文语义不一致，因此不放入全局 CATEGORY_ICONS。
   */
  miscIcon?: LucideIcon;
  /**
   * 未命中映射时的兜底图标，默认 Star。
   */
  fallback?: LucideIcon;
  /**
   * 图标尺寸：
   * - sm: w-3.5 h-3.5
   * - md: w-4 h-4
   */
  size?: CategoryIconSize;
}

export function getCategoryIcon(
  category: string | undefined,
  options: GetCategoryIconOptions = {},
): ReactNode {
  const { miscIcon, fallback = Star, size = "sm" } = options;

  const Icon =
    category === "misc"
      ? (miscIcon ?? fallback)
      : category
        ? (CATEGORY_ICONS[category] ?? fallback)
        : fallback;

  return <Icon className={ICON_SIZE_CLASS_MAP[size]} />;
}
