/**
 * 技能列表组件
 *
 * 在角色面板中展示指定角色的技能列表（只读）
 * 支持点击展开/折叠查看技能详情
 */

import { motion } from "framer-motion";
import { Shield, Star, Swords, Users, Wand2, Wrench, Zap } from "lucide-react";

import type { SkillCategory, SkillInstance } from "@/domain/entities/skill";
import { useInventoryStore } from "@/modules/inventory/store";
import { color, colorAlpha, glow } from "@/styles/tokens";

// ── 稳定引用：避免 selector 中 `?? []` 每次创建新数组导致无限循环 ──
const EMPTY_SKILLS: SkillInstance[] = [];

// ── 类别中文映射 ──

const CATEGORY_LABELS: Record<SkillCategory, string> = {
  combat: "战斗",
  magic: "魔法",
  survival: "生存",
  social: "社交",
  craft: "制作",
  misc: "通用",
};

function getCategoryIcon(category: SkillCategory) {
  switch (category) {
    case "combat":
      return <Swords className="w-3.5 h-3.5" />;
    case "magic":
      return <Wand2 className="w-3.5 h-3.5" />;
    case "survival":
      return <Shield className="w-3.5 h-3.5" />;
    case "social":
      return <Users className="w-3.5 h-3.5" />;
    case "craft":
      return <Wrench className="w-3.5 h-3.5" />;
    case "misc":
    default:
      return <Star className="w-3.5 h-3.5" />;
  }
}

// ── 动画 ──

const easeOut = [0.0, 0.0, 0.2, 1.0] as const;

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

// ── 组件 ──

interface SkillSectionProps {
  characterId: string;
  /** 动画序号，与 CharacterPanel 中其他 Section 的 custom 值衔接 */
  animationIndex?: number;
}

export function SkillSection({
  characterId,
  animationIndex = 5,
}: SkillSectionProps) {
  const skills = useInventoryStore(
    (s) => s.skills[characterId] ?? EMPTY_SKILLS,
  );

  return (
    <motion.div
      custom={animationIndex}
      variants={sectionVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Section 标题 — 与现有 SectionTitle 样式完全一致 */}
      <div
        className="flex items-center gap-2 mb-3"
        style={{
          borderBottom: `1px solid ${colorAlpha("primary", 0.15)}`,
          paddingBottom: "0.5rem",
        }}
      >
        <span style={{ color: color("primary") }}>
          <Zap className="w-4 h-4" />
        </span>
        <h3
          className="text-sm font-semibold uppercase tracking-wider"
          style={{ color: color("primary") }}
        >
          技能
        </h3>
      </div>

      {/* 技能列表 */}
      {skills.length === 0 ? (
        <p
          className="text-xs pl-1 py-2"
          style={{ color: colorAlpha("textMuted", 0.6) }}
        >
          暂无技能
        </p>
      ) : (
        <div className="space-y-2 pl-1">
          {skills.map((skill) => {
            const hasDetails =
              skill.description || skill.cost || skill.maxLevel > 1;
            return (
              <div
                key={skill.instanceId}
                className="rounded-md px-2 py-1.5 transition-colors duration-150"
                style={{
                  background: colorAlpha("primary", 0.04),
                  border: `1px solid ${colorAlpha("primary", 0.08)}`,
                }}
              >
                {/* 名称、等级、类别图标、主动/被动 */}
                <div className="flex items-center gap-2">
                  {/* 类别图标 */}
                  <span
                    className="shrink-0"
                    style={{
                      color: skill.activeUsable
                        ? color("secondary")
                        : color("primary"),
                    }}
                  >
                    {getCategoryIcon(skill.category)}
                  </span>

                  {/* 信息 */}
                  <div className="flex-1 min-w-0 flex items-center gap-1.5">
                    <span
                      className="text-sm font-semibold"
                      style={{
                        color: color("textPrimary"),
                        textShadow:
                          skill.level > 1
                            ? glow("primary", "sm", 0.3)
                            : undefined,
                      }}
                    >
                      {skill.name}
                    </span>

                    {/* 等级 */}
                    <span
                      className="text-xs font-bold"
                      style={{ color: color("secondary") }}
                    >
                      Lv.{skill.level}
                    </span>

                    {/* 主动/被动 标记 */}
                    <span
                      className="text-xs px-1 py-0.5 rounded"
                      style={{
                        background: colorAlpha(
                          skill.activeUsable ? "secondary" : "textMuted",
                          0.12,
                        ),
                        color: color(
                          skill.activeUsable ? "secondary" : "textMuted",
                        ),
                      }}
                    >
                      {skill.activeUsable ? "主动" : "被动"}
                    </span>

                    {/* 类别文字 */}
                    <span
                      className="text-xs ml-auto hidden sm:inline"
                      style={{ color: colorAlpha("textMuted", 0.5) }}
                    >
                      {CATEGORY_LABELS[skill.category] ?? skill.category}
                    </span>
                  </div>
                </div>

                {/* 详细信息 — 始终显示 */}
                {hasDetails && (
                  <div
                    className="mt-2 pt-2 ml-5.5 space-y-2"
                    style={{
                      borderTop: `1px solid ${colorAlpha("primary", 0.1)}`,
                    }}
                  >
                    {/* 描述 */}
                    {skill.description && (
                      <p
                        className="text-xs leading-relaxed"
                        style={{ color: colorAlpha("textMuted", 0.7) }}
                      >
                        {skill.description}
                      </p>
                    )}

                    {/* 资源消耗 */}
                    {skill.cost && (
                      <div className="flex items-center gap-2">
                        <span
                          className="text-xs"
                          style={{ color: colorAlpha("textMuted", 0.5) }}
                        >
                          消耗
                        </span>
                        <span
                          className="text-xs font-medium px-1.5 py-0.5 rounded"
                          style={{
                            background: colorAlpha("error", 0.1),
                            color: color("error"),
                          }}
                        >
                          {skill.cost.field} -{skill.cost.amount}
                        </span>
                      </div>
                    )}

                    {/* 等级进度条 */}
                    {skill.maxLevel > 1 && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span
                            className="text-xs"
                            style={{ color: colorAlpha("textMuted", 0.5) }}
                          >
                            等级进度
                          </span>
                          <span
                            className="text-xs font-bold"
                            style={{ color: color("secondary") }}
                          >
                            {skill.level} / {skill.maxLevel}
                          </span>
                        </div>
                        <div
                          className="h-1.5 rounded-full overflow-hidden"
                          style={{
                            background: colorAlpha("primary", 0.1),
                          }}
                        >
                          <motion.div
                            className="h-full rounded-full"
                            style={{
                              background: color("primary"),
                              boxShadow: glow("primary", "sm", 0.4),
                            }}
                            initial={{ width: 0 }}
                            animate={{
                              width: `${(skill.level / skill.maxLevel) * 100}%`,
                            }}
                            transition={{
                              duration: 0.4,
                              ease: easeOut,
                              delay: 0.1,
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
