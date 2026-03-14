import type { TalentConfig } from "@/lib/world/types";

export const TALENT_CATEGORY_OPTIONS = [
  { value: "combat", label: "战斗" },
  { value: "magic", label: "魔法" },
  { value: "survival", label: "生存" },
  { value: "social", label: "社交" },
  { value: "misc", label: "其他" },
] as const;

export const TALENT_DUPLICATE_POLICY_OPTIONS = [
  { value: "exclude_owned", label: "排除已拥有" },
  { value: "allow_repeat", label: "允许重复" },
] as const;

export function getTalentCategoryLabel(
  category?: TalentConfig["category"],
): string {
  return (
    TALENT_CATEGORY_OPTIONS.find(
      (option) => option.value === (category ?? "misc"),
    )?.label ?? "其他"
  );
}
