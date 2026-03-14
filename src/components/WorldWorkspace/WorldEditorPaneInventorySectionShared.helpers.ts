import type { ItemCategory, ItemTemplate } from "@/domain/entities/item";
import type { SkillTemplate } from "@/domain/entities/skill";
import type { EquipSlotDefinition } from "@/lib/world/types";

export const ITEM_CATEGORY_OPTIONS = [
  { value: "weapon", label: "武器" },
  { value: "armor", label: "护甲" },
  { value: "accessory", label: "饰品" },
  { value: "consumable", label: "消耗品" },
  { value: "material", label: "材料" },
  { value: "quest", label: "任务物品" },
  { value: "misc", label: "杂项" },
] as const;

export const SKILL_CATEGORY_OPTIONS = [
  { value: "combat", label: "战斗" },
  { value: "magic", label: "魔法" },
  { value: "survival", label: "生存" },
  { value: "social", label: "社交" },
  { value: "craft", label: "制造" },
  { value: "misc", label: "其他" },
] as const;

export const MASTER_DETAIL_LIST_PANEL_CLASS =
  "max-h-72 overflow-y-auto p-3 sm:max-h-80 xl:flex xl:h-full xl:min-h-0 xl:max-h-none xl:flex-col xl:overflow-hidden xl:[&>div]:flex xl:[&>div]:min-h-0 xl:[&>div]:flex-1 xl:[&>div]:flex-col";

export const MASTER_DETAIL_LIST_CONTENT_CLASS =
  "space-y-2 xl:flex-1 xl:min-h-0 xl:overflow-y-auto";

const EQUIPPABLE_ITEM_CATEGORIES = new Set<ItemCategory>([
  "weapon",
  "armor",
  "accessory",
]);

function normalizeManagedTemplateId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^\p{L}\p{N}_-]+/gu, "")
    .replace(/_+/g, "_")
    .replace(/^[_-]+|[_-]+$/g, "");
}

function buildManagedTemplateId(name: string): string | null {
  const normalized = normalizeManagedTemplateId(name);
  return normalized.length > 0 ? normalized : null;
}

function shouldSyncManagedTemplateId(
  currentId: string,
  currentName: string,
  kind: "item" | "skill",
): boolean {
  const trimmedCurrentId = currentId.trim();
  const currentGeneratedId = buildManagedTemplateId(currentName);

  return (
    trimmedCurrentId.length === 0 ||
    trimmedCurrentId === currentGeneratedId ||
    trimmedCurrentId.startsWith(`${kind}-`) ||
    trimmedCurrentId === `${kind}_template` ||
    trimmedCurrentId.startsWith(`${kind}_template_`)
  );
}

export function buildManagedTemplateNameUpdate(
  currentId: string,
  currentName: string,
  nextName: string,
  kind: "item" | "skill",
): { name: string; id?: string } {
  const nextGeneratedId = buildManagedTemplateId(nextName);
  return {
    name: nextName,
    ...(nextGeneratedId &&
    shouldSyncManagedTemplateId(currentId, currentName, kind)
      ? { id: nextGeneratedId }
      : {}),
  };
}

export function resolveDisplayManagedTemplateId(
  id: string,
  name: string,
  kind: "item" | "skill",
): string {
  return id.trim() || buildManagedTemplateId(name) || `${kind}_template`;
}

export function getItemCategoryLabel(
  category: ItemTemplate["category"],
): string {
  return (
    ITEM_CATEGORY_OPTIONS.find((option) => option.value === category)?.label ??
    "杂项"
  );
}

export function getItemCategoryListLabel(
  categories?: readonly ItemCategory[],
): string {
  return categories && categories.length > 0
    ? categories.map((category) => getItemCategoryLabel(category)).join(" / ")
    : "不限类别";
}

export function getSkillCategoryLabel(
  category: SkillTemplate["category"],
): string {
  return (
    SKILL_CATEGORY_OPTIONS.find((option) => option.value === category)?.label ??
    "其他"
  );
}

export function getEquipSlotLabel(
  slot: string,
  equipSlotDefinitions: readonly EquipSlotDefinition[],
): string {
  return (
    equipSlotDefinitions.find((option) => option.id === slot)?.label ?? slot
  );
}

export function isEquippableItemCategory(
  category: ItemTemplate["category"],
): boolean {
  return EQUIPPABLE_ITEM_CATEGORIES.has(category);
}
