/**
 * 游戏开始向导步骤配置
 *
 * 配置驱动的设计，便于扩展新步骤
 *
 * 扩展指南：
 * 1. 添加新步骤组件到 ./steps/ 目录
 * 2. 在此配置中注册步骤
 * 3. 修改相关步骤的 getNextStep/getPrevStep
 * 4. 如需新模式，在 types.ts 的 GAME_MODES 中添加
 */

import { generateTalentCandidates } from "@/lib/rules/talent-draw";
import {
  aggregateDimensionEffects,
  type CharacterDimension,
  type WorldConfig,
} from "@/lib/world/types";
import {
  getManualTalentIds,
  getRemainingCreationAttributePoints,
  getTalentAttributePointCost,
} from "./talent-point-budget";

import type { GameMode, WizardContext, WizardStepConfig } from "./types";
import { GAME_MODES } from "./types";

// 步骤组件导入
import { JoinRoom } from "./steps/JoinRoom";
import { ModeSelection } from "./steps/ModeSelection";
import { RoomSettings } from "./steps/RoomSettings";
import { SoloCharacterCreation } from "./steps/SoloCharacterCreation";
import { WaitingLobby } from "./steps/WaitingLobby";
import { WorldSelectionStep } from "./steps/WorldSelectionStep";

// Phase 2 角色创建多步骤组件
import { createDimensionStepComponent } from "./steps/DimensionSelectionStep";
import { SoloCharAttributesStep } from "./steps/SoloCharAttributesStep";
import { SoloCharConfirmStep } from "./steps/SoloCharConfirmStep";
import { SoloCharNameStep } from "./steps/SoloCharNameStep";
import { SoloCharTalentsStep } from "./steps/SoloCharTalentsStep";

// ============================================================
// 固定步骤组件与验证的映射
// ============================================================

/** 固定步骤的组件和额外配置 */
const FIXED_STEP_REGISTRY: Record<
  string,
  {
    component: WizardStepConfig["component"];
    validate?: WizardStepConfig["validate"];
  }
> = {
  "solo-char-name": {
    component: SoloCharNameStep,
    validate: (ctx) => !!ctx.characterName?.trim(),
  },
  "solo-char-attributes": {
    component: SoloCharAttributesStep,
    validate: (ctx) => {
      const worldConfig = ctx.worldConfig;
      if (!worldConfig) {
        return false;
      }

      const selectedTalentIds = getManualTalentIds(
        worldConfig,
        ctx.dimensionSelections,
        ctx.talentIds,
      );

      return (
        getRemainingCreationAttributePoints(
          worldConfig,
          ctx.allocatedPoints,
          selectedTalentIds.length,
        ) === 0
      );
    },
  },
  "solo-char-talents": {
    component: SoloCharTalentsStep,
    validate: (ctx) => {
      const worldConfig = ctx.worldConfig;
      if (!worldConfig) {
        return false;
      }

      const dimensionEffects = aggregateDimensionEffects(
        worldConfig,
        ctx.dimensionSelections ?? {},
      );
      const selectedTalentIds = getManualTalentIds(
        worldConfig,
        ctx.dimensionSelections,
        ctx.talentIds,
      );
      const initialDrawCount = worldConfig.talentRules?.initialDrawCount ?? 2;
      const talentPointCost = getTalentAttributePointCost(worldConfig);
      const remainingAttributePoints = getRemainingCreationAttributePoints(
        worldConfig,
        ctx.allocatedPoints,
        selectedTalentIds.length,
      );

      if (selectedTalentIds.length >= initialDrawCount) {
        return true;
      }

      if (talentPointCost > 0 && remainingAttributePoints < talentPointCost) {
        return true;
      }

      const levelAttributeKey =
        worldConfig.levelSystem?.levelAttributeKey ?? "level";
      const defaultCharacterLevel =
        worldConfig.primaryAttributes.find(
          (attr) => attr.key === levelAttributeKey,
        )?.defaultValue ?? 1;
      const rawLevel = ctx.attributes?.[levelAttributeKey];
      const characterLevel =
        typeof rawLevel === "number"
          ? rawLevel
          : typeof rawLevel === "string"
            ? Number(rawLevel)
            : defaultCharacterLevel;

      const nextDrawPreview = generateTalentCandidates({
        allTalents: worldConfig.talents ?? [],
        ownedTalentIds: Array.from(new Set(ctx.talentIds ?? [])),
        characterLevel: Number.isFinite(characterLevel)
          ? characterLevel
          : defaultCharacterLevel,
        talentRules: worldConfig.talentRules,
        excludeTalentIds: dimensionEffects.excludedTalents,
      });

      return nextDrawPreview.candidates.length === 0;
    },
  },
  "solo-char-confirm": {
    component: SoloCharConfirmStep,
  },
};

// ============================================================
// 动态步骤生成
// ============================================================

/**
 * 根据 WorldConfig 动态生成向导步骤配置
 *
 * 从 worldConfig.dimensions 读取维度列表，动态构建 solo 模式的步骤链。
 * 维度步骤 ID 格式：`solo-dim-${dimension.id}`
 *
 * @param worldConfig 世界配置
 * @returns 完整的步骤配置映射
 */
export function generateWizardSteps(
  worldConfig: WorldConfig,
): Record<string, WizardStepConfig> {
  // 1. 从 WorldConfig 中提取有效维度，过滤空选项并按 order 排序
  const dimensions: CharacterDimension[] = (worldConfig.dimensions ?? [])
    .filter((d) => d.options.length > 0)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const dimensionStepIds = dimensions.map((d) => `solo-dim-${d.id}`);

  // 2. 构建 Solo 模式步骤链（不含 mode-selection，因为它是入口）
  const soloChain = [
    "solo-char-name",
    ...dimensionStepIds,
    "solo-char-attributes",
    "solo-char-talents",
    "solo-char-confirm",
  ];

  const steps: Record<string, WizardStepConfig> = {};

  // 3. mode-selection（入口步骤，保持不变）
  steps["mode-selection"] = {
    id: "mode-selection",
    component: ModeSelection,
    label: "模式",
    hideFooter: true, // 通过卡片直接前进，不需要 Footer 按钮
    getNextStep: (ctx: WizardContext) => {
      if (!ctx.mode) return null;

      // 根据模式配置决定下一步
      switch (ctx.mode) {
        case "solo":
          // 单人模式先显式选择世界，再进入角色创建向导
          return "world-selection";
        case "create-room":
          // Host 建房前先显式选择世界
          return "world-selection";
        case "join-room":
          return "join-room";
        default: {
          // 未知模式，使用配置的初始步骤
          const modeConfig = GAME_MODES[ctx.mode as GameMode];
          return modeConfig?.initialStep ?? null;
        }
      }
    },
    getPrevStep: () => null, // 第一步，返回 null 关闭向导
  };

  // 4. 世界选择步骤：单机/建房共用，加入房间继续使用 Host 权威 worldConfig
  steps["world-selection"] = {
    id: "world-selection",
    component: WorldSelectionStep,
    label: "世界",
    validate: (ctx) => Boolean(ctx.worldId),
    getNextStep: (ctx: WizardContext) => {
      if (ctx.mode === "solo") {
        return soloChain[0] ?? null;
      }

      if (ctx.mode === "create-room") {
        return "room-settings";
      }

      return null;
    },
    getPrevStep: () => "mode-selection",
  };

  // 5. 遍历 soloChain，为每个步骤生成配置
  soloChain.forEach((stepId, index) => {
    const prev = index === 0 ? "world-selection" : soloChain[index - 1];
    const next = index === soloChain.length - 1 ? null : soloChain[index + 1];

    if (stepId.startsWith("solo-dim-")) {
      // 维度步骤：从 dimensions 中查找对应维度
      const dimId = stepId.replace("solo-dim-", "");
      const dim = dimensions.find((d) => d.id === dimId)!;

      steps[stepId] = {
        id: stepId,
        component: createDimensionStepComponent(dim),
        label: dim.label,
        getNextStep: () => next,
        getPrevStep: () => prev,
      };
    } else {
      // 固定步骤：使用注册表中的组件，动态绑定 prev/next
      const fixedConfig = FIXED_STEP_REGISTRY[stepId];
      if (!fixedConfig) return;

      // 固定步骤的 label/hideFooter/nextLabel 配置
      const fixedStepMeta: Record<
        string,
        { label?: string; hideFooter?: boolean; nextLabel?: string }
      > = {
        "solo-char-name": { label: "名称" },
        "solo-char-attributes": { label: "属性" },
        "solo-char-talents": { label: "天赋" },
        "solo-char-confirm": { label: "确认", nextLabel: "开始冒险" },
      };

      const meta = fixedStepMeta[stepId] ?? {};

      steps[stepId] = {
        id: stepId,
        component: fixedConfig.component,
        getNextStep: () => next,
        getPrevStep: () => prev,
        ...(fixedConfig.validate ? { validate: fixedConfig.validate } : {}),
        ...meta,
      };
    }
  });

  // 6. 旧版单步角色创建（保留向后兼容）
  /** @deprecated 已被 solo-char-* 多步骤替代 */
  steps["solo-character-creation"] = {
    id: "solo-character-creation",
    component: SoloCharacterCreation,
    getNextStep: () => null,
    getPrevStep: () => "mode-selection",
  };

  // 7. 联机模式步骤（建房链路前置世界选择；加入房间保持 Host 权威）
  steps["room-settings"] = {
    id: "room-settings",
    component: RoomSettings,
    label: "房间设置",
    getNextStep: () => "waiting-lobby",
    getPrevStep: () => "world-selection",
  };

  steps["join-room"] = {
    id: "join-room",
    component: JoinRoom,
    label: "加入房间",
    getNextStep: () => "waiting-lobby",
    getPrevStep: () => "mode-selection",
  };

  steps["waiting-lobby"] = {
    id: "waiting-lobby",
    component: WaitingLobby,
    label: "等待大厅",
    getNextStep: () => null,
    getPrevStep: (ctx: WizardContext) => {
      return ctx.mode === "create-room" ? "room-settings" : "join-room";
    },
  };

  return steps;
}

/**
 * 获取初始步骤 ID
 */
export const INITIAL_STEP = "mode-selection";

/**
 * 获取模式的可用步骤列表（用于进度指示器）
 */
export function getStepsForMode(
  mode: GameMode,
  worldConfig: WorldConfig,
): string[] {
  switch (mode) {
    case "solo": {
      const dimensions = (worldConfig.dimensions ?? [])
        .filter((d) => d.options.length > 0)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      const dimensionStepIds = dimensions.map((d) => `solo-dim-${d.id}`);
      return [
        "mode-selection",
        "world-selection",
        "solo-char-name",
        ...dimensionStepIds,
        "solo-char-attributes",
        "solo-char-talents",
        "solo-char-confirm",
      ];
    }
    case "create-room":
      return [
        "mode-selection",
        "world-selection",
        "room-settings",
        "waiting-lobby",
      ];
    case "join-room":
      return ["mode-selection", "join-room", "waiting-lobby"];
    default:
      return ["mode-selection"];
  }
}

/**
 * 获取当前模式下可见的步骤列表（用于进度指示器）
 *
 * 根据 context.mode 确定步骤链，从 mode-selection 开始，
 * 沿着 getNextStep 链遍历，只返回有 label 的步骤。
 */
export function getVisibleSteps(
  steps: Map<string, WizardStepConfig>,
  context: WizardContext,
): Array<{ id: string; label: string }> {
  const result: Array<{ id: string; label: string }> = [];
  const visited = new Set<string>();

  let currentId: string | null = "mode-selection";

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const stepConfig = steps.get(currentId);
    if (!stepConfig) break;

    // 只收集有 label 的步骤
    if (stepConfig.label) {
      result.push({ id: stepConfig.id, label: stepConfig.label });
    }

    currentId = stepConfig.getNextStep(context);
  }

  return result;
}
