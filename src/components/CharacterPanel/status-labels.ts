import type { CharacterTag } from "@/hooks/useCharacterTags";

export const TIMING_LABEL_MAP: Record<
  "turn_start" | "on_damage" | "passive",
  string
> = {
  turn_start: "回合开始",
  on_damage: "受伤时",
  passive: "被动",
};

export const SOURCE_LABEL_MAP: Record<CharacterTag["source"], string> = {
  predefined: "系统预定义",
  "ai-generated": "AI 动态创造",
};

export function getTimingLabel(timing?: CharacterTag["timing"]): string {
  if (!timing) return "AI管理";
  return TIMING_LABEL_MAP[timing];
}
