import {
  aggregateDimensionEffects,
  type WorldConfig,
} from "../../lib/world/types";

function toSafeNonNegativeInteger(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.trunc(value))
    : 0;
}

export function getCreationAttributeBudget(
  worldConfig: WorldConfig | undefined,
): number {
  const allocatableAttributes =
    worldConfig?.pointBuyRules?.allocatableAttributes ?? [];
  if (allocatableAttributes.length === 0) {
    return 0;
  }

  return toSafeNonNegativeInteger(worldConfig?.pointBuyRules?.bonusPoints);
}

export function getTalentAttributePointCost(
  worldConfig: WorldConfig | undefined,
): number {
  if (getCreationAttributeBudget(worldConfig) <= 0) {
    return 0;
  }

  return toSafeNonNegativeInteger(worldConfig?.talentRules?.drawPointCost);
}

export function getAllocatedAttributePoints(
  allocatedPoints: Record<string, number> | undefined,
): number {
  return Object.values(allocatedPoints ?? {}).reduce(
    (sum, value) => sum + toSafeNonNegativeInteger(value),
    0,
  );
}

export function getManualTalentIds(
  worldConfig: WorldConfig | undefined,
  dimensionSelections: Record<string, string> | undefined,
  talentIds: string[] | undefined,
): string[] {
  const dimensionEffects = worldConfig
    ? aggregateDimensionEffects(worldConfig, dimensionSelections ?? {})
    : { grantedTalents: [], excludedTalents: [] };
  const grantedTalentIdSet = new Set(dimensionEffects.grantedTalents);
  const excludedTalentIdSet = new Set(dimensionEffects.excludedTalents);

  return Array.from(
    new Set(
      (talentIds ?? []).filter(
        (talentId): talentId is string =>
          typeof talentId === "string" && talentId.trim().length > 0,
      ),
    ),
  ).filter(
    (talentId) =>
      !grantedTalentIdSet.has(talentId) && !excludedTalentIdSet.has(talentId),
  );
}

export function getSpentTalentAttributePoints(
  worldConfig: WorldConfig | undefined,
  manualTalentCount: number,
): number {
  return (
    getTalentAttributePointCost(worldConfig) *
    Math.max(0, Math.trunc(manualTalentCount))
  );
}

export function getRemainingCreationAttributePoints(
  worldConfig: WorldConfig | undefined,
  allocatedPoints: Record<string, number> | undefined,
  manualTalentCount: number,
): number {
  return (
    getCreationAttributeBudget(worldConfig) -
    getAllocatedAttributePoints(allocatedPoints) -
    getSpentTalentAttributePoints(worldConfig, manualTalentCount)
  );
}

export function usesSharedTalentPointBudget(
  worldConfig: WorldConfig | undefined,
): boolean {
  return getTalentAttributePointCost(worldConfig) > 0;
}
