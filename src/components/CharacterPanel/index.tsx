/**
 * 角色面板组件
 *
 * 在游戏中查看玩家角色的完整信息：
 * 名称、种族、背景、外貌、性格、属性、天赋、状态
 *
 * 数据从当前存档的 Yjs 文档中读取
 *
 * 布局：桌面端左侧竖向标签导航（~120px）+ 右侧内容区；
 *       移动端顶部横向标签 + 下方内容区。
 */

import type { Easing } from "framer-motion";
import { AnimatePresence, motion } from "framer-motion";
import {
  Package,
  Shield,
  Sparkles,
  Star,
  Swords,
  User,
  Users,
  Wand2,
  Wrench,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Dialog, DialogContent } from "@/components/ui";
import { yjsManager } from "@/core/yjs";
import type { Character } from "@/domain/entities/character";
import { computeDerivedStats } from "@/lib/rules/derived-stats";
import { getRuntimeWorldConfig } from "@/lib/world/resolve-config";
import type { TalentConfig, WorldConfig } from "@/lib/world/types";
import { resolveDimensionSelections } from "@/lib/world/types";
import { useCurrentSaveId } from "@/modules";
import { yMapToCharacter } from "@/modules/game/repository";
import { color, colorAlpha, glow } from "@/styles/tokens";
import { CharacterDescriptionPanel } from "./CharacterDescriptionPanel";
import { CharacterPortraitPanel } from "./CharacterPortraitPanel";
import { CharacterRadarChart } from "./CharacterRadarChart";
import { CharacterResources } from "./CharacterResources";
import { InventorySection } from "./InventorySection";
import { NpcList } from "./NpcList";
import { SkillSection } from "./SkillSection";

// ── 标签类型与配置 ──

type CharacterPanelTabKey =
  | "overview"
  | "talents"
  | "skills"
  | "inventory"
  | "npcs";

interface TabItem {
  key: CharacterPanelTabKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TAB_ITEMS: TabItem[] = [
  { key: "overview", label: "基础信息", icon: User },
  { key: "talents", label: "天赋", icon: Sparkles },
  { key: "skills", label: "技能", icon: Zap },
  {
    key: "inventory",
    label: "背包",
    icon: Package,
  },
  { key: "npcs", label: "NPC", icon: Users },
];

// ── 动画 ──

const easeOut: Easing = [0.0, 0.0, 0.2, 1.0];

const sectionVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: 0.1 + i * 0.08,
      duration: 0.3,
      ease: easeOut,
    },
  }),
};

/** 标签切换时内容区的淡入/滑移动画 */
const tabContentVariants = {
  initial: { opacity: 0, y: 8 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.2, ease: easeOut },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: 0.15 },
  },
};

// ── 数据查找工具 ──

function getTalent(
  talentId: string,
  worldConfig: WorldConfig,
): TalentConfig | undefined {
  return worldConfig.talents?.find((t) => t.id === talentId);
}

// ── Hook: 读取运行时 WorldConfig（来自当前存档快照） ──

function useRuntimeWorldConfig(): WorldConfig {
  const currentSaveId = useCurrentSaveId();
  return useMemo(() => {
    // 显式依赖 currentSaveId，确保切换存档时重新读取快照
    void currentSaveId;
    return getRuntimeWorldConfig();
  }, [currentSaveId]);
}

function getCategoryIcon(category?: TalentConfig["category"]) {
  switch (category) {
    case "combat":
      return <Swords className="w-3.5 h-3.5" />;
    case "magic":
      return <Wand2 className="w-3.5 h-3.5" />;
    case "survival":
      return <Shield className="w-3.5 h-3.5" />;
    case "social":
      return <Users className="w-3.5 h-3.5" />;
    case "misc":
      return <Wrench className="w-3.5 h-3.5" />;
    default:
      return <Star className="w-3.5 h-3.5" />;
  }
}

// ── 子组件 ──

function SectionTitle({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex items-center gap-2 mb-3"
      style={{
        borderBottom: `1px solid ${colorAlpha("primary", 0.15)}`,
        paddingBottom: "0.5rem",
      }}
    >
      <span style={{ color: color("primary") }}>{icon}</span>
      <h3
        className="text-sm font-semibold uppercase tracking-wider"
        style={{ color: color("primary") }}
      >
        {children}
      </h3>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[4rem_auto] items-baseline gap-x-3 py-1">
      <span
        className="text-xs font-medium text-right"
        style={{ color: colorAlpha("textMuted", 0.7) }}
      >
        {label}
      </span>
      <span
        className="text-sm font-medium"
        style={{ color: color("textPrimary") }}
      >
        {value}
      </span>
    </div>
  );
}

// ── Hook: 从 Yjs 读取玩家角色 ──

/**
 * 从当前存档读取第一个 player 角色
 * 参考 chat handler 中的数据获取方式
 */
function usePlayerCharacter(): Character | null {
  const [character, setCharacter] = useState<Character | null>(null);
  const currentSaveId = useCurrentSaveId();

  const readCharacter = useCallback(() => {
    const currentSave = yjsManager.getCurrentSave();
    if (!currentSave) {
      setCharacter(null);
      return;
    }

    const charactersMap = currentSave.get("characters") as
      | import("yjs").Map<import("yjs").Map<unknown>>
      | undefined;

    if (charactersMap && charactersMap.size > 0) {
      let playerChar: Character | null = null;
      charactersMap.forEach((charMap) => {
        const char = yMapToCharacter(charMap);
        if ((char.controlType ?? "player") === "player" && !playerChar) {
          playerChar = char;
        }
      });

      setCharacter(playerChar);
      return;
    }

    setCharacter(null);
  }, []);

  useEffect(() => {
    // 初始读取（覆盖 currentSaveId 从 null 变为有效值的场景）
    readCharacter();

    const currentSave = yjsManager.getCurrentSave();
    if (!currentSave) return;

    const saveHandler = () => readCharacter();
    currentSave.observe(saveHandler);

    const charactersMap = currentSave.get("characters") as
      | import("yjs").Map<import("yjs").Map<unknown>>
      | undefined;

    if (charactersMap) {
      const mapHandler = () => readCharacter();
      charactersMap.observeDeep(mapHandler);

      return () => {
        charactersMap.unobserveDeep(mapHandler);
        currentSave.unobserve(saveHandler);
      };
    }

    return () => {
      currentSave.unobserve(saveHandler);
    };
  }, [readCharacter, currentSaveId]);

  return character;
}

// ── 标签导航 ──

interface TabNavigationProps {
  activeTab: CharacterPanelTabKey;
  onTabChange: (tab: CharacterPanelTabKey) => void;
}

function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  return (
    <>
      {/* 桌面端：左侧竖向标签 */}
      <nav
        className="hidden md:flex flex-col shrink-0 w-36 py-3 gap-2"
        role="tablist"
        aria-orientation="vertical"
        style={{
          borderRight: `1px solid ${colorAlpha("primary", 0.15)}`,
        }}
      >
        {TAB_ITEMS.map((tab) => {
          const isActive = activeTab === tab.key;
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              role="tab"
              aria-selected={isActive}
              onClick={() => onTabChange(tab.key)}
              className="flex items-center gap-3 px-3 py-3 text-left transition-all duration-200 text-base font-medium"
              style={{
                color: isActive ? color("primary") : color("textMuted"),
                background: isActive
                  ? colorAlpha("primary", 0.1)
                  : "transparent",
                borderRight: isActive
                  ? `3px solid ${color("primary")}`
                  : "3px solid transparent",
                boxShadow: isActive ? glow("primary", "sm", 0.15) : undefined,
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = color("textPrimary");
                  e.currentTarget.style.background = colorAlpha(
                    "primary",
                    0.05,
                  );
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = color("textMuted");
                  e.currentTarget.style.background = "transparent";
                }
              }}
            >
              <Icon className="w-6 h-6 shrink-0" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* 移动端：顶部横向标签 */}
      <nav
        className="flex md:hidden overflow-x-auto gap-1 px-2 py-2 shrink-0"
        role="tablist"
        aria-orientation="horizontal"
        style={{
          borderBottom: `1px solid ${colorAlpha("primary", 0.15)}`,
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        {TAB_ITEMS.map((tab) => {
          const isActive = activeTab === tab.key;
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              role="tab"
              aria-selected={isActive}
              onClick={() => onTabChange(tab.key)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-md whitespace-nowrap transition-all duration-200 text-xs font-medium shrink-0"
              style={{
                color: isActive ? color("primary") : color("textMuted"),
                background: isActive
                  ? colorAlpha("primary", 0.1)
                  : "transparent",
                borderBottom: isActive
                  ? `2px solid ${color("primary")}`
                  : "2px solid transparent",
              }}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}

// ── 标签内容：基础信息（overview） ──

function OverviewTabContent({
  character,
  worldConfig,
}: {
  character: Character;
  worldConfig: WorldConfig;
}) {
  const currentSaveId = useCurrentSaveId();

  const allocatableKeys = useMemo(
    () => worldConfig.pointBuyRules?.allocatableAttributes ?? [],
    [worldConfig],
  );

  // 计算完整属性集（基础 + 衍生），并对资源字段执行保护合并
  const fullStats = useMemo(() => {
    const baseFields: Record<string, number | string | boolean> = {};
    const attrs = character.attributes ?? {};
    for (const [k, v] of Object.entries(attrs)) {
      if (
        typeof v === "number" ||
        typeof v === "string" ||
        typeof v === "boolean"
      ) {
        baseFields[k] = v;
      }
    }
    const computed = computeDerivedStats(baseFields, worldConfig.derivedStats);

    // 保护合并：资源字段的 current 优先使用 character.attributes 中 AI 已修改的值
    for (const stat of worldConfig.derivedStats) {
      if (!stat.isResource || !stat.maxField) continue;

      // current: 优先读取 attributes（保留 AI 战斗中修改的值），缺失回退 computed
      const attrCurrent = attrs[stat.key];
      if (typeof attrCurrent === "number" && Number.isFinite(attrCurrent)) {
        computed[stat.key] = attrCurrent;
      }

      // max: 优先保持 computed（公式计算值），缺失时回退 attributes
      const computedMax = computed[stat.maxField];
      if (typeof computedMax !== "number" || !Number.isFinite(computedMax)) {
        const attrMax = attrs[stat.maxField];
        if (typeof attrMax === "number" && Number.isFinite(attrMax)) {
          computed[stat.maxField] = attrMax;
        }
      }
    }

    return computed;
  }, [character.attributes, worldConfig.derivedStats]);

  // 维度选择解析
  const resolvedDimensions = useMemo(
    () =>
      resolveDimensionSelections(
        worldConfig,
        character.dimensionSelections ?? {},
      ),
    [character.dimensionSelections, worldConfig],
  );

  // 状态标签颜色
  const statusLabel = useMemo(() => {
    switch (character.status) {
      case "active":
        return { text: "活跃", color: "primary" as const };
      case "off_scene":
        return { text: "离场", color: "textMuted" as const };
      case "archived":
        return { text: "归档", color: "textMuted" as const };
      case "dead":
        return { text: "死亡", color: "error" as const };
      default:
        return { text: character.status, color: "textMuted" as const };
    }
  }, [character.status]);

  const genderDisplay = useMemo(() => {
    const rawGender = character.gender?.trim();
    if (!rawGender) return undefined;

    switch (rawGender.toLowerCase()) {
      case "male":
        return "男";
      case "female":
        return "女";
      case "other":
        return "其他";
      default:
        return rawGender;
    }
  }, [character.gender]);

  return (
    <div className="space-y-5">
      {/* ── 顶部两列区域：左列大头像 + 右列资源/基本信息 ── */}
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-[2fr_3fr] gap-4 items-stretch"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: easeOut }}
      >
        {/* 左列：大头像（自适应容器，保持正方形） */}
        <CharacterPortraitPanel
          saveId={currentSaveId}
          characterId={character.id}
          className="aspect-square w-full max-w-50 sm:max-w-none rounded-lg overflow-hidden"
        />

        {/* 右列：基本信息 + 资源 */}
        <div className="flex flex-col gap-4 min-w-0">
          {/* 基本信息：角色名 + 状态标签 + 维度行 */}
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <h2
                className="text-2xl font-bold truncate"
                style={{
                  color: color("primary"),
                  textShadow: glow("primary", "sm", 0.25),
                }}
              >
                {character.name}
              </h2>
              <span
                className="text-xs px-2 py-0.5 rounded-full shrink-0"
                style={{
                  background: colorAlpha(statusLabel.color, 0.12),
                  color: color(statusLabel.color),
                  border: `1px solid ${colorAlpha(statusLabel.color, 0.25)}`,
                }}
              >
                {statusLabel.text}
              </span>
            </div>
            <div
              className="mt-2 pt-2"
              style={{
                borderTop: `1px solid ${colorAlpha("primary", 0.1)}`,
              }}
            >
              {resolvedDimensions.map((d) => (
                <InfoRow
                  key={d.dimensionId}
                  label={d.dimensionLabel}
                  value={d.option?.name ?? "未选择"}
                />
              ))}
              {genderDisplay && <InfoRow label="性别" value={genderDisplay} />}
              {character.age != null && (
                <InfoRow label="年龄" value={String(character.age)} />
              )}
              {/* 等级 */}
              {character.attributes?.level != null && (
                <InfoRow
                  label="等级"
                  value={
                    <span
                      className="font-bold"
                      style={{
                        color: color("secondary"),
                        textShadow: glow("secondary", "sm", 0.3),
                      }}
                    >
                      {String(character.attributes.level)}
                    </span>
                  }
                />
              )}
            </div>
          </div>

          {/* 资源区域 */}
          <CharacterResources worldConfig={worldConfig} fullStats={fullStats} />
        </div>
      </motion.div>

      {/* ── 属性雷达图（居中，完整宽度） ── */}
      {allocatableKeys.length > 0 && (
        <motion.div
          custom={1}
          variants={sectionVariants}
          initial="hidden"
          animate="visible"
        >
          <SectionTitle icon={<Shield className="w-4 h-4" />}>
            属性
          </SectionTitle>
          <CharacterRadarChart
            worldConfig={worldConfig}
            fullStats={fullStats}
          />
        </motion.div>
      )}

      {/* ── 描述 ── */}
      <motion.div
        custom={2}
        variants={sectionVariants}
        initial="hidden"
        animate="visible"
      >
        <CharacterDescriptionPanel
          appearance={character.appearance}
          personality={character.personality}
          description={character.description}
        />
      </motion.div>
    </div>
  );
}

// ── 标签内容：天赋 ──

function TalentsTabContent({
  character,
  worldConfig,
}: {
  character: Character;
  worldConfig: WorldConfig;
}) {
  const talentInfos = useMemo(() => {
    const ids = character.talentIds ?? [];
    return ids
      .map((id) => getTalent(id, worldConfig))
      .filter((t): t is TalentConfig => t != null);
  }, [character.talentIds, worldConfig]);

  // 维度自动天赋来源 (talentId → dimensionId)
  const dimensionTalentSources = useMemo(() => {
    const sources = new Map<string, string>();
    for (const dim of worldConfig.dimensions ?? []) {
      const selectedId = (character.dimensionSelections ?? {})[dim.id];
      if (!selectedId) continue;
      const option = dim.options.find((o) => o.id === selectedId);
      if (!option?.effects) continue;
      for (const tid of option.effects.grantedTalents ?? []) {
        sources.set(tid, dim.id);
      }
    }
    return sources;
  }, [character.dimensionSelections, worldConfig]);

  if (talentInfos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Sparkles
          className="w-10 h-10 mb-3"
          style={{ color: colorAlpha("textMuted", 0.4) }}
        />
        <p className="text-sm" style={{ color: color("textMuted") }}>
          暂无天赋
        </p>
      </div>
    );
  }

  return (
    <div>
      <SectionTitle icon={<Sparkles className="w-4 h-4" />}>天赋</SectionTitle>
      <div className="space-y-2 pl-1">
        {talentInfos.map((talent) => {
          const dimSource = dimensionTalentSources.get(talent.id);
          const dimLabel = dimSource
            ? (worldConfig.dimensions?.find((d) => d.id === dimSource)?.label ??
              dimSource)
            : undefined;
          return (
            <div
              key={talent.id}
              className="rounded-md px-2 py-1.5 transition-colors duration-150"
              style={{
                background: colorAlpha("primary", 0.04),
                border: `1px solid ${colorAlpha("primary", 0.08)}`,
              }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="shrink-0"
                  style={{
                    color: dimLabel ? color("secondary") : color("primary"),
                  }}
                >
                  {getCategoryIcon(talent.category)}
                </span>
                <div className="flex-1 min-w-0 flex items-center gap-1.5">
                  <span
                    className="text-sm font-semibold"
                    style={{
                      color: color("textPrimary"),
                    }}
                  >
                    {talent.name}
                  </span>
                  {dimLabel && (
                    <span
                      className="text-xs px-1 py-0.5 rounded"
                      style={{
                        background: colorAlpha("secondary", 0.12),
                        color: color("secondary"),
                      }}
                    >
                      {dimLabel}
                    </span>
                  )}
                </div>
              </div>

              {talent.description && (
                <div
                  className="mt-2 pt-2 ml-5.5"
                  style={{
                    borderTop: `1px solid ${colorAlpha("primary", 0.1)}`,
                  }}
                >
                  <p
                    className="text-xs leading-relaxed"
                    style={{ color: colorAlpha("textMuted", 0.7) }}
                  >
                    {talent.description}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── 标签内容渲染 ──

function renderActiveTabContent(
  tab: CharacterPanelTabKey,
  character: Character,
  worldConfig: WorldConfig,
): React.ReactNode {
  switch (tab) {
    case "overview":
      return (
        <OverviewTabContent character={character} worldConfig={worldConfig} />
      );
    case "talents":
      return (
        <TalentsTabContent character={character} worldConfig={worldConfig} />
      );
    case "skills":
      return <SkillSection characterId={character.id} animationIndex={0} />;
    case "inventory":
      return (
        <InventorySection
          characterId={character.id}
          worldConfig={worldConfig}
          animationIndex={0}
        />
      );
    case "npcs":
      return <NpcList />;
  }
}

// ── 空状态 ──

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <User
        className="w-12 h-12 mb-4"
        style={{ color: colorAlpha("textMuted", 0.4) }}
      />
      <p className="text-sm" style={{ color: color("textMuted") }}>
        未找到角色数据
      </p>
      <p
        className="text-xs mt-1"
        style={{ color: colorAlpha("textMuted", 0.6) }}
      >
        请先创建角色或加载存档
      </p>
    </div>
  );
}

// ── 主组件导出 ──

interface CharacterPanelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * 角色面板对话框
 *
 * 以 Dialog 形式弹出，展示当前存档中的玩家角色信息。
 * 桌面端约 900px 宽度，左侧竖向标签导航 + 右侧内容区；
 * 小屏顶部横向标签 + 下方内容。
 */
export function CharacterPanelDialog({
  open,
  onOpenChange,
}: CharacterPanelDialogProps) {
  const character = usePlayerCharacter();
  const worldConfig = useRuntimeWorldConfig();
  const [activeTab, setActiveTab] = useState<CharacterPanelTabKey>("overview");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="⬡ 角色信息" width={900} animateLifecycle>
        {character ? (
          /* 用 -m-4 抵消 DialogContent 内部的 p-4 padding，实现全尺寸控制 */
          <div className="-m-4 flex flex-col md:flex-row h-[70vh]">
            {/* 标签导航 */}
            <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />

            {/* 标签内容区 — 独立滚动 */}
            <div
              className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4"
              role="tabpanel"
              style={{
                scrollbarWidth: "thin",
                scrollbarGutter: "stable",
              }}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  variants={tabContentVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                >
                  {renderActiveTabContent(activeTab, character, worldConfig)}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        ) : (
          /* 无角色时保持原有行为：EmptyState + NpcList */
          <>
            <EmptyState />
            <NpcList />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export { CharacterButton } from "./CharacterButton";
export { usePlayerCharacter };
