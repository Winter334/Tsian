/**
 * 角色详情面板
 *
 * 通用的角色信息展示组件，包含标签页导航和对应内容渲染。
 * 可独立于 Dialog 使用，支持通过 config 控制可见标签和只读模式。
 *
 * 布局：桌面端左侧竖向标签导航（~136px）+ 右侧内容区；
 *       移动端顶部横向标签 + 下方内容区。
 */

import type { Easing } from "framer-motion";
import { AnimatePresence, motion } from "framer-motion";
import { Activity, Package, Shield, Sparkles, User, Zap } from "lucide-react";
import { useMemo, useState } from "react";

import type { Character } from "@/domain/entities/character";
import { useCharacterFullStats } from "@/hooks/useCharacterFullStats";
import { getTalentRarityVisual } from "@/lib/ui/talent-rarity";
import type { TalentConfig, WorldConfig } from "@/lib/world/types";
import { resolveDimensionSelections } from "@/lib/world/types";
import { useCurrentSaveId } from "@/modules";
import { color, colorAlpha, glow } from "@/styles/tokens";
import { CharacterPortraitPanel } from "./CharacterPortraitPanel";
import { CharacterRadarChart } from "./CharacterRadarChart";
import { EquipmentSection } from "./EquipmentSection";
import { InventorySection } from "./InventorySection";
import { LevelAllocationPanel } from "./LevelAllocationPanel";
import { SkillSection } from "./SkillSection";
import { StatusSection } from "./StatusSection";
import { TalentDrawPanel } from "./TalentDrawPanel";

// ── 类型定义 ──

export type CharacterDetailTabKey =
  | "overview"
  | "talents"
  | "status"
  | "skills"
  | "inventory"
  | "equipment";

export interface CharacterDetailConfig {
  visibleTabs?: CharacterDetailTabKey[];
  readonly?: boolean;
}

export interface CharacterDetailPanelProps {
  character: Character;
  worldConfig: WorldConfig;
  config?: CharacterDetailConfig;
}

// ── 标签配置 ──

interface TabItem {
  key: CharacterDetailTabKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TAB_ITEMS: TabItem[] = [
  { key: "overview", label: "基础信息", icon: User },
  { key: "talents", label: "天赋", icon: Sparkles },
  { key: "status", label: "状态", icon: Activity },
  { key: "skills", label: "技能", icon: Zap },
  { key: "inventory", label: "背包", icon: Package },
  { key: "equipment", label: "装备", icon: Shield },
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

// ── 辅助组件 ──

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

// ── 标签导航 ──

interface TabNavigationProps {
  tabs: TabItem[];
  activeTab: CharacterDetailTabKey;
  onTabChange: (tab: CharacterDetailTabKey) => void;
}

function TabNavigation({ tabs, activeTab, onTabChange }: TabNavigationProps) {
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
        {tabs.map((tab) => {
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
        {tabs.map((tab) => {
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

  const fullStats = useCharacterFullStats(character, worldConfig);

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
      {/* ── 顶部两列区域：左列大头像 + 右列基本信息 ── */}
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

        {/* 右列：仅基本信息 */}
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
        </div>
      </motion.div>

      <motion.div
        custom={1}
        variants={sectionVariants}
        initial="hidden"
        animate="visible"
      >
        <LevelAllocationPanel character={character} worldConfig={worldConfig} />
      </motion.div>

      {character.pendingTalentDraws &&
      character.pendingTalentDraws.length > 0 ? (
        <motion.div
          custom={2}
          variants={sectionVariants}
          initial="hidden"
          animate="visible"
        >
          <TalentDrawPanel character={character} worldConfig={worldConfig} />
        </motion.div>
      ) : null}

      {/* ── 属性雷达图（居中，完整宽度） ── */}
      {allocatableKeys.length > 0 && (
        <motion.div
          custom={3}
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
  const rarityById = useMemo(
    () =>
      new Map(
        (worldConfig.talentRules?.rarities ?? []).map((rarity) => [
          rarity.id,
          rarity,
        ]),
      ),
    [worldConfig.talentRules?.rarities],
  );

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
          const sourceTone = dimLabel ? "secondary" : "primary";
          const rarity = talent.rarity
            ? (rarityById.get(talent.rarity) ?? null)
            : null;
          const rarityVisual = getTalentRarityVisual(rarity, {
            fallbackColor: sourceTone,
            fallbackGlow: sourceTone,
            backgroundAlpha: 0.08,
            borderAlpha: 0.18,
            glowAlpha: 0.14,
            strongGlowAlpha: 0.22,
            glowSize: "sm",
            strongGlowSize: "md",
          });

          return (
            <div
              key={talent.id}
              className="rounded-md px-2 py-1.5 transition-colors duration-150"
              style={{
                background: `linear-gradient(135deg, ${rarityVisual.accentSoft} 0%, ${colorAlpha("bgCard", 0.62)} 72%, ${rarityVisual.glowSoft} 100%)`,
                border: `1px solid ${rarityVisual.accentBorder}`,
                boxShadow: rarityVisual.accentGlow,
              }}
            >
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex flex-1 flex-wrap items-center gap-1.5">
                  <span
                    className="text-sm font-semibold"
                    style={{
                      color: rarityVisual.accentColor,
                    }}
                  >
                    {talent.name}
                  </span>
                  {rarity?.label ? (
                    <span
                      className="rounded px-1.5 py-0.5 text-[10px] font-medium"
                      style={{
                        background: rarityVisual.accentSoft,
                        color: rarityVisual.accentColor,
                        border: `1px solid ${rarityVisual.accentBorder}`,
                      }}
                    >
                      {rarity.label}
                    </span>
                  ) : null}
                  {dimLabel ? (
                    <span
                      className="rounded px-1.5 py-0.5 text-[10px]"
                      style={{
                        background: colorAlpha("secondary", 0.12),
                        color: color("secondary"),
                        border: `1px solid ${colorAlpha("secondary", 0.24)}`,
                      }}
                    >
                      {dimLabel}
                    </span>
                  ) : null}
                </div>
              </div>

              {talent.description && (
                <div
                  className="mt-2 pt-2"
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
  tab: CharacterDetailTabKey,
  character: Character,
  worldConfig: WorldConfig,
  readonly?: boolean,
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
    case "status":
      return <StatusSection character={character} worldConfig={worldConfig} />;
    case "skills":
      return <SkillSection characterId={character.id} animationIndex={0} />;
    case "inventory":
      return (
        <InventorySection
          characterId={character.id}
          worldConfig={worldConfig}
          animationIndex={0}
          readonly={readonly}
        />
      );
    case "equipment":
      return (
        <EquipmentSection
          characterId={character.id}
          worldConfig={worldConfig}
          animationIndex={0}
          readonly={readonly}
        />
      );
  }
}

// ── 主组件 ──

/**
 * 角色详情面板
 *
 * 渲染标签页导航 + 对应内容区。
 * 不包含 Dialog 容器和 padding 补偿逻辑，由调用方自行包裹。
 */
export function CharacterDetailPanel({
  character,
  worldConfig,
  config,
}: CharacterDetailPanelProps) {
  const visibleTabs = config?.visibleTabs;
  const readonly = config?.readonly;

  const filteredTabs = useMemo(
    () =>
      visibleTabs
        ? TAB_ITEMS.filter((t) => visibleTabs.includes(t.key))
        : TAB_ITEMS,
    [visibleTabs],
  );

  const [activeTab, setActiveTab] = useState<CharacterDetailTabKey>(
    filteredTabs[0]?.key ?? "overview",
  );

  return (
    <div className="flex flex-col md:flex-row h-full">
      {/* 标签导航 */}
      <TabNavigation
        tabs={filteredTabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

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
            {renderActiveTabContent(
              activeTab,
              character,
              worldConfig,
              readonly,
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
