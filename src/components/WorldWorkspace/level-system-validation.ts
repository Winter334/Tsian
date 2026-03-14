import type {
  LevelSystemConfig,
  PrimaryAttributeConfig,
} from "@/lib/world/types";

const NUMERIC_LITERAL_REGEX = /^-?\d+(?:\.\d+)?$/;
type PointsPerLevelValue = NonNullable<
  NonNullable<LevelSystemConfig["allocation"]>["pointsPerLevel"]
>;

export function validateLevelSystemConfig(
  config: LevelSystemConfig,
  primaryAttributes: PrimaryAttributeConfig[],
): string[] {
  const warnings: string[] = [];
  const primaryAttributeKeys = new Set(
    primaryAttributes.map((item) => item.key),
  );
  const levelAttributeKey = config.levelAttributeKey ?? "level";
  const growthMode = config.growthMode ?? "auto";
  const allocation = config.allocation;
  const progress = config.progress;
  const autoGrowth = config.autoGrowth;

  if (!primaryAttributeKeys.has(levelAttributeKey)) {
    warnings.push(
      `等级属性键「${levelAttributeKey}」未出现在主要属性列表中，升级时可能无法正确写入等级。`,
    );
  }

  if (growthMode === "allocation" || growthMode === "hybrid") {
    const allocatableAttributes = allocation?.allocatableAttributes ?? [];
    if (allocatableAttributes.length === 0) {
      warnings.push("当前成长模式需要至少配置一个可分配属性。");
    }

    if (!hasPositivePointsPerLevel(allocation?.pointsPerLevel)) {
      warnings.push("当前成长模式需要将每级发放点数设置为大于 0。");
    }
  }

  const progressLevels = progress?.levels ?? [];

  if (progressLevels.length === 0) {
    warnings.push("至少需要配置一条等级进度定义。建议从 1 级开始连续维护。");
  } else {
    const seenLevels = new Set<number>();
    let previousLevelValue: number | null = null;
    let previousRequiredProgress: number | null = null;

    for (const entry of progressLevels) {
      if (seenLevels.has(entry.level)) {
        warnings.push(`等级 ${entry.level} 出现重复定义，请保持每级唯一。`);
      }
      seenLevels.add(entry.level);

      if (!entry.name.trim()) {
        warnings.push(`等级 ${entry.level} 尚未填写等级名称。`);
      }

      if (
        previousLevelValue !== null &&
        entry.level !== previousLevelValue + 1
      ) {
        warnings.push(
          "等级进度定义建议按连续等级递增排列，避免运行时升级查表出现缺口。",
        );
        previousLevelValue = entry.level;
      } else {
        previousLevelValue = entry.level;
      }

      if (
        previousRequiredProgress !== null &&
        entry.requiredProgress < previousRequiredProgress
      ) {
        warnings.push("达到等级所需进度应保持非递减，确保升级阈值语义一致。");
      }
      previousRequiredProgress = entry.requiredProgress;
    }

    if (!seenLevels.has(1)) {
      warnings.push(
        "建议补充 1 级定义，并将所需进度设为 0，作为进度数组的起点。",
      );
    }
  }

  for (const attributeKey of allocation?.allocatableAttributes ?? []) {
    if (!primaryAttributeKeys.has(attributeKey)) {
      warnings.push(`可分配属性「${attributeKey}」未出现在主要属性列表中。`);
    }
  }

  for (const attributeKey of Object.keys(autoGrowth?.perLevel ?? {})) {
    if (!primaryAttributeKeys.has(attributeKey)) {
      warnings.push(`自动成长属性「${attributeKey}」未出现在主要属性列表中。`);
    }
  }

  return warnings;
}

function hasPositivePointsPerLevel(
  value: PointsPerLevelValue | undefined,
): boolean {
  if (typeof value === "number") {
    return value > 0;
  }

  if (typeof value !== "string") {
    return false;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }

  if (!NUMERIC_LITERAL_REGEX.test(trimmed)) {
    return true;
  }

  return Number(trimmed) > 0;
}
