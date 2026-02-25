/**
 * NPC 列表组件
 *
 * 在角色面板中展示当前存档的 NPC 列表：
 * - 按状态分组（在场 active / 离场 off_scene）
 * - 点击展开/收起详细信息
 * - archived / dead 状态不展示
 *
 * 数据从 Yjs 文档中只读获取
 */

import type { Easing } from "framer-motion";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  ChevronDown,
  Circle,
  Shield,
  Sparkles,
  Star,
  Swords,
  Users,
  Wand2,
  Wrench,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { yjsManager } from "@/core/yjs";
import type { Character } from "@/domain/entities/character";
import { useCharacterFullStats } from "@/hooks/useCharacterFullStats";
import { useRuntimeWorldConfig } from "@/hooks/useRuntimeWorldConfig";
import type { TalentConfig, WorldConfig } from "@/lib/world/types";
import { resolveDimensionSelections } from "@/lib/world/types";
import { useCurrentSaveId } from "@/modules";
import { yMapToCharacter } from "@/modules/game/repository";
import { color, colorAlpha } from "@/styles/tokens";
import { CharacterRadarChart } from "./CharacterRadarChart";
import { CharacterResources } from "./CharacterResources";
import { EquipmentSection } from "./EquipmentSection";
import { InventorySection } from "./InventorySection";
import { SkillSection } from "./SkillSection";

// ── 动画 ──

const easeOut: Easing = [0.0, 0.0, 0.2, 1.0];

const expandVariants = {
  collapsed: {
    height: 0,
    opacity: 0,
    transition: { duration: 0.25, ease: easeOut },
  },
  expanded: {
    height: "auto",
    opacity: 1,
    transition: { duration: 0.3, ease: easeOut },
  },
};

const listItemVariants = {
  hidden: { opacity: 0, x: -10 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: i * 0.06,
      duration: 0.25,
      ease: easeOut,
    },
  }),
};

// ── 工具函数（复用 CharacterPanel 的查找逻辑） ──

function getCategoryIcon(category?: TalentConfig["category"]) {
  switch (category) {
    case "combat":
      return <Swords className="w-3 h-3" />;
    case "magic":
      return <Wand2 className="w-3 h-3" />;
    case "survival":
      return <Shield className="w-3 h-3" />;
    case "social":
      return <Users className="w-3 h-3" />;
    case "misc":
      return <Wrench className="w-3 h-3" />;
    default:
      return <Star className="w-3 h-3" />;
  }
}

// ── Hook: 从 Yjs 读取 NPC 角色列表 ──

/**
 * 从当前存档读取所有 NPC 角色（controlType === 'npc'）
 * 排除 archived 和 dead 状态
 */
export function useNpcCharacters(): Character[] {
  const [npcs, setNpcs] = useState<Character[]>([]);
  const currentSaveId = useCurrentSaveId();

  const readNpcs = useCallback(() => {
    const currentSave = yjsManager.getCurrentSave();
    if (!currentSave) {
      setNpcs([]);
      return;
    }

    const charactersMap = currentSave.get("characters") as
      | import("yjs").Map<import("yjs").Map<unknown>>
      | undefined;

    if (charactersMap && charactersMap.size > 0) {
      const npcChars: Character[] = [];
      charactersMap.forEach((charMap) => {
        const char = yMapToCharacter(charMap);
        if (
          char.controlType === "npc" &&
          (char.status === "active" || char.status === "off_scene")
        ) {
          npcChars.push(char);
        }
      });

      setNpcs(npcChars);
      return;
    }

    setNpcs([]);
  }, []);

  useEffect(() => {
    readNpcs();

    const currentSave = yjsManager.getCurrentSave();
    if (!currentSave) return;

    const saveHandler = () => readNpcs();
    currentSave.observe(saveHandler);

    const charactersMap = currentSave.get("characters") as
      | import("yjs").Map<import("yjs").Map<unknown>>
      | undefined;

    if (charactersMap) {
      const mapHandler = () => readNpcs();
      charactersMap.observeDeep(mapHandler);

      return () => {
        charactersMap.unobserveDeep(mapHandler);
        currentSave.unobserve(saveHandler);
      };
    }

    return () => {
      currentSave.unobserve(saveHandler);
    };
  }, [readNpcs, currentSaveId]);

  return npcs;
}

// ── NPC 详情面板 ──

interface NpcDetailPanelProps {
  character: Character;
  worldConfig: WorldConfig;
}

function NpcDetailPanel({ character, worldConfig }: NpcDetailPanelProps) {
  const fullStats = useCharacterFullStats(character, worldConfig);
  const allocatableKeys =
    worldConfig.pointBuyRules?.allocatableAttributes ?? [];

  const talentInfos = useMemo(() => {
    const ids = character.talentIds ?? [];
    return ids
      .map((id) => worldConfig.talents?.find((t) => t.id === id))
      .filter((t): t is TalentConfig => t != null);
  }, [character.talentIds, worldConfig.talents]);

  return (
    <div className="space-y-3 pt-2">
      {/* 基本信息（维度选择） */}
      {character.dimensionSelections &&
        Object.keys(character.dimensionSelections).length > 0 && (
          <div className="space-y-1">
            {resolveDimensionSelections(
              worldConfig,
              character.dimensionSelections,
            ).map((d) => (
              <div key={d.dimensionId} className="flex items-baseline gap-2">
                <span
                  className="text-xs font-medium shrink-0 w-12"
                  style={{ color: color("textMuted") }}
                >
                  {d.dimensionLabel}
                </span>
                <span
                  className="text-xs"
                  style={{ color: color("textSecondary") }}
                >
                  {d.option?.name ?? "未选择"}
                </span>
              </div>
            ))}
          </div>
        )}

      {/* 年龄和性别 */}
      {(character.age != null || character.gender) && (
        <div className="flex items-center gap-3">
          {character.gender && (
            <div className="flex items-baseline gap-1">
              <span
                className="text-xs font-medium"
                style={{ color: color("textMuted") }}
              >
                性别
              </span>
              <span
                className="text-xs"
                style={{ color: color("textSecondary") }}
              >
                {character.gender}
              </span>
            </div>
          )}
          {character.age != null && (
            <div className="flex items-baseline gap-1">
              <span
                className="text-xs font-medium"
                style={{ color: color("textMuted") }}
              >
                年龄
              </span>
              <span
                className="text-xs"
                style={{ color: color("textSecondary") }}
              >
                {character.age}
              </span>
            </div>
          )}
        </div>
      )}

      {/* 外貌 */}
      {character.appearance && (
        <div>
          <div
            className="flex items-center gap-1.5 mb-1"
            style={{ color: color("textMuted") }}
          >
            <BookOpen className="w-3 h-3" />
            <span className="text-xs font-medium">外貌</span>
          </div>
          <p
            className="text-xs leading-relaxed pl-4"
            style={{ color: color("textSecondary") }}
          >
            {character.appearance}
          </p>
        </div>
      )}

      {/* 性格 */}
      {character.personality && (
        <div>
          <div
            className="flex items-center gap-1.5 mb-1"
            style={{ color: color("textMuted") }}
          >
            <Users className="w-3 h-3" />
            <span className="text-xs font-medium">性格</span>
          </div>
          <p
            className="text-xs leading-relaxed pl-4"
            style={{ color: color("textSecondary") }}
          >
            {character.personality}
          </p>
        </div>
      )}

      {/* 属性雷达图 */}
      {allocatableKeys.length > 0 && (
        <div>
          <div
            className="flex items-center gap-1.5 mb-1.5"
            style={{ color: color("textMuted") }}
          >
            <Shield className="w-3 h-3" />
            <span className="text-xs font-medium">属性</span>
          </div>
          <CharacterRadarChart
            worldConfig={worldConfig}
            fullStats={fullStats}
          />
        </div>
      )}

      {/* 资源条 */}
      <CharacterResources fullStats={fullStats} worldConfig={worldConfig} />

      {/* 天赋 */}
      {talentInfos.length > 0 && (
        <div>
          <div
            className="flex items-center gap-1.5 mb-1.5"
            style={{ color: color("textMuted") }}
          >
            <Sparkles className="w-3 h-3" />
            <span className="text-xs font-medium">天赋</span>
          </div>
          <div className="space-y-1 pl-4">
            {talentInfos.map((talent) => (
              <div
                key={talent.id}
                className="flex items-start gap-1.5 rounded px-1.5 py-1"
                style={{
                  background: colorAlpha("primary", 0.03),
                  border: `1px solid ${colorAlpha("primary", 0.06)}`,
                }}
              >
                <span className="mt-0.5" style={{ color: color("primary") }}>
                  {getCategoryIcon(talent.category)}
                </span>
                <div className="flex-1 min-w-0">
                  <span
                    className="text-xs font-semibold"
                    style={{ color: color("textPrimary") }}
                  >
                    {talent.name}
                  </span>
                  <p
                    className="text-xs mt-0.5"
                    style={{ color: color("textMuted") }}
                  >
                    {talent.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 技能列表 */}
      <SkillSection characterId={character.id} />

      {/* 背包（只读） */}
      <InventorySection
        characterId={character.id}
        worldConfig={worldConfig}
        readonly
      />

      {/* 装备栏（只读） */}
      <EquipmentSection
        characterId={character.id}
        worldConfig={worldConfig}
        readonly
      />

      {/* 背景故事 */}
      {character.description && (
        <div>
          <div
            className="flex items-center gap-1.5 mb-1"
            style={{ color: color("textMuted") }}
          >
            <BookOpen className="w-3 h-3" />
            <span className="text-xs font-medium">背景故事</span>
          </div>
          <p
            className="text-xs leading-relaxed pl-4"
            style={{ color: color("textSecondary") }}
          >
            {character.description}
          </p>
        </div>
      )}
    </div>
  );
}

// ── NPC 列表项 ──

interface NpcListItemProps {
  character: Character;
  index: number;
  isOffScene?: boolean;
  worldConfig: WorldConfig;
}

function NpcListItem({
  character,
  index,
  isOffScene,
  worldConfig,
}: NpcListItemProps) {
  const [expanded, setExpanded] = useState(false);

  const attributes = (character.attributes ?? {}) as Record<string, number>;
  const level = attributes.level;

  return (
    <motion.div
      custom={index}
      variants={listItemVariants}
      initial="hidden"
      animate="visible"
      className="rounded-lg overflow-hidden"
      style={{
        background: colorAlpha("primary", isOffScene ? 0.02 : 0.04),
        border: `1px solid ${colorAlpha("primary", isOffScene ? 0.06 : 0.12)}`,
        opacity: isOffScene ? 0.7 : 1,
      }}
    >
      {/* 列表项头部 — 可点击 */}
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left cursor-pointer
                   transition-colors duration-150"
        style={{
          background: "transparent",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = colorAlpha("primary", 0.06);
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
        }}
      >
        {/* 状态指示器 */}
        <Circle
          className="w-2.5 h-2.5 shrink-0"
          fill={isOffScene ? color("textMuted") : color("primary")}
          stroke="none"
          style={{
            filter: isOffScene
              ? undefined
              : `drop-shadow(0 0 3px ${colorAlpha("primary", 0.5)})`,
          }}
        />

        {/* 名称 */}
        <span
          className="text-sm font-semibold flex-1 min-w-0 truncate"
          style={{
            color: isOffScene ? color("textMuted") : color("textPrimary"),
          }}
        >
          {character.name}
        </span>

        {/* 等级 */}
        {level != null && (
          <span
            className="text-xs shrink-0 px-1.5 py-0.5 rounded"
            style={{
              background: colorAlpha("secondary", 0.1),
              color: isOffScene ? color("textMuted") : color("secondary"),
            }}
          >
            Lv.{level}
          </span>
        )}

        {/* 展开/收起图标 */}
        <motion.span
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="shrink-0"
          style={{ color: color("textMuted") }}
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </motion.span>
      </button>

      {/* 简要信息（性格摘要） */}
      {!expanded && character.personality && (
        <div className="px-3 pb-2 -mt-0.5">
          <p
            className="text-xs truncate pl-5"
            style={{ color: color("textMuted") }}
          >
            {character.personality}
          </p>
        </div>
      )}

      {/* 展开的详情 */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="detail"
            variants={expandVariants}
            initial="collapsed"
            animate="expanded"
            exit="collapsed"
            className="overflow-hidden"
          >
            <div
              className="px-3 pb-3"
              style={{
                borderTop: `1px solid ${colorAlpha("primary", 0.08)}`,
              }}
            >
              <NpcDetailPanel character={character} worldConfig={worldConfig} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── 分组标题 ──

interface GroupHeaderProps {
  icon: string;
  label: string;
  count: number;
}

function GroupHeader({ icon, label, count }: GroupHeaderProps) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className="text-sm">{icon}</span>
      <span
        className="text-xs font-semibold uppercase tracking-wider"
        style={{ color: color("primary") }}
      >
        {label}
      </span>
      <span
        className="text-xs px-1.5 py-0.5 rounded-full"
        style={{
          background: colorAlpha("primary", 0.1),
          color: color("textMuted"),
        }}
      >
        {count}
      </span>
    </div>
  );
}

// ── 主组件 ──

/**
 * NPC 列表
 *
 * 按状态分组展示当前存档中的 NPC
 */
export function NpcList() {
  const npcs = useNpcCharacters();
  const worldConfig = useRuntimeWorldConfig();

  const { activeNpcs, offSceneNpcs } = useMemo(() => {
    const active: Character[] = [];
    const offScene: Character[] = [];

    for (const npc of npcs) {
      if (npc.status === "active") {
        active.push(npc);
      } else if (npc.status === "off_scene") {
        offScene.push(npc);
      }
    }

    return { activeNpcs: active, offSceneNpcs: offScene };
  }, [npcs]);

  if (npcs.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* 分割线 */}
      <div
        className="h-px"
        style={{
          background: `linear-gradient(90deg, transparent, ${colorAlpha(
            "primary",
            0.2,
          )}, transparent)`,
        }}
      />

      {/* 在场 NPC */}
      {activeNpcs.length > 0 && (
        <div>
          <GroupHeader icon="⬡" label="在场 NPC" count={activeNpcs.length} />
          <div className="space-y-2">
            {activeNpcs.map((npc, i) => (
              <NpcListItem
                key={npc.id}
                character={npc}
                index={i}
                worldConfig={worldConfig}
              />
            ))}
          </div>
        </div>
      )}

      {/* 离场 NPC */}
      {offSceneNpcs.length > 0 && (
        <div>
          <GroupHeader icon="⬡" label="离场 NPC" count={offSceneNpcs.length} />
          <div className="space-y-2">
            {offSceneNpcs.map((npc, i) => (
              <NpcListItem
                key={npc.id}
                character={npc}
                index={i}
                isOffScene
                worldConfig={worldConfig}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
