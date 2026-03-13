import type { TalentConfig, WorldConfig } from "@/lib/world/types";

import { createSeededRandom } from "./dice";

export interface TalentDrawContext {
  allTalents: TalentConfig[];
  ownedTalentIds: string[];
  characterLevel: number;
  talentRules: WorldConfig["talentRules"];
  poolId?: string;
  guaranteedRarity?: string;
  offersPerDraw?: number;
  excludeTalentIds?: string[];
}

export interface TalentDrawResult {
  candidates: TalentConfig[];
  poolUsed: string | null;
}

type TalentRulesConfig = NonNullable<WorldConfig["talentRules"]>;
type TalentPoolConfig = NonNullable<TalentRulesConfig["pools"]>[number];
type TalentRarityConfig = NonNullable<TalentRulesConfig["rarities"]>[number];

const DEFAULT_OFFERS_PER_DRAW = 3;
const DEFAULT_DUPLICATE_POLICY = "exclude_owned" as const;

function hashString(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function createDeterministicRandom(ctx: TalentDrawContext): () => number {
  const rules = ctx.talentRules;
  const seedSource = [
    `level:${ctx.characterLevel}`,
    `pool:${ctx.poolId ?? ""}`,
    `guaranteed:${ctx.guaranteedRarity ?? ""}`,
    `offers:${ctx.offersPerDraw ?? ""}`,
    `owned:${[...ctx.ownedTalentIds].sort().join(",")}`,
    `exclude:${[...(ctx.excludeTalentIds ?? [])].sort().join(",")}`,
    `duplicate:${rules?.duplicatePolicy ?? DEFAULT_DUPLICATE_POLICY}`,
    `rarities:${(rules?.rarities ?? [])
      .map(
        (rarity) =>
          `${rarity.id}:${rarity.weight}:${rarity.label}:${rarity.colorToken ?? ""}:${rarity.glowToken ?? ""}:${rarity.minLevel ?? ""}`,
      )
      .sort()
      .join("|")}`,
    `pools:${(rules?.pools ?? [])
      .map(
        (pool) =>
          `${pool.id}:${pool.label ?? ""}:${(pool.allowedCategories ?? []).slice().sort().join(",")}:${(pool.allowedRarities ?? []).slice().sort().join(",")}:${(pool.includeTalentIds ?? []).slice().sort().join(",")}:${(pool.excludeTalentIds ?? []).slice().sort().join(",")}:${pool.minLevel ?? ""}`,
      )
      .sort()
      .join("|")}`,
    `talents:${ctx.allTalents
      .map(
        (talent) =>
          `${talent.id}:${talent.rarity ?? ""}:${talent.category ?? ""}:${talent.name}:${talent.draw?.weight ?? ""}:${talent.draw?.minLevel ?? ""}:${(talent.draw?.poolIds ?? []).slice().sort().join(",")}`,
      )
      .sort()
      .join("|")}`,
  ].join("::");

  const seed = hashString(seedSource) || 1;
  return createSeededRandom(seed);
}

function getTalentWeight(talent: TalentConfig): number {
  const weight = talent.draw?.weight;
  return typeof weight === "number" && weight > 0 ? weight : 1;
}

function getRarityWeight(rarity: TalentRarityConfig): number {
  return rarity.weight > 0 ? rarity.weight : 1;
}

function getRequestedCount(ctx: TalentDrawContext): number {
  const rawCount =
    ctx.offersPerDraw ??
    ctx.talentRules?.initialOffersPerDraw ??
    DEFAULT_OFFERS_PER_DRAW;

  if (!Number.isFinite(rawCount)) {
    return DEFAULT_OFFERS_PER_DRAW;
  }

  return Math.max(0, Math.floor(rawCount));
}

function dedupeTalents(allTalents: TalentConfig[]): TalentConfig[] {
  const uniqueById = new Map<string, TalentConfig>();

  for (const talent of allTalents) {
    if (!uniqueById.has(talent.id)) {
      uniqueById.set(talent.id, talent);
    }
  }

  return [...uniqueById.values()].sort((left, right) =>
    left.id.localeCompare(right.id),
  );
}

function findPool(
  rules: WorldConfig["talentRules"],
  poolId: string | undefined,
): TalentPoolConfig | null {
  if (!poolId) {
    return null;
  }

  return rules?.pools?.find((pool) => pool.id === poolId) ?? null;
}

function matchesPoolMembership(
  talent: TalentConfig,
  poolId: string | undefined,
): boolean {
  if (!poolId) {
    return true;
  }

  const poolIds = talent.draw?.poolIds;
  if (!poolIds || poolIds.length === 0) {
    return true;
  }

  return poolIds.includes(poolId);
}

function applyPoolFilter(
  talents: TalentConfig[],
  pool: TalentPoolConfig,
  characterLevel: number,
): TalentConfig[] {
  if ((pool.minLevel ?? 0) > characterLevel) {
    return [];
  }

  const includeIds = new Set(pool.includeTalentIds ?? []);
  const excludeIds = new Set(pool.excludeTalentIds ?? []);
  const allowedCategories = pool.allowedCategories?.length
    ? new Set(pool.allowedCategories)
    : null;
  const allowedRarities = pool.allowedRarities?.length
    ? new Set(pool.allowedRarities)
    : null;

  return talents.filter((talent) => {
    if (excludeIds.has(talent.id)) {
      return false;
    }

    if (includeIds.has(talent.id)) {
      return true;
    }

    if (!matchesPoolMembership(talent, pool.id)) {
      return false;
    }

    if (allowedCategories && !allowedCategories.has(talent.category ?? "")) {
      return false;
    }

    if (allowedRarities && !allowedRarities.has(talent.rarity ?? "")) {
      return false;
    }

    return true;
  });
}

function applyBaseFilter(
  talents: TalentConfig[],
  ctx: TalentDrawContext,
): TalentConfig[] {
  const duplicatePolicy =
    ctx.talentRules?.duplicatePolicy ?? DEFAULT_DUPLICATE_POLICY;
  const ownedIds = new Set(ctx.ownedTalentIds);
  const excludedIds = new Set(ctx.excludeTalentIds ?? []);

  return talents.filter((talent) => {
    if (duplicatePolicy === "exclude_owned" && ownedIds.has(talent.id)) {
      return false;
    }

    if (excludedIds.has(talent.id)) {
      return false;
    }

    return (talent.draw?.minLevel ?? 0) <= ctx.characterLevel;
  });
}

function getActiveRarities(
  rules: WorldConfig["talentRules"],
  characterLevel: number,
): TalentRarityConfig[] {
  return [...(rules?.rarities ?? [])]
    .filter((rarity) => (rarity.minLevel ?? 0) <= characterLevel)
    .sort((left, right) => left.id.localeCompare(right.id));
}

function buildRarityBuckets(
  talents: TalentConfig[],
  rarities: TalentRarityConfig[],
): Map<string, TalentConfig[]> {
  const activeRarityIds = new Set(rarities.map((rarity) => rarity.id));
  const buckets = new Map<string, TalentConfig[]>();

  for (const talent of talents) {
    if (!talent.rarity || !activeRarityIds.has(talent.rarity)) {
      continue;
    }

    const bucket = buckets.get(talent.rarity) ?? [];
    bucket.push(talent);
    buckets.set(talent.rarity, bucket);
  }

  return buckets;
}

function pickWeightedItem<T>(
  items: readonly T[],
  getWeight: (item: T) => number,
  random: () => number,
): T | null {
  if (items.length === 0) {
    return null;
  }

  const weights = items.map((item) => Math.max(0, getWeight(item)));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

  if (totalWeight <= 0) {
    return items[0] ?? null;
  }

  let cursor = random() * totalWeight;

  for (let index = 0; index < items.length; index += 1) {
    cursor -= weights[index] ?? 0;
    if (cursor <= 0) {
      return items[index] ?? null;
    }
  }

  return items[items.length - 1] ?? null;
}

function removeTalentById(
  talents: TalentConfig[],
  talentId: string,
): TalentConfig[] {
  return talents.filter((talent) => talent.id !== talentId);
}

function drawDirectWeightedCandidates(
  talents: TalentConfig[],
  count: number,
  random: () => number,
): TalentConfig[] {
  const remaining = [...talents];
  const results: TalentConfig[] = [];

  while (results.length < count && remaining.length > 0) {
    const selected = pickWeightedItem(remaining, getTalentWeight, random);
    if (!selected) {
      break;
    }

    results.push(selected);
    const nextRemaining = removeTalentById(remaining, selected.id);
    remaining.splice(0, remaining.length, ...nextRemaining);
  }

  return results;
}

function drawRarityWeightedCandidates(
  talents: TalentConfig[],
  count: number,
  random: () => number,
  rarities: TalentRarityConfig[],
  guaranteedRarity: string | undefined,
): TalentConfig[] {
  const results: TalentConfig[] = [];
  let remaining = [...talents];

  if (guaranteedRarity) {
    const guaranteedBucket = remaining.filter(
      (talent) => talent.rarity === guaranteedRarity,
    );
    const guaranteedTalent = pickWeightedItem(
      guaranteedBucket,
      getTalentWeight,
      random,
    );

    if (guaranteedTalent) {
      results.push(guaranteedTalent);
      remaining = removeTalentById(remaining, guaranteedTalent.id);
    }
  }

  while (results.length < count && remaining.length > 0) {
    const buckets = buildRarityBuckets(remaining, rarities);
    const availableRarities = rarities.filter(
      (rarity) => (buckets.get(rarity.id)?.length ?? 0) > 0,
    );

    if (availableRarities.length === 0) {
      break;
    }

    const rarity = pickWeightedItem(availableRarities, getRarityWeight, random);
    if (!rarity) {
      break;
    }

    const bucket = buckets.get(rarity.id) ?? [];
    const selectedTalent = pickWeightedItem(bucket, getTalentWeight, random);
    if (!selectedTalent) {
      break;
    }

    results.push(selectedTalent);
    remaining = removeTalentById(remaining, selectedTalent.id);
  }

  return results;
}

export function generateTalentCandidates(
  ctx: TalentDrawContext,
): TalentDrawResult {
  const requestedCount = getRequestedCount(ctx);
  const dedupedTalents = dedupeTalents(ctx.allTalents);
  const pool = findPool(ctx.talentRules, ctx.poolId);

  if (ctx.poolId && !pool) {
    return { candidates: [], poolUsed: null };
  }

  const poolCandidates = pool
    ? applyPoolFilter(dedupedTalents, pool, ctx.characterLevel)
    : dedupedTalents;
  const filteredCandidates = applyBaseFilter(poolCandidates, ctx);
  const activeRarities = getActiveRarities(ctx.talentRules, ctx.characterLevel);
  const hasRarityRules = activeRarities.length > 0;
  const rarityBuckets = hasRarityRules
    ? buildRarityBuckets(filteredCandidates, activeRarities)
    : null;
  const availableCandidates = hasRarityRules
    ? filteredCandidates.filter(
        (talent) => (rarityBuckets?.get(talent.rarity ?? "")?.length ?? 0) > 0,
      )
    : filteredCandidates;

  if (requestedCount === 0 || availableCandidates.length === 0) {
    return {
      candidates: [],
      poolUsed: pool?.id ?? null,
    };
  }

  if (availableCandidates.length <= requestedCount) {
    return {
      candidates: availableCandidates,
      poolUsed: pool?.id ?? null,
    };
  }

  const random = createDeterministicRandom(ctx);
  const candidates = hasRarityRules
    ? drawRarityWeightedCandidates(
        availableCandidates,
        requestedCount,
        random,
        activeRarities,
        activeRarities.some((rarity) => rarity.id === ctx.guaranteedRarity)
          ? ctx.guaranteedRarity
          : undefined,
      )
    : drawDirectWeightedCandidates(availableCandidates, requestedCount, random);

  return {
    candidates,
    poolUsed: pool?.id ?? null,
  };
}
