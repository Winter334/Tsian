import type { WorldConfig } from "@/lib/world/types";
import { color, colorAlpha, glow } from "@/styles/tokens";

type ThemeColorKey = Parameters<typeof color>[0];
type GlowSize = Parameters<typeof glow>[1];

export type TalentRarityConfig = NonNullable<
  NonNullable<WorldConfig["talentRules"]>["rarities"]
>[number];

export const TALENT_RARITY_COLOR_TOKENS = [
  "textMuted",
  "primary",
  "secondary",
  "warning",
  "error",
] as const satisfies readonly ThemeColorKey[];

export const TALENT_RARITY_GLOW_TOKENS = [
  "textMuted",
  "primary",
  "secondary",
  "warning",
  "error",
] as const satisfies readonly ThemeColorKey[];

const TALENT_RARITY_THEME_KEYS = new Set<ThemeColorKey>([
  ...TALENT_RARITY_COLOR_TOKENS,
  ...TALENT_RARITY_GLOW_TOKENS,
]);

export interface TalentRarityVisualOptions {
  fallbackColor?: ThemeColorKey;
  fallbackGlow?: ThemeColorKey;
  backgroundAlpha?: number;
  borderAlpha?: number;
  glowAlpha?: number;
  glowSize?: GlowSize;
  strongGlowAlpha?: number;
  strongGlowSize?: GlowSize;
}

export interface TalentRarityVisual {
  colorKey: ThemeColorKey;
  glowKey: ThemeColorKey;
  accentColor: string;
  accentSoft: string;
  accentBorder: string;
  accentGlow: string;
  accentGlowStrong: string;
  glowSoft: string;
}

export function isTalentRarityThemeKey(value: string): value is ThemeColorKey {
  return TALENT_RARITY_THEME_KEYS.has(value as ThemeColorKey);
}

export function resolveTalentRarityThemeKey(
  token: string | undefined,
  fallback: ThemeColorKey,
): ThemeColorKey {
  const normalizedToken = token?.trim();
  if (!normalizedToken || !isTalentRarityThemeKey(normalizedToken)) {
    return fallback;
  }

  return normalizedToken;
}

export function getTalentRarityVisual(
  rarity:
    | Pick<TalentRarityConfig, "colorToken" | "glowToken">
    | null
    | undefined,
  options: TalentRarityVisualOptions = {},
): TalentRarityVisual {
  const fallbackColor = options.fallbackColor ?? "primary";
  const colorKey = resolveTalentRarityThemeKey(
    rarity?.colorToken,
    fallbackColor,
  );
  const glowKey = resolveTalentRarityThemeKey(
    rarity?.glowToken,
    options.fallbackGlow ?? colorKey,
  );
  const backgroundAlpha = clampAlpha(options.backgroundAlpha ?? 0.14);
  const borderAlpha = clampAlpha(options.borderAlpha ?? 0.3);
  const glowAlpha = clampAlpha(options.glowAlpha ?? 0.24);
  const strongGlowAlpha = clampAlpha(
    options.strongGlowAlpha ?? glowAlpha + 0.16,
  );
  const glowSize = options.glowSize ?? "md";
  const strongGlowSize = options.strongGlowSize ?? "lg";

  return {
    colorKey,
    glowKey,
    accentColor: color(colorKey),
    accentSoft: colorAlpha(colorKey, backgroundAlpha),
    accentBorder: colorAlpha(colorKey, borderAlpha),
    accentGlow: glow(glowKey, glowSize, glowAlpha),
    accentGlowStrong: glow(glowKey, strongGlowSize, strongGlowAlpha),
    glowSoft: colorAlpha(glowKey, clampAlpha(glowAlpha + 0.1)),
  };
}

function clampAlpha(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, value));
}
