import type { Character } from "@/domain/entities/character";
import type { WorldConfig } from "@/lib/world/types";

export interface PendingLevelAllocationState {
  pointAttributeKey: string;
  allocatableAttributes: string[];
  unspentPoints: number;
  maxPerAttribute?: number;
}

function normalizeAttributeKeys(
  attributeKeys: readonly string[] | undefined,
): string[] {
  if (!attributeKeys) {
    return [];
  }

  const uniqueKeys = new Set<string>();

  for (const attributeKey of attributeKeys) {
    const normalizedKey = attributeKey.trim();
    if (normalizedKey.length > 0) {
      uniqueKeys.add(normalizedKey);
    }
  }

  return Array.from(uniqueKeys);
}

function getSafeInteger(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.trunc(value));
}

export function getPendingLevelAllocationState(
  character: Character | null | undefined,
  worldConfig: WorldConfig,
): PendingLevelAllocationState | null {
  if (!character) {
    return null;
  }

  const levelSystem = worldConfig.levelSystem;
  if (!levelSystem) {
    return null;
  }

  const growthMode = levelSystem.growthMode;
  if (growthMode !== "allocation" && growthMode !== "hybrid") {
    return null;
  }

  const levelAttributeKey = levelSystem.levelAttributeKey?.trim() || "level";
  const allocationConfig = levelSystem.allocation;
  const pointAttributeKey =
    allocationConfig?.pointAttributeKey?.trim() || "unspent_attribute_points";

  const attributes = character.attributes ?? {};
  const unspentPoints = getSafeInteger(attributes[pointAttributeKey]);
  if (unspentPoints <= 0) {
    return null;
  }

  const configuredAllocatableAttributes = normalizeAttributeKeys(
    allocationConfig?.allocatableAttributes,
  );
  const allocatableAttributes =
    configuredAllocatableAttributes.length > 0
      ? configuredAllocatableAttributes
      : normalizeAttributeKeys(
          worldConfig.primaryAttributes
            .map((attribute) => attribute.key)
            .filter(
              (attributeKey) =>
                attributeKey !== levelAttributeKey &&
                attributeKey !== pointAttributeKey,
            ),
        );

  if (allocatableAttributes.length === 0) {
    return null;
  }

  const maxPerAttribute =
    typeof allocationConfig?.maxPerAttribute === "number" &&
    Number.isFinite(allocationConfig.maxPerAttribute)
      ? Math.max(1, Math.trunc(allocationConfig.maxPerAttribute))
      : undefined;

  return {
    pointAttributeKey,
    allocatableAttributes,
    unspentPoints,
    maxPerAttribute,
  };
}
